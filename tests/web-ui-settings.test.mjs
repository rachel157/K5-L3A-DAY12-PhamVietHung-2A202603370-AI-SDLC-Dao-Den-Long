import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from "../dist-cli/web/settings.js";
import { computeOffscreenLanternArrow } from "../src/web/visualHelpers.js";

function createFakeStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
  };
}

test("loadSettings returns defaults and saves/restores volume and mouseSensitivity cleanly", () => {
  const storage = createFakeStorage();
  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS);

  const saved = saveSettings({ volume: 0.35, mouseSensitivity: 1.8 }, storage);
  assert.deepEqual(saved, { volume: 0.35, mouseSensitivity: 1.8 });
  assert.deepEqual(loadSettings(storage), { volume: 0.35, mouseSensitivity: 1.8 });

  // Clamping & corrupt JSON fallback
  saveSettings({ volume: 5, mouseSensitivity: 0.01 }, storage);
  const clamped = loadSettings(storage);
  assert.equal(clamped.volume, 1);
  assert.equal(clamped.mouseSensitivity, 0.2);

  storage.setItem("dao-den-long:settings:v1", "{bad-json");
  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS);
});

test("computeOffscreenLanternArrow hides arrow on screen and clamps/rotates correctly off screen or behind", () => {
  const fovRad = (55 * Math.PI) / 180;
  const aspect = 1280 / 720;

  // Directly in front inside viewport -> hidden
  const inView = computeOffscreenLanternArrow([0, 0, -10], fovRad, aspect, 1280, 720, 48);
  assert.equal(inView.visible, false);

  // Far right off-screen -> clamped on right edge pointing right (~0 deg)
  const offRight = computeOffscreenLanternArrow([20, 0, -5], fovRad, aspect, 1280, 720, 48);
  assert.equal(offRight.visible, true);
  assert.equal(Math.round(offRight.x), 1280 - 48);
  assert.equal(Math.round(offRight.y), 360);
  assert.ok(Math.abs(offRight.angleDeg) < 1);

  // Behind camera to the left (vz > 0, vx < 0) -> clamped on left edge pointing left (180 or -180 deg)
  const behindLeft = computeOffscreenLanternArrow([-8, 0, 6], fovRad, aspect, 1280, 720, 48);
  assert.equal(behindLeft.visible, true);
  assert.equal(Math.round(behindLeft.x), 48);
  assert.ok(Math.abs(Math.abs(behindLeft.angleDeg) - 180) < 1);
});
