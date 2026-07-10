import type { GameContext } from "./GameContext";
import type { SliceMapData } from "./SliceTileTypes";

export interface MapDataLoaderConfig {
  readonly ctx: GameContext;
  levelBinaryCache: Map<string, Uint8Array>;
  readonly collisionWorld: any;
  readonly rebuildDebugMeshes: () => void;
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
    if (!response.ok) return null;
    const data = await response.json() as SliceMapData;
    ctx.mapDataCache = data;

    if (data.levels) {
      for (const level of Object.keys(data.levels)) {
        const binary = await loadLevelBinary(cfg, level, data);
        if (binary) {
          cfg.collisionWorld.rebuild(level, binary);
        }
      }
    }
    cfg.rebuildDebugMeshes();
    return data;
  } catch (err) {
    console.warn("[3D Slice] loadMapData failed", err);
    return null;
  }
}

export async function ensureWorldMapReady(
  cfg: MapDataLoaderConfig,
  mapData: SliceMapData,
): Promise<void> {
  const ctx = cfg.ctx;
  if (ctx.worldMapReady) return;
  ctx.worldMapReady = true;

  const levels = Object.keys(mapData.levels ?? {});
  for (const level of levels) {
    const binary = await loadLevelBinary(cfg, level, mapData);
    if (binary) cfg.collisionWorld.rebuild(level, binary);
  }

  WorldMapService.ensureLevelBuffer(ctx.getCurrentLevel());
  cfg.rebuildDebugMeshes();
}

import { WorldMapService } from "../../services/WorldMapService";
