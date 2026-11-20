import type { LanternEntity, TuningConfig } from "./types.js";

/** Fixed simulation step duration (60 ticks/second). */
export const DT_SEC = 1 / 60;

/** Floating-point epsilon for deterministic timer expiry (`3.0s = 180` ticks). */
export const TIMER_EPS = 1e-9;

/** Circular island radius and safe clamp radius in meters. */
export const ISLAND_RADIUS = 35;
export const PLAYER_CLAMP_RADIUS = 34.5;
export const LANTERN_RING_RADIUS = 25;

/** Default Night 1 tuning matching `game.contract.json`. */
export const DEFAULT_TUNING: TuningConfig = {
  player_speed: 6,
  carry_capacity: 5,
  lantern_cost: 3,
  lantern_count_night1: 5,
  pickup_radius: 1.5,
  interact_radius: 2.5,
  pulse_cost: 1,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3,
  pulse_push_m: 4,
  pulse_cooldown_s: 2,
  safe_radius: 4.5,
  shade_speed: 3.5,
  shade_hit_radius: 0.9,
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 200,
    per_stun: 50,
    per_second_left: 2,
    per_flame_left: 100,
  },
};

function roundCoord(value: number): number {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Creates the 5 default unlit Great Lanterns (`L1..L5`) evenly spaced around Đảo Bến. */
export function createDefaultLanterns(): LanternEntity[] {
  const lanterns: LanternEntity[] = [];
  const count = DEFAULT_TUNING.lantern_count_night1;
  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI * 2) / count;
    const x = roundCoord(LANTERN_RING_RADIUS * Math.sin(angle));
    const z = roundCoord(LANTERN_RING_RADIUS * Math.cos(angle));
    lanterns.push({
      id: `L${i + 1}`,
      pos: [x, 0, z],
      lit: false,
      deposited: 0,
    });
  }
  return lanterns;
}
