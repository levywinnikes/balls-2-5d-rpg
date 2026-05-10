export interface GridPoint {
  x: number;
  y: number;
}

export const MAP_UI_BUFFER_TILE_SIZE = 4;

/**
 * SINGLE AXIS COMPENSATION (documented exception to the "no per-component
 * axis compensation" rule):
 *
 * The 3D runtime uses Babylon's left-handed scene with an `ArcRotateCamera`
 * fixed at `alpha = π/2`. With that configuration, the camera renders
 * `+X world` to the LEFT of the screen, while the BMS canonical convention
 * (and the world buffer produced by `WorldMapService`) treats `+X = east =
 * right`. This means the 3D scene the player sees is mirrored on X
 * relative to the BMS buffer.
 *
 * Reconciling them at any other layer (chunks, spawn, save, PlayerState)
 * would touch dozens of files. The minimap and world map are the only
 * surfaces where this divergence is visible to the user, so we mirror X
 * here, in one place.
 *
 * `bmsGridXToVisualGridX` maps a BMS-canonical grid X to the X position
 * the player actually sees on screen. Use it when:
 *  - placing the player marker on the map UI
 *  - placing user-defined markers on the map UI
 *  - reading/writing fog-of-war by visual coordinates
 *  - drawing the level buffer (must be mirrored via canvas transform)
 *
 * The function is its own inverse: applying it twice returns the original.
 */
export function bmsGridXToVisualGridX(
  bmsGridX: number,
  mapWidthInTiles: number,
): number {
  return mapWidthInTiles - bmsGridX;
}

export function worldToGridPoint(
  worldX: number,
  worldY: number,
  tileSize: number,
): GridPoint {
  return {
    x: worldX / tileSize,
    y: worldY / tileSize,
  };
}

export function gridToWorldPoint(
  gridX: number,
  gridY: number,
  tileSize: number,
): GridPoint {
  return {
    x: gridX * tileSize,
    y: gridY * tileSize,
  };
}

export function bufferToCanvasScale(
  bufferWidth: number,
  bufferHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): number {
  if (bufferWidth <= 0 || bufferHeight <= 0) return 1;
  return Math.min(canvasWidth / bufferWidth, canvasHeight / bufferHeight);
}

export function clampToMapBounds(
  value: number,
  maxExclusive: number,
): number {
  return Math.max(0, Math.min(maxExclusive - 1, value));
}

export function gridToBufferPx(gridValue: number): number {
  return gridValue * MAP_UI_BUFFER_TILE_SIZE;
}

export function bufferPxToGrid(bufferPx: number): number {
  return bufferPx / MAP_UI_BUFFER_TILE_SIZE;
}