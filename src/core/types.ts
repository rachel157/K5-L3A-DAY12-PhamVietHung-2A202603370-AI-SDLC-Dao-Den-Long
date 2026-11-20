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

/** Gameplay tuning configuration defined in `game.contract.json`. */
export interface TuningConfig {
  player_speed: number;
  carry_capacity: number;
  lantern_cost: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
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

/** Great Lantern entity on Đảo Bến (`L1`..`L5`). */
export interface LanternEntity {
  id: string;
  pos: Vec3Tuple;
  lit: boolean;
  deposited: number;
}

/** Shade (Bóng Mực) runtime state. */
export type ShadeBehaviorState = "chase" | "stunned";

/** Shade entity on Đảo Bến. */
export interface ShadeEntity {
  id: string;
  pos: Vec3Tuple;
  state: ShadeBehaviorState;
  stunTimer: number;
}

/** Firefly mote entity on the ground. */
export interface MoteEntity {
  id: string;
  pos: Vec3Tuple;
}

/** Player (Mây) runtime state. */
export interface PlayerState {
  pos: Vec3Tuple;
  vy: number;
  flames: number;
  carried: number;
  invulnTimer: number;
  pulseCooldown: number;
}

/** Single input frame from `--inputs` JSON. */
export interface InputFrame {
  tick: number;
  move?: MoveTuple;
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
}

/** Persistent held input state across ticks (zero-order hold). */
export interface NormalizedInput {
  move: MoveTuple;
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
}

/** Scenario override JSON structure (`--scenario`). */
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
}

export type ScenarioMoteInput = Vec3Tuple | { id?: string; pos: Vec3Tuple };

export interface ScenarioConfig {
  player?: {
    pos?: Vec3Tuple;
    carried?: number;
    flames?: number;
  };
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: ScenarioMoteInput[];
  shades?: ScenarioShadeOverride[];
  lanterns?: ScenarioLanternOverride[];
  time_left_s?: number;
}

export type GamePlayState = "playing" | "won" | "lost";
export type GameOverReason = "all_lit" | "dawn" | "no_flames";

export type GameEvent =
  | { type: "event"; tick: number; name: "mote_picked"; data: { carried: number } }
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
      name: "player_hit";
      data: { by: "shade"; flames: number; dropped: number };
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
  state: GamePlayState;
  time_left_s: number;
  score: number;
  player: {
    pos: Vec3Tuple;
    flames: number;
    carried: number;
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
  }>;
  motes_active: number;
}

export interface GameEndLine {
  type: "end";
  ticks: number;
  state: GamePlayState;
  score: number;
}

/** Complete mutable simulation world for Đảo Bến (Night 1). */
export interface GameWorld {
  seed: number;
  tuning: TuningConfig;
  tick: number;
  simTick: number;
  state: GamePlayState;
  gameOverReason: GameOverReason | null;
  initialTimeLeftS: number;
  timeLeftS: number;
  score: number;
  player: PlayerState;
  lanterns: LanternEntity[];
  shades: ShadeEntity[];
  motes: MoteEntity[];
  randomMotes: boolean;
  randomShades: boolean;
  nextMoteId: number;
  nextShadeId: number;
  moteSpawnTimer: number;
  shadeSpawnTimer: number;
  rng: () => number;
  prevInput: NormalizedInput;
}
