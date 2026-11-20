import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialLanternState,
  stepLanternState,
  runLanternSimulation,
} from "../dist-cli/core/helloLantern.js";

test("runLanternSimulation is deterministic for identical inputs", () => {
  const first = runLanternSimulation(42, 20, 0.05);
  const second = runLanternSimulation(42, 20, 0.05);
  assert.deepEqual(first, second);
  assert.equal(first.seed, 42);
  assert.equal(first.tick, 20);
  assert.ok(Math.abs(first.elapsedSec - 1.0) < 1e-9);
});

test("createInitialLanternState varies initial orientation deterministically by seed", () => {
  const s1a = createInitialLanternState(1);
  const s1b = createInitialLanternState(1);
  const s2 = createInitialLanternState(2);
  assert.deepEqual(s1a, s1b);
  assert.notEqual(s1a.yawRad, s2.yawRad);
});

test("stepLanternState advances tick, yaw, and keeps bounded bobbing & glow", () => {
  const s0 = createInitialLanternState(7);
  const s1 = stepLanternState(s0, 0.1);
  assert.equal(s1.tick, 1);
  assert.ok(s1.elapsedSec > s0.elapsedSec);
  assert.notEqual(s1.yawRad, s0.yawRad);
  assert.ok(s1.glowIntensity >= 0.5 && s1.glowIntensity <= 1.5);
  assert.ok(s1.position.y >= 0.9 && s1.position.y <= 1.5);
});

test("runLanternSimulation rejects invalid ticks or dtSec", () => {
  assert.throws(() => runLanternSimulation(1, -1, 0.05));
  assert.throws(() => runLanternSimulation(1, 1.5, 0.05));
  assert.throws(() => runLanternSimulation(1, 5, 0));
  assert.throws(() => runLanternSimulation(1, 5, Number.NaN));
});
