import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createBenchWorld, stepBenchWorld } from "../dist-cli/core/game.js";
import { computeBenchMetrics } from "../dist-cli/core/benchMetrics.js";
import { computeBenchCameraPos } from "../src/web/visualHelpers.js";

test("createBenchWorld spawns 200 wander shades, 100 motes, L1-L3 lit fuel=100, and stepBenchWorld disables damage/pickup/decay/win", () => {
  const w1 = createBenchWorld(42);
  const w2 = createBenchWorld(42);

  assert.equal(w1.night, 1);
  assert.equal(w1.shades.length, 200);
  assert.equal(w1.motes.length, 100);
  assert.ok(w1.shades.every((s) => s.state === "wander"));
  assert.deepEqual(w1.player.pos, [0, 0, 0]);
  assert.equal(w1.lanterns[0].lit, true);
  assert.equal(w1.lanterns[1].lit, true);
  assert.equal(w1.lanterns[2].lit, true);
  assert.equal(w1.lanterns[3].lit, false);
  assert.equal(w1.lanterns[4].lit, false);
  assert.equal(w1.lanterns[0].fuelSixtieths, 6000);
  assert.equal(w1.lanterns[2].fuelSixtieths, 6000);

  // Deterministic seed 42
  assert.deepEqual(
    w1.shades.map((s) => s.pos),
    w2.shades.map((s) => s.pos)
  );
  assert.deepEqual(
    w1.motes.map((m) => m.pos),
    w2.motes.map((m) => m.pos)
  );

  // Put one shade & one mote right on (0,0,0) to prove damage & pickup are disabled in bench
  w1.motes[0].pos = [0, 0, 0];
  w1.shades[0].pos = [0, 0.8, 0];
  const initialPos0 = [...w1.shades[1].pos];

  for (let i = 0; i < 60; i++) {
    stepBenchWorld(w1);
  }

  assert.equal(w1.shades.length, 200, "bench must not spawn extra shades");
  assert.equal(w1.motes.length, 100, "bench must not pick up or spawn motes");
  assert.equal(w1.player.flames, 3, "bench must disable player damage");
  assert.equal(w1.player.carried, 0, "bench must disable mote pickup");
  assert.equal(w1.lanterns[0].fuelSixtieths, 6000, "bench must disable fuel decay");
  assert.equal(w1.state, "playing", "bench must never end night");
  assert.notDeepEqual(w1.shades[1].pos, initialPos0, "bench shades must continue wandering");
});

test("computeBenchMetrics computes exact avg_fps, p1_low_fps, and frame_ms_p95", () => {
  // 100 frames: 99 at 10ms, 1 spike at 50ms -> total = 1040ms
  const dts = Array.from({ length: 99 }, () => 10);
  dts.push(50);
  const report = computeBenchMetrics({
    dtListMs: dts,
    loadMs: 1234.4,
    peakMemMb: null,
    vsyncOff: true,
    renderer: "Three.js WebGLRenderer test",
    osName: "win32",
  });

  assert.equal(report.contract_version, "1.3");
  assert.equal(report.frames, 100);
  // avg_fps = 1000 * 100 / 1040 = 96.1538 -> 96.2
  assert.equal(report.avg_fps, 96.2);
  // k = max(1, ceil(0.01 * 100)) = 1 -> p1_low_fps = 1000 / 50 = 20.0
  assert.equal(report.p1_low_fps, 20);
  // 95th percentile of 99x10 + 1x50 -> 10
  assert.equal(report.frame_ms_p95, 10);
  assert.equal(report.load_ms, 1234);
  assert.equal(report.peak_mem_mb, null);
  assert.equal(report.vsync_off, true);
});

test("soak CLI runs multi-night headless soak test deterministically with zero crashes", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "soak-test-"));
  const outPath = path.join(tmpDir, "soak.json");
  try {
    const res = spawnSync(
      process.execPath,
      ["dist-cli/cli/soak.js", "--seed", "7", "--nights", "3", "--out", outPath],
      { encoding: "utf8" }
    );
    assert.equal(res.status, 0, res.stderr);
    const data = JSON.parse(fs.readFileSync(outPath, "utf8"));
    assert.equal(data.nights, 3);
    assert.equal(data.crashes, 0);
    assert.equal(data.results.length, 3);
    for (const r of data.results) {
      assert.ok(r === "won" || r === "lost");
    }
    assert.ok(data.mem_start_mb > 0);
    assert.ok(data.mem_end_mb > 0);
    assert.ok(data.duration_s >= 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("computeBenchCameraPos orbits (0,0,0) at R=30, Y=15 CCW every 15s and bench CLI validates args", () => {
  const p0 = computeBenchCameraPos(0);
  assert.ok(Math.abs(p0[0] - 30) < 1e-6 && p0[1] === 15 && Math.abs(p0[2]) < 1e-6);

  const pQuarter = computeBenchCameraPos(3.75);
  assert.ok(Math.abs(pQuarter[0]) < 1e-6 && pQuarter[1] === 15 && Math.abs(pQuarter[2] + 30) < 1e-6);

  const pFull = computeBenchCameraPos(15);
  assert.ok(Math.abs(pFull[0] - 30) < 1e-6 && pFull[1] === 15 && Math.abs(pFull[2]) < 1e-6);

  const badRes = spawnSync(process.execPath, ["dist-cli/cli/bench.js", "--seed", "42"], {
    encoding: "utf8",
  });
  assert.notEqual(badRes.status, 0);
});
