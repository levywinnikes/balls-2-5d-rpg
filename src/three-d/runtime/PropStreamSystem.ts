import {
  Scene,
  TransformNode,
  Mesh,
  Vector3,
} from "@babylonjs/core";
import {
  createPropBillboard,
  isKnownPropId,
  type PropAnimRoot,
} from "./PropBillboardFactory";

export type PropSpawnData = {
  propId: string;
  tileX: number;
  tileY: number;
  isCollidable: boolean;
};

export type SliceProp = {
  uid: string;
  level: string;
  propId: string;
  tileX: number;
  tileY: number;
  meshRoot: TransformNode;
};

type SliceLevelData = {
  binFile?: string;
  entities?: Array<{ x: number; y: number; symbol: string }>;
  playerPos?: { x: number; y: number };
};

type PropSpawnCatalogEntry = {
  level: string;
  spawn: PropSpawnData;
  index: number;
};

export type PropStreamSystemConfig = {
  scene: Scene;
  mapRoot: TransformNode;
  getPlayerPosition: () => Vector3;
  getCurrentLevel: () => string;
  isFirstPerson: () => boolean;
  levelToWorldY: (level: string | number) => number;
  resolveWorldAnchorY: (worldX: number, worldZ: number, level: string, restOffset?: number) => number;
  loadMapDataAsync: () => Promise<{ levels?: Record<string, SliceLevelData>; entityTemplates?: Record<string, { type?: string; id?: string; isCollidable?: boolean }> } | null>;
  onNavigationRebuild: (level: string) => void;
};

const PROP_STREAM_SYNC_INTERVAL = 0.35;
const LEVEL_HEIGHT = 2.0;

export class PropStreamSystem {
  propStreamRadiusUnits = 0;
  propStreamRadiusUnitsFirstPerson = 0;
  propDespawnRadiusUnits = 0;

  private config: PropStreamSystemConfig;
  private props = new Map<string, SliceProp>();
  private propSpawnCatalog = new Map<string, PropSpawnCatalogEntry>();
  private collidablePropTilesByLevel = new Map<string, Set<string>>();
  private seededPropLevels = new Set<string>();
  private propStreamTimer = 0;
  private lastSyncAt = 0;

  constructor(config: PropStreamSystemConfig) {
    this.config = config;
  }

  get collidableTiles(): ReadonlyMap<string, Set<string>> {
    return this.collidablePropTilesByLevel;
  }

  isCollidableTile(level: string, tileX: number, tileY: number): boolean {
    return this.collidablePropTilesByLevel.get(level)?.has(this.getPropTileKey(tileX, tileY)) ?? false;
  }

  getProps(): ReadonlyMap<string, SliceProp> {
    return this.props;
  }

  getDebugInfo(): { level: string; streamed: number; cataloged: number } {
    return {
      level: this.config.getCurrentLevel(),
      streamed: this.props.size,
      cataloged: this.propSpawnCatalog.size,
    };
  }

  private getPropTileKey(tileX: number, tileY: number): string {
    return `${tileX},${tileY}`;
  }

  private getPropCatalogKey(level: string, spawn: PropSpawnData): string {
    return `${level}_${spawn.propId}_${spawn.tileX}_${spawn.tileY}`;
  }

  private async getPropSpawnsForLevel(level: string): Promise<PropSpawnData[]> {
    const mapData = await this.config.loadMapDataAsync();
    if (!mapData) {
      return [];
    }

    const levelData = mapData.levels?.[level];
    const templates = mapData.entityTemplates || {};
    if (!levelData?.entities) {
      return [];
    }

    const spawns: PropSpawnData[] = [];
    for (const entity of levelData.entities) {
      const template = templates[entity.symbol];
      if (!template || template.type !== "decoration" || !template.id) {
        continue;
      }
      if (!isKnownPropId(template.id)) {
        continue;
      }

      spawns.push({
        propId: template.id,
        tileX: entity.x,
        tileY: entity.y,
        isCollidable: template.isCollidable ?? false,
      });
    }

    return spawns;
  }

  private despawnProp(uid: string): void {
    const prop = this.props.get(uid);
    if (!prop) {
      return;
    }
    const observer = (prop.meshRoot as PropAnimRoot)._propAnimObserver;
    if (observer) {
      this.config.scene.onBeforeRenderObservable.remove(observer as import("@babylonjs/core").Observer<Scene>);
    }
    prop.meshRoot.dispose();
    this.props.delete(uid);
  }

  private applyPropAnimLod(prop: SliceProp, distance: number): void {
    const setter = (prop.meshRoot as PropAnimRoot)._setAnimIntervalScale;
    if (typeof setter !== "function") {
      return;
    }
    if (distance <= 18) {
      setter(1);
    } else if (distance <= 36) {
      setter(0.55);
    } else {
      setter(0.3);
    }
  }

  private spawnProp(spawn: PropSpawnData, index: number, level: string): void {
    const meshRoot = createPropBillboard(
      this.config.scene,
      spawn.propId,
      `slice-prop-${level}-${spawn.propId}-${index}`,
      spawn.tileX,
      spawn.tileY,
    );
    if (!meshRoot) {
      return;
    }

    const uid = this.getPropCatalogKey(level, spawn);
    const worldX = spawn.tileX + 0.5;
    const worldZ = spawn.tileY + 0.5;
    meshRoot.parent = this.config.mapRoot;
    meshRoot.position.set(
      worldX,
      this.config.resolveWorldAnchorY(worldX, worldZ, level),
      worldZ,
    );
    meshRoot.setEnabled(false);

    this.props.set(uid, {
      uid,
      level,
      propId: spawn.propId,
      tileX: spawn.tileX,
      tileY: spawn.tileY,
      meshRoot,
    });
  }

  syncStream(force = false): void {
    if (!force) {
      const now = performance.now();
      if (this.lastSyncAt !== 0 && now - this.lastSyncAt < PROP_STREAM_SYNC_INTERVAL * 1000) {
        return;
      }
      this.lastSyncAt = now;
    }

    const player = this.config.getPlayerPosition();
    const px = player.x;
    const pz = player.z;
    const streamRadius = this.config.isFirstPerson()
      ? this.propStreamRadiusUnitsFirstPerson
      : this.propStreamRadiusUnits;
    const streamRadiusSq = streamRadius * streamRadius;
    const despawnRadiusSq = this.propDespawnRadiusUnits * this.propDespawnRadiusUnits;
    const { getCurrentLevel, levelToWorldY, resolveWorldAnchorY } = this.config;
    const currentLevel = getCurrentLevel();

    this.props.forEach((prop, uid) => {
      if (Math.abs(levelToWorldY(prop.level) - levelToWorldY(currentLevel)) > LEVEL_HEIGHT) {
        this.despawnProp(uid);
        return;
      }
      const dx = prop.meshRoot.position.x - px;
      const dz = prop.meshRoot.position.z - pz;
      const distSq = dx * dx + dz * dz;
      if (distSq <= despawnRadiusSq) {
        if (prop.meshRoot.isEnabled()) {
          prop.meshRoot.position.y = resolveWorldAnchorY(
            prop.meshRoot.position.x,
            prop.meshRoot.position.z,
            prop.level,
          );
          this.applyPropAnimLod(prop, Math.hypot(dx, dz));
        }
        return;
      }
      this.despawnProp(uid);
    });

    this.propSpawnCatalog.forEach((entry, uid) => {
      if (Math.abs(levelToWorldY(entry.level) - levelToWorldY(currentLevel)) > LEVEL_HEIGHT || this.props.has(uid)) {
        return;
      }

      const spawnX = entry.spawn.tileX + 0.5;
      const spawnZ = entry.spawn.tileY + 0.5;
      const dx = spawnX - px;
      const dz = spawnZ - pz;
      if (dx * dx + dz * dz > streamRadiusSq) {
        return;
      }

      this.spawnProp(entry.spawn, entry.index, entry.level);
      const spawned = this.props.get(uid);
      if (!spawned) {
        return;
      }
      const dist = Math.hypot(dx, dz);
      spawned.meshRoot.position.y = resolveWorldAnchorY(spawnX, spawnZ, entry.level);
      spawned.meshRoot.setEnabled(true);
      this.applyPropAnimLod(spawned, dist);
    });
  }

  async ensureLevelSeeded(level: string): Promise<void> {
    if (this.seededPropLevels.has(level)) {
      this.syncStream(true);
      return;
    }

    const spawns = await this.getPropSpawnsForLevel(level);
    spawns.forEach((spawn, index) => {
      const key = this.getPropCatalogKey(level, spawn);
      this.propSpawnCatalog.set(key, { level, spawn, index });
      if (spawn.isCollidable) {
        const tileSet =
          this.collidablePropTilesByLevel.get(level) ?? new Set<string>();
        tileSet.add(this.getPropTileKey(spawn.tileX, spawn.tileY));
        this.collidablePropTilesByLevel.set(level, tileSet);
      }
    });
    this.seededPropLevels.add(level);

    if (level === this.config.getCurrentLevel()) {
      this.config.onNavigationRebuild(level);
    }

    this.syncStream(true);
  }

  tick(deltaSeconds: number): void {
    this.propStreamTimer += deltaSeconds;
    if (this.propStreamTimer >= PROP_STREAM_SYNC_INTERVAL) {
      this.propStreamTimer = 0;
      this.syncStream();
    }
  }

  reanchorAll(level: string): void {
    const { resolveWorldAnchorY } = this.config;
    this.props.forEach((prop) => {
      if (prop.level !== level) {
        return;
      }
      const x = prop.meshRoot.position.x;
      const z = prop.meshRoot.position.z;
      prop.meshRoot.position.y = resolveWorldAnchorY(x, z, level);
    });
  }

  clear(): void {
    this.props.forEach((prop) => {
      const observer = (prop.meshRoot as PropAnimRoot)._propAnimObserver;
      if (observer) {
        this.config.scene.onBeforeRenderObservable.remove(observer as import("@babylonjs/core").Observer<Scene>);
      }
      prop.meshRoot.dispose();
    });
    this.props.clear();
    this.propSpawnCatalog.clear();
    this.collidablePropTilesByLevel.clear();
    this.seededPropLevels.clear();
    this.propStreamTimer = 0;
    this.lastSyncAt = 0;
  }
}
