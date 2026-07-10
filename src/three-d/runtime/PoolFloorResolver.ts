import { isWaterTileId } from "./WaterProfile";

export function resolvePoolFloorMaterial(
  deps: {
    mapDataCache: any;
    getMapTileAt: (level: string, x: number, z: number) => string | null;
    tileMaterialSystem: any;
    isWaterTileId: (id: string) => boolean;
  },
  level: string,
  tileX: number,
  tileY: number,
): string {
  const mapData = deps.mapDataCache;
  if (!mapData?.levels?.[level]) return "unknown";
  const symbol = deps.getMapTileAt(level, tileX, tileY);
  if (!symbol) return "unknown";
  if (!isWaterTileId(symbol)) return "unknown";
  const width = mapData.width ?? 0;
  const height = mapData.height ?? 0;
  for (let radius = 1; radius <= 8; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const nx = tileX + dx;
        const ny = tileY + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const neighborId = deps.getMapTileAt(level, nx, ny);
        if (!neighborId || neighborId === "...") continue;
        if (isWaterTileId(neighborId)) continue;
        return deps.tileMaterialSystem.resolveMaterialIdForTile(neighborId, level, nx, ny);
      }
    }
  }
  return "unknown";
}
