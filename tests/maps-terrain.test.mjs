import test from "node:test";
import assert from "node:assert/strict";
import {
  getGroundY,
  getNightMapConfig,
  moveHorizontalOnTerrain,
} from "../dist-cli/core/maps.js";

test("Night 1, 2, 3 map configs match Ticket-02 counts and coordinates", () => {
  const n1 = getNightMapConfig(1);
  assert.equal(n1.durationS, 300);
  assert.equal(n1.lanterns.length, 5);
  assert.deepEqual(n1.lanterns[0].pos, [0, 0, 25]);
  assert.deepEqual(n1.lanterns[1].pos, [23.8, 0, 7.7]);
  assert.equal(n1.motePoints.length, 24);
  assert.equal(n1.shadePoints.length, 12);
  assert.equal(n1.shadeMax, 6);
  assert.equal(n1.shadeIntervalTicks, 480);

  const n2 = getNightMapConfig(2);
  assert.equal(n2.durationS, 330);
  assert.equal(n2.lanterns.length, 6);
  assert.deepEqual(n2.lanterns[3].pos, [70, 0, 20]);
  assert.equal(n2.motePoints.length, 24);
  assert.equal(n2.shadePoints.length, 16);
  assert.equal(n2.jumpPads.length, 2);
  assert.equal(n2.charms.length, 1);
  assert.deepEqual(n2.charms[0].pos, [35, 0, 0]);
  assert.equal(n2.shadeMax, 8);
  assert.equal(n2.shadeIntervalTicks, 420);

  const n3 = getNightMapConfig(3);
  assert.equal(n3.durationS, 360);
  assert.equal(n3.lanterns.length, 7);
  assert.deepEqual(n3.lanterns[0].pos, [0, 6, 6]);
  assert.equal(n3.motePoints.length, 30);
  assert.equal(n3.shadePoints.length, 16);
  assert.equal(n3.jumpPads.length, 1);
  assert.equal(n3.charms.length, 2);
  assert.equal(n3.shadeSpeed, 4.5);
  assert.equal(n3.shadeMax, 10);
  assert.equal(n3.shadeIntervalTicks, 360);
  assert.equal(n3.hasWind, true);
});

test("Night 2 ground includes islands A, B, bamboo bridge, and void elsewhere", () => {
  assert.equal(getGroundY(2, 0, 0), 0);
  assert.equal(getGroundY(2, 70, 0), 0);
  assert.equal(getGroundY(2, 35, 0), 0);
  assert.equal(getGroundY(2, 35, 2.5), null);
  assert.equal(getGroundY(2, 0, 29), null);
});

test("Night 3 terrain seals ramp-to-Tier-1 edges, blocks cliff steps, and blocks Bell Tower", () => {
  // Tier 0, 1, 2 heights
  assert.equal(getGroundY(3, 0, -20), 0);
  assert.equal(getGroundY(3, 0, 18), 3);
  assert.equal(getGroundY(3, 0, 5), 6);

  // Ramp along 30 deg at top edge (s=24, lateral offset w=1.5) must not drop to Y=0
  const rad = (30 * Math.PI) / 180;
  const edgeX = 24 * Math.cos(rad) - 1.5 * Math.sin(rad);
  const edgeZ = 24 * Math.sin(rad) + 1.5 * Math.cos(rad);
  const edgeY = getGroundY(3, edgeX, edgeZ);
  assert.ok(edgeY !== null && edgeY >= 2.95, `expected sealed ramp top >= 2.95, got ${edgeY}`);

  // Walking from Tier 0 (y=0) into Tier 1 wall at (0, 24.5) -> (0, 23.5) is blocked
  const cliffRes = moveHorizontalOnTerrain(3, [0, 0, 24.5], 0, -1.0);
  assert.ok(cliffRes.z > 24.0, `expected blocked by Tier 1 cliff, got z=${cliffRes.z}`);

  // Walking into Bell Tower (r <= 2 at center on Tier 2) is pushed outside r=2
  const towerRes = moveHorizontalOnTerrain(3, [2.2, 6, 0], -0.5, 0);
  assert.ok(Math.hypot(towerRes.x, towerRes.z) >= 2.0, "Bell Tower must block horizontal entry");
});
