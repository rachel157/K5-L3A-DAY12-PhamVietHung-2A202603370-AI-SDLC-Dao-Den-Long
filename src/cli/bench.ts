import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { computeBenchMetrics } from "../core/benchMetrics.js";

interface BenchArgs {
  seed: number;
  duration: number;
  outPath: string;
  headless: boolean;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".map": "application/json",
};

function parseBenchArgs(argv: string[]): BenchArgs {
  let seed: number | null = null;
  let duration = 30;
  let outPath: string | null = null;
  let headless = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--seed" && i + 1 < argv.length) {
      seed = Number(argv[++i]);
    } else if (arg === "--duration" && i + 1 < argv.length) {
      duration = Number(argv[++i]);
    } else if (arg === "--out" && i + 1 < argv.length) {
      outPath = argv[++i]!;
    } else if (arg === "--headless") {
      headless = true;
    } else {
      throw new Error(`Unknown or incomplete flag: ${arg}`);
    }
  }

  if (seed === null || !Number.isInteger(seed)) {
    throw new Error("--seed <int> is required");
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("--duration <seconds> must be > 0");
  }
  if (!outPath) {
    throw new Error("--out <path> is required");
  }
  return { seed, duration, outPath, headless };
}

function findBrowserExecutable(): string {
  const override = process.env.BENCH_BROWSER;
  if (override && fs.existsSync(override)) return override;

  const candidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
          "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/usr/bin/microsoft-edge",
          ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    "No Chromium/Chrome/Edge browser executable found. Set BENCH_BROWSER env var to its path."
  );
}

function killBrowserTree(proc: ChildProcess | null): void {
  if (!proc || proc.pid === undefined) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      proc.kill("SIGKILL");
    }
  } catch {
    // Best-effort cleanup
  }
}

async function main(): Promise<void> {
  const args = parseBenchArgs(process.argv.slice(2));
  const tStartMs = performance.now();

  const cliDir = path.dirname(fileURLToPath(import.meta.url));
  const distDir = path.resolve(cliDir, "../../dist");
  if (!fs.existsSync(path.join(distDir, "index.html"))) {
    throw new Error("Missing dist/index.html. Run `npm run build` first.");
  }

  const browserExe = findBrowserExecutable();
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), "ddl-bench-profile-"));
  let browserProc: ChildProcess | null = null;
  let loadMs = 0;

  try {
    const resultPayload = await new Promise<{ dtListMs: number[]; renderer: string }>(
      (resolve, reject) => {
        const timeoutMs = (args.duration + 45) * 1000;
        const timer = setTimeout(() => {
          reject(new Error(`Benchmark timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        const server = http.createServer((req, res) => {
          const urlPath = (req.url ?? "/").split("?")[0] ?? "/";

          if (urlPath === "/__bench_loaded" && req.method === "POST") {
            if (loadMs === 0) {
              loadMs = performance.now() - tStartMs;
            }
            res.writeHead(200);
            res.end("ok");
            return;
          }

          if (urlPath === "/__bench_result" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => {
              body += chunk;
            });
            req.on("end", () => {
              clearTimeout(timer);
              res.writeHead(200);
              res.end("ok");
              server.close();
              try {
                const parsed = JSON.parse(body) as {
                  dtListMs?: number[];
                  renderer?: string;
                };
                resolve({
                  dtListMs: Array.isArray(parsed.dtListMs) ? parsed.dtListMs : [],
                  renderer: String(parsed.renderer ?? "Three.js WebGLRenderer"),
                });
              } catch (err) {
                reject(err);
              }
            });
            return;
          }

          const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
          const target = path.resolve(distDir, rel);
          if (!target.startsWith(distDir) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
            res.writeHead(404);
            res.end("Not found");
            return;
          }
          const ext = path.extname(target).toLowerCase();
          res.writeHead(200, { "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream" });
          fs.createReadStream(target).pipe(res);
        });

        server.listen(0, "127.0.0.1", () => {
          const addr = server.address();
          if (!addr || typeof addr === "string") {
            clearTimeout(timer);
            reject(new Error("Failed to bind benchmark server"));
            return;
          }
          const benchUrl = `http://127.0.0.1:${addr.port}/?bench=1&seed=${args.seed}&duration=${args.duration}`;
          const browserArgs = [
            `--app=${benchUrl}`,
            "--window-size=1280,720",
            "--disable-gpu-vsync",
            "--disable-frame-rate-limit",
            "--no-first-run",
            "--no-default-browser-check",
            `--user-data-dir=${tmpProfile}`,
          ];
          if (args.headless) {
            browserArgs.unshift("--headless=new", "--use-gl=angle", "--enable-webgl");
          }
          browserProc = spawn(browserExe, browserArgs, { stdio: "ignore" });
          browserProc.on("error", (err) => {
            clearTimeout(timer);
            server.close();
            reject(err);
          });
        });
      }
    );

    const report = computeBenchMetrics({
      dtListMs: resultPayload.dtListMs,
      loadMs: loadMs > 0 ? loadMs : performance.now() - tStartMs,
      peakMemMb: null, // Browser sandbox isolates GPU/Renderer child processes from Node process.memoryUsage().rss
      vsyncOff: true,
      renderer: resultPayload.renderer,
      osName: `${os.platform()} ${os.release()} (${os.arch()})`,
    });

    const absOut = path.resolve(args.outPath);
    fs.mkdirSync(path.dirname(absOut), { recursive: true });
    fs.writeFileSync(absOut, JSON.stringify(report, null, 2) + "\n", "utf8");
  } finally {
    killBrowserTree(browserProc);
    try {
      fs.rmSync(tmpProfile, { recursive: true, force: true });
    } catch {
      // Browser handle release delay on Windows
    }
  }
}

main().catch((err) => {
  console.error(`Bench error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
