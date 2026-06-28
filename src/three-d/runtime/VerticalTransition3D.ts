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
  if (!tileDef?.levelTransition) {
    return false;
  }
  const profile = tileDef.geometryProfile;
  if (
    profile !== "ramp-n" &&
    profile !== "ramp-s" &&
    profile !== "ramp-e" &&
    profile !== "ramp-w"
  ) {
    return false;
  }
  return resolveTileRampRise(tileDef) >= levelHeightUnits - 0.08;
}

export function isAtRampTransitionEdge(
  worldX: number,
  worldZ: number,
  tileDef?: SliceTileDefinition | null,
): boolean {
  const profile = tileDef?.geometryProfile;
  const transition = tileDef?.levelTransition;
  if (!profile?.startsWith("ramp-") || !transition) {
    return false;
  }

  const lx = worldX - Math.floor(worldX);
  const lz = worldZ - Math.floor(worldZ);
  const t = RAMP_EDGE_THRESHOLD;

  if (transition === "up") {
    if (profile === "ramp-n") {
      return lz >= t;
    }
    if (profile === "ramp-s") {
      return lz <= 1 - t;
    }
    if (profile === "ramp-e") {
      return lx >= t;
    }
    return lx <= 1 - t;
  }

  if (profile === "ramp-n") {
    return lz <= 1 - t;
  }
  if (profile === "ramp-s") {
    return lz >= t;
  }
  if (profile === "ramp-e") {
    return lx <= 1 - t;
  }
  return lx >= t;
}

export function resolveRampTransitionTargetLevel(
  activeLevel: string,
  tileDef: SliceTileDefinition,
  parseLevelNumber: (level: string) => number,
): string {
  const current = parseLevelNumber(activeLevel);
  const delta = tileDef.levelTransition === "up" ? 1 : -1;
  return String(current + delta);
}

export function shouldStartLedgeFall(
  currentFootY: number,
  targetFootY: number,
  threshold = LEDGE_FALL_THRESHOLD,
): boolean {
  return currentFootY - targetFootY > threshold;
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
  const symbol = getTile(activeLevel, tileX, tileZ);
  const tileDef = getTileDef(symbol);
  if (!tileDef?.levelTransition) {
    return null;
  }
  if (!isFloorLevelRamp(tileDef, options.levelHeightUnits)) {
    return null;
  }
  if (!isAtRampTransitionEdge(worldX, worldZ, tileDef)) {
    return null;
  }

  const targetLevel = resolveRampTransitionTargetLevel(
    activeLevel,
    tileDef,
    options.parseLevelNumber,
  );
  if (!options.hasLevel(targetLevel)) {
    return null;
  }

  return { targetLevel, tileDef };
}
