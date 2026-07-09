import {
  Mesh,
  Scene,
  StandardMaterial,
  TransformNode,
  VertexData,
} from "@babylonjs/core";
import type {
  TileDescriptor,
  GeometryWorkerRequest,
  GeometryWorkerResponse,
} from "../../workers/geometry.worker";
import type { SliceTileDefinition } from "./SliceTileTypes";
import { computeWaterPitWallMask, waterHoleDepthForTileId } from "./WaterHoleConfig";
import { WaterEffectSystem, collectWaterEffectTiles } from "./WaterEffectSystem";
import { isWaterTileId } from "./WaterProfile";
import { isFloorLevelRamp, resolveTileHeight } from "./TileWorldY";

const CHUNK_UNLOAD_BUDGET_PER_TICK = 8;
const CHUNK_UPDATE_INTERVAL = 0.2;

export type ChunkStreamConfig = {
  scene: Scene;
  mapRoot: TransformNode;
  geometryWorker: Worker;
  waterEffectSystem: WaterEffectSystem;
  StandardMaterial: typeof StandardMaterial;
  CHUNK_SIZE: number;
  LEVEL_HEIGHT: number;
  WALL_HEIGHT: number;
  WALK_SURFACE: number;
  levelMeshes: Map<string, Set<Mesh>>;
  meshLevelByMesh: Map<Mesh, string>;
  wallTileIndex: Map<string, Mesh>;
  levelBinaryCache: Map<string, Uint8Array>;
  tileMaterials: Map<string, StandardMaterial>;
  tileMaterialLRU: string[];
  getMapData: () => { width?: number; height?: number; tileDefinitions?: Record<string, SliceTileDefinition>; levels?: Record<string, { binFile?: string }>; tileAtlas?: string[] } | null;
  getMapTileAt: (level: string, tx: number, ty: number) => string | null;
  getTileDef: (symbol: string | null) => SliceTileDefinition | null | undefined;
  getTileMaterial: (symbol: string | null, tileDef?: SliceTileDefinition, fallbackHexColor?: string) => StandardMaterial;
  resolvePoolFloorMaterial: (level: string, tileX: number, tileY: number) => StandardMaterial;
  isBlockingTile: (symbol: string | null, tileDef?: SliceTileDefinition, options?: { level?: string; tileX?: number; tileY?: number }) => boolean;
  isDownHoleTile: (symbol: string | null, tileDef?: SliceTileDefinition | null) => boolean;
  getRenderableLevels: () => string[];
  registerMeshForLevel: (levelKey: string, mesh: Mesh) => void;
  parseLevelNumber: (level: string) => number;
  levelToWorldY: (level: string | number) => number;
  isFirstPerson: () => boolean;
  getPlayerPosition: () => { x: number; z: number };
  getTopDownDrawRadiusChunks: () => number;
  getFirstPersonDrawRadiusChunks: () => number;
  getTopDownChunkBuildBudgetPerTick: () => number;
  getFirstPersonChunkBuildBudgetPerTick: () => number;
  findUpperOcclusionLevel: () => number | null;
  onDiagnostics: (stats: Record<string, unknown>) => void;
};

export class ChunkStreamSystem {
  private cfg: ChunkStreamConfig;
  loadedChunks = new Map<string, Mesh[]>();
  chunkLod = new Map<string, 0 | 1 | 2>();
  loadingChunks = new Set<string>();
  private pendingRequests = new Map<string, (response: GeometryWorkerResponse) => void>();
  private chunkUpdateTimer = 0;

  constructor(config: ChunkStreamConfig) {
    this.cfg = config;
    config.geometryWorker.onmessage = (evt: MessageEvent<GeometryWorkerResponse>) => {
      const { requestId } = evt.data;
      const resolve = this.pendingRequests.get(requestId);
      if (resolve) {
        this.pendingRequests.delete(requestId);
        resolve(evt.data);
      }
    };
    config.geometryWorker.onerror = (e) => {
      console.error("[GeometryWorker] Error:", e);
    };
  }

  tick(deltaSeconds: number): void {
    this.chunkUpdateTimer += deltaSeconds;
    if (this.chunkUpdateTimer < CHUNK_UPDATE_INTERVAL) return;
    this.chunkUpdateTimer = 0;
    this.updateChunks();
  }

  clearChunk(key: string): void {
    const { waterEffectSystem, levelMeshes, meshLevelByMesh, wallTileIndex } = this.cfg;
    waterEffectSystem.clearChunk(key);
    const pending = this.pendingRequests.get(key);
    if (pending) {
      this.pendingRequests.delete(key);
    }
    this.loadingChunks.delete(key);
    this.chunkLod.delete(key);
    const meshes = this.loadedChunks.get(key);
    if (meshes) {
      for (const mesh of meshes) {
        const levelKey = meshLevelByMesh.get(mesh);
        if (levelKey) {
          const levelSet = levelMeshes.get(levelKey);
          if (levelSet) {
            levelSet.delete(mesh);
            if (levelSet.size === 0) levelMeshes.delete(levelKey);
          }
          meshLevelByMesh.delete(mesh);
        }
        const wallKeys: string[] = [];
        wallTileIndex.forEach((m, wk) => { if (m === mesh) wallKeys.push(wk); });
        for (const wk of wallKeys) wallTileIndex.delete(wk);
        mesh.dispose();
      }
      this.loadedChunks.delete(key);
    }
  }

  clearAll(): void {
    const { waterEffectSystem, levelMeshes, meshLevelByMesh } = this.cfg;
    this.pendingRequests.clear();
    this.loadedChunks.forEach((meshes) => {
      for (const mesh of meshes) {
        const levelKey = meshLevelByMesh.get(mesh);
        if (levelKey) {
          const levelSet = levelMeshes.get(levelKey);
          if (levelSet) levelSet.delete(mesh);
          meshLevelByMesh.delete(mesh);
        }
        mesh.dispose();
      }
    });
    this.loadedChunks.clear();
    this.loadingChunks.clear();
    this.chunkLod.clear();
  }

  waitForSpawnChunkReady(timeoutMs = 12000): Promise<boolean> {
    const { getPlayerPosition, CHUNK_SIZE } = this.cfg;
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const poll = () => {
        const pos = getPlayerPosition();
        const cx = Math.floor(pos.x / CHUNK_SIZE);
        const cy = Math.floor(pos.z / CHUNK_SIZE);
        const key = `${cx}_${cy}`;
        if (this.loadedChunks.has(key)) {
          resolve(true);
          return;
        }
        if (!this.loadingChunks.has(key)) {
          this.buildChunk(cx, cy, 0);
        }
        if (Date.now() > deadline) {
          resolve(false);
          return;
        }
        setTimeout(poll, 50);
      };
      this.updateChunks();
      poll();
    });
  }

  resolveVerticalStackRadiusTiles(): number {
    const { isFirstPerson, getFirstPersonDrawRadiusChunks, getTopDownDrawRadiusChunks, CHUNK_SIZE } = this.cfg;
    const drawRadius = isFirstPerson() ? getFirstPersonDrawRadiusChunks() : getTopDownDrawRadiusChunks();
    return CHUNK_SIZE * (drawRadius + 1);
  }

  private updateChunks(): void {
    const cfg = this.cfg;
    const mapData = cfg.getMapData();
    if (!mapData) return;

    const isFp = cfg.isFirstPerson();
    const drawRadiusChunks = isFp ? cfg.getFirstPersonDrawRadiusChunks() : cfg.getTopDownDrawRadiusChunks();
    const chunkBuildBudgetPerTick = isFp ? cfg.getFirstPersonChunkBuildBudgetPerTick() : cfg.getTopDownChunkBuildBudgetPerTick();

    if (!mapData.width || !mapData.height) return;
    const pos = cfg.getPlayerPosition();
    const playerCX = Math.floor(pos.x / cfg.CHUNK_SIZE);
    const playerCY = Math.floor(pos.z / cfg.CHUNK_SIZE);
    const maxCX = Math.ceil(mapData.width / cfg.CHUNK_SIZE);
    const maxCY = Math.ceil(mapData.height / cfg.CHUNK_SIZE);

    const unloadCandidates: Array<{ key: string; dist: number }> = [];
    this.loadedChunks.forEach((_, key) => {
      const [cxStr, cyStr] = key.split("_");
      const cx = Number(cxStr);
      const cy = Number(cyStr);
      const dist = Math.max(Math.abs(cx - playerCX), Math.abs(cy - playerCY));
      if (dist > drawRadiusChunks + 1) {
        unloadCandidates.push({ key, dist });
      }
    });
    unloadCandidates.sort((a, b) => b.dist - a.dist);
    let unloadedThisTick = 0;
    let pendingUnloads = unloadCandidates.length;
    for (let i = 0; i < Math.min(unloadCandidates.length, CHUNK_UNLOAD_BUDGET_PER_TICK); i++) {
      this.clearChunk(unloadCandidates[i].key);
      unloadedThisTick++;
      pendingUnloads--;
    }

    const chunkCandidates: Array<{ cx: number; cy: number; lod: 0 | 1 | 2 }> = [];
    const radius = drawRadiusChunks;
    for (let dcx = -radius; dcx <= radius; dcx++) {
      for (let dcy = -radius; dcy <= radius; dcy++) {
        const cx = playerCX + dcx;
        const cy = playerCY + dcy;
        if (cx < 0 || cy < 0 || cx >= maxCX || cy >= maxCY) continue;
        const dist = Math.max(Math.abs(dcx), Math.abs(dcy));
        let lod: 0 | 1 | 2;
        if (isFp) {
          lod = dist <= 1 ? 0 : 1;
        } else {
          lod = dist <= 2 ? 0 : dist <= 4 ? 1 : 2;
        }
        const key = `${cx}_${cy}`;
        if (this.loadedChunks.has(key)) {
          const currentLod = this.chunkLod.get(key);
          if (currentLod !== undefined && currentLod > lod) {
            this.clearChunk(key);
          }
        }
        if (!this.loadedChunks.has(key) && !this.loadingChunks.has(key)) {
          chunkCandidates.push({ cx, cy, lod });
        }
      }
    }
    chunkCandidates.sort((a, b) => {
      const da = Math.max(Math.abs(a.cx - playerCX), Math.abs(a.cy - playerCY));
      const db = Math.max(Math.abs(b.cx - playerCX), Math.abs(b.cy - playerCY));
      return da - db;
    });

    let builtThisTick = 0;
    for (const candidate of chunkCandidates) {
      if (builtThisTick >= chunkBuildBudgetPerTick) break;
      this.buildChunk(candidate.cx, candidate.cy, candidate.lod);
      builtThisTick += 1;
    }

    cfg.onDiagnostics({
      playerChunk: { x: playerCX, y: playerCY },
      loadedChunks: this.loadedChunks.size,
      loadingChunks: this.loadingChunks.size,
      builtThisTick,
      drawRadiusChunks,
      chunkBuildBudgetPerTick,
      firstPersonLod: isFp,
      pendingCandidates: Math.max(0, chunkCandidates.length - builtThisTick),
      unloadedThisTick,
      pendingUnloads,
      visibleLevels: cfg.getRenderableLevels(),
      ts: Date.now(),
    });
  }

  private buildChunk(cx: number, cy: number, lod: 0 | 1 | 2): void {
    const cfg = this.cfg;
    const key = `${cx}_${cy}`;
    if (this.loadedChunks.has(key) || this.loadingChunks.has(key)) return;

    const mapData = cfg.getMapData();
    if (!mapData || !mapData.width || !mapData.height) return;
    const allLevels = cfg.getRenderableLevels();
    if (allLevels.length === 0) return;

    const startX = cx * cfg.CHUNK_SIZE;
    const startY = cy * cfg.CHUNK_SIZE;
    const endX = Math.min(startX + cfg.CHUNK_SIZE, mapData.width);
    const endY = Math.min(startY + cfg.CHUNK_SIZE, mapData.height);

    this.loadingChunks.add(key);

    const tiles: TileDescriptor[] = [];
    const waterTiles: Array<{ x: number; y: number; tileId: string; levelOffsetY: number; levelKey: string }> = [];

    for (const level of allLevels) {
      if (!cfg.levelBinaryCache.has(level)) continue;
      for (let tz = startY; tz < endY; tz++) {
        for (let tx = startX; tx < endX; tx++) {
          const symbol = cfg.getMapTileAt(level, tx, tz);
          if (!symbol || symbol === "...") continue;

          const tileDef = cfg.getTileDef(symbol);
          const isBlocking = cfg.isBlockingTile(symbol, tileDef ?? undefined, { level, tileX: tx, tileY: tz });

          if (lod === 1 && !isBlocking) continue;

          const tileId = tileDef?.id ?? symbol;
          const isWater = isWaterTileId(tileId);
          const isHole = cfg.isDownHoleTile(symbol, tileDef);

          if (isWater || isHole) {
            const levelOffsetY = cfg.levelToWorldY(level);
            const waterPitDepth = isWater ? waterHoleDepthForTileId(tileId) : 0;
            const waterPitWallMask = isWater
              ? computeWaterPitWallMask(
                  level, tx, tz,
                  (lvl, x, y) => cfg.getMapTileAt(lvl, x, y),
                  (s) => cfg.getTileDef(s ?? null),
                )
              : 0;
            const poolFloorMat = isWater ? cfg.resolvePoolFloorMaterial(level, tx, tz) : null;
            const poolFloorMaterial = poolFloorMat ? poolFloorMat.name : "";

            tiles.push({
              x: tx, y: tz, symbol, tileId,
              height: cfg.WALL_HEIGHT,
              levelOffsetY,
              isBlocking,
              materialKey: poolFloorMat ? `${level}::${poolFloorMat.name}` : "wall",
              geometryProfile: "water-hole",
              pitDepth: waterPitDepth,
              pitWallMask: waterPitWallMask,
            });

            if (isWater) {
              waterTiles.push({ x: tx, y: tz, tileId, levelOffsetY, levelKey: level });
            }
            continue;
          }

          if (isBlocking) {
            const baseLevelIdx = cfg.parseLevelNumber(level);
            const belowSymbol = baseLevelIdx > 0 ? cfg.getMapTileAt(String(baseLevelIdx - 1), tx, tz) : null;
            if (belowSymbol) {
              const belowDef = cfg.getTileDef(belowSymbol);
              if (belowDef && isFloorLevelRamp(belowDef, cfg.LEVEL_HEIGHT)) continue;
            }
            const levelOffsetY = cfg.levelToWorldY(level);
            const mat = cfg.getTileMaterial(symbol, tileDef ?? undefined);
            tiles.push({
              x: tx, y: tz, symbol, tileId,
              height: cfg.WALL_HEIGHT,
              levelOffsetY,
              isBlocking: true,
              materialKey: `${level}::${mat.name}`,
              geometryProfile: tileDef?.geometryProfile as TileDescriptor["geometryProfile"],
              stairDir: tileDef?.stairDir,
            });
            continue;
          }

          const levelOffsetY = cfg.levelToWorldY(level);
          const resolved = resolveTileHeight(cfg.parseLevelNumber(level), cfg.LEVEL_HEIGHT, cfg.WALK_SURFACE, tileDef ?? undefined);
          const mat = cfg.getTileMaterial(symbol, tileDef ?? undefined);
          tiles.push({
            x: tx, y: tz, symbol, tileId,
            height: resolved.height,
            levelOffsetY: resolved.levelOffsetY,
            isBlocking: false,
            materialKey: `${level}::${mat.name}`,
            geometryProfile: tileDef?.geometryProfile as TileDescriptor["geometryProfile"],
            stairDir: tileDef?.stairDir,
          });
        }
      }
    }

    const waterTileDescs = collectWaterEffectTiles(waterTiles, cfg.LEVEL_HEIGHT);

    if (tiles.length === 0) {
      this.loadedChunks.set(key, []);
      this.chunkLod.set(key, lod);
      this.loadingChunks.delete(key);
      cfg.waterEffectSystem.syncChunk(key, waterTileDescs, cfg.findUpperOcclusionLevel());
      return;
    }

    const matByKey = new Map<string, { mat: StandardMaterial; levelKey: string }>();
    for (const tile of tiles) {
      if (!matByKey.has(tile.materialKey)) {
        const levelKey = tile.materialKey.split("::")[0];
        const mat = cfg.tileMaterials.get(tile.materialKey);
        if (mat) {
          matByKey.set(tile.materialKey, { mat, levelKey });
        }
      }
    }

    this.pendingRequests.set(key, (response: GeometryWorkerResponse) => {
      if (!this.loadingChunks.has(key)) return;
      const { groups } = response;
      const meshes: Mesh[] = [];
      for (const group of groups) {
        const { positions, indices, uvs, materialKey, tileKey } = group;
        const entry = matByKey.get(materialKey);
        if (!entry) continue;
        const mesh = new Mesh(`chunk-${key}-${meshes.length}`, cfg.scene);
        const vertexData = new VertexData();
        vertexData.positions = positions;
        vertexData.indices = indices;
        if (uvs) vertexData.uvs = uvs;
        vertexData.applyToMesh(mesh);
        mesh.material = entry.mat;
        mesh.parent = cfg.mapRoot;
        mesh.setEnabled(true);
        meshes.push(mesh);
        cfg.registerMeshForLevel(entry.levelKey, mesh);
        if (tileKey) {
          cfg.wallTileIndex.set(`${entry.levelKey}::${tileKey}`, mesh);
        }
      }
      this.loadedChunks.set(key, meshes);
      this.chunkLod.set(key, lod);
      this.loadingChunks.delete(key);
      cfg.waterEffectSystem.syncChunk(key, waterTileDescs, cfg.findUpperOcclusionLevel());
    });

    const workerRequest: GeometryWorkerRequest = {
      requestId: key,
      tiles,
    };
    cfg.geometryWorker.postMessage(workerRequest);
  }
}
