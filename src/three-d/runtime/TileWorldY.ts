import type { SliceTileDefinition } from "./SliceTileTypes";
import { LEVEL_HEIGHT, WALK_SURFACE } from "../../constants/World";

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
  levelHeight = LEVEL_HEIGHT,
): boolean {
  const profile = tileDef?.geometryProfile;
  if (!profile?.startsWith("ramp-")) {
    return false;
  }
  return resolveRampRise(tileDef) >= levelHeight - 0.08;
}

export interface ResolvedTileHeight {
  /** levelOffsetY sent to geometry worker (yBot of tile) */
  levelOffsetY: number;
  /** effective height sent to geometry worker (already adjusted for floor ramps) */
  height: number;
  /** base Y for surface queries (levelBaseY + floorSurfaceY for floor-level ramps) */
  surfaceBaseY: number;
  isFloorRamp: boolean;
}

export function resolveTileHeight(
  levelIndex: number,
  levelHeight: number,
  floorSurfaceY: number,
  tileDef?: SliceTileDefinition | null,
  tileHeight?: number,
): ResolvedTileHeight {
  const levelOffsetY = levelIndex * levelHeight;
  const isFloorRamp = isFloorLevelRamp(tileDef, levelHeight);
  const rawTileHeight = tileHeight ?? tileDef?.height ?? floorSurfaceY;
  const h = Math.max(0.03, rawTileHeight);

  if (isFloorRamp) {
    const yBot = levelOffsetY + floorSurfaceY;
    return {
      levelOffsetY: yBot,
      height: h - floorSurfaceY,
      surfaceBaseY: yBot,
      isFloorRamp: true,
    };
  }

  return {
    levelOffsetY,
    height: h,
    surfaceBaseY: levelOffsetY + floorSurfaceY,
    isFloorRamp: false,
  };
}
