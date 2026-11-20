import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function allow() {
  process.stdout.write(JSON.stringify({ decision: "allow" }) + "\n");
}

function resolveRepoRoot(payload) {
  if (
    Array.isArray(payload.workspacePaths) &&
    typeof payload.workspacePaths[0] === "string" &&
    payload.workspacePaths[0].trim().length > 0
  ) {
    return payload.workspacePaths[0];
  }
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptDir, "../..");
}

async function main() {
  const raw = await readStdin();
  let payload;
  try {
    payload = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    allow();
    return;
  }

  if (payload.terminationReason !== "NO_TOOL_CALL") {
    allow();
    return;
  }

  if (typeof payload.executionNum === "number" && payload.executionNum >= 3) {
    allow();
    return;
  }

  const repoRoot = resolveRepoRoot(payload);
  const pkgPath = path.join(repoRoot, "package.json");
  const modulesPath = path.join(repoRoot, "node_modules");
  if (!fs.existsSync(pkgPath) || !fs.existsSync(modulesPath)) {
    allow();
    return;
  }

  const result = spawnSync("npm", ["test"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    shell: process.platform === "win32",
  });

  if (result.status === 0) {
    allow();
    return;
  }

  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  const excerpt = combined.slice(-600);
  process.stdout.write(
    JSON.stringify({
      decision: "continue",
      reason: `Tests failed (npm test). Fix failing tests or document honest failure status before stopping.\n${excerpt}`,
    }) + "\n"
  );
}

main().catch(() => {
  allow();
});
