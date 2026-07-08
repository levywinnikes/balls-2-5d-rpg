import { LEVEL_HEIGHT } from "../../constants/World";

/** Keep in sync with `geometry.worker.ts` STEP_COUNT. */
export const STAIR_STEP_COUNT = 8;

/** @deprecated Use `LEVEL_HEIGHT` from `constants/World` instead. */
export const STAIR_LEVEL_HEIGHT_UNITS = LEVEL_HEIGHT;

/**
 * @deprecated Stair level changes use foot height (`inferLevelFromFootY`), not edge probes.
 * Kept for hole landing snap and legacy tests.
 */
export const STAIR_TOP_EDGE_Z = 0.32;

/** @deprecated Used only for void/hole landings — not stair teleports. */
export const STAIR_LANDING_LOCAL_Z = 0.72;

/** Holes only pull the player down when they step into the north portion of the tile. */
export const HOLE_DESCEND_EDGE_Z = 0.35;

export type StairTileDef = {
  stairDir?: "up" | "down";
  geometryProfile?: string;
  transition?: "up" | "down" | "dwn";
  id?: string;
};

export function sampleStairFootY(
  levelBaseY: number,
  localZ: number,
  stepCount = STAIR_STEP_COUNT,
  levelHeightUnits = STAIR_LEVEL_HEIGHT_UNITS,
  stairDir: "up" | "down" = "up",
  floorRim = 0.06,
): number {
  const lz = Math.max(0, Math.min(0.999, localZ));
  const stepRise = levelHeightUnits / stepCount;

  if (stairDir === "up") {
    const progress = (1 - lz) * stepCount;
    const risenSteps = Math.min(
      stepCount,
      Math.max(1, Math.ceil(progress - 1e-6)),
    );
    return levelBaseY + floorRim + risenSteps * stepRise;
  }

  // Down: physical slope is the same (low at south, high at north), but offset by -levelHeightUnits.
  const progress = (1 - lz) * stepCount;
  const risenSteps = Math.min(
    stepCount,
    Math.max(1, Math.ceil(progress - 1e-6)),
  );
  return levelBaseY - levelHeightUnits + floorRim + risenSteps * stepRise;
}

export type VerticalTransitionProbe = {
  targetLevel: string;
  kind: "stair-up" | "stair-down" | "hole-down";
  tileX: number;
  tileZ: number;
  landingLocalZ: number;
};

/** @deprecated Use VerticalTransitionProbe */
export type StairTransitionProbe = VerticalTransitionProbe;

/**
 * @deprecated Stairs change level via continuous foot height — see `inferLevelFromFootY`.
 * Do not call from gameplay loop.
 */
export function probeStairLevelTransition(
  worldX: number,
  worldZ: number,
  currentLevel: string,
  getTile: (level: string, tileX: number, tileY: number) => string | null,
  getTileDef: (symbol: string | null) => StairTileDef | null | undefined,
  options: {
    parseLevelNumber: (level: string) => number;
    hasLevel: (level: string) => boolean;
  },
): VerticalTransitionProbe | null {
  const tileX = Math.floor(worldX);
  const tileZ = Math.floor(worldZ);
  const symbol = getTile(currentLevel, tileX, tileZ);
  const tileDef = getTileDef(symbol);
  const stairDir = tileDef?.stairDir;
  if (!stairDir && tileDef?.geometryProfile !== "stair") {
    return null;
  }

  const localZ = worldZ - tileZ;
  const current = options.parseLevelNumber(currentLevel);

  if (stairDir === "up" && localZ <= STAIR_TOP_EDGE_Z) {
    const targetLevel = String(current + 1);
    if (options.hasLevel(targetLevel)) {
      return {
        targetLevel,
        kind: "stair-up",
        tileX,
        tileZ,
        landingLocalZ: STAIR_LANDING_LOCAL_Z,
      };
    }
  }

  // Descend by walking north — same travel axis as climbing up.
  if (stairDir === "down" && localZ <= STAIR_TOP_EDGE_Z) {
    const targetLevel = String(current - 1);
    if (options.hasLevel(targetLevel)) {
      return {
        targetLevel,
        kind: "stair-down",
        tileX,
        tileZ,
        landingLocalZ: STAIR_LANDING_LOCAL_Z,
      };
    }
  }

  return null;
}

/** Sample the travel segment so fast movement cannot skip the narrow north-edge band. */
export function probeStairLevelTransitionAlongSegment(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  currentLevel: string,
  getTile: (level: string, tileX: number, tileY: number) => string | null,
  getTileDef: (symbol: string | null) => StairTileDef | null | undefined,
  options: {
    parseLevelNumber: (level: string) => number;
    hasLevel: (level: string) => boolean;
  },
): VerticalTransitionProbe | null {
  const travel = Math.hypot(x1 - x0, z1 - z0);
  const steps = Math.max(1, Math.ceil(travel / 0.05));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const probe = probeStairLevelTransition(
      x0 + (x1 - x0) * t,
      z0 + (z1 - z0) * t,
      currentLevel,
      getTile,
      getTileDef,
      options,
    );
    if (probe) {
      return probe;
    }
  }
  return null;
}

/** Holes / manholes (`hol`, `transition: "down"`). */
export function probeHoleLevelTransition(
  worldX: number,
  worldZ: number,
  currentLevel: string,
  getTile: (level: string, tileX: number, tileY: number) => string | null,
  getTileDef: (symbol: string | null) => StairTileDef | null | undefined,
  options: {
    parseLevelNumber: (level: string) => number;
    hasLevel: (level: string) => boolean;
  },
): VerticalTransitionProbe | null {
  const tileX = Math.floor(worldX);
  const tileZ = Math.floor(worldZ);
  const symbol = getTile(currentLevel, tileX, tileZ);
  const tileDef = getTileDef(symbol);
  const goesDown =
    tileDef?.transition === "down" ||
    tileDef?.transition === "dwn" ||
    tileDef?.id === "hole";
  if (!goesDown) {
    return null;
  }

  const localZ = worldZ - tileZ;
  if (localZ > HOLE_DESCEND_EDGE_Z) {
    return null;
  }

  const targetLevel = String(options.parseLevelNumber(currentLevel) - 1);
  if (!options.hasLevel(targetLevel)) {
    return null;
  }
  return {
    targetLevel,
    kind: "hole-down",
    tileX,
    tileZ,
    landingLocalZ: STAIR_LANDING_LOCAL_Z,
  };
}
