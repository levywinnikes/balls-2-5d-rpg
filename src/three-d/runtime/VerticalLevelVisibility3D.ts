import type { SliceTileDefinition } from "./SliceTileTypes";

/** Fallback stack radius (tiles) when draw radius is not passed — prefer distance view. */
export const DEFAULT_VERTICAL_COLUMN_RADIUS = 12;

/** How far we scan for upper-level tiles that should occlude the hero (R1). */
export const DEFAULT_OCCLUSION_SCAN_RADIUS = 0;

/**
 * Lowest upper BMS level whose tile **directly above the hero** should hide.
 * Tibia-style: only the column under the player counts — nearby roofs must not
 * vanish when you walk past a building.
 */
export function resolveUpperOcclusionLevel(
  activeLevel: string,
  playerTileX: number,
  playerTileY: number,
  levelKeys: string[],
  getTile: VerticalVisibilityTileLookup,
  options?: {
    parseLevelNumber?: (level: string) => number;
    scanRadius?: number;
  },
): number | null {
  if (levelKeys.length === 0) {
    return null;
  }

  const parseLevel =
    options?.parseLevelNumber ??
    ((level: string) => Number.parseInt(level, 10) || 0);
  const currentNum = parseLevel(activeLevel);

  const upperLevels = levelKeys
    .filter((levelKey) => parseLevel(levelKey) > currentNum)
    .sort((a, b) => parseLevel(a) - parseLevel(b));

  for (const levelKey of upperLevels) {
    const sym = getTile(levelKey, playerTileX, playerTileY);
    if (!isVoidMapSymbol(sym)) {
      return parseLevel(levelKey);
    }
  }

  return null;
}

export type VerticalVisibilityTileLookup = (
  level: string,
  tileX: number,
  tileY: number,
) => string | null;

export type VerticalVisibilityTileDefLookup = (
  symbol: string | null,
) => Pick<
  SliceTileDefinition,
  "geometryProfile"
> | null | undefined;

export function isVoidMapSymbol(symbol: string | null | undefined): boolean {
  return !symbol || symbol === "...";
}

/**
 * Decide which BMS levels should be meshed around the player.
 *
 * Within `columnRadius` tiles (Chebyshev), include every level that has solid
 * geometry in each (x,z) column — full vertical stack in distance view.
 *
 * Occlusion (hiding floors above the hero) is handled separately by
 * `resolveUpperOcclusionLevel` + `syncVerticalLevelVisibility`.
 */
export function resolveVerticalVisibleLevels(
  activeLevel: string,
  playerTileX: number,
  playerTileY: number,
  levelKeys: string[],
  getTile: VerticalVisibilityTileLookup,
  _getTileDef?: VerticalVisibilityTileDefLookup,
  options?: {
    columnRadius?: number;
    parseLevelNumber?: (level: string) => number;
  },
): string[] {
  if (levelKeys.length === 0) {
    return [activeLevel];
  }

  const radius = options?.columnRadius ?? DEFAULT_VERTICAL_COLUMN_RADIUS;
  const visible = new Set<string>([activeLevel]);

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) > radius) {
        continue;
      }

      const x = playerTileX + dx;
      const y = playerTileY + dy;

      for (const levelKey of levelKeys) {
        const sym = getTile(levelKey, x, y);
        if (!isVoidMapSymbol(sym)) {
          visible.add(levelKey);
        }
      }
    }
  }

  const parseLevel =
    options?.parseLevelNumber ??
    ((level: string) => Number.parseInt(level, 10) || 0);

  return levelKeys
    .filter((key) => visible.has(key))
    .sort((a, b) => parseLevel(a) - parseLevel(b));
}

