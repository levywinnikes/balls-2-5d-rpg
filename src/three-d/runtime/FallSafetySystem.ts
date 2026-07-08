import { CollisionWorld, isGradedWalkTile } from "./CollisionWorld";
import { LEVEL_HEIGHT } from "../../constants/World";
import { type PlayerContext, HERO_BODY_HEIGHT, inferLevelFromFootY } from "./PlayerContext";

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
  const onVoid = !deps.collisionWorld.queryFloor(
    x, z, -999, footY + HERO_BODY_HEIGHT, deps.allLevels(),
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
  for (let i = 1; i <= 5; i++) {
    const below = String(base - i);
    if (!deps.hasLevel(below)) continue;
    const sym = deps.getMapTileAt(below, tx, tz);
    const def = sym && sym !== "..." ? deps.getTileDef(sym) : undefined;
    if (def && isGradedWalkTile(def, LEVEL_HEIGHT)) {
      return { landingLevel: below, floors: i };
    }
  }
  return null;
}
