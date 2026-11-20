import { createDefaultLanterns, TIMER_EPS } from "./contract.js";
import type { LanternEntity, NightNumber, Vec3Tuple } from "./types.js";

export interface JumpPadDef {
  id: string;
  pos: Vec3Tuple;
  radius: number;
  vy: number;
  vh: number;
  dirXZ: [number, number];
}

export interface CharmDef {
  id: string;
  pos: Vec3Tuple;
}

export interface NightMapConfig {
  night: NightNumber;
  durationS: number;
  spawnPos: Vec3Tuple;
  lanterns: LanternEntity[];
  motePoints: Vec3Tuple[];
  shadePoints: Vec3Tuple[];
  drifterPoints: Vec3Tuple[];
  jumpPads: JumpPadDef[];
  charms: CharmDef[];
  shadeSpeed: number;
  shadeMax: number;
  shadeIntervalTicks: number;
  hasWind: boolean;
}

const NIGHT3_RAMPS_DEG = [30, 150];
const NIGHT3_TOWER_RADIUS = 2.0;
const NIGHT3_TOWER_TOP_Y = 14.0;
const MAX_STEP_UP = 0.45;

function round3(v: number): number {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

function pointOnRing(
  cx: number,
  cz: number,
  radius: number,
  deg: number,
  y = 0
): Vec3Tuple {
  const rad = (deg * Math.PI) / 180;
  return [round3(cx + radius * Math.cos(rad)), y, round3(cz + radius * Math.sin(rad))];
}

function normalizeXZ(dx: number, dz: number): [number, number] {
  const d = Math.hypot(dx, dz);
  if (d <= TIMER_EPS) return [0, 1];
  return [dx / d, dz / d];
}

function buildLanternList(coords: Vec3Tuple[]): LanternEntity[] {
  return coords.map((pos, i) => ({
    id: `L${i + 1}`,
    pos,
    lit: false,
    deposited: 0,
  }));
}

/** Returns exact static map definition for Night 1, 2, or 3. */
export function getNightMapConfig(night: NightNumber): NightMapConfig {
  if (night === 1) {
    const motePoints: Vec3Tuple[] = [];
    for (let i = 0; i < 8; i++) motePoints.push(pointOnRing(0, 0, 12, i * 45, 0));
    for (let i = 0; i < 16; i++) motePoints.push(pointOnRing(0, 0, 33, i * 22.5, 0));

    const shadePoints: Vec3Tuple[] = [];
    for (let i = 0; i < 12; i++) shadePoints.push(pointOnRing(0, 0, 37, 15 + i * 30, 0.8));

    return {
      night: 1,
      durationS: 300,
      spawnPos: [0, 0, 0],
      lanterns: createDefaultLanterns(),
      motePoints,
      shadePoints,
      drifterPoints: [],
      jumpPads: [],
      charms: [],
      shadeSpeed: 4.0,
      shadeMax: 6,
      shadeIntervalTicks: 480,
      hasWind: false,
    };
  }

  if (night === 2) {
    const motePoints: Vec3Tuple[] = [];
    for (const cx of [0, 70]) {
      for (let i = 0; i < 4; i++) motePoints.push(pointOnRing(cx, 0, 10, i * 90, 0));
      for (let i = 0; i < 8; i++) motePoints.push(pointOnRing(cx, 0, 22, i * 45, 0));
    }

    const shadePoints: Vec3Tuple[] = [];
    for (const cx of [0, 70]) {
      for (let i = 0; i < 8; i++) shadePoints.push(pointOnRing(cx, 0, 26, 22.5 + i * 45, 0.8));
    }

    return {
      night: 2,
      durationS: 330,
      spawnPos: [0, 0, 0],
      lanterns: buildLanternList([
        [0, 0, 20],
        [17, 0, -10],
        [-17, 0, -10],
        [70, 0, 20],
        [87, 0, -10],
        [53, 0, -10],
      ]),
      motePoints,
      shadePoints,
      drifterPoints: [
        [35, 1.6, 14],
        [35, 1.6, -14],
        [16, 1.6, -18],
        [54, 1.6, 18],
      ],
      jumpPads: [
        {
          id: "JP1",
          pos: [20, 0, 18],
          radius: 1.0,
          vy: 14,
          vh: 24,
          dirXZ: normalizeXZ(70 - 20, 0 - 18),
        },
        {
          id: "JP2",
          pos: [50, 0, -18],
          radius: 1.0,
          vy: 14,
          vh: 24,
          dirXZ: normalizeXZ(0 - 50, 0 - -18),
        },
      ],
      charms: [{ id: "C1", pos: [35, 0, 0] }],
      shadeSpeed: 4.0,
      shadeMax: 8,
      shadeIntervalTicks: 420,
      hasWind: false,
    };
  }

  // Night 3 — Đảo Chuông
  const motePoints: Vec3Tuple[] = [];
  for (let i = 0; i < 18; i++) motePoints.push(pointOnRing(0, 0, 34, i * 20, 0));
  for (let i = 1; i <= 8; i++) motePoints.push(pointOnRing(0, 0, 18, i * 20, 3));
  for (const deg of [45, 135, 225, 315]) motePoints.push(pointOnRing(0, 0, 5, deg, 6));

  const shadePoints: Vec3Tuple[] = [];
  for (let i = 0; i < 16; i++) shadePoints.push(pointOnRing(0, 0, 43, i * 22.5, 0.8));

  return {
    night: 3,
    durationS: 360,
    spawnPos: [0, 0, 0],
    lanterns: buildLanternList([
      [0, 6, 6],
      [18, 3, 10],
      [-18, 3, 10],
      [35, 0, -10],
      [-35, 0, -10],
      [20, 0, -35],
      [-20, 0, -35],
    ]),
    motePoints,
    shadePoints,
    drifterPoints: [
      [25, 1.6, 25],
      [-25, 1.6, 25],
      [25, 1.6, -25],
      [-25, 1.6, -25],
    ],
    jumpPads: [
      {
        id: "JP1",
        pos: [0, 3, 13],
        radius: 1.0,
        vy: 12,
        vh: 8,
        dirXZ: [0, -1],
      },
    ],
    charms: [
      { id: "C1", pos: [30, 0, 25] },
      { id: "C2", pos: [-30, 0, 25] },
    ],
    shadeSpeed: 4.5,
    shadeMax: 10,
    shadeIntervalTicks: 360,
    hasWind: true,
  };
}

/** Returns ground elevation Y at `(x, z)` or `null` if over void. */
export function getGroundY(night: NightNumber, x: number, z: number): number | null {
  if (night === 1) {
    return Math.hypot(x, z) <= 40 + TIMER_EPS ? 0 : null;
  }

  if (night === 2) {
    if (Math.hypot(x, z) <= 28 + TIMER_EPS) return 0;
    if (Math.hypot(x - 70, z) <= 28 + TIMER_EPS) return 0;
    if (x >= 26 - TIMER_EPS && x <= 44 + TIMER_EPS && Math.abs(z) <= 2 + TIMER_EPS) {
      return 0;
    }
    return null;
  }

  // Night 3
  const r = Math.hypot(x, z);
  if (r <= 8 + TIMER_EPS) return 6;
  if (r >= 12 - TIMER_EPS && r <= 24 + TIMER_EPS && z > 0) return 3;

  for (const deg of NIGHT3_RAMPS_DEG) {
    const rad = (deg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const s = x * cosA + z * sinA;
    const w = -x * sinA + z * cosA;
    // Extend inner edge slightly to s=23.85 to seal chord gap at |w|=1.5 where r=24.047
    if (Math.abs(w) <= 1.5 + TIMER_EPS && s >= 23.85 && s <= 30.05) {
      const t = Math.max(0, Math.min(1, (30 - s) / 6));
      return t * 3;
    }
  }

  if (r <= 45 + TIMER_EPS) return 0;
  return null;
}

/** Pushes `(x, z)` outside the Night 3 center Bell Tower cylinder (`r = 2.0`). */
export function resolveBellTowerPush(
  night: NightNumber,
  x: number,
  y: number,
  z: number
): [number, number] {
  if (night !== 3 || y >= NIGHT3_TOWER_TOP_Y) return [x, z];
  const r = Math.hypot(x, z);
  if (r < NIGHT3_TOWER_RADIUS) {
    if (r <= TIMER_EPS) return [NIGHT3_TOWER_RADIUS + 0.001, 0];
    const scale = (NIGHT3_TOWER_RADIUS + 0.001) / r;
    return [x * scale, z * scale];
  }
  return [x, z];
}

function canStepTo(
  night: NightNumber,
  curY: number,
  nx: number,
  nz: number,
  maxStepUp: number,
  allowVoid: boolean
): boolean {
  const gy = getGroundY(night, nx, nz);
  if (gy === null) return allowVoid;
  return gy <= curY + maxStepUp;
}

/**
 * Resolves horizontal displacement against vertical cliffs, Night 3 Bell Tower,
 * and optional void edges (slides cleanly along curved or axis edges).
 */
export function moveHorizontalOnTerrain(
  night: NightNumber,
  pos: Vec3Tuple,
  dx: number,
  dz: number,
  maxStepUp = MAX_STEP_UP,
  allowVoid = true
): { x: number; z: number; blocked: boolean } {
  const tryMove = (candX: number, candZ: number): [number, number] | null => {
    const [tx, tz] = resolveBellTowerPush(night, candX, pos[1], candZ);
    if (!canStepTo(night, pos[1], tx, tz, maxStepUp, allowVoid)) return null;
    return [tx, tz];
  };

  const direct = tryMove(pos[0] + dx, pos[2] + dz);
  if (direct) return { x: direct[0], z: direct[1], blocked: false };

  // Slide along X or Z independently
  const slideX = Math.abs(dx) > TIMER_EPS ? tryMove(pos[0] + dx, pos[2]) : null;
  const slideZ = Math.abs(dz) > TIMER_EPS ? tryMove(pos[0], pos[2] + dz) : null;
  if (slideX && slideZ) {
    return Math.abs(dx) >= Math.abs(dz)
      ? { x: slideX[0], z: slideX[1], blocked: true }
      : { x: slideZ[0], z: slideZ[1], blocked: true };
  }
  if (slideX) return { x: slideX[0], z: slideX[1], blocked: true };
  if (slideZ) return { x: slideZ[0], z: slideZ[1], blocked: true };

  // Tangent slide around origin for curved Night 3 tiers
  const r = Math.hypot(pos[0], pos[2]);
  if (r > TIMER_EPS) {
    const tx = -pos[2] / r;
    const tz = pos[0] / r;
    const proj = dx * tx + dz * tz;
    if (Math.abs(proj) > TIMER_EPS) {
      const tangent = tryMove(pos[0] + tx * proj, pos[2] + tz * proj);
      if (tangent) return { x: tangent[0], z: tangent[1], blocked: true };
    }
  }

  const [stayX, stayZ] = resolveBellTowerPush(night, pos[0], pos[1], pos[2]);
  return { x: stayX, z: stayZ, blocked: true };
}

/** Snaps `(x, z)` to valid ground near `refY` (avoids Bell Tower & void). */
export function snapToValidGround(
  night: NightNumber,
  x: number,
  z: number,
  refY: number
): Vec3Tuple | null {
  const [px, pz] = resolveBellTowerPush(night, x, refY, z);
  const gy = getGroundY(night, px, pz);
  if (gy !== null && Math.abs(gy - refY) <= 1.5) {
    return [px, gy, pz];
  }
  return null;
}
