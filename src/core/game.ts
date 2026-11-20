import {
  DEFAULT_TUNING,
  DT_SEC,
  PLAYER_CLAMP_RADIUS,
  TIMER_EPS,
  createDefaultLanterns,
} from "./contract.js";
import { createSeededRng } from "./prng.js";
import type {
  GameEndLine,
  GameEvent,
  GameSnapshot,
  GameWorld,
  InputFrame,
  LanternEntity,
  MoteEntity,
  NormalizedInput,
  ScenarioConfig,
  ShadeEntity,
  TuningConfig,
  Vec3Tuple,
} from "./types.js";

const DEFAULT_RANDOM_MOTES = 20;
const DEFAULT_RANDOM_SHADES = 3;
const MAX_RANDOM_SHADES = 5;
const MOTE_RESPAWN_INTERVAL_S = 4;
const SHADE_SPAWN_INTERVAL_S = 25;
const JUMP_VELOCITY_MPS = 6.5;
const GRAVITY_MPS2 = 18;
const SHADE_DEFAULT_Y = 0.8;

function round3(value: number): number {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function roundVec3(pos: Vec3Tuple): Vec3Tuple {
  return [round3(pos[0]), round3(pos[1]), round3(pos[2])];
}

function distXZ(a: Vec3Tuple, b: Vec3Tuple): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function clampToIsland(pos: Vec3Tuple, maxRadius: number): Vec3Tuple {
  const r = Math.hypot(pos[0], pos[2]);
  if (r <= maxRadius || r <= TIMER_EPS) {
    return pos;
  }
  const scale = maxRadius / r;
  return [pos[0] * scale, pos[1], pos[2] * scale];
}

function repelFromLitLanterns(
  pos: Vec3Tuple,
  lanterns: LanternEntity[],
  safeRadius: number,
  maxRadius: number
): Vec3Tuple {
  let current: Vec3Tuple = [...pos];
  for (let pass = 0; pass < 2; pass++) {
    for (const lantern of lanterns) {
      if (!lantern.lit) continue;
      const dx = current[0] - lantern.pos[0];
      const dz = current[2] - lantern.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < safeRadius) {
        if (d > TIMER_EPS) {
          current = [
            lantern.pos[0] + (dx / d) * safeRadius,
            current[1],
            lantern.pos[2] + (dz / d) * safeRadius,
          ];
        } else {
          current = [lantern.pos[0], current[1], lantern.pos[2] + safeRadius];
        }
        current = clampToIsland(current, maxRadius);
      }
    }
  }
  return current;
}

function cloneTuning(tuning: TuningConfig): TuningConfig {
  return {
    ...tuning,
    score: { ...tuning.score },
  };
}

function allocateId(prefix: string, counterRef: { value: number }, used: Set<string>): string {
  while (used.has(`${prefix}${counterRef.value}`)) {
    counterRef.value += 1;
  }
  const id = `${prefix}${counterRef.value}`;
  used.add(id);
  counterRef.value += 1;
  return id;
}

function sampleMotePosition(rng: () => number, lanterns: LanternEntity[]): Vec3Tuple {
  for (let attempt = 0; attempt < 24; attempt++) {
    const angle = rng() * Math.PI * 2;
    const radius = 3 + Math.sqrt(rng()) * (PLAYER_CLAMP_RADIUS - 5);
    const pos: Vec3Tuple = [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
    const clearOfLanterns = lanterns.every((l) => distXZ(pos, l.pos) >= 1.2);
    if (clearOfLanterns) return pos;
  }
  return [rng() * 10 - 5, 0, rng() * 10 - 5];
}

function sampleShadePosition(
  rng: () => number,
  playerPos: Vec3Tuple,
  lanterns: LanternEntity[],
  safeRadius: number
): Vec3Tuple {
  for (let attempt = 0; attempt < 32; attempt++) {
    const angle = rng() * Math.PI * 2;
    const radius = 14 + rng() * 16;
    const pos: Vec3Tuple = [Math.cos(angle) * radius, SHADE_DEFAULT_Y, Math.sin(angle) * radius];
    const farFromPlayer = distXZ(pos, playerPos) >= 12;
    const outsideSafe = lanterns.every((l) => !l.lit || distXZ(pos, l.pos) >= safeRadius);
    if (farFromPlayer && outsideSafe) {
      return clampToIsland(pos, PLAYER_CLAMP_RADIUS);
    }
  }
  return repelFromLitLanterns([22, SHADE_DEFAULT_Y, 0], lanterns, safeRadius, PLAYER_CLAMP_RADIUS);
}

/** Creates the default zero-order hold input state prior to frame 0. */
export function createInitialInputState(): NormalizedInput {
  return {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false,
  };
}

/** Creates a deterministic Night 1 world initialized from seed, tuning, and optional scenario. */
export function createGameWorld(options: {
  seed: number;
  tuning?: TuningConfig;
  scenario?: ScenarioConfig;
}): GameWorld {
  const tuning = cloneTuning(options.tuning ?? DEFAULT_TUNING);
  const rng = createSeededRng(options.seed);
  const scenario = options.scenario;

  const lanterns = createDefaultLanterns();
  if (scenario?.lanterns) {
    for (const patch of scenario.lanterns) {
      const target = lanterns.find((l) => l.id === patch.id);
      if (!target) {
        throw new Error(`Unknown lantern id in scenario: "${patch.id}"`);
      }
      if (patch.pos) {
        target.pos = [patch.pos[0], patch.pos[1], patch.pos[2]];
      }
      if (patch.lit !== undefined) {
        target.lit = patch.lit;
      }
      if (patch.deposited !== undefined) {
        target.deposited = patch.deposited;
      } else if (patch.lit === true) {
        target.deposited = tuning.lantern_cost;
      }
    }
  }

  const playerPos: Vec3Tuple = scenario?.player?.pos
    ? [scenario.player.pos[0], scenario.player.pos[1], scenario.player.pos[2]]
    : [0, 0, 0];

  const player = {
    pos: playerPos,
    vy: 0,
    flames: scenario?.player?.flames ?? tuning.flames,
    carried: scenario?.player?.carried ?? 0,
    invulnTimer: 0,
    pulseCooldown: 0,
  };

  const randomMotes = scenario?.random_motes ?? true;
  const randomShades = scenario?.random_shades ?? true;

  const motes: MoteEntity[] = [];
  const usedMoteIds = new Set<string>();
  const moteCounter = { value: 1 };
  if (scenario?.motes !== undefined) {
    for (const item of scenario.motes) {
      if (!Array.isArray(item) && item.id) {
        usedMoteIds.add(item.id);
      }
    }
    for (const item of scenario.motes) {
      if (Array.isArray(item)) {
        const id = allocateId("M", moteCounter, usedMoteIds);
        motes.push({ id, pos: [item[0], item[1], item[2]] });
      } else {
        const id = item.id ?? allocateId("M", moteCounter, usedMoteIds);
        motes.push({ id, pos: [item.pos[0], item.pos[1], item.pos[2]] });
      }
    }
  } else if (randomMotes) {
    for (let i = 0; i < DEFAULT_RANDOM_MOTES; i++) {
      const id = allocateId("M", moteCounter, usedMoteIds);
      motes.push({ id, pos: sampleMotePosition(rng, lanterns) });
    }
  }

  const shades: ShadeEntity[] = [];
  const usedShadeIds = new Set<string>();
  const shadeCounter = { value: 1 };
  if (scenario?.shades !== undefined) {
    for (const item of scenario.shades) {
      if (item.id) {
        usedShadeIds.add(item.id);
      }
    }
    for (const item of scenario.shades) {
      const id = item.id ?? allocateId("S", shadeCounter, usedShadeIds);
      const state = item.state ?? "chase";
      shades.push({
        id,
        pos: [item.pos[0], item.pos[1], item.pos[2]],
        state,
        stunTimer: state === "stunned" ? tuning.pulse_stun_s : 0,
      });
    }
  } else if (randomShades) {
    for (let i = 0; i < DEFAULT_RANDOM_SHADES; i++) {
      const id = allocateId("S", shadeCounter, usedShadeIds);
      shades.push({
        id,
        pos: sampleShadePosition(rng, player.pos, lanterns, tuning.safe_radius),
        state: "chase",
        stunTimer: 0,
      });
    }
  }

  const initialTimeLeftS = scenario?.time_left_s ?? tuning.night1_duration_s;

  return {
    seed: options.seed,
    tuning,
    tick: 0,
    simTick: 0,
    state: "playing",
    gameOverReason: null,
    initialTimeLeftS,
    timeLeftS: initialTimeLeftS,
    score: 0,
    player,
    lanterns,
    shades,
    motes,
    randomMotes,
    randomShades,
    nextMoteId: moteCounter.value,
    nextShadeId: shadeCounter.value,
    moteSpawnTimer: 0,
    shadeSpawnTimer: 0,
    rng,
    prevInput: createInitialInputState(),
  };
}

function decrementTimer(value: number): number {
  if (value <= 0) return 0;
  const next = Math.max(0, value - DT_SEC);
  return next <= TIMER_EPS ? 0 : next;
}

/** Advances the simulation by one fixed 60Hz tick and returns events emitted in that step. */
export function stepGameWorld(
  world: GameWorld,
  framePatch?: Partial<InputFrame>
): GameEvent[] {
  if (world.state !== "playing") {
    return [];
  }

  const events: GameEvent[] = [];
  world.tick += 1;
  world.simTick += 1;
  world.timeLeftS = Math.max(0, world.initialTimeLeftS - world.tick * DT_SEC);
  if (world.timeLeftS <= TIMER_EPS) {
    world.timeLeftS = 0;
  }

  // 1. Update cooldown & status timers
  world.player.invulnTimer = decrementTimer(world.player.invulnTimer);
  world.player.pulseCooldown = decrementTimer(world.player.pulseCooldown);
  for (const shade of world.shades) {
    if (shade.state === "stunned") {
      shade.stunTimer = decrementTimer(shade.stunTimer);
      if (shade.stunTimer <= TIMER_EPS) {
        shade.stunTimer = 0;
        shade.state = "chase";
      }
    }
  }

  // 2. Apply input frame with zero-order hold and rising-edge actions
  const prev = world.prevInput;
  const nextInput: NormalizedInput = {
    move: framePatch?.move ? [framePatch.move[0], framePatch.move[1]] : [prev.move[0], prev.move[1]],
    cam_yaw_deg: framePatch?.cam_yaw_deg ?? prev.cam_yaw_deg,
    jump: framePatch?.jump ?? prev.jump,
    interact: framePatch?.interact ?? prev.interact,
    pulse: framePatch?.pulse ?? prev.pulse,
  };
  const jumpPressed = !prev.jump && nextInput.jump;
  const interactPressed = !prev.interact && nextInput.interact;
  const pulsePressed = !prev.pulse && nextInput.pulse;
  world.prevInput = nextInput;

  const theta = (nextInput.cam_yaw_deg * Math.PI) / 180;
  const mx = nextInput.move[0];
  const mz = nextInput.move[1];
  let wx = mx * Math.cos(theta) + mz * Math.sin(theta);
  let wz = -mx * Math.sin(theta) + mz * Math.cos(theta);
  const moveLen = Math.hypot(wx, wz);
  if (moveLen > 1) {
    wx /= moveLen;
    wz /= moveLen;
  }

  let nextX = world.player.pos[0] + wx * world.tuning.player_speed * DT_SEC;
  let nextY = world.player.pos[1];
  let nextZ = world.player.pos[2] + wz * world.tuning.player_speed * DT_SEC;

  if (jumpPressed && nextY <= TIMER_EPS) {
    world.player.vy = JUMP_VELOCITY_MPS;
  }
  if (nextY > 0 || world.player.vy !== 0) {
    nextY += world.player.vy * DT_SEC;
    world.player.vy -= GRAVITY_MPS2 * DT_SEC;
    if (nextY <= 0) {
      nextY = 0;
      world.player.vy = 0;
    }
  }
  world.player.pos = clampToIsland([nextX, nextY, nextZ], PLAYER_CLAMP_RADIUS);

  // 3. Pick up firefly motes
  const remainingMotes: MoteEntity[] = [];
  for (const mote of world.motes) {
    if (
      world.player.carried < world.tuning.carry_capacity &&
      distXZ(world.player.pos, mote.pos) <= world.tuning.pickup_radius
    ) {
      world.player.carried += 1;
      world.score += world.tuning.score.per_mote;
      events.push({
        type: "event",
        tick: world.tick,
        name: "mote_picked",
        data: { carried: world.player.carried },
      });
    } else {
      remainingMotes.push(mote);
    }
  }
  world.motes = remainingMotes;

  // 4. Interact with nearest unlit lantern in interact_radius
  if (interactPressed && world.player.carried > 0) {
    let nearest: LanternEntity | null = null;
    let nearestDist = Number.POSITIVE_INFINITY;
    for (const lantern of world.lanterns) {
      if (lantern.lit) continue;
      const d = distXZ(world.player.pos, lantern.pos);
      if (d <= world.tuning.interact_radius && d < nearestDist - TIMER_EPS) {
        nearest = lantern;
        nearestDist = d;
      }
    }
    if (nearest) {
      const needed = Math.max(0, world.tuning.lantern_cost - nearest.deposited);
      const amount = Math.min(world.player.carried, needed);
      if (amount > 0) {
        world.player.carried -= amount;
        nearest.deposited += amount;
        events.push({
          type: "event",
          tick: world.tick,
          name: "deposit",
          data: { lantern_id: nearest.id, amount, deposited: nearest.deposited },
        });
        if (nearest.deposited >= world.tuning.lantern_cost) {
          nearest.lit = true;
          world.score += world.tuning.score.per_lantern;
          events.push({
            type: "event",
            tick: world.tick,
            name: "lantern_lit",
            data: { lantern_id: nearest.id },
          });
          if (world.lanterns.every((l) => l.lit)) {
            const timeBonus = Math.floor(Math.max(0, world.timeLeftS)) * world.tuning.score.per_second_left;
            const flameBonus = world.player.flames * world.tuning.score.per_flame_left;
            world.score += timeBonus + flameBonus;
            world.state = "won";
            world.gameOverReason = "all_lit";
            events.push({
              type: "event",
              tick: world.tick,
              name: "game_over",
              data: { result: "won", reason: "all_lit" },
            });
            return events;
          }
        }
      }
    }
  }

  // 5. Pulse to stun & push shades
  if (
    pulsePressed &&
    world.player.carried >= world.tuning.pulse_cost &&
    world.player.pulseCooldown <= TIMER_EPS
  ) {
    world.player.carried -= world.tuning.pulse_cost;
    world.player.pulseCooldown = world.tuning.pulse_cooldown_s;
    const stunnedIds: string[] = [];

    for (const shade of world.shades) {
      if (distXZ(world.player.pos, shade.pos) <= world.tuning.pulse_radius) {
        shade.state = "stunned";
        shade.stunTimer = world.tuning.pulse_stun_s;
        const dx = shade.pos[0] - world.player.pos[0];
        const dz = shade.pos[2] - world.player.pos[2];
        const d = Math.hypot(dx, dz);
        const dirX = d > TIMER_EPS ? dx / d : 0;
        const dirZ = d > TIMER_EPS ? dz / d : 1;
        const pushed: Vec3Tuple = [
          shade.pos[0] + dirX * world.tuning.pulse_push_m,
          shade.pos[1],
          shade.pos[2] + dirZ * world.tuning.pulse_push_m,
        ];
        shade.pos = repelFromLitLanterns(
          clampToIsland(pushed, PLAYER_CLAMP_RADIUS),
          world.lanterns,
          world.tuning.safe_radius,
          PLAYER_CLAMP_RADIUS
        );
        stunnedIds.push(shade.id);
      }
    }
    world.score += stunnedIds.length * world.tuning.score.per_stun;
    events.push({
      type: "event",
      tick: world.tick,
      name: "pulse",
      data: { stunned_ids: stunnedIds },
    });
  }

  // 6. Update shade movement & enforce lit lantern safe_radius
  for (const shade of world.shades) {
    if (shade.state === "chase") {
      const dx = world.player.pos[0] - shade.pos[0];
      const dz = world.player.pos[2] - shade.pos[2];
      const d = Math.hypot(dx, dz);
      const stepDist = world.tuning.shade_speed * DT_SEC;
      if (d > TIMER_EPS) {
        const moveDist = Math.min(d, stepDist);
        shade.pos = [
          shade.pos[0] + (dx / d) * moveDist,
          shade.pos[1],
          shade.pos[2] + (dz / d) * moveDist,
        ];
      }
    }
    shade.pos = repelFromLitLanterns(
      clampToIsland(shade.pos, PLAYER_CLAMP_RADIUS),
      world.lanterns,
      world.tuning.safe_radius,
      PLAYER_CLAMP_RADIUS
    );
  }

  // 7. Check shade collision against player
  if (world.player.invulnTimer <= TIMER_EPS) {
    const hitter = world.shades.find(
      (s) =>
        s.state === "chase" && distXZ(world.player.pos, s.pos) <= world.tuning.shade_hit_radius
    );
    if (hitter) {
      world.player.flames = Math.max(0, world.player.flames - 1);
      const dropped = Math.floor(world.player.carried * world.tuning.hit_drop_ratio);
      world.player.carried -= dropped;
      world.player.invulnTimer = world.tuning.invuln_s;
      events.push({
        type: "event",
        tick: world.tick,
        name: "player_hit",
        data: { by: "shade", flames: world.player.flames, dropped },
      });
      if (world.player.flames <= 0) {
        world.state = "lost";
        world.gameOverReason = "no_flames";
        events.push({
          type: "event",
          tick: world.tick,
          name: "game_over",
          data: { result: "lost", reason: "no_flames" },
        });
        return events;
      }
    }
  }

  // 8. Periodic deterministic spawners when enabled
  if (world.randomMotes) {
    world.moteSpawnTimer += DT_SEC;
    if (world.moteSpawnTimer >= MOTE_RESPAWN_INTERVAL_S - TIMER_EPS) {
      world.moteSpawnTimer = Math.max(0, world.moteSpawnTimer - MOTE_RESPAWN_INTERVAL_S);
      if (world.motes.length < DEFAULT_RANDOM_MOTES) {
        const usedMotes = new Set(world.motes.map((m) => m.id));
        const counterRef = { value: world.nextMoteId };
        const id = allocateId("M", counterRef, usedMotes);
        world.nextMoteId = counterRef.value;
        world.motes.push({ id, pos: sampleMotePosition(world.rng, world.lanterns) });
      }
    }
  }

  if (world.randomShades) {
    world.shadeSpawnTimer += DT_SEC;
    if (world.shadeSpawnTimer >= SHADE_SPAWN_INTERVAL_S - TIMER_EPS) {
      world.shadeSpawnTimer = Math.max(0, world.shadeSpawnTimer - SHADE_SPAWN_INTERVAL_S);
      if (world.shades.length < MAX_RANDOM_SHADES) {
        const usedShades = new Set(world.shades.map((s) => s.id));
        const counterRef = { value: world.nextShadeId };
        const id = allocateId("S", counterRef, usedShades);
        world.nextShadeId = counterRef.value;
        world.shades.push({
          id,
          pos: sampleShadePosition(
            world.rng,
            world.player.pos,
            world.lanterns,
            world.tuning.safe_radius
          ),
          state: "chase",
          stunTimer: 0,
        });
        events.push({
          type: "event",
          tick: world.tick,
          name: "shade_spawned",
          data: { id },
        });
      }
    }
  }

  // 9. Check dawn timeout
  if (world.state === "playing" && world.timeLeftS <= TIMER_EPS) {
    world.timeLeftS = 0;
    world.state = "lost";
    world.gameOverReason = "dawn";
    events.push({
      type: "event",
      tick: world.tick,
      name: "game_over",
      data: { result: "lost", reason: "dawn" },
    });
  }

  return events;
}

/** Formats the current world state into a Test Contract v1.0 JSONL snapshot. */
export function toSnapshot(world: GameWorld): GameSnapshot {
  return {
    type: "snapshot",
    tick: world.tick,
    sim_tick: world.simTick,
    state: world.state,
    time_left_s: round3(world.timeLeftS),
    score: world.score,
    player: {
      pos: roundVec3(world.player.pos),
      flames: world.player.flames,
      carried: world.player.carried,
    },
    lanterns: world.lanterns.map((l) => ({
      id: l.id,
      pos: roundVec3(l.pos),
      lit: l.lit,
      deposited: l.deposited,
    })),
    shades: world.shades.map((s) => ({
      id: s.id,
      pos: roundVec3(s.pos),
      state: s.state,
    })),
    motes: world.motes.map((m) => ({
      id: m.id,
      pos: roundVec3(m.pos),
    })),
    motes_active: world.motes.length,
  };
}

/** Formats the final Test Contract v1.0 end line. */
export function toEndLine(world: GameWorld): GameEndLine {
  return {
    type: "end",
    ticks: world.tick,
    state: world.state,
    score: world.score,
  };
}

/** Executes a full headless simulation and returns all JSONL output records in order. */
export function runHeadlessSimulation(options: {
  seed: number;
  tuning?: TuningConfig;
  scenario?: ScenarioConfig;
  frames?: InputFrame[];
  maxTicks: number;
  snapshotEvery?: number;
}): Array<GameSnapshot | GameEvent | GameEndLine> {
  const snapshotEvery = options.snapshotEvery ?? 10;
  if (!Number.isInteger(options.maxTicks) || options.maxTicks < 0) {
    throw new RangeError(`Expected non-negative integer maxTicks, received ${options.maxTicks}`);
  }
  if (!Number.isInteger(snapshotEvery) || snapshotEvery <= 0) {
    throw new RangeError(`Expected positive integer snapshotEvery, received ${snapshotEvery}`);
  }

  const world = createGameWorld({
    seed: options.seed,
    tuning: options.tuning,
    scenario: options.scenario,
  });

  const frameMap = new Map<number, InputFrame>();
  if (options.frames) {
    for (const frame of options.frames) {
      frameMap.set(frame.tick, frame);
    }
  }

  const output: Array<GameSnapshot | GameEvent | GameEndLine> = [];
  output.push(toSnapshot(world));

  for (let k = 0; k < options.maxTicks; k++) {
    if (world.state !== "playing") {
      break;
    }
    const patch = frameMap.get(k);
    const events = stepGameWorld(world, patch);
    for (const event of events) {
      output.push(event);
    }
    if (world.tick % snapshotEvery === 0) {
      output.push(toSnapshot(world));
    }
    if (world.state !== "playing") {
      break;
    }
  }

  output.push(toEndLine(world));
  return output;
}
