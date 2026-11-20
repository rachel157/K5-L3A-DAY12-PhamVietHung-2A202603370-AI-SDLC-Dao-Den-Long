import test from "node:test";
import assert from "node:assert/strict";
import { runHeadlessSimulation } from "../dist-cli/core/game.js";

test("dash moves 14 m/s for 12 ticks, preserves height on air, and enforces 90-tick cooldown from start", () => {
  const lines = runHeadlessSimulation({
    seed: 1,
    night: 1,
    scenario: { random_motes: false, random_shades: false },
    frames: [
      { tick: 0, move: [0, 1], jump: true },
      { tick: 10, dash: true },
      { tick: 11, dash: false },
      { tick: 50, dash: true }, // inside 90-tick cooldown -> ignored
      { tick: 51, dash: false },
      { tick: 100, dash: true }, // tick 10 + 90 = 100 -> allowed
    ],
    maxTicks: 115,
    snapshotEvery: 1,
  });

  const dashes = lines.filter((l) => l.type === "event" && l.name === "dash");
  assert.equal(dashes.length, 2);
  assert.equal(dashes[0].tick, 11);
  assert.equal(dashes[1].tick, 101);

  const snap10 = lines.find((l) => l.type === "snapshot" && l.tick === 10);
  const snap22 = lines.find((l) => l.type === "snapshot" && l.tick === 22);
  assert.equal(snap22.player.pos[1], snap10.player.pos[1], "air dash must hold Y height constant");
  assert.ok(Math.abs(snap22.player.pos[2] - snap10.player.pos[2] - 2.8) < 0.05);
});

test("Wind Charm (C1) grants 7.2 m/s speed and zero dash cooldown for 600 ticks, respawns in 2700 ticks", () => {
  const lines = runHeadlessSimulation({
    seed: 1,
    night: 2,
    scenario: {
      player: { pos: [34.5, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
    },
    frames: [
      { tick: 0, move: [0, 0] }, // picks up C1 at (35,0,0)
      { tick: 1, move: [0, 1], dash: true },
      { tick: 2, dash: false },
      { tick: 13, dash: true }, // right after 12-tick dash ends -> allowed immediately with charm!
      { tick: 14, dash: false, move: [1, 0] }, // finishes dash #2 at tick 25, runs +X at 7.2 m/s from tick 26
    ],
    maxTicks: 90,
    snapshotEvery: 1,
  });

  const picked = lines.find((l) => l.type === "event" && l.name === "charm_picked");
  assert.deepEqual(picked?.data, { charm_id: "C1", charm_ticks: 600 });

  const dashes = lines.filter((l) => l.type === "event" && l.name === "dash");
  assert.equal(dashes.length, 2);
  assert.equal(dashes[0].tick, 2);
  assert.equal(dashes[1].tick, 14);

  const snap85 = lines.find((l) => l.type === "snapshot" && l.tick === 85);
  const snap25 = lines.find((l) => l.type === "snapshot" && l.tick === 25);
  assert.ok(Math.abs(snap85.player.pos[0] - snap25.player.pos[0] - 7.2) < 0.05);

  // Verify respawn exactly 2700 ticks after pickup (move away after pickup so Mây doesn't immediately re-pick it on tick 2701)
  const longLines = runHeadlessSimulation({
    seed: 1,
    night: 2,
    scenario: {
      player: { pos: [35, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
    },
    frames: [
      { tick: 1, move: [0, 1] },
      { tick: 30, move: [0, 0] },
    ],
    maxTicks: 2705,
    snapshotEvery: 1,
  });
  const snap2700 = longLines.find((l) => l.type === "snapshot" && l.tick === 2700);
  const snap2701 = longLines.find((l) => l.type === "snapshot" && l.tick === 2701);
  assert.equal(snap2700.charms[0].available, false);
  assert.equal(snap2701.charms[0].available, true);
});

test("falling below Y < -10 bypasses invuln, loses carried motes, waits 60 ticks then respawns with 90 tick invuln", () => {
  const lines = runHeadlessSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [41, -9.8, 0], carried: 4, flames: 2, invuln_ticks: 50 },
      random_motes: false,
      random_shades: false,
    },
    maxTicks: 100,
    snapshotEvery: 1,
  });

  const fallHit = lines.find((l) => l.type === "event" && l.name === "player_hit");
  assert.equal(fallHit?.data.by, "fall");
  assert.equal(fallHit?.data.flames, 1);
  assert.equal(fallHit?.data.lost, 4);

  const respawnSnap = lines.find((l) => l.type === "snapshot" && l.tick === fallHit.tick + 60);
  assert.deepEqual(respawnSnap.player.pos, [0, 0, 0]);
  assert.deepEqual(respawnSnap.player.vel, [0, 0, 0]);
  assert.equal(respawnSnap.player.invuln, true);
});

test("Night 2 jump pad launches Mây across void to Island B even if dashing mid-air", () => {
  const lines = runHeadlessSimulation({
    seed: 1,
    night: 2,
    scenario: {
      player: { pos: [20, 0, 18], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
    },
    frames: [
      { tick: 10, dash: true, move: [0, 0] },
      { tick: 11, dash: false },
    ],
    maxTicks: 120,
    snapshotEvery: 1,
  });

  assert.equal(lines.some((l) => l.type === "event" && l.name === "player_hit"), false);
  const snapEnd = lines.find((l) => l.type === "snapshot" && l.tick === 120);
  assert.ok(
    Math.hypot(snapEnd.player.pos[0] - 70, snapEnd.player.pos[2]) <= 28,
    `expected landing on Island B, got ${snapEnd.player.pos}`
  );
  assert.equal(snapEnd.player.grounded, true);
});

test("Night 3 strong wind pushes player during gusts and jump pad reaches Tier 2", () => {
  const lines = runHeadlessSimulation({
    seed: 4,
    night: 3,
    scenario: {
      player: { pos: [0, 3, 13], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
    },
    maxTicks: 80,
    snapshotEvery: 1,
  });
  const snap80 = lines.find((l) => l.type === "snapshot" && l.tick === 80);
  assert.equal(snap80.player.pos[1], 6, "Night 3 jump pad must land player onto Tier 2 (Y=6)");

  // Wind schedule: active at tick 1800..2099
  const windLines = runHeadlessSimulation({
    seed: 4,
    night: 3,
    scenario: {
      player: { pos: [0, 0, -20], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
    },
    maxTicks: 1860,
    snapshotEvery: 10,
  });
  const preWind = windLines.find((l) => l.type === "snapshot" && l.tick === 1790);
  const midWind = windLines.find((l) => l.type === "snapshot" && l.tick === 1850);
  assert.equal(preWind.wind.active, false);
  assert.equal(midWind.wind.active, true);
  assert.ok(
    Math.hypot(midWind.player.pos[0] - preWind.player.pos[0], midWind.player.pos[2] - preWind.player.pos[2]) > 1.5,
    "active Night 3 wind should displace stationary player"
  );
});

test("lit lantern pushes inside shades out to >= 6m within 30 ticks without damage, and chase/wander hysteresis works", () => {
  const lines = runHeadlessSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 25], carried: 10, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: "L1", pos: [0, 0, 25], deposited: 9 }],
      shades: [{ id: "S1", pos: [0, 0.8, 26], state: "chase" }],
    },
    frames: [{ tick: 0, interact: true }],
    maxTicks: 32,
    snapshotEvery: 1,
  });

  // Shade was at 1m when lantern lit -> pushed out to >= 6m within 30 ticks, zero damage
  assert.equal(lines.some((l) => l.type === "event" && l.name === "player_hit"), false);
  const snap31 = lines.find((l) => l.type === "snapshot" && l.tick === 31);
  const dist = Math.hypot(snap31.shades[0].pos[0], snap31.shades[0].pos[2] - 25);
  assert.ok(dist >= 5.99, `expected shade pushed out to >= 6m, got ${dist}`);
});

test("Drifters (Gió Lạc) steal motes, flee -> removed, and drop stolen motes when pulsed", () => {
  // Steal -> flee -> removed
  const stealLines = runHeadlessSimulation({
    seed: 1,
    night: 2,
    scenario: {
      player: { pos: [0, 0, 0], carried: 6, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      drifters: [{ id: "D1", pos: [0, 1.6, 2], state: "idle" }],
    },
    maxTicks: 270,
    snapshotEvery: 1,
  });

  const stealEv = stealLines.find((l) => l.type === "event" && l.name === "drifter_steal");
  assert.deepEqual(stealEv?.data, { drifter_id: "D1", amount: 3, carried: 3 });

  const endSnap = stealLines.find((l) => l.type === "snapshot" && l.tick === 270);
  assert.equal(endSnap.drifters[0].state, "removed");

  // Pulse during flee drops stolen motes and removes after 120 ticks
  const dropLines = runHeadlessSimulation({
    seed: 1,
    night: 2,
    scenario: {
      player: { pos: [0, 0, 0], carried: 3, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      drifters: [{ id: "D1", pos: [0, 1.6, 2], state: "flee", stolen: 3, state_ticks_left: 200 }],
    },
    frames: [{ tick: 0, pulse: true }],
    maxTicks: 125,
    snapshotEvery: 1,
  });
  const dropEv = dropLines.find((l) => l.type === "event" && l.name === "drifter_drop");
  assert.deepEqual(dropEv?.data, { drifter_id: "D1", amount: 3 });
  const snap1 = dropLines.find((l) => l.type === "snapshot" && l.tick === 1);
  assert.equal(snap1.motes.filter((m) => m.kind === "dropped").length, 3);
  const snap122 = dropLines.find((l) => l.type === "snapshot" && l.tick === 122);
  assert.equal(snap122.drifters[0].state, "removed");
});

test("pause freezes sim_tick, time_left_s, cooldowns, and TTL while incrementing tick", () => {
  const lines = runHeadlessSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 3, dash_cd_ticks: 60 },
      random_motes: false,
      random_shades: false,
      motes: [{ id: "M1", pos: [5, 0, 5], kind: "dropped", ttl_ticks: 120 }],
    },
    frames: [
      { tick: 0, pause: true },
      { tick: 1, pause: false },
      { tick: 20, pause: true },
      { tick: 21, pause: false },
    ],
    maxTicks: 25,
    snapshotEvery: 1,
  });

  const snap5 = lines.find((l) => l.type === "snapshot" && l.tick === 5);
  assert.equal(snap5.state, "paused");
  assert.equal(snap5.sim_tick, 0);
  assert.equal(snap5.time_left_s, 300);
  assert.equal(snap5.player.dash_cd_s, 1);
  assert.equal(snap5.motes[0].ttl_s, 2);

  // Ending while paused reports end.state === "paused"
  const endPaused = runHeadlessSimulation({
    seed: 1,
    night: 1,
    scenario: { random_motes: false, random_shades: false },
    frames: [{ tick: 0, pause: true }],
    maxTicks: 5,
    snapshotEvery: 5,
  });
  assert.deepEqual(endPaused[endPaused.length - 1], { type: "end", ticks: 5, state: "paused", score: 0 });
});

test("full 21,600-tick Night 3 headless run completes well under 30 seconds", () => {
  const startMs = performance.now();
  const lines = runHeadlessSimulation({
    seed: 7,
    night: 3,
    maxTicks: 21600,
    snapshotEvery: 60,
  });
  const elapsedMs = performance.now() - startMs;
  assert.ok(elapsedMs < 30000, `21,600-tick run took ${elapsedMs}ms (>= 30s limit)`);
  assert.equal(lines[lines.length - 1].type, "end");
});
