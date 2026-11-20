import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  applyShadeFacing,
  bindHudActionButton,
  handleControlKeyDown,
} from "../src/web/visualHelpers.js";

test("applyShadeFacing keeps shade upright on +Z half-plane for chase and stunned states", () => {
  const shadeObj = new THREE.Object3D();
  applyShadeFacing(shadeObj, [0, 0, 10], [0, 0, 0], false, 1.0);
  const upChase = new THREE.Vector3(0, 1, 0).applyEuler(shadeObj.rotation);
  assert.ok(upChase.y > 0.99, `expected upright shade on +Z chase, got up.y=${upChase.y}`);

  applyShadeFacing(shadeObj, [0, 0, 10], [0, 0, 0], true, 1.25);
  const upStunned = new THREE.Vector3(0, 1, 0).applyEuler(shadeObj.rotation);
  assert.ok(upStunned.y > 0.95, `expected upright shade on +Z stunned, got up.y=${upStunned.y}`);
});

test("handleControlKeyDown prevents default scrolling/button activation on Space and Arrows", () => {
  const spacePrevented = [];
  const wPrevented = [];
  const pressed = new Set();

  handleControlKeyDown(
    { code: "Space", repeat: false, preventDefault: () => spacePrevented.push(true) },
    pressed
  );
  handleControlKeyDown(
    { code: "ArrowUp", repeat: false, preventDefault: () => spacePrevented.push(true) },
    pressed
  );
  handleControlKeyDown(
    { code: "KeyW", repeat: false, preventDefault: () => wPrevented.push(true) },
    pressed
  );

  assert.equal(spacePrevented.length, 2);
  assert.equal(wPrevented.length, 0);
  assert.equal(pressed.has("Space"), true);
  assert.equal(pressed.has("KeyW"), true);
});

test("bindHudActionButton blurs button on click so Space does not re-trigger it", () => {
  let blurred = false;
  let clicked = false;
  const listeners = {};
  const fakeButton = {
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
    blur() {
      blurred = true;
    },
  };
  bindHudActionButton(fakeButton, () => {
    clicked = true;
  });
  listeners.click();
  assert.equal(clicked, true);
  assert.equal(blurred, true);
});
