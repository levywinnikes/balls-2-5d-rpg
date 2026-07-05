import { STAIR_LEVEL_HEIGHT_UNITS } from "./StairConfig3D";
import { WALK_SURFACE } from "../../constants/World";

/** Prevents level flicker when foot Y hovers on a floor boundary. */
export const DEFAULT_LEVEL_FOOT_HYSTERESIS = 0.08;

export type InferLevelFromFootYOptions = {
  levelToWorldY: (level: string) => number;
  parseLevelNumber: (level: string) => number;
  levelHeightUnits?: number;
  /** Walkable top of floor slabs — must match runtime `FLOOR_SURFACE_Y`. */
  floorSurfaceY?: number;
  hysteresis?: number;
};

/**
 * Derive BMS active level from world foot height — no tile probes, no Z snap.
 *
 * Each level N owns the band [floorFoot(N), floorFoot(N+1)) where
 * floorFoot(N) = levelToWorldY(N) + floorSurfaceY.
 * Walking stairs simply moves foot Y through that band; the level follows.
 */
export function inferLevelFromFootY(
  footY: number,
  levelKeys: string[],
  options: InferLevelFromFootYOptions,
): string {
  if (levelKeys.length === 0) {
    return "0";
  }

  const hysteresis = options.hysteresis ?? DEFAULT_LEVEL_FOOT_HYSTERESIS;
  const floorSurfaceY = options.floorSurfaceY ?? WALK_SURFACE;
  const parseLevel = options.parseLevelNumber;

  const sorted = [...levelKeys].sort(
    (a, b) => parseLevel(a) - parseLevel(b),
  );

  let inferred = sorted[0];
  for (const key of sorted) {
    const floorFoot = options.levelToWorldY(key) + floorSurfaceY;
    if (footY >= floorFoot - hysteresis) {
      inferred = key;
    }
  }

  return inferred;
}

export function floorFootWorldY(
  levelKey: string,
  options: Pick<
    InferLevelFromFootYOptions,
    "levelToWorldY" | "floorSurfaceY"
  >,
): number {
  const floorSurfaceY = options.floorSurfaceY ?? WALK_SURFACE;
  return options.levelToWorldY(levelKey) + floorSurfaceY;
}

/** Upper bound of walkable band for level N (exclusive next floor foot). */
export function levelWalkBandTopY(
  levelKey: string,
  options: InferLevelFromFootYOptions,
): number {
  const levelHeight = options.levelHeightUnits ?? STAIR_LEVEL_HEIGHT_UNITS;
  return (
    floorFootWorldY(levelKey, options) + levelHeight
  );
}
