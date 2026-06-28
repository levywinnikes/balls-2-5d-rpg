/** Keep in sync with `geometry.worker.ts` STEP_COUNT. */
export const STAIR_STEP_COUNT = 8;

export const STAIR_LEVEL_HEIGHT_UNITS = 2.0;

/** North edge of tile — `localZ` near 0; climb up and descend both finish here. */
export const STAIR_TOP_EDGE_Z = 0.14;

export type StairTileDef = {
  stairDir?: "up" | "down";
  geometryProfile?: string;
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
  const stepIndex = Math.min(
    stepCount - 1,
    Math.floor((1 - lz) * stepCount),
  );
  const stepRise = levelHeightUnits / stepCount;

  if (stairDir === "up") {
    // Top step aligns with next floor: levelBaseY + levelHeight + floorRim.
    return levelBaseY + floorRim + (stepIndex + 1) * stepRise;
  }

  // Down: south = current floor; north approaches floor below after transition.
  return levelBaseY + floorRim - stepIndex * stepRise;
}

export type StairTransitionProbe = {
  targetLevel: string;
};

export function probeStairLevelTransition(
  worldX: number,
  worldZ: number,
  activeLevel: string,
  getTile: (level: string, tileX: number, tileY: number) => string | null,
  getTileDef: (symbol: string | null) => StairTileDef | null | undefined,
  options: {
    parseLevelNumber: (level: string) => number;
    hasLevel: (level: string) => boolean;
  },
): StairTransitionProbe | null {
  const tileX = Math.floor(worldX);
  const tileZ = Math.floor(worldZ);
  const symbol = getTile(activeLevel, tileX, tileZ);
  const tileDef = getTileDef(symbol);
  const stairDir = tileDef?.stairDir;
  if (!stairDir && tileDef?.geometryProfile !== "stair") {
    return null;
  }

  const localZ = worldZ - tileZ;
  const current = options.parseLevelNumber(activeLevel);

  if (stairDir === "up" && localZ <= STAIR_TOP_EDGE_Z) {
    const targetLevel = String(current + 1);
    if (options.hasLevel(targetLevel)) {
      return { targetLevel };
    }
  }

  // Descend by walking north — same travel axis as climbing up.
  if (stairDir === "down" && localZ <= STAIR_TOP_EDGE_Z) {
    const targetLevel = String(current - 1);
    if (options.hasLevel(targetLevel)) {
      return { targetLevel };
    }
  }

  return null;
}
