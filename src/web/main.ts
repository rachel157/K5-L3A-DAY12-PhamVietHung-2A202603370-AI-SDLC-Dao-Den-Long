import * as THREE from "three";
import { DT_SEC, TICKS_PER_SEC } from "../core/contract.js";
import { createGameWorld, stepGameWorld, toSnapshot } from "../core/game.js";
import type { GameEvent, GameWorld, NightNumber } from "../core/types.js";
import { GameAudio } from "./audio.js";
import { loadSettings, saveSettings } from "./settings.js";
import { GameUI, NIGHT_METADATA } from "./ui.js";
import {
  computeOffscreenLanternArrow,
  handleControlKeyDown,
} from "./visualHelpers.js";
import { WorldSceneRenderer } from "./worldScene.js";

function findInteractTargetDeposited(world: GameWorld): number | null {
  const px = world.player.pos[0];
  const py = world.player.pos[1];
  const pz = world.player.pos[2];
  let bestDist = Infinity;
  let bestDeposited: number | null = null;
  for (const lantern of world.lanterns) {
    if (lantern.lit) continue;
    const dx = lantern.pos[0] - px;
    const dz = lantern.pos[2] - pz;
    const dy = Math.abs(lantern.pos[1] - py);
    const distXZ = Math.hypot(dx, dz);
    if (distXZ <= world.tuning.interact_radius && dy <= 1.5 && distXZ < bestDist) {
      bestDist = distXZ;
      bestDeposited = lantern.deposited;
    }
  }
  return bestDeposited;
}

function findNearestUnlitLanternPos(world: GameWorld): [number, number, number] | null {
  const [px, py, pz] = world.player.pos;
  let bestDist = Infinity;
  let bestPos: [number, number, number] | null = null;
  for (const lantern of world.lanterns) {
    if (lantern.lit) continue;
    const d = Math.hypot(lantern.pos[0] - px, lantern.pos[1] - py, lantern.pos[2] - pz);
    if (d < bestDist) {
      bestDist = d;
      bestPos = [lantern.pos[0], lantern.pos[1] + 2.5, lantern.pos[2]];
    }
  }
  return bestPos;
}

function startApp(): void {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (err) {
    const title = document.getElementById("modal-title");
    const body = document.getElementById("modal-body");
    if (title) title.textContent = "Không thể khởi tạo WebGL";
    if (body) body.textContent = err instanceof Error ? err.message : String(err);
    return;
  }

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    220
  );
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);

  const worldRenderer = new WorldSceneRenderer();
  let settings = loadSettings();
  const audio = new GameAudio(settings.volume);

  let currentNight: NightNumber = 1;
  let currentSeed = 1;
  let totalCampaignScore = 0;
  let world = createGameWorld({ seed: currentSeed, night: currentNight });
  worldRenderer.rebuildForWorld(world);

  let camYawDeg = 0;
  let dragging = false;
  let lastMouseX = 0;
  let screenMode: "menu" | "intro" | "playing" | "paused" | "result" = "menu";
  let resultShown = false;
  let lastCountdownSec = -1;
  const pressedKeys = new Set<string>();
  const tmpVec = new THREE.Vector3();

  function clearInputs(): void {
    pressedKeys.clear();
    dragging = false;
  }

  function prepareNightIntro(night: NightNumber, resetCampaignScore: boolean): void {
    if (resetCampaignScore) totalCampaignScore = 0;
    currentNight = night;
    currentSeed += 1;
    world = createGameWorld({ seed: currentSeed, night: currentNight });
    worldRenderer.rebuildForWorld(world);
    camYawDeg = 0;
    resultShown = false;
    lastCountdownSec = -1;
    clearInputs();
    screenMode = "intro";
    audio.stopBgm();
    ui.showNightIntro(currentNight, totalCampaignScore);
  }

  function beginActiveNight(): void {
    screenMode = "playing";
    clearInputs();
    audio.unlock();
    audio.startBgm();
    ui.showPlaying();
    ui.showBanner(`${NIGHT_METADATA[currentNight].title} — Hãy thắp sáng ${world.lanterns.length} Đèn Lồng!`);
  }

  function togglePause(): void {
    if (screenMode === "playing" && world.state === "playing") {
      stepGameWorld(world, { pause: true });
      stepGameWorld(world, { pause: false });
      screenMode = "paused";
      clearInputs();
      audio.stopBgm();
      ui.showPause();
    } else if (screenMode === "paused" && world.state === "paused") {
      stepGameWorld(world, { pause: true });
      stepGameWorld(world, { pause: false });
      screenMode = "playing";
      clearInputs();
      audio.unlock();
      audio.startBgm();
      ui.showPlaying();
    }
  }

  const ui = new GameUI(settings, {
    onStartCampaign: (night) => prepareNightIntro(night, night === 1),
    onStartNightFromIntro: beginActiveNight,
    onResume: () => togglePause(),
    onPauseRequest: () => togglePause(),
    onRestartNight: () => prepareNightIntro(currentNight, false),
    onNextNight: () => {
      const next = (Math.min(3, currentNight + 1) as NightNumber);
      prepareNightIntro(next, false);
    },
    onReturnMenu: () => {
      screenMode = "menu";
      clearInputs();
      audio.stopBgm();
      ui.showMainMenu();
    },
    onToggleMute: () => {
      const muted = audio.toggleMute();
      ui.setMuteLabel(muted);
      if (!muted && screenMode === "playing") {
        audio.unlock();
        audio.startBgm();
      }
    },
    onChangeSettings: (next) => {
      settings = saveSettings(next);
      audio.setVolume(settings.volume);
    },
  });

  ui.setMuteLabel(audio.isMuted());
  ui.showMainMenu();

  function handleGameEvents(events: GameEvent[]): void {
    for (const ev of events) {
      if (ev.name === "mote_picked") {
        audio.playPickup(ev.data.carried);
      } else if (ev.name === "charm_picked") {
        audio.playCharmPicked();
        ui.showBanner("Nhặt Bùa Gió! Tăng tốc & lướt không hồi chiêu (10s)");
      } else if (ev.name === "deposit") {
        audio.playDeposit();
      } else if (ev.name === "lantern_lit") {
        audio.playLanternLit();
        ui.showBanner(`Đã thắp sáng Đèn Lồng ${ev.data.lantern_id}!`);
      } else if (ev.name === "pulse") {
        audio.playPulse();
        worldRenderer.spawnPulseWave(
          world.player.pos[0],
          world.player.pos[1],
          world.player.pos[2]
        );
        if (ev.data.stunned_ids.length > 0) {
          ui.showBanner(`Tỏa sáng đẩy lùi ${ev.data.stunned_ids.length} Bóng Mực!`);
        }
      } else if (ev.name === "dash") {
        audio.playDash();
      } else if (ev.name === "shade_spawned") {
        audio.playShadeSpawn();
        ui.showBanner("Bóng Mực vừa xuất hiện trong sương!");
      } else if (ev.name === "drifter_steal") {
        audio.playDrifterSteal();
        ui.showBanner(`Gió Lạc vừa cướp ${ev.data.amount} đom đóm! Hãy Tỏa Sáng để lấy lại!`);
      } else if (ev.name === "player_hit") {
        audio.playHit();
        ui.showBanner(
          ev.data.by === "fall"
            ? "Rơi xuống biển mây! Đang hồi sinh..."
            : "Bị Bóng Mực chạm phải!"
        );
      } else if (ev.name === "game_over" && !resultShown) {
        resultShown = true;
        screenMode = "result";
        clearInputs();
        audio.stopBgm();
        if (ev.data.result === "won") {
          totalCampaignScore += world.score;
          audio.playWin();
        } else {
          audio.playLoss();
        }
        ui.showResult({
          night: currentNight,
          won: ev.data.result === "won",
          reason: ev.data.reason,
          nightScore: world.score,
          totalScore: totalCampaignScore,
          lanternsLit: world.lanterns.filter((l) => l.lit).length,
          lanternsTotal: world.lanterns.length,
        });
      }
    }
  }

  window.addEventListener("keydown", (e) => {
    audio.unlock();
    if (!e.repeat && (e.code === "Escape" || e.code === "KeyP")) {
      if (screenMode === "playing" || screenMode === "paused") {
        e.preventDefault();
        togglePause();
        return;
      }
    }
    if (!e.repeat && e.code === "KeyM") {
      const muted = audio.toggleMute();
      ui.setMuteLabel(muted);
      if (!muted && screenMode === "playing") audio.startBgm();
      return;
    }
    if (screenMode !== "playing") return;
    handleControlKeyDown(e, pressedKeys);
  });

  window.addEventListener("keyup", (e) => {
    pressedKeys.delete(e.code);
  });

  window.addEventListener("blur", clearInputs);

  window.addEventListener("mousedown", (e) => {
    if (screenMode !== "playing") return;
    audio.unlock();
    if (e.button === 0) {
      dragging = true;
      lastMouseX = e.clientX;
    } else if (e.button === 2) {
      pressedKeys.add("MouseRightDash");
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) dragging = false;
    if (e.button === 2) pressedKeys.delete("MouseRightDash");
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging || screenMode !== "playing") return;
    const dx = e.clientX - lastMouseX;
    lastMouseX = e.clientX;
    camYawDeg = (camYawDeg - dx * 0.35 * settings.mouseSensitivity) % 360;
  });

  window.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let accumulator = 0;
  let lastMs = performance.now();

  function frame(nowMs: number): void {
    const dtFrame = Math.min((nowMs - lastMs) / 1000, 0.1);
    lastMs = nowMs;

    if (screenMode === "playing") {
      if (pressedKeys.has("KeyQ")) camYawDeg = (camYawDeg + 110 * dtFrame) % 360;
      if (pressedKeys.has("KeyC")) camYawDeg = (camYawDeg - 110 * dtFrame) % 360;

      let moveX = 0;
      let moveZ = 0;
      if (pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp")) moveZ += 1;
      if (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown")) moveZ -= 1;
      if (pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft")) moveX += 1;
      if (pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight")) moveX -= 1;

      const jump = pressedKeys.has("Space");
      const dash =
        pressedKeys.has("ShiftLeft") ||
        pressedKeys.has("ShiftRight") ||
        pressedKeys.has("MouseRightDash");
      const interact = pressedKeys.has("KeyE");
      const pulse = pressedKeys.has("KeyR") || pressedKeys.has("KeyF");

      accumulator += dtFrame;
      while (accumulator >= DT_SEC) {
        if (world.state === "playing") {
          const wasGrounded = world.player.grounded;
          const events = stepGameWorld(world, {
            move: [moveX, moveZ],
            cam_yaw_deg: camYawDeg,
            jump,
            dash,
            interact,
            pulse,
            pause: false,
          });
          if (wasGrounded && !world.player.grounded && world.player.vel[1] > 5) {
            audio.playJump();
          }
          handleGameEvents(events);
        }
        accumulator -= DT_SEC;
      }

      const secLeft = Math.ceil(world.timeLeftTicks / TICKS_PER_SEC);
      if (world.state === "playing" && secLeft >= 1 && secLeft <= 10 && secLeft !== lastCountdownSec) {
        lastCountdownSec = secLeft;
        audio.playCountdownTick();
      }
    } else {
      accumulator = 0;
    }

    const theta = (camYawDeg * Math.PI) / 180;
    const camDist = 9.4;
    const camHeight = 5.5;
    const targetCamPos = new THREE.Vector3(
      world.player.pos[0] - Math.sin(theta) * camDist,
      world.player.pos[1] + camHeight,
      world.player.pos[2] - Math.cos(theta) * camDist
    );
    camera.position.lerp(targetCamPos, screenMode === "menu" ? 0.05 : 0.18);
    camera.lookAt(world.player.pos[0], world.player.pos[1] + 1.15, world.player.pos[2]);
    camera.updateMatrixWorld();

    worldRenderer.sync(world, nowMs / 1000, dtFrame);

    let nearestArrow = { visible: false, x: 0, y: 0, angleDeg: 0 };
    const nearestUnlitPos = findNearestUnlitLanternPos(world);
    if (nearestUnlitPos && screenMode === "playing") {
      tmpVec.set(nearestUnlitPos[0], nearestUnlitPos[1], nearestUnlitPos[2]);
      tmpVec.applyMatrix4(camera.matrixWorldInverse);
      nearestArrow = computeOffscreenLanternArrow(
        [tmpVec.x, tmpVec.y, tmpVec.z],
        THREE.MathUtils.degToRad(camera.fov),
        camera.aspect,
        window.innerWidth,
        window.innerHeight
      );
    }

    ui.updateHud(toSnapshot(world), {
      nearestUnlitDeposited: findInteractTargetDeposited(world),
      nearestArrow,
      windWarning: world.wind.enabled && world.wind.warning,
      windActive: world.wind.enabled && world.wind.active,
      windDirDeg: world.wind.dirDeg,
      totalScore: totalCampaignScore,
    });

    renderer.render(worldRenderer.scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

startApp();
