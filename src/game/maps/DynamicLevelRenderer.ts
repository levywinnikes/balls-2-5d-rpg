import Phaser from "phaser";
import { MapLoader } from "./MapLoader";
import Player from "../entities/Player";
import { TileRegistry } from "../graphics/tiles/TileRegistry";
import { TilePool } from "../graphics/TilePool";
import { DroppedItem } from "../entities/DroppedItem";
import { PlayerState } from "../entities/Player/PlayerState";
import { MultiLevelMapData } from "./MapTypes";

export class DynamicLevelRenderer {
  private scene: Phaser.Scene;
  private tileSize: number;
  private currentLevel: string;
  // CHANGED: Map<Level, Map<TileKey, Sprite>> for O(1) lookup
  private renderedTiles: Map<string, Map<string, Phaser.GameObjects.Sprite>> = new Map();
  public renderRadius: number = 20;
  private tilePool: TilePool;
  private debugGraphics: Phaser.GameObjects.Graphics | null;
  private lastPlayerX: number = -999;
  private lastPlayerY: number = -999;
  private lastRenderLevel: string = "";
  private updateThreshold: number = 16;   // Only update map every 16 pixels
  private lastUpdateTime: number = 0;      // New: Time-based throttle
  private updateThrottleMs: number = 1000; // New: 1 second limit

  constructor(scene: Phaser.Scene, tileSize: number, currentLevel: string) {
    this.scene = scene;
    this.tileSize = tileSize;
    this.currentLevel = currentLevel;
    this.tilePool = new TilePool(scene, 2000); // 2000 sprites pool

    this.debugGraphics = scene.add.graphics();
    this.debugGraphics.setDepth(200000);

    // DEBUG COLLISION LISTENER
    PlayerState.getInstance().on("debugCollisionChanged", (enabled: boolean) => {
        this.updateAllTileTints(enabled);
        if (!enabled) this.debugGraphics?.clear();
    });

    // CLOUD SHADOWS LISTENER
    PlayerState.getInstance().on("cloudShadowsChanged", (enabled: boolean) => {
        if (enabled) {
            this.initClouds();
        } else {
            this.cleanupClouds();
        }
    });

    // DEBUG COLLISION LISTENER
    PlayerState.getInstance().on("debugCollisionChanged", (enabled: boolean) => {
        this.updateAllTileTints(enabled);
        if (!enabled) this.debugGraphics?.clear();
    });
  }

  private updateAllTileTints(enabled: boolean): void {
      let depthTint = 0xffffff;
    const currentLevelNum = parseInt(this.currentLevel);
    
    // THEMAL/DARKNESS EFFECTS FROM BIOME CONTRACT
    if (currentLevelNum < 0) {
        if (currentLevelNum <= -5) {
            depthTint = 0xff8888; // Reddish Heat
        } else {
            // Darken (0xCCCCCC for -1, 0x999999 for -2, etc)
            const darknessVal = Math.max(0x44, 0xff - Math.abs(currentLevelNum) * 0x33);
            depthTint = Phaser.Display.Color.GetColor(darknessVal, darknessVal, darknessVal);
        }
    }

    this.renderedTiles.forEach((levelTiles) => {
        levelTiles.forEach((sprite) => {
            // Apply depth tint first
            sprite.setTint(depthTint);
            
            // Extract isCollidable info
            const isCollidable = !!sprite.body;
            this.applyDebugTint(sprite, isCollidable, enabled, depthTint);
        });
    });
}

  private applyDebugTint(sprite: Phaser.GameObjects.Sprite, isCollidable: boolean, enabled: boolean, baseTint?: number): void {
      if (!enabled) {
          if (baseTint !== undefined) {
              sprite.setTint(baseTint);
          } else {
              sprite.clearTint();
          }
          return;
      }
      // Only tint green for walkable, NO auto-tint red for collidable (use Graphics instead)
      if (!isCollidable) {
          sprite.setTint(0x44ff44);
      } else {
          if (baseTint !== undefined) {
              sprite.setTint(baseTint);
          } else {
             sprite.clearTint();
          }
      }
  }

  // --- NEW LIGHTING SYSTEM (Fog of War) ---
  // --- NEW LIGHTING SYSTEM (Fog of War) ---
  public updateLighting(centerX: number, centerY: number, radius: number): void {
      const radiusSq = radius * radius;
      // Pre-calculate inverse radius for performance
      const invRadius = 1 / radius;
      const halfTile = this.tileSize / 2;

      this.renderedTiles.forEach((levelTiles) => {
          levelTiles.forEach((sprite) => {
              // OPTIMIZATION: Check center distance first. 
              // If completely far, black. If super close, full.
              // Logic: Calculate 4 corners for smooth gradient.
              
              const sx = sprite.x;
              const sy = sprite.y;
              
              // Corners relative to sprite center (assuming origin 0.5)
              // If origin is different (e.g. walls 0.5, 0.75), we might need to adjust.
              // Most tiles are 0.5, 0.5. Walls might be different. 
              // Let's use getBounds or just assume halfTile offsets.
              // Local offsets:
              const x0 = sx - halfTile;
              const y0 = sy - halfTile;
              const x1 = sx + halfTile;
              const y1 = sy + halfTile;
              
              // Helper to get tint for a point
              const getTint = (tx: number, ty: number) => {
                  const dx = tx - centerX;
                  const dy = ty - centerY;
                  const distSq = dx*dx + dy*dy;
                  if (distSq > radiusSq) return 0x000000;
                  
                  // Smooth Falloff
                  const dist = Math.sqrt(distSq);
                  const t = 1 - (dist * invRadius);
                  // Cubic smoothstep: t^2 * (3 - 2t)
                  const i = t * t * (3 - 2 * t);
                  const val = Math.floor(i * 255);
                  return Phaser.Display.Color.GetColor(val, val, val);
              };

              // Calculate 4 corners
              const tl = getTint(x0, y0);
              const tr = getTint(x1, y0);
              const bl = getTint(x0, y1);
              const br = getTint(x1, y1);
              
              // Apply Gradient Tint
              sprite.setTint(tl, tr, bl, br);
          });
      });
  }

  public resetLighting(): void {
       this.renderedTiles.forEach((levelTiles) => {
          levelTiles.forEach((sprite) => {
              sprite.clearTint(); // Restore original colors
          });
      });
  }

  public setCurrentLevel(level: string): void {
    this.currentLevel = level;
    this.clearRenderedTiles();
    const droppedItemsGroup = (this.scene as any)
      .droppedItemsGroup as Phaser.Physics.Arcade.Group | undefined;
    if (droppedItemsGroup) {
        droppedItemsGroup.getChildren().forEach((item) => {
        const droppedItem = item as DroppedItem;
        droppedItem.updateDepth();
        });
    }
  }

  public getRenderedTiles(level: string): Phaser.GameObjects.Sprite[] {
    const levelMap = this.renderedTiles.get(level);
    if (!levelMap) return [];
    return Array.from(levelMap.values());
  }

  public invalidateTile(level: string, x: number, y: number): void {
      const tileKey = `${level}_${x}_${y}`;
      
      // Check render for cached cache (renderedTiles)
      const levelTiles = this.renderedTiles.get(level);
      if (levelTiles) {
          // Remove main tile
          const mainKey = `${tileKey}_upper`; // Try upper first
          if (levelTiles.has(mainKey)) {
              const sprite = levelTiles.get(mainKey);
              sprite?.destroy();
              levelTiles.delete(mainKey);
          }
           // Try normal key
          if (levelTiles.has(tileKey)) {
              const sprite = levelTiles.get(tileKey);
              sprite?.destroy();
              levelTiles.delete(tileKey);
          }
          
          // Remove under tiles
          const underKey = `${tileKey}_under`;
          if (levelTiles.has(underKey)) {
               const sprite = levelTiles.get(underKey);
               sprite?.destroy();
               levelTiles.delete(underKey);
          }
          const underUpperKey = `${tileKey}_under_upper`;
          if (levelTiles.has(underUpperKey)) {
               const sprite = levelTiles.get(underUpperKey);
               sprite?.destroy();
               levelTiles.delete(underUpperKey);
          }
      }
  }

  public reloadMap(): void {
      this.clearRenderedTiles();
      this.renderedTiles.clear();
      // Force update will happen in next game loop
  }

  public update(playerX: number, playerY: number): void {
    // HARD LIMIT: 20 tiles radius (approx 41x41 area) for maximum performance regardless of screen size
    this.renderRadius = 20;

    const mapData = this.scene.cache.json.get(
      `${this.scene.registry.get("currentMap")}_data`
    ) as MultiLevelMapData;
    if (!mapData) {
      console.warn("Map data not found");
      return;
    }
    const currentLevel = this.scene.registry.get("currentLevel");
    
    // THROTTLING CHECK: 1 second limit OR level change OR distance
    const timeSinceLastUpdate = Date.now() - this.lastUpdateTime;
    const distMoved = Phaser.Math.Distance.Between(playerX, playerY, this.lastPlayerX, this.lastPlayerY);
    
    const levelChanged = (currentLevel !== this.lastRenderLevel);
    const shouldUpdate = levelChanged || (timeSinceLastUpdate > this.updateThrottleMs && distMoved > this.updateThreshold);

    if (!shouldUpdate) {
        return;
    }

    this.lastUpdateTime = Date.now();
    this.lastPlayerX = playerX;
    this.lastPlayerY = playerY;
    this.lastRenderLevel = currentLevel;

    if (currentLevel !== this.currentLevel) {
      this.currentLevel = currentLevel;
      this.updateCollisionForCurrentLevel();
    }
    const currentLevelData = mapData.levels[this.currentLevel];
    if (!currentLevelData) {
      console.warn(`Level data for ${this.currentLevel} not found`);
      return;
    }
    const gridX = Math.floor(playerX / this.tileSize);
    const gridY = Math.floor(playerY / this.tileSize);
    const minX = Math.max(0, gridX - this.renderRadius);
    const maxX = Math.min(
      currentLevelData.map[0].length - 1,
      gridX + this.renderRadius
    );
    const minY = Math.max(0, gridY - this.renderRadius);
    const maxY = Math.min(
      currentLevelData.map.length - 1,
      gridY + this.renderRadius
    );
    const tilesToKeep: string[] = [];
    const mapLoader = (this.scene as any).mapLoader as MapLoader | undefined;
    const wallsLayer = mapLoader?.getWallsLayer?.();

    // Renderiza tiles do nível atual
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const symbol = currentLevelData.map[y]?.[x];
        // [STABILITY FIX] Explicitly handle reservations. SYMBOL '...' is NOT a tile key.
        if (!symbol || symbol === "...") {
          this.renderLowerLevelTile(x, y, mapData, tilesToKeep);
          continue;
        }
        const tileDef = this.getTileDefinition(
          symbol,
          mapData,
          this.currentLevel,
          x,
          y
        );
        if (!tileDef || tileDef.id === "transparent") {
          this.renderLowerLevelTile(x, y, mapData, tilesToKeep); // Renderiza nível inferior para tiles transparentes
          continue;
        }
        
        const tileKey = `${this.currentLevel}_${x}_${y}`;
        
        // OPTIMIZATION: O(1) Lookup
        let levelTiles = this.renderedTiles.get(this.currentLevel);
        if (!levelTiles) {
            levelTiles = new Map();
            this.renderedTiles.set(this.currentLevel, levelTiles);
        }

        if (!levelTiles.has(tileKey)) {
          const worldX = x * this.tileSize + this.tileSize / 2;
          const worldY = y * this.tileSize + this.tileSize / 2;
          const levelOffset = this.getDepthForLevel(
            parseInt(this.currentLevel),
            parseInt(this.currentLevel)
          );
          
          const { sprite, isCollidable } = TileRegistry.createTile(
            this.scene,
            tileDef.id,
            worldX,
            worldY,
            { levelOffset, isUnderTile: false }
          );
          sprite.setName(tileKey);
          sprite.setVisible(true);
          sprite.setActive(true);
          
          levelTiles.set(tileKey, sprite);

          if (isCollidable || mapData.tiles[symbol]?.block === true) {
            if (wallsLayer) wallsLayer.add(sprite);
            if (mapData.tiles[symbol]?.block === true || isCollidable) {
                 const body = sprite.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
                  if (body) {
                      if ('setImmovable' in body) body.setImmovable(true);

                      // Priority: If Registry has explicit body settings, use them and STOP
                      const registryDef = TileRegistry.getTileDefinition(tileDef.id);
                      if (registryDef?.bodySize || registryDef?.bodyOffset) {
                          if (registryDef.bodySize) body.setSize(registryDef.bodySize.width, registryDef.bodySize.height);
                          if (registryDef.bodyOffset) body.setOffset(registryDef.bodyOffset.x, registryDef.bodyOffset.y);
                      } else if (tileDef.id.includes("wall") || tileDef.id.includes("chest")) {
                          // Fallback Wall Physics based on Orientation
                          if (mapData.tiles[symbol]?.isFrontWall) {
                              // South Wall / Front Wall (Obscures Player)
                              // Collision at Bottom Base (Bottom 32px)
                              body.setSize(this.tileSize, 32); 
                              body.setOffset(0, this.tileSize - 32); 
                          } else if (tileDef.id.includes("side")) {
                              // Side Wall (Vertical)
                              body.setSize(32, 32);
                              body.setOffset((this.tileSize - 32) / 2, this.tileSize - 32); 
                          } else {
                              // North Wall / Back Wall (Player overlaps)
                              // Collision at Bottom Base (matching South wall)
                              body.setSize(this.tileSize, 32);
                              body.setOffset(0, this.tileSize - 32);
                          }
                      }
                      
                      // CRITICAL: Update static body to reflect size/offset changes in the physics engine
                      if (body instanceof Phaser.Physics.Arcade.StaticBody) {
                          // body.updateFromGameObject(); // REMOVED: Resets size to full sprite!
                      }
                  }
            }
          }
        }
        
        const isCollidableEffective = TileRegistry.isCollidable(tileDef.id) || (mapData.tiles[symbol]?.block === true);
        if (levelTiles.has(tileKey)) {
            // Main level tiles (0 or current) have NO base tint (undefined)
            this.applyDebugTint(levelTiles.get(tileKey)!, isCollidableEffective, PlayerState.getInstance().isDebugCollisionEnabled());
        }

        tilesToKeep.push(tileKey);
        
        // Verifica under para tiles válidos
        if (tileDef.under) {
          if (tileDef.under === "...") {
            this.renderLowerLevelTile(x, y, mapData, tilesToKeep);
          } else {
            const underTileId = this.resolveSymbolToId(tileDef.under, mapData);
            const underTileKey = `${this.currentLevel}_${x}_${y}_under`;

            if (!levelTiles.has(underTileKey)) {
              try {
                const worldX = x * this.tileSize + this.tileSize / 2;
                const worldY = y * this.tileSize + this.tileSize / 2;
                const levelOffset = this.getDepthForLevel(
                    parseInt(this.currentLevel),
                    parseInt(this.currentLevel)
                );

                const underTile = TileRegistry.createTile(
                  this.scene,
                  underTileId,
                  worldX,
                  worldY,
                  { levelOffset, isUnderTile: true }
                );
                underTile.sprite.setName(underTileKey);
                underTile.sprite.setVisible(true);
                underTile.sprite.setActive(true);
                levelTiles.set(underTileKey, underTile.sprite);
              } catch (err) {
                  console.warn(`Failed to create under tile with ID '${underTileId}':`, err);
              }
            }
            tilesToKeep.push(underTileKey);
          }
        }
      }
    }

    const player = (this.scene as any).player as Player | undefined;
    if (!player?.sprite?.body) {
      // console.warn("Player sprite or body not found"); // Suppress warning for Editor
      return;
    }
    const playerBounds = player.sprite.getBounds();
    const currentLevelNum = parseInt(this.currentLevel);
    const maxLevel = Math.max(
      ...Object.keys(mapData.levels).map((level) => parseInt(level))
    );
    const levelsToRender: number[] = [];
    for (
      let levelToCheck = currentLevelNum + 1;
      levelToCheck <= maxLevel;
      levelToCheck++
    ) {
      if (!mapData.levels[levelToCheck.toString()]) {
        continue;
      }
      const levelData = mapData.levels[levelToCheck.toString()];
      let hasOverlap = false;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const symbol = levelData.map[y]?.[x];
          if (
            !symbol ||
            symbol === "..." ||
            mapData.tiles[symbol]?.under === "..."
          ) {
            continue;
          }
          const tileDef = mapData.tiles[symbol] || mapData.entities[symbol];
          if (tileDef) {
            const worldX = x * this.tileSize + this.tileSize / 2;
            const worldY = y * this.tileSize + this.tileSize / 2;
            const tileBounds = new Phaser.Geom.Rectangle(
              worldX - this.tileSize / 2,
              worldY - this.tileSize / 2,
              this.tileSize,
              this.tileSize
            );
            if (Phaser.Geom.Rectangle.Overlaps(playerBounds, tileBounds)) {
              hasOverlap = true;
              break;
            }
          }
        }
        if (hasOverlap) break;
      }
      if (hasOverlap) {
        break;
      }
      levelsToRender.push(levelToCheck);
    }
    for (const level of levelsToRender) {
      this.renderUpperLevelTile(
        level,
        mapData,
        tilesToKeep,
        gridX,
        gridY,
        minX,
        maxX,
        minY,
        maxY
      );
    }
    const droppedItemsGroup = (this.scene as any)
      .droppedItemsGroup as Phaser.Physics.Arcade.Group | undefined;
    if (droppedItemsGroup) {
        droppedItemsGroup.getChildren().forEach((item) => {
        const droppedItem = item as DroppedItem;
        droppedItem.updateDepth();
        });
    }

    this.cleanupTiles(tilesToKeep);

    if (PlayerState.getInstance().isDebugCollisionEnabled()) {
        this.drawDebugHitboxes();
    }
    
    // Update Cloud Mask
    this.updateCloudMask(gridX, gridY, minX, maxX, minY, maxY, mapData);
  }

  private updateCollisionForCurrentLevel(): void {
    const mapLoader = (this.scene as any).mapLoader as MapLoader | undefined;
    const wallsLayer = mapLoader?.getWallsLayer?.();
    if (wallsLayer) {
      const player = (this.scene as any).player as Player;
      if (player?.sprite?.body) {
        this.scene.physics.world.collide(player.sprite, wallsLayer);
      }
    }
  }

  private resolveSymbolToId(symbol: string, mapData: MultiLevelMapData): string {
    // 1. Check if it's already an ID in our tileset
    if (mapData.tiles[symbol]) {
        return mapData.tiles[symbol].id;
    }
    // 2. Check entities (some 'under' layers might point to entity symbols, though rare)
    if (mapData.entities[symbol]) {
        const entity = mapData.entities[symbol];
        if (entity.under) return this.resolveSymbolToId(entity.under, mapData);
    }
    // 3. Fallback: treat as raw ID (might be using full ID directly in JSON)
    return symbol;
  }

  private getTileDefinition(
    symbol: string,
    mapData: MultiLevelMapData,
    level: string,
    x: number,
    y: number
  ): { id: string; under?: string } | undefined {
    // With v2.50, entities are NO LONGER in the map grid.
    // The grid strictly contains terrain tiles.
    return mapData.tiles[symbol];
  }

  private renderLowerLevelTile(
    x: number,
    y: number,
    mapData: MultiLevelMapData,
    tilesToKeep: string[]
  ): void {
    const currentLevelNum = parseInt(this.currentLevel);
    let levelToCheck = currentLevelNum - 1;
    while (levelToCheck >= 0 && mapData.levels[levelToCheck.toString()]) {
      const levelData = mapData.levels[levelToCheck.toString()];
      const symbol = levelData.map[y]?.[x];

      if (!symbol || symbol === "...") {
        levelToCheck--;
        continue;
      }
      const tileDef = this.getTileDefinition(
        symbol,
        mapData,
        levelToCheck.toString(),
        x,
        y
      );
      if (!tileDef) {
        levelToCheck--;
        continue;
      }
      if (tileDef.id === "transparent") {
        levelToCheck--;
        continue;
      }
      
      const levelStr = levelToCheck.toString();
      let levelTiles = this.renderedTiles.get(levelStr);
      if (!levelTiles) {
          levelTiles = new Map();
          this.renderedTiles.set(levelStr, levelTiles);
      }
      
      const worldX = x * this.tileSize + this.tileSize / 2;
      const worldY = y * this.tileSize + this.tileSize / 2;
      const levelOffset = this.getDepthForLevel(levelToCheck, currentLevelNum);
      const tileKey = `${levelToCheck}_${x}_${y}`;

      if (!levelTiles.has(tileKey)) {
        const { sprite } = TileRegistry.createTile(
          this.scene,
          tileDef.id,
          worldX,
          worldY,
          { levelOffset, isUnderTile: false }
        );
        sprite.setTint(0x666666);
        sprite.setAlpha(0.8);
        sprite.setName(tileKey);
        sprite.setVisible(true);
        sprite.setActive(true);
        levelTiles.set(tileKey, sprite);
      }
      tilesToKeep.push(tileKey);
      
      const isCollidableEffective = !!mapData.tiles[symbol]?.block || TileRegistry.isCollidable(tileDef.id);
      if (levelTiles.has(tileKey)) {
          // Lower level tiles MUST preserve 0x666666 tint
          this.applyDebugTint(levelTiles.get(tileKey)!, isCollidableEffective, PlayerState.getInstance().isDebugCollisionEnabled(), 0x999999);
      }
      
      if (tileDef.under && tileDef.under !== "...") {
        // RESOLVE symbol to ID
        const underTileId = this.resolveSymbolToId(tileDef.under, mapData);
        const underTileKey = `${levelToCheck}_${x}_${y}_under`;
        
        if (!levelTiles.has(underTileKey)) {
          try {
            const underTile = TileRegistry.createTile(
              this.scene,
              underTileId,
              worldX,
              worldY,
              { levelOffset: levelOffset - 1, isUnderTile: true }
            );
            underTile.sprite.setTint(0x666666);
            underTile.sprite.setAlpha(0.8);
            underTile.sprite.setName(underTileKey);
            underTile.sprite.setVisible(true);
            underTile.sprite.setActive(true);
            levelTiles.set(underTileKey, underTile.sprite);
          } catch (error) {
                console.warn(`Failed to create under tile (lower) with ID '${underTileId}':`, error);
          }
        }
        tilesToKeep.push(underTileKey);
      }
      break;
    }
    // Fallback to water tile if no valid tile is found
    if (levelToCheck < 0) {
      const worldX = x * this.tileSize + this.tileSize / 2;
      const worldY = y * this.tileSize + this.tileSize / 2;
      const levelOffset = this.getDepthForLevel(0, currentLevelNum);
      const tileKey = `0_${x}_${y}_fallback`;
      
      let level0Tiles = this.renderedTiles.get("0");
      if(!level0Tiles) {
           level0Tiles = new Map();
           this.renderedTiles.set("0", level0Tiles);
      }

      if (!level0Tiles.has(tileKey)) {
        const { sprite } = TileRegistry.createTile(
          this.scene,
          "water",
          worldX,
          worldY,
          { levelOffset, isUnderTile: true }
        );
        sprite.setTint(0x666666);
        sprite.setAlpha(0.8);
        sprite.setName(tileKey);
        sprite.setVisible(true);
        sprite.setActive(true);
        level0Tiles.set(tileKey, sprite);
      }
      tilesToKeep.push(tileKey);
    }
  }

  private renderUpperLevelTile(
    level: number,
    mapData: MultiLevelMapData,
    tilesToKeep: string[],
    gridX: number,
    gridY: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): void {
    const currentLevelNum = parseInt(this.currentLevel);
    const levelStr = level.toString();
    const levelData = mapData.levels[levelStr];
    
    if (!levelData) {
      console.warn(`Level data for level ${level} not found`);
      return;
    }
    
    let levelTiles = this.renderedTiles.get(levelStr);
    if (!levelTiles) {
        levelTiles = new Map();
        this.renderedTiles.set(levelStr, levelTiles);
    }

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const symbol = levelData.map[y]?.[x];
        // [STABILITY FIX] Skip absolute transparency on upper levels
        if (!symbol || symbol === "...") {
          continue;
        }
        const tileDef = this.getTileDefinition(
          symbol,
          mapData,
          levelStr,
          x,
          y
        );
        if (!tileDef || tileDef.id === "transparent") {
          continue;
        }
        
        const tileKey = `${level}_${x}_${y}_upper`;
        
        if (!levelTiles.has(tileKey)) {
          const worldX = x * this.tileSize + this.tileSize / 2;
          const worldY = y * this.tileSize + this.tileSize / 2;
          const levelOffset = this.getDepthForLevel(level, currentLevelNum);
          
          const { sprite } = TileRegistry.createTile(
            this.scene,
            tileDef.id,
            worldX,
            worldY,
            { levelOffset, isUnderTile: false },
            this.tilePool.getRawPool()
          );
          sprite.setAlpha(1.0);
          sprite.setName(tileKey);
          sprite.setVisible(true);
          sprite.setActive(true);
          levelTiles.set(tileKey, sprite);
        }
        tilesToKeep.push(tileKey);
        
        if (tileDef.under && tileDef.under !== "...") {
          const underTileDef = mapData.tiles[tileDef.under];
          if (underTileDef) {
            const underTileKey = `${level}_${x}_${y}_under_upper`;
            if (!levelTiles.has(underTileKey)) {
             const worldX = x * this.tileSize + this.tileSize / 2;
             const worldY = y * this.tileSize + this.tileSize / 2;
             const levelOffset = this.getDepthForLevel(level, currentLevelNum);

              const underTile = TileRegistry.createTile(
                this.scene,
                underTileDef.id,
                worldX,
                worldY,
                { levelOffset: levelOffset - 1, isUnderTile: true },
                this.tilePool.getRawPool()
              );
              underTile.sprite.setAlpha(1.0);
              underTile.sprite.setName(underTileKey);
              underTile.sprite.setVisible(true);
              underTile.sprite.setActive(true);
              levelTiles.set(underTileKey, underTile.sprite);
            }
            tilesToKeep.push(underTileKey);
          }
        }
        
        const isCollidableEffective = !!mapData.tiles[symbol]?.block || TileRegistry.isCollidable(tileDef.id);
        if (levelTiles.has(tileKey)) {
            // Upper level tiles usually no tint, or maybe we want a distinct tint? 
            // Current logic implies standard render (clearTint).
            this.applyDebugTint(levelTiles.get(tileKey)!, isCollidableEffective, PlayerState.getInstance().isDebugCollisionEnabled());
        }
      }
    }
  }

  private getDepthForLevel(targetLevel: number, currentLevel: number): number {
    const levelDiff = targetLevel - currentLevel;
    // Major offset for distinct floors, plus standard range for Y-sorting within floor
    return levelDiff * 10000;
  }

  private cleanupTiles(tilesToKeep: string[]): void {
    const keepSet = new Set(tilesToKeep);
    
    // Iterate over each level's tile map
    this.renderedTiles.forEach((levelTiles, level) => {
      const keysToRemove: string[] = [];
      
      // Identify tiles to remove
      levelTiles.forEach((sprite, key) => {
        if (!keepSet.has(key)) {
          // Return to pool instead of destroy
          this.tilePool.release(sprite);
          keysToRemove.push(key);
        }
      });
      
      // Remove them from the map
      keysToRemove.forEach((key) => {
        levelTiles.delete(key);
      });

      // Cleanup empty levels
      if (levelTiles.size === 0) {
        this.renderedTiles.delete(level);
      }
    });
  }

  private clearRenderedTiles(): void {
    this.renderedTiles.forEach((tiles) =>
      tiles.forEach((tile) => tile.destroy())
    );
    this.renderedTiles.clear();
  }



  private drawDebugHitboxes(): void {
    const graphics = this.debugGraphics;
    if (!graphics) return;
    graphics.clear();
    
    this.renderedTiles.forEach((levelMap) => {
      levelMap.forEach((sprite) => {
        const body = sprite.body as Phaser.Physics.Arcade.Body;
        if (body) {
           // Use body's customized debug color if set (e.g. Blue from Registry), else default Red
           const color = (body as any).debugBodyColor || 0xff0000;
           
           graphics.lineStyle(2, color, 1);
           graphics.fillStyle(color, 0.3);

          // Draw rect matching the arcade body
          graphics.strokeRect(body.x, body.y, body.width, body.height);
          graphics.fillRect(body.x, body.y, body.width, body.height);
        }
      });
    });
  }

  // --- CLOUD SHADOW SYSTEM ---

  private cloudShadowSprite: Phaser.GameObjects.TileSprite | null = null;
  private cloudMaskGraphics: Phaser.GameObjects.Graphics | null = null;
  private isCloudSystemReady: boolean = false;

  public initClouds(): void {
      if (this.isCloudSystemReady) return;
      
      const enabled = PlayerState.getInstance().isCloudShadowsEnabled();
      if (!enabled) return;

      // 1. Generate Texture if not exists
      if (!this.scene.textures.exists("cloud_noise")) {
          this.generateCloudTexture();
      }

      // 2. Create Mask Graphics (The "Stencil")
      // We will draw WHITE rectangles where the sky is visible (allowing the shadow to be seen)
      // Actually, standard masking: The mask shape reveals the content.
      // So we draw where we WANT shadows (Outdoors).
      this.cloudMaskGraphics = this.scene.make.graphics({ x: 0, y: 0 });
      const mask = this.cloudMaskGraphics.createGeometryMask();

      // 3. Create the Shadow TileSprite (Covering the screen)
      // We make it large enough to cover the render radius
      const width = this.scene.scale.width + 512; // Extra buffer
      const height = this.scene.scale.height + 512;
      
      this.cloudShadowSprite = this.scene.add.tileSprite(0, 0, width, height, "cloud_noise");
      this.cloudShadowSprite.setScrollFactor(0); // Sticks to camera, but we offset texture
      this.cloudShadowSprite.setDepth(19000); // Very high, but below UI (20000+ typically) and Debug
      this.cloudShadowSprite.setAlpha(0.35); // Slightly lighter (Requested)
      this.cloudShadowSprite.setTint(0x000000); // Black shadows
      this.cloudShadowSprite.setMask(mask);
      
      this.isCloudSystemReady = true;
  }

  private generateCloudTexture(): void {
      // Increase texture size to avoid visible repetition (tiling pattern)
      // Screen is likely > 1024, so 512 repeats 3-4 times.
      // 2048 ensures we see "1 or 2" unique clouds on the whole screen.
      const width = 2048;
      const height = 2048;
      const key = "cloud_noise";

      const canvas = this.scene.textures.createCanvas(key, width, height);
      if (!canvas) return;

      const ctx = canvas.getContext();
      
      // Clear
      ctx.clearRect(0, 0, width, height); 
      
      // Soft edges
      ctx.filter = 'blur(15px)'; 
      ctx.fillStyle = "white"; 

      // "Uma ou no maximo duas por vez"
      // On a 2048x2048 map, 2 clouds is very sparse.
      const cloudCount = 2;
      
      const drawWrappedCircle = (cx: number, cy: number, r: number) => {
          const draw = (dx: number, dy: number) => {
              ctx.beginPath();
              ctx.arc(dx, dy, r, 0, Math.PI * 2);
              ctx.fill();
          };

          // Draw & Wrap Logic
          draw(cx, cy);
          if (cx - r < 0) draw(cx + width, cy);
          if (cx + r > width) draw(cx - width, cy);
          if (cy - r < 0) draw(cx, cy + height);
          if (cy + r > height) draw(cx, cy - height);
          
          if (cx - r < 0 && cy - r < 0) draw(cx + width, cy + height);
          if (cx + r > width && cy - r < 0) draw(cx - width, cy + height);
          if (cx - r < 0 && cy + r > height) draw(cx + width, cy - height);
          if (cx + r > width && cy + r > height) draw(cx - width, cy - height);
      };

      for (let i = 0; i < cloudCount; i++) {
          const cx = Math.random() * width;
          const cy = Math.random() * height;
          
          // Huge Clouds for this resolution
          // Base 150-250px
          const baseRadius = 150 + Math.random() * 100;
          drawWrappedCircle(cx, cy, baseRadius);
          
          // Attachments
          const attachments = 4 + Math.floor(Math.random() * 5);
          for(let j=0; j<attachments; j++) {
             const angle = Math.random() * Math.PI * 2;
             const dist = baseRadius * (0.5 + Math.random() * 0.4);
             const r = baseRadius * (0.4 + Math.random() * 0.5);
             
             drawWrappedCircle(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, r);
          }
      }
      
      canvas.refresh();
  }

  public updateClouds(time: number, delta: number): void {
      if (!this.cloudShadowSprite) return;

      // Scroll the texture slowly (Wind)
      this.cloudShadowSprite.tilePositionX += 0.01 * delta; // Slow drift X
      this.cloudShadowSprite.tilePositionY += 0.005 * delta; // Slow drift Y
      
      // Center the sprite container on the camera? 
      // Actually setScrollFactor(0) keeps it on screen, but we might want to offset tilePosition 
      // based on world camera to simulate "world" clouds not just screen overlay?
      // "Parallax" effect?
      // If we walk, clouds should stay in world position (mostly).
      // So we should add camera.scrollX to tilePosition.
      
      const cam = this.scene.cameras.main;
      // We only want the WIND movement here.
      // Use rendering update to sync world pos.
      
      // Sync Sprite position to camera center (it has scrollfactor 0, so it's always centered on screen 0,0?)
      // Phaser TileSprite with ScrollFactor 0 stays at x,y on SCREEN. 
      // We placed it at 0,0 (Top Left of Screen).
      // We need it to cover the screen.
      this.cloudShadowSprite.setPosition(cam.width/2, cam.height/2);
      this.cloudShadowSprite.setSize(cam.width + 256, cam.height + 256);
      
      // Parallax: Move texture opposite to camera?
      // tilePosition = CameraPos + TimeOffset
      this.cloudShadowSprite.tilePositionX = cam.scrollX * 0.5 + (time * 0.02);
      this.cloudShadowSprite.tilePositionY = cam.scrollY * 0.5 + (time * 0.01);
  }

  /**
   * Checks if a tile at (x, y) on currentLevel is exposed to the sky.
   * i.e., NO solid tiles in any level > currentLevel at this (x,y).
   */
  private isExposedToSky(x: number, y: number, mapData: MultiLevelMapData): boolean {
      const currentLevelNum = parseInt(this.currentLevel);
      
      // Check all levels strictly ABOVE current
      for (const levelKey in mapData.levels) {
          const lvl = parseInt(levelKey);
          if (lvl <= currentLevelNum) continue; // Skip current and below
          
          const levelData = mapData.levels[levelKey];
          const symbol = levelData.map[y]?.[x];

          if (symbol && symbol !== "...") {
               // Found SOMETHING above.
               // Is it solid/roof?
               // If it's a transparent tile (like just a region marker), maybe it doesn't block sun?
               // Assuming ALL tiles in higher levels block sun (Roofs, Floors).
               
               const tileDef = mapData.tiles[symbol] || mapData.entities[symbol];
               // "transparent" might mean invisible logic tile
               if (tileDef && tileDef.id === "transparent") continue;
               
               return false; // Valid tile found above -> Blocked
          }
      }
      
      return true; // No blockers found
  }

  // UPDATED update method injection point...
  // Since I can't easily inject into the middle of the large 'update' function in this tool call, 
  // I created this separate method. The user will need to call 'updateCloudsMask' manually or 
  // I need to be careful.
  // Wait, I am editing the file. I can try to append logic to 'update' if I view it again or 
  // I can rename the existing 'update' and wrap it? No, risky.
  
  // Strategy: I will add a call to 'drawCloudMask' inside 'update' if I can replace the whole function.
  // The function is large (lines 110-358). 
  // I will just add the method `updateCloudMask` and call it separately or ask to replace the update block.
  
  public updateCloudMask(gridX: number, gridY: number, minX: number, maxX: number, minY: number, maxY: number, mapData: MultiLevelMapData): void {
      if (!this.cloudMaskGraphics) this.initClouds();
      if (!this.cloudMaskGraphics) return;

      this.cloudMaskGraphics.clear();
      this.cloudMaskGraphics.fillStyle(0xffffff, 1);

      // Iterate the same visible range as the renderer
      // We draw Rectangles where sky is visible.
      for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
               if (this.isExposedToSky(x, y, mapData)) {
                   const worldX = x * this.tileSize;
                   const worldY = y * this.tileSize;
                   this.cloudMaskGraphics.fillRect(worldX, worldY, this.tileSize, this.tileSize);
               }
          }
      }
    }

  public destroy(): void {
      this.renderedTiles.forEach((tiles) => {
          tiles.forEach((tile) => tile.destroy());
      });
      this.renderedTiles.clear();

      if (this.debugGraphics) {
          this.debugGraphics.destroy();
          this.debugGraphics = null;
      }

      this.cleanupClouds();
  }

  private cleanupClouds(): void {
      if (this.cloudShadowSprite) {
          this.cloudShadowSprite.destroy();
          this.cloudShadowSprite = null; 
      }
      if (this.cloudMaskGraphics) {
          this.cloudMaskGraphics.destroy();
          this.cloudMaskGraphics = null;
      }
      this.isCloudSystemReady = false; 
  }
}
