import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_KEYBINDS,
  DEFAULT_SETTINGS,
  findDuplicateKeybind,
  loadSettings,
  saveSettings,
} from "../dist-cli/web/settings.js";
import { createGameWorld, stepGameWorld } from "../dist-cli/core/game.js";
import {
  applyPauseResumeAction,
  buildAccessibilitySubtitle,
  computeLanternVisualState,
  computeOffscreenLanternArrow,
  formatColorblindAlert,
  getLowFuelHudStatus,
} from "../src/web/visualHelpers.js";

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

test("loadSettings returns defaults and saves/restores volume, mouseSensitivity, and colorblindMode cleanly", () => {
  const storage = createFakeStorage();
  assert.deepEqual(loadSettings(storage), {
    ...DEFAULT_SETTINGS,
    colorblindMode: false,
  });

  const saved = saveSettings({ volume: 0.35, mouseSensitivity: 1.8, colorblindMode: true }, storage);
  assert.deepEqual(saved, {
    ...DEFAULT_SETTINGS,
    volume: 0.35,
    mouseSensitivity: 1.8,
    colorblindMode: true,
  });
  assert.deepEqual(loadSettings(storage), {
    ...DEFAULT_SETTINGS,
    volume: 0.35,
    mouseSensitivity: 1.8,
    colorblindMode: true,
  });

  const toggledOff = saveSettings({ volume: 0.35, mouseSensitivity: 1.8, colorblindMode: false }, storage);
  assert.equal(toggledOff.colorblindMode, false);
  assert.equal(loadSettings(storage).colorblindMode, false);

  // Clamping & corrupt JSON fallback
  saveSettings({ volume: 5, mouseSensitivity: 0.01 }, storage);
  const clamped = loadSettings(storage);
  assert.equal(clamped.volume, 1);
  assert.equal(clamped.mouseSensitivity, 0.2);
  assert.equal(clamped.colorblindMode, false);

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

test("applyPauseResumeAction zeroes stale inputs and surfaces game_over without softlock", () => {
  const world = createGameWorld({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      time_left_s: 1 / 60,
    },
  });
  // Pause after holding forward move
  stepGameWorld(world, { move: [0, 1], interact: true, pause: true });
  stepGameWorld(world, { pause: false });
  assert.equal(world.state, "paused");

  const collected = [];
  const nextState = applyPauseResumeAction(world, "resume", 0, stepGameWorld, (events) => {
    for (const ev of events) collected.push(ev);
  });

  assert.equal(world.player.pos[2], 0, "resuming must zero stale move inputs");
  assert.ok(collected.some((e) => e.name === "resumed"));
  assert.ok(collected.some((e) => e.name === "game_over"), "dawn on resume tick must emit game_over");
  assert.equal(nextState, "lost");

  // Rapid sub-frame pause -> resume -> pause (no intervening frame()) clears pause latch cleanly
  const world2 = createGameWorld({
    seed: 1,
    night: 1,
    scenario: { random_motes: false, random_shades: false },
  });
  const evs2 = [];
  assert.equal(applyPauseResumeAction(world2, "pause", 0, stepGameWorld, (e) => evs2.push(...e)), "paused");
  assert.equal(applyPauseResumeAction(world2, "resume", 0, stepGameWorld, (e) => evs2.push(...e)), "playing");
  assert.equal(applyPauseResumeAction(world2, "pause", 0, stepGameWorld, (e) => evs2.push(...e)), "paused");
});

test("computeLanternVisualState and formatColorblindAlert reflect squash/tears, 1Hz blink <30, safe ring at 30, and warning prefix", () => {
  const unlit = computeLanternVisualState({
    lit: false,
    fuel: 0,
    fuelMax: 100,
    lowFuelThreshold: 30,
    nowSec: 0.2,
  });
  assert.equal(unlit.scaleY, 0.8);
  assert.equal(unlit.tearsVisible, true);
  assert.equal(unlit.fuelBarVisible, false);
  assert.equal(unlit.safeRingVisible, false);
  assert.equal(unlit.blinking, false);

  const safeBoundary = computeLanternVisualState({
    lit: true,
    fuel: 30,
    fuelMax: 100,
    lowFuelThreshold: 30,
    nowSec: 0.7,
  });
  assert.equal(safeBoundary.scaleY, 1);
  assert.equal(safeBoundary.tearsVisible, false);
  assert.equal(safeBoundary.fuelBarVisible, true);
  assert.equal(safeBoundary.safeRingVisible, true);
  assert.equal(safeBoundary.blinking, false);
  assert.equal(safeBoundary.fuelRatio, 0.3);

  const lowHi = computeLanternVisualState({
    lit: true,
    fuel: 29.9,
    fuelMax: 100,
    lowFuelThreshold: 30,
    nowSec: 0.2,
  });
  const lowLo = computeLanternVisualState({
    lit: true,
    fuel: 29.9,
    fuelMax: 100,
    lowFuelThreshold: 30,
    nowSec: 0.7,
  });
  assert.equal(lowHi.safeRingVisible, false);
  assert.equal(lowHi.blinking, true);
  assert.equal(lowHi.blinkOn, true);
  assert.equal(lowLo.blinkOn, false);

  assert.equal(formatColorblindAlert("Đèn L1 cạn dầu!", false), "Đèn L1 cạn dầu!");
  assert.equal(formatColorblindAlert("Đèn L1 cạn dầu!", true), "⚠ Đèn L1 cạn dầu!");
  assert.equal(formatColorblindAlert("⚠ Đã cảnh báo", true), "⚠ Đã cảnh báo");
});

test("getLowFuelHudStatus triggers ⚠ warning on passive <30 fuel or active drain, and index.html colorblind overrides --crimson", () => {
  const safe = getLowFuelHudStatus(
    [
      { lit: true, fuel: 30 },
      { lit: false, fuel: 0 },
    ],
    [{ state: "chase" }],
    30
  );
  assert.equal(safe.hasWarning, false);
  assert.equal(safe.badgeText, null);

  const passiveWeak = getLowFuelHudStatus(
    [
      { lit: true, fuel: 29.5 },
      { lit: true, fuel: 80 },
    ],
    [{ state: "wander" }],
    30
  );
  assert.equal(passiveWeak.hasWarning, true);
  assert.equal(passiveWeak.weakCount, 1);
  assert.equal(passiveWeak.drainCount, 0);
  assert.ok(passiveWeak.badgeText?.startsWith("⚠"));

  const draining = getLowFuelHudStatus(
    [{ lit: true, fuel: 15 }],
    [{ state: "drain" }, { state: "chase" }],
    30
  );
  assert.equal(draining.hasWarning, true);
  assert.equal(draining.drainCount, 1);
  assert.ok(draining.badgeText?.startsWith("⚠"));

  const html = fs.readFileSync(path.resolve("index.html"), "utf8");
  assert.match(html, /body\.colorblind\s*\{[^}]*--crimson:\s*#ffffff/i);
  assert.match(html, /id="hud-fuel-pill"/);
});

test("Phase 4 accessibility: keybinds, duplicate detection, reduceMotion, largeText, subtitles, and >=18px CSS", () => {
  const storage = createFakeStorage();
  const def = loadSettings(storage);
  assert.equal(def.reduceMotion, false);
  assert.equal(def.largeText, false);
  assert.deepEqual(def.keybinds, DEFAULT_KEYBINDS);

  assert.equal(findDuplicateKeybind(DEFAULT_KEYBINDS, "jump", "KeyE"), "interact");
  assert.equal(findDuplicateKeybind(DEFAULT_KEYBINDS, "jump", "Space"), null);
  assert.equal(findDuplicateKeybind(DEFAULT_KEYBINDS, "jump", "KeyZ"), null);

  const saved = saveSettings(
    {
      reduceMotion: true,
      largeText: true,
      keybinds: { ...DEFAULT_KEYBINDS, interact: "KeyG" },
    },
    storage
  );
  assert.equal(saved.reduceMotion, true);
  assert.equal(saved.largeText, true);
  assert.equal(saved.keybinds.interact, "KeyG");
  assert.equal(loadSettings(storage).keybinds.interact, "KeyG");

  const sub = buildAccessibilitySubtitle({
    shadeSpawnActive: true,
    windWarning: true,
    timeLeftSec: 8,
    weakLanternCount: 1,
  });
  assert.ok(sub.includes("Bóng Mực"));
  assert.ok(sub.includes("Gió"));
  assert.ok(sub.includes("10s") || sub.includes("8s"));
  assert.ok(sub.includes("30"));

  const html = fs.readFileSync(path.resolve("index.html"), "utf8");
  assert.match(html, /body\.large-text\s*\{[^}]*--font-scale:\s*1\.25/);
  assert.match(html, /body\.reduce-motion/);
  assert.match(html, /id="subtitle-box"/);
  assert.match(html, /id="shade-arrow"/);

  // Every explicit px font-size in index.html must be >= 18px
  const fontMatches = [...html.matchAll(/font-size:\s*(?:calc\()?([0-9]+(?:\.[0-9]+)?)px/g)];
  assert.ok(fontMatches.length > 0);
  for (const m of fontMatches) {
    assert.ok(Number(m[1]) >= 18, `Found font-size < 18px in index.html: ${m[0]}`);
  }
});
