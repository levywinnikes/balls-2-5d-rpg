import type { GameContext } from "./GameContext";

export interface MapRendererConfig {
  ctx: GameContext;
  loadLevelBinary: (level: string, mapData: any) => Promise<Uint8Array | null>;
}

export async function renderMapLevel(
  cfg: MapRendererConfig,
  level: string,
): Promise<void> {
  const { ctx, loadLevelBinary } = cfg;
  const mapData = ctx.mapDataCache;
  if (!mapData || !mapData.width || !mapData.height) return;

  const binData = await loadLevelBinary(level, mapData);
  if (!binData) return;

  ctx.currentMapWidth = mapData.width;
  ctx.currentMapHeight = mapData.height;
  ctx.mapMinX = 0;
  ctx.mapMinZ = 0;
  ctx.mapMaxX = Math.max(0.5, ctx.currentMapWidth - 0.5);
  ctx.mapMaxZ = Math.max(0.5, ctx.currentMapHeight - 0.5);

  ctx.navigationSystem.rebuildGrid(level);

  if (ctx.lastChunkRenderLevel === null) {
    ctx.chunkSystem.clearAll();
  }
  ctx.lastChunkRenderLevel = level;
  ctx.chunkSystem.tick(0.2);
}
