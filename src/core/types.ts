/** Supported nights in Phase 2 (`1 | 2 | 3`). */
export type NightNumber = 1 | 2 | 3;

/** 3D coordinate tuple `[x, y, z]` in meters (Y-up, ground at Y = 0). */
export type Vec3Tuple = [number, number, number];

/** 2D input move vector `[x, z]` in `[-1, 1]`. */
export type MoveTuple = [number, number];

/** Scoring configuration defined in `game.contract.json`. */
export interface ScoreConfig {
  per_mote: number;
  per_lantern: number;
  per_stun: number;
  per_second_left: number;
  per_flame_left: number;
}

/** Gameplay tuning configuration defined in `game.contract.json` (`v1.1`). */
export interface TuningConfig {
  player_speed: number;
  dash_speed: number;
  dash_duration_s: number;
  dash_cooldown_s: number;
  carry_capacity: number;
  lantern_cost: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  night2_duration_s: number;
  night3_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  safe_radius: number;
  shade_speed: number;
  shade_hit_radius: number;
  fall_enabled: boolean;
  score: ScoreConfig;
}

/** Root structure of `game.contract.json`. */
export interface GameContract {
  contract_version: string;
  team: string;
  build_cmd: string;
  run_cmd: string;
  headless_cmd: string;
  tuning: TuningConfig;
}

/** Great Lantern entity (`L1..L7`). */
export interface LanternEntity {
  id: string;
  pos: Vec3Tuple;
  lit: boolean;
  deposited: number;
}

/** Contract v1.1 required Shade states. */
export type ShadeBehaviorState = "spawning" | "wander" | "chase" | "recoil" | "stunned";

/** Shade (Bóng Mực) entity. */
export interface ShadeEntity {
  id: string;
  pos: Vec3Tuple;
  state: ShadeBehaviorState;
  stateTicksLeft: number;
  pushTicksLeft: number;
  pushDir: [number, number];
  recoilDir: [number, number];
  evadeTicksLeft: number;
  wanderAngle: number;
  bornTick: number;
}

/** Firefly mote kind (`random` from map points, `dropped` from hit/drifter). */
export type MoteKind = "random" | "dropped";

/** Firefly mote entity. */
export interface MoteEntity {
  id: string;
  pos: Vec3Tuple;
  kind: MoteKind;
  ttlTicks: number | null;
  bornTick: number;
}

/** Gió Lạc (Drifter) runtime states. */
export type DrifterState = "idle" | "chase" | "flee" | "removed";

/** Gió Lạc (Drifter) entity (Nights 2 & 3). */
export interface DrifterEntity {
  id: string;
  pos: Vec3Tuple;
  state: DrifterState;
  stolen: number;
  hasStolen: boolean;
  fleeTicksLeft: number;
  wanderAngle: number;
  bornTick: number;
}

/** Bùa Gió (Wind Charm) entity (`C1`, `C2`). */
export interface CharmEntity {
  id: string;
  pos: Vec3Tuple;
  available: boolean;
  respawnTicksLeft: number;
}

/** Player (Mây) runtime state. */
export interface PlayerState {
  pos: Vec3Tuple;
  vel: Vec3Tuple;
  grounded: boolean;
  facing: [number, number];
  flames: number;
  carried: number;
  invulnTicks: number;
  dashTicksLeft: number;
  dashCdTicks: number;
  dashDir: [number, number];
  pulseCdTicks: number;
  charmTicksLeft: number;
  respawnTicksLeft: number;
  fallTriggered: boolean;
  isLaunched: boolean;
  launchVel: [number, number];
  savedLaunchVy: number;
}

/** Single input frame from `--inputs` JSON (`v1.1`). */
export interface InputFrame {
  tick: number;
  move?: MoveTuple;
  cam_yaw_deg?: number;
  jump?: boolean;
  dash?: boolean;
  interact?: boolean;
  pulse?: boolean;
  pause?: boolean;
}

/** Persistent held input state across ticks (zero-order hold). */
export interface NormalizedInput {
  move: MoveTuple;
  cam_yaw_deg: number;
  jump: boolean;
  dash: boolean;
  interact: boolean;
  pulse: boolean;
  pause: boolean;
}

/** Scenario override JSON structure (`v1.1`). */
export interface ScenarioLanternOverride {
  id: string;
  pos?: Vec3Tuple;
  deposited?: number;
  lit?: boolean;
}

export interface ScenarioShadeOverride {
  id?: string;
  pos: Vec3Tuple;
  state?: ShadeBehaviorState;
  state_ticks_left?: number;
}

export interface ScenarioDrifterOverride {
  id?: string;
  pos: Vec3Tuple;
  state?: DrifterState;
  stolen?: number;
  state_ticks_left?: number;
}

export interface ScenarioCharmOverride {
  id: string;
  pos?: Vec3Tuple;
  available?: boolean;
  respawn_ticks?: number;
  respawn_s?: number;
}

export type ScenarioMoteInput =
  | Vec3Tuple
  | { id?: string; pos: Vec3Tuple; kind?: MoteKind; ttl_ticks?: number; ttl_s?: number };

export interface ScenarioConfig {
  player?: {
    pos?: Vec3Tuple;
    carried?: number;
    flames?: number;
    invuln_ticks?: number;
    dash_cd_ticks?: number;
    pulse_cd_ticks?: number;
    charm_ticks?: number;
  };
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: ScenarioMoteInput[];
  shades?: ScenarioShadeOverride[];
  drifters?: ScenarioDrifterOverride[];
  charms?: ScenarioCharmOverride[];
  lanterns?: ScenarioLanternOverride[];
  time_left_s?: number;
}

export type GamePlayState = "playing" | "paused" | "won" | "lost";
export type GameOverReason = "all_lit" | "dawn" | "no_flames";

export type GameEvent =
  | { type: "event"; tick: number; name: "night_start"; data: { night: NightNumber } }
  | { type: "event"; tick: number; name: "paused"; data: Record<string, never> }
  | { type: "event"; tick: number; name: "resumed"; data: Record<string, never> }
  | { type: "event"; tick: number; name: "dash"; data: Record<string, never> }
  | { type: "event"; tick: number; name: "mote_picked"; data: { carried: number } }
  | {
      type: "event";
      tick: number;
      name: "charm_picked";
      data: { charm_id: string; charm_ticks: number };
    }
  | {
      type: "event";
      tick: number;
      name: "deposit";
      data: { lantern_id: string; amount: number; deposited: number };
    }
  | { type: "event"; tick: number; name: "lantern_lit"; data: { lantern_id: string } }
  | { type: "event"; tick: number; name: "pulse"; data: { stunned_ids: string[] } }
  | {
      type: "event";
      tick: number;
      name: "drifter_steal";
      data: { drifter_id: string; amount: number; carried: number };
    }
  | {
      type: "event";
      tick: number;
      name: "drifter_drop";
      data: { drifter_id: string; amount: number };
    }
  | {
      type: "event";
      tick: number;
      name: "player_hit";
      data:
        | { by: "shade"; flames: number; dropped: number }
        | { by: "fall"; flames: number; dropped: number; lost: number };
    }
  | { type: "event"; tick: number; name: "shade_spawned"; data: { id: string } }
  | {
      type: "event";
      tick: number;
      name: "game_over";
      data: { result: "won" | "lost"; reason: GameOverReason };
    };

export interface GameSnapshot {
  type: "snapshot";
  tick: number;
  sim_tick: number;
  night: NightNumber;
  state: GamePlayState;
  time_left_s: number;
  score: number;
  wind: {
    active: boolean;
    dir_deg: number;
  };
  player: {
    pos: Vec3Tuple;
    vel: Vec3Tuple;
    grounded: boolean;
    flames: number;
    carried: number;
    invuln: boolean;
    dash_cd_s: number;
    pulse_cd_s: number;
    charm_s: number;
  };
  lanterns: Array<{
    id: string;
    pos: Vec3Tuple;
    lit: boolean;
    deposited: number;
  }>;
  shades: Array<{
    id: string;
    pos: Vec3Tuple;
    state: ShadeBehaviorState;
  }>;
  motes: Array<{
    id: string;
    pos: Vec3Tuple;
    kind: MoteKind;
    ttl_s: number | null;
  }>;
  motes_active: number;
  drifters: Array<{
    id: string;
    pos: Vec3Tuple;
    state: DrifterState;
    stolen: number;
  }>;
  charms: Array<{
    id: string;
    available: boolean;
    respawn_s: number;
  }>;
}

export interface GameEndLine {
  type: "end";
  ticks: number;
  state: GamePlayState;
  score: number;
}

/** Wind state for Night 3. */
export interface WindState {
  enabled: boolean;
  active: boolean;
  warning: boolean;
  dirDeg: number;
  cycleTicks: number;
}

/** Complete mutable simulation world. */
export interface GameWorld {
  seed: number;
  night: NightNumber;
  tuning: TuningConfig;
  tick: number;
  simTick: number;
  nightStartEmitted: boolean;
  state: GamePlayState;
  paused: boolean;
  gameOverReason: GameOverReason | null;
  timeLeftTicks: number;
  score: number;
  wind: WindState;
  player: PlayerState;
  lanterns: LanternEntity[];
  shades: ShadeEntity[];
  motes: MoteEntity[];
  drifters: DrifterEntity[];
  charms: CharmEntity[];
  moteSpawnPoints: Vec3Tuple[];
  shadeSpawnPoints: Vec3Tuple[];
  drifterSpawnPoints: Vec3Tuple[];
  shadeMax: number;
  shadeIntervalTicks: number;
  shadeSpeed: number;
  randomMotes: boolean;
  randomShades: boolean;
  randomDrifters: boolean;
  nextMoteId: number;
  nextShadeId: number;
  nextDrifterId: number;
  rng: () => number;
  prevInput: NormalizedInput;
}
