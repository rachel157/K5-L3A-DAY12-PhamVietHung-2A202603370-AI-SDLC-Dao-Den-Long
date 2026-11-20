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

test("lit lantern pushes inside shades out to >= 6m within 30 ticks without damage", () => {
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

test("shade wander/chase 12m/18m hysteresis and dropped mote 480-tick expiry work", () => {
  // 12m wander->chase detect threshold
  const detectLines = runHeadlessSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      shades: [{ id: "S1", pos: [12.5, 0.8, 0], state: "wander" }],
    },
    frames: [
      { tick: 0, move: [1, 0] }, // closes within <= 12m of S1
      { tick: 12, move: [0, 0] },
    ],
    maxTicks: 20,
    snapshotEvery: 1,
  });
  const snap1Det = detectLines.find((l) => l.type === "snapshot" && l.tick === 1);
  assert.equal(snap1Det.shades[0].state, "wander");
  const snap10Det = detectLines.find((l) => l.type === "snapshot" && l.tick === 10);
  assert.equal(snap10Det.shades[0].state, "chase", "shade switches wander -> chase within 12m");

  // Default 480-tick dropped mote expiry (hit at tick 1, then shelter in lit lantern at z=-10)
  const ttlLines = runHeadlessSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 2, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: "L1", pos: [0, 0, -10], lit: true }],
      shades: [{ id: "S1", pos: [0, 0.8, 0.8], state: "chase" }],
    },
    frames: [
      { tick: 2, move: [0, -1] }, // run -Z out of drop ring into L1 safe zone
      { tick: 105, move: [0, 0] },
    ],
    maxTicks: 485,
    snapshotEvery: 1,
  });
  const snap1Ttl = ttlLines.find((l) => l.type === "snapshot" && l.tick === 1);
  assert.equal(snap1Ttl.motes.filter((m) => m.kind === "dropped").length, 1);
  assert.equal(snap1Ttl.motes[0].ttl_s, 8, "dropped motes default to 480 ticks (8.0s)");
  const snap480Ttl = ttlLines.find((l) => l.type === "snapshot" && l.tick === 480);
  assert.equal(snap480Ttl.motes.length, 1, "dropped mote persists through tick 480");
  const snap481Ttl = ttlLines.find((l) => l.type === "snapshot" && l.tick === 481);
  assert.equal(snap481Ttl.motes.length, 0, "dropped mote expires after 480 ticks");

  // 18m chase->wander hysteresis
  const lines = runHeadlessSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [{ id: "M1", pos: [5, 0, 5], kind: "dropped", ttl_ticks: 2 }],
      shades: [{ id: "S1", pos: [14, 0.8, 0], state: "chase" }],
    },
    frames: [
      { tick: 0, move: [-1, 0] }, // move -X at 6m/s vs 4m/s chase -> crosses >18m after ~120 ticks
    ],
    maxTicks: 150,
    snapshotEvery: 1,
  });

  const snap1 = lines.find((l) => l.type === "snapshot" && l.tick === 1);
  assert.equal(snap1.shades[0].state, "chase");
  assert.equal(snap1.motes.length, 1);

  const snap2 = lines.find((l) => l.type === "snapshot" && l.tick === 2);
  assert.equal(snap2.motes.length, 0, "dropped mote expires when ttl hits 0");

  const snap145 = lines.find((l) => l.type === "snapshot" && l.tick === 145);
  assert.equal(snap145.shades[0].state, "wander", "shade drops chase once dist > 18m");
});

test("Night 3 cliff step-down triggers airborne fall instead of instant Y=0 snap", () => {
  const lines = runHeadlessSimulation({
    seed: 1,
    night: 3,
    scenario: {
      player: { pos: [0, 6, -7.8], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      wind_enabled: false,
    },
    frames: [{ tick: 0, move: [0, -1] }], // moves along -Z off Tier 2 edge onto Tier 0
    maxTicks: 6,
    snapshotEvery: 1,
  });

  const snap5 = lines.find((l) => l.type === "snapshot" && l.tick === 5);
  assert.equal(snap5.player.grounded, false, "walking off 6m cliff must leave ground");
  assert.ok(snap5.player.pos[1] > 4.5, `must fall smoothly under gravity, got Y=${snap5.player.pos[1]}`);
});

test("Night 3 shades block sideways 1.0m ramp cliffs and climb ramps smoothly onto Tier 1", () => {
  const cos30 = Math.cos((30 * Math.PI) / 180);
  const sin30 = 0.5;
  // Ramp center at s=28 (gy=1.0), lateral outside at w=1.65 (gy=0.0)
  const rampX = 28 * cos30;
  const rampZ = 28 * sin30;
  const sideX = 28 * cos30 - 1.65 * sin30;
  const sideZ = 28 * sin30 + 1.65 * cos30;

  const sideCliffLines = runHeadlessSimulation({
    seed: 1,
    night: 3,
    scenario: {
      player: { pos: [rampX, 1, rampZ], carried: 0, flames: 3, invuln_ticks: 90 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      wind_enabled: false,
      shades: [{ id: "S1", pos: [sideX, 0.8, sideZ], state: "chase" }],
    },
    maxTicks: 20,
    snapshotEvery: 1,
  });
  const sideEnd = sideCliffLines.find((l) => l.type === "snapshot" && l.tick === 20);
  assert.ok(
    sideEnd.shades[0].pos[1] <= 0.85,
    `shade must not step up 1.0m vertical ramp side, got center Y=${sideEnd.shades[0].pos[1]}`
  );

  // Climb from ramp foot R=31, 30 deg onto Tier 1 (Y=3, center Y=3.8) while chasing player on Tier 1 within 18m
  const climbLines = runHeadlessSimulation({
    seed: 1,
    night: 3,
    scenario: {
      player: { pos: [21 * cos30, 3, 21 * sin30], carried: 0, flames: 3, invuln_ticks: 90 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      wind_enabled: false,
      shades: [{ id: "S1", pos: [31 * cos30, 0.8, 31 * sin30], state: "chase" }],
    },
    maxTicks: 140,
    snapshotEvery: 1,
  });
  const climbEnd = climbLines.find((l) => l.type === "snapshot" && l.tick === 140);
  assert.ok(
    climbEnd.shades[0].pos[1] >= 3.79,
    `shade climbing ramp should reach Tier 1 (center Y=3.8), got ${climbEnd.shades[0].pos[1]}`
  );
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

  // Drifter over Night 2 true void pulsed from Island A edge drops motes onto reachable Island A ground (Y=0)
  const voidDropLines = runHeadlessSimulation({
    seed: 3,
    night: 2,
    scenario: {
      player: { pos: [26, 0, 10], carried: 3, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      drifters: [{ id: "D1", pos: [28.5, 1.6, 10], state: "flee", stolen: 3, state_ticks_left: 200 }],
    },
    frames: [{ tick: 0, pulse: true }],
    maxTicks: 5,
    snapshotEvery: 1,
  });
  const snapVoid = voidDropLines.find((l) => l.type === "snapshot" && l.tick === 1);
  assert.equal(snapVoid.motes.length, 3);
  for (const m of snapVoid.motes) {
    assert.equal(m.pos[1], 0, `dropped void mote must snap to ground Y=0, got ${m.pos}`);
    assert.ok(Math.hypot(m.pos[0], m.pos[2]) <= 28.001, `mote must land on Island A, got ${m.pos}`);
  }

  // Pulse turns chase drifter to flee & scheduled tick 1200 spawns Drifter on Night 2
  const schedLines = runHeadlessSimulation({
    seed: 1,
    night: 2,
    scenario: {
      player: { pos: [0, 0, 0], carried: 5, flames: 3 },
      random_motes: false,
      random_shades: false,
      drifters: [{ id: "D1", pos: [0, 1.6, 2], state: "chase" }],
    },
    frames: [{ tick: 0, pulse: true }],
    maxTicks: 1202,
    snapshotEvery: 1,
  });
  const snap1Sched = schedLines.find((l) => l.type === "snapshot" && l.tick === 1);
  assert.equal(snap1Sched.drifters[0].state, "flee", "pulse turns chase Drifter to flee");
  const snap1199 = schedLines.find((l) => l.type === "snapshot" && l.tick === 1199);
  const snap1200 = schedLines.find((l) => l.type === "snapshot" && l.tick === 1200);
  assert.equal(snap1199.drifters.length, 1);
  assert.equal(snap1200.drifters.length, 2, "scheduled Drifter must spawn at tick 1200");
});

test("fall_enabled=false disables fall damage and zero-tick scenario drifter/charm normalize cleanly", () => {
  const lines = runHeadlessSimulation({
    seed: 1,
    night: 2,
    tuning: { fall_enabled: false },
    scenario: {
      player: { pos: [35, -12, 0], carried: 2, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      drifters: [{ id: "D1", pos: [0, 1.6, 0], state: "flee", stolen: 2, state_ticks_left: 0 }],
      charms: [{ id: "C1", available: false, respawn_ticks: 0 }],
    },
    maxTicks: 5,
    snapshotEvery: 1,
  });
  assert.equal(lines.some((l) => l.type === "event" && l.name === "player_hit"), false);
  const snap2 = lines.find((l) => l.type === "snapshot" && l.tick === 2);
  assert.equal(snap2.drifters[0].state, "removed");
  assert.equal(snap2.charms[0].available, true);
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
  assert.equal(snap5.time_left_s, 240); // [THAY THẾ v1.2] Night 1 duration 240s
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
  // [THAY THẾ v1.2] Night 3 default duration is 300s (18,000 ticks); override time_left_s: 360 to retain the 21,600-tick stress benchmark.
  const startMs = performance.now();
  const lines = runHeadlessSimulation({
    seed: 7,
    night: 3,
    scenario: { player: { flames: 9999 }, time_left_s: 360, wind_enabled: true },
    maxTicks: 21600,
    snapshotEvery: 60,
  });
  const elapsedMs = performance.now() - startMs;
  assert.ok(elapsedMs < 30000, `21,600-tick run took ${elapsedMs}ms (>= 30s limit)`);
  const end = lines[lines.length - 1];
  assert.equal(end.type, "end");
  assert.equal(end.ticks, 21600);
});
