import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const runHook = (payloadObjOrRaw) => {
  const input =
    typeof payloadObjOrRaw === "string" ? payloadObjOrRaw : JSON.stringify(payloadObjOrRaw);
  return spawnSync(process.execPath, ["./scripts/stop-test-gate.mjs"], {
    cwd: path.resolve(".agents"),
    input,
    encoding: "utf8",
  });
};

test("allows non-NO_TOOL_CALL termination and executionNum >= 3", () => {
  const r1 = runHook({ terminationReason: "USER_CANCELED", executionNum: 1 });
  assert.equal(r1.status, 0, r1.stderr);
  assert.equal(JSON.parse(r1.stdout).decision, "allow");

  const r2 = runHook({ terminationReason: "NO_TOOL_CALL", executionNum: 3 });
  assert.equal(r2.status, 0, r2.stderr);
  assert.equal(JSON.parse(r2.stdout).decision, "allow");
});

test("handles malformed stdin gracefully", () => {
  const res = runHook("{bad json");
  assert.equal(res.status, 0, res.stderr);
  assert.equal(JSON.parse(res.stdout).decision, "allow");
});

test("blocks stop with valid JSON when tests fail and allows when tests pass", () => {
  const tmpFail = fs.mkdtempSync(path.join(os.tmpdir(), "hook-fail-"));
  const tmpPass = fs.mkdtempSync(path.join(os.tmpdir(), "hook-pass-"));
  fs.mkdirSync(path.join(tmpFail, "node_modules"));
  fs.mkdirSync(path.join(tmpPass, "node_modules"));
  fs.writeFileSync(
    path.join(tmpFail, "package.json"),
    JSON.stringify({
      name: "tmp-fail",
      scripts: { test: "node -e \"console.log('noisy'); process.exit(1)\"" },
    })
  );
  fs.writeFileSync(
    path.join(tmpPass, "package.json"),
    JSON.stringify({
      name: "tmp-pass",
      scripts: { test: "node -e \"console.log('ok')\"" },
    })
  );

  try {
    const resFail = runHook({
      terminationReason: "NO_TOOL_CALL",
      executionNum: 1,
      workspacePaths: [tmpFail],
    });
    assert.equal(resFail.status, 0, resFail.stderr);
    const parsedFail = JSON.parse(resFail.stdout);
    assert.equal(parsedFail.decision, "continue");
    assert.ok(parsedFail.reason.length > 0);

    const resPass = runHook({
      terminationReason: "NO_TOOL_CALL",
      executionNum: 1,
      workspacePaths: [tmpPass],
    });
    assert.equal(resPass.status, 0, resPass.stderr);
    assert.equal(JSON.parse(resPass.stdout).decision, "allow");
  } finally {
    fs.rmSync(tmpFail, { recursive: true, force: true });
    fs.rmSync(tmpPass, { recursive: true, force: true });
  }
});
