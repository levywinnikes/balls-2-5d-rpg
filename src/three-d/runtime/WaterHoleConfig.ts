import { isWaterTileId } from "./WaterProfile";

/** World Y offset from level base to pool rim (matches dry `FLOOR_SURFACE_Y`). */
export const WATER_HOLE_RIM_OFFSET = 0.06;

/** Shallow wading pool depth below rim. */
export const WATER_HOLE_DEPTH_SHALLOW = 0.22;

/** Deep swimming pool depth below rim. */
export const WATER_HOLE_DEPTH_DEEP = 0.42;

export function waterHoleDepthForTileId(tileId: string | null | undefined): number {
  const id = (tileId ?? "").toLowerCase();
  if (id.includes("shallow")) {
    return WATER_HOLE_DEPTH_SHALLOW;
  }
  return WATER_HOLE_DEPTH_DEEP;
}

export function sampleWaterHoleBottomY(
  levelBaseY: number,
  tileId: string | null | undefined,
): number {
  return (
    levelBaseY +
    WATER_HOLE_RIM_OFFSET -
    waterHoleDepthForTileId(tileId)
  );
}

export function isWaterHoleTile(
  symbol: string | null,
  tileDef?: { id?: string; geometryProfile?: string } | null,
): boolean {
  const id = (tileDef?.id || symbol || "").toLowerCase();
  return isWaterTileId(id) || tileDef?.geometryProfile === "water-hole";
}

export type WaterTileNeighborLookup = (
  level: string,
  tileX: number,
  tileY: number,
) => string | null;

export type WaterTileDefLookup = (
  symbol: string | null,
) => { id?: string } | null | undefined;

/** Bit mask: 1=N, 2=S, 4=E, 8=W — inner wall when neighbor is dry land. */
export function computeWaterPitWallMask(
  level: string,
  tileX: number,
  tileY: number,
  getTileAt: WaterTileNeighborLookup,
  getTileDef: WaterTileDefLookup,
): number {
  const isWaterNeighbor = (nx: number, ny: number): boolean => {
    const symbol = getTileAt(level, nx, ny);
    if (!symbol || symbol === "...") {
      return false;
    }
    const def = getTileDef(symbol);
    const id = (def?.id || symbol || "").toLowerCase();
    return isWaterTileId(id);
  };

  let mask = 0;
  if (!isWaterNeighbor(tileX, tileY - 1)) {
    mask |= 1;
  }
  if (!isWaterNeighbor(tileX, tileY + 1)) {
    mask |= 2;
  }
  if (!isWaterNeighbor(tileX + 1, tileY)) {
    mask |= 4;
  }
  if (!isWaterNeighbor(tileX - 1, tileY)) {
    mask |= 8;
  }
  return mask;
}
