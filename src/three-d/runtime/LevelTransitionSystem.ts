import { type PlayerContext, inferLevelFromFootY } from "./PlayerContext";
import { LEVEL_HEIGHT } from "../../constants/World";
import { isGradedWalkTile } from "./CollisionWorld";
import { probeHoleLevelTransition } from "./StairConfig3D";

// ── Types ───────────────────────────────────────────────────────────────────

export interface LevelTransitionQueries {
  getMapTileAt: (level: string, tx: number, tz: number) => string | null;
  getTileDef: (symbol: string | null) => Record<string, unknown> | null | undefined;
  hasLevel: (level: string) => boolean;
  parseLevelNumber: (level: string) => number;
  allLevels: () => string[];
}

export type HoleTransitionAction =
  | { type: "none" }
  | { type: "begin_fall"; targetLevel: string; floors: number; cooldown: number }
  | {
      type: "warp";
      fromLevel: string;
      toLevel: string;
      tileX: number;
      tileZ: number;
      landingLocalZ: number;
      cooldown: number;
      guardMs: number;
    };

// ── Public API ──────────────────────────────────────────────────────────────

export function probeHoleTransition(
  ctx: PlayerContext,
  x: number,
  z: number,
  footY: number,
  q: LevelTransitionQueries,
): HoleTransitionAction {
  if (ctx.levelTransitionCooldown > 0 || ctx.holeFallLandingLevel) {
    return { type: "none" };
  }

  // Allow non-grounded transitions only on graded walk tiles with low vertical velocity
  if (!ctx.isGrounded) {
    const curLevel = inferLevelFromFootY(footY, q.allLevels());
    const sym = q.getMapTileAt(curLevel, Math.floor(x), Math.floor(z));
    const def = sym ? q.getTileDef(sym) : undefined;
    if (!(def && isGradedWalkTile(def, LEVEL_HEIGHT) && Math.abs(ctx.verticalVelocity) < 3.0)) {
      return { type: "none" };
    }
  }

  const curLevel = inferLevelFromFootY(footY, q.allLevels());
  const probe = probeHoleLevelTransition(
    x, z, curLevel,
    q.getMapTileAt,
    q.getTileDef,
    { parseLevelNumber: q.parseLevelNumber, hasLevel: q.hasLevel },
  );
  if (!probe) return { type: "none" };

  if (!ctx.isFallSafetyEnabled) {
    return { type: "begin_fall", targetLevel: probe.targetLevel, floors: 1, cooldown: 0.35 };
  }

  return {
    type: "warp",
    fromLevel: curLevel,
    toLevel: probe.targetLevel,
    tileX: probe.tileX,
    tileZ: probe.tileZ,
    landingLocalZ: probe.landingLocalZ,
    cooldown: 0.65,
    guardMs: 1200,
  };
}
