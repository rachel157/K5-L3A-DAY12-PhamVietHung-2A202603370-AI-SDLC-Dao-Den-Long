import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_TUNING,
  createDefaultLanterns,
} from "../dist-cli/core/contract.js";

test("game.contract.json matches Test Contract v1.0 schema and DEFAULT_TUNING 1:1", () => {
  const contract = JSON.parse(fs.readFileSync(path.resolve("game.contract.json"), "utf8"));
  assert.equal(contract.contract_version, "1.0");
  assert.equal(contract.headless_cmd, "node dist-cli/cli/headless.js");
  assert.equal(contract.tuning.lantern_count_night1, 5);
  assert.equal(contract.tuning.fall_enabled, false);
  assert.deepEqual(contract.tuning, DEFAULT_TUNING);
});

test("createDefaultLanterns produces 5 unlit lanterns L1..L5 with L1 at [0, 0, 25]", () => {
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
