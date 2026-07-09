import { CollisionWorld } from "./CollisionWorld";
import { type PlayerContext, HERO_BODY_HEIGHT, inferLevelFromFootY, STEP_UP_LIMIT } from "./PlayerContext";

// ── Types ───────────────────────────────────────────────────────────────────

export interface FallSafetyDeps {
  collisionWorld: CollisionWorld;
  allLevels: () => string[];
  getMapTileAt: (level: string, tx: number, tz: number) => string | null;
  getTileDef: (symbol: string | null) => Record<string, unknown> | null | undefined;
  hasLevel: (level: string) => boolean;
  parseLevelNumber: (level: string) => number;
}

export type FallSafetyAction =
  | { type: "none" }
  | { type: "teleport_to_safe"; safeX: number; safeZ: number }
  | { type: "begin_void_fall"; landingLevel: string; floors: number };

// ── Public API ──────────────────────────────────────────────────────────────

/** True when there is no walkable surface on the player's current BMS level at (x,z). */
export function isStandingOnVoidAtLevel(
  cw: CollisionWorld,
  x: number,
  z: number,
  footY: number,
  allLevels: string[],
): boolean {
  const curLevel = inferLevelFromFootY(footY, allLevels);
  const headY = footY + HERO_BODY_HEIGHT;
  const floor = cw.queryFloor(
    x,
    z,
    footY - 0.5,
    headY,
    [curLevel],
    footY + STEP_UP_LIMIT,
  );
  return !floor;
}

/**
 * Evaluate whether the player is standing on void and what
 * the fall-safety system should do about it.
 *
 * Mutates `ctx.lastSafePositionX/Z` and `ctx.wasOnVoidWithSafety`.
 */
export function evaluateVoidSafety(
  ctx: PlayerContext,
  x: number,
  z: number,
  footY: number,
  deps: FallSafetyDeps,
): FallSafetyAction {
  const allLevels = deps.allLevels();
  const onVoid = isStandingOnVoidAtLevel(
    deps.collisionWorld,
    x,
    z,
    footY,
    allLevels,
  );

  // Not on void — track safe position, no action
  if (!onVoid) {
    ctx.lastSafePositionX = x;
    ctx.lastSafePositionZ = z;
    ctx.wasOnVoidWithSafety = false;
    return { type: "none" };
  }

  // Already airborne / falling — let gravity handle it
  if (!ctx.isGrounded || ctx.holeFallLandingLevel) {
    return { type: "none" };
  }

  // Fall-safety ON — teleport back to last known safe tile
  if (ctx.isFallSafetyEnabled) {
    if (!ctx.wasOnVoidWithSafety) {
      ctx.wasOnVoidWithSafety = true;
    }
    return {
      type: "teleport_to_safe",
      safeX: ctx.lastSafePositionX,
      safeZ: ctx.lastSafePositionZ,
    };
  }

  // Fall-safety OFF — probe for a walkable tile below
  {
    const curLevel = inferLevelFromFootY(footY, deps.allLevels());
    const landing = probeVoidLanding(
      Math.floor(x), Math.floor(z), curLevel, deps,
    );
    if (landing) {
      return { type: "begin_void_fall", ...landing };
    }
  }

  return { type: "none" };
}

// ── Internal ────────────────────────────────────────────────────────────────

function probeVoidLanding(
  tx: number,
  tz: number,
  curLevel: string,
  deps: FallSafetyDeps,
): { landingLevel: string; floors: number } | null {
  const base = deps.parseLevelNumber(curLevel);
  const worldX = tx + 0.5;
  const worldZ = tz + 0.5;
  for (let i = 1; i <= 5; i++) {
    const below = String(base - i);
    if (!deps.hasLevel(below)) continue;
    const floor = deps.collisionWorld.queryFloor(
      worldX,
      worldZ,
      -999,
      999,
      [below],
    );
    if (floor) {
      return { landingLevel: below, floors: i };
    }
  }
  return null;
}
