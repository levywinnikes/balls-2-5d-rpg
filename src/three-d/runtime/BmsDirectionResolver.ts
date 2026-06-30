import { Camera, Matrix, Scene, Vector2, Vector3 } from "@babylonjs/core";
import {
  resolveHeroBmsDirection,
  type HeroBmsDirection,
} from "./TwoDParitySpriteFactory";

export type BmsDirectionContext = {
  scene: Scene;
  camera: Camera;
  /** World position used as projection origin (enemy feet, etc.). */
  origin: Vector3;
};

/**
 * Screen ↔ world basis at `origin` — must stay in sync with hero WASD movement
 * in createDebugSliceScene.ts (top-down branch).
 */
function getScreenMovementBasis(
  scene: Scene,
  camera: Camera,
  origin: Vector3,
): { basisX: Vector2; basisZ: Vector2; det: number } | null {
  const engine = scene.getEngine();
  const viewport = camera.viewport.toGlobal(
    engine.getRenderWidth(),
    engine.getRenderHeight(),
  );
  const transform = scene.getTransformMatrix();

  const screenOrigin = Vector3.Project(
    origin,
    Matrix.Identity(),
    transform,
    viewport,
  );
  const screenX = Vector3.Project(
    origin.add(new Vector3(1, 0, 0)),
    Matrix.Identity(),
    transform,
    viewport,
  );
  const screenZ = Vector3.Project(
    origin.add(new Vector3(0, 0, 1)),
    Matrix.Identity(),
    transform,
    viewport,
  );

  const basisX = new Vector2(
    screenX.x - screenOrigin.x,
    screenX.y - screenOrigin.y,
  );
  const basisZ = new Vector2(
    screenZ.x - screenOrigin.x,
    screenZ.y - screenOrigin.y,
  );
  const det = basisX.x * basisZ.y - basisX.y * basisZ.x;
  if (Math.abs(det) < 1e-6) {
    return null;
  }
  return { basisX, basisZ, det };
}

/**
 * Inverse of hero movement: world (deltaX, deltaZ) → screen (moveRight, moveForward).
 * Uses the same basis + determinant as player WASD → world movement.
 */
export function resolveBmsDirectionFromWorldDelta(
  deltaX: number,
  deltaZ: number,
  fallback: HeroBmsDirection,
  context: BmsDirectionContext,
): HeroBmsDirection {
  if (Math.abs(deltaX) < 0.001 && Math.abs(deltaZ) < 0.001) {
    return fallback;
  }

  const basis = getScreenMovementBasis(
    context.scene,
    context.camera,
    context.origin,
  );
  if (!basis) {
    return fallback;
  }

  const { basisX, basisZ } = basis;

  // Inverse of hero WASD (createDebugSliceScene): desired = (moveRight, -moveForward),
  // world delta = linear combo of basisX/basisZ with det normalization on forward pass.
  const moveRight = basisX.x * deltaX + basisZ.x * deltaZ;
  const moveForward = -(basisX.y * deltaX + basisZ.y * deltaZ);

  return resolveHeroBmsDirection(moveForward, moveRight, fallback);
}

/** @deprecated Top-down-only fallback for unit tests. */
export function resolveWorldBmsDirectionTopDownOnly(
  deltaX: number,
  deltaZ: number,
  fallback: HeroBmsDirection,
): HeroBmsDirection {
  if (Math.abs(deltaX) < 0.001 && Math.abs(deltaZ) < 0.001) {
    return fallback;
  }
  const screenRight = -deltaX;
  const screenUp = -deltaZ;
  if (Math.abs(screenUp) >= Math.abs(screenRight)) {
    return screenUp > 0 ? "north" : "south";
  }
  return screenRight > 0 ? "east" : "west";
}

/** FP look yaw for idle hero facing (matches FP forward = sin/cos on XZ). */
export function bmsDirectionToFirstPersonYaw(direction: HeroBmsDirection): number {
  switch (direction) {
    case "north":
      return Math.PI;
    case "east":
      return -Math.PI / 2;
    case "west":
      return Math.PI / 2;
    case "south":
    default:
      return 0;
  }
}

/** Map FP camera yaw back to hero sprite BMS direction. */
export function firstPersonYawToBmsDirection(
  yaw: number,
  fallback: HeroBmsDirection = "south",
): HeroBmsDirection {
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);
  return resolveWorldBmsDirectionTopDownOnly(forwardX, forwardZ, fallback);
}
