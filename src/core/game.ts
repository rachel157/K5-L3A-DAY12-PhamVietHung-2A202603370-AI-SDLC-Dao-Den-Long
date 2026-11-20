import {
  CHARM_DURATION_TICKS,
  CHARM_RESPAWN_TICKS,
  CHARM_SPEED_MPS,
  DASH_COOLDOWN_TICKS,
  DASH_TICKS,
  DEFAULT_TUNING,
  DRIFTER_DETECT_RADIUS,
  DRIFTER_DROP_FLEE_TICKS,
  DRIFTER_FLEE_TICKS,
  DRIFTER_IDLE_SPEED,
  DRIFTER_MAX_ACTIVE,
  DRIFTER_MAX_STEAL,
  DRIFTER_MIN_CARRIED_TO_CHASE,
  DRIFTER_SPAWN_INTERVAL_TICKS,
  DRIFTER_SPEED,
  DRIFTER_STEAL_RADIUS,
  DROPPED_MOTE_TTL_TICKS,
  DT_SEC,
  FALL_RESPAWN_TICKS,
  FALL_Y_THRESHOLD,
  GRAVITY_MPS2,
  INITIAL_RANDOM_MOTES,
  INVULN_TICKS,
  JUMP_VELOCITY_MPS,
  MOTE_MAX_CEILING,
  MOTE_SPAWN_INTERVAL_TICKS,
  PICKUP_HEIGHT_TOLERANCE,
  SHADE_DEFAULT_Y,
  SHADE_DETECT_RADIUS,
  SHADE_EVADE_TICKS,
  SHADE_FIRST_SPAWN_TICK,
  SHADE_LOSE_RADIUS,
  SHADE_RECOIL_DIST_M,
  SHADE_RECOIL_TICKS,
  SHADE_SPAWN_TICKS,
  SHADE_STUN_PUSH_TICKS,
  SHADE_STUN_TICKS,
  SHADE_WANDER_SPEED,
  TICKS_PER_SEC,
  TIMER_EPS,
  WIND_ACTIVE_TICKS,
  WIND_CYCLE_TICKS,
  WIND_SPEED_MPS,
  WIND_WARN_TICKS,
} from "./contract.js";
import {
  getGroundY,
  getNightMapConfig,
  moveHorizontalOnTerrain,
  resolveBellTowerPush,
  snapToValidGround,
} from "./maps.js";
import { createSeededRng } from "./prng.js";
import type {
  CharmEntity,
  DrifterEntity,
  GameEndLine,
  GameEvent,
  GameSnapshot,
  GameWorld,
  InputFrame,
  LanternEntity,
  MoteEntity,
  NightNumber,
  NormalizedInput,
  ScenarioConfig,
  ShadeBehaviorState,
  ShadeEntity,
  TuningConfig,
  Vec3Tuple,
} from "./types.js";

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

function dist3D(a: Vec3Tuple, b: Vec3Tuple): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function cloneTuning(tuning: TuningConfig): TuningConfig {
  return { ...tuning, score: { ...tuning.score } };
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

function defaultTicksForShadeState(state: ShadeBehaviorState): number {
  if (state === "stunned") return SHADE_STUN_TICKS;
  if (state === "recoil") return SHADE_RECOIL_TICKS;
  if (state === "spawning") return SHADE_SPAWN_TICKS;
  return 0;
}

function pickDistinctInitialMotePoints(
  points: Vec3Tuple[],
  count: number,
  rng: () => number
): Vec3Tuple[] {
  const pool = points.map((p): Vec3Tuple => [p[0], p[1], p[2]]);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  return pool.slice(0, Math.min(count, pool.length));
}

function findEmptyMotePoint(
  points: Vec3Tuple[],
  motes: MoteEntity[],
  rng: () => number
): Vec3Tuple | null {
  const empty = points.filter(
    (pt) =>
      !motes.some(
        (m) => m.kind === "random" && distXZ(m.pos, pt) <= 0.5 && Math.abs(m.pos[1] - pt[1]) <= 0.5
      )
  );
  if (empty.length === 0) return null;
  return empty[Math.floor(rng() * empty.length)]!;
}

function findValidShadeSpawnPoint(
  points: Vec3Tuple[],
  playerPos: Vec3Tuple,
  lanterns: LanternEntity[],
  safeRadius: number,
  rng: () => number
): Vec3Tuple | null {
  const valid = points.filter(
    (pt) =>
      distXZ(pt, playerPos) >= 15 &&
      lanterns.every((l) => !l.lit || distXZ(pt, l.pos) >= safeRadius)
  );
  if (valid.length === 0) return null;
  const chosen = valid[Math.floor(rng() * valid.length)]!;
  return [chosen[0], chosen[1], chosen[2]];
}

function repelFromLitLanterns(
  night: NightNumber,
  pos: Vec3Tuple,
  lanterns: LanternEntity[],
  safeRadius: number
): Vec3Tuple {
  let current: Vec3Tuple = [...pos];
  for (let pass = 0; pass < 2; pass++) {
    for (const lantern of lanterns) {
      if (!lantern.lit) continue;
      const dx = current[0] - lantern.pos[0];
      const dz = current[2] - lantern.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < safeRadius) {
        const dirX = d > TIMER_EPS ? dx / d : 1;
        const dirZ = d > TIMER_EPS ? dz / d : 0;
        const stepX = lantern.pos[0] + dirX * safeRadius - current[0];
        const stepZ = lantern.pos[2] + dirZ * safeRadius - current[2];
        const floorPos: Vec3Tuple = [current[0], current[1] - SHADE_DEFAULT_Y, current[2]];
        const moved = moveHorizontalOnTerrain(night, floorPos, stepX, stepZ, 0.45, false);
        const gy = getGroundY(night, moved.x, moved.z);
        current = [moved.x, (gy ?? 0) + SHADE_DEFAULT_Y, moved.z];
      }
    }
  }
  return current;
}

function shadeFloorPos(pos: Vec3Tuple): Vec3Tuple {
  return [pos[0], pos[1] - SHADE_DEFAULT_Y, pos[2]];
}

function createDroppedMotePosition(
  night: NightNumber,
  originPos: Vec3Tuple,
  rng: () => number,
  fallbackPos?: Vec3Tuple
): Vec3Tuple {
  const originGy = getGroundY(night, originPos[0], originPos[2]);
  const fallbackGy = fallbackPos ? getGroundY(night, fallbackPos[0], fallbackPos[2]) : null;
  const refY = originGy ?? fallbackGy ?? 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    const angle = rng() * Math.PI * 2;
    const radius = 1.5 + rng() * 1.0;
    const cx = originPos[0] + Math.cos(angle) * radius;
    const cz = originPos[2] + Math.sin(angle) * radius;
    const snapped = snapToValidGround(night, cx, cz, refY);
    if (snapped) return snapped;
  }
  return (
    snapToValidGround(night, originPos[0], originPos[2], refY) ??
    (fallbackPos ? snapToValidGround(night, fallbackPos[0], fallbackPos[2], refY) : null) ?? [
      originPos[0],
      refY,
      originPos[2],
    ]
  );
}

/** Creates the default zero-order hold input state prior to frame 0. */
export function createInitialInputState(): NormalizedInput {
  return {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    dash: false,
    interact: false,
    pulse: false,
    pause: false,
  };
}

/** Creates a deterministic world for Nights 1–3 from seed, tuning, and optional scenario. */
export function createGameWorld(options: {
  seed: number;
  night?: NightNumber;
  tuning?: TuningConfig;
  scenario?: ScenarioConfig;
}): GameWorld {
  const night: NightNumber = options.night ?? 1;
  const map = getNightMapConfig(night);
  const tuning = cloneTuning(options.tuning ?? DEFAULT_TUNING);
  const rng = createSeededRng(options.seed);
  const scenario = options.scenario;

  const lanterns: LanternEntity[] = map.lanterns.map((l) => ({
    id: l.id,
    pos: [l.pos[0], l.pos[1], l.pos[2]],
    lit: false,
    deposited: 0,
  }));

  if (scenario?.lanterns) {
    for (const patch of scenario.lanterns) {
      const target = lanterns.find((l) => l.id === patch.id);
      if (!target) {
        throw new Error(`Unknown lantern id in scenario: "${patch.id}"`);
      }
      if (patch.pos) target.pos = [patch.pos[0], patch.pos[1], patch.pos[2]];
      if (patch.lit !== undefined) target.lit = patch.lit;
      if (patch.deposited !== undefined) {
        target.deposited = patch.deposited;
      } else if (patch.lit === true) {
        target.deposited = tuning.lantern_cost;
      }
    }
  }

  const playerPos: Vec3Tuple = scenario?.player?.pos
    ? [scenario.player.pos[0], scenario.player.pos[1], scenario.player.pos[2]]
    : [...map.spawnPos];
  const initialGy = getGroundY(night, playerPos[0], playerPos[2]);
  const grounded = initialGy !== null && Math.abs(playerPos[1] - initialGy) <= 0.05;

  const player = {
    pos: playerPos,
    vel: [0, 0, 0] as Vec3Tuple,
    grounded,
    facing: [0, 1] as [number, number],
    flames: scenario?.player?.flames ?? tuning.flames,
    carried: scenario?.player?.carried ?? 0,
    invulnTicks: scenario?.player?.invuln_ticks ?? 0,
    dashTicksLeft: 0,
    dashCdTicks: scenario?.player?.dash_cd_ticks ?? 0,
    dashDir: [0, 1] as [number, number],
    pulseCdTicks: scenario?.player?.pulse_cd_ticks ?? 0,
    charmTicksLeft: scenario?.player?.charm_ticks ?? 0,
    respawnTicksLeft: 0,
    fallTriggered: false,
    isLaunched: false,
    launchVel: [0, 0] as [number, number],
    savedLaunchVy: 0,
  };

  const randomMotes = scenario?.random_motes ?? true;
  const randomShades = scenario?.random_shades ?? true;
  const randomDrifters = scenario?.random_drifters ?? night >= 2;

  const motes: MoteEntity[] = [];
  const usedMoteIds = new Set<string>();
  const moteCounter = { value: 1 };
  if (scenario?.motes !== undefined) {
    for (const item of scenario.motes) {
      if (!Array.isArray(item) && item.id) usedMoteIds.add(item.id);
    }
    for (const item of scenario.motes) {
      if (Array.isArray(item)) {
        const id = allocateId("M", moteCounter, usedMoteIds);
        motes.push({ id, pos: [item[0], item[1], item[2]], kind: "random", ttlTicks: null, bornTick: -1 });
      } else {
        const id = item.id ?? allocateId("M", moteCounter, usedMoteIds);
        const kind = item.kind ?? "random";
        let ttlTicks: number | null = null;
        if (kind === "dropped") {
          ttlTicks =
            item.ttl_ticks ??
            (item.ttl_s !== undefined ? Math.round(item.ttl_s * TICKS_PER_SEC) : DROPPED_MOTE_TTL_TICKS);
        }
        motes.push({
          id,
          pos: [item.pos[0], item.pos[1], item.pos[2]],
          kind,
          ttlTicks,
          bornTick: -1,
        });
      }
    }
  } else if (randomMotes) {
    const initialPts = pickDistinctInitialMotePoints(map.motePoints, INITIAL_RANDOM_MOTES, rng);
    for (const pt of initialPts) {
      const id = allocateId("M", moteCounter, usedMoteIds);
      motes.push({ id, pos: pt, kind: "random", ttlTicks: null, bornTick: -1 });
    }
  }

  const shades: ShadeEntity[] = [];
  const usedShadeIds = new Set<string>();
  const shadeCounter = { value: 1 };
  if (scenario?.shades !== undefined) {
    for (const item of scenario.shades) {
      if (item.id) usedShadeIds.add(item.id);
    }
    for (const item of scenario.shades) {
      const id = item.id ?? allocateId("S", shadeCounter, usedShadeIds);
      const pos: Vec3Tuple = [item.pos[0], item.pos[1], item.pos[2]];
      const state: ShadeBehaviorState =
        item.state ?? (distXZ(pos, player.pos) <= SHADE_DETECT_RADIUS ? "chase" : "wander");
      const ticksLeft = item.state_ticks_left ?? defaultTicksForShadeState(state);
      shades.push({
        id,
        pos,
        state,
        stateTicksLeft: ticksLeft,
        pushTicksLeft: 0,
        pushDir: [1, 0],
        recoilDir: [1, 0],
        evadeTicksLeft: 0,
        wanderAngle: rng() * Math.PI * 2,
        bornTick: -1,
      });
    }
  }

  const drifters: DrifterEntity[] = [];
  const usedDrifterIds = new Set<string>();
  const drifterCounter = { value: 1 };
  if (scenario?.drifters !== undefined) {
    for (const item of scenario.drifters) {
      if (item.id) usedDrifterIds.add(item.id);
    }
    for (const item of scenario.drifters) {
      const id = item.id ?? allocateId("D", drifterCounter, usedDrifterIds);
      let state = item.state ?? "idle";
      let stolen = item.stolen ?? 0;
      let fleeTicksLeft =
        state === "flee" ? (item.state_ticks_left ?? DRIFTER_FLEE_TICKS) : 0;
      if (state === "flee" && fleeTicksLeft <= 0) {
        state = "removed";
        stolen = 0;
        fleeTicksLeft = 0;
      }
      drifters.push({
        id,
        pos: [item.pos[0], item.pos[1], item.pos[2]],
        state,
        stolen,
        hasStolen: stolen > 0 || state === "flee" || state === "removed",
        fleeTicksLeft,
        wanderAngle: rng() * Math.PI * 2,
        bornTick: -1,
      });
    }
  }

  const charms: CharmEntity[] = [];
  if (scenario?.charms !== undefined) {
    for (let i = 0; i < scenario.charms.length; i++) {
      const c = scenario.charms[i]!;
      const fallback = map.charms.find((m) => m.id === c.id)?.pos ?? [0, 0, 0];
      let available = c.available ?? true;
      let respawnTicksLeft = available
        ? 0
        : c.respawn_ticks ?? (c.respawn_s !== undefined ? Math.round(c.respawn_s * 60) : CHARM_RESPAWN_TICKS);
      if (!available && respawnTicksLeft <= 0) {
        available = true;
        respawnTicksLeft = 0;
      }
      charms.push({
        id: c.id,
        pos: c.pos ? [c.pos[0], c.pos[1], c.pos[2]] : [...fallback],
        available,
        respawnTicksLeft,
      });
    }
  } else {
    for (const c of map.charms) {
      charms.push({
        id: c.id,
        pos: [c.pos[0], c.pos[1], c.pos[2]],
        available: true,
        respawnTicksLeft: 0,
      });
    }
  }

  const nightDurationS =
    night === 1
      ? tuning.night1_duration_s
      : night === 2
        ? tuning.night2_duration_s
        : tuning.night3_duration_s;
  const initialTimeS = scenario?.time_left_s ?? nightDurationS;
  const shadeSpeed =
    night === 3 ? tuning.shade_speed * (4.5 / 4.0) : tuning.shade_speed;

  return {
    seed: options.seed,
    night,
    tuning,
    tick: 0,
    simTick: 0,
    nightStartEmitted: false,
    state: "playing",
    paused: false,
    gameOverReason: null,
    timeLeftTicks: Math.max(0, Math.round(initialTimeS * TICKS_PER_SEC)),
    score: 0,
    wind: {
      enabled: scenario?.wind_enabled ?? map.hasWind,
      active: false,
      warning: false,
      dirDeg: 0,
      cycleTicks: 0,
    },
    player,
    lanterns,
    shades,
    motes,
    drifters,
    charms,
    moteSpawnPoints: map.motePoints,
    shadeSpawnPoints: map.shadePoints,
    drifterSpawnPoints: map.drifterPoints,
    shadeMax: map.shadeMax,
    shadeIntervalTicks: map.shadeIntervalTicks,
    shadeSpeed,
    randomMotes,
    randomShades,
    randomDrifters,
    nextMoteId: moteCounter.value,
    nextShadeId: shadeCounter.value,
    nextDrifterId: drifterCounter.value,
    rng,
    prevInput: createInitialInputState(),
  };
}

function updatePlayerRespawnAndTimers(world: GameWorld): void {
  const p = world.player;
  if (world.timeLeftTicks > 0) world.timeLeftTicks -= 1;
  if (p.dashCdTicks > 0) p.dashCdTicks -= 1;
  if (p.pulseCdTicks > 0) p.pulseCdTicks -= 1;
  if (p.invulnTicks > 0) p.invulnTicks -= 1;
  if (p.charmTicksLeft > 0) p.charmTicksLeft -= 1;
  if (p.dashTicksLeft > 0) {
    p.dashTicksLeft -= 1;
    if (p.dashTicksLeft === 0 && p.isLaunched) {
      p.vel[1] = p.savedLaunchVy;
      p.savedLaunchVy = 0;
    }
  }

  if (p.respawnTicksLeft > 0) {
    p.respawnTicksLeft -= 1;
    if (p.respawnTicksLeft === 0) {
      const map = getNightMapConfig(world.night);
      p.pos = [...map.spawnPos];
      p.vel = [0, 0, 0];
      p.grounded = true;
      p.fallTriggered = false;
      p.isLaunched = false;
      p.dashTicksLeft = 0;
      p.savedLaunchVy = 0;
      p.invulnTicks = Math.round(world.tuning.invuln_s * TICKS_PER_SEC);
    }
  }

  for (const charm of world.charms) {
    if (!charm.available && charm.respawnTicksLeft > 0) {
      charm.respawnTicksLeft -= 1;
      if (charm.respawnTicksLeft === 0) {
        charm.available = true;
      }
    }
  }

  for (const mote of world.motes) {
    if (mote.ttlTicks !== null && mote.ttlTicks > 0) {
      mote.ttlTicks -= 1;
    }
  }
  world.motes = world.motes.filter((m) => m.ttlTicks === null || m.ttlTicks > 0);

  for (const drifter of world.drifters) {
    if (drifter.state === "flee" && drifter.fleeTicksLeft > 0) {
      drifter.fleeTicksLeft -= 1;
      if (drifter.fleeTicksLeft === 0) {
        drifter.state = "removed";
        drifter.stolen = 0;
      }
    }
  }

  for (const shade of world.shades) {
    if (shade.evadeTicksLeft > 0) shade.evadeTicksLeft -= 1;
    if (shade.pushTicksLeft > 0) shade.pushTicksLeft -= 1;
    if (shade.stateTicksLeft > 0) {
      shade.stateTicksLeft -= 1;
      if (shade.stateTicksLeft === 0) {
        if (shade.state === "spawning" || shade.state === "recoil" || shade.state === "stunned") {
          shade.state =
            distXZ(shade.pos, world.player.pos) <= SHADE_DETECT_RADIUS ? "chase" : "wander";
        }
      }
    }
  }

  if (world.wind.enabled) {
    const mod = world.simTick % WIND_CYCLE_TICKS;
    const warnStart = WIND_CYCLE_TICKS - WIND_WARN_TICKS;
    if (mod === warnStart) {
      world.wind.dirDeg = Math.floor(world.rng() * 360);
    }
    world.wind.warning = mod >= warnStart;
    world.wind.active = mod >= 0 && mod < WIND_ACTIVE_TICKS && world.simTick >= WIND_CYCLE_TICKS;
  }
}

function stepPlayerMovement(
  world: GameWorld,
  input: NormalizedInput,
  jumpPressed: boolean,
  dashPressed: boolean,
  events: GameEvent[]
): void {
  const p = world.player;
  if (p.respawnTicksLeft > 0 || p.flames <= 0) {
    p.vel = [0, 0, 0];
    return;
  }

  const theta = (input.cam_yaw_deg * Math.PI) / 180;
  let wx = input.move[0] * Math.cos(theta) + input.move[1] * Math.sin(theta);
  let wz = -input.move[0] * Math.sin(theta) + input.move[1] * Math.cos(theta);
  const moveLen = Math.hypot(wx, wz);
  if (moveLen > 1) {
    wx /= moveLen;
    wz /= moveLen;
  }
  const hasMove = moveLen > TIMER_EPS;
  if (hasMove) {
    const inv = 1 / Math.hypot(wx, wz);
    p.facing = [wx * inv, wz * inv];
  }

  if (
    dashPressed &&
    p.dashTicksLeft === 0 &&
    (p.dashCdTicks === 0 || p.charmTicksLeft > 0)
  ) {
    p.dashDir = hasMove ? [wx / Math.hypot(wx, wz), wz / Math.hypot(wx, wz)] : [...p.facing];
    p.savedLaunchVy = p.isLaunched ? p.vel[1] : 0;
    p.dashTicksLeft = Math.round(world.tuning.dash_duration_s * TICKS_PER_SEC);
    p.dashCdTicks =
      p.charmTicksLeft > 0 ? 0 : Math.round(world.tuning.dash_cooldown_s * TICKS_PER_SEC);
    events.push({ type: "event", tick: world.tick, name: "dash", data: {} });
  }

  let vx = 0;
  let vz = 0;
  let vy = p.vel[1];

  if (p.dashTicksLeft > 0) {
    vx = p.dashDir[0] * world.tuning.dash_speed;
    vz = p.dashDir[1] * world.tuning.dash_speed;
    vy = 0;
  } else if (p.isLaunched) {
    vx = p.launchVel[0];
    vz = p.launchVel[1];
    vy -= GRAVITY_MPS2 * DT_SEC;
  } else {
    const runSpeed = p.charmTicksLeft > 0 ? CHARM_SPEED_MPS : world.tuning.player_speed;
    vx = wx * runSpeed;
    vz = wz * runSpeed;
    if (jumpPressed && p.grounded) {
      vy = JUMP_VELOCITY_MPS;
      p.grounded = false;
    } else if (!p.grounded) {
      vy -= GRAVITY_MPS2 * DT_SEC;
    }
  }

  if (world.wind.enabled && world.wind.active) {
    const wRad = (world.wind.dirDeg * Math.PI) / 180;
    vx += Math.cos(wRad) * WIND_SPEED_MPS;
    vz += Math.sin(wRad) * WIND_SPEED_MPS;
  }

  const oldX = p.pos[0];
  const oldY = p.pos[1];
  const oldZ = p.pos[2];

  const moved = moveHorizontalOnTerrain(
    world.night,
    p.pos,
    vx * DT_SEC,
    vz * DT_SEC,
    0.45,
    true
  );
  let ny = oldY + vy * DT_SEC;
  const gy = getGroundY(world.night, moved.x, moved.z);

  if (p.dashTicksLeft > 0) {
    if (gy !== null && ny < gy) {
      ny = gy;
    }
    p.grounded = gy !== null && Math.abs(ny - gy) <= 0.02;
  } else if (gy !== null && ny <= gy + TIMER_EPS && vy <= 0 && gy <= oldY + 0.45) {
    ny = gy;
    vy = 0;
    p.grounded = true;
    p.isLaunched = false;
  } else if (
    gy !== null &&
    p.grounded &&
    !p.isLaunched &&
    vy <= 0 &&
    gy <= oldY + 0.45 &&
    gy >= oldY - 0.45
  ) {
    ny = gy;
    vy = 0;
    p.grounded = true;
  } else {
    p.grounded = false;
  }

  // Trigger jump pad if touching pad on ground
  if (p.grounded && p.dashTicksLeft === 0) {
    const map = getNightMapConfig(world.night);
    for (const pad of map.jumpPads) {
      if (
        Math.hypot(moved.x - pad.pos[0], moved.z - pad.pos[2]) <= pad.radius &&
        Math.abs(ny - pad.pos[1]) <= 0.5
      ) {
        vy = pad.vy;
        p.grounded = false;
        p.isLaunched = true;
        p.launchVel = [pad.dirXZ[0] * pad.vh, pad.dirXZ[1] * pad.vh];
        break;
      }
    }
  }

  p.pos = [moved.x, ny, moved.z];
  p.vel = [(moved.x - oldX) / DT_SEC, p.dashTicksLeft > 0 ? 0 : vy, (moved.z - oldZ) / DT_SEC];

  if (world.tuning.fall_enabled && ny < FALL_Y_THRESHOLD && !p.fallTriggered) {
    p.fallTriggered = true;
    p.flames = Math.max(0, p.flames - 1);
    const lost = p.carried;
    p.carried = 0;
    p.respawnTicksLeft = FALL_RESPAWN_TICKS;
    events.push({
      type: "event",
      tick: world.tick,
      name: "player_hit",
      data: { by: "fall", flames: p.flames, dropped: 0, lost },
    });
  }
}

function stepPickups(world: GameWorld, events: GameEvent[]): void {
  const p = world.player;
  if (p.respawnTicksLeft > 0 || p.flames <= 0) return;

  const remaining: MoteEntity[] = [];
  for (const mote of world.motes) {
    if (
      mote.bornTick < world.simTick &&
      p.carried < world.tuning.carry_capacity &&
      distXZ(p.pos, mote.pos) <= world.tuning.pickup_radius &&
      Math.abs(p.pos[1] - mote.pos[1]) <= PICKUP_HEIGHT_TOLERANCE
    ) {
      p.carried += 1;
      events.push({
        type: "event",
        tick: world.tick,
        name: "mote_picked",
        data: { carried: p.carried },
      });
    } else {
      remaining.push(mote);
    }
  }
  world.motes = remaining;

  for (const charm of world.charms) {
    if (
      charm.available &&
      distXZ(p.pos, charm.pos) <= world.tuning.pickup_radius &&
      Math.abs(p.pos[1] - charm.pos[1]) <= PICKUP_HEIGHT_TOLERANCE
    ) {
      charm.available = false;
      charm.respawnTicksLeft = CHARM_RESPAWN_TICKS;
      p.charmTicksLeft = CHARM_DURATION_TICKS;
      p.dashCdTicks = 0;
      events.push({
        type: "event",
        tick: world.tick,
        name: "charm_picked",
        data: { charm_id: charm.id, charm_ticks: CHARM_DURATION_TICKS },
      });
    }
  }
}

function stepLanternInteract(
  world: GameWorld,
  interactPressed: boolean,
  events: GameEvent[]
): void {
  const p = world.player;
  if (!interactPressed || p.respawnTicksLeft > 0 || p.flames <= 0 || p.carried <= 0) return;

  let best: LanternEntity | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const lantern of world.lanterns) {
    if (lantern.lit) continue;
    if (Math.abs(p.pos[1] - lantern.pos[1]) > PICKUP_HEIGHT_TOLERANCE) continue;
    const d = distXZ(p.pos, lantern.pos);
    if (d <= world.tuning.interact_radius) {
      if (d < bestDist - TIMER_EPS || (Math.abs(d - bestDist) <= TIMER_EPS && (!best || lantern.id < best.id))) {
        best = lantern;
        bestDist = d;
      }
    }
  }
  if (!best) return;

  const amount = Math.min(p.carried, world.tuning.lantern_cost - best.deposited);
  if (amount <= 0) return;

  p.carried -= amount;
  best.deposited += amount;
  world.score += amount * world.tuning.score.per_mote;
  events.push({
    type: "event",
    tick: world.tick,
    name: "deposit",
    data: { lantern_id: best.id, amount, deposited: best.deposited },
  });

  if (best.deposited >= world.tuning.lantern_cost) {
    best.lit = true;
    world.score += world.tuning.score.per_lantern;
    events.push({
      type: "event",
      tick: world.tick,
      name: "lantern_lit",
      data: { lantern_id: best.id },
    });
    for (const shade of world.shades) {
      if (distXZ(shade.pos, best.pos) < world.tuning.safe_radius) {
        shade.evadeTicksLeft = Math.max(shade.evadeTicksLeft, SHADE_EVADE_TICKS);
      }
    }
  }
}

function stepSafeZones(world: GameWorld, clampNonEvadingOnly: boolean): void {
  const safeR = world.tuning.safe_radius;
  for (const shade of world.shades) {
    for (const lantern of world.lanterns) {
      if (!lantern.lit) continue;
      const dx = shade.pos[0] - lantern.pos[0];
      const dz = shade.pos[2] - lantern.pos[2];
      const d = Math.hypot(dx, dz);
      if (d >= safeR) continue;

      const dirX = d > TIMER_EPS ? dx / d : 1;
      const dirZ = d > TIMER_EPS ? dz / d : 0;

      if (shade.evadeTicksLeft > 0) {
        if (!clampNonEvadingOnly) {
          const remaining = safeR - d;
          const speedPerTick = Math.max(world.shadeSpeed * DT_SEC, remaining / shade.evadeTicksLeft);
          const stepOut = Math.min(remaining, speedPerTick);
          const moved = moveHorizontalOnTerrain(
            world.night,
            shadeFloorPos(shade.pos),
            dirX * stepOut,
            dirZ * stepOut,
            0.45,
            false
          );
          const gy = getGroundY(world.night, moved.x, moved.z);
          shade.pos = [moved.x, (gy ?? 0) + SHADE_DEFAULT_Y, moved.z];
        }
      } else {
        const targetX = lantern.pos[0] + dirX * safeR;
        const targetZ = lantern.pos[2] + dirZ * safeR;
        const moved = moveHorizontalOnTerrain(
          world.night,
          shadeFloorPos(shade.pos),
          targetX - shade.pos[0],
          targetZ - shade.pos[2],
          0.45,
          false
        );
        const gy = getGroundY(world.night, moved.x, moved.z);
        shade.pos = [moved.x, (gy ?? 0) + SHADE_DEFAULT_Y, moved.z];
      }
    }
    if (shade.evadeTicksLeft > 0) {
      const stillInside = world.lanterns.some(
        (l) => l.lit && distXZ(shade.pos, l.pos) < safeR - 0.01
      );
      if (!stillInside) shade.evadeTicksLeft = 0;
    }
  }
}

function stepPulse(
  world: GameWorld,
  pulsePressed: boolean,
  events: GameEvent[]
): void {
  const p = world.player;
  if (
    !pulsePressed ||
    p.respawnTicksLeft > 0 ||
    p.flames <= 0 ||
    p.carried < world.tuning.pulse_cost ||
    p.pulseCdTicks > 0
  ) {
    return;
  }

  p.carried -= world.tuning.pulse_cost;
  p.pulseCdTicks = Math.round(world.tuning.pulse_cooldown_s * TICKS_PER_SEC);
  const pulseCenter: Vec3Tuple = [p.pos[0], p.pos[1] + 0.8, p.pos[2]];
  const stunnedIds: string[] = [];

  for (const shade of world.shades) {
    if (shade.bornTick >= world.simTick) continue;
    if (dist3D(pulseCenter, shade.pos) <= world.tuning.pulse_radius) {
      shade.state = "stunned";
      shade.stateTicksLeft = SHADE_STUN_TICKS;
      shade.pushTicksLeft = SHADE_STUN_PUSH_TICKS;
      const dx = shade.pos[0] - p.pos[0];
      const dz = shade.pos[2] - p.pos[2];
      const d = Math.hypot(dx, dz);
      shade.pushDir = d > TIMER_EPS ? [dx / d, dz / d] : [1, 0];
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

  // Pulse vs Gió Lạc (Drifters)
  for (const drifter of world.drifters) {
    if (drifter.bornTick >= world.simTick || drifter.state === "removed") continue;
    if (dist3D(pulseCenter, drifter.pos) > world.tuning.pulse_radius) continue;
    if (drifter.state === "chase") {
      drifter.state = "flee";
      drifter.fleeTicksLeft = DRIFTER_FLEE_TICKS;
    } else if (drifter.state === "flee" && drifter.stolen > 0) {
      const dropAmt = drifter.stolen;
      drifter.stolen = 0;
      drifter.fleeTicksLeft = DRIFTER_DROP_FLEE_TICKS;
      const used = new Set(world.motes.map((m) => m.id));
      const counterRef = { value: world.nextMoteId };
      for (let i = 0; i < dropAmt; i++) {
        const id = allocateId("M", counterRef, used);
        const dropPos = createDroppedMotePosition(
          world.night,
          drifter.pos,
          world.rng,
          world.player.pos
        );
        world.motes.push({
          id,
          pos: dropPos,
          kind: "dropped",
          ttlTicks: DROPPED_MOTE_TTL_TICKS,
          bornTick: world.simTick,
        });
      }
      world.nextMoteId = counterRef.value;
      events.push({
        type: "event",
        tick: world.tick,
        name: "drifter_drop",
        data: { drifter_id: drifter.id, amount: dropAmt },
      });
    }
  }
}

function chooseShadeTarget(world: GameWorld, shade: ShadeEntity): [number, number] {
  const px = world.player.pos[0];
  const pz = world.player.pos[2];
  if (world.night === 2) {
    const shadeOnA = shade.pos[0] <= 29;
    const shadeOnB = shade.pos[0] >= 41;
    const playerOnA = px <= 29;
    const playerOnB = px >= 41;
    if ((shadeOnA && playerOnB) || (shadeOnB && playerOnA)) {
      return [35, 0];
    }
  }
  const shadeFloorY = shade.pos[1] - SHADE_DEFAULT_Y;
  if (world.night === 3 && world.player.pos[1] >= 2.5 && shadeFloorY < 2.85) {
    // Steer toward nearer ramp entrance at R=30.4 (30° or 150°), then straight up ramp centerline to crest
    const radA = (30 * Math.PI) / 180;
    const radB = (150 * Math.PI) / 180;
    const pA: [number, number] = [30.4 * Math.cos(radA), 30.4 * Math.sin(radA)];
    const pB: [number, number] = [30.4 * Math.cos(radB), 30.4 * Math.sin(radB)];
    const dA = Math.hypot(shade.pos[0] - pA[0], shade.pos[2] - pA[1]);
    const dB = Math.hypot(shade.pos[0] - pB[0], shade.pos[2] - pB[1]);
    const rad = dA <= dB ? radA : radB;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const s = shade.pos[0] * cosA + shade.pos[2] * sinA;
    const w = -shade.pos[0] * sinA + shade.pos[2] * cosA;
    if (Math.abs(w) > 1.1 || s > 29.9) {
      return [29.8 * cosA, 29.8 * sinA];
    }
    return [23.5 * cosA, 23.5 * sinA];
  }
  return [px, pz];
}

function stepEnemies(world: GameWorld): void {
  const p = world.player;

  for (const shade of world.shades) {
    if (shade.bornTick >= world.simTick) continue;

    if (shade.state === "stunned") {
      if (shade.pushTicksLeft > 0) {
        const pushStep = world.tuning.pulse_push_m / SHADE_STUN_PUSH_TICKS;
        const moved = moveHorizontalOnTerrain(
          world.night,
          shadeFloorPos(shade.pos),
          shade.pushDir[0] * pushStep,
          shade.pushDir[1] * pushStep,
          0.45,
          false
        );
        if (moved.blocked) {
          shade.pushTicksLeft = 0;
        }
        const gy = getGroundY(world.night, moved.x, moved.z);
        shade.pos = [moved.x, (gy ?? 0) + SHADE_DEFAULT_Y, moved.z];
      }
      continue;
    }

    if (shade.state === "recoil") {
      const recoilStep = SHADE_RECOIL_DIST_M / SHADE_RECOIL_TICKS;
      const moved = moveHorizontalOnTerrain(
        world.night,
        shadeFloorPos(shade.pos),
        shade.recoilDir[0] * recoilStep,
        shade.recoilDir[1] * recoilStep,
        0.45,
        false
      );
      const gy = getGroundY(world.night, moved.x, moved.z);
      shade.pos = [moved.x, (gy ?? 0) + SHADE_DEFAULT_Y, moved.z];
      continue;
    }

    if (shade.state === "spawning" || shade.evadeTicksLeft > 0) continue;

    const dToPlayer = distXZ(shade.pos, p.pos);
    if (shade.state === "wander" && dToPlayer <= SHADE_DETECT_RADIUS && p.respawnTicksLeft === 0) {
      shade.state = "chase";
    } else if (shade.state === "chase" && (dToPlayer > SHADE_LOSE_RADIUS || p.respawnTicksLeft > 0)) {
      shade.state = "wander";
    }

    let dx = 0;
    let dz = 0;
    if (shade.state === "chase") {
      const [tx, tz] = chooseShadeTarget(world, shade);
      const d = Math.hypot(tx - shade.pos[0], tz - shade.pos[2]);
      if (d > TIMER_EPS) {
        const stepDist = Math.min(d, world.shadeSpeed * DT_SEC);
        dx = ((tx - shade.pos[0]) / d) * stepDist;
        dz = ((tz - shade.pos[2]) / d) * stepDist;
      }
    } else {
      shade.wanderAngle += 0.6 * DT_SEC;
      dx = Math.cos(shade.wanderAngle) * SHADE_WANDER_SPEED * DT_SEC;
      dz = Math.sin(shade.wanderAngle) * SHADE_WANDER_SPEED * DT_SEC;
    }

    const floorPos = shadeFloorPos(shade.pos);
    const moved = moveHorizontalOnTerrain(world.night, floorPos, dx, dz, 0.45, false);
    if (moved.blocked && shade.state === "wander") {
      shade.wanderAngle += Math.PI * 0.75;
    }
    const [bx, bz] = resolveBellTowerPush(world.night, moved.x, floorPos[1], moved.z);
    const gy = getGroundY(world.night, bx, bz);
    shade.pos = [bx, (gy ?? 0) + SHADE_DEFAULT_Y, bz];
  }

  // Enforce safe_radius outside after step 8 movement
  stepSafeZones(world, true);

  // Move Gió Lạc (Drifters)
  for (const drifter of world.drifters) {
    if (drifter.bornTick >= world.simTick || drifter.state === "removed") continue;
    if (drifter.state === "idle") {
      if (
        !drifter.hasStolen &&
        p.respawnTicksLeft === 0 &&
        p.carried >= DRIFTER_MIN_CARRIED_TO_CHASE &&
        distXZ(drifter.pos, p.pos) <= DRIFTER_DETECT_RADIUS
      ) {
        drifter.state = "chase";
      } else {
        drifter.wanderAngle += 0.5 * DT_SEC;
        drifter.pos = [
          drifter.pos[0] + Math.cos(drifter.wanderAngle) * DRIFTER_IDLE_SPEED * DT_SEC,
          drifter.pos[1],
          drifter.pos[2] + Math.sin(drifter.wanderAngle) * DRIFTER_IDLE_SPEED * DT_SEC,
        ];
      }
    }

    if (drifter.state === "chase") {
      if (
        p.respawnTicksLeft > 0 ||
        p.carried < DRIFTER_MIN_CARRIED_TO_CHASE ||
        distXZ(drifter.pos, p.pos) > DRIFTER_DETECT_RADIUS
      ) {
        drifter.state = "idle";
      } else {
        const dx = p.pos[0] - drifter.pos[0];
        const dz = p.pos[2] - drifter.pos[2];
        const d = Math.hypot(dx, dz);
        if (d > TIMER_EPS) {
          const step = Math.min(d, DRIFTER_SPEED * DT_SEC);
          drifter.pos = [
            drifter.pos[0] + (dx / d) * step,
            drifter.pos[1],
            drifter.pos[2] + (dz / d) * step,
          ];
        }
      }
    } else if (drifter.state === "flee") {
      const dx = drifter.pos[0] - p.pos[0];
      const dz = drifter.pos[2] - p.pos[2];
      const d = Math.hypot(dx, dz);
      const dirX = d > TIMER_EPS ? dx / d : 1;
      const dirZ = d > TIMER_EPS ? dz / d : 0;
      drifter.pos = [
        drifter.pos[0] + dirX * DRIFTER_SPEED * DT_SEC,
        drifter.pos[1],
        drifter.pos[2] + dirZ * DRIFTER_SPEED * DT_SEC,
      ];
    }
  }
}

function stepContacts(world: GameWorld, events: GameEvent[]): void {
  const p = world.player;
  if (p.respawnTicksLeft > 0 || p.flames <= 0) return;

  // 1. Gió Lạc steals first
  for (const drifter of world.drifters) {
    if (
      drifter.bornTick < world.simTick &&
      drifter.state === "chase" &&
      !drifter.hasStolen &&
      distXZ(drifter.pos, p.pos) <= DRIFTER_STEAL_RADIUS
    ) {
      const amount = Math.min(DRIFTER_MAX_STEAL, p.carried);
      if (amount > 0) {
        p.carried -= amount;
        drifter.stolen = amount;
        drifter.hasStolen = true;
        drifter.state = "flee";
        drifter.fleeTicksLeft = DRIFTER_FLEE_TICKS;
        events.push({
          type: "event",
          tick: world.tick,
          name: "drifter_steal",
          data: { drifter_id: drifter.id, amount, carried: p.carried },
        });
      }
    }
  }

  // 2. Bóng Mực hits in ascending id order (max 1 flame lost per tick)
  if (p.invulnTicks > 0) return;
  const sortedShades = [...world.shades].sort((a, b) => a.id.localeCompare(b.id));
  for (const shade of sortedShades) {
    if (
      shade.bornTick >= world.simTick ||
      shade.state !== "chase" ||
      shade.evadeTicksLeft > 0
    ) {
      continue;
    }
    const shadeFloorY = shade.pos[1] - SHADE_DEFAULT_Y;
    if (
      distXZ(p.pos, shade.pos) <= world.tuning.shade_hit_radius &&
      Math.abs(p.pos[1] - shadeFloorY) <= PICKUP_HEIGHT_TOLERANCE
    ) {
      p.flames = Math.max(0, p.flames - 1);
      const dropped = Math.floor(p.carried * world.tuning.hit_drop_ratio);
      p.carried -= dropped;
      p.invulnTicks = Math.round(world.tuning.invuln_s * TICKS_PER_SEC);

      const usedMotes = new Set(world.motes.map((m) => m.id));
      const counterRef = { value: world.nextMoteId };
      for (let i = 0; i < dropped; i++) {
        const id = allocateId("M", counterRef, usedMotes);
        world.motes.push({
          id,
          pos: createDroppedMotePosition(world.night, p.pos, world.rng),
          kind: "dropped",
          ttlTicks: DROPPED_MOTE_TTL_TICKS,
          bornTick: world.simTick,
        });
      }
      world.nextMoteId = counterRef.value;

      const dx = shade.pos[0] - p.pos[0];
      const dz = shade.pos[2] - p.pos[2];
      const d = Math.hypot(dx, dz);
      shade.state = "recoil";
      shade.stateTicksLeft = SHADE_RECOIL_TICKS;
      shade.recoilDir = d > TIMER_EPS ? [dx / d, dz / d] : [1, 0];

      events.push({
        type: "event",
        tick: world.tick,
        name: "player_hit",
        data: { by: "shade", flames: p.flames, dropped },
      });
      break;
    }
  }
}

function stepSpawners(world: GameWorld, events: GameEvent[]): void {
  const t = world.simTick;

  if (world.randomMotes && t > 0 && t % MOTE_SPAWN_INTERVAL_TICKS === 0) {
    if (world.motes.length < MOTE_MAX_CEILING) {
      const pt = findEmptyMotePoint(world.moteSpawnPoints, world.motes, world.rng);
      if (pt) {
        const used = new Set(world.motes.map((m) => m.id));
        const counterRef = { value: world.nextMoteId };
        const id = allocateId("M", counterRef, used);
        world.nextMoteId = counterRef.value;
        world.motes.push({ id, pos: [...pt], kind: "random", ttlTicks: null, bornTick: t });
      }
    }
  }

  if (world.randomShades && t >= SHADE_FIRST_SPAWN_TICK) {
    let countToSpawn = 0;
    if (t === SHADE_FIRST_SPAWN_TICK) {
      countToSpawn = 2;
    } else if ((t - SHADE_FIRST_SPAWN_TICK) % world.shadeIntervalTicks === 0) {
      countToSpawn = 1;
    }
    for (let i = 0; i < countToSpawn; i++) {
      if (world.shades.length >= world.shadeMax) break;
      const pt = findValidShadeSpawnPoint(
        world.shadeSpawnPoints,
        world.player.pos,
        world.lanterns,
        world.tuning.safe_radius,
        world.rng
      );
      if (!pt) break;
      const used = new Set(world.shades.map((s) => s.id));
      const counterRef = { value: world.nextShadeId };
      const id = allocateId("S", counterRef, used);
      world.nextShadeId = counterRef.value;
      world.shades.push({
        id,
        pos: pt,
        state: "spawning",
        stateTicksLeft: SHADE_SPAWN_TICKS,
        pushTicksLeft: 0,
        pushDir: [1, 0],
        recoilDir: [1, 0],
        evadeTicksLeft: 0,
        wanderAngle: world.rng() * Math.PI * 2,
        bornTick: t,
      });
      events.push({ type: "event", tick: world.tick, name: "shade_spawned", data: { id } });
    }
  }

  if (
    world.randomDrifters &&
    world.drifterSpawnPoints.length > 0 &&
    t > 0 &&
    t % DRIFTER_SPAWN_INTERVAL_TICKS === 0
  ) {
    const activeCount = world.drifters.filter((d) => d.state !== "removed").length;
    if (activeCount < DRIFTER_MAX_ACTIVE) {
      const pt = world.drifterSpawnPoints[Math.floor(world.rng() * world.drifterSpawnPoints.length)]!;
      const used = new Set(world.drifters.map((d) => d.id));
      const counterRef = { value: world.nextDrifterId };
      const id = allocateId("D", counterRef, used);
      world.nextDrifterId = counterRef.value;
      world.drifters.push({
        id,
        pos: [pt[0], pt[1], pt[2]],
        state: "idle",
        stolen: 0,
        hasStolen: false,
        fleeTicksLeft: 0,
        wanderAngle: world.rng() * Math.PI * 2,
        bornTick: t,
      });
    }
  }
}

function stepWinLoss(world: GameWorld, events: GameEvent[]): void {
  if (world.player.flames <= 0) {
    world.state = "lost";
    world.gameOverReason = "no_flames";
    events.push({
      type: "event",
      tick: world.tick,
      name: "game_over",
      data: { result: "lost", reason: "no_flames" },
    });
    return;
  }

  if (world.lanterns.every((l) => l.lit)) {
    const timeBonus = Math.floor(world.timeLeftTicks / TICKS_PER_SEC) * world.tuning.score.per_second_left;
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
    return;
  }

  if (world.timeLeftTicks <= 0) {
    world.state = "lost";
    world.gameOverReason = "dawn";
    events.push({
      type: "event",
      tick: world.tick,
      name: "game_over",
      data: { result: "lost", reason: "dawn" },
    });
  }
}

/** Advances the simulation by one tick following Ticket-02's mandatory 12-step order. */
export function stepGameWorld(
  world: GameWorld,
  framePatch?: Partial<InputFrame>
): GameEvent[] {
  if (world.state === "won" || world.state === "lost") {
    return [];
  }

  const events: GameEvent[] = [];
  world.tick += 1;

  // Step 1: Read input & handle pause before advancing simTick
  const prev = world.prevInput;
  const nextInput: NormalizedInput = {
    move: framePatch?.move ? [framePatch.move[0], framePatch.move[1]] : [prev.move[0], prev.move[1]],
    cam_yaw_deg: framePatch?.cam_yaw_deg ?? prev.cam_yaw_deg,
    jump: framePatch?.jump ?? prev.jump,
    dash: framePatch?.dash ?? prev.dash,
    interact: framePatch?.interact ?? prev.interact,
    pulse: framePatch?.pulse ?? prev.pulse,
    pause: framePatch?.pause ?? prev.pause,
  };
  const jumpPressed = !prev.jump && nextInput.jump;
  const dashPressed = !prev.dash && nextInput.dash;
  const interactPressed = !prev.interact && nextInput.interact;
  const pulsePressed = !prev.pulse && nextInput.pulse;
  const pausePressed = !prev.pause && nextInput.pause;
  world.prevInput = nextInput;

  if (pausePressed) {
    world.paused = !world.paused;
    world.state = world.paused ? "paused" : "playing";
    events.push({
      type: "event",
      tick: world.tick,
      name: world.paused ? "paused" : "resumed",
      data: {},
    });
  }

  if (world.paused) {
    return events;
  }

  world.simTick += 1;
  if (!world.nightStartEmitted) {
    world.nightStartEmitted = true;
    events.push({
      type: "event",
      tick: world.tick,
      name: "night_start",
      data: { night: world.night },
    });
  }

  // Step 2: Decrement timers
  updatePlayerRespawnAndTimers(world);

  // Step 3: Player movement & fall off island
  stepPlayerMovement(world, nextInput, jumpPressed, dashPressed, events);

  // Step 4: Motes & Charms pickup
  stepPickups(world, events);

  // Step 5: Lantern interaction
  stepLanternInteract(world, interactPressed, events);

  // Step 6: Safe zones (30-tick evade pushout)
  stepSafeZones(world, false);

  // Step 7: Pulse
  stepPulse(world, pulsePressed, events);

  // Step 8: Shades & Drifters movement
  stepEnemies(world);

  // Step 9: Contacts (Drifters steal first, then Shades hit)
  stepContacts(world, events);

  // Step 10: Scheduled spawns (motes, shades, drifters)
  stepSpawners(world, events);

  // Step 11: Win / Loss check
  stepWinLoss(world, events);

  return events;
}

/** Formats the current world state into a Test Contract v1.1 JSONL snapshot. */
export function toSnapshot(world: GameWorld): GameSnapshot {
  return {
    type: "snapshot",
    tick: world.tick,
    sim_tick: world.simTick,
    night: world.night,
    state: world.state,
    time_left_s: round3(world.timeLeftTicks / TICKS_PER_SEC),
    score: world.score,
    wind: {
      active: world.wind.active,
      dir_deg: round3(world.wind.dirDeg),
    },
    player: {
      pos: roundVec3(world.player.pos),
      vel: roundVec3(world.player.vel),
      grounded: world.player.grounded,
      flames: world.player.flames,
      carried: world.player.carried,
      invuln: world.player.invulnTicks > 0,
      dash_cd_s: round3(world.player.dashCdTicks / TICKS_PER_SEC),
      pulse_cd_s: round3(world.player.pulseCdTicks / TICKS_PER_SEC),
      charm_s: round3(world.player.charmTicksLeft / TICKS_PER_SEC),
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
      kind: m.kind,
      ttl_s: m.ttlTicks === null ? null : round3(m.ttlTicks / TICKS_PER_SEC),
    })),
    motes_active: world.motes.length,
    drifters: world.drifters.map((d) => ({
      id: d.id,
      pos: roundVec3(d.pos),
      state: d.state,
      stolen: d.stolen,
    })),
    charms: world.charms.map((c) => ({
      id: c.id,
      available: c.available,
      respawn_s: round3(c.respawnTicksLeft / TICKS_PER_SEC),
    })),
  };
}

/** Formats the final Test Contract v1.1 end line. */
export function toEndLine(world: GameWorld): GameEndLine {
  return {
    type: "end",
    ticks: world.tick,
    state: world.state,
    score: world.score,
  };
}

/** Executes a full headless simulation and returns all JSONL records in order. */
export function runHeadlessSimulation(options: {
  seed: number;
  night?: NightNumber;
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
    night: options.night ?? 1,
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

  const isTerminal = () => world.state === "won" || world.state === "lost";

  for (let k = 0; k < options.maxTicks; k++) {
    if (isTerminal()) {
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
    if (isTerminal()) {
      break;
    }
  }

  output.push(toEndLine(world));
  return output;
}
