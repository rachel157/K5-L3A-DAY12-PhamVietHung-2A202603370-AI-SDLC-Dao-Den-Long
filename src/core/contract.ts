import type { LanternEntity, TuningConfig } from "./types.js";

/** Fixed simulation step duration (60 ticks/second). */
export const DT_SEC = 1 / 60;
export const TICKS_PER_SEC = 60;

/** Floating-point epsilon for geometry / boundary tolerances. */
export const TIMER_EPS = 1e-9;

/** Standard physics & Ticket-02 tick durations. */
export const JUMP_VELOCITY_MPS = 7.0;
export const GRAVITY_MPS2 = 20.0;
export const DASH_TICKS = 12;
export const DASH_COOLDOWN_TICKS = 90;
export const CHARM_SPEED_MPS = 7.2;
export const CHARM_DURATION_TICKS = 600;
export const CHARM_RESPAWN_TICKS = 2700;
export const FALL_Y_THRESHOLD = -10;
export const FALL_RESPAWN_TICKS = 60;
export const INVULN_TICKS = 90;

export const INITIAL_RANDOM_MOTES = 20;
export const MOTE_MAX_CEILING = 30;
export const MOTE_SPAWN_INTERVAL_TICKS = 240;
export const DROPPED_MOTE_TTL_TICKS = 480;
export const PICKUP_HEIGHT_TOLERANCE = 1.5;

export const SHADE_FIRST_SPAWN_TICK = 300;
export const SHADE_SPAWN_TICKS = 30;
export const SHADE_RECOIL_TICKS = 60;
export const SHADE_RECOIL_DIST_M = 2.0;
export const SHADE_STUN_TICKS = 120;
export const SHADE_STUN_PUSH_TICKS = 15;
export const SHADE_EVADE_TICKS = 30;
export const SHADE_DETECT_RADIUS = 12;
export const SHADE_LOSE_RADIUS = 18;
export const SHADE_WANDER_SPEED = 2.0;
export const SHADE_DEFAULT_Y = 0.8;

export const DRIFTER_SPAWN_INTERVAL_TICKS = 1200;
export const DRIFTER_MAX_ACTIVE = 2;
export const DRIFTER_IDLE_SPEED = 2.0;
export const DRIFTER_SPEED = 7.0;
export const DRIFTER_DETECT_RADIUS = 15.0;
export const DRIFTER_STEAL_RADIUS = 1.2;
export const DRIFTER_MAX_STEAL = 3;
export const DRIFTER_MIN_CARRIED_TO_CHASE = 5;
export const DRIFTER_FLEE_TICKS = 240;
export const DRIFTER_DROP_FLEE_TICKS = 120;

export const WIND_CYCLE_TICKS = 1800;
export const WIND_WARN_TICKS = 120;
export const WIND_ACTIVE_TICKS = 300;
export const WIND_SPEED_MPS = 2.0;

/** Default Contract v1.1 tuning matching `game.contract.json`. */
export const DEFAULT_TUNING: TuningConfig = {
  player_speed: 6,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 300,
  night2_duration_s: 330,
  night3_duration_s: 360,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: true,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 2,
    per_flame_left: 50,
  },
};

/** Returns the 5 standardized Night 1 Great Lanterns (`L1..L5`). */
export function createDefaultLanterns(): LanternEntity[] {
  const coords: Array<[number, number, number]> = [
    [0, 0, 25],
    [23.8, 0, 7.7],
    [14.7, 0, -20.2],
    [-14.7, 0, -20.2],
    [-23.8, 0, 7.7],
  ];
  return coords.map((pos, idx) => ({
    id: `L${idx + 1}`,
    pos,
    lit: false,
    deposited: 0,
  }));
}
