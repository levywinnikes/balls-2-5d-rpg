import type { SliceTileDefinition } from "./SliceTileTypes";

/** Tiles around the player scanned for vertical columns (world units ≈ tiles). */
export const DEFAULT_VERTICAL_COLUMN_RADIUS = 12;

/** How far we scan for upper-level tiles that should occlude the hero (R1). */
export const DEFAULT_OCCLUSION_SCAN_RADIUS = 8;

/**
 * Lowest upper BMS level that should hide when the hero is under/near cover.
 * Checks the player's column first, then a disk — the old 1-tile cross missed
 * balconies and roof edges that still block the camera.
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
  const radius = options?.scanRadius ?? DEFAULT_OCCLUSION_SCAN_RADIUS;
  const radiusSq = radius * radius;
  const currentNum = parseLevel(activeLevel);

  const upperLevels = levelKeys
    .filter((levelKey) => parseLevel(levelKey) > currentNum)
    .sort((a, b) => parseLevel(a) - parseLevel(b));

  for (const levelKey of upperLevels) {
    const levelNum = parseLevel(levelKey);

    if (!isVoidMapSymbol(getTile(levelKey, playerTileX, playerTileY))) {
      return levelNum;
    }

    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        if (dx * dx + dy * dy > radiusSq) {
          continue;
        }
        const sym = getTile(levelKey, playerTileX + dx, playerTileY + dy);
        if (!isVoidMapSymbol(sym)) {
          return levelNum;
        }
      }
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
  "stairDir" | "levelTransition" | "geometryProfile"
> | null | undefined;

export function isVoidMapSymbol(symbol: string | null | undefined): boolean {
  return !symbol || symbol === "...";
}

function isDownConnector(
  symbol: string | null,
  tileDef?: Pick<SliceTileDefinition, "stairDir" | "levelTransition"> | null,
): boolean {
  if (!symbol || isVoidMapSymbol(symbol)) {
    return false;
  }
  return tileDef?.stairDir === "down" || tileDef?.levelTransition === "down";
}

function isUpConnector(
  symbol: string | null,
  tileDef?: Pick<SliceTileDefinition, "stairDir" | "levelTransition"> | null,
): boolean {
  if (!symbol || isVoidMapSymbol(symbol)) {
    return false;
  }
  return tileDef?.stairDir === "up" || tileDef?.levelTransition === "up";
}

/**
 * Decide which BMS levels should be meshed around the player.
 *
 * - Always includes `activeLevel`.
 * - Upper floors only inside vertical columns that have geometry nearby.
 * - Lower floors only under open shafts (void / down stairs / pits).
 * - One level above/below explicit up/down connectors in the scan radius.
 */
export function resolveVerticalVisibleLevels(
  activeLevel: string,
  playerTileX: number,
  playerTileY: number,
  levelKeys: string[],
  getTile: VerticalVisibilityTileLookup,
  getTileDef: VerticalVisibilityTileDefLookup,
  options?: {
    columnRadius?: number;
    parseLevelNumber?: (level: string) => number;
  },
): string[] {
  if (levelKeys.length === 0) {
    return [activeLevel];
  }

  const radius = options?.columnRadius ?? DEFAULT_VERTICAL_COLUMN_RADIUS;
  const parseLevel =
    options?.parseLevelNumber ??
    ((level: string) => Number.parseInt(level, 10) || 0);

  const levelNums = levelKeys.map(parseLevel).sort((a, b) => a - b);
  const minLevel = levelNums[0];
  const maxLevel = levelNums[levelNums.length - 1];
  const activeNum = parseLevel(activeLevel);
  const visible = new Set<string>([activeLevel]);

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = playerTileX + dx;
      const y = playerTileY + dy;

      let highestAbove = activeNum;
      for (let n = maxLevel; n > activeNum; n -= 1) {
        const sym = getTile(String(n), x, y);
        if (!isVoidMapSymbol(sym)) {
          highestAbove = n;
          break;
        }
      }
      for (let n = activeNum + 1; n <= highestAbove; n += 1) {
        visible.add(String(n));
      }

      let shaftOpen = isVoidMapSymbol(getTile(activeLevel, x, y));
      const activeSym = getTile(activeLevel, x, y);
      const activeDef = getTileDef(activeSym);
      if (isDownConnector(activeSym, activeDef)) {
        shaftOpen = true;
      }

      for (let n = activeNum - 1; n >= minLevel; n -= 1) {
        const levelKey = String(n);
        const sym = getTile(levelKey, x, y);
        const def = getTileDef(sym);

        if (shaftOpen) {
          if (!isVoidMapSymbol(sym)) {
            visible.add(levelKey);
          }
          if (isUpConnector(sym, def)) {
            shaftOpen = false;
          } else if (!isVoidMapSymbol(sym)) {
            shaftOpen = false;
          }
        }

        const aboveKey = String(n + 1);
        const aboveSym = getTile(aboveKey, x, y);
        if (isVoidMapSymbol(aboveSym)) {
          shaftOpen = true;
        }
      }

      for (let n = minLevel; n <= maxLevel; n += 1) {
        const levelKey = String(n);
        const sym = getTile(levelKey, x, y);
        const def = getTileDef(sym);
        if (isUpConnector(sym, def)) {
          const up = String(n + 1);
          if (levelKeys.includes(up)) {
            visible.add(up);
          }
        }
        if (isDownConnector(sym, def)) {
          const down = String(n - 1);
          if (levelKeys.includes(down)) {
            visible.add(down);
          }
        }
      }
    }
  }

  return levelKeys
    .filter((key) => visible.has(key))
    .sort((a, b) => parseLevel(a) - parseLevel(b));
}
