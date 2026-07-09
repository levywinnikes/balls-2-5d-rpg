import type { ArcRotateCamera, Mesh } from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core";
import { LEVEL_HEIGHT, WALK_SURFACE } from "../../constants/World";
import { HERO_COLLISION_HEIGHT } from "./TwoDParitySpriteFactory";
import {
  DEFAULT_OCCLUSION_SCAN_RADIUS,
  resolveVerticalVisibleLevels,
} from "./VerticalLevelVisibility3D";
import type { SliceMapData, SliceTileDefinition } from "./SliceTileTypes";

const HERO_BODY_HEIGHT = HERO_COLLISION_HEIGHT;

export interface VisibilitySystemConfig {
  getMapDataCache: () => SliceMapData | null;
  getMapTileAt: (level: string, tileX: number, tileZ: number) => string | null;
  getPlayerPosition: () => Vector3;
  getCamera: () => ArcRotateCamera;
  getIsFirstPerson: () => boolean;
  getRenderLevel: () => string;
  getCurrentLevel: () => string;
  getHoleFallLandingLevel: () => string | null;
  parseLevelNumber: (level: string) => number;
  isGradedWalkAt: (worldX: number, worldZ: number, level: string) => boolean;
  isStaticTileBlocking: (
    symbol: string,
    tileDef?: SliceTileDefinition,
  ) => boolean;
  levelToWorldY: (level: string | number) => number;
  waterEffectSystem: {
    updateOcclusion: (
      occlusionStartLevel: number | null,
      deltaSeconds: number,
    ) => void;
  };
}

export class VisibilitySystem {
  readonly levelMeshes = new Map<string, Set<Mesh>>();
  readonly meshLevelByMesh = new Map<Mesh, string>();
  readonly wallTileIndex = new Map<string, Mesh>();

  private readonly hiddenWallMeshes = new Set<Mesh>();
  private occlusionStartLevel: number | null = null;

  private cachedRenderableLevels: string[] = [];
  private lastCachedTileX = -9999;
  private lastCachedTileZ = -9999;
  private lastCachedActiveLevel = "";
  private lastCachedIsFirstPerson = false;
  private lastCachedVerticalStackRadius = -1;

  private resolveVerticalStackRadiusTiles: () => number = () => 12;

  constructor(private readonly config: VisibilitySystemConfig) {}

  /** Wired after ChunkStreamSystem construction (cyclic dep). */
  bindVerticalStackRadius(resolver: () => number): void {
    this.resolveVerticalStackRadiusTiles = resolver;
  }

  getOcclusionStartLevel(): number | null {
    return this.occlusionStartLevel;
  }

  invalidateCache(): void {
    this.lastCachedTileX = -9999;
    this.lastCachedTileZ = -9999;
    this.lastCachedActiveLevel = "";
    this.lastCachedVerticalStackRadius = -1;
    this.cachedRenderableLevels = [];
  }

  registerMeshForLevel(levelKey: string, mesh: Mesh): void {
    let set = this.levelMeshes.get(levelKey);
    if (!set) {
      set = new Set<Mesh>();
      this.levelMeshes.set(levelKey, set);
    }
    set.add(mesh);
    this.meshLevelByMesh.set(mesh, levelKey);
  }

  getRenderableLevels(): string[] {
    const playerPos = this.config.getPlayerPosition();
    const tileX = Math.floor(playerPos.x);
    const tileZ = Math.floor(playerPos.z);
    const verticalStackRadius = this.resolveVerticalStackRadiusTiles();
    const renderLevel = this.config.getRenderLevel();
    const isFirstPerson = this.config.getIsFirstPerson();

    if (
      tileX === this.lastCachedTileX &&
      tileZ === this.lastCachedTileZ &&
      renderLevel === this.lastCachedActiveLevel &&
      isFirstPerson === this.lastCachedIsFirstPerson &&
      verticalStackRadius === this.lastCachedVerticalStackRadius &&
      this.cachedRenderableLevels.length > 0
    ) {
      return this.cachedRenderableLevels;
    }

    this.lastCachedTileX = tileX;
    this.lastCachedTileZ = tileZ;
    this.lastCachedActiveLevel = renderLevel;
    this.lastCachedIsFirstPerson = isFirstPerson;
    this.lastCachedVerticalStackRadius = verticalStackRadius;

    const mapData = this.config.getMapDataCache();
    if (!mapData?.levels) {
      this.cachedRenderableLevels = [renderLevel];
      return this.cachedRenderableLevels;
    }

    const stack = resolveVerticalVisibleLevels(
      renderLevel,
      tileX,
      tileZ,
      Object.keys(mapData.levels),
      this.config.getMapTileAt,
      (symbol) =>
        symbol ? mapData.tileDefinitions?.[symbol] : undefined,
      {
        parseLevelNumber: this.config.parseLevelNumber,
        columnRadius: verticalStackRadius,
      },
    );
    const merged = new Set<string>(stack);
    merged.add(renderLevel);
    const n = this.config.parseLevelNumber(renderLevel);
    const below = String(n - 1);
    const above = String(n + 1);
    if (mapData.levels[below]) {
      merged.add(below);
    }
    if (mapData.levels[above]) {
      merged.add(above);
    }
    this.cachedRenderableLevels = Object.keys(mapData.levels)
      .filter((key) => merged.has(key))
      .sort(
        (a, b) =>
          this.config.parseLevelNumber(a) - this.config.parseLevelNumber(b),
      );
    return this.cachedRenderableLevels;
  }

  syncVerticalLevelVisibility(deltaSeconds: number): void {
    const mapData = this.config.getMapDataCache();
    const verticallyVisible = new Set(this.getRenderableLevels());
    this.occlusionStartLevel = this.findUpperOcclusionLevel();
    const lerpFactor = Math.min(1, deltaSeconds * 8);
    const isFirstPerson = this.config.getIsFirstPerson();
    const holeFallLandingLevel = this.config.getHoleFallLandingLevel();

    if (isFirstPerson && this.levelMeshes.size > 0) {
      const showLevels = mapData?.levels
        ? new Set(Object.keys(mapData.levels))
        : new Set([this.config.getCurrentLevel()]);
      if (holeFallLandingLevel) {
        showLevels.add(holeFallLandingLevel);
      }

      this.levelMeshes.forEach((meshes, levelKey) => {
        const showLevel = showLevels.has(levelKey);
        meshes.forEach((mesh) => {
          if (!mesh || mesh.isDisposed()) {
            return;
          }
          if (!showLevel) {
            if (mesh.visibility !== 0) {
              mesh.visibility = 0;
            }
            if (mesh.isEnabled()) {
              mesh.setEnabled(false);
            }
            return;
          }
          if (mesh.visibility !== 1) {
            mesh.visibility = 1;
          }
          if (!mesh.isEnabled()) {
            mesh.setEnabled(true);
          }
        });
      });
    } else if (!isFirstPerson && this.levelMeshes.size > 0) {
      this.levelMeshes.forEach((meshes, levelKey) => {
        const levelNum = this.config.parseLevelNumber(levelKey);
        const inVerticalColumn = verticallyVisible.has(levelKey);

        meshes.forEach((mesh) => {
          if (!mesh || mesh.isDisposed()) {
            return;
          }

          if (!inVerticalColumn) {
            if (mesh.visibility !== 0) {
              mesh.visibility = 0;
            }
            if (mesh.isEnabled()) {
              mesh.setEnabled(false);
            }
            return;
          }

          const occluded =
            this.occlusionStartLevel !== null &&
            levelNum >= this.occlusionStartLevel;

          if (occluded) {
            if (mesh.visibility !== 0) {
              mesh.visibility = 0;
            }
            if (mesh.isEnabled()) {
              mesh.setEnabled(false);
            }
            return;
          }

          if (mesh.visibility !== 1) {
            const next = mesh.visibility + (1 - mesh.visibility) * lerpFactor;
            const targetVisibility = next >= 0.99 ? 1 : next;
            if (mesh.visibility !== targetVisibility) {
              mesh.visibility = targetVisibility;
            }
            if (!mesh.isEnabled() && targetVisibility > 0.01) {
              mesh.setEnabled(true);
            }
            return;
          }

          if (!mesh.isEnabled()) {
            mesh.setEnabled(true);
          }
        });
      });
    }

    this.config.waterEffectSystem.updateOcclusion(
      this.occlusionStartLevel,
      deltaSeconds,
    );

    const playerPos = this.config.getPlayerPosition();
    window.__slice3dVerticalVisibility = {
      currentLevel: this.config.getCurrentLevel(),
      visibleLevels: Array.from(verticallyVisible),
      occludedFromLevel: this.occlusionStartLevel,
      occlusionScanRadius: DEFAULT_OCCLUSION_SCAN_RADIUS,
      verticalStackRadiusTiles: this.resolveVerticalStackRadiusTiles(),
      firstPersonCeilingLevel: null,
      totalLevels: mapData?.levels ? Object.keys(mapData.levels).length : 1,
      columnRadius: this.resolveVerticalStackRadiusTiles(),
      playerTile: {
        x: Math.floor(playerPos.x),
        y: Math.floor(playerPos.z),
      },
      ts: Date.now(),
    };
  }

  /** @deprecated Alias kept for chunk register compatibility. */
  updateUpperLevelVisibility(deltaSeconds: number): void {
    this.syncVerticalLevelVisibility(deltaSeconds);
  }

  hideWallsOnRay(): void {
    if (this.config.getIsFirstPerson()) {
      return;
    }
    if (this.occlusionStartLevel === null) {
      return;
    }

    const mapData = this.config.getMapDataCache();
    if (!mapData?.levels) {
      return;
    }

    const camera = this.config.getCamera();
    const camPos = camera.position;
    const heroPos = this.config.getPlayerPosition();
    const dy = heroPos.y - camPos.y;
    if (Math.abs(dy) < 0.001) {
      return;
    }

    const currentNum = this.config.parseLevelNumber(this.config.getRenderLevel());
    const dir = heroPos.subtract(camPos);
    const toHide = new Set<Mesh>();

    for (const levelKey of Object.keys(mapData.levels)) {
      const levelNum = this.config.parseLevelNumber(levelKey);
      if (levelNum <= currentNum) {
        continue;
      }
      if (
        this.occlusionStartLevel !== null &&
        levelNum >= this.occlusionStartLevel
      ) {
        continue;
      }

      const floorY = this.config.levelToWorldY(levelNum) + WALK_SURFACE;
      const ceilingY = this.config.levelToWorldY(levelNum) + LEVEL_HEIGHT;

      const tFloor = (floorY - camPos.y) / dy;
      const tCeil = (ceilingY - camPos.y) / dy;
      const t0 = Math.max(0, Math.min(tFloor, tCeil));
      const t1 = Math.min(1, Math.max(tFloor, tCeil));
      if (t0 >= t1) {
        continue;
      }

      const x0 = camPos.x + t0 * dir.x;
      const z0 = camPos.z + t0 * dir.z;
      const x1 = camPos.x + t1 * dir.x;
      const z1 = camPos.z + t1 * dir.z;

      this.ddaWalk(x0, z0, x1, z1, (tx, tz) => {
        const sym = this.config.getMapTileAt(levelKey, tx, tz);
        if (
          !sym ||
          sym === "..." ||
          !this.config.isStaticTileBlocking(
            sym,
            mapData.tileDefinitions?.[sym],
          )
        ) {
          return;
        }

        const idxKey = `${levelKey}::${tx}_${tz}`;
        const mesh = this.wallTileIndex.get(idxKey);
        if (mesh && !mesh.isDisposed()) {
          toHide.add(mesh);
        }
      });
    }

    this.hiddenWallMeshes.forEach((mesh) => {
      if (!toHide.has(mesh) && !mesh.isDisposed()) {
        const lk = this.meshLevelByMesh.get(mesh);
        if (lk) {
          const ln = this.config.parseLevelNumber(lk);
          if (
            this.occlusionStartLevel !== null &&
            ln >= this.occlusionStartLevel
          ) {
            return;
          }
        }
        mesh.visibility = 1;
        mesh.setEnabled(true);
      }
    });

    toHide.forEach((mesh) => {
      if (!mesh.isDisposed()) {
        mesh.visibility = 0;
        mesh.setEnabled(false);
      }
    });

    this.hiddenWallMeshes.clear();
    toHide.forEach((mesh) => {
      this.hiddenWallMeshes.add(mesh);
    });
  }

  findUpperOcclusionLevel(): number | null {
    const mapData = this.config.getMapDataCache();
    if (!mapData?.levels) {
      return null;
    }

    const footLevel = this.config.getRenderLevel();
    const playerPos = this.config.getPlayerPosition();
    if (this.config.isGradedWalkAt(playerPos.x, playerPos.z, footLevel)) {
      return null;
    }

    const camera = this.config.getCamera();
    const camPos = camera.position;
    const heroPos = playerPos;
    const dir = heroPos.subtract(camPos);
    const currentNum = this.config.parseLevelNumber(footLevel);

    const upperLevels = Object.keys(mapData.levels)
      .filter((key) => this.config.parseLevelNumber(key) > currentNum)
      .sort(
        (a, b) =>
          this.config.parseLevelNumber(a) - this.config.parseLevelNumber(b),
      );

    for (const levelKey of upperLevels) {
      const levelNum = this.config.parseLevelNumber(levelKey);
      const floorY = this.config.levelToWorldY(levelNum) + WALK_SURFACE;

      const t = (floorY - camPos.y) / (heroPos.y - camPos.y);
      if (t < 0 || t >= 1) {
        continue;
      }

      const tileX = Math.floor(camPos.x + t * dir.x);
      const tileZ = Math.floor(camPos.z + t * dir.z);

      const sym = this.config.getMapTileAt(levelKey, tileX, tileZ);
      if (sym && sym !== "...") {
        const upperFloorY = this.config.levelToWorldY(levelNum) + WALK_SURFACE;
        const headY = heroPos.y + HERO_BODY_HEIGHT * 0.92;
        if (headY >= upperFloorY - 0.15) {
          return null;
        }
        return levelNum;
      }
    }

    return null;
  }

  private ddaWalk(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    callback: (tx: number, tz: number) => void,
  ): void {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const absDx = Math.abs(dx);
    const absDz = Math.abs(dz);
    const stepX = dx >= 0 ? 1 : -1;
    const stepZ = dz >= 0 ? 1 : -1;

    let tx = Math.floor(x0);
    let tz = Math.floor(z0);
    const endTx = Math.floor(x1);
    const endTz = Math.floor(z1);

    callback(tx, tz);
    if (tx === endTx && tz === endTz) {
      return;
    }
    if (absDx < 0.001 && absDz < 0.001) {
      return;
    }

    const tMaxStepX = absDx > 0.001 ? 1.0 / absDx : 1e9;
    const tMaxStepZ = absDz > 0.001 ? 1.0 / absDz : 1e9;

    const nextBoundaryX = stepX > 0 ? Math.floor(x0) + 1 : Math.floor(x0);
    const nextBoundaryZ = stepZ > 0 ? Math.floor(z0) + 1 : Math.floor(z0);
    let tMaxX = absDx > 0.001 ? Math.abs((nextBoundaryX - x0) / dx) : 1e9;
    let tMaxZ = absDz > 0.001 ? Math.abs((nextBoundaryZ - z0) / dz) : 1e9;

    while (tx !== endTx || tz !== endTz) {
      if (tMaxX < tMaxZ) {
        tMaxX += tMaxStepX;
        tx += stepX;
      } else {
        tMaxZ += tMaxStepZ;
        tz += stepZ;
      }
      callback(tx, tz);
    }
  }
}
