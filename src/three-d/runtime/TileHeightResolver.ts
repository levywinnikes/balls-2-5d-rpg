import type { SliceTileDefinition } from "./SliceTileTypes";

export const DEFAULT_LEVEL_HEIGHT_UNITS = 2.0;
export const DEFAULT_FLOOR_SURFACE_Y = 0.32;

export function resolveRampRise(
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
  return resolveRampRise(tileDef) >= levelHeightUnits - 0.08;
}

export interface ResolvedTileHeight {
  /** levelOffsetY sent to geometry worker (yBot of tile) */
  levelOffsetY: number;
  /** effective height sent to geometry worker (already adjusted for floor ramps) */
  height: number;
  /** base Y for surface queries (levelBaseY + walkSurface for floor-level ramps) */
  surfaceBaseY: number;
  isFloorRamp: boolean;
}

export function resolveTileHeight(
  tileDef: SliceTileDefinition | null | undefined,
  levelIndex: number,
  levelHeight: number,
  floorSurfaceY: number,
): ResolvedTileHeight {
  const levelOffsetY = levelIndex * levelHeight;
  const tileHeight = Math.max(0.03, tileDef?.height ?? floorSurfaceY);
  const isFloorRamp = isFloorLevelRamp(tileDef, levelHeight);

  if (isFloorRamp) {
    const yBot = levelOffsetY + floorSurfaceY;
    return {
      levelOffsetY: yBot,
      height: tileHeight - floorSurfaceY,
      surfaceBaseY: yBot,
      isFloorRamp: true,
    };
  }

  return {
    levelOffsetY,
    height: tileHeight,
    surfaceBaseY: levelOffsetY + floorSurfaceY,
    isFloorRamp: false,
  };
}
