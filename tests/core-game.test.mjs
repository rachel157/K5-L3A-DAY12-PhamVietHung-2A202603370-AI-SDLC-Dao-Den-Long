import test from "node:test";
import assert from "node:assert/strict";
import {
  createGameWorld,
  runHeadlessSimulation,
  toSnapshot,
} from "../dist-cli/core/game.js";

test("default Night 1 initialization spawns 5 lanterns, 20 motes, 3 shades, and tick 0 snapshot", () => {
  const lines = runHeadlessSimulation({ seed: 7, maxTicks: 0 });
  assert.equal(lines.length, 2);
  const snap0 = lines[0];
  const end = lines[1];
  assert.equal(snap0.type, "snapshot");
  assert.equal(snap0.tick, 0);
  assert.equal(snap0.sim_tick, 0);
  assert.equal(snap0.state, "playing");
  assert.equal(snap0.time_left_s, 300);
  assert.equal(snap0.score, 0);
  assert.deepEqual(snap0.player, { pos: [0, 0, 0], flames: 3, carried: 0 });
  assert.equal(snap0.lanterns.length, 5);
  assert.deepEqual(snap0.lanterns[0], { id: "L1", pos: [0, 0, 25], lit: false, deposited: 0 });
  assert.equal(snap0.motes_active, 20);
  assert.equal(snap0.motes.length, 20);
  assert.equal(snap0.shades.length, 3);
  assert.deepEqual(end, { type: "end", ticks: 0, state: "playing", score: 0 });
});

test("movement matches player_speed, cam_yaw_deg rotation, vector normalization, and jump Y arc", () => {
  // Move +Z for 120 ticks (2s) at yaw=0 -> z = 6 * 2 = 12.0
  const linesZ = runHeadlessSimulation({
    seed: 1,
    scenario: { random_motes: false, random_shades: false },
    frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 0, jump: true }],
    maxTicks: 120,
    snapshotEvery: 120,
  });
  const snapZ = linesZ.find((l) => l.type === "snapshot" && l.tick === 120);
  assert.deepEqual(snapZ.player.pos, [0, 0, 12]);

  // Check mid-air Y > 0 shortly after jump at tick 10
  const linesJump = runHeadlessSimulation({
    seed: 1,
    scenario: { random_motes: false, random_shades: false },
    frames: [{ tick: 0, move: [1, 1], cam_yaw_deg: 90, jump: true }],
    maxTicks: 10,
    snapshotEvery: 10,
  });
  const snap10 = linesJump.find((l) => l.type === "snapshot" && l.tick === 10);
  assert.ok(snap10.player.pos[1] > 0, "player should be airborne after jump");
  // Normalized diagonal [1,1] has speed 6m/s -> total XZ distance after 10/60s = 1.0m
  const xzDist = Math.hypot(snap10.player.pos[0], snap10.player.pos[2]);
  assert.ok(Math.abs(xzDist - 1.0) < 0.01, `expected normalized distance ~1.0, got ${xzDist}`);

  // cam_yaw_deg=90 with move=[0,1] moves along +X
  const linesX = runHeadlessSimulation({
    seed: 1,
    scenario: { random_motes: false, random_shades: false },
    frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }],
    maxTicks: 60,
    snapshotEvery: 60,
  });
  const snapX = linesX.find((l) => l.type === "snapshot" && l.tick === 60);
  assert.deepEqual(snapX.player.pos, [6, 0, 0]);
});

test("zero-order hold persists absent fields and edge-triggers interact only on false -> true", () => {
  const lines = runHeadlessSimulation({
    seed: 1,
    scenario: {
      player: { pos: [0, 0, 25], carried: 5, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: "L1", pos: [0, 0, 24], deposited: 1 },
        { id: "L2", pos: [0, 0, 26], deposited: 0 },
      ],
    },
    frames: [
      { tick: 0, interact: true },
      // tick 1 omits interact -> zero-order hold keeps true, so L2 must NOT receive a deposit on tick 2
      { tick: 2, interact: false },
      { tick: 3, interact: true },
    ],
    maxTicks: 5,
    snapshotEvery: 10,
  });
  const deposits = lines.filter((l) => l.type === "event" && l.name === "deposit");
  assert.equal(deposits.length, 2);
  assert.equal(deposits[0].tick, 1);
  assert.deepEqual(deposits[0].data, { lantern_id: "L1", amount: 2, deposited: 3 });
  assert.equal(deposits[1].tick, 4);
  assert.deepEqual(deposits[1].data, { lantern_id: "L2", amount: 3, deposited: 3 });
  const litEvents = lines.filter((l) => l.type === "event" && l.name === "lantern_lit");
  assert.equal(litEvents.length, 2);
});

test("scenario patches lanterns by id without emitting events or score and suppresses random spawns", () => {
  const world = createGameWorld({
    seed: 9,
    scenario: {
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: "L1", lit: true },
        { id: "L2", pos: [0, 0, 10], deposited: 2 },
      ],
      motes: [],
      shades: [],
    },
  });
  const snap0 = toSnapshot(world);
  assert.equal(snap0.score, 0);
  assert.equal(snap0.lanterns.length, 5);
  assert.equal(snap0.lanterns[0].lit, true);
  assert.equal(snap0.lanterns[0].deposited, 3);
  assert.deepEqual(snap0.lanterns[1].pos, [0, 0, 10]);
  assert.equal(snap0.lanterns[1].deposited, 2);
  assert.equal(snap0.motes_active, 0);
  assert.equal(snap0.shades.length, 0);

  const lines = runHeadlessSimulation({
    seed: 9,
    scenario: {
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [],
    },
    maxTicks: 1800,
    snapshotEvery: 1800,
  });
  const finalSnap = lines.find((l) => l.type === "snapshot" && l.tick === 1800);
  assert.equal(finalSnap.motes_active, 0);
  assert.equal(finalSnap.shades.length, 0);
});

test("mote pickup respects carry_capacity and winning lights all 5 lanterns with time & flame bonus before dawn", () => {
  const lines = runHeadlessSimulation({
    seed: 2,
    scenario: {
      player: { pos: [0, 0, 0], carried: 4, flames: 2 },
      random_motes: false,
      random_shades: false,
      motes: [
        [0, 0, 1],
        [0, 0, 1.2],
      ],
      lanterns: [
        { id: "L1", lit: true },
        { id: "L2", lit: true },
        { id: "L3", lit: true },
        { id: "L4", lit: true },
        { id: "L5", pos: [0, 0, 2], deposited: 0 },
      ],
      time_left_s: 1 / 60,
    },
    frames: [{ tick: 0, interact: true }],
    maxTicks: 10,
    snapshotEvery: 1,
  });

  const picked = lines.filter((l) => l.type === "event" && l.name === "mote_picked");
  assert.equal(picked.length, 1, "carry_capacity=5 should only allow picking 1 mote");
  assert.equal(picked[0].data.carried, 5);

  const gameOver = lines.find((l) => l.type === "event" && l.name === "game_over");
  assert.deepEqual(gameOver, {
    type: "event",
    tick: 1,
    name: "game_over",
    data: { result: "won", reason: "all_lit" },
  });

  const end = lines[lines.length - 1];
  // score = 10 (mote) + 200 (lantern) + 0 * 2 (0s left) + 2 * 100 (flames) = 410
  assert.deepEqual(end, { type: "end", ticks: 1, state: "won", score: 410 });
});

test("pulse stuns shades for exact 180 ticks (3.0s), pushes 4m, enforces 120 tick cooldown", () => {
  const lines = runHeadlessSimulation({
    seed: 3,
    scenario: {
      player: { pos: [0, 0, 0], carried: 2, flames: 3 },
      random_motes: false,
      random_shades: false,
      shades: [{ id: "S1", pos: [0, 0, 3] }],
    },
    frames: [
      { tick: 0, pulse: true },
      { tick: 1, pulse: false },
      { tick: 60, pulse: true }, // during 2.0s (120 ticks) cooldown -> ignored
      { tick: 61, pulse: false },
    ],
    maxTicks: 185,
    snapshotEvery: 1,
  });

  const pulses = lines.filter((l) => l.type === "event" && l.name === "pulse");
  assert.equal(pulses.length, 1);
  assert.deepEqual(pulses[0], {
    type: "event",
    tick: 1,
    name: "pulse",
    data: { stunned_ids: ["S1"] },
  });

  const snap1 = lines.find((l) => l.type === "snapshot" && l.tick === 1);
  assert.equal(snap1.shades[0].state, "stunned");
  assert.equal(snap1.shades[0].pos[2], 7); // 3m + 4m push
  assert.equal(snap1.score, 50);

  const snap180 = lines.find((l) => l.type === "snapshot" && l.tick === 180);
  const snap181 = lines.find((l) => l.type === "snapshot" && l.tick === 181);
  assert.equal(snap180.shades[0].state, "stunned");
  assert.equal(snap181.shades[0].state, "chase", "3.0s stun must expire cleanly on tick 181");
});

test("lit lanterns repel chase and stunned shades outside safe_radius (4.5m) while unlit lanterns do not", () => {
  const lines = runHeadlessSimulation({
    seed: 4,
    scenario: {
      player: { pos: [0, 0, 25], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: "L1", pos: [0, 0, 25], lit: true },
        { id: "L2", pos: [20, 0, 0], lit: false },
      ],
      shades: [
        { id: "S1", pos: [0, 0, 27], state: "chase" },
        { id: "S2", pos: [0, 0, 26], state: "stunned" },
      ],
    },
    maxTicks: 5,
    snapshotEvery: 1,
  });
  const snap1 = lines.find((l) => l.type === "snapshot" && l.tick === 1);
  const distChase = Math.hypot(snap1.shades[0].pos[0] - 0, snap1.shades[0].pos[2] - 25);
  const distStunned = Math.hypot(snap1.shades[1].pos[0] - 0, snap1.shades[1].pos[2] - 25);
  assert.ok(distChase >= 4.499, `chase shade inside lit safe_radius: ${distChase}`);
  assert.ok(distStunned >= 4.499, `stunned shade inside lit safe_radius: ${distStunned}`);
  assert.equal(lines.some((l) => l.type === "event" && l.name === "player_hit"), false);

  // Unlit lantern at [20, 0, 0] does NOT repel shade
  const unlitLines = runHeadlessSimulation({
    seed: 4,
    scenario: {
      player: { pos: [20, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: "L2", pos: [20, 0, 0], lit: false }],
      shades: [{ id: "S1", pos: [20, 0, 2] }],
    },
    maxTicks: 60,
    snapshotEvery: 10,
  });
  assert.equal(unlitLines.some((l) => l.type === "event" && l.name === "player_hit"), true);
});

test("scenario auto-allocated shade and mote IDs never collide with later explicit IDs", () => {
  const world = createGameWorld({
    seed: 1,
    scenario: {
      random_motes: false,
      random_shades: false,
      motes: [{ pos: [1, 0, 0] }, { id: "M1", pos: [2, 0, 0] }],
      shades: [{ pos: [10, 0, 0] }, { id: "S1", pos: [20, 0, 0] }],
    },
  });
  const snap = toSnapshot(world);
  assert.equal(new Set(snap.motes.map((m) => m.id)).size, 2);
  assert.equal(new Set(snap.shades.map((s) => s.id)).size, 2);
});

test("shade hit drops floor(carried * hit_drop_ratio), triggers invuln_s, and loses at 0 flames", () => {
  const lines = runHeadlessSimulation({
    seed: 5,
    scenario: {
      player: { pos: [0, 0, 0], carried: 3, flames: 2 },
      random_motes: false,
      random_shades: false,
      shades: [{ id: "S1", pos: [0, 0, 0.5] }],
    },
    maxTicks: 120,
    snapshotEvery: 10,
  });

  const hits = lines.filter((l) => l.type === "event" && l.name === "player_hit");
  assert.equal(hits.length, 2);
  assert.deepEqual(hits[0], {
    type: "event",
    tick: 1,
    name: "player_hit",
    data: { by: "shade", flames: 1, dropped: 1 },
  });
  // invuln_s=1.5s (90 ticks) -> second hit must occur at tick 92 (after tick 91 clears invuln)
  assert.ok(hits[1].tick >= 91, `expected invuln for 90 ticks, second hit at ${hits[1].tick}`);
  assert.deepEqual(hits[1], {
    type: "event",
    tick: hits[1].tick,
    name: "player_hit",
    data: { by: "shade", flames: 0, dropped: 1 },
  });

  const over = lines.find((l) => l.type === "event" && l.name === "game_over");
  assert.deepEqual(over?.data, { result: "lost", reason: "no_flames" });
});

test("dawn timer ends game with lost/dawn and simulation is byte-for-byte deterministic without -0", () => {
  const opts = {
    seed: 12,
    scenario: {
      player: { pos: [-0, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      time_left_s: 0.5,
    },
    maxTicks: 60,
    snapshotEvery: 15,
  };
  const run1 = runHeadlessSimulation(opts).map((x) => JSON.stringify(x));
  const run2 = runHeadlessSimulation(opts).map((x) => JSON.stringify(x));
  assert.deepEqual(run1, run2);
  for (const line of run1) {
    assert.equal(/(?<=[:\[,])-0(?=[,\]\}])/.test(line), false, `unexpected -0 in ${line}`);
  }
  const end = JSON.parse(run1[run1.length - 1]);
  assert.deepEqual(end, { type: "end", ticks: 30, state: "lost", score: 0 });
});
