import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function extractSeedHeadlessCommands(filePath) {
  const content = fs.readFileSync(path.resolve(filePath), "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        !line.startsWith("#") &&
        line.includes("dist-cli/cli/headless.js") &&
        line.includes("--seed")
    );
}

function runInNativeShell(cmd, cwd) {
  if (process.platform === "win32") {
    return spawnSync("powershell.exe", ["-NoProfile", "-Command", cmd], {
      cwd,
      encoding: "utf8",
    });
  }
  return spawnSync("sh", ["-c", cmd], { cwd, encoding: "utf8" });
}

test("documented Test Contract v1.0 headless commands in README and verify-phase skill succeed in native shell", () => {
  const repoRoot = path.resolve(".");
  const cliAbs = path.join(repoRoot, "dist-cli", "cli", "headless.js");
  const files = ["README.md", ".agents/skills/verify-phase/SKILL.md"];
  const commands = files.flatMap(extractSeedHeadlessCommands);
  assert.ok(commands.length >= 2, "expected documented parameterized headless commands");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pkg-headless-"));
  try {
    for (const cmd of commands) {
      assert.ok(cmd.includes("--night 1"), `Expected --night 1 in documented command: ${cmd}`);
      assert.ok(cmd.includes("--out "), `Expected --out in documented command: ${cmd}`);
      const portableCmd = cmd.replace("dist-cli/cli/headless.js", `"${cliAbs}"`);
      const res = runInNativeShell(portableCmd, tmpDir);
      assert.equal(
        res.status,
        0,
        `Documented command failed in native shell (${cmd}):\nstdout=${res.stdout}\nstderr=${res.stderr}`
      );
      const outMatch = cmd.match(/--out\s+(\S+)/);
      assert.ok(outMatch, `Could not find --out path in ${cmd}`);
      const outFile = path.resolve(tmpDir, outMatch[1]);
      assert.ok(fs.existsSync(outFile), `Expected JSONL output file at ${outFile}`);
      const lines = fs.readFileSync(outFile, "utf8").trim().split(/\r?\n/);
      assert.equal(JSON.parse(lines[0]).type, "snapshot");
      assert.equal(JSON.parse(lines[lines.length - 1]).type, "end");
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("package.json declares engines matching Vite and uses portable node --test", () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));
  const vitePkg = JSON.parse(
    fs.readFileSync(path.resolve("node_modules/vite/package.json"), "utf8")
  );
  assert.ok(pkg.engines?.node, "package.json must declare engines.node");
  assert.equal(pkg.engines.node, vitePkg.engines?.node);
  assert.equal(pkg.scripts?.test, "npm run build:cli && node --test");

  for (const docPath of ["README.md", "AGENTS.md", "docs/notes/assumptions.md"]) {
    const text = fs.readFileSync(path.resolve(docPath), "utf8");
    assert.equal(
      /Node\.js\s*>=\s*18/.test(text),
      false,
      `${docPath} still claims Node.js >= 18 despite Vite requiring ${vitePkg.engines?.node}`
    );
  }
});
