import * as THREE from "three";
import { createInitialLanternState, stepLanternState } from "../core/helloLantern.js";

const FIXED_DT_SEC = 1 / 60;
const DEFAULT_SEED = 1;

function createSceneObjects(scene: THREE.Scene) {
  const ambient = new THREE.AmbientLight(0x283655, 0.7);
  scene.add(ambient);

  const seaGeometry = new THREE.PlaneGeometry(40, 40);
  const seaMaterial = new THREE.MeshStandardMaterial({
    color: 0x091324,
    roughness: 0.35,
    metalness: 0.15,
  });
  const sea = new THREE.Mesh(seaGeometry, seaMaterial);
  sea.rotation.x = -Math.PI / 2;
  scene.add(sea);

  const islandGeometry = new THREE.CylinderGeometry(2.6, 3.2, 0.5, 32);
  const islandMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e2838,
    roughness: 0.9,
  });
  const island = new THREE.Mesh(islandGeometry, islandMaterial);
  island.position.y = 0.15;
  scene.add(island);

  const postGeometry = new THREE.CylinderGeometry(0.06, 0.08, 1.5, 12);
  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b2a1e,
    roughness: 0.85,
  });
  const post = new THREE.Mesh(postGeometry, postMaterial);
  post.position.set(0.45, 0.95, 0);
  scene.add(post);

  const lanternGroup = new THREE.Group();
  const coreGeometry = new THREE.OctahedronGeometry(0.24, 1);
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0xffcf70,
    emissive: 0xff9b30,
    emissiveIntensity: 1.0,
    roughness: 0.25,
  });
  const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
  lanternGroup.add(coreMesh);

  const frameGeometry = new THREE.BoxGeometry(0.42, 0.52, 0.42);
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a1d14,
    wireframe: true,
  });
  const frameMesh = new THREE.Mesh(frameGeometry, frameMaterial);
  lanternGroup.add(frameMesh);

  const lanternLight = new THREE.PointLight(0xffb347, 3.0, 12, 1.5);
  lanternGroup.add(lanternLight);

  scene.add(lanternGroup);
  return { lanternGroup, coreMaterial, lanternLight };
}

function start(): void {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b16);
  scene.fog = new THREE.FogExp2(0x070b16, 0.075);

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 2.2, 4.6);
  camera.lookAt(0, 1.0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);

  const { lanternGroup, coreMaterial, lanternLight } = createSceneObjects(scene);
  const hud = document.getElementById("hud");

  let state = createInitialLanternState(DEFAULT_SEED);
  let accumulator = 0;
  let lastTimeMs = performance.now();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function frame(nowMs: number): void {
    const deltaSec = Math.min((nowMs - lastTimeMs) / 1000, 0.1);
    lastTimeMs = nowMs;
    accumulator += deltaSec;

    while (accumulator >= FIXED_DT_SEC) {
      state = stepLanternState(state, FIXED_DT_SEC);
      accumulator -= FIXED_DT_SEC;
    }

    lanternGroup.position.set(state.position.x, state.position.y, state.position.z);
    lanternGroup.rotation.y = state.yawRad;
    coreMaterial.emissiveIntensity = state.glowIntensity;
    lanternLight.intensity = state.glowIntensity * 3.0;

    if (hud) {
      hud.textContent =
        `Đảo Đèn Lồng (Hello CP0) | seed=${state.seed} | tick=${state.tick} | ` +
        `y=${state.position.y.toFixed(2)} | glow=${state.glowIntensity.toFixed(2)}`;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

start();
