import { Vector3 } from "@babylonjs/core";
import {
  LEVEL_HEIGHT,
  WALK_SURFACE,
  FEET_CLEARANCE,
} from "../../constants/World";
import { HERO_COLLISION_HEIGHT } from "./TwoDParitySpriteFactory";

// ── True 3D physics constants ───────────────────────────────────────────────
export const HERO_BODY_HEIGHT = HERO_COLLISION_HEIGHT;
export const CEILING_BODY_CLEARANCE = 0.14;
export const JUMP_FULL_HEADROOM = 0.85;
export const GRAVITY = -18;
export const FALL_GRAVITY = -32;
export const JUMP_IMPULSE = 7.2;
export const STEP_UP_LIMIT = 0.45;
export const MAP_BORDER_MARGIN = 0.5;
export const PLAYER_RADIUS = 0.32;

/**
 * All mutable state the 3D physics system touches.
 * No rendering, streaming, or UI — pure spatial simulation.
 */
export interface PlayerContext {
  position: Vector3;
  verticalVelocity: number;
  isGrounded: boolean;

  // Fall state
  holeFallLandingLevel: string | null;
  holeFallFloorCount: number;
  fallOriginFootY: number;

  // Fall-safety
  isFallSafetyEnabled: boolean;
  lastSafePositionX: number;
  lastSafePositionZ: number;
  wasOnVoidWithSafety: boolean;

  // Cooldown prevents cascading transitions
  levelTransitionCooldown: number;

  // Last grounded Y for fall-damage calculation
  lastGroundedFootY: number;
}

/** Ephemeral input for one physics tick. */
export interface PhysicsInput {
  moveX: number;
  moveZ: number;
  deltaSeconds: number;
  jumpPressed: boolean;
  sprintHeld: boolean;
  speedMultiplier: number; // 1.0 = normal; <1 = slow (water), >1 = haste
}

export function createPlayerContext(x: number, y: number, z: number): PlayerContext {
  return {
    position: new Vector3(x, y, z),
    verticalVelocity: 0,
    isGrounded: true,
    holeFallLandingLevel: null,
    holeFallFloorCount: 0,
    fallOriginFootY: y,
    isFallSafetyEnabled: true,
    lastSafePositionX: x,
    lastSafePositionZ: z,
    wasOnVoidWithSafety: false,
    levelTransitionCooldown: 0,
    lastGroundedFootY: y,
  };
}

/** Convert level string to world Y. */
export function levelToWorldY(level: string | number): number {
  const n = typeof level === "number" ? level : (Number.parseInt(level, 10) || 0);
  return n * LEVEL_HEIGHT;
}

/** Derive level string from foot Y. True 3D: no stored level. */
export function inferLevelFromFootY(footY: number, allLevels: string[]): string {
  const footLevelNum = Math.floor((footY - WALK_SURFACE - FEET_CLEARANCE) / LEVEL_HEIGHT);
  const candidate = String(footLevelNum);
  if (allLevels.includes(candidate)) return candidate;
  const below = String(footLevelNum - 1);
  if (allLevels.includes(below)) return below;
  const above = String(footLevelNum + 1);
  if (allLevels.includes(above)) return above;
  return allLevels[0] ?? "0";
}
