/**
 * Pure Three.js/DOM helpers shared between `src/web/` and Node unit tests.
 */

export function applyShadeFacing(target, shadePos, playerPos, isStunned, nowSec) {
  const yaw = Math.atan2(playerPos[0] - shadePos[0], playerPos[2] - shadePos[2]);
  const wobbleZ = isStunned ? Math.sin(nowSec * 22) * 0.15 : 0;
  target.rotation.order = "YXZ";
  target.rotation.set(0, yaw, wobbleZ);
}

export function handleControlKeyDown(event, pressedKeys) {
  if (event.code === "Space" || event.code.startsWith("Arrow")) {
    event.preventDefault();
  }
  pressedKeys.add(event.code);
}

export function bindHudActionButton(button, onAction) {
  button.addEventListener("click", () => {
    onAction();
    button.blur();
  });
}

/**
 * Projects a camera-space vector `[vx, vy, vz]` (Three.js camera looks along `-Z`)
 * onto screen edge coordinates if the target is outside the viewport or behind camera.
 */
export function computeOffscreenLanternArrow(
  viewPos,
  fovRad,
  aspect,
  width,
  height,
  margin = 48
) {
  const [vx, vy, vz] = viewPos;
  const depth = -vz;
  const safeAspect = Math.max(0.1, aspect);
  const tanHalfFov = Math.tan(fovRad / 2);

  if (depth > 0.1) {
    const halfH = depth * tanHalfFov;
    const halfW = halfH * safeAspect;
    const ndcX = vx / halfW;
    const ndcY = vy / halfH;
    if (Math.abs(ndcX) <= 0.96 && Math.abs(ndcY) <= 0.96) {
      return { visible: false, x: 0, y: 0, angleDeg: 0 };
    }
  }

  const rawX = vx;
  const rawY = -vy; // CSS screen +Y points downward
  const len = Math.hypot(rawX, rawY);
  const nx = len > 1e-5 ? rawX / len : 0;
  const ny = len > 1e-5 ? rawY / len : 1;

  const halfBoxW = Math.max(20, width / 2 - margin);
  const halfBoxH = Math.max(20, height / 2 - margin);
  const tx = Math.abs(nx) > 1e-6 ? halfBoxW / Math.abs(nx) : Infinity;
  const ty = Math.abs(ny) > 1e-6 ? halfBoxH / Math.abs(ny) : Infinity;
  const t = Math.min(tx, ty);

  return {
    visible: true,
    x: width / 2 + nx * t,
    y: height / 2 + ny * t,
    angleDeg: (Math.atan2(ny, nx) * 180) / Math.PI,
  };
}

/**
 * Applies pause/resume transitions on `world` with zeroed movement/action inputs,
 * forwarding all emitted events to `onEvents` so terminal transitions never softlock.
 */
export function applyPauseResumeAction(world, action, camYawDeg, stepWorld, onEvents) {
  const basePatch = {
    move: [0, 0],
    cam_yaw_deg: camYawDeg,
    jump: false,
    dash: false,
    interact: false,
    pulse: false,
  };
  if (action === "pause" && world.state === "playing") {
    if (world.prevInput?.pause) {
      onEvents(stepWorld(world, { ...basePatch, pause: false }));
    }
    if (world.state === "playing") {
      onEvents(stepWorld(world, { ...basePatch, pause: true }));
    }
    if (world.state === "paused") {
      onEvents(stepWorld(world, { ...basePatch, pause: false }));
    }
  } else if (action === "resume" && world.state === "paused") {
    onEvents(stepWorld(world, { ...basePatch, pause: true }));
  }
  return world.state;
}
