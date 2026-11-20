import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function extractSeedHeadlessCommands(filePath) {
  const content = fs.readFileSync(path.resolve(filePath), "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => !line.startsWith("#") && line.includes("headless") && line.includes("--seed"));
}

function runInNativeShell(cmd) {
  if (process.platform === "win32") {
    return spawnSync("powershell.exe", ["-NoProfile", "-Command", cmd], { encoding: "utf8" });
  }
  return spawnSync("sh", ["-c", cmd], { encoding: "utf8" });
}

test("documented parameterized headless commands in README and verify-phase skill succeed in native shell", () => {
  const files = ["README.md", ".agents/skills/verify-phase/SKILL.md"];
  const commands = files.flatMap(extractSeedHeadlessCommands);
  assert.ok(commands.length >= 2, "expected documented parameterized headless commands");

  for (const cmd of commands) {
    const res = runInNativeShell(cmd);
    assert.equal(
      res.status,
      0,
      `Documented command failed in native shell (${cmd}):\nstdout=${res.stdout}\nstderr=${res.stderr}`
    );
    const parsed = JSON.parse(res.stdout.trim());
    assert.equal(parsed.ok, true);
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
