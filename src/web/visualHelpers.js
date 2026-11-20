/**
 * Pure Three.js/DOM helpers shared between `src/web/main.ts` and unit tests.
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
