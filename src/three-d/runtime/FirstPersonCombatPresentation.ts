import { Vector3 } from "@babylonjs/core";

/** Base first-person FOV (radians) — wider than Babylon default for less sprite claustrophobia. */
export const FP_CAMERA_FOV = 1.1;

/** Extra FOV when hugging a melee target. */
export const FP_CAMERA_FOV_COMBAT_MAX = 1.22;

const FP_PULLBACK_MAX = 0.38;
const FP_PULLBACK_NEAR = 1.05;
const FP_PULLBACK_FAR = 2.35;

const FP_ENEMY_SCALE_MIN = 0.68;
const FP_ENEMY_SCALE_NEAR = 1.1;
const FP_ENEMY_SCALE_FAR = 2.5;

export type FirstPersonCombatCameraState = {
  pullBack: number;
  fov: number;
};

export function createFirstPersonCombatCameraState(): FirstPersonCombatCameraState {
  return { pullBack: 0, fov: FP_CAMERA_FOV };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

function smoothToward(
  current: number,
  target: number,
  deltaSeconds: number,
  speed: number,
): number {
  const t = 1 - Math.exp(-speed * Math.max(0, deltaSeconds));
  return lerp(current, target, t);
}

function horizontalDistanceXZ(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  return Math.hypot(ax - bx, az - bz);
}

function computeCombatPullback(distanceToTarget: number | null): number {
  if (distanceToTarget === null) {
    return 0;
  }
  if (distanceToTarget >= FP_PULLBACK_FAR) {
    return 0;
  }
  if (distanceToTarget <= FP_PULLBACK_NEAR) {
    return FP_PULLBACK_MAX;
  }
  const t =
    (FP_PULLBACK_FAR - distanceToTarget) /
    (FP_PULLBACK_FAR - FP_PULLBACK_NEAR);
  return FP_PULLBACK_MAX * clamp01(t);
}

function computeCombatFov(pullBack: number): number {
  if (pullBack <= 0.001) {
    return FP_CAMERA_FOV;
  }
  return lerp(FP_CAMERA_FOV, FP_CAMERA_FOV_COMBAT_MAX, pullBack / FP_PULLBACK_MAX);
}

/**
 * Pull the camera slightly backward and widen FOV when a melee target is very close.
 * Keeps billboards readable without filling the entire screen.
 */
export function updateFirstPersonCombatCamera(
  cameraYaw: number,
  playerPos: Vector3,
  eyeHeight: number,
  combatTargetPos: Vector3 | null,
  deltaSeconds: number,
  state: FirstPersonCombatCameraState,
): { position: Vector3; fov: number; state: FirstPersonCombatCameraState } {
  const distanceToTarget =
    combatTargetPos === null
      ? null
      : horizontalDistanceXZ(
          playerPos.x,
          playerPos.z,
          combatTargetPos.x,
          combatTargetPos.z,
        );

  const targetPullBack = computeCombatPullback(distanceToTarget);
  const targetFov = computeCombatFov(targetPullBack);

  const pullBack = smoothToward(state.pullBack, targetPullBack, deltaSeconds, 10);
  const fov = smoothToward(state.fov, targetFov, deltaSeconds, 8);

  const forwardX = Math.sin(cameraYaw);
  const forwardZ = Math.cos(cameraYaw);

  const position = new Vector3(
    playerPos.x - forwardX * pullBack,
    playerPos.y + eyeHeight,
    playerPos.z - forwardZ * pullBack,
  );

  return {
    position,
    fov,
    state: { pullBack, fov },
  };
}

/** Shrink enemy billboards in FP when point-blank so they don't dominate the view. */
export function getFirstPersonEnemyProximityScale(distanceToPlayer: number): number {
  if (distanceToPlayer >= FP_ENEMY_SCALE_FAR) {
    return 1;
  }
  if (distanceToPlayer <= FP_ENEMY_SCALE_NEAR) {
    return FP_ENEMY_SCALE_MIN;
  }
  const t =
    (distanceToPlayer - FP_ENEMY_SCALE_NEAR) /
    (FP_ENEMY_SCALE_FAR - FP_ENEMY_SCALE_NEAR);
  return lerp(FP_ENEMY_SCALE_MIN, 1, t);
}
