import type { SliceTileDefinition } from "./SliceTileTypes";
import {
  DEFAULT_FEET_CLEARANCE,
  sampleActorFootY,
  sampleTileSurface,
  type TileSurfaceContext,
} from "./TileSurfaceResolver";

export const FEET_CLEARANCE = DEFAULT_FEET_CLEARANCE;

export type GroundHeightTileLookup = TileSurfaceContext["getTile"];
export type GroundHeightTileDefLookup = TileSurfaceContext["getTileDef"];
export type GroundHeightLevelY = TileSurfaceContext["levelToWorldY"];

function toContext(
  levelToWorldY: GroundHeightLevelY,
  getTile: GroundHeightTileLookup,
  getTileDef: GroundHeightTileDefLookup,
  options?: {
    levelHeightUnits?: number;
    feetClearance?: number;
    floorRimOffset?: number;
    floorSlabThickness?: number;
  },
): TileSurfaceContext {
  return {
    levelToWorldY,
    getTile,
    getTileDef,
    levelHeightUnits: options?.levelHeightUnits,
    feetClearance: options?.feetClearance,
    floorRimOffset: options?.floorRimOffset,
    floorSlabThickness: options?.floorSlabThickness,
  };
}

export function sampleGroundSurfaceY(
  worldX: number,
  worldZ: number,
  level: string,
  levelToWorldY: GroundHeightLevelY,
  getTile: GroundHeightTileLookup,
  getTileDef: GroundHeightTileDefLookup,
  options?: {
    levelHeightUnits?: number;
    feetClearance?: number;
    floorRimOffset?: number;
    floorSlabThickness?: number;
  },
): number {
  return sampleTileSurface(
    worldX,
    worldZ,
    level,
    toContext(levelToWorldY, getTile, getTileDef, options),
  ).surfaceY;
}

export function sampleGroundFootY(
  worldX: number,
  worldZ: number,
  level: string,
  levelToWorldY: GroundHeightLevelY,
  getTile: GroundHeightTileLookup,
  getTileDef: GroundHeightTileDefLookup,
  options?: {
    levelHeightUnits?: number;
    feetClearance?: number;
    floorRimOffset?: number;
    floorSlabThickness?: number;
  },
): number {
  return sampleActorFootY(
    worldX,
    worldZ,
    level,
    toContext(levelToWorldY, getTile, getTileDef, options),
  );
}
