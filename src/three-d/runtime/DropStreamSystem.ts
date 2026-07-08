import {
  Scene,
  TransformNode,
  StandardMaterial,
  Color3,
  MeshBuilder,
  Texture,
} from "@babylonjs/core";
import { ItemRegistry } from "../../core/registries/ItemRegistry";
import { WeaponRegistry } from "../../core/registries/WeaponRegistry";
import type { DroppedItemData } from "../../game/entities/Player/PlayerState";

export type SliceDroppedItem = DroppedItemData & { level: string };

export type DropStreamConfig = {
  scene: Scene;
  mapRoot: TransformNode;
  getPlayerPosition: () => { x: number; z: number };
  getCurrentLevel: () => string;
  levelToWorldY: (level: string | number) => number;
  worldToSliceCoord: (value: number) => number;
  resolveWorldAnchorY: (ix: number, iz: number, level: string, restOffset: number) => number;
  getDeterministicRotation: (id: string) => number;
  loadMapDataAsync: () => Promise<any>;
  getPersistentDroppedItems: (level: string) => DroppedItemData[];
  addPersistentDroppedItem: (level: string, item: DroppedItemData) => void;
  removePersistentDroppedItem: (level: string, uid: string) => void;
  hasVisitedLevel: (level: string) => boolean;
  markLevelVisited: (level: string) => void;
  seededLevels: Set<string>;
  addItemToContainer: (containerUid: string, itemId: string, count: number) => void;
  logWarn: (msg: string) => void;
};

export class DropStreamSystem {
  droppedItemMeshes = new Map<string, TransformNode>();
  droppedItemStreamRadiusUnits: number = 0;
  hasRealDroppedItems = false;

  private config: DropStreamConfig;
  private dropSyncTimer = 0;
  private seedingLevels = new Set<string>();
  private DROP_SYNC_INTERVAL = 0.2;
  private DROPPED_ITEM_REST_OFFSET = 0.02;

  private droppedItemIconMaterials = new Map<string, StandardMaterial>();
  private droppedItemShadowMat: StandardMaterial;

  constructor(config: DropStreamConfig) {
    this.config = config;
    this.droppedItemShadowMat = new StandardMaterial(
      "slice-dropped-shadow-mat",
      config.scene,
    );
    this.droppedItemShadowMat.diffuseColor = Color3.Black();
    this.droppedItemShadowMat.specularColor = Color3.Black();
    this.droppedItemShadowMat.disableLighting = true;
  }

  private getDroppedItemMaterial(itemVisualId: string): StandardMaterial {
    const cached = this.droppedItemIconMaterials.get(itemVisualId);
    if (cached) return cached;
    const mat = new StandardMaterial(
      `slice-dropped-item-${itemVisualId}`,
      this.config.scene,
    );
    mat.backFaceCulling = false;
    mat.specularColor = Color3.Black();
    mat.useAlphaFromDiffuseTexture = true;
    mat.disableLighting = true;
    mat.emissiveColor = Color3.White();
    const texture = new Texture(
      `/assets/items/${itemVisualId}.png`,
      this.config.scene,
      false,
      true,
      Texture.NEAREST_NEAREST,
    );
    texture.hasAlpha = true;
    mat.diffuseTexture = texture;
    mat.opacityTexture = texture;
    this.droppedItemIconMaterials.set(itemVisualId, mat);
    return mat;
  }

  private getDroppedItemMeshKey(level: string, itemId: string): string {
    return `${level}::${itemId}`;
  }

  async ensureLevelSeeded(level: string): Promise<void> {
    const cfg = this.config;
    if (cfg.seededLevels.has(level) || this.seedingLevels.has(level)) return;

    if (cfg.hasVisitedLevel(level)) {
      cfg.seededLevels.add(level);
      return;
    }

    this.seedingLevels.add(level);

    try {
      const mapData = await cfg.loadMapDataAsync();
      if (!mapData) {
        throw new Error("Map metadata missing");
      }

      const tileSize = mapData.tileSize || 32;
      const levelData = mapData.levels?.[level];
      const entityTemplates = mapData.entityTemplates || {};

      if (levelData?.entities && Array.isArray(levelData.entities)) {
        levelData.entities.forEach((entity: any) => {
          const entityDef = entityTemplates[entity.symbol];
          if (!entityDef || entityDef.type !== "item") return;

          const worldX = entity.x * tileSize + tileSize / 2;
          const worldY = entity.y * tileSize + tileSize / 2;
          const rawItemUid = entity.uuid || entityDef.uuid;
          const uniqueId = rawItemUid || `map_${level}_${entity.x}_${entity.y}`;

          cfg.addPersistentDroppedItem(level, {
            itemId: uniqueId,
            weaponId: entityDef.id,
            x: worldX,
            y: worldY,
          });

          const contents = entity.contents || entityDef.contents;
          if (!contents || !Array.isArray(contents)) return;

          contents.forEach((content: { id: string; count: number }) => {
            const def =
              WeaponRegistry.getWeaponDefinition(content.id) ||
              ItemRegistry.getItem(content.id);
            const isStackable = !!def?.stackable;

            if (isStackable) {
              cfg.addItemToContainer(uniqueId, content.id, content.count);
              return;
            }

            for (let i = 0; i < content.count; i++) {
              cfg.addItemToContainer(uniqueId, content.id, 1);
            }
          });
        });
      }

      cfg.markLevelVisited(level);
      cfg.seededLevels.add(level);
    } catch (error) {
      cfg.logWarn(
        `Failed to seed map items for ${level}: ${error}`,
      );
    } finally {
      this.seedingLevels.delete(level);
    }
  }

  syncStream(force = false): void {
    const cfg = this.config;

    if (!force) {
      const now = performance.now();
      const prev = (this.syncStream as any)._lastSyncAt as number | undefined;
      if (prev !== undefined && now - prev < this.DROP_SYNC_INTERVAL * 1000) {
        return;
      }
      (this.syncStream as any)._lastSyncAt = now;
    }

    const currentLevel = cfg.getCurrentLevel();

    const persistentItems = cfg.getPersistentDroppedItems(currentLevel);
    const playerPos = cfg.getPlayerPosition();
    const maxDistSq =
      this.droppedItemStreamRadiusUnits * this.droppedItemStreamRadiusUnits;

    const streamedItems = persistentItems.filter((item) => {
      const ix = cfg.worldToSliceCoord(item.x);
      const iz = cfg.worldToSliceCoord(item.y);
      const dx = ix - playerPos.x;
      const dz = iz - playerPos.z;
      return dx * dx + dz * dz <= maxDistSq;
    });

    const nextKeys = new Set(
      streamedItems.map((item) =>
        this.getDroppedItemMeshKey(currentLevel, item.itemId),
      ),
    );

    this.droppedItemMeshes.forEach((mesh, meshKey) => {
      const item = mesh.metadata as SliceDroppedItem | undefined;
      const isCurrentLevelMesh = item?.level === currentLevel;

      if (!isCurrentLevelMesh || !nextKeys.has(meshKey)) {
        mesh.dispose();
        this.droppedItemMeshes.delete(meshKey);
        return;
      }

      mesh.setEnabled(true);
    });

    streamedItems.forEach((item) => {
      const meshKey = this.getDroppedItemMeshKey(currentLevel, item.itemId);
      let container = this.droppedItemMeshes.get(meshKey);
      if (!container) {
        container = new TransformNode(
          `slice-dropped-root-${item.itemId}`,
          cfg.scene,
        );

        const itemPlane = MeshBuilder.CreatePlane(
          `slice-dropped-plane-${item.itemId}`,
          { width: 0.42, height: 0.42 },
          cfg.scene,
        );
        itemPlane.material = this.getDroppedItemMaterial(item.weaponId);
        itemPlane.rotation.x = Math.PI / 2;
        itemPlane.parent = container;
        itemPlane.isPickable = false;

        const shadowDisc = MeshBuilder.CreateDisc(
          `slice-dropped-shadow-${item.itemId}`,
          { radius: 0.2, tessellation: 16 },
          cfg.scene,
        );
        shadowDisc.material = this.droppedItemShadowMat;
        shadowDisc.parent = container;
        shadowDisc.rotation.x = Math.PI / 2;
        shadowDisc.position.y = 0.002;
        shadowDisc.isPickable = false;

        container.rotation.y = cfg.getDeterministicRotation(item.itemId);

        (container as any).itemPlane = itemPlane;
        (container as any).shadowDisc = shadowDisc;

        this.droppedItemMeshes.set(meshKey, container);
      }

      const ix = cfg.worldToSliceCoord(item.x);
      const iz = cfg.worldToSliceCoord(item.y);
      const anchorY = cfg.resolveWorldAnchorY(
        ix,
        iz,
        currentLevel,
        this.DROPPED_ITEM_REST_OFFSET,
      );
      container.position.set(ix, anchorY, iz);
      container.metadata = {
        ...item,
        level: currentLevel,
      } satisfies SliceDroppedItem;
      container.setEnabled(true);
    });

    this.hasRealDroppedItems = persistentItems.length > 0;
  }

  tick(deltaSeconds: number): void {
    this.dropSyncTimer += deltaSeconds;
    if (this.dropSyncTimer >= this.DROP_SYNC_INTERVAL) {
      this.dropSyncTimer = 0;
      this.syncStream();
    }

    this.droppedItemMeshes.forEach((container) => {
      if (!container.isEnabled()) return;
      const itemPlane = (container as any).itemPlane;
      const shadowDisc = (container as any).shadowDisc;
      if (itemPlane) {
        const time = performance.now() * 0.003;
        const item = container.metadata as SliceDroppedItem | undefined;
        const phase = item
          ? this.config.getDeterministicRotation(item.itemId) * 10
          : 0;

        itemPlane.position.y = 0.06 + Math.sin(time + phase) * 0.03;

        if (shadowDisc) {
          const ratio = (itemPlane.position.y - 0.03) / 0.06;
          shadowDisc.visibility = 0.28 - ratio * 0.12;
          const scale = 1.0 - ratio * 0.15;
          shadowDisc.scaling.set(scale, scale, scale);
        }
      }
    });
  }

  reanchor(level: string): void {
    this.syncStream(true);
  }

  clear(): void {
    this.droppedItemMeshes.forEach((mesh) => mesh.dispose());
    this.droppedItemMeshes.clear();
  }
}
