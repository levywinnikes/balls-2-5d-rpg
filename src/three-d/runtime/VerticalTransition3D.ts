import type { SliceTileDefinition } from "./SliceTileTypes";

export const DEFAULT_LEVEL_HEIGHT_UNITS = 2.0;

/** Drop larger than this starts a gravity fall instead of snapping down. */
export const LEDGE_FALL_THRESHOLD = 0.42;

/** How far along a ramp tile (0–1) counts as the transition edge. */
export const RAMP_EDGE_THRESHOLD = 0.86;

export function resolveTileRampRise(
  tileDef?: SliceTileDefinition | null,
  defaultRise = 0.35,
): number {
  if (tileDef?.rampRise != null) {
    return tileDef.rampRise;
  }
  if (tileDef?.height != null && tileDef.height > 0.12) {
    return tileDef.height;
  }
  return defaultRise;
}

export function isFloorLevelRamp(
  tileDef?: SliceTileDefinition | null,
  levelHeightUnits = DEFAULT_LEVEL_HEIGHT_UNITS,
): boolean {
  const profile = tileDef?.geometryProfile;
  if (!profile?.startsWith("ramp-")) {
    return false;
  }
  return resolveTileRampRise(tileDef) >= levelHeightUnits - 0.08;
}

function isRampEdge(
  worldX: number,
  worldZ: number,
  tileDef: SliceTileDefinition,
  edge: "up" | "down",
): boolean {
  const profile = tileDef.geometryProfile;
  const lx = worldX - Math.floor(worldX);
  const lz = worldZ - Math.floor(worldZ);
  const t = RAMP_EDGE_THRESHOLD;

  if (profile === "ramp-n") {
    return edge === "up" ? lz >= t : lz <= 1 - t;
  }
  if (profile === "ramp-s") {
    return edge === "up" ? lz <= 1 - t : lz >= t;
  }
  if (profile === "ramp-e") {
    return edge === "up" ? lx >= t : lx <= 1 - t;
  }
  if (profile === "ramp-w") {
    return edge === "up" ? lx <= 1 - t : lx >= t;
  }
  return false;
}

export function shouldStartLedgeFall(
  currentFootY: number,
  targetFootY: number,
  threshold = LEDGE_FALL_THRESHOLD,
): boolean {
  return currentFootY - targetFootY > threshold;
}

/** Stairs and ramps change foot Y gradually — never treat as a void ledge. */
export function isGradedWalkTile(
  tileDef?: SliceTileDefinition | null,
  levelHeightUnits = DEFAULT_LEVEL_HEIGHT_UNITS,
): boolean {
  if (!tileDef) {
    return false;
  }
  if (tileDef.stairDir || tileDef.geometryProfile === "stair") {
    return true;
  }
  if (isFloorLevelRamp(tileDef, levelHeightUnits)) {
    return true;
  }
  return Boolean(tileDef.geometryProfile?.startsWith("ramp-"));
}

export type RampTransitionProbe = {
  targetLevel: string;
  tileDef: SliceTileDefinition;
};

export function probeRampLevelTransition(
  worldX: number,
  worldZ: number,
  activeLevel: string,
  getTile: (level: string, tileX: number, tileY: number) => string | null,
  getTileDef: (symbol: string | null) => SliceTileDefinition | null | undefined,
  options: {
    parseLevelNumber: (level: string) => number;
    levelHeightUnits?: number;
    hasLevel: (level: string) => boolean;
  },
): RampTransitionProbe | null {
  const tileX = Math.floor(worldX);
  const tileZ = Math.floor(worldZ);
  const levelNum = options.parseLevelNumber(activeLevel);

  // 1. Player on the same level as a ramp → going UP
  const symbol = getTile(activeLevel, tileX, tileZ);
  const tileDef = getTileDef(symbol);
  if (tileDef && isFloorLevelRamp(tileDef, options.levelHeightUnits)) {
    if (isRampEdge(worldX, worldZ, tileDef, "up")) {
      const targetLevel = String(levelNum + 1);
      if (options.hasLevel(targetLevel)) {
        return { targetLevel, tileDef };
      }
    }
  }

  // 2. Player above a ramp (level below has a ramp) → going DOWN
  const belowLevel = String(levelNum - 1);
  const belowSymbol = getTile(belowLevel, tileX, tileZ);
  const belowDef = getTileDef(belowSymbol);
  if (belowDef && isFloorLevelRamp(belowDef, options.levelHeightUnits)) {
    if (isRampEdge(worldX, worldZ, belowDef, "down")) {
      const targetLevel = String(levelNum - 1);
      if (options.hasLevel(targetLevel)) {
        return { targetLevel, tileDef: belowDef };
      }
    }
  }

  return null;
}
