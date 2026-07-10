import { WorldMapService } from "../../services/WorldMapService";
import type { GameContext } from "./GameContext";
import type { SliceMapData } from "./SliceTileTypes";

export interface MapDataLoaderConfig {
  readonly ctx: GameContext;
  levelBinaryCache: Map<string, Uint8Array>;
  readonly collisionWorld: any;
  readonly rebuildDebugMeshes: () => void;
}

function rebuildCollision(cfg: MapDataLoaderConfig, data: SliceMapData): void {
  const levelKeys = data.levels ? Object.keys(data.levels) : [];
  const mapWidth = data.width ?? 0;
  const mapHeight = data.height ?? 0;
  if (levelKeys.length > 0 && mapWidth > 0 && mapHeight > 0) {
    cfg.collisionWorld.rebuild(levelKeys, mapWidth, mapHeight);
  }
}

export async function loadLevelBinary(
  cfg: MapDataLoaderConfig,
  level: string,
  mapData: SliceMapData,
): Promise<Uint8Array | null> {
  const cached = cfg.levelBinaryCache.get(level);
  if (cached) return cached;

  const binFile = mapData.levels?.[level]?.binFile;
  if (!binFile) return null;

  try {
    const response = await fetch(`/maps/${binFile}`);
    if (!response.ok) {
      console.warn(`[3D Slice] Level binary fetch failed for ${level} (${response.status})`);
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    cfg.levelBinaryCache.set(level, bytes);
    return bytes;
  } catch (error) {
    console.warn(`[3D Slice] Level binary fetch error for ${level}`, error);
    return null;
  }
}

export async function loadMapData(
  cfg: MapDataLoaderConfig,
  sliceMapName: string,
): Promise<SliceMapData | null> {
  const ctx = cfg.ctx;
  if (ctx.mapDataCache) return ctx.mapDataCache;

  try {
    const response = await fetch(`/maps/${sliceMapName}.json`);
    if (!response.ok) throw new Error(`Map metadata missing (${response.status})`);
    const data = await response.json() as SliceMapData;
    ctx.mapDataCache = data;

    if (data.width && data.height) {
      rebuildCollision(cfg, data);
      cfg.rebuildDebugMeshes();
    }
    return data;
  } catch (error) {
    console.warn("[3D Slice] Failed to read map metadata", error);
    return null;
  }
}

export async function ensureWorldMapReady(
  cfg: MapDataLoaderConfig,
  mapData: SliceMapData,
): Promise<void> {
  const ctx = cfg.ctx;
  if (ctx.worldMapReady) return;

  const binaryLevels = new Map<string, Uint8Array>();
  const levelKeys = Object.keys(mapData.levels ?? {});

  await Promise.all(
    levelKeys.map(async (levelKey) => {
      const binData = await loadLevelBinary(cfg, levelKey, mapData);
      if (binData) binaryLevels.set(levelKey, binData);
    }),
  );

  WorldMapService.bootstrapMinimap(mapData, binaryLevels, ctx.getCurrentLevel());
  rebuildCollision(cfg, mapData);
  cfg.rebuildDebugMeshes();
  ctx.worldMapReady = true;
}
