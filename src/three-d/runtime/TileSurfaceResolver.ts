import type { SliceTileDefinition } from "./SliceTileTypes";
import type { AquaticSample } from "./WaterProfile";
import { isWaterTileId } from "./WaterProfile";
import {
  isWaterHoleTile,
  WATER_HOLE_RIM_OFFSET,
  waterHoleDepthForTileId,
} from "./WaterHoleConfig";
import {
  sampleStairFootY,
  STAIR_LEVEL_HEIGHT_UNITS,
  STAIR_STEP_COUNT,
} from "./StairConfig3D";

/** Matches dry cobble top and water pool rim. */
export const DEFAULT_FLOOR_RIM_OFFSET = WATER_HOLE_RIM_OFFSET;

export const DEFAULT_FEET_CLEARANCE = 0.02;

export const DEFAULT_LEVEL_HEIGHT_UNITS = 2.0;

export type TileSurfaceTileLookup = (
  level: string,
  tileX: number,
  tileY: number,
) => string | null;

export type TileSurfaceTileDefLookup = (
  symbol: string | null,
) => SliceTileDefinition | null | undefined;

export type TileSurfaceLevelY = (level: string) => number;

export type TileSurfaceContext = {
  levelToWorldY: TileSurfaceLevelY;
  getTile: TileSurfaceTileLookup;
  getTileDef: TileSurfaceTileDefLookup;
  levelHeightUnits?: number;
  floorRimOffset?: number;
  feetClearance?: number;
};

export type TileSurfaceKind =
  | "void"
  | "floor"
  | "slab"
  | "ramp"
  | "stair"
  | "water";

export type TileSurfaceSample = {
  symbol: string | null;
  tileId: string;
  kind: TileSurfaceKind;
  geometryProfile: SliceTileDefinition["geometryProfile"] | null;
  /** Walkable surface world Y (before feet clearance). */
  surfaceY: number;
  /** surfaceY + clearance — default anchor for actors. */
  footY: number;
  /** Pool rim Y when kind === water; else same as surfaceY. */
  rimY: number;
  /** Pool bottom Y when kind === water; else null. */
  poolBottomY: number | null;
  isWater: boolean;
};

function resolveFloorTopHeight(tileDef?: SliceTileDefinition | null): number {
  return Math.max(0.03, tileDef?.height ?? 0.08);
}

function resolveRampRise(
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

function sampleRampSurfaceY(
  baseY: number,
  localX: number,
  localZ: number,
  direction: "n" | "s" | "e" | "w",
  rise: number,
): number {
  const lx = Math.max(0, Math.min(1, localX));
  const lz = Math.max(0, Math.min(1, localZ));

  if (direction === "n") {
    return baseY + rise * lz;
  }
  if (direction === "s") {
    return baseY + rise * (1 - lz);
  }
  if (direction === "e") {
    return baseY + rise * (1 - lx);
  }
  return baseY + rise * lx;
}

function sampleStairSurfaceY(
  baseY: number,
  localZ: number,
  levelHeightUnits: number = STAIR_LEVEL_HEIGHT_UNITS,
  stepCount: number = STAIR_STEP_COUNT,
  stairDir: "up" | "down" = "up",
  floorRim?: number,
): number {
  return sampleStairFootY(
    baseY,
    localZ,
    stepCount,
    levelHeightUnits,
    stairDir,
    floorRim,
  );
}

function resolveTileKind(
  symbol: string | null,
  tileDef?: SliceTileDefinition | null,
): TileSurfaceKind {
  if (!symbol || symbol === "...") {
    return "void";
  }
  if (isWaterHoleTile(symbol, tileDef)) {
    return "water";
  }
  const profile = tileDef?.geometryProfile;
  if (profile === "stair" || tileDef?.stairDir) {
    return "stair";
  }
  if (
    profile === "ramp-n" ||
    profile === "ramp-s" ||
    profile === "ramp-e" ||
    profile === "ramp-w"
  ) {
    return "ramp";
  }
  if (profile === "slab") {
    return "slab";
  }
  return "floor";
}

/**
 * Single source of truth for walkable surface height on a tile.
 * All actor placement and aquatic modifiers should start here.
 */
export function sampleTileSurface(
  worldX: number,
  worldZ: number,
  level: string,
  ctx: TileSurfaceContext,
): TileSurfaceSample {
  const levelBaseY = ctx.levelToWorldY(level);
  const floorRim = ctx.floorRimOffset ?? DEFAULT_FLOOR_RIM_OFFSET;
  const clearance = ctx.feetClearance ?? DEFAULT_FEET_CLEARANCE;
  const levelHeight = ctx.levelHeightUnits ?? DEFAULT_LEVEL_HEIGHT_UNITS;

  const tileX = Math.floor(worldX);
  const tileZ = Math.floor(worldZ);
  const symbol = ctx.getTile(level, tileX, tileZ);
  const tileDef = ctx.getTileDef(symbol);
  const tileId = (tileDef?.id || symbol || "").toLowerCase();
  const localX = worldX - tileX;
  const localZ = worldZ - tileZ;
  const kind = resolveTileKind(symbol, tileDef);
  const geometryProfile = tileDef?.geometryProfile ?? null;

  if (kind === "void") {
    const y = levelBaseY + floorRim;
    return {
      symbol,
      tileId,
      kind,
      geometryProfile,
      surfaceY: y,
      footY: y + clearance,
      rimY: y,
      poolBottomY: null,
      isWater: false,
    };
  }

  if (kind === "water") {
    const rimY = levelBaseY + floorRim;
    const poolBottomY =
      rimY - waterHoleDepthForTileId(tileId);
    return {
      symbol,
      tileId,
      kind,
      geometryProfile: geometryProfile ?? "water-hole",
      surfaceY: rimY,
      footY: rimY + clearance,
      rimY,
      poolBottomY,
      isWater: true,
    };
  }

  if (kind === "stair") {
    const stairDir = tileDef?.stairDir === "down" ? "down" : "up";
    const surfaceY = sampleStairSurfaceY(
      levelBaseY,
      localZ,
      levelHeight,
      STAIR_STEP_COUNT,
      stairDir,
      floorRim,
    );
    return {
      symbol,
      tileId,
      kind,
      geometryProfile: geometryProfile ?? "stair",
      surfaceY,
      footY: surfaceY + clearance,
      rimY: surfaceY,
      poolBottomY: null,
      isWater: false,
    };
  }

  if (kind === "ramp") {
    const profile = geometryProfile!;
    const dir = profile.split("-")[1] as "n" | "s" | "e" | "w";
    const surfaceY = sampleRampSurfaceY(
      levelBaseY,
      localX,
      localZ,
      dir,
      resolveRampRise(tileDef),
    );
    return {
      symbol,
      tileId,
      kind,
      geometryProfile: profile,
      surfaceY,
      footY: surfaceY + clearance,
      rimY: surfaceY,
      poolBottomY: null,
      isWater: false,
    };
  }

  const topOffset =
    kind === "slab"
      ? resolveFloorTopHeight(tileDef)
      : resolveFloorTopHeight(tileDef);
  const surfaceY = levelBaseY + topOffset;

  return {
    symbol,
    tileId,
    kind,
    geometryProfile,
    surfaceY,
    footY: surfaceY + clearance,
    rimY: surfaceY,
    poolBottomY: null,
    isWater: false,
  };
}

export function sampleActorFootY(
  worldX: number,
  worldZ: number,
  level: string,
  ctx: TileSurfaceContext,
): number {
  return sampleTileSurface(worldX, worldZ, level, ctx).footY;
}

/** footY + aquatic sinkOffset (gameplay/visual submersion). */
export function sampleActorWorldY(
  worldX: number,
  worldZ: number,
  level: string,
  aquatic: AquaticSample,
  ctx: TileSurfaceContext,
): number {
  const footY = sampleActorFootY(worldX, worldZ, level, ctx);
  if (aquatic.mode === "dry") {
    return footY;
  }
  return footY + aquatic.sinkOffset;
}

export function isWaterTileAt(
  worldX: number,
  worldZ: number,
  level: string,
  ctx: TileSurfaceContext,
): boolean {
  return sampleTileSurface(worldX, worldZ, level, ctx).isWater;
}

/** @deprecated Prefer sampleTileSurface — kept for callers using tile id only. */
export function tileIdIsWater(tileId: string | null | undefined): boolean {
  return isWaterTileId(tileId);
}
