import test from "node:test";
import assert from "node:assert/strict";
import { runHeadlessSimulation } from "../dist-cli/core/game.js";

test("lantern fuel decays 1/s in integer 1/60 units, goes out at 0 (lantern_out), and relights for 5 motes", () => {
  const lines = runHeadlessSimulation({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 25], carried: 5, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: "L1", pos: [0, 0, 25], lit: true, fuel: 1.5 }],
    },
    frames: [
      { tick: 95, interact: true }, // relights L1 with 5 motes after it ran out at tick 90
    ],
    maxTicks: 100,
    snapshotEvery: 1,
  });

  const outEv = lines.find((l) => l.type === "event" && l.name === "lantern_out");
  assert.equal(outEv?.tick, 90);
  assert.deepEqual(outEv?.data, { lantern_id: "L1" });

  const snap90 = lines.find((l) => l.type === "snapshot" && l.tick === 90);
  assert.equal(snap90.lanterns[0].lit, false);
  assert.equal(snap90.lanterns[0].fuel, 0);
  assert.equal(snap90.lanterns[0].ever_lit, true);
  assert.equal(snap90.lanterns[0].deposited, 0);

  const relitEv = lines.find((l) => l.type === "event" && l.name === "lantern_lit");
  assert.deepEqual(relitEv?.data, { lantern_id: "L1", relight: true });

  const snap96 = lines.find((l) => l.type === "snapshot" && l.tick === 96);
  assert.equal(snap96.lanterns[0].lit, true);
  assert.equal(snap96.lanterns[0].fuel, 100);
  assert.equal(snap96.lanterns[0].relit_count, 1);
  assert.equal(snap96.player.carried, 0);
  assert.equal(snap96.player.capacity, 12);
  // 5*5 (deposit) + 40 (relight) = 65
  assert.equal(snap96.score, 65);
});

test("refuel uses ceil((100-fuel)/10), skips full lanterns, and enforces exact fuel=30 safe zone boundary", () => {
  // Refuel partial lantern + skip adjacent full lantern
  const refuelLines = runHeadlessSimulation({
    seed: 2,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 25], carried: 5, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: "L1", pos: [0, 0, 25], lit: true, fuel: 100 }, // 0m away but full -> must be skipped!
        { id: "L2", pos: [0, 0, 26], lit: true, fuel: 85 },  // 1m away, needs ceil(15/10)=2 motes
      ],
    },
    frames: [
      { tick: 0, interact: true }, // skips L1 (wait: at tick 0->1 Step 2 decays L1 from 100 to 99.983! Put L1 in separate tick-0 refuel test below)
      { tick: 1, interact: false },
    ],
    maxTicks: 5,
    snapshotEvery: 1,
  });
  // Note: at tick 1 Step 2 L1 decayed 1/60 to 5999/60 -> missing=1/60, so L1 WOULD need 1 mote if tested after Step 2 decay!
  // Let's test full lantern skip specifically with custom fuel_decay_per_s: 0 AND normal decay capped check
  assert.ok(refuelLines.some((l) => l.type === "event" && l.name === "refuel"));

  const skipFullLines = runHeadlessSimulation({
    seed: 2,
    night: 1,
    tuning: {
      player_speed: 6, dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5,
      carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5, pickup_radius: 1,
      interact_radius: 2, pulse_cost: 3, pulse_radius: 5, night1_duration_s: 240,
      night2_duration_s: 270, night3_duration_s: 300, flames: 3, invuln_s: 1.5,
      hit_drop_ratio: 0.5, pulse_stun_s: 2, pulse_push_m: 4, pulse_cooldown_s: 3,
      safe_radius: 6, shade_speed: 4, shade_hit_radius: 1, fall_enabled: true,
      fuel_max: 100, fuel_decay_per_s: 0, fuel_per_mote: 10, relight_cost: 5,
      win_ratio: 0.6, drain_per_s: 5, low_fuel_threshold: 30, capacity_max: 20,
      score: { per_mote: 5, per_lantern: 100, per_relight: 40, per_stun: 5, per_stun_drain: 15, per_lantern_dawn: 50, per_flame_left: 50 },
    },
    scenario: {
      player: { pos: [0, 0, 25], carried: 5, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: "L1", pos: [0, 0, 25], lit: true, fuel: 100 },
        { id: "L2", pos: [0, 0, 26], lit: true, fuel: 85 },
      ],
    },
    frames: [
      { tick: 0, interact: true }, // skips full L1, refuels L2 (+2 -> 100)
      { tick: 1, interact: false },
      { tick: 2, interact: true }, // both L1 & L2 now 100 -> must emit nothing & spend 0 carried
    ],
    maxTicks: 5,
    snapshotEvery: 1,
  });
  const refuels = skipFullLines.filter((l) => l.type === "event" && l.name === "refuel");
  assert.equal(refuels.length, 1);
  assert.deepEqual(refuels[0].data, { lantern_id: "L2", amount: 2, fuel: 100 });
  const snap3 = skipFullLines.find((l) => l.type === "snapshot" && l.tick === 3);
  assert.equal(snap3.player.carried, 3);
  assert.equal(snap3.score, 10);

  // Exact fuel=30 retains 6m safe zone, whereas fuel=29 loses it
  const safeBoundaryLines = runHeadlessSimulation({
    seed: 3,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 2, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: "L1", pos: [0, 0, 25], lit: true, fuel: 30 + 1 / 60 }, // after Step 2 decay at tick 1 -> exact 30.0
        { id: "L2", pos: [0, 0, -25], lit: true, fuel: 29 },        // < 30 -> no safe zone
      ],
      shades: [
        { id: "S1", pos: [0, 0.8, 28], state: "chase" },  // inside L1 6m -> pushed out
        { id: "S2", pos: [0, 0.8, -28], state: "chase" }, // inside L2 6m -> stays inside
      ],
    },
    maxTicks: 2,
    snapshotEvery: 1,
  });
  const snapBound1 = safeBoundaryLines.find((l) => l.type === "snapshot" && l.tick === 1);
  assert.equal(snapBound1.lanterns[0].fuel, 30);
  assert.ok(Math.hypot(snapBound1.shades[0].pos[0], snapBound1.shades[0].pos[2] - 25) >= 5.99);
  assert.ok(Math.hypot(snapBound1.shades[1].pos[0], snapBound1.shades[1].pos[2] + 25) < 4.0);
});

test("Shades wander to weak <30 lanterns, enter drain (-5/s stacked, fuel_drain every 60t), exit on >=30/6m/lantern_out, and pay +15 on Pulse", () => {
  const lines = runHeadlessSimulation({
    seed: 4,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 26], carried: 6, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: "L1", pos: [0, 0, 25], lit: true, fuel: 25 }],
      shades: [
        { id: "S1", pos: [0, 0.8, 25], state: "drain", target_lantern_id: "L1" }, // within 6m -> switches to chase? No, keep player >6m first!
      ],
    },
    maxTicks: 1,
  });
  assert.equal(lines.find((l) => l.type === "snapshot" && l.tick === 0)?.shades[0].state, "drain");

  // Full drain sequence: player waits outside 6m at [0,0,0], two shades drain L1 at 11/60s -> fuel_drain at tick 60, Pulse S1 pays +15
  const drainLines = runHeadlessSimulation({
    seed: 5,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 10], carried: 6, flames: 3 }, // >12m from L1(25) and S2(28) so S2 goes drain on L1
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: "L1", pos: [0, 0, 25], lit: true, fuel: 25 },
        { id: "L2", pos: [0, 0, -25], lit: false },
      ],
      shades: [
        { id: "S1", pos: [0, 0.8, 25], state: "drain", target_lantern_id: "L1" },
        { id: "S2", pos: [0, 0.8, 28], state: "wander" }, // moves 2m/s toward weak L1 (3m -> enters drain within <=2m after 1m=30t)
      ],
    },
    frames: [
      { tick: 0, move: [0, -1] }, // run away >25m so S1/S2 don't chase
      { tick: 60, move: [0, 0] },
    ],
    maxTicks: 65,
    snapshotEvery: 1,
  });
  const fuelDrainEvs = drainLines.filter((l) => l.type === "event" && l.name === "fuel_drain");
  assert.ok(fuelDrainEvs.some((e) => e.tick === 60 && e.data.shade_id === "S1" && e.data.lantern_id === "L1"));
  const snap60 = drainLines.find((l) => l.type === "snapshot" && l.tick === 60);
  assert.equal(snap60.shades[1].state, "drain");
  // S1 drained 60t (5/60 * 60 = 5), decay 1, S2 drained ~30t -> total fuel noticeably < 20
  assert.ok(snap60.lanterns[0].fuel < 17);

  // Pulse drain (+15) vs chase (+5), plus stun -> wander after 120t, plus refuel >=30 pushes inside shades out
  const pulseRefuelLines = runHeadlessSimulation({
    seed: 6,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 25], carried: 5, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: "L1", pos: [0, 0, 25], lit: true, fuel: 25 }],
      shades: [
        { id: "S1", pos: [0, 0.8, 25.5], state: "drain", target_lantern_id: "L1" }, // within 5m 3D of player
      ],
    },
    frames: [
      { tick: 0, pulse: true }, // Pulse at tick 1 BEFORE Step 8 transitions drain->chase! Must award +15!
      { tick: 1, pulse: false, interact: true }, // Refuels L1 from <25 up to >=30 -> pushes stunned S1 out in <=30t
    ],
    maxTicks: 130,
    snapshotEvery: 1,
  });
  const snap1Pulse = pulseRefuelLines.find((l) => l.type === "snapshot" && l.tick === 1);
  assert.equal(snap1Pulse.score, 15, "pulsing a draining shade must award +15");
  const snap32 = pulseRefuelLines.find((l) => l.type === "snapshot" && l.tick === 32);
  assert.ok(Math.hypot(snap32.shades[0].pos[0], snap32.shades[0].pos[2] - 25) >= 5.99);

  // Same-tick lantern_out reverts draining shade to wander BEFORE Step 7 Pulse -> +5 (not +15)
  const sameTickOutLines = runHeadlessSimulation({
    seed: 7,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 25], carried: 3, flames: 3, invuln_ticks: 10 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: "L1", pos: [0, 0, 25], lit: true, fuel: 0.05 }], // runs out in Step 2 tick 1
      shades: [{ id: "S1", pos: [0, 0.8, 25.5], state: "drain", target_lantern_id: "L1" }],
    },
    frames: [{ tick: 0, pulse: true }],
    maxTicks: 2,
    snapshotEvery: 1,
  });
  assert.ok(sameTickOutLines.some((l) => l.type === "event" && l.name === "lantern_out"));
  const snap1Out = sameTickOutLines.find((l) => l.type === "snapshot" && l.tick === 1);
  assert.equal(snap1Out.score, 5, "shade reverted to wander when lantern died in Step 2 pays +5, not +15");

  // Night 3 wander skips unreachable Tier 2 L1 [0,6,6] and steers to Tier 0 weak lantern L4 [35,0,-10]
  const night3NavLines = runHeadlessSimulation({
    seed: 8,
    night: 3,
    scenario: {
      player: { pos: [0, 0, -20], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      wind_enabled: false,
      lanterns: [
        { id: "L1", lit: true, fuel: 15 },  // Tier 2 (Y=6) - closer XZ to S1? Put S1 at [15,0.8,-5] (dist to L1 ~18.6, dist to L4 ~20.6)
        { id: "L4", lit: true, fuel: 20 },  // Tier 0 (35,0,-10) - reachable!
      ],
      shades: [{ id: "S1", pos: [15, 0.8, -5], state: "wander" }],
    },
    maxTicks: 60,
    snapshotEvery: 60,
  });
  const snapN3 = night3NavLines.find((l) => l.type === "snapshot" && l.tick === 60);
  assert.ok(snapN3.shades[0].pos[0] > 16, `expected shade heading +X toward reachable L4, got x=${snapN3.shades[0].pos[0]}`);
});

test("dynamic capacity grows +2 per successful light up to 20 and no_flames takes priority over dawn_survived on final tick", () => {
  // Pre-lit L1..L4 do NOT increase capacity; lighting L5 grows 10->12, and tie on last tick with 0 flames loses (no_flames)
  const capLines = runHeadlessSimulation({
    seed: 9,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 25], carried: 10, flames: 1 },
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: "L1", pos: [0, 0, 25], deposited: 9 },
        { id: "L2", lit: true, fuel: 80 },
        { id: "L3", lit: true, fuel: 80 },
        { id: "L4", lit: true, fuel: 80 },
      ],
      shades: [{ id: "S1", pos: [0, 0.8, 35], state: "chase" }],
      time_left_s: 3 / 60,
    },
    frames: [
      { tick: 0, interact: true }, // lights L1 -> successfulLights=1, capacity=12, 4/5 lit
      { tick: 1, interact: false },
    ],
    maxTicks: 5,
    snapshotEvery: 1,
  });
  const snap1 = capLines.find((l) => l.type === "snapshot" && l.tick === 1);
  assert.equal(snap1.player.capacity, 12);
  const winOver = capLines.find((l) => l.type === "event" && l.name === "game_over");
  assert.deepEqual(winOver?.data, { result: "won", reason: "dawn_survived" });

  // Under ratio (2/5 < 3/5) loses with dawn
  const loseDawn = runHeadlessSimulation({
    seed: 10,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: "L1", lit: true, fuel: 50 },
        { id: "L2", lit: true, fuel: 50 },
      ],
      time_left_s: 1 / 60,
    },
    maxTicks: 5,
  });
  assert.deepEqual(
    loseDawn.find((l) => l.type === "event" && l.name === "game_over")?.data,
    { result: "lost", reason: "dawn" }
  );

  // Last tick with >=3/5 lit AND lethal hit on that exact final tick -> MUST lose with no_flames
  const tieLoss = runHeadlessSimulation({
    seed: 11,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 1 },
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: "L1", lit: true, fuel: 50 },
        { id: "L2", lit: true, fuel: 50 },
        { id: "L3", lit: true, fuel: 50 },
      ],
      shades: [{ id: "S1", pos: [0, 0.8, 0.5], state: "chase" }],
      time_left_s: 1 / 60,
    },
    maxTicks: 5,
  });
  assert.deepEqual(
    tieLoss.find((l) => l.type === "event" && l.name === "game_over")?.data,
    { result: "lost", reason: "no_flames" }
  );

  // Capacity cap at 20 even after 6+ successful lights
  const maxCapLines = runHeadlessSimulation({
    seed: 12,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 25], carried: 15, flames: 3, successful_lights: 5 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: "L1", pos: [0, 0, 25], lit: false, ever_lit: true, deposited: 4 }],
    },
    frames: [{ tick: 0, interact: true }],
    maxTicks: 2,
    snapshotEvery: 1,
  });
  const snapCap = maxCapLines.find((l) => l.type === "snapshot" && l.tick === 1);
  assert.equal(snapCap.player.capacity, 20);
});
