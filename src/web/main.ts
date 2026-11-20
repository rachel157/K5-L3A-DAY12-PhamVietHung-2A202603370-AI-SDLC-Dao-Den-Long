import * as THREE from "three";
import {
  DEFAULT_TUNING,
  DT_SEC,
  ISLAND_RADIUS,
} from "../core/contract.js";
import {
  createGameWorld,
  stepGameWorld,
} from "../core/game.js";
import type { GameEvent, GameWorld } from "../core/types.js";
import { GameAudio } from "./audio.js";

interface LanternVisual {
  group: THREE.Group;
  coreMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  safeRing: THREE.Mesh;
}

interface PulseWave {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  maxAge: number;
}

function buildIslandEnvironment(scene: THREE.Scene) {
  const ambient = new THREE.AmbientLight(0x2d3559, 0.55);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x4f64a8, 0x161224, 0.5);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0xa3b9ff, 0.45);
  moon.position.set(-18, 28, -14);
  scene.add(moon);

  // Dark sea of clouds below the island
  const cloudSea = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({ color: 0x090d1b, roughness: 0.95 })
  );
  cloudSea.rotation.x = -Math.PI / 2;
  cloudSea.position.y = -0.65;
  scene.add(cloudSea);

  // Circular Đảo Bến ground (Y = 0)
  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS + 2.5, 1.2, 64),
    new THREE.MeshStandardMaterial({ color: 0x1c2536, roughness: 0.92 })
  );
  island.position.y = -0.6;
  scene.add(island);

  // Subtle central stone plaza ring
  const plaza = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.1, 48),
    new THREE.MeshBasicMaterial({ color: 0x3b486b, side: THREE.DoubleSide })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  scene.add(plaza);

  // Visual shore rocks around edge (purely decorative)
  const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x262d40, roughness: 0.95 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.15;
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(Math.cos(a) * (ISLAND_RADIUS - 0.6), 0.15, Math.sin(a) * (ISLAND_RADIUS - 0.6));
    rock.scale.set(1 + (i % 3) * 0.35, 0.7 + (i % 2) * 0.3, 1);
    rock.rotation.y = a;
    scene.add(rock);
  }

  return { ambient, hemi, moon };
}

function buildMayCharacter(scene: THREE.Scene) {
  const root = new THREE.Group();

  // Cloak / body
  const cloak = new THREE.Mesh(
    new THREE.ConeGeometry(0.38, 0.95, 14),
    new THREE.MeshStandardMaterial({ color: 0x2d6b78, roughness: 0.75 })
  );
  cloak.position.y = 0.48;
  root.add(cloak);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xf4cfa8, roughness: 0.65 })
  );
  head.position.y = 1.08;
  root.add(head);

  // Nón lá (traditional conical hat)
  const nonLa = new THREE.Mesh(
    new THREE.ConeGeometry(0.48, 0.25, 24),
    new THREE.MeshStandardMaterial({ color: 0xd9b36c, roughness: 0.85, side: THREE.DoubleSide })
  );
  nonLa.position.y = 1.28;
  root.add(nonLa);

  // Small hanging lantern attached to the rim of Mây's nón lá (+Z forward)
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.24, 6),
    new THREE.MeshBasicMaterial({ color: 0x4d3623 })
  );
  cord.position.set(0, 1.08, 0.44);
  root.add(cord);

  const smallLantern = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.11, 1),
    new THREE.MeshStandardMaterial({
      color: 0xffd27a,
      emissive: 0xff9a2e,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    })
  );
  smallLantern.position.set(0, 0.92, 0.44);
  root.add(smallLantern);

  const playerLight = new THREE.PointLight(0xffb454, 2.4, 11, 1.5);
  playerLight.position.set(0, 1.0, 0.44);
  root.add(playerLight);

  // Orbiting carried fireflies around Mây (max carry_capacity)
  const carriedOrbs: THREE.Mesh[] = [];
  const orbGeo = new THREE.SphereGeometry(0.08, 10, 10);
  const orbMat = new THREE.MeshBasicMaterial({ color: 0xffd97d });
  for (let i = 0; i < DEFAULT_TUNING.carry_capacity; i++) {
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.visible = false;
    root.add(orb);
    carriedOrbs.push(orb);
  }

  scene.add(root);
  return { root, smallLantern, playerLight, carriedOrbs };
}

function buildLanternVisuals(scene: THREE.Scene, world: GameWorld): Map<string, LanternVisual> {
  const map = new Map<string, LanternVisual>();
  for (const lantern of world.lanterns) {
    const group = new THREE.Group();
    group.position.set(lantern.pos[0], 0, lantern.pos[2]);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.85, 0.55, 12),
      new THREE.MeshStandardMaterial({ color: 0x393d54, roughness: 0.9 })
    );
    base.position.y = 0.275;
    group.add(base);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.2, 2.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x3f332c, roughness: 0.85 })
    );
    pillar.position.y = 1.45;
    group.add(pillar);

    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x625a7a,
      emissive: 0x261d3a,
      emissiveIntensity: 0.35,
      roughness: 0.3,
    });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 1), coreMat);
    core.position.y = 2.65;
    group.add(core);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 0.45, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a2433, roughness: 0.85 })
    );
    roof.position.y = 3.25;
    group.add(roof);

    const light = new THREE.PointLight(0xffad42, 0, 18, 1.4);
    light.position.y = 2.65;
    group.add(light);

    const safeRing = new THREE.Mesh(
      new THREE.RingGeometry(DEFAULT_TUNING.safe_radius - 0.12, DEFAULT_TUNING.safe_radius, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffc66e,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      })
    );
    safeRing.rotation.x = -Math.PI / 2;
    safeRing.position.y = 0.03;
    safeRing.visible = false;
    group.add(safeRing);

    scene.add(group);
    map.set(lantern.id, { group, coreMat, light, safeRing });
  }
  return map;
}

function createMoteMesh(): THREE.Group {
  const g = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffda75 })
  );
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff9f2e, transparent: true, opacity: 0.35 })
  );
  g.add(sphere);
  g.add(halo);
  return g;
}

function createShadeMesh(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x160a24,
    emissive: 0x2c0d45,
    emissiveIntensity: 0.6,
    roughness: 0.5,
  });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 12), bodyMat);
  body.position.y = 0.75;
  g.add(body);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd94fff });
  const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.14, 1.05, 0.32);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.14, 1.05, 0.32);
  g.add(leftEye, rightEye);

  g.userData = { bodyMat, eyeMat };
  return g;
}

function formatTime(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function start(): void {
  const hudFlames = document.getElementById("hud-flames")!;
  const hudCarried = document.getElementById("hud-carried")!;
  const hudLanterns = document.getElementById("hud-lanterns")!;
  const hudTime = document.getElementById("hud-time")!;
  const hudScore = document.getElementById("hud-score")!;
  const hudPulse = document.getElementById("hud-pulse")!;
  const banner = document.getElementById("status-banner")!;
  const overlay = document.getElementById("overlay")!;
  const modalTitle = document.getElementById("modal-title")!;
  const modalBody = document.getElementById("modal-body")!;
  const btnMute = document.getElementById("btn-mute")!;
  const btnRestartHud = document.getElementById("btn-restart-hud")!;
  const btnPlayAgain = document.getElementById("btn-play-again")!;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (err) {
    hudPulse.textContent = "Lỗi WebGL";
    modalTitle.textContent = "Không thể khởi tạo WebGL";
    modalBody.textContent = err instanceof Error ? err.message : String(err);
    overlay.classList.add("open");
    return;
  }

  const scene = new THREE.Scene();
  const nightSky = new THREE.Color(0x090c1a);
  const dawnSky = new THREE.Color(0x26213d);
  scene.background = nightSky.clone();
  const fog = new THREE.FogExp2(0x090c1a, 0.024);
  scene.fog = fog;

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    180
  );
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);

  const envLights = buildIslandEnvironment(scene);
  const may = buildMayCharacter(scene);
  const audio = new GameAudio();

  let currentSeed = 1;
  let world = createGameWorld({ seed: currentSeed });
  const lanternVisuals = buildLanternVisuals(scene, world);
  const moteMeshes = new Map<string, THREE.Group>();
  const shadeMeshes = new Map<string, THREE.Group>();
  const pulseWaves: PulseWave[] = [];

  let camYawDeg = 0;
  let dragging = false;
  let lastMouseX = 0;
  let bannerTimer = 0;
  let endSoundPlayed = false;
  const pressedKeys = new Set<string>();

  function showBanner(text: string): void {
    banner.textContent = text;
    banner.classList.add("visible");
    bannerTimer = 2.4;
  }

  function clearDynamicMeshes(): void {
    for (const mesh of moteMeshes.values()) scene.remove(mesh);
    moteMeshes.clear();
    for (const mesh of shadeMeshes.values()) scene.remove(mesh);
    shadeMeshes.clear();
  }

  function restartGame(): void {
    currentSeed += 1;
    clearDynamicMeshes();
    world = createGameWorld({ seed: currentSeed });
    endSoundPlayed = false;
    overlay.classList.remove("open");
    showBanner(`Đêm 1 bắt đầu (seed #${currentSeed}) — Hãy thắp sáng 5 Đèn Lồng!`);
  }

  function spawnPulseWave(x: number, z: number): void {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffcf70,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.8, 48), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.12, z);
    scene.add(mesh);
    pulseWaves.push({ mesh, mat, age: 0, maxAge: 0.55 });
  }

  function handleEvents(events: GameEvent[]): void {
    for (const ev of events) {
      if (ev.name === "mote_picked") {
        audio.playPickup(ev.data.carried);
      } else if (ev.name === "deposit") {
        audio.playDeposit();
      } else if (ev.name === "lantern_lit") {
        audio.playLanternLit();
        showBanner(`Đã thắp sáng Đèn Lồng ${ev.data.lantern_id}!`);
      } else if (ev.name === "pulse") {
        audio.playPulse();
        spawnPulseWave(world.player.pos[0], world.player.pos[2]);
        if (ev.data.stunned_ids.length > 0) {
          showBanner(`Tỏa sáng đẩy lùi ${ev.data.stunned_ids.length} Bóng Mực!`);
        }
      } else if (ev.name === "player_hit") {
        audio.playHit();
        showBanner("Bị Bóng Mực chạm phải! Cẩn thận!");
      } else if (ev.name === "game_over" && !endSoundPlayed) {
        endSoundPlayed = true;
        if (ev.data.result === "won") {
          audio.playWin();
          modalTitle.textContent = "Ánh sáng đã trở lại!";
          modalBody.textContent = `Bạn đã thắp sáng cả 5 Đèn Lồng Lớn trên Đảo Bến. Điểm cuối: ${world.score}`;
        } else {
          audio.playLoss();
          modalTitle.textContent = "Đêm tối nuốt chửng...";
          const reasonText =
            ev.data.reason === "dawn"
              ? "Đã hết thời gian của Đêm 1 trước khi thắp đủ đèn."
              : "Mây đã tắt hết ngọn lửa hộ thân.";
          modalBody.textContent = `${reasonText} Điểm cuối: ${world.score}`;
        }
        overlay.classList.add("open");
      }
    }
  }

  function syncVisuals(nowSec: number, dtFrame: number): void {
    // Player Mây transform & hanging lantern sway
    may.root.position.set(world.player.pos[0], world.player.pos[1], world.player.pos[2]);
    const theta = (camYawDeg * Math.PI) / 180;
    may.root.rotation.y = theta;
    may.smallLantern.position.x = Math.sin(nowSec * 3.5) * 0.04;
    may.playerLight.intensity = world.player.invulnTimer > 0 && Math.floor(nowSec * 12) % 2 === 0 ? 0.6 : 2.4;

    for (let i = 0; i < may.carriedOrbs.length; i++) {
      const orb = may.carriedOrbs[i]!;
      orb.visible = i < world.player.carried;
      if (orb.visible) {
        const angle = nowSec * 2.4 + (i * Math.PI * 2) / Math.max(1, world.player.carried);
        orb.position.set(Math.cos(angle) * 0.68, 0.85 + Math.sin(nowSec * 4 + i) * 0.12, Math.sin(angle) * 0.68);
      }
    }

    // Lanterns + gradual island brightening
    let litCount = 0;
    for (const lantern of world.lanterns) {
      if (lantern.lit) litCount += 1;
      const vis = lanternVisuals.get(lantern.id);
      if (!vis) continue;
      vis.group.position.set(lantern.pos[0], 0, lantern.pos[2]);
      if (lantern.lit) {
        vis.coreMat.color.setHex(0xffd275);
        vis.coreMat.emissive.setHex(0xff9b28);
        vis.coreMat.emissiveIntensity = 1.6 + Math.sin(nowSec * 3.0) * 0.15;
        vis.light.intensity = 18;
        vis.safeRing.visible = true;
      } else if (lantern.deposited > 0) {
        const frac = lantern.deposited / world.tuning.lantern_cost;
        vis.coreMat.color.setHex(0xa88b70);
        vis.coreMat.emissive.setHex(0xff8e29);
        vis.coreMat.emissiveIntensity = 0.45 + frac * 0.5;
        vis.light.intensity = 3 * frac;
        vis.safeRing.visible = false;
      } else {
        vis.coreMat.color.setHex(0x625a7a);
        vis.coreMat.emissive.setHex(0x261d3a);
        vis.coreMat.emissiveIntensity = 0.35;
        vis.light.intensity = 0;
        vis.safeRing.visible = false;
      }
    }

    const brightT = litCount / Math.max(1, world.lanterns.length);
    envLights.ambient.intensity = 0.55 + brightT * 0.65;
    envLights.hemi.intensity = 0.5 + brightT * 0.65;
    envLights.moon.intensity = 0.45 + brightT * 0.45;
    fog.density = 0.024 - brightT * 0.011;
    const blendedSky = nightSky.clone().lerp(dawnSky, brightT);
    scene.background = blendedSky;
    fog.color.copy(blendedSky);

    // Sync active motes
    const activeMoteIds = new Set<string>();
    for (const mote of world.motes) {
      activeMoteIds.add(mote.id);
      let mesh = moteMeshes.get(mote.id);
      if (!mesh) {
        mesh = createMoteMesh();
        moteMeshes.set(mote.id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(
        mote.pos[0],
        0.55 + Math.sin(nowSec * 3.0 + mote.pos[0]) * 0.18,
        mote.pos[2]
      );
    }
    for (const [id, mesh] of moteMeshes.entries()) {
      if (!activeMoteIds.has(id)) {
        scene.remove(mesh);
        moteMeshes.delete(id);
      }
    }

    // Sync active shades
    const activeShadeIds = new Set<string>();
    for (const shade of world.shades) {
      activeShadeIds.add(shade.id);
      let mesh = shadeMeshes.get(shade.id);
      if (!mesh) {
        mesh = createShadeMesh();
        shadeMeshes.set(shade.id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(shade.pos[0], 0, shade.pos[2]);
      mesh.lookAt(world.player.pos[0], 0, world.player.pos[2]);
      const { bodyMat, eyeMat } = mesh.userData as {
        bodyMat: THREE.MeshStandardMaterial;
        eyeMat: THREE.MeshBasicMaterial;
      };
      if (shade.state === "stunned") {
        bodyMat.color.setHex(0x3a486e);
        bodyMat.emissive.setHex(0x5b76ad);
        eyeMat.color.setHex(0x9bd4ff);
        mesh.rotation.z = Math.sin(nowSec * 22) * 0.15;
      } else {
        bodyMat.color.setHex(0x160a24);
        bodyMat.emissive.setHex(0x2c0d45);
        eyeMat.color.setHex(0xd94fff);
        mesh.rotation.z = 0;
      }
    }
    for (const [id, mesh] of shadeMeshes.entries()) {
      if (!activeShadeIds.has(id)) {
        scene.remove(mesh);
        shadeMeshes.delete(id);
      }
    }

    // Pulse waves
    for (let i = pulseWaves.length - 1; i >= 0; i--) {
      const wave = pulseWaves[i]!;
      wave.age += dtFrame;
      const p = wave.age / wave.maxAge;
      if (p >= 1) {
        scene.remove(wave.mesh);
        pulseWaves.splice(i, 1);
      } else {
        const s = 1 + p * (world.tuning.pulse_radius * 1.4);
        wave.mesh.scale.set(s, s, 1);
        wave.mat.opacity = 0.85 * (1 - p);
      }
    }

    // Third-person camera following Mây along contract cam_yaw_deg convention (+Z at yaw=0)
    const camDist = 9.2;
    const camHeight = 5.4;
    const targetCamPos = new THREE.Vector3(
      world.player.pos[0] - Math.sin(theta) * camDist,
      world.player.pos[1] + camHeight,
      world.player.pos[2] - Math.cos(theta) * camDist
    );
    camera.position.lerp(targetCamPos, 0.18);
    camera.lookAt(world.player.pos[0], world.player.pos[1] + 1.15, world.player.pos[2]);

    // HUD updates
    hudFlames.textContent =
      world.player.flames > 0 ? "♥ ".repeat(world.player.flames).trim() : "Tắt lửa";
    hudCarried.textContent = `${world.player.carried} / ${world.tuning.carry_capacity}`;
    hudLanterns.textContent = `${litCount} / ${world.lanterns.length}`;
    hudTime.textContent = formatTime(world.timeLeftS);
    hudScore.textContent = String(world.score);

    if (world.player.pulseCooldown > 0) {
      hudPulse.textContent = `Hồi ${world.player.pulseCooldown.toFixed(1)}s`;
    } else if (world.player.carried < world.tuning.pulse_cost) {
      hudPulse.textContent = `Cần ${world.tuning.pulse_cost} đom đóm`;
    } else {
      hudPulse.textContent = "Sẵn sàng (R/Shift)";
    }
  }

  window.addEventListener("keydown", (e) => {
    audio.unlock();
    const code = e.code;
    if (code === "KeyM" && !e.repeat) {
      const muted = audio.toggleMute();
      btnMute.textContent = muted ? "Âm thanh: Tắt (M)" : "Âm thanh: Bật (M)";
      return;
    }
    pressedKeys.add(code);
  });

  window.addEventListener("keyup", (e) => {
    pressedKeys.delete(e.code);
  });

  window.addEventListener("mousedown", (e) => {
    audio.unlock();
    if (e.button === 0) {
      dragging = true;
      lastMouseX = e.clientX;
    } else if (e.button === 2) {
      pressedKeys.add("MouseRightPulse");
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) dragging = false;
    if (e.button === 2) pressedKeys.delete("MouseRightPulse");
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastMouseX;
    lastMouseX = e.clientX;
    camYawDeg = (camYawDeg - dx * 0.35) % 360;
  });

  window.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  btnMute.addEventListener("click", () => {
    const muted = audio.toggleMute();
    btnMute.textContent = muted ? "Âm thanh: Tắt (M)" : "Âm thanh: Bật (M)";
  });
  btnRestartHud.addEventListener("click", restartGame);
  btnPlayAgain.addEventListener("click", restartGame);

  let accumulator = 0;
  let lastMs = performance.now();

  function frame(nowMs: number): void {
    const dtFrame = Math.min((nowMs - lastMs) / 1000, 0.1);
    lastMs = nowMs;

    if (bannerTimer > 0) {
      bannerTimer -= dtFrame;
      if (bannerTimer <= 0) {
        banner.classList.remove("visible");
      }
    }

    if (pressedKeys.has("KeyQ")) camYawDeg = (camYawDeg + 110 * dtFrame) % 360;
    if (pressedKeys.has("KeyC")) camYawDeg = (camYawDeg - 110 * dtFrame) % 360;

    let moveX = 0;
    let moveZ = 0;
    if (pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp")) moveZ += 1;
    if (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown")) moveZ -= 1;
    if (pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft")) moveX += 1;
    if (pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight")) moveX -= 1;

    const jump = pressedKeys.has("Space");
    const interact = pressedKeys.has("KeyE") || pressedKeys.has("KeyF");
    const pulse =
      pressedKeys.has("KeyR") ||
      pressedKeys.has("ShiftLeft") ||
      pressedKeys.has("ShiftRight") ||
      pressedKeys.has("MouseRightPulse");

    accumulator += dtFrame;
    while (accumulator >= DT_SEC) {
      if (world.state === "playing") {
        const events = stepGameWorld(world, {
          move: [moveX, moveZ],
          cam_yaw_deg: camYawDeg,
          jump,
          interact,
          pulse,
        });
        handleEvents(events);
      }
      accumulator -= DT_SEC;
    }

    syncVisuals(nowMs / 1000, dtFrame);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  showBanner("Thu thập đom đóm và thắp sáng 5 Đèn Lồng Lớn!");
  requestAnimationFrame(frame);
}

start();
