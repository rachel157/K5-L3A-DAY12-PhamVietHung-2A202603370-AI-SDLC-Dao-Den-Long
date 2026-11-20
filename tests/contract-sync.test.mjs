import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_TUNING,
  createDefaultLanterns,
  getDynamicCapacity,
  round1,
} from "../dist-cli/core/contract.js";

test("game.contract.json matches Test Contract v1.3 schema and DEFAULT_TUNING 1:1", () => {
  const contract = JSON.parse(fs.readFileSync(path.resolve("game.contract.json"), "utf8"));
  assert.equal(contract.contract_version, "1.3");
  assert.equal(contract.run_cmd, "node dist-cli/cli/run.js");
  assert.equal(contract.headless_cmd, "node dist-cli/cli/headless.js");
  assert.equal(contract.bench_cmd, "node dist-cli/cli/bench.js");
  assert.equal(contract.soak_cmd, "node dist-cli/cli/soak.js");
  assert.equal(contract.tuning.lantern_count_night1, 5);
  assert.equal(contract.tuning.fall_enabled, true);
  assert.equal(contract.tuning.dash_speed, 14);
  assert.equal(contract.tuning.night1_duration_s, 240);
  assert.equal(contract.tuning.night2_duration_s, 270);
  assert.equal(contract.tuning.night3_duration_s, 300);
  assert.equal(contract.tuning.fuel_max, 100);
  assert.equal(contract.tuning.fuel_decay_per_s, 1);
  assert.equal(contract.tuning.fuel_per_mote, 10);
  assert.equal(contract.tuning.relight_cost, 5);
  assert.equal(contract.tuning.win_ratio, 0.6);
  assert.equal(contract.tuning.drain_per_s, 5);
  assert.equal(contract.tuning.low_fuel_threshold, 30);
  assert.equal(contract.tuning.capacity_max, 20);
  assert.equal(contract.tuning.score.per_mote, 5);
  assert.equal(contract.tuning.score.per_relight, 40);
  assert.equal(contract.tuning.score.per_stun_drain, 15);
  assert.equal(contract.tuning.score.per_lantern_dawn, 50);
  assert.deepEqual(contract.tuning, DEFAULT_TUNING);
});

test("createDefaultLanterns initializes fuelSixtieths, everLit, relitCount and v1.2 helpers work", () => {
  const lanterns = createDefaultLanterns();
  assert.equal(lanterns.length, 5);
  assert.deepEqual(
    lanterns.map((l) => l.id),
    ["L1", "L2", "L3", "L4", "L5"]
  );
  assert.deepEqual(lanterns[0].pos, [0, 0, 25]);
  for (const lantern of lanterns) {
    assert.equal(lantern.lit, false);
    assert.equal(lantern.deposited, 0);
    assert.equal(lantern.fuelSixtieths, 0);
    assert.equal(lantern.everLit, false);
    assert.equal(lantern.relitCount, 0);
  }

  assert.equal(round1(29.96), 30);
  assert.equal(Object.is(round1(-0.001), -0), false);
  assert.equal(getDynamicCapacity(10, 0, 20), 10);
  assert.equal(getDynamicCapacity(10, 3, 20), 16);
  assert.equal(getDynamicCapacity(10, 8, 20), 20);
});
