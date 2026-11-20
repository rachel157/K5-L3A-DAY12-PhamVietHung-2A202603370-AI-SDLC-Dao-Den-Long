import type * as THREE from "three";
import type { Vec3Tuple } from "../core/types.js";

export function applyShadeFacing(
  target: THREE.Object3D,
  shadePos: Vec3Tuple,
  playerPos: Vec3Tuple,
  isStunned: boolean,
  nowSec: number
): void;

export function handleControlKeyDown(
  event: Pick<KeyboardEvent, "code" | "preventDefault">,
  pressedKeys: Set<string>
): void;

export function bindHudActionButton(
  button: HTMLElement,
  onAction: () => void
): void;

export interface OffscreenArrowProjection {
  visible: boolean;
  x: number;
  y: number;
  angleDeg: number;
}

export function computeOffscreenLanternArrow(
  viewPos: Vec3Tuple,
  fovRad: number,
  aspect: number,
  width: number,
  height: number,
  margin?: number
): OffscreenArrowProjection;

export function applyPauseResumeAction<
  TWorld extends { state: string },
  TPatch extends Record<string, unknown>,
  TEvent
>(
  world: TWorld,
  action: "pause" | "resume",
  camYawDeg: number,
  stepWorld: (world: TWorld, patch: TPatch) => TEvent[],
  onEvents: (events: TEvent[]) => void
): string;

export interface LanternVisualState {
  scaleY: number;
  tearsVisible: boolean;
  fuelBarVisible: boolean;
  fuelRatio: number;
  safeRingVisible: boolean;
  blinking: boolean;
  blinkOn: boolean;
}

export function computeLanternVisualState(params: {
  lit: boolean;
  fuel: number;
  fuelMax: number;
  lowFuelThreshold: number;
  nowSec: number;
}): LanternVisualState;

export function formatColorblindAlert(text: string, colorblindMode: boolean): string;

export interface LowFuelHudStatus {
  hasWarning: boolean;
  weakCount: number;
  drainCount: number;
  badgeText: string | null;
}

export function getLowFuelHudStatus(
  lanterns: ReadonlyArray<{ lit: boolean; fuel: number }>,
  shades: ReadonlyArray<{ state: string }>,
  lowFuelThreshold: number
): LowFuelHudStatus;

export function computeBenchCameraPos(elapsedSec: number): Vec3Tuple;
