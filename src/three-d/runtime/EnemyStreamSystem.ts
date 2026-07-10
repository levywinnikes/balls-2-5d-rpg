import {
  Scene,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import {
  EnemyRegistry,
  type EnemyDefinition,
} from "../../core/registries/EnemyRegistry";
import {
  createEnemyVisual,
  setEnemyVisualAnimState,
  type EnemyVisualAnimState,
} from "./ThreeDEnemyVisualRegistry";
import { playRespawnGlowAt } from "./VfxBillboardFactory";
import type { HeroBmsDirection } from "./TwoDParitySpriteFactory";

export type EnemySpawnData = {
  enemyType: string;
  x: number;
  y: number;
};

export type PendingRespawnEntry = {
  level: string;
  spawn: EnemySpawnData;
  index: number;
  elapsedMs: number;
  respawnTimeMs: number;
};

export type SpawnCatalogEntry = {
  level: string;
  spawn: EnemySpawnData;
  index: number;
};

export type SliceEnemy = {
  uid: string;
  spawnKey: string;
  level: string;
  enemyType: string;
  definition: EnemyDefinition;
  meshRoot: TransformNode;
  health: number;
  maxHealth: number;
  worldPos: Vector3;
  spawnPos: Vector3;
  lastAttackAt: number;
  lastPathAt: number;
  currentPath: Array<{ x: number; y: number }>;
  currentPathIndex: number;
  magicCooldowns: Map<string, number>;
  isDead: boolean;
  isProvoked: boolean;
  animState: EnemyVisualAnimState;
  animDirection: HeroBmsDirection;
  animLockedUntil: number;
};

type SliceLevelData = {
  binFile?: string;
  entities?: Array<{ x: number; y: number; symbol: string }>;
  playerPos?: { x: number; y: number };
};

export type EnemyStreamSystemConfig = {
  scene: Scene;
  mapRoot: TransformNode;
  getPlayerPosition: () => Vector3;
  getCurrentLevel: () => string;
  levelToWorldY: (level: string | number) => number;
  worldToSliceCoord: (value: number) => number;
  applyActorAquaticY: (worldPos: Vector3, level: string) => void;
  loadMapDataAsync: () => Promise<{
    tileSize?: number;
    levels?: Record<string, SliceLevelData>;
    entityTemplates?: Record<string, { type?: string; id?: string }>;
  } | null>;
  onSelectedEnemyChanged: (uid: string | null) => void;
  onEnemyDeadPersistenceClear: (level: string, spawnKey: string) => void;
  isEnemy3dDead: (level: string, spawnKey: string) => boolean;
  getSelectedEnemyUid: () => string | null;
  setSelectedEnemyUid: (uid: string | null) => void;
};

const ENEMY_RESPAWN_MS = 60_000;
const ENEMY_STREAM_SYNC_INTERVAL = 0.35;
const LEVEL_HEIGHT = 2.0;

export class EnemyStreamSystem {
  enemyStreamRadiusUnits = 0;
  enemyDespawnRadiusUnits = 0;
  readonly ENEMY_RESPAWN_MS = ENEMY_RESPAWN_MS;
  readonly ENEMY_STREAM_SYNC_INTERVAL = ENEMY_STREAM_SYNC_INTERVAL;

  enemies = new Map<string, SliceEnemy>();
  pendingEnemyRespawns = new Map<string, PendingRespawnEntry>();
  spawnCatalog = new Map<string, SpawnCatalogEntry>();

  private config: EnemyStreamSystemConfig;
  private seededEnemyLevels = new Set<string>();
  private lastSyncAt = 0;
  private _streamTimer = 0;

  constructor(config: EnemyStreamSystemConfig) {
    this.config = config;
  }

  get seededLevels(): Set<string> {
    return this.seededEnemyLevels;
  }

  isSpawnKeyInstantiated(spawnKey: string): boolean {
    let found = false;
    this.enemies.forEach((enemy) => {
      if (enemy.spawnKey === spawnKey) {
        found = true;
      }
    });
    return found;
  }

  private async getEnemySpawnsForLevel(level: string): Promise<EnemySpawnData[]> {
    const mapData = await this.config.loadMapDataAsync();
    if (!mapData) {
      return [];
    }

    const tileSize = mapData.tileSize || 32;
    const levelData = mapData.levels?.[level];
    const templates = mapData.entityTemplates || {};
    if (!levelData?.entities) {
      return [];
    }

    const spawns: EnemySpawnData[] = [];
    for (const entity of levelData.entities) {
      const template = templates[entity.symbol];
      if (!template || template.type !== "enemy" || !template.id) {
        continue;
      }

      const def = EnemyRegistry.getEnemyDefinition(template.id);
      if (!def) {
        continue;
      }

      spawns.push({
        enemyType: template.id,
        x: entity.x * tileSize + tileSize / 2,
        y: entity.y * tileSize + tileSize / 2,
      });
    }

    return spawns;
  }

  private spawnEnemy(
    spawn: EnemySpawnData,
    index: number,
    spawnKey: string,
    level: string,
    options?: { withRespawnVfx?: boolean },
  ): void {
    const definition = EnemyRegistry.getEnemyDefinition(spawn.enemyType);
    if (!definition) {
      return;
    }

    if (this.pendingEnemyRespawns.has(spawnKey)) {
      return;
    }

    const uid = `${level}_${spawn.enemyType}_${index}_${Date.now().toString(36)}`;
    const meshRoot = createEnemyVisual(
      this.config.scene,
      spawn.enemyType,
      `slice-enemy-${uid}`,
    );
    const spawnLevelY = this.config.levelToWorldY(level);
    const worldPos = new Vector3(
      this.config.worldToSliceCoord(spawn.x),
      spawnLevelY,
      this.config.worldToSliceCoord(spawn.y),
    );
    this.config.applyActorAquaticY(worldPos, level);
    meshRoot.position = worldPos.clone();
    meshRoot.metadata = { sliceEnemyUid: uid };

    const instance: SliceEnemy = {
      uid,
      spawnKey,
      level,
      enemyType: spawn.enemyType,
      definition,
      meshRoot,
      health: definition.health,
      maxHealth: definition.health,
      worldPos: worldPos.clone(),
      spawnPos: worldPos.clone(),
      lastAttackAt: 0,
      lastPathAt: 0,
      currentPath: [],
      currentPathIndex: 0,
      magicCooldowns: new Map<string, number>(),
      isDead: false,
      isProvoked: false,
      animState: "idle",
      animDirection: "south" as HeroBmsDirection,
      animLockedUntil: 0,
    };

    this.setEnemyAnimState(instance, "idle");

    const showOnActiveLevel = () => {
      meshRoot.setEnabled(
        Math.abs(this.config.levelToWorldY(level) - this.config.levelToWorldY(this.config.getCurrentLevel())) <= LEVEL_HEIGHT,
      );
    };

    if (options?.withRespawnVfx) {
      meshRoot.setEnabled(false);
      playRespawnGlowAt(this.config.scene, worldPos, level, showOnActiveLevel);
    } else {
      showOnActiveLevel();
    }

    this.enemies.set(uid, instance);
  }

  private setEnemyAnimState(enemy: SliceEnemy, nextState: EnemyVisualAnimState, lockMs = 0): void {
    setEnemyVisualAnimState(enemy.meshRoot, nextState);
    enemy.animState = nextState;
    if (lockMs > 0) {
      enemy.animLockedUntil = performance.now() + lockMs;
    }
  }

  syncStream(force = false): void {
    if (!force) {
      const now = performance.now();
      if (this.lastSyncAt !== 0 && now - this.lastSyncAt < ENEMY_STREAM_SYNC_INTERVAL * 1000) {
        return;
      }
      this.lastSyncAt = now;
    }

    const player = this.config.getPlayerPosition();
    const px = player.x;
    const pz = player.z;
    const streamRadiusSq = this.enemyStreamRadiusUnits * this.enemyStreamRadiusUnits;
    const despawnRadiusSq = this.enemyDespawnRadiusUnits * this.enemyDespawnRadiusUnits;
    const { getCurrentLevel, levelToWorldY } = this.config;
    const currentLevel = getCurrentLevel();

    this.enemies.forEach((enemy, uid) => {
      if (Math.abs(levelToWorldY(enemy.level) - levelToWorldY(currentLevel)) > LEVEL_HEIGHT) {
        if (this.config.getSelectedEnemyUid() === uid) {
          this.config.onSelectedEnemyChanged(null);
          this.config.setSelectedEnemyUid(null);
        }
        enemy.meshRoot.dispose();
        this.enemies.delete(uid);
        return;
      }

      const dx = enemy.worldPos.x - px;
      const dz = enemy.worldPos.z - pz;
      if (dx * dx + dz * dz <= despawnRadiusSq) {
        return;
      }
      if (this.config.getSelectedEnemyUid() === uid) {
        this.config.onSelectedEnemyChanged(null);
        this.config.setSelectedEnemyUid(null);
      }
      enemy.meshRoot.dispose();
      this.enemies.delete(uid);
    });

    this.spawnCatalog.forEach((entry, spawnKey) => {
      if (Math.abs(levelToWorldY(entry.level) - levelToWorldY(currentLevel)) > LEVEL_HEIGHT) {
        return;
      }
      if (this.pendingEnemyRespawns.has(spawnKey)) {
        return;
      }
      if (this.isSpawnKeyInstantiated(spawnKey)) {
        return;
      }

      const spawnX = this.config.worldToSliceCoord(entry.spawn.x);
      const spawnZ = this.config.worldToSliceCoord(entry.spawn.y);
      const dx = spawnX - px;
      const dz = spawnZ - pz;
      if (dx * dx + dz * dz > streamRadiusSq) {
        return;
      }

      this.spawnEnemy(entry.spawn, entry.index, spawnKey, entry.level);
    });
  }

  async ensureLevelSeeded(level: string): Promise<void> {
    if (this.seededEnemyLevels.has(level)) {
      this.hydratePendingRespawnsFromPersistedDead();
      this.syncStream(true);
      return;
    }

    const spawns = await this.getEnemySpawnsForLevel(level);
    spawns.forEach((spawn, index) => {
      const spawnKey = `${level}_${spawn.enemyType}_${index}`;
      this.spawnCatalog.set(spawnKey, { level, spawn, index });
    });
    this.seededEnemyLevels.add(level);
    this.hydratePendingRespawnsFromPersistedDead();
    this.syncStream(true);
  }

  hydratePendingRespawnsFromPersistedDead(): void {
    this.spawnCatalog.forEach((entry, spawnKey) => {
      if (this.config.isEnemy3dDead(entry.level, spawnKey)) {
        if (!this.pendingEnemyRespawns.has(spawnKey)) {
          this.pendingEnemyRespawns.set(spawnKey, {
            level: entry.level,
            spawn: entry.spawn,
            index: entry.index,
            elapsedMs: 0,
            respawnTimeMs: ENEMY_RESPAWN_MS,
          });
        }
      }
    });
  }

  clearDeadPersistence(level: string, spawnKey: string): void {
    this.config.onEnemyDeadPersistenceClear(level, spawnKey);
  }

  tick(deltaSeconds: number): void {
    this._streamTimer += deltaSeconds;
    if (this._streamTimer >= ENEMY_STREAM_SYNC_INTERVAL) {
      this._streamTimer = 0;
      this.syncStream();
    }

    const respawnDeltaMs = deltaSeconds * 1000;
    const player = this.config.getPlayerPosition();
    const px = player.x;
    const pz = player.z;
    const streamRadiusSq = this.enemyStreamRadiusUnits * this.enemyStreamRadiusUnits;
    this.pendingEnemyRespawns.forEach((record, spawnKey) => {
      record.elapsedMs += respawnDeltaMs;
      if (record.elapsedMs < record.respawnTimeMs) {
        return;
      }
      this.pendingEnemyRespawns.delete(spawnKey);

      if (Math.abs(this.config.levelToWorldY(record.level) - this.config.levelToWorldY(this.config.getCurrentLevel())) > LEVEL_HEIGHT) {
        return;
      }

      const spawnX = this.config.worldToSliceCoord(record.spawn.x);
      const spawnZ = this.config.worldToSliceCoord(record.spawn.y);
      const dx = spawnX - px;
      const dz = spawnZ - pz;
      if (dx * dx + dz * dz > streamRadiusSq) {
        return;
      }

      this.clearDeadPersistence(record.level, spawnKey);
      this.spawnEnemy(record.spawn, record.index, spawnKey, record.level, {
        withRespawnVfx: true,
      });
    });
  }

  resetLivingForPlayerRespawn(): void {
    this.enemies.forEach((enemy) => {
      if (!enemy.meshRoot.isDisposed()) {
        enemy.meshRoot.dispose();
      }
    });
    this.enemies.clear();
    this.config.onSelectedEnemyChanged(null);
    this.config.setSelectedEnemyUid(null);
    this.syncStream(true);
  }

  clear(): void {
    this.enemies.forEach((enemy) => enemy.meshRoot.dispose());
    this.enemies.clear();
    this.spawnCatalog.clear();
    this.pendingEnemyRespawns.clear();
    this.seededEnemyLevels.clear();
    this.config.setSelectedEnemyUid(null);
    this._streamTimer = 0;
    this.lastSyncAt = 0;
  }
}
