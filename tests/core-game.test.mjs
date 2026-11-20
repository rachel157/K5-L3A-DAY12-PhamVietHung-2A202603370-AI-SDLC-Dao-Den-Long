import test from "node:test";
import assert from "node:assert/strict";
import {
  createGameWorld,
  runHeadlessSimulation,
  toSnapshot,
} from "../dist-cli/core/game.js";

test("default Night 1 initialization matches Ticket-02 counts and spawns 2 shades at tick 300", () => {
  const lines0 = runHeadlessSimulation({ seed: 7, night: 1, maxTicks: 0 });
  const snap0 = lines0[0];
  assert.equal(snap0.type, "snapshot");
  assert.equal(snap0.night, 1);
  assert.equal(snap0.tick, 0);
  assert.equal(snap0.sim_tick, 0);
  assert.equal(snap0.state, "playing");
  assert.equal(snap0.time_left_s, 300);
  assert.equal(snap0.score, 0);
  assert.deepEqual(snap0.player.pos, [0, 0, 0]);
  assert.equal(snap0.player.flames, 3);
  assert.equal(snap0.player.carried, 0);
  assert.equal(snap0.player.invuln, false);
  assert.equal(snap0.player.grounded, true);
  assert.equal(snap0.lanterns.length, 5);
  assert.deepEqual(snap0.lanterns[0], { id: "L1", pos: [0, 0, 25], lit: false, deposited: 0 });
  assert.equal(snap0.motes_active, 20);
  assert.equal(snap0.motes.length, 20);
  assert.equal(snap0.motes[0].kind, "random");
  assert.equal(snap0.motes[0].ttl_s, null);
  assert.equal(snap0.shades.length, 0);

  // At tick 300, 2 shades spawn (S1, S2)
  const lines300 = runHeadlessSimulation({ seed: 7, night: 1, maxTicks: 300, snapshotEvery: 300 });
  const snap300 = lines300.find((l) => l.type === "snapshot" && l.tick === 300);
  assert.equal(snap300.shades.length, 2);
  assert.deepEqual(
    snap300.shades.map((s) => s.id),
    ["S1", "S2"]
  );
  assert.equal(snap300.shades[0].state, "spawning");
});

test("movement matches 6.0 m/s, cam_yaw_deg rotation, normalization, and 7.0 m/s jump", () => {
  const linesZ = runHeadlessSimulation({
    seed: 1,
    night: 1,
    scenario: { random_motes: false, random_shades: false },
    frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 0, jump: true }],
    maxTicks: 120,
    snapshotEvery: 120,
  });
  const snapZ = linesZ.find((l) => l.type === "snapshot" && l.tick === 120);
  assert.deepEqual(snapZ.player.pos, [0, 0, 12]);

  // Jump vy = 7.0, g = -20 -> at tick 21 (0.35s apex): y = 7*0.35 - 10*0.35^2 = 1.225m
  const linesJump = runHeadlessSimulation({
    seed: 1,
    night: 1,
    scenario: { random_motes: false, random_shades: false },
    frames: [{ tick: 0, move: [1, 1], cam_yaw_deg: 90, jump: true }],
    maxTicks: 21,
    snapshotEvery: 21,
  });
  const snap21 = linesJump.find((l) => l.type === "snapshot" && l.tick === 21);
  assert.ok(snap21.player.pos[1] > 1.15, `expected jump height > 1.15m, got ${snap21.player.pos[1]}`);
  assert.equal(snap21.player.grounded, false);
  const xzDist = Math.hypot(snap21.player.pos[0], snap21.player.pos[2]);
  assert.ok(Math.abs(xzDist - 6 * (21 / 60)) < 0.02);

  // cam_yaw_deg=90 with move=[0,1] moves along +X
  const linesX = runHeadlessSimulation({
    seed: 1,
    night: 1,
    scenario: { random_motes: false, random_shades: false },
    frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }],
    maxTicks: 60,
    snapshotEvery: 60,
  });
  const snapX = linesX.find((l) => l.type === "snapshot" && l.tick === 60);
  assert.deepEqual(snapX.player.pos, [6, 0, 0]);
});

test("zero-order hold persists absent fields, edge-triggers interact, and picks nearest tie-broken by smaller id", () => {
  const lines = runHeadlessSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 25], carried: 10, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: "L1", pos: [0, 0, 24], deposited: 8 },
        { id: "L2", pos: [0, 0, 26], deposited: 0 },
      ],
    },
    frames: [
      { tick: 0, interact: true },
      // tick 1 omits interact -> held true, L2 must NOT get deposit
      { tick: 2, interact: false },
      { tick: 3, interact: true },
    ],
    maxTicks: 5,
    snapshotEvery: 10,
  });
  const deposits = lines.filter((l) => l.type === "event" && l.name === "deposit");
  assert.equal(deposits.length, 2);
  assert.equal(deposits[0].tick, 1);
  assert.deepEqual(deposits[0].data, { lantern_id: "L1", amount: 2, deposited: 10 });
  assert.equal(deposits[1].tick, 4);
  assert.deepEqual(deposits[1].data, { lantern_id: "L2", amount: 8, deposited: 8 });
  const end = lines[lines.length - 1];
  // score = 2*10 + 100 (L1 lit) + 8*10 = 200
  assert.equal(end.score, 200);
});

test("scenario patches lanterns without events/score and pre-seeds explicit IDs without collision", () => {
  const world = createGameWorld({
    seed: 9,
    night: 1,
    scenario: {
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: "L1", lit: true },
        { id: "L2", pos: [0, 0, 10], deposited: 4 },
      ],
      motes: [{ pos: [1, 0, 0] }, { id: "M1", pos: [2, 0, 0] }],
      shades: [{ pos: [10, 0, 0] }, { id: "S1", pos: [20, 0, 0] }],
    },
  });
  const snap0 = toSnapshot(world);
  assert.equal(snap0.score, 0);
  assert.equal(snap0.lanterns[0].lit, true);
  assert.equal(snap0.lanterns[0].deposited, 10);
  assert.equal(new Set(snap0.motes.map((m) => m.id)).size, 2);
  assert.equal(new Set(snap0.shades.map((s) => s.id)).size, 2);
});

test("mote pickup respects carry_capacity=10 and winning applies all_lit bonus before dawn", () => {
  const lines = runHeadlessSimulation({
    seed: 2,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 9, flames: 2 },
      random_motes: false,
      random_shades: false,
      motes: [
        [0, 0, 0.5],
        [0, 0, 0.8],
      ],
      lanterns: [
        { id: "L1", lit: true },
        { id: "L2", lit: true },
        { id: "L3", lit: true },
        { id: "L4", lit: true },
        { id: "L5", pos: [0, 0, 1.5], deposited: 0 },
      ],
      time_left_s: 1 / 60,
    },
    frames: [{ tick: 0, interact: true }],
    maxTicks: 10,
    snapshotEvery: 1,
  });

  const picked = lines.filter((l) => l.type === "event" && l.name === "mote_picked");
  assert.equal(picked.length, 1);
  assert.equal(picked[0].data.carried, 10);

  const gameOver = lines.find((l) => l.type === "event" && l.name === "game_over");
  assert.deepEqual(gameOver?.data, { result: "won", reason: "all_lit" });

  // score = 10*10 (deposited) + 100 (lantern) + 0*2 (0s left) + 2*50 (flames) = 300
  const end = lines[lines.length - 1];
  assert.deepEqual(end, { type: "end", ticks: 1, state: "won", score: 300 });
});

test("pulse uses 3D distance <= 5m from player center, stuns 120 ticks, pushes 4m over 15 ticks, cooldown 180 ticks", () => {
  const lines = runHeadlessSimulation({
    seed: 3,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 6, flames: 3 },
      random_motes: false,
      random_shades: false,
      shades: [
        { id: "S1", pos: [0, 0.8, 3], state: "chase" },
        { id: "S2", pos: [0, 0.8, 0], state: "chase" }, // coincident -> +X push
      ],
    },
    frames: [
      { tick: 0, pulse: true },
      { tick: 1, pulse: false },
      { tick: 60, pulse: true }, // ignored during 180-tick cooldown
      { tick: 61, pulse: false },
    ],
    maxTicks: 125,
    snapshotEvery: 1,
  });

  const pulses = lines.filter((l) => l.type === "event" && l.name === "pulse");
  assert.equal(pulses.length, 1);
  assert.deepEqual(pulses[0].data.stunned_ids, ["S1", "S2"]);

  const snap15 = lines.find((l) => l.type === "snapshot" && l.tick === 15);
  assert.ok(Math.abs(snap15.shades[0].pos[2] - 7) < 0.01, `expected S1 pushed 4m to z=7, got ${snap15.shades[0].pos[2]}`);
  assert.ok(Math.abs(snap15.shades[1].pos[0] - 4) < 0.01, `expected coincident S2 pushed +X to x=4, got ${snap15.shades[1].pos[0]}`);
  assert.equal(snap15.score, 10); // 2 * 5 per_stun

  const snap120 = lines.find((l) => l.type === "snapshot" && l.tick === 120);
  const snap121 = lines.find((l) => l.type === "snapshot" && l.tick === 121);
  assert.equal(snap120.shades[0].state, "stunned");
  assert.notEqual(snap121.shades[0].state, "stunned");
});

test("lit lanterns block chase and stunned shades at 6m while unlit lanterns do not", () => {
  const lines = runHeadlessSimulation({
    seed: 4,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 25], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: "L1", pos: [0, 0, 25], lit: true }],
      shades: [
        { id: "S1", pos: [0, 0.8, 32], state: "chase" },
        { id: "S2", pos: [0, 0.8, 28], state: "stunned" },
      ],
    },
    maxTicks: 40,
    snapshotEvery: 1,
  });
  const snap1 = lines.find((l) => l.type === "snapshot" && l.tick === 1);
  const dChase = Math.hypot(snap1.shades[0].pos[0], snap1.shades[0].pos[2] - 25);
  const dStunned = Math.hypot(snap1.shades[1].pos[0], snap1.shades[1].pos[2] - 25);
  assert.ok(dChase >= 5.99, `chase shade breached 6m safe_radius: ${dChase}`);
  assert.ok(dStunned >= 5.99, `stunned shade breached 6m safe_radius: ${dStunned}`);
  assert.equal(lines.some((l) => l.type === "event" && l.name === "player_hit"), false);
});

test("shade hit drops floor(carried/2) pickupable motes for 480 ticks, triggers recoil & invuln, and loses at 0 flames", () => {
  const lines = runHeadlessSimulation({
    seed: 5,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 5, flames: 2 },
      random_motes: false,
      random_shades: false,
      shades: [{ id: "S1", pos: [0, 0.8, 0.5], state: "chase" }],
    },
    maxTicks: 120,
    snapshotEvery: 1,
  });

  const hits = lines.filter((l) => l.type === "event" && l.name === "player_hit");
  assert.equal(hits.length, 2);
  assert.deepEqual(hits[0], {
    type: "event",
    tick: 1,
    name: "player_hit",
    data: { by: "shade", flames: 1, dropped: 2 },
  });
  const snap1 = lines.find((l) => l.type === "snapshot" && l.tick === 1);
  assert.equal(snap1.player.invuln, true);
  assert.equal(snap1.motes.length, 2);
  assert.equal(snap1.motes[0].kind, "dropped");
  assert.equal(snap1.shades[0].state, "recoil");

  // invuln lasts 90 ticks; second hit occurs at tick >= 91
  assert.ok(hits[1].tick >= 91, `expected invuln 90 ticks, got second hit at ${hits[1].tick}`);
  const over = lines.find((l) => l.type === "event" && l.name === "game_over");
  assert.deepEqual(over?.data, { result: "lost", reason: "no_flames" });
});

test("dawn timeout ends game cleanly and Night 1 simulation is byte-for-byte deterministic without -0", () => {
  const opts = {
    seed: 12,
    night: 1,
    scenario: {
      player: { pos: [-0, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      time_left_s: 0.5,
    },
    maxTicks: 60,
    snapshotEvery: 15,
  };
  const r1 = runHeadlessSimulation(opts).map((x) => JSON.stringify(x));
  const r2 = runHeadlessSimulation(opts).map((x) => JSON.stringify(x));
  assert.deepEqual(r1, r2);
  for (const line of r1) {
    assert.equal(/(?<=[:\[,])-0(?=[,\]\}])/.test(line), false, `unexpected -0 in ${line}`);
  }
  assert.deepEqual(JSON.parse(r1[r1.length - 1]), { type: "end", ticks: 30, state: "lost", score: 0 });
});
