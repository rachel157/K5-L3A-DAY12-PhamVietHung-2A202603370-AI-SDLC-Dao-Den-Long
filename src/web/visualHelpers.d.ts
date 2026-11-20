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
