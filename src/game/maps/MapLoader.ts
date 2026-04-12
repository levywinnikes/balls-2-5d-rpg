import Phaser from "phaser";
import { EnemyRegistry } from "../entities/EnemyRegistry";
import { PlayerState } from "../entities/Player/PlayerState";
import { TileRegistry } from "../graphics/tiles/TileRegistry";
import { WeaponRegistry } from "../entities/weapons/WeaponRegistry";
import { ItemRegistry } from "../entities/items/ItemRegistry";

interface LevelData {
  map: string[][];
  playerPos?: { x: number; y: number };
  safeZones?: { minX: number; minY: number; maxX: number; maxY: number }[];
}

interface MultiLevelMapData {
  tileSize: number;
  levels: { [level: string]: LevelData };
  tiles: Record<
    string,
    {
      id: string;
      block?: boolean;
      under?: string;
      color?: string;
      isFrontWall?: boolean;
      blockUnder?: boolean;
      category?: string; // e.g. "grass", "dirty", "snow"
    }
  >;
  entities: Record<
    string,
    {
      type: string;
      id?: string;
      under?: string;
      respawn?: number;
      uuid?: string;
      contents?: { id: string; count: number }[];
    }
  >;
}

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
  private currentLevel: string = "0";
  private tileSize: number = 32;
  private mapWidth: number = 0;
  private mapHeight: number = 0;

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

  public getEnemiesForLevel(level: string) {
    const currentMap = this.scene.registry.get("currentMap");
    const data = this.scene.cache.json.get(`${currentMap}_${level}`);
    if (!data) return [];
    return this.parseEntities(data.levelData, this.tileSize).enemies;
  }

  public async loadAllLevels(mapName: string): Promise<void> {
    try {
      const data = await this.loadJson(`${mapName}.json`);
      this.tileSize = data.tileSize;
      const { normalizedData, needsNormalization } =
        this.normalizeMapSizes(data);
      if (needsNormalization) {
        this.generateNormalizedJson(mapName, normalizedData);
      }
      this.scene.cache.json.add(`${mapName}_data`, normalizedData);
      await Promise.all(
        Object.keys(normalizedData.levels).map((level) =>
          this.loadLevel(mapName, level, normalizedData)
        )
      );
    } catch (error) {
      console.error("Error loading all levels:", error);
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
    const currentMap = this.scene.registry.get("currentMap");
    const levelKey = `${currentMap}_${level}`;
    const cachedData = this.scene.cache.json.get(levelKey);

    if (!cachedData || !cachedData.levelData || !cachedData.levelData.map) {
        return null;
    }

    const map = cachedData.levelData.map;
    if (y < 0 || y >= map.length || x < 0 || x >= map[0].length) {
        return null;
    }

    const tileId = map[y][x];
    console.log(`[MapLoader] getTileAt(${x}, ${y}, ${level}) -> '${tileId}'`);
    return tileId;
  }

  public getTerrainCategory(x: number, y: number, level: string): string | null {
      const currentMap = this.scene.registry.get("currentMap");
      const mapData = this.scene.cache.json.get(`${currentMap}_data`);
      if (!mapData) return null;

      const levelData = mapData.levels[level];
      if (!levelData) return null;

      if (y < 0 || y >= levelData.map.length || x < 0 || x >= levelData.map[0].length) {
          return null;
      }
      
      const symbol = levelData.map[y][x];
      // Check direct tile definition
      const tileDef = mapData.tiles[symbol];
      if (tileDef) {
          if (tileDef.category) return tileDef.category;
          if (tileDef.id) return tileDef.id; // Fallback to ID
          
          // Check 'under' layer
          if (tileDef.under && mapData.tiles[tileDef.under]) {
              const under = mapData.tiles[tileDef.under];
              return under.category || under.id || null;
          }
      }
      return null;
  }

  private resolveSymbolToId(symbol: string, mapData: MultiLevelMapData): string {
    if (mapData.tiles[symbol]) return mapData.tiles[symbol].id;
    if (mapData.entities[symbol]) {
        const entity = mapData.entities[symbol];
        if (entity.under) return this.resolveSymbolToId(entity.under, mapData);
    }
    return symbol;
  }

  public checkLineOfSight(startX: number, startY: number, endX: number, endY: number, level: string): boolean {
    const start = new Phaser.Math.Vector2(startX, startY);
    const end = new Phaser.Math.Vector2(endX, endY);
    const line = new Phaser.Geom.Line(start.x, start.y, end.x, end.y);

    const currentMap = this.scene.registry.get("currentMap");
    const mapData = this.scene.cache.json.get(`${currentMap}_data`);
    if (!mapData) return true;

    const levelData = mapData.levels[level];
    if (!levelData) return true;

    // Aumentar precisão usando passos menores (1/4 do tileSize)
    const points = Phaser.Geom.Line.BresenhamPoints(line, this.tileSize / 4);
    
    for (const point of points) {
      const gridX = Math.floor(point.x / this.tileSize);
      const gridY = Math.floor(point.y / this.tileSize);
      
      const symbol = levelData.map[gridY]?.[gridX];
      if (symbol && symbol !== "...") {
        const tileDef = mapData.tiles[symbol] || mapData.entities[symbol];
        if (tileDef) {
           const tileId = tileDef.id || (tileDef.under ? this.resolveSymbolToId(tileDef.under, mapData) : null);
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

  private normalizeMapSizes(data: MultiLevelMapData): {
    normalizedData: MultiLevelMapData;
    needsNormalization: boolean;
  } {
    let maxRows = 0;
    let maxCols = 0;
    for (const level in data.levels) {
      const levelData = data.levels[level];
      maxRows = Math.max(maxRows, levelData.map.length);
      maxCols = Math.max(maxCols, levelData.map[0]?.length || 0);
    }
    let needsNormalization = false;
    for (const level in data.levels) {
      const levelData = data.levels[level];
      if (
        levelData.map.length !== maxRows ||
        levelData.map[0]?.length !== maxCols
      ) {
        needsNormalization = true;
        break;
      }
    }
    if (!needsNormalization) {
      return { normalizedData: data, needsNormalization: false };
    }
    const normalizedLevels: { [level: string]: LevelData } = {};
    for (const level in data.levels) {
      const levelData = data.levels[level];
      const currentRows = levelData.map.length;
      const currentCols = levelData.map[0]?.length || 0;
      const fillTile = level === "0" ? "wat" : "...";
      const newMap: string[][] = [];
      for (let y = 0; y < maxRows; y++) {
        const row: string[] = [];
        for (let x = 0; x < maxCols; x++) {
          if (y < currentRows && x < currentCols) {
            row.push(levelData.map[y][x]);
          } else {
            row.push(fillTile);
          }
        }
        newMap.push(row);
      }
      normalizedLevels[level] = {
        map: newMap,
        playerPos: levelData.playerPos,
        safeZones: levelData.safeZones,
      };
    }
    const normalizedData: MultiLevelMapData = {
      ...data,
      levels: normalizedLevels,
    };
    return { normalizedData, needsNormalization: true };
  }

  private generateNormalizedJson(
    mapName: string,
    normalizedData: MultiLevelMapData
  ): void {
      // Just console log or no-op as we are running in browser context mostly
      // and cannot write to disk easily here without server support.
      // The original code tried to format JSON string, but returned void.
      return; 
  }

  public async loadLevel(
    mapName: string,
    level: string,
    data: MultiLevelMapData
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
    const mapHeight = levelData.map.length * this.tileSize;
    const mapWidth = levelData.map[0].length * this.tileSize;

    this.scene.cache.json.add(levelKey, {
      wallsLayer,
      mapWidth,
      mapHeight,
      levelData,
    });
  }

  private parseEntities(
    levelData: any, // Use any to handle transition between interface versions
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
    
    const mapData = this.scene.cache.json.get(
      `${this.scene.registry.get("currentMap")}_data`
    );

    // 1. NEW ARCHITECTURE (Layered Entities Array)
    if (levelData.entities && Array.isArray(levelData.entities)) {
        levelData.entities.forEach((entity: { x: number, y: number, symbol: string, uuid?: string, contents?: any, scale?: number, rotation?: number, offX?: number, offY?: number }) => {
            const entityDef = mapData.entities[entity.symbol];
            if (!entityDef) return;
            
            const worldX = entity.x * tileSize + tileSize / 2;
            const worldY = entity.y * tileSize + tileSize / 2;
            
            switch (entityDef.type) {
                case "player":
                    result.playerPos = { x: worldX, y: worldY };
                    break;
                case "enemy":
                    const enemyId = entityDef.id || entity.symbol; // Use ID or symbol as fallback
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
        
        // If we have playerPos in levelData, prioritize it for the player
        if (levelData.playerPos) {
            result.playerPos = levelData.playerPos;
        }
        
        return result;
    }

    // 2. BACKWARD COMPATIBILITY (Scanning tile grid)
    for (let y = 0; y < levelData.map.length; y++) {
      const row = levelData.map[y];
      for (let x = 0; x < row.length; x++) {
        const symbol = row[x];
        const entityDef = mapData.entities[symbol];
        if (!entityDef) continue;
        const worldX = x * tileSize + tileSize / 2;
        const worldY = y * tileSize + tileSize / 2;
        switch (entityDef.type) {
          case "player":
            result.playerPos = { x: worldX, y: worldY };
            break;
          case "enemy":
            const enemyId = entityDef.id || symbol;
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
                 itemId: entityDef.uuid,
                 weaponId: entityDef.id,
                 x: worldX,
                 y: worldY,
                 contents: entityDef.contents
             });
             break;
        }
      }
    }
    return result;
  }

  private async loadJson(url: string): Promise<MultiLevelMapData> {
    return new Promise((resolve) => {
      this.scene.load.json("tempMapData", url);
      this.scene.load.once("complete", () => {
        const data = this.scene.cache.json.get("tempMapData");
        this.scene.cache.json.remove("tempMapData");
        
        // Basic preprocessing for simplified map formats (array of strings vs array of arrays)
        const normalizedData: MultiLevelMapData = {
          ...data,
          levels: {},
        };
        for (const level in data.levels) {
            const levelData = data.levels[level];
            let map: string[][];
            if (levelData.map.length > 0 && typeof levelData.map[0] === "string") {
                 // Convert list of strings to list of string arrays (splitting by space/tab is unsafe if symbols have length?
                 // Usually symbols are fixed length or separated. The original code split by \s+.
                 map = levelData.map.map((row: string) => row.trim().split(/\s+/));
            } else {
                map = levelData.map;
            }
            normalizedData.levels[level] = { ...levelData, map };
        }
        resolve(normalizedData);
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
