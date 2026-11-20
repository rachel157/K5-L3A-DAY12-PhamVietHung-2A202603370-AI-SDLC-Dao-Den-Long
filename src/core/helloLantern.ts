import { createSeededRng } from "./prng.js";

/** 3D position vector in world units. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Deterministic state snapshot of the Checkpoint 0 hello lantern. */
export interface LanternState {
  seed: number;
  tick: number;
  elapsedSec: number;
  position: Vec3;
  yawRad: number;
  glowIntensity: number;
}

const BASE_HEIGHT = 1.2;
const BOB_AMPLITUDE = 0.15;
const BOB_SPEED = 2.0;
const YAW_SPEED = 0.9;
const GLOW_BASE = 1.0;
const GLOW_AMPLITUDE = 0.3;
const GLOW_SPEED = 3.1;
const TAU = Math.PI * 2;

function roundCoord(value: number): number {
  return Number(value.toFixed(9));
}

function validateDt(dtSec: number): void {
  if (!Number.isFinite(dtSec) || dtSec <= 0) {
    throw new RangeError(`Expected positive finite dtSec, received ${dtSec}`);
  }
}

/** Creates the initial lantern state derived deterministically from seed. */
export function createInitialLanternState(seed: number): LanternState {
  const rng = createSeededRng(seed);
  const yawRad = roundCoord(rng() * TAU);
  return {
    seed: Math.trunc(seed),
    tick: 0,
    elapsedSec: 0,
    position: { x: 0, y: BASE_HEIGHT, z: 0 },
    yawRad,
    glowIntensity: GLOW_BASE,
  };
}

/** Advances the lantern simulation by a fixed timestep dtSec. */
export function stepLanternState(state: LanternState, dtSec = 1 / 60): LanternState {
  validateDt(dtSec);
  const elapsedSec = roundCoord(state.elapsedSec + dtSec);
  const y = roundCoord(BASE_HEIGHT + BOB_AMPLITUDE * Math.sin(elapsedSec * BOB_SPEED));
  const yawRad = roundCoord((state.yawRad + YAW_SPEED * dtSec) % TAU);
  const glowIntensity = roundCoord(GLOW_BASE + GLOW_AMPLITUDE * Math.sin(elapsedSec * GLOW_SPEED));

  return {
    seed: state.seed,
    tick: state.tick + 1,
    elapsedSec,
    position: { x: state.position.x, y, z: state.position.z },
    yawRad,
    glowIntensity,
  };
}

/** Runs a complete deterministic simulation for N ticks from a given seed. */
export function runLanternSimulation(seed: number, ticks: number, dtSec = 0.05): LanternState {
  if (!Number.isInteger(ticks) || ticks < 0) {
    throw new RangeError(`Expected non-negative integer ticks, received ${ticks}`);
  }
  validateDt(dtSec);

  let state = createInitialLanternState(seed);
  for (let i = 0; i < ticks; i++) {
    state = stepLanternState(state, dtSec);
  }
  return state;
}
