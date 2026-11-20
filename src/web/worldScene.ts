import * as THREE from "three";
import { DEFAULT_TUNING } from "../core/contract.js";
import { getNightMapConfig } from "../core/maps.js";
import type { GameWorld, NightNumber } from "../core/types.js";
import { applyShadeFacing, computeLanternVisualState } from "./visualHelpers.js";

interface LanternVisual {
  group: THREE.Group;
  coreGroup: THREE.Group;
  coreMat: THREE.MeshStandardMaterial;
  tearsGroup: THREE.Group;
  fuelBarGroup: THREE.Group;
  fuelFill: THREE.Mesh;
  fuelFillMat: THREE.MeshBasicMaterial;
  light: THREE.PointLight;
  safeRing: THREE.Mesh;
}

interface PulseWave {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  maxAge: number;
}

interface WindStreak {
  mesh: THREE.Mesh;
  phase: number;
  radial: number;
  height: number;
}

export const PALETTE = {
  skyNight: 0x0b0e1a,
  skyDawn: 0x26213d,
  cloudSea: 0x080b15,
  grass: 0x24342d,
  stone: 0x3e4a59,
  bridge: 0x6b4a2f,
  cloakCream: 0xe8e2d0,
  scarfRed: 0xc8102e,
  nonLaGold: 0xc9b48a,
  lanternWarm: 0xffb347,
  lanternGlow: 0xffe9b0,
  lanternUnlit: 0x5b5f6e,
  moteCore: 0xfff6c2,
  moteHalo: 0xffe58a,
  shadeBody: 0x120a1a,
  shadeEyes: 0x7a3cff,
  shadeColorblindCyan: 0x00b3ff,
  shadeStunned: 0x3a3450,
  drifterWisp: 0x8fa3b8,
  charmRed: 0xc8102e,
  charmGold: 0xf2c14e,
} as const;

export class WorldSceneRenderer {
  readonly scene = new THREE.Scene();
  private readonly ambient = new THREE.AmbientLight(0xd9e1ff, 0.15);
  private readonly hemi = new THREE.HemisphereLight(0x4b5d9a, 0x131020, 0.28);
  private readonly moon = new THREE.DirectionalLight(0x9fb8ff, 0.35);
  private readonly fog = new THREE.FogExp2(PALETTE.skyNight, 0.02);
  private readonly skyNightColor = new THREE.Color(PALETTE.skyNight);
  private readonly skyDawnColor = new THREE.Color(PALETTE.skyDawn);
  private readonly skyScratchColor = new THREE.Color(PALETTE.skyNight);

  private readonly envGroup = new THREE.Group();
  private readonly lanternGroup = new THREE.Group();
  private readonly lanternVisuals = new Map<string, LanternVisual>();
  private readonly moteMeshes = new Map<string, THREE.Group>();
  private readonly shadeMeshes = new Map<string, THREE.Group>();
  private readonly drifterMeshes = new Map<string, THREE.Group>();
  private readonly charmMeshes = new Map<string, THREE.Group>();
  private readonly pulseWaves: PulseWave[] = [];
  private readonly windStreaks: WindStreak[] = [];

  // Shared geometries & materials for high FPS
  private readonly moteCoreGeo = new THREE.SphereGeometry(0.2, 10, 10);
  private readonly moteHaloGeo = new THREE.SphereGeometry(0.36, 10, 10);
  private readonly moteRandomMat = new THREE.MeshBasicMaterial({ color: PALETTE.moteCore });
  private readonly moteDroppedMat = new THREE.MeshBasicMaterial({ color: 0xffb86c });
  private readonly moteHaloMat = new THREE.MeshBasicMaterial({
    color: PALETTE.moteHalo,
    transparent: true,
    opacity: 0.34,
  });

  private readonly shadeConeGeo = new THREE.ConeGeometry(0.55, 1.5, 12);
  private readonly shadeEyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
  private readonly shadeMatNormal = new THREE.MeshStandardMaterial({
    color: PALETTE.shadeBody,
    emissive: 0x260d3d,
    emissiveIntensity: 0.5,
    roughness: 0.55,
  });
  private readonly shadeMatStunned = new THREE.MeshStandardMaterial({
    color: PALETTE.shadeStunned,
    emissive: 0x4f4673,
    emissiveIntensity: 0.45,
    roughness: 0.6,
  });
  private readonly shadeMatSpawning = new THREE.MeshStandardMaterial({
    color: PALETTE.shadeBody,
    emissive: PALETTE.shadeEyes,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.5,
  });
  private readonly shadeEyeChaseMat = new THREE.MeshBasicMaterial({ color: PALETTE.shadeEyes });
  private readonly shadeEyeStunMat = new THREE.MeshBasicMaterial({ color: 0x9bd4ff });
  private readonly shadeRimGeo = new THREE.TorusGeometry(0.64, 0.045, 6, 20);
  private readonly shadeRimColorblindMat = new THREE.MeshBasicMaterial({
    color: PALETTE.shadeColorblindCyan,
  });
  private colorblindMode = false;

  private readonly drifterBodyGeo = new THREE.ConeGeometry(0.32, 1.15, 8);
  private readonly drifterRibbonGeo = new THREE.TorusGeometry(0.38, 0.05, 6, 16);
  private readonly drifterIdleMat = new THREE.MeshStandardMaterial({
    color: PALETTE.drifterWisp,
    emissive: 0x4b6584,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.85,
  });
  private readonly drifterFleeMat = new THREE.MeshStandardMaterial({
    color: 0xd9e8f5,
    emissive: PALETTE.lanternWarm,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.9,
  });

  private readonly pulseRingGeo = new THREE.RingGeometry(0.4, 0.8, 48);

  private readonly mayGroup = new THREE.Group();
  private readonly smallLantern: THREE.Mesh;
  private readonly playerLight: THREE.PointLight;
  private readonly carriedOrbs: THREE.Mesh[] = [];

  constructor() {
    this.scene.background = this.skyNightColor.clone();
    this.scene.fog = this.fog;

    this.scene.add(this.ambient, this.hemi);
    this.moon.position.set(-22, 34, -18);
    this.scene.add(this.moon);
    this.scene.add(this.envGroup, this.lanternGroup);

    const cloudSea = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 360),
      new THREE.MeshStandardMaterial({ color: PALETTE.cloudSea, roughness: 0.96 })
    );
    cloudSea.rotation.x = -Math.PI / 2;
    cloudSea.position.y = -3.2;
    this.scene.add(cloudSea);

    // Wind streaks pool (used in Night 3 warning/gusts)
    const windGeo = new THREE.BoxGeometry(0.85, 0.04, 0.14);
    const windMat = new THREE.MeshBasicMaterial({
      color: 0xb7d9ec,
      transparent: true,
      opacity: 0.65,
    });
    for (let i = 0; i < 36; i++) {
      const mesh = new THREE.Mesh(windGeo, windMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.windStreaks.push({
        mesh,
        phase: (i / 36) * 40,
        radial: ((i * 19) % 56) - 28,
        height: 1.0 + (i % 7) * 1.1,
      });
    }

    const builtMay = this.buildMayCharacter();
    this.smallLantern = builtMay.smallLantern;
    this.playerLight = builtMay.playerLight;
  }

  private buildMayCharacter(): { smallLantern: THREE.Mesh; playerLight: THREE.PointLight } {
    // Cloak (#E8E2D0)
    const cloak = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 0.95, 14),
      new THREE.MeshStandardMaterial({ color: PALETTE.cloakCream, roughness: 0.72 })
    );
    cloak.position.y = 0.48;
    this.mayGroup.add(cloak);

    // Red scarf (#C8102E)
    const scarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.06, 8, 16),
      new THREE.MeshStandardMaterial({ color: PALETTE.scarfRed, roughness: 0.65 })
    );
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 0.92;
    this.mayGroup.add(scarf);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0xf4cfa8, roughness: 0.65 })
    );
    head.position.y = 1.08;
    this.mayGroup.add(head);

    // Nón lá (#C9B48A)
    const nonLa = new THREE.Mesh(
      new THREE.ConeGeometry(0.48, 0.25, 22),
      new THREE.MeshStandardMaterial({ color: PALETTE.nonLaGold, roughness: 0.85, side: THREE.DoubleSide })
    );
    nonLa.position.y = 1.28;
    this.mayGroup.add(nonLa);

    // Small lantern hanging from nón lá rim
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6),
      new THREE.MeshBasicMaterial({ color: 0x4d3623 })
    );
    cord.position.set(0, 1.08, 0.44);
    this.mayGroup.add(cord);

    const smallLantern = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.11, 1),
      new THREE.MeshStandardMaterial({
        color: PALETTE.lanternGlow,
        emissive: PALETTE.lanternWarm,
        emissiveIntensity: 1.5,
        roughness: 0.2,
      })
    );
    smallLantern.position.set(0, 0.92, 0.44);
    this.mayGroup.add(smallLantern);

    const playerLight = new THREE.PointLight(PALETTE.lanternWarm, 2.4, 12, 1.4);
    playerLight.position.set(0, 1.05, 0.44);
    this.mayGroup.add(playerLight);

    const orbGeo = new THREE.SphereGeometry(0.075, 8, 8);
    for (let i = 0; i < DEFAULT_TUNING.capacity_max; i++) {
      const orb = new THREE.Mesh(orbGeo, this.moteRandomMat);
      orb.visible = false;
      this.mayGroup.add(orb);
      this.carriedOrbs.push(orb);
    }

    this.scene.add(this.mayGroup);
    return { smallLantern, playerLight };
  }

  setColorblindMode(enabled: boolean): void {
    this.colorblindMode = enabled;
    const eyeHex = enabled ? PALETTE.shadeColorblindCyan : PALETTE.shadeEyes;
    const bodyEmissiveHex = enabled ? 0x004e7a : 0x260d3d;
    this.shadeEyeChaseMat.color.setHex(eyeHex);
    this.shadeMatNormal.emissive.setHex(bodyEmissiveHex);
    this.shadeMatSpawning.emissive.setHex(eyeHex);
    for (const g of this.shadeMeshes.values()) {
      const rim = g.userData.rim as THREE.Mesh | undefined;
      if (rim) rim.visible = enabled;
    }
  }

  private disposeSubtree(root: THREE.Object3D): void {
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        geos.add(obj.geometry);
        if (Array.isArray(obj.material)) {
          for (const m of obj.material) mats.add(m);
        } else {
          mats.add(obj.material);
        }
      }
    });
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose();
  }

  private clearGroup(group: THREE.Group, dispose = false): void {
    if (dispose) this.disposeSubtree(group);
    while (group.children.length > 0) {
      group.remove(group.children[0]!);
    }
  }

  private clearDynamicEntityMap(map: Map<string, THREE.Group>, dispose = false): void {
    for (const mesh of map.values()) {
      if (dispose) this.disposeSubtree(mesh);
      this.scene.remove(mesh);
    }
    map.clear();
  }

  rebuildForWorld(world: GameWorld): void {
    this.clearGroup(this.envGroup, true);
    this.clearGroup(this.lanternGroup, true);
    this.lanternVisuals.clear();
    this.clearDynamicEntityMap(this.moteMeshes);
    this.clearDynamicEntityMap(this.shadeMeshes);
    this.clearDynamicEntityMap(this.drifterMeshes);
    this.clearDynamicEntityMap(this.charmMeshes, true);

    for (const wave of this.pulseWaves) {
      this.scene.remove(wave.mesh);
      wave.mat.dispose();
    }
    this.pulseWaves.length = 0;

    this.buildTerrainForNight(world.night);
    this.buildLanternsForWorld(world);
    this.buildCharmsForWorld(world);
  }

  private addIslandDisc(cx: number, cz: number, radius: number, topY: number, thickness: number): void {
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius + 1.2, thickness, 56),
      new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 0.9 })
    );
    disc.position.set(cx, topY - thickness / 2, cz);
    this.envGroup.add(disc);

    const rim = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.5, radius - 0.55), radius, 56),
      new THREE.MeshStandardMaterial({ color: PALETTE.stone, roughness: 0.9, side: THREE.DoubleSide })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(cx, topY + 0.015, cz);
    this.envGroup.add(rim);
  }

  private addJumpPadVisual(x: number, y: number, z: number): void {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.05, 0.16, 24),
      new THREE.MeshStandardMaterial({
        color: 0x3b6e8c,
        emissive: 0x4cc9f0,
        emissiveIntensity: 0.75,
        roughness: 0.35,
      })
    );
    pad.position.set(x, y + 0.08, z);
    this.envGroup.add(pad);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 0.98, 24),
      new THREE.MeshBasicMaterial({ color: PALETTE.charmGold, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.17, z);
    this.envGroup.add(ring);
  }

  private buildTerrainForNight(night: NightNumber): void {
    const map = getNightMapConfig(night);

    if (night === 1) {
      this.addIslandDisc(0, 0, 40, 0, 2.2);
      const plaza = new THREE.Mesh(
        new THREE.RingGeometry(2.6, 3.2, 40),
        new THREE.MeshBasicMaterial({ color: PALETTE.stone, side: THREE.DoubleSide })
      );
      plaza.rotation.x = -Math.PI / 2;
      plaza.position.y = 0.02;
      this.envGroup.add(plaza);
    } else if (night === 2) {
      this.addIslandDisc(0, 0, 28, 0, 2.2);
      this.addIslandDisc(70, 0, 28, 0, 2.2);

      // Bamboo bridge x in [26, 44], z in [-2, 2]
      const bridgeMat = new THREE.MeshStandardMaterial({ color: PALETTE.bridge, roughness: 0.85 });
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.35, 4), bridgeMat);
      bridge.position.set(35, -0.175, 0);
      this.envGroup.add(bridge);

      for (const rz of [-1.85, 1.85]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(18, 0.12, 0.12), bridgeMat);
        rail.position.set(35, 0.55, rz);
        this.envGroup.add(rail);
      }
    } else {
      // Night 3: Tier 0 (r<=45, Y=0)
      this.addIslandDisc(0, 0, 45, 0, 2.4);

      // Tier 1 half-annulus: 12 <= r <= 24 && z >= 0 at Y=3
      const shape = new THREE.Shape();
      shape.absarc(0, 0, 24, 0, Math.PI, false);
      shape.absarc(0, 0, 12, Math.PI, 0, true);
      shape.closePath();
      const tier1Geo = new THREE.ExtrudeGeometry(shape, { depth: 3.0, bevelEnabled: false, curveSegments: 36 });
      const tier1 = new THREE.Mesh(
        tier1Geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.stone, roughness: 0.88 })
      );
      tier1.rotation.x = Math.PI / 2;
      tier1.position.y = 3.0;
      this.envGroup.add(tier1);

      // Tier 2 (r<=8, Y=6)
      this.addIslandDisc(0, 0, 8, 6, 6.0);

      // Two ramps at 30 deg & 150 deg connecting s=23.85 (Y=3) to s=30 (Y=0)
      const rampLen = Math.hypot(6.15, 3.0);
      const slopeAngle = Math.atan2(3.0, 6.15);
      const rampMat = new THREE.MeshStandardMaterial({ color: PALETTE.bridge, roughness: 0.85 });
      for (const deg of [30, 150]) {
        const rad = (deg * Math.PI) / 180;
        const ux = Math.cos(rad);
        const uz = Math.sin(rad);
        const rampGroup = new THREE.Group();
        rampGroup.position.set(26.925 * ux, 1.5, 26.925 * uz);
        rampGroup.rotation.y = -rad;

        const plank = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.28, 3.0), rampMat);
        plank.rotation.z = -slopeAngle;
        plank.position.y = -0.14;
        rampGroup.add(plank);
        this.envGroup.add(rampGroup);
      }

      // Bell Tower at (0, 6, 0), radius 2.0, height 8m (Y=6..14)
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(1.75, 2.0, 6.4, 16),
        new THREE.MeshStandardMaterial({ color: PALETTE.stone, roughness: 0.82 })
      );
      tower.position.set(0, 9.2, 0);
      this.envGroup.add(tower);

      const towerRoof = new THREE.Mesh(
        new THREE.ConeGeometry(2.7, 2.2, 12),
        new THREE.MeshStandardMaterial({ color: PALETTE.scarfRed, roughness: 0.72 })
      );
      towerRoof.position.set(0, 13.4, 0);
      this.envGroup.add(towerRoof);

      const bell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.72, 0.95, 16),
        new THREE.MeshStandardMaterial({
          color: PALETTE.charmGold,
          emissive: 0x8a6116,
          emissiveIntensity: 0.4,
          metalness: 0.6,
          roughness: 0.3,
        })
      );
      bell.position.set(0, 11.4, 0);
      this.envGroup.add(bell);
    }

    for (const pad of map.jumpPads) {
      this.addJumpPadVisual(pad.pos[0], pad.pos[1], pad.pos[2]);
    }
  }

  private buildLanternsForWorld(world: GameWorld): void {
    const baseGeo = new THREE.CylinderGeometry(0.65, 0.85, 0.55, 12);
    const pillarGeo = new THREE.CylinderGeometry(0.14, 0.2, 2.1, 10);
    const coreGeo = new THREE.OctahedronGeometry(0.55, 1);
    const tearGeo = new THREE.BoxGeometry(0.1, 0.72, 0.08);
    const roofGeo = new THREE.ConeGeometry(0.85, 0.45, 8);
    const fuelBgGeo = new THREE.BoxGeometry(1.18, 0.16, 0.05);
    const fuelFillGeo = new THREE.BoxGeometry(1.06, 0.1, 0.07);
    const ringGeo = new THREE.RingGeometry(
      DEFAULT_TUNING.safe_radius - 0.12,
      DEFAULT_TUNING.safe_radius,
      48
    );

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x393d54, roughness: 0.9 });
    const pillarMat = new THREE.MeshStandardMaterial({ color: PALETTE.bridge, roughness: 0.85 });
    const tearMat = new THREE.MeshBasicMaterial({ color: 0x15111f });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2433, roughness: 0.85 });
    const fuelBgMat = new THREE.MeshBasicMaterial({ color: 0x0b0e1a });
    const safeRingMat = new THREE.MeshBasicMaterial({
      color: PALETTE.lanternWarm,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
    });

    for (const lantern of world.lanterns) {
      const group = new THREE.Group();
      group.position.set(lantern.pos[0], lantern.pos[1], lantern.pos[2]);

      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0.275;
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.y = 1.45;
      const coreMat = new THREE.MeshStandardMaterial({
        color: PALETTE.lanternUnlit,
        emissive: 0x261d3a,
        emissiveIntensity: 0.35,
        roughness: 0.3,
      });
      const coreGroup = new THREE.Group();
      coreGroup.position.y = 2.65;
      const core = new THREE.Mesh(coreGeo, coreMat);
      coreGroup.add(core);

      // Visible dark paper-tear slits on unlit lanterns (accessibility shape cue)
      const tearsGroup = new THREE.Group();
      for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const slit = new THREE.Mesh(tearGeo, tearMat);
        slit.position.set(Math.sin(yaw) * 0.44, 0, Math.cos(yaw) * 0.44);
        slit.rotation.set(0, yaw, yaw % Math.PI === 0 ? 0.38 : -0.38);
        tearsGroup.add(slit);
      }
      coreGroup.add(tearsGroup);

      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 3.25;

      // Floating 3D fuel bar on lit lanterns
      const fuelBarGroup = new THREE.Group();
      fuelBarGroup.position.y = 3.92;
      fuelBarGroup.visible = false;
      const fuelBg = new THREE.Mesh(fuelBgGeo, fuelBgMat);
      const fuelFillMat = new THREE.MeshBasicMaterial({ color: PALETTE.lanternWarm });
      const fuelFill = new THREE.Mesh(fuelFillGeo, fuelFillMat);
      fuelFill.position.z = 0.01;
      fuelBarGroup.add(fuelBg, fuelFill);

      const light = new THREE.PointLight(PALETTE.lanternWarm, 0, 19, 1.4);
      light.position.y = 2.65;
      const safeRing = new THREE.Mesh(ringGeo, safeRingMat);
      safeRing.rotation.x = -Math.PI / 2;
      safeRing.position.y = 0.04;
      safeRing.visible = false;

      group.add(base, pillar, coreGroup, roof, fuelBarGroup, light, safeRing);
      this.lanternGroup.add(group);
      this.lanternVisuals.set(lantern.id, {
        group,
        coreGroup,
        coreMat,
        tearsGroup,
        fuelBarGroup,
        fuelFill,
        fuelFillMat,
        light,
        safeRing,
      });
    }
  }

  private buildCharmsForWorld(world: GameWorld): void {
    const talismanGeo = new THREE.OctahedronGeometry(0.42, 0);
    const ringGeo = new THREE.TorusGeometry(0.62, 0.06, 8, 24);
    const talismanMat = new THREE.MeshStandardMaterial({
      color: PALETTE.charmRed,
      emissive: 0x991224,
      emissiveIntensity: 0.7,
      roughness: 0.3,
    });
    const goldMat = new THREE.MeshBasicMaterial({ color: PALETTE.charmGold });

    for (const charm of world.charms) {
      const g = new THREE.Group();
      g.position.set(charm.pos[0], charm.pos[1] + 0.9, charm.pos[2]);
      const diamond = new THREE.Mesh(talismanGeo, talismanMat);
      const rim = new THREE.Mesh(ringGeo, goldMat);
      rim.rotation.x = Math.PI / 2;
      g.add(diamond, rim);
      this.scene.add(g);
      this.charmMeshes.set(charm.id, g);
    }
  }

  spawnPulseWave(x: number, y: number, z: number): void {
    const mat = new THREE.MeshBasicMaterial({
      color: PALETTE.lanternGlow,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.pulseRingGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y + 0.12, z);
    this.scene.add(mesh);
    this.pulseWaves.push({ mesh, mat, age: 0, maxAge: 0.5 });
  }

  sync(world: GameWorld, nowSec: number, dtFrame: number, cameraPos?: THREE.Vector3): void {
    // Mây + hanging lantern + orbiting motes
    this.mayGroup.position.set(world.player.pos[0], world.player.pos[1], world.player.pos[2]);
    this.mayGroup.rotation.y = Math.atan2(world.player.facing[0], world.player.facing[1]);
    this.smallLantern.position.x = Math.sin(nowSec * 3.5) * 0.04;
    this.playerLight.intensity =
      world.player.invulnTicks > 0 && Math.floor(nowSec * 12) % 2 === 0 ? 0.6 : 2.4;

    for (let i = 0; i < this.carriedOrbs.length; i++) {
      const orb = this.carriedOrbs[i]!;
      orb.visible = i < world.player.carried;
      if (orb.visible) {
        const a = nowSec * 2.4 + (i * Math.PI * 2) / Math.max(1, world.player.carried);
        orb.position.set(
          Math.cos(a) * 0.68,
          0.85 + Math.sin(nowSec * 4 + i) * 0.12,
          Math.sin(a) * 0.68
        );
      }
    }

    // Lanterns + required ambient light formula: 0.15 + 0.55 * (lit / total)
    let litCount = 0;
    for (const lantern of world.lanterns) {
      if (lantern.lit) litCount += 1;
      const vis = this.lanternVisuals.get(lantern.id);
      if (!vis) continue;
      vis.group.position.set(lantern.pos[0], lantern.pos[1], lantern.pos[2]);

      const fuelVal = lantern.lit ? lantern.fuelSixtieths / 60 : 0;
      const visState = computeLanternVisualState({
        lit: lantern.lit,
        fuel: fuelVal,
        fuelMax: world.tuning.fuel_max,
        lowFuelThreshold: world.tuning.low_fuel_threshold,
        nowSec,
      });

      vis.coreGroup.scale.set(lantern.lit ? 1 : 1.06, visState.scaleY, lantern.lit ? 1 : 1.06);
      vis.tearsGroup.visible = visState.tearsVisible;
      vis.fuelBarGroup.visible = visState.fuelBarVisible;
      vis.safeRing.visible = visState.safeRingVisible;

      if (visState.fuelBarVisible) {
        if (cameraPos) {
          vis.fuelBarGroup.rotation.y = Math.atan2(
            cameraPos.x - lantern.pos[0],
            cameraPos.z - lantern.pos[2]
          );
        }
        const clampedRatio = Math.max(0.001, visState.fuelRatio);
        vis.fuelFill.scale.x = clampedRatio;
        vis.fuelFill.position.x = -0.53 * (1 - clampedRatio);
        if (visState.blinking) {
          vis.fuelFillMat.color.setHex(
            this.colorblindMode
              ? visState.blinkOn
                ? 0xffffff
                : 0x5f6b85
              : visState.blinkOn
                ? 0xff5a5f
                : 0x5c1a24
          );
        } else {
          vis.fuelFillMat.color.setHex(0x7be3b5);
        }
      }

      if (lantern.lit) {
        if (visState.blinking) {
          vis.coreMat.color.setHex(visState.blinkOn ? PALETTE.lanternGlow : 0xb36b4a);
          vis.coreMat.emissive.setHex(PALETTE.lanternWarm);
          vis.coreMat.emissiveIntensity = visState.blinkOn ? 1.55 : 0.3;
          vis.light.intensity = visState.blinkOn ? 15 : 4;
        } else {
          vis.coreMat.color.setHex(PALETTE.lanternGlow);
          vis.coreMat.emissive.setHex(PALETTE.lanternWarm);
          vis.coreMat.emissiveIntensity = 1.65 + Math.sin(nowSec * 3.0) * 0.15;
          vis.light.intensity = 18;
        }
      } else if (lantern.deposited > 0) {
        const cost = lantern.everLit ? world.tuning.relight_cost : world.tuning.lantern_cost;
        const frac = lantern.deposited / Math.max(1, cost);
        vis.coreMat.color.setHex(0xb89a70);
        vis.coreMat.emissive.setHex(PALETTE.lanternWarm);
        vis.coreMat.emissiveIntensity = 0.4 + frac * 0.55;
        vis.light.intensity = 3.2 * frac;
      } else {
        vis.coreMat.color.setHex(PALETTE.lanternUnlit);
        vis.coreMat.emissive.setHex(0x261d3a);
        vis.coreMat.emissiveIntensity = 0.3;
        vis.light.intensity = 0;
      }
    }

    const brightT = litCount / Math.max(1, world.lanterns.length);
    this.ambient.intensity = 0.15 + 0.55 * brightT;
    this.hemi.intensity = 0.25 + 0.45 * brightT;
    this.moon.intensity = 0.35 + 0.3 * brightT;
    this.fog.density = 0.02 - brightT * 0.009;
    this.skyScratchColor.copy(this.skyNightColor).lerp(this.skyDawnColor, brightT);
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.skyScratchColor);
    } else {
      this.scene.background = this.skyScratchColor;
    }
    this.fog.color.copy(this.skyScratchColor);

    // Motes
    const activeMoteIds = new Set<string>();
    for (const mote of world.motes) {
      activeMoteIds.add(mote.id);
      let g = this.moteMeshes.get(mote.id);
      if (!g) {
        g = new THREE.Group();
        const sphere = new THREE.Mesh(
          this.moteCoreGeo,
          mote.kind === "dropped" ? this.moteDroppedMat : this.moteRandomMat
        );
        const halo = new THREE.Mesh(this.moteHaloGeo, this.moteHaloMat);
        g.add(sphere, halo);
        this.moteMeshes.set(mote.id, g);
        this.scene.add(g);
      }
      g.position.set(
        mote.pos[0],
        mote.pos[1] + 0.55 + Math.sin(nowSec * 3.0 + mote.pos[0]) * 0.16,
        mote.pos[2]
      );
    }
    for (const [id, g] of this.moteMeshes.entries()) {
      if (!activeMoteIds.has(id)) {
        this.scene.remove(g);
        this.moteMeshes.delete(id);
      }
    }

    // Shades
    const activeShadeIds = new Set<string>();
    for (const shade of world.shades) {
      activeShadeIds.add(shade.id);
      let g = this.shadeMeshes.get(shade.id);
      if (!g) {
        g = new THREE.Group();
        const body = new THREE.Mesh(this.shadeConeGeo, this.shadeMatNormal);
        body.position.y = 0.75;
        const leftEye = new THREE.Mesh(this.shadeEyeGeo, this.shadeEyeChaseMat);
        leftEye.position.set(-0.14, 1.05, 0.32);
        const rightEye = new THREE.Mesh(this.shadeEyeGeo, this.shadeEyeChaseMat);
        rightEye.position.set(0.14, 1.05, 0.32);
        const rim = new THREE.Mesh(this.shadeRimGeo, this.shadeRimColorblindMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.72;
        rim.visible = this.colorblindMode;
        g.add(body, leftEye, rightEye, rim);
        g.userData = { body, leftEye, rightEye, rim };
        this.shadeMeshes.set(shade.id, g);
        this.scene.add(g);
      }
      g.position.set(shade.pos[0], shade.pos[1] - 0.8, shade.pos[2]);
      const drainTarget =
        shade.state === "drain" && shade.targetLanternId
          ? world.lanterns.find((l) => l.id === shade.targetLanternId)
          : undefined;
      const faceTarget = drainTarget ? drainTarget.pos : world.player.pos;
      applyShadeFacing(g, shade.pos, faceTarget, shade.state === "stunned", nowSec);
      const { body, leftEye, rightEye, rim } = g.userData as {
        body: THREE.Mesh;
        leftEye: THREE.Mesh;
        rightEye: THREE.Mesh;
        rim: THREE.Mesh;
      };
      rim.visible = this.colorblindMode;
      body.scale.y = shade.state === "drain" ? 1 + Math.sin(nowSec * 10) * 0.08 : 1;
      if (shade.state === "stunned") {
        body.material = this.shadeMatStunned;
        leftEye.material = this.shadeEyeStunMat;
        rightEye.material = this.shadeEyeStunMat;
      } else if (shade.state === "spawning") {
        body.material = this.shadeMatSpawning;
        leftEye.material = this.shadeEyeChaseMat;
        rightEye.material = this.shadeEyeChaseMat;
      } else {
        body.material = this.shadeMatNormal;
        leftEye.material = this.shadeEyeChaseMat;
        rightEye.material = this.shadeEyeChaseMat;
      }
    }
    for (const [id, g] of this.shadeMeshes.entries()) {
      if (!activeShadeIds.has(id)) {
        this.scene.remove(g);
        this.shadeMeshes.delete(id);
      }
    }

    // Drifters (Gió Lạc)
    const activeDrifterIds = new Set<string>();
    for (const drifter of world.drifters) {
      if (drifter.state === "removed") continue;
      activeDrifterIds.add(drifter.id);
      let g = this.drifterMeshes.get(drifter.id);
      if (!g) {
        g = new THREE.Group();
        const body = new THREE.Mesh(this.drifterBodyGeo, this.drifterIdleMat);
        body.rotation.x = Math.PI / 4;
        const ribbon = new THREE.Mesh(this.drifterRibbonGeo, this.drifterIdleMat);
        ribbon.rotation.x = Math.PI / 2;
        g.add(body, ribbon);
        g.userData = { body, ribbon };
        this.drifterMeshes.set(drifter.id, g);
        this.scene.add(g);
      }
      g.position.set(
        drifter.pos[0],
        drifter.pos[1] + Math.sin(nowSec * 4.5 + drifter.pos[0]) * 0.25,
        drifter.pos[2]
      );
      g.rotation.y = nowSec * (drifter.state === "flee" ? 6 : 2.5);
      const { body, ribbon } = g.userData as { body: THREE.Mesh; ribbon: THREE.Mesh };
      const mat = drifter.state === "flee" ? this.drifterFleeMat : this.drifterIdleMat;
      body.material = mat;
      ribbon.material = mat;
    }
    for (const [id, g] of this.drifterMeshes.entries()) {
      if (!activeDrifterIds.has(id)) {
        this.scene.remove(g);
        this.drifterMeshes.delete(id);
      }
    }

    // Wind Charms (Bùa Gió)
    for (const charm of world.charms) {
      const g = this.charmMeshes.get(charm.id);
      if (!g) continue;
      g.visible = charm.available;
      if (charm.available) {
        g.position.y = charm.pos[1] + 0.9 + Math.sin(nowSec * 3.0) * 0.16;
        g.rotation.y = nowSec * 1.8;
      }
    }

    // Wind streaks on Night 3
    const showWind = world.wind.enabled && (world.wind.warning || world.wind.active);
    const windRad = (world.wind.dirDeg * Math.PI) / 180;
    const wx = Math.cos(windRad);
    const wz = Math.sin(windRad);
    const speed = world.wind.active ? 26 : 9;
    for (const streak of this.windStreaks) {
      streak.mesh.visible = showWind;
      if (!showWind) continue;
      const along = ((streak.phase + nowSec * speed) % 80) - 40;
      const px = along * wx - streak.radial * wz;
      const pz = along * wz + streak.radial * wx;
      streak.mesh.position.set(px, streak.height, pz);
      streak.mesh.rotation.y = -windRad;
    }

    // Pulse waves
    for (let i = this.pulseWaves.length - 1; i >= 0; i--) {
      const wave = this.pulseWaves[i]!;
      wave.age += dtFrame;
      const frac = wave.age / wave.maxAge;
      if (frac >= 1) {
        this.scene.remove(wave.mesh);
        wave.mat.dispose();
        this.pulseWaves.splice(i, 1);
      } else {
        const s = 1 + frac * (world.tuning.pulse_radius * 1.4);
        wave.mesh.scale.set(s, s, 1);
        wave.mat.opacity = 0.85 * (1 - frac);
      }
    }
  }
}
