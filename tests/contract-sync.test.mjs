import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_TUNING,
  createDefaultLanterns,
} from "../dist-cli/core/contract.js";

test("game.contract.json matches Test Contract v1.1 schema and DEFAULT_TUNING 1:1", () => {
  const contract = JSON.parse(fs.readFileSync(path.resolve("game.contract.json"), "utf8"));
  assert.equal(contract.contract_version, "1.1");
  assert.equal(contract.headless_cmd, "node dist-cli/cli/headless.js");
  assert.equal(contract.tuning.lantern_count_night1, 5);
  assert.equal(contract.tuning.fall_enabled, true);
  assert.equal(contract.tuning.dash_speed, 14);
  assert.equal(contract.tuning.night2_duration_s, 330);
  assert.equal(contract.tuning.night3_duration_s, 360);
  assert.deepEqual(contract.tuning, DEFAULT_TUNING);
});

test("createDefaultLanterns produces 5 unlit Night 1 lanterns L1..L5 with L1 at [0, 0, 25]", () => {
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
  }
});
