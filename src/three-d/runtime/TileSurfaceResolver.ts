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
  /** Walkable top of default floor slabs (must match 3D mesh thickness). */
  floorSlabThickness?: number;
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

function resolveFloorTopHeight(
  tileDef?: SliceTileDefinition | null,
  ctx?: TileSurfaceContext,
): number {
  const authored = Math.max(0.03, tileDef?.height ?? 0.08);
  const slab = ctx?.floorSlabThickness;
  if (slab != null) {
    return Math.max(authored, slab);
  }
  return authored;
}

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
  const walkSurface =
    ctx.floorSlabThickness ?? ctx.floorRimOffset ?? DEFAULT_FLOOR_RIM_OFFSET;

  const tileX = Math.floor(worldX);
  const tileZ = Math.floor(worldZ);
  const symbol = ctx.getTile(level, tileX, tileZ);
  const tileDef = ctx.getTileDef(symbol);
  const tileId = (tileDef?.id || symbol || "").toLowerCase();
  const localX = worldX - tileX;
  const localZ = worldZ - tileZ;
  const kind = resolveTileKind(symbol, tileDef);
  const geometryProfile = tileDef?.geometryProfile ?? null;

  // Helper: check the level below for a ramp that this tile sits above.
  // Returns a ramp surface sample if found, otherwise null.
  const tryProjectedRamp = (): TileSurfaceSample | null => {
    const levelNum = Number.parseInt(level, 10);
    if (Number.isNaN(levelNum)) return null;
    const belowLevel = String(levelNum - 1);
    const belowSymbol = ctx?.getTile?.(belowLevel, tileX, tileZ);
    if (!belowSymbol || belowSymbol === "...") return null;
    const belowDef = ctx?.getTileDef?.(belowSymbol);
    const belowProfile = belowDef?.geometryProfile;
    if (
      belowProfile !== "ramp-n" && belowProfile !== "ramp-s" &&
      belowProfile !== "ramp-e" && belowProfile !== "ramp-w"
    ) return null;
    const rampRise = resolveRampRise(belowDef);
    if (rampRise < levelHeight - 0.08) return null;
    const belowBaseY = ctx?.levelToWorldY?.(belowLevel) ?? levelBaseY;
    const dir = belowProfile.split("-")[1] as "n" | "s" | "e" | "w";
    const surfaceY = sampleRampSurfaceY(belowBaseY + walkSurface, localX, localZ, dir, rampRise);
    return {
      symbol: belowSymbol,
      tileId: (belowDef?.id || belowSymbol || "").toLowerCase(),
      kind: "ramp" as const,
      geometryProfile: belowProfile,
      surfaceY,
      footY: surfaceY + clearance,
      rimY: surfaceY,
      poolBottomY: null,
      isWater: false,
    };
  };

  if (kind === "void") {
    const projected = tryProjectedRamp();
    if (projected) return projected;
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
      walkSurface,
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
      levelBaseY + walkSurface,
      localX,
      localZ,
      dir,
      resolveRampRise(tileDef),
    );
    return {
      symbol: symbol,
      tileId: tileId,
      kind: kind,
      geometryProfile: profile,
      surfaceY,
      footY: surfaceY + clearance,
      rimY: surfaceY,
      poolBottomY: null,
      isWater: false,
    };
  }

  // Floor/slab tiles above a ramp on the level below should follow the ramp
  // surface instead of staying flat — the ramp mesh fills that vertical space.
  const projected = tryProjectedRamp();
  if (projected) return projected;

  const topOffset =
    kind === "slab"
      ? resolveFloorTopHeight(tileDef, ctx)
      : resolveFloorTopHeight(tileDef, ctx);
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

export interface HighestGroundResult {
  level: string;
  footY: number;
  kind: "floor" | "block" | "water" | "stair" | "ramp" | "slab" | "void";
  geometryProfile: string | null | undefined;
}

export function findHighestGroundBelow(
  worldX: number,
  worldZ: number,
  currentY: number,
  levels: string[],
  ctx: TileSurfaceContext,
): HighestGroundResult {
  let bestLevel = levels[0];
  let bestFootY = -999;
  let bestKind: HighestGroundResult["kind"] = "void";
  let bestProfile: string | null | undefined = null;
  let foundAny = false;

  for (const lvl of levels) {
    const sample = sampleTileSurface(worldX, worldZ, lvl, ctx);
    // Void tiles are not solid ground, ignore them.
    if (sample.kind === "void") {
      continue;
    }
    // Allow step up by at most 0.45 units (step limit).
    if (sample.footY <= currentY + 0.45) {
      if (sample.footY > bestFootY) {
        bestFootY = sample.footY;
        bestLevel = lvl;
        bestKind = sample.kind;
        bestProfile = sample.geometryProfile;
        foundAny = true;
      }
    }
  }

  if (!foundAny) {
    const fallbackLvl = levels.includes("0") ? "0" : levels[0];
    const fallbackSample = sampleTileSurface(worldX, worldZ, fallbackLvl, ctx);
    return {
      level: fallbackLvl,
      footY: fallbackSample.footY,
      kind: fallbackSample.kind,
      geometryProfile: fallbackSample.geometryProfile,
    };
  }

  return {
    level: bestLevel,
    footY: bestFootY,
    kind: bestKind,
    geometryProfile: bestProfile,
  };
}

export function findHighestGroundWithinStepLimit(
  worldX: number,
  worldZ: number,
  currentY: number,
  levels: string[],
  ctx: TileSurfaceContext,
): HighestGroundResult | null {
  let bestLevel = levels[0];
  let bestFootY = -999;
  let bestKind: HighestGroundResult["kind"] = "void";
  let bestProfile: string | null | undefined = null;
  let foundAny = false;

  for (const lvl of levels) {
    const sample = sampleTileSurface(worldX, worldZ, lvl, ctx);
    if (sample.kind === "void") {
      continue;
    }
    const diff = sample.footY - currentY;
    // Constrain height change to step limit (up or down by at most 0.45 units)
    if (diff >= -0.45 && diff <= 0.45) {
      if (sample.footY > bestFootY) {
        bestFootY = sample.footY;
        bestLevel = lvl;
        bestKind = sample.kind;
        bestProfile = sample.geometryProfile;
        foundAny = true;
      }
    }
  }

  if (!foundAny) {
    return null;
  }

  return {
    level: bestLevel,
    footY: bestFootY,
    kind: bestKind,
    geometryProfile: bestProfile,
  };
}
