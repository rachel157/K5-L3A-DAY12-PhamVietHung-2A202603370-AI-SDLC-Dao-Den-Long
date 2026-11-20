import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const runCli = (args) =>
  spawnSync(process.execPath, ["dist-cli/cli/headless.js", ...args], { encoding: "utf8" });

test("headless CLI runs with default arguments and returns deterministic JSON", () => {
  const r1 = runCli([]);
  const r2 = runCli([]);
  assert.equal(r1.status, 0, r1.stderr);
  assert.equal(r1.stdout, r2.stdout);
  const parsed = JSON.parse(r1.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.mode, "hello-cp0");
  assert.equal(parsed.seed, 1);
  assert.equal(parsed.ticks, 10);
  assert.equal(parsed.dtSec, 0.05);
  assert.equal(parsed.finalState.tick, 10);
});

test("headless CLI honors explicit --seed, --ticks, and --dt deterministically", () => {
  const r1 = runCli(["--seed", "42", "--ticks", "20", "--dt", "0.05"]);
  const r2 = runCli(["--seed", "42", "--ticks", "20", "--dt", "0.05"]);
  assert.equal(r1.status, 0, r1.stderr);
  assert.equal(r1.stdout, r2.stdout);
  const parsed = JSON.parse(r1.stdout);
  assert.equal(parsed.seed, 42);
  assert.equal(parsed.ticks, 20);
  assert.equal(parsed.finalState.tick, 20);
});

test("headless CLI rejects negative ticks, non-numeric seed, and missing arg values", () => {
  const resNeg = runCli(["--ticks", "-5"]);
  assert.notEqual(resNeg.status, 0);
  assert.ok(resNeg.stderr.length > 0);

  const resBadSeed = runCli(["--seed", "abc"]);
  assert.notEqual(resBadSeed.status, 0);
  assert.ok(resBadSeed.stderr.length > 0);

  const resMissing = runCli(["--seed"]);
  assert.notEqual(resMissing.status, 0);
  assert.ok(resMissing.stderr.length > 0);
});
