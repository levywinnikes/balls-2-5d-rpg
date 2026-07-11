import { type PlayerContext, inferLevelFromFootY, levelToWorldY, HERO_BODY_HEIGHT } from "./PlayerContext";
import { LEVEL_HEIGHT, WALK_SURFACE, FEET_CLEARANCE } from "../../constants/World";
import { isGradedWalkTile } from "./CollisionWorld";
import { probeHoleLevelTransition } from "./StairConfig3D";
import { WorldMapService } from "../../services/WorldMapService";
import type { GameContext } from "./GameContext";
import type { SliceMapData } from "./SliceTileTypes";

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
  | { type: "begin_fall"; targetLevel: string; floors: number; cooldown: number };

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

  // True 3D: always natural fall. Player drops straight down.
  // The physics system handles gravity, collision, and fall damage.
  return { type: "begin_fall", targetLevel: probe.targetLevel, floors: 1, cooldown: 0.35 };
}

// ── Level-change orchestrator (side-effect heavy: streaming, rendering, physics) ──

export interface LevelTransitionConfig {
  ctx: GameContext;
  ensureMapLevelReady: (level: string) => Promise<unknown>;
  loadLevelBinary: (level: string, mapData: SliceMapData) => Promise<Uint8Array | null>;
  hasLevelBinary: (level: string) => boolean;
}

export interface LevelTransitionCallbacks {
  applyActiveLevelChange: (newLevel: string, transition?: {
    tileX: number;
    tileZ: number;
    landingLocalZ: number;
    guardMs?: number;
  }, options?: { natural?: boolean }) => void;
  syncLevelSideEffects: () => void;
  snapPlayerFootToActiveLevel: () => void;
  snapFootToGradedSurface: () => void;
}

export function createLevelTransitionSystem(cfg: LevelTransitionConfig): LevelTransitionCallbacks {
  const { ctx, ensureMapLevelReady, loadLevelBinary, hasLevelBinary } = cfg;
  let lastSideEffectLevel: string | null = null;
  const CHUNK_UPDATE_INTERVAL = 0.2;

  const getGroundFootY = (worldX: number, worldZ: number, level: string) => {
    const floor = ctx.collisionWorld.queryFloor(
      worldX, worldZ,
      levelToWorldY(level),
      levelToWorldY(level) + LEVEL_HEIGHT,
      [level],
    );
    return floor ? floor.footY : levelToWorldY(level) + WALK_SURFACE + FEET_CLEARANCE;
  };

  const snapPlayerFootToActiveLevel = () => {
    const currentLevel = ctx.getCurrentLevel();
    const footY = hasLevelBinary(currentLevel)
      ? getGroundFootY(ctx.player.position.x, ctx.player.position.z, currentLevel)
      : levelToWorldY(currentLevel) + WALK_SURFACE + FEET_CLEARANCE;
    ctx.player.position.y = footY;
    ctx.verticalVelocity = 0;
    ctx.isGrounded = true;
    ctx.lastGroundedFootY = footY;
  };

  const applyActiveLevelChange = (
    newLevel: string,
    transition?: {
      tileX: number;
      tileZ: number;
      landingLocalZ: number;
      guardMs?: number;
    },
    options?: { natural?: boolean },
  ) => {
    if (newLevel === lastSideEffectLevel) {
      return;
    }
    const previousLevel = lastSideEffectLevel ?? newLevel;
    lastSideEffectLevel = newLevel;
    const natural = options?.natural === true;
    ctx.playerState.setCurrentLevel(newLevel);
    WorldMapService.ensureLevelBuffer(newLevel);

    if (transition) {
      ctx.player.position.z = transition.tileZ + transition.landingLocalZ;
      ctx.player.position.x = Math.min(
        ctx.mapMaxX,
        Math.max(ctx.mapMinX + 0.5, transition.tileX + 0.5),
      );
      ctx.verticalTransitionGuard = {
        untilMs: performance.now() + (transition.guardMs ?? 2800),
        tileX: transition.tileX,
        tileZ: transition.tileZ,
        fromLevel: previousLevel,
        toLevel: newLevel,
      };
    }

    if (natural) {
      ctx.visibilitySystem.invalidateCache();
      ctx.chunkSystem.tick(CHUNK_UPDATE_INTERVAL);
    } else {
      ctx.chunkSystem.clearAll();
      ctx.visibilitySystem.invalidateCache();
      snapPlayerFootToActiveLevel();
    }
    const mapData = ctx.mapDataCache;
    if (mapData) {
      void loadLevelBinary(newLevel, mapData).then(() => {
        if (!natural) {
          snapPlayerFootToActiveLevel();
        }
        ctx.orchestrator.reanchorLevel(newLevel);
        ctx.chunkSystem.tick(CHUNK_UPDATE_INTERVAL);
      });
    }
    if (!natural) {
      void ensureMapLevelReady(newLevel);
    } else {
      ctx.navigationSystem.rebuildWindow(newLevel);
    }
    void ctx.doorSystem.ensureLevelSeeded(newLevel);
    ctx.orchestrator.seedLevel(newLevel);
    ctx.orchestrator.seedAdjacentLevels(newLevel);
    ctx.enemySystem.syncStream(true);
    ctx.propSystem.syncStream(true);
    ctx.telemetryLogger.pushLogEvent("level.change", {
      from: previousLevel,
      to: newLevel,
      playerX: Math.round(ctx.player.position.x * 100) / 100,
      playerZ: Math.round(ctx.player.position.z * 100) / 100,
    });
  };

  const snapFootToGradedSurface = () => {
    const mapData = ctx.mapDataCache;
    if (!mapData?.levels) { ctx.isGrounded = false; return; }
    const floor = ctx.collisionWorld.queryFloor(
      ctx.player.position.x,
      ctx.player.position.z,
      ctx.player.position.y - 0.45,
      ctx.player.position.y + HERO_BODY_HEIGHT,
      Object.keys(mapData.levels),
      ctx.player.position.y + 0.45,
    );
    if (!floor) {
      ctx.isGrounded = false;
      return;
    }
    if (floor.footY > ctx.player.position.y + 0.45) {
      ctx.isGrounded = false;
      return;
    }
    const aquatic = ctx.getAquaticSampleAt(ctx.player.position.x, ctx.player.position.z, floor.level);
    if (aquatic.mode === "dry") {
      ctx.player.position.y = floor.footY;
    } else {
      ctx.player.position.y = floor.footY + aquatic.sinkOffset;
    }
    if (floor.level !== ctx.getCurrentLevel()) {
      applyActiveLevelChange(floor.level, undefined, { natural: true });
    }
  };

  const syncLevelSideEffects = () => {
    if (!ctx.worldBootstrapReady) return;
    const mapData = ctx.mapDataCache;
    if (!mapData?.levels) return;
    if (ctx.holeFallLandingLevel || ctx.isPlayerOverVoidAtLevel(ctx.getCurrentLevel())) return;
    if (ctx.levelTransitionCooldown > 0) return;

    const currentLevel = ctx.getCurrentLevel();
    if (currentLevel !== lastSideEffectLevel) {
      ctx.levelTransitionCooldown = 0.35;
      applyActiveLevelChange(currentLevel, undefined, { natural: true });
      snapFootToGradedSurface();
    }
  };

  return { applyActiveLevelChange, syncLevelSideEffects, snapPlayerFootToActiveLevel, snapFootToGradedSurface };
}
