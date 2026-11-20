import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addLeaderboardEntry,
  formatIsoWithTimezone,
  sortLeaderboardEntries,
  type LeaderboardEntry,
} from "../core/leaderboard.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".map": "application/json",
};

function resolveLeaderboardPath(): string {
  const envPath = process.env.DDL_LEADERBOARD_PATH;
  if (envPath && envPath.trim().length > 0) {
    return path.resolve(envPath);
  }
  return path.join(os.homedir(), ".dao-den-long", "leaderboard.json");
}

function readLeaderboardFile(filePath: string): LeaderboardEntry[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      entries?: LeaderboardEntry[];
    };
    return sortLeaderboardEntries(Array.isArray(parsed?.entries) ? parsed.entries : []);
  } catch {
    return [];
  }
}

function writeLeaderboardFile(filePath: string, entries: LeaderboardEntry[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ entries }, null, 2) + "\n", "utf8");
}

function openBrowser(url: string): void {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  }
}

function main(): void {
  const argv = process.argv.slice(2);
  let exportPath: string | null = null;
  let noOpen = false;
  let port = 0;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--export-leaderboard" && i + 1 < argv.length) {
      exportPath = argv[++i]!;
    } else if (arg === "--no-open") {
      noOpen = true;
    } else if (arg === "--port" && i + 1 < argv.length) {
      port = Number(argv[++i]);
    }
  }

  const dbPath = resolveLeaderboardPath();

  if (exportPath !== null) {
    const entries = readLeaderboardFile(dbPath);
    const absOut = path.resolve(exportPath);
    fs.mkdirSync(path.dirname(absOut), { recursive: true });
    fs.writeFileSync(absOut, JSON.stringify({ entries }, null, 2) + "\n", "utf8");
    return;
  }

  const cliDir = path.dirname(fileURLToPath(import.meta.url));
  const distDir = path.resolve(cliDir, "../../dist");
  if (!fs.existsSync(path.join(distDir, "index.html"))) {
    console.error("Missing dist/index.html. Run `npm run build` first.");
    process.exitCode = 1;
    return;
  }

  const server = http.createServer((req, res) => {
    const urlPath = (req.url ?? "/").split("?")[0] ?? "/";

    if (urlPath === "/api/leaderboard") {
      if (req.method === "GET") {
        const entries = readLeaderboardFile(dbPath);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ entries }));
        return;
      }
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
          if (body.length > 65536) req.destroy();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body) as Partial<LeaderboardEntry>;
            const current = readLeaderboardFile(dbPath);
            const updated = addLeaderboardEntry(current, {
              name: String(payload.name ?? ""),
              score: Number(payload.score ?? 0),
              nights_won: Number(payload.nights_won ?? 0),
              achieved_at:
                typeof payload.achieved_at === "string" && payload.achieved_at.length > 0
                  ? payload.achieved_at
                  : formatIsoWithTimezone(new Date()),
              seed: Number(payload.seed ?? 1),
            });
            writeLeaderboardFile(dbPath, updated);
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ entries: updated }));
          } catch (err) {
            res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            res.end(
              JSON.stringify({ error: err instanceof Error ? err.message : "Invalid payload" })
            );
          }
        });
        return;
      }
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

  server.listen(Number.isFinite(port) && port > 0 ? port : 0, "127.0.0.1", () => {
    const addr = server.address();
    if (!addr || typeof addr === "string") return;
    const url = `http://127.0.0.1:${addr.port}/`;
    console.log(`Đảo Đèn Lồng đang chạy tại ${url}`);
    console.log(`Dữ liệu bảng xếp hạng cục bộ: ${dbPath}`);
    if (!noOpen) openBrowser(url);
  });
}

main();
