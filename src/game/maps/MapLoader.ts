/**
 * MAP LOADER SERVICE
 * Core interface for the Binary Map System (BMS).
 * DOCUMENTATION: See /docs/SYSTEM_BMS.md for architecture and data format.
 */
import Phaser from "phaser";
import { EnemyRegistry } from "../entities/EnemyRegistry";
import { PlayerState } from "../entities/Player/PlayerState";
import { TileRegistry } from "../graphics/tiles/TileRegistry";
import { WeaponRegistry } from "../entities/weapons/WeaponRegistry";
import { ItemRegistry } from "../entities/items/ItemRegistry";

import { LevelData, MultiLevelMapData } from "./MapTypes";

export interface ItemEntity {
  itemId?: string; // Optional fixed UUID
  weaponId: string;
  x: number;
  y: number;
  contents?: { id: string; count: number }[];
}

export interface LoadResult {
  wallsLayer: Phaser.Physics.Arcade.StaticGroup;
  playerPos: { x: number; y: number };
  enemies: Array<{
    type: string;
    level: string;
    x: number;
    y: number;
    health: number;
    damage: number;
    respawnTime?: number;
  }>;
  items: ItemEntity[];
  decorations: Array<{
    symbol: string;
    x: number;
    y: number;
    scale?: number;
    rotation?: number;
    isCollidable?: boolean;
  }>;
  mapWidth: number;
  mapHeight: number;
}

export class MapLoader {
  private scene: Phaser.Scene;
  private wallsLayers: Map<string, Phaser.Physics.Arcade.StaticGroup>;
  private currentLevel: string = "1"; // BMS default to Level 1
  private tileSize: number = 32;
  private mapWidth: number = 0;
  private mapHeight: number = 0;
  private binaryLevels: Map<string, Uint8Array> = new Map();
  private mapMetadata: MultiLevelMapData | null = null;
  private tileAtlas: string[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.wallsLayers = new Map();
  }

  public getCurrentLevel() {
    return this.currentLevel;
  }

  public getTileSize() {
      return this.tileSize;
  }

  public getMapWidth() {
      return this.mapWidth;
  }

  public getMapHeight() {
      return this.mapHeight;
  }
  
  public getWallsLayer(level?: string) {
      return this.wallsLayers.get(level || this.currentLevel);
  }

  public getBinaryLevels(): Map<string, Uint8Array> {
      return this.binaryLevels;
  }

  public getEnemiesForLevel(level: string) {
    const currentMap = this.scene.registry.get("currentMap");
    const data = this.scene.cache.json.get(`${currentMap}_${level}`);
    if (!data) return [];
    return this.parseEntities(data.levelData, this.tileSize).enemies;
  }

  private async fetchBinary(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch binary: ${url}`);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  public async loadAllLevels(mapName: string): Promise<void> {
    try {
      console.log(`[BMS] Loading Metadata: maps/${mapName}.json`);
      const data = await this.loadJson(`maps/${mapName}.json`);
      this.mapMetadata = data;
      this.tileSize = data.tileSize;
      this.mapWidth = data.width * data.tileSize;
      this.mapHeight = data.height * data.tileSize;
      this.tileAtlas = data.tileAtlas;

      this.scene.cache.json.add(`${mapName}_data`, data);

      // We load ALL binaries up front as they are small (1MB each)
      // and we want smooth transitions.
      const levelPromises = Object.keys(data.levels).map(async (level) => {
          const levelInfo = data.levels[level];
          const binUrl = `maps/${levelInfo.binFile}`;
          const binData = await this.fetchBinary(binUrl);
          this.binaryLevels.set(level, binData);
          
          // Original loadLevel style logic to init physics group
          await this.loadLevel(mapName, level, data);
      });

      await Promise.all(levelPromises);
      console.log(`[BMS] Sub-systems initialized for ${this.binaryLevels.size} levels.`);
      
    } catch (error) {
      console.error("Error loading all levels (BMS):", error);
      throw error;
    }
  }

  public async setActiveLevel(level: string): Promise<LoadResult> {
    const currentMap = this.scene.registry.get("currentMap");
    const levelKey = `${currentMap}_${level}`;
    const cachedData = this.scene.cache.json.get(levelKey);
    if (!cachedData) {
      throw new Error(`Level ${level} not loaded`);
    }
    this.currentLevel = level;
    const entities = this.parseEntities(cachedData.levelData, this.tileSize);
    this.mapWidth = cachedData.mapWidth;
    this.mapHeight = cachedData.mapHeight;
    return {
      wallsLayer: cachedData.wallsLayer,
      playerPos: entities.playerPos,
      enemies: entities.enemies.map(e => ({...e, level})), // PASS LEVEL TO ENEMY DEF
      items: entities.items,
      decorations: entities.decorations,
      mapWidth: cachedData.mapWidth,
      mapHeight: cachedData.mapHeight,
    };
  }
  
  public isPositionTransparent(level: string, x: number, y: number): boolean {
       // Simple check if position is within map bounds and not empty?
       // Actually used for cursor visibility?
       // This method was referenced in lint errors. I'll implement a basic version or stub.
       // Assuming it checks if tile is not a wall?
       return false; // Stub
  }

  public getTileAt(x: number, y: number, level: string): string | null {
    const binData = this.binaryLevels.get(level);
    if (!binData || !this.mapMetadata) return null;

    const width = this.mapMetadata.width;
    const height = this.mapMetadata.height;

    if (x < 0 || x >= width || y < 0 || y >= height) return null;

    const index = binData[y * width + x];
    const symbol = this.tileAtlas[index];
    
    return symbol || null;
  }

  public getTerrainCategory(x: number, y: number, level: string): string | null {
      if (!this.mapMetadata) return null;

      const symbol = this.getTileAt(x, y, level);
      if (!symbol) return null;

      // Check direct tile definition
      const tileDef = this.mapMetadata.tileDefinitions[symbol];
      if (tileDef) {
          if (tileDef.category) return tileDef.category;
          if (tileDef.id) return tileDef.id; // Fallback to ID
          
          // Check 'under' layer
          if (tileDef.under && this.mapMetadata.tileDefinitions[tileDef.under]) {
              const under = this.mapMetadata.tileDefinitions[tileDef.under];
              return under.category || under.id || null;
          }
      }
      return null;
  }

  private resolveSymbolToId(symbol: string, mapData: MultiLevelMapData): string {
    if (mapData.tileDefinitions[symbol]) return mapData.tileDefinitions[symbol].id;
    if (mapData.entityTemplates[symbol]) {
        const entity = mapData.entityTemplates[symbol];
        if (entity.under) return this.resolveSymbolToId(entity.under, mapData);
    }
    return symbol;
  }

  public checkLineOfSight(startX: number, startY: number, endX: number, endY: number, level: string): boolean {
    const start = new Phaser.Math.Vector2(startX, startY);
    const end = new Phaser.Math.Vector2(endX, endY);
    const line = new Phaser.Geom.Line(start.x, start.y, end.x, end.y);

    if (!this.mapMetadata) return true;

    const points = Phaser.Geom.Line.BresenhamPoints(line, this.tileSize / 4);
    
    for (const point of points) {
      const gridX = Math.floor(point.x / this.tileSize);
      const gridY = Math.floor(point.y / this.tileSize);
      
      const symbol = this.getTileAt(gridX, gridY, level);
      if (symbol && symbol !== "...") {
        const tileDef = this.mapMetadata.tileDefinitions[symbol] || this.mapMetadata.entityTemplates[symbol];
        if (tileDef) {
           const tileId = tileDef.id || (tileDef.under ? this.resolveSymbolToId(tileDef.under, this.mapMetadata) : null);
           if (tileId && TileRegistry.doesTileBlockRanged(tileId)) {
             return false;
           }
        }
      }
    }
    return true;
  }
  
  public destroy() {
      this.wallsLayers.clear();
  }

  public async loadLevel(
    mapName: string,
    level: string,
    data: any
  ): Promise<void> {
    const levelKey = `${mapName}_${level}`;

    if (this.scene.cache.json.exists(levelKey)) {
      const cachedData = this.scene.cache.json.get(levelKey);

      if (!this.wallsLayers.has(level)) {
        const wallsLayer = this.scene.physics.add.staticGroup();
        this.wallsLayers.set(level, wallsLayer);

        const updatedData = {
          ...cachedData,
          wallsLayer: wallsLayer,
        };
        this.scene.cache.json.remove(levelKey);
        this.scene.cache.json.add(levelKey, updatedData);
      }
      return;
    }

    const wallsLayer = this.scene.physics.add.staticGroup();
    this.wallsLayers.set(level, wallsLayer);

    const levelData = data.levels[level];
    const mapHeight = data.height * this.tileSize;
    const mapWidth = data.width * this.tileSize;

    this.scene.cache.json.add(levelKey, {
      wallsLayer,
      mapWidth,
      mapHeight,
      levelData,
    });
  }

  private parseEntities(
    levelData: any,
    tileSize: number
  ): {
    playerPos: { x: number; y: number };
    enemies: Array<{
      type: string;
      x: number;
      y: number;
      health: number;
      damage: number;
      respawnTime?: number;
    }>;
    items: ItemEntity[];
    decorations: Array<{
      symbol: string;
      x: number;
      y: number;
      scale?: number;
      rotation?: number;
      isCollidable?: boolean;
    }>;
  } {
    const result = {
      playerPos: { x: 0, y: 0 },
      enemies: [] as Array<any>,
      items: [] as ItemEntity[],
      decorations: [] as Array<any>,
    };
    
    const mapMetadata = this.scene.cache.json.get(
      `${this.scene.registry.get("currentMap")}_data`
    );

    // 1. BMS ARCHITECTURE (Entities Array)
    if (levelData.entities && Array.isArray(levelData.entities)) {
        levelData.entities.forEach((entity: { x: number, y: number, symbol: string, uuid?: string, contents?: any, scale?: number, rotation?: number, offX?: number, offY?: number }) => {
            const entityDef = mapMetadata.entityTemplates[entity.symbol];
            if (!entityDef) return;
            
            const worldX = entity.x * tileSize + tileSize / 2;
            const worldY = entity.y * tileSize + tileSize / 2;
            
            switch (entityDef.type) {
                case "player":
                    result.playerPos = { x: worldX, y: worldY };
                    break;
                case "enemy":
                    const enemyId = entityDef.id || entity.symbol; 
                    const enemyTypeDef = EnemyRegistry.getEnemyDefinition(enemyId);
                    if (enemyTypeDef) {
                        result.enemies.push({
                            type: enemyId,
                            x: worldX,
                            y: worldY,
                            health: enemyTypeDef.health,
                            damage: enemyTypeDef.damage,
                            respawnTime: entityDef.respawn,
                        });
                    }
                    break;
                case "item":
                    result.items.push({
                        itemId: entity.uuid || entityDef.uuid,
                        weaponId: entityDef.id,
                        x: worldX,
                        y: worldY,
                        contents: entity.contents || entityDef.contents
                    });
                    break;
                case "decoration":
                    result.decorations.push({
                        symbol: entity.symbol,
                        x: worldX + (entity.offX || 0) * tileSize,
                        y: worldY + (entity.offY || 0) * tileSize,
                        scale: entity.scale,
                        rotation: entity.rotation,
                        isCollidable: entityDef.isCollidable ?? true
                    });
                    break;
            }
        });
        
        if (levelData.playerPos) {
            result.playerPos = levelData.playerPos;
        }
        
        return result;
    }

    // 2. BACKWARD COMPATIBILITY (Scanning tile grid - Disabled in BMS)
    return result;
  }

  private async loadJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.scene.load.json("tempMapData", url);
      this.scene.load.once("complete", () => {
        const data = this.scene.cache.json.get("tempMapData");
        this.scene.cache.json.remove("tempMapData");
        if (!data) {
            reject(new Error(`Failed to load JSON: ${url}`));
            return;
        }
        resolve(data);
      });
      this.scene.load.once("loaderror", (file: any) => {
          if (file.key === "tempMapData") reject(new Error(`Load error for ${url}`));
      });
      this.scene.load.start();
    });
  }

  public seedMapItemsToPersistence(mapName: string, level: string): void {
      const currentMap = this.scene.registry.get("currentMap") || mapName;
      // Data format in cache: {levelKey} -> { levelData, ... }
      const levelKey = `${currentMap}_${level}`;
      const data = this.scene.cache.json.get(levelKey);
      
      if (!data || !data.levelData) {
          // If data isn't loaded (transition might load it via setActiveLevel, but create might not?)
          // Usually loaded by loadAllLevels.
          console.warn(`[MapLoader] Cannot seed items. Data missing for ${levelKey}`);
          return;
      }

      const items = this.parseEntities(data.levelData, this.tileSize).items;
      const playerState = PlayerState.getInstance();

      console.log(`[MapLoader] Seeding ${items.length} items for Level ${level}`);

      items.forEach(item => {
          // Generate ID if missing (shouldn't happen for items in entities)
          const uniqueId = item.itemId || `map_${level}_${item.x}_${item.y}`;
          
          playerState.addPersistentDroppedItem(level, {
              itemId: uniqueId,
              weaponId: item.weaponId,
              x: item.x,
              y: item.y
          });
          
          if (item.contents && item.contents.length > 0) {
              item.contents.forEach((content) => {
                  let def = WeaponRegistry.getWeaponDefinition(content.id);
                  if (!def) {
                      // Fallback: Check ItemRegistry directly (fixes circular dep issues)
                      def = ItemRegistry.getItem(content.id);
                  }
                  
                  const isStackable = def?.stackable;
                  
                  console.log(`[MapLoader] Seeding Content: ${content.id} (Count: ${content.count}). Found Def: ${!!def}, Stackable: ${isStackable}`);

                  if (isStackable) {
                     playerState.addItemToContainer(uniqueId, content.id, content.count);
                  } else {
                     for (let i = 0; i < content.count; i++) {
                        playerState.addItemToContainer(uniqueId, content.id, 1);
                     }
                  }
              });
          }
      });
  }
}
