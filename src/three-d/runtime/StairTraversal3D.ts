import { inferLevelFromFootY } from "./NaturalFloorLevel3D";
import type { StairTileDef } from "./StairConfig3D";

/**
 * North edge of stair tile (local Z) where the level boundary is crossed.
 * Widened from 0.38 → 0.5: player reaches the top half of the tile to trigger
 * a level change, giving a more natural FPS-ramp feel.
 */
export const STAIR_EXIT_LOCAL_Z = 0.5;

export type StairLevelSyncOptions = {
  parseLevelNumber: (level: string) => number;
  hasLevel: (level: string) => boolean;
  levelToWorldY: (level: string) => number;
  floorSurfaceY: number;
  levelHeightUnits?: number;
};

export function isStairTileDef(
  tileDef?: StairTileDef | null,
): tileDef is StairTileDef & { stairDir: "up" | "down" } {
  if (!tileDef) {
    return false;
  }
  if (tileDef.stairDir === "up" || tileDef.stairDir === "down") {
    return true;
  }
  return tileDef.geometryProfile === "stair";
}

/**
 * Classic FPS pattern: on a stair tile, crossing the top (north) edge switches the map layer.
 * Fires when localZ <= STAIR_EXIT_LOCAL_Z (player is in the northern portion of the tile).
 * Same X/Z — no teleport.
 */
export function resolveStairLevelAt(
  worldX: number,
  worldZ: number,
  activeLevel: string,
  getTile: (level: string, tileX: number, tileY: number) => string | null,
  getTileDef: (symbol: string | null) => StairTileDef | null | undefined,
  options: StairLevelSyncOptions,
): string | null {
  const tileX = Math.floor(worldX);
  const tileZ = Math.floor(worldZ);
  const symbol = getTile(activeLevel, tileX, tileZ);
  const tileDef = getTileDef(symbol);
  if (!isStairTileDef(tileDef)) {
    return null;
  }

  const localZ = worldZ - tileZ;
  if (tileDef.stairDir === "up") {
    // Up stair: exit is at the north (top) edge: localZ <= STAIR_EXIT_LOCAL_Z
    if (localZ > STAIR_EXIT_LOCAL_Z) {
      return null;
    }
  } else {
    // Down stair: exit is at the south (bottom) edge: localZ >= 1.0 - STAIR_EXIT_LOCAL_Z
    if (localZ < 1.0 - STAIR_EXIT_LOCAL_Z) {
      return null;
    }
  }

  const current = options.parseLevelNumber(activeLevel);
  const delta = tileDef.stairDir === "up" ? 1 : -1;
  const targetLevel = String(current + delta);
  if (!options.hasLevel(targetLevel)) {
    return null;
  }
  return targetLevel;
}

/**
 * Segment sample so sprinting cannot skip the exit band.
 *
 * FIX: If the movement ORIGIN (z0) is already inside the exit zone on a stair
 * tile, the player has already crossed the boundary in a previous frame.
 * Return null immediately to prevent re-triggering every tick while the
 * player walks/stands inside the zone — the root cause of the floor-cascade bug.
 */
export function resolveStairLevelAlongSegment(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  activeLevel: string,
  getTile: (level: string, tileX: number, tileY: number) => string | null,
  getTileDef: (symbol: string | null) => StairTileDef | null | undefined,
  options: StairLevelSyncOptions,
): string | null {
  const startTileX = Math.floor(x0);
  const startTileZ = Math.floor(z0);
  const startSymbol = getTile(activeLevel, startTileX, startTileZ);
  const startTileDef = getTileDef(startSymbol);

  if (isStairTileDef(startTileDef)) {
    const startLocalZ = z0 - startTileZ;
    if (startTileDef.stairDir === "up") {
      if (startLocalZ <= STAIR_EXIT_LOCAL_Z) {
        return null;
      }
    } else {
      if (startLocalZ >= 1.0 - STAIR_EXIT_LOCAL_Z) {
        return null;
      }
    }
  }

  const travel = Math.hypot(x1 - x0, z1 - z0);
  const steps = Math.max(1, Math.ceil(travel / 0.04));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const level = resolveStairLevelAt(
      x0 + (x1 - x0) * t,
      z0 + (z1 - z0) * t,
      activeLevel,
      getTile,
      getTileDef,
      options,
    );
    if (level) {
      return level;
    }
  }
  return null;
}

/** Map layer from foot height when not on a stair exit (holes, ramps, post-landing). */
export function resolveLevelFromFootHeight(
  footY: number,
  levelKeys: string[],
  options: StairLevelSyncOptions,
): string {
  return inferLevelFromFootY(footY, levelKeys, {
    levelToWorldY: options.levelToWorldY,
    parseLevelNumber: options.parseLevelNumber,
    levelHeightUnits: options.levelHeightUnits,
    floorSurfaceY: options.floorSurfaceY,
  });
}

export type VerticalLevelSyncInput = {
  footY: number;
  worldX: number;
  worldZ: number;
  moveStartX: number;
  moveStartZ: number;
  didMove: boolean;
  activeLevel: string;
  levelKeys: string[];
  getTile: (level: string, tileX: number, tileY: number) => string | null;
  getTileDef: (symbol: string | null) => StairTileDef | null | undefined;
  options: StairLevelSyncOptions;
};

/**
 * Pick the BMS level after movement: stair exit crossing first, then foot-height bands.
 *
 * ARCHITECTURE NOTE — why no static resolveStairLevelAt fallback:
 *   The old code called resolveStairLevelAt unconditionally after the segment check.
 *   That caused the trigger to fire every single frame while the player stood anywhere
 *   inside the exit zone (localZ <= threshold), cascading through multiple floors on
 *   stacked stair tiles. The segment-based check with the start-in-zone guard now
 *   handles crossing correctly, and foot-height (inferLevelFromFootY) handles static
 *   inference without the cascade problem.
 */
export function resolveVerticalLevelAfterMove(
  input: VerticalLevelSyncInput,
): string {
  const { options } = input;

  // Only check for stair crossing when the player actually moved.
  // The segment check itself guards against re-firing when starting inside the zone.
  if (input.didMove) {
    const fromStair = resolveStairLevelAlongSegment(
      input.moveStartX,
      input.moveStartZ,
      input.worldX,
      input.worldZ,
      input.activeLevel,
      input.getTile,
      input.getTileDef,
      options,
    );
    if (fromStair) {
      return fromStair;
    }
  }

  // If the player is currently standing/moving on a stair tile, do NOT let foot-height
  // inference downgrade or upgrade the level. Only explicit boundary transitions
  // (segment crossing checked above) can change the level on a stair tile.
  const currentTileX = Math.floor(input.worldX);
  const currentTileZ = Math.floor(input.worldZ);
  const currentSymbol = input.getTile(input.activeLevel, currentTileX, currentTileZ);
  const currentTileDef = input.getTileDef(currentSymbol);
  if (isStairTileDef(currentTileDef)) {
    return input.activeLevel;
  }

  // Over a void tile (floor hole): keep the current map layer until gravity landing.
  // Foot-height bands would snap activeLevel down while Y is still in the air.
  if (!currentSymbol || currentSymbol === "...") {
    return input.activeLevel;
  }

  // Foot-height inference: each level owns the Y band [floorFoot(N), floorFoot(N+1)).
  // At the top of a staircase, foot Y reaches the next level's floor band naturally.
  return resolveLevelFromFootHeight(
    input.footY,
    input.levelKeys,
    options,
  );
}
