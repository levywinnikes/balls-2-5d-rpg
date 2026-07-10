import type { StandardMaterial } from "@babylonjs/core";
import { isWaterTileId } from "./WaterProfile";

export function resolvePoolFloorMaterial(
  deps: {
    mapDataCache: any;
    getMapTileAt: (level: string, x: number, z: number) => string | null;
    tileMaterialSystem: any;
  },
  level: string,
  tileX: number,
  tileY: number,
): StandardMaterial {
  const mapData = deps.mapDataCache;
  const maxRadius = 20;
  const fallback = deps.tileMaterialSystem.getTileMaterial("stone", undefined, "#9ca3af") as StandardMaterial;
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const symbol = deps.getMapTileAt(level, tileX + dx, tileY + dy);
        if (!symbol || symbol === "...") continue;
        const tileDef = mapData?.tileDefinitions?.[symbol];
        const neighborId = (tileDef?.id || symbol || "").toLowerCase();
        if (isWaterTileId(neighborId)) continue;
        return deps.tileMaterialSystem.getTileMaterial(symbol, tileDef, "#9ca3af") as StandardMaterial;
      }
    }
  }
  return fallback;
}
