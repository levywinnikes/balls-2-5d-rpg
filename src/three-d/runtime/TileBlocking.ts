import { isWaterTileId } from "./WaterProfile";
import type { SliceTileDefinition } from "./SliceTileTypes";

export function isStaticTileBlocking(
  symbol: string | null,
  tileDef?: SliceTileDefinition,
): boolean {
  if (!symbol || symbol === "...") return false;
  const resolvedTileId = tileDef?.id ?? symbol;
  if (!resolvedTileId) return false;
  if (isWaterTileId(resolvedTileId)) return false;
  if (tileDef?.renderAs === "floor") return false;
  if (tileDef?.renderAs === "block") return true;
  return Boolean(tileDef?.block);
}

export interface TileBlockingDeps {
  doorSystem: { getDoorAtTile: (level: string, x: number, y: number) => any; isDoorOpenAtTile: (level: string, x: number, y: number) => boolean };
  propSystem: { isCollidableTile: (level: string, x: number, y: number) => boolean };
}

export function isBlockingTile(
  deps: TileBlockingDeps,
  symbol: string | null,
  tileDef?: SliceTileDefinition,
  options?: { level?: string; tileX?: number; tileY?: number },
): boolean {
  if (options?.level !== undefined && options.tileX !== undefined && options.tileY !== undefined) {
    const door = deps.doorSystem.getDoorAtTile(options.level, options.tileX, options.tileY);
    if (door) return !deps.doorSystem.isDoorOpenAtTile(options.level, options.tileX, options.tileY);
    if (deps.propSystem.isCollidableTile(options.level, options.tileX, options.tileY)) return true;
  }
  return isStaticTileBlocking(symbol, tileDef);
}
