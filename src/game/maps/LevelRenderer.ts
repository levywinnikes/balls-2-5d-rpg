import Phaser from "phaser";
import type { MapLoader } from "./MapLoader";
import type Player from "../entities/Player";
import { TileRegistry } from "../graphics/tiles/TileRegistry";
import { TilePool } from "../graphics/TilePool";
import type { DroppedItem } from "../entities/DroppedItem";
import { PlayerState } from "../entities/Player/PlayerState";
import { MultiLevelMapData } from "./MapTypes";
import { SideFaceGraphic } from "../graphics/tiles/SideFaceGraphic";

export default class LevelRenderer {
  private scene: Phaser.Scene;
  private tileSize: number;
  private currentLevel: string;
  private renderedTiles: Map<string, Map<string, Phaser.GameObjects.Sprite[]>> = new Map();
  private renderedDecorations: Map<string, Phaser.GameObjects.Sprite[]> = new Map();
  private renderedSideFaces: Map<string, Phaser.GameObjects.Sprite[]> = new Map();
  private levelContainers: Map<string, Phaser.GameObjects.Container> = new Map();
  public activeEnemies: Map<string, any> = new Map();
  public renderRadius: number = 20;
  private tilePool: TilePool;
  private debugGraphics: Phaser.GameObjects.Graphics | null;
  private lastPlayerX: number = -999;
  private lastPlayerY: number = -999;
  private lastRenderLevel: string = "";
  private updateThreshold: number = 4;    // Only update map every 4 pixels (Super Smooth)
  private lastUpdateTime: number = 0;      // Time-based throttle
  private updateThrottleMs: number = 60;   // 60ms limit (Fast refresh)

  // --- CARDBOARD 3D SYSTEM ---
  public sideFaceHeight: number = 28;      // Altura das faces laterais (px) — configurável!
  public sideFaceWidth: number = 8;        // Largura das faces east/west (px)
  public sideFacesEnabled: boolean = true; // Toggle para ativar/desativar faces 3D
  private readonly zShiftPerLevel: number = 28; // Deslocamento vertical por nível (deve coincidir com updateAllTileTints)

  constructor(scene: Phaser.Scene, tileSize: number, currentLevel: string) {
    this.scene = scene;
    this.tileSize = tileSize;
    this.currentLevel = String(currentLevel);
    this.tilePool = new TilePool(scene, 8000); // 8000 sprites pool (Support multi-level density)

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

    (window as any)._levelRenderer = this;
  }

  private updateAllTileTints(enabled: boolean): void {
    const player = (this.scene as any).player as any;
    if (!player || !player.sprite) return;

    const currentLevelNum = parseInt(this.currentLevel);
    const playerX = player.sprite.x;
    const playerY = player.sprite.y;

    this.levelContainers.forEach((container, levelKey) => {
        const levelNum = parseInt(levelKey);
        const levelDiff = levelNum - currentLevelNum;
        
        // 1. Perspective SCALE (Subtle 4% per level for stability)
        const perspectiveScale = 1 + (levelDiff * 0.04);
        
        // 2. Perspective TRANSFORM (Vertical Z-Stacking)
        // Shift levels UP by 28px per Z-level to keep buildings 'grounded'
        const zShiftY = levelDiff * -28; 
        
        container.setScale(perspectiveScale);
        container.x = playerX * (1 - perspectiveScale);
        container.y = playerY * (1 - perspectiveScale) + zShiftY;

        // 3. Update CONTAINER DEPTH dynamically based on current level
        // This ensures that levels below the player have high negative depth, and levels above have high positive depth.
        container.setDepth(levelDiff * 100000);

        // 3.5 Force DEPTH SORTING within the container
        // Phaser 3 Containers do NOT sort by depth automatically.
        container.sort('depth');

        // 4. Perspective TINT
        let finalTint = 0xffffff;
        if (levelDiff > 0) {
            finalTint = Phaser.Display.Color.GetColor(Math.min(255, 220 + levelDiff * 20), Math.min(255, 220 + levelDiff * 20), 180);
        } else if (levelDiff < 0) {
            const darknessVal = Math.max(80, 255 + levelDiff * 50);
            finalTint = Phaser.Display.Color.GetColor(darknessVal, darknessVal, Math.min(255, darknessVal + 30));
        }

        // Apply tints to children
        container.iterate((child: any) => {
            if (!child.active) return;

            if (child.setTint) {
                child.setTint(finalTint);
            }
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
  public updateLighting(centerX: number, centerY: number, radius: number): void {
      const radiusSq = radius * radius;
      // Pre-calculate inverse radius for performance
      const invRadius = 1 / radius;
      const halfTile = this.tileSize / 2;

      this.renderedTiles.forEach((levelTiles) => {
          levelTiles.forEach((sprites) => {
              sprites.forEach(sprite => {
                  // OPTIMIZATION: Check center distance first. 
                  const sx = sprite.x;
                  const sy = sprite.y;
                  
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
                      const i = t * t * (3 - 2 * t);
                      const val = Math.floor(i * 255);
                      return Phaser.Display.Color.GetColor(val, val, val);
                  };

                  const tl = getTint(x0, y0);
                  const tr = getTint(x1, y0);
                  const bl = getTint(x0, y1);
                  const br = getTint(x1, y1);
                  
                  sprite.setTint(tl, tr, bl, br);
              });
          });
      });
  }

   public resetLighting(): void {
        this.renderedTiles.forEach((levelTiles) => {
           levelTiles.forEach((sprites) => {
               sprites.forEach(sprite => {
                   if (sprite.active) sprite.clearTint(); // Restore original colors
               });
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
    return Array.from(levelMap.values()).flat();
  }

  private getLevelContainer(level: string): Phaser.GameObjects.Container {
      let container = this.levelContainers.get(level);
      if (!container) {
          container = this.scene.add.container(0, 0);
          const levelNum = parseInt(level);
          // Set base depth
          container.setDepth(this.getDepthForLevel(levelNum, parseInt(this.currentLevel)));
          
          this.levelContainers.set(level, container);
      }
      return container;
  }

  public invalidateTile(level: string, x: number, y: number): void {
      const tileKey = `${level}_${x}_${y}`;
      
      // Check render for cached tiles
      const levelTiles = this.renderedTiles.get(level);
      if (levelTiles) {
          // Remove main tile
          const mainKey = `${tileKey}_upper`; // Try upper first
          if (levelTiles.has(mainKey)) {
              const sprites = levelTiles.get(mainKey);
              sprites?.forEach(s => s.destroy());
              levelTiles.delete(mainKey);
          }
           // Try normal key
          if (levelTiles.has(tileKey)) {
              const sprites = levelTiles.get(tileKey);
              sprites?.forEach(s => s.destroy());
              levelTiles.delete(tileKey);
          }
          
          // Remove under tiles
          const underKey = `${tileKey}_under`;
          if (levelTiles.has(underKey)) {
               const sprites = levelTiles.get(underKey);
               sprites?.forEach(s => s.destroy());
               levelTiles.delete(underKey);
          }
          const underUpperKey = `${tileKey}_under_upper`;
          if (levelTiles.has(underUpperKey)) {
               const sprites = levelTiles.get(underUpperKey);
               sprites?.forEach(s => s.destroy());
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
    const currentLevelValue = this.scene.registry.get("currentLevel");
    const currentLevel = currentLevelValue !== undefined ? String(currentLevelValue) : "0";
    
    // THROTTLING CHECK: level change OR time/distance
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

    const hideTiles = PlayerState.getInstance().getDiagnosticSettings().hideTiles;
    
    // Level change handling
    if (currentLevel !== this.currentLevel) {
      console.log(`[Renderer] Level Switch: ${this.currentLevel} -> ${currentLevel}. Purging old tiles.`);
      this.currentLevel = currentLevel;
      this.updateCollisionForCurrentLevel();
      this.clearLazyObjects(); // Clear lazy rendering caches on level switch
      // CRITICAL: When level switches, we want a clean slate for the new level's viewport
    }

    const currentLevelData = mapData.levels[this.currentLevel];
    if (!currentLevelData) {
      console.warn(`Level data for the current level not found`);
      return;
    }

    const gridX = Math.floor(playerX / this.tileSize);
    const gridY = Math.floor(playerY / this.tileSize);

    // NEW: LAZY OBJECTS UPDATE (within radii)
    this.updateDecorations(gridX, gridY);
    this.updateEnemies(gridX, gridY);

    const mapWidthTiles = Math.floor(this.scene.physics.world.bounds.width / this.tileSize);
    const mapHeightTiles = Math.floor(this.scene.physics.world.bounds.height / this.tileSize);

    const minX = Math.max(0, gridX - this.renderRadius);
    const maxX = Math.min(mapWidthTiles - 1, gridX + this.renderRadius);
    const minY = Math.max(0, gridY - this.renderRadius);
    const maxY = Math.min(mapHeightTiles - 1, gridY + this.renderRadius);
    const mapLoader = (this.scene as any).mapLoader as MapLoader | undefined;
    const wallsLayer = mapLoader?.getWallsLayer?.();

    if (!mapLoader) return;

    const tilesToKeep: string[] = [];

    // Renderiza tiles do nível atual
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const symbol = mapLoader.getTileAt(x, y, this.currentLevel);
        // [STABILITY FIX] Explicitly handle reservations. SYMBOL '...' is NOT a tile key.
        if (!symbol || symbol === "...") {
          this.renderLowerLevelTile(x, y, mapData, tilesToKeep);
          continue;
        }
        const tileDef = mapData.tileDefinitions[symbol];
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
          
          const reusable = this.tilePool.get() || undefined;
          const { sprite, additionalSprites, isCollidable } = TileRegistry.createTile(
            this.scene,
            tileDef.id,
            worldX,
            worldY,
            { levelOffset, isUnderTile: false, reusableSprite: reusable }
          );
          
          // Add to perspective container
          this.getLevelContainer(this.currentLevel).add(sprite);
          additionalSprites.forEach(s => this.getLevelContainer(this.currentLevel).add(s));

          sprite.setName(tileKey);
          sprite.setVisible(!hideTiles);
          sprite.setActive(true);
          
          levelTiles.set(tileKey, [sprite, ...additionalSprites]);

          // --- RESTORED PHYSICS COLLISION (FIX v6.1) ---
          if (isCollidable || mapData.tileDefinitions[symbol]?.block === true) {
            const wallsLayer = mapLoader?.getWallsLayer?.(this.currentLevel);
            if (wallsLayer) wallsLayer.add(sprite);
            
            const body = sprite.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
            if (body) {
                if ('setImmovable' in body) body.setImmovable(true);

                const registryDef = TileRegistry.getTileDefinition(tileDef.id);
                if (registryDef?.bodySize || registryDef?.bodyOffset) {
                    if (registryDef.bodySize) body.setSize(registryDef.bodySize.width, registryDef.bodySize.height);
                    if (registryDef.bodyOffset) body.setOffset(registryDef.bodyOffset.x, registryDef.bodyOffset.y);
                } else if (tileDef.id.includes("wall") || tileDef.id.includes("chest")) {
                    if (tileDef.isFrontWall) {
                        body.setSize(this.tileSize, 32); 
                        body.setOffset(0, this.tileSize - 32); 
                    } else if (tileDef.id.includes("side")) {
                        body.setSize(32, 32);
                        body.setOffset((this.tileSize - 32) / 2, this.tileSize - 32); 
                        body.setSize(this.tileSize, 32);
                        body.setOffset(0, this.tileSize - 32);
                    }
                }
            }
          }
        }
        
        const sprList = levelTiles.get(tileKey);
        const isCollidableEffective = TileRegistry.isCollidable(tileDef.id) || (mapData.tileDefinitions[symbol]?.block === true);
        if (levelTiles.has(tileKey)) {
            levelTiles.get(tileKey)!.forEach(s => this.applyDebugTint(s, isCollidableEffective, PlayerState.getInstance().isDebugCollisionEnabled()));
        }

        tilesToKeep.push(tileKey);
        
        if (tileDef.under) {
          if (tileDef.under === "...") {
            this.renderLowerLevelTile(x, y, mapData, tilesToKeep);
          } else {
            const underTileId = this.resolveSymbolToId(tileDef.under, mapData);
            const underTileKey = `${this.currentLevel}_${x}_${y}_under`;

            if (!levelTiles.has(underTileKey)) {
              try {
                 const reusable = this.tilePool.get() || undefined;
                 const { sprite, additionalSprites } = TileRegistry.createTile(
                   this.scene,
                   underTileId,
                   x * this.tileSize + this.tileSize / 2,
                   y * this.tileSize + this.tileSize / 2,
                   { levelOffset: this.getDepthForLevel(parseInt(this.currentLevel), parseInt(this.currentLevel)), isUnderTile: true, reusableSprite: reusable }
                 );
                 
                 this.getLevelContainer(this.currentLevel).add(sprite);
                 additionalSprites.forEach(s => this.getLevelContainer(this.currentLevel).add(s));

                 sprite.setData("worldX", x * this.tileSize + this.tileSize / 2);
                 sprite.setData("worldY", y * this.tileSize + this.tileSize / 2);
                 sprite.setName(underTileKey);
                 sprite.setVisible(!hideTiles);
                 sprite.setActive(true);
                 levelTiles.set(underTileKey, [sprite, ...additionalSprites]);
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
          const symbol = mapLoader.getTileAt(x, y, levelToCheck.toString());
          if (
            !symbol ||
            symbol === "..." ||
            mapData.tileDefinitions[symbol]?.under === "..."
          ) {
            continue;
          }
          const tileDef = mapData.tileDefinitions[symbol] || mapData.entityTemplates[symbol];
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

    // CARDBOARD 3D: Render side faces between levels
    this.renderSideFaces(mapData, minX, maxX, minY, maxY, playerX, playerY);

    // APPLY PERSPECTIVE SHADING/SCALING (v5.8 Premium Visuals)
    this.updateAllTileTints(PlayerState.getInstance().isDebugCollisionEnabled());

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
    if (mapData.tileDefinitions[symbol]) {
        return mapData.tileDefinitions[symbol].id;
    }
    if (mapData.entityTemplates[symbol]) {
        const entity = mapData.entityTemplates[symbol];
        if (entity.under) return this.resolveSymbolToId(entity.under, mapData);
    }
    return symbol;
  }

  private getTileDefinition(
    symbol: string,
    mapData: MultiLevelMapData,
    level: string,
    x: number,
    y: number
  ): { id: string; under?: string } | undefined {
    return mapData.tileDefinitions[symbol];
  }

  private renderLowerLevelTile(
    x: number,
    y: number,
    mapData: MultiLevelMapData,
    tilesToKeep: string[]
  ): void {
    const currentLevelNum = parseInt(this.currentLevel);
    const mapLoader = (this.scene as any).mapLoader as MapLoader;
    let levelToCheck = currentLevelNum - 1;
    
    // Check floors below current (Limit to 3 levels deep for performance)
    let depthCount = 0;
    while (mapData.levels[levelToCheck.toString()] && depthCount < 3) {
      const symbol = mapLoader.getTileAt(x, y, levelToCheck.toString());

      if (!symbol || symbol === "...") {
        levelToCheck--;
        depthCount++;
        continue;
      }
      const tileDef = this.getTileDefinition(
        symbol,
        mapData,
        levelToCheck.toString(),
        x,
        y
      );
      if (!tileDef || tileDef.id === "transparent") {
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
        const reusable = this.tilePool.get() || undefined;
        const { sprite, additionalSprites } = TileRegistry.createTile(
          this.scene,
          tileDef.id,
          worldX,
          worldY,
          { levelOffset, isUnderTile: false, reusableSprite: reusable }
        );
        
        this.getLevelContainer(levelStr).add(sprite);
        additionalSprites.forEach(s => this.getLevelContainer(levelStr).add(s));

        sprite.setTint(0x666666);
        sprite.setAlpha(0.8);
        sprite.setName(tileKey);
        sprite.setVisible(!PlayerState.getInstance().getDiagnosticSettings().hideTiles);
        sprite.setActive(true);
        levelTiles.set(tileKey, [sprite, ...additionalSprites]);
      }
      tilesToKeep.push(tileKey);
      
      const isCollidableEffective = !!mapData.tileDefinitions[symbol]?.block || TileRegistry.isCollidable(tileDef.id);
      if (levelTiles.has(tileKey)) {
          levelTiles.get(tileKey)!.forEach(s => this.applyDebugTint(s, isCollidableEffective, PlayerState.getInstance().isDebugCollisionEnabled(), 0x999999));
      }
      
      if (tileDef.under && tileDef.under !== "...") {
        const underTileId = this.resolveSymbolToId(tileDef.under, mapData);
        const underTileKey = `${levelToCheck}_${x}_${y}_under`;
        
        if (!levelTiles.has(underTileKey)) {
          try {
            const reusable = this.tilePool.get() || undefined;
            const { sprite, additionalSprites } = TileRegistry.createTile(
              this.scene,
              underTileId,
              worldX,
              worldY,
              { levelOffset: levelOffset - 1, isUnderTile: true, reusableSprite: reusable }
            );
            
             this.getLevelContainer(levelStr).add(sprite);
             additionalSprites.forEach(s => this.getLevelContainer(levelStr).add(s));

             sprite.setData("worldX", worldX);
             sprite.setData("worldY", worldY);
             sprite.setTint(0x666666);
            sprite.setAlpha(0.8);
            sprite.setName(underTileKey);
            sprite.setVisible(!PlayerState.getInstance().getDiagnosticSettings().hideTiles);
            sprite.setActive(true);
            levelTiles.set(underTileKey, [sprite, ...additionalSprites]);
          } catch (error) {
                console.warn(`Failed to create under tile (lower) with ID '${underTileId}':`, error);
          }
        }
        tilesToKeep.push(underTileKey);
      }
      break;
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
    const mapLoader = (this.scene as any).mapLoader as MapLoader;
    const levelStr = level.toString();
    const levelData = mapData.levels[levelStr];
    
    if (!levelData) return;
    
    let levelTiles = this.renderedTiles.get(levelStr);
    if (!levelTiles) {
        levelTiles = new Map();
        this.renderedTiles.set(levelStr, levelTiles);
    }

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const symbol = mapLoader.getTileAt(x, y, levelStr);
        if (!symbol || symbol === "...") continue;
        const tileDef = this.getTileDefinition(symbol, mapData, levelStr, x, y);
        if (!tileDef || tileDef.id === "transparent") continue;
        
        const tileKey = `${level}_${x}_${y}_upper`;
        
        if (!levelTiles.has(tileKey)) {
          const worldX = x * this.tileSize + this.tileSize / 2;
          const worldY = y * this.tileSize + this.tileSize / 2;
          const levelOffset = this.getDepthForLevel(level, currentLevelNum);
          
          const reusable = this.tilePool.get() || undefined;
          const { sprite, additionalSprites } = TileRegistry.createTile(
            this.scene,
            tileDef.id,
            worldX,
            worldY,
            { levelOffset, isUnderTile: false, reusableSprite: reusable }
          );
          
          this.getLevelContainer(levelStr).add(sprite);
          additionalSprites.forEach(s => this.getLevelContainer(levelStr).add(s));

          sprite.setAlpha(1.0);
          sprite.setName(tileKey);
          sprite.setVisible(true);
          sprite.setActive(true);
          levelTiles.set(tileKey, [sprite, ...additionalSprites]);
        }
        tilesToKeep.push(tileKey);
        
        if (tileDef.under && tileDef.under !== "...") {
          const underTileDef = mapData.tileDefinitions[tileDef.under];
          if (underTileDef) {
            const underTileKey = `${level}_${x}_${y}_under_upper`;
            if (!levelTiles.has(underTileKey)) {
             const worldX = x * this.tileSize + this.tileSize / 2;
             const worldY = y * this.tileSize + this.tileSize / 2;
             const levelOffset = this.getDepthForLevel(level, currentLevelNum);
             const reusable = this.tilePool.get() || undefined;

              const { sprite, additionalSprites } = TileRegistry.createTile(
                this.scene,
                underTileDef.id,
                worldX,
                worldY,
                { levelOffset: levelOffset - 1, isUnderTile: true, reusableSprite: reusable }
              );
              
              this.getLevelContainer(levelStr).add(sprite);
              additionalSprites.forEach(s => this.getLevelContainer(levelStr).add(s));

              sprite.setAlpha(1.0);
              sprite.setName(underTileKey);
              sprite.setVisible(true);
              sprite.setActive(true);
              levelTiles.set(underTileKey, [sprite, ...additionalSprites]);
            }
            tilesToKeep.push(underTileKey);
          }
        }
        
        const isCollidableEffective = !!mapData.tileDefinitions[symbol]?.block || TileRegistry.isCollidable(tileDef.id);
        if (levelTiles.has(tileKey)) {
            levelTiles.get(tileKey)!.forEach(s => this.applyDebugTint(s, isCollidableEffective, PlayerState.getInstance().isDebugCollisionEnabled()));
        }
      }
    }
  }

  public syncEntityToContainer(sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.GameObject, level: string): void {
      const container = this.getLevelContainer(level);
      if (sprite.parentContainer !== container) {
          container.add(sprite as any);
      }
  }

  private getDepthForLevel(targetLevel: number, currentLevel: number): number {
    return (targetLevel - currentLevel) * 100000;
  }

  // ========================================================================
  // CARDBOARD 3D SYSTEM — Geração de faces laterais entre andares
  // ========================================================================

  /**
   * Renderiza faces laterais para criar o efeito "cubinho" em todos os andares visíveis.
   * Para cada tile com "altura" (paredes, árvores, etc.) verifica vizinhos vazios
   * e gera faces laterais nas bordas expostas.
   */
  private renderSideFaces(
    mapData: MultiLevelMapData,
    minX: number, maxX: number,
    minY: number, maxY: number,
    playerX: number, playerY: number
  ): void {
    if (!this.sideFacesEnabled) return;

    const mapLoader = (this.scene as any).mapLoader as MapLoader;
    if (!mapLoader) return;

    const currentLevelNum = parseInt(this.currentLevel);
    const sideFaceKeysToKeep = new Set<string>();
    const allLevels = Object.keys(mapData.levels).map(l => parseInt(l)).sort((a, b) => a - b);

    // Função para verificar se um vizinho NÃO tem altura (é chão/vazio)
    const checkNeighborIsFlat = (nx: number, ny: number, lvl: string): boolean => {
      const nSym = mapLoader.getTileAt(nx, ny, lvl);
      if (!nSym || nSym === "...") return true;
      const nDef = mapData.tileDefinitions[nSym];
      if (!nDef) return true;
      if (nDef.id === "transparent") return true;
      const nRegDef = TileRegistry.getTileDefinition(nDef.id);
      const nHasHeight = (nRegDef && (nRegDef.baseDepth || 0) > 0) || nDef.block;
      return !nHasHeight;
    };

    for (const level of allLevels) {
      if (level < currentLevelNum) continue;
      const levelStr = level.toString();

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const symbol = mapLoader.getTileAt(x, y, levelStr);
          if (!symbol || symbol === "...") continue;

          const tileDef = mapData.tileDefinitions[symbol];
          if (!tileDef || tileDef.id === "transparent") continue;
          if (tileDef.id.includes("roof")) continue;

          // Só gerar faces para tiles COM altura
          const regDef = TileRegistry.getTileDefinition(tileDef.id);
          const hasHeight = (regDef && (regDef.baseDepth || 0) > 0) || tileDef.block;
          if (!hasHeight) continue;

          const worldX = x * this.tileSize + this.tileSize / 2;
          const worldY = y * this.tileSize + this.tileSize / 2;
          const faceColor = SideFaceGraphic.getColorForTileId(tileDef.id);
          const halfTile = this.tileSize / 2;

          // FACE SUL
          if (checkNeighborIsFlat(x, y + 1, levelStr)) {
            const key = `sf_s_${level}_${x}_${y}`;
            sideFaceKeysToKeep.add(key);
            if (!this.renderedSideFaces.has(key)) {
              this.createSideFaceSprite(key, "south", worldX - halfTile, worldY + halfTile, faceColor, level, levelStr, worldX, worldY);
            }
          }

          // FACE NORTE
          if (checkNeighborIsFlat(x, y - 1, levelStr)) {
            const key = `sf_n_${level}_${x}_${y}`;
            sideFaceKeysToKeep.add(key);
            if (!this.renderedSideFaces.has(key)) {
              this.createSideFaceSprite(key, "north", worldX - halfTile, worldY - halfTile - this.sideFaceHeight, faceColor, level, levelStr, worldX, worldY);
            }
          }

          // FACE LESTE
          if (checkNeighborIsFlat(x + 1, y, levelStr)) {
            const key = `sf_e_${level}_${x}_${y}`;
            sideFaceKeysToKeep.add(key);
            if (!this.renderedSideFaces.has(key)) {
              this.createSideFaceSprite(key, "east", worldX + halfTile, worldY - halfTile, faceColor, level, levelStr, worldX, worldY);
            }
          }

          // FACE OESTE
          if (checkNeighborIsFlat(x - 1, y, levelStr)) {
            const key = `sf_w_${level}_${x}_${y}`;
            sideFaceKeysToKeep.add(key);
            if (!this.renderedSideFaces.has(key)) {
              this.createSideFaceSprite(key, "west", worldX - halfTile - this.sideFaceWidth, worldY - halfTile, faceColor, level, levelStr, worldX, worldY);
            }
          }
        }
      }
    }

    this.cleanupSideFaces(sideFaceKeysToKeep);
    this.updateSideFacePerspective(playerX, playerY);
  }

  /**
   * Cria um sprite de face lateral posicionado na borda do tile.
   */
  private createSideFaceSprite(
    key: string,
    direction: "south" | "north" | "east" | "west",
    faceX: number,
    faceY: number,
    color: number,
    level: number,
    levelStr: string,
    tileWorldX: number,
    tileWorldY: number
  ): void {
    const sprite = SideFaceGraphic.createFace(
      this.scene, faceX, faceY, direction, color,
      this.sideFaceHeight, this.sideFaceWidth
    );

    sprite.setOrigin(0, 0);

    const currentLevelNum = parseInt(this.currentLevel);
    const levelOffset = this.getDepthForLevel(level, currentLevelNum);
    const dirBonus = direction === "south" ? 3 : direction === "north" ? -1 : 1;
    sprite.setDepth(levelOffset + tileWorldY + dirBonus);

    this.getLevelContainer(levelStr).add(sprite);

    sprite.setData("sf_direction", direction);
    sprite.setData("sf_tileX", tileWorldX);
    sprite.setData("sf_tileY", tileWorldY);

    this.renderedSideFaces.set(key, [sprite]);
  }

  /**
   * Ajusta opacidade das faces baseado na posição do jogador.
   */
  private updateSideFacePerspective(playerX: number, playerY: number): void {
    this.renderedSideFaces.forEach((sprites) => {
      sprites.forEach(sprite => {
        if (!sprite.active) return;
        const dir = sprite.getData("sf_direction") as string;
        const tX = sprite.getData("sf_tileX") as number;
        const tY = sprite.getData("sf_tileY") as number;

        let alpha = 0;
        switch (dir) {
          case "south": alpha = playerY > tY ? 0.95 : 0.2; break;
          case "north": alpha = playerY < tY ? 0.75 : 0.1; break;
          case "east":  alpha = playerX > tX ? 0.85 : 0.15; break;
          case "west":  alpha = playerX < tX ? 0.85 : 0.15; break;
        }
        sprite.setAlpha(alpha);
      });
    });
  }

  /**
   * Remove faces laterais fora do viewport.
   */
  private cleanupSideFaces(keysToKeep: Set<string>): void {
    const keysToRemove: string[] = [];
    this.renderedSideFaces.forEach((sprites, key) => {
      if (!keysToKeep.has(key)) {
        sprites.forEach(s => { s.parentContainer?.remove(s); s.destroy(); });
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach(key => this.renderedSideFaces.delete(key));
  }

  private cleanupTiles(tilesToKeep: string[]): void {
    const keepSet = new Set(tilesToKeep);
    const mapLoader = (this.scene as any).mapLoader;

    this.renderedTiles.forEach((levelTiles, level) => {
      const keysToRemove: string[] = [];
      levelTiles.forEach((sprites, key) => {
        if (!keepSet.has(key)) {
          // IMPORTANT: Remove from physics group to prevent internal leak/accumulation
          const wallsLayer = mapLoader?.getWallsLayer?.(level);
          sprites.forEach(sprite => {
              if (wallsLayer) wallsLayer.remove(sprite);
              // CRITICAL: Remove from container before pooling to prevent zombie movements
              sprite.parentContainer?.remove(sprite); 
              this.tilePool.release(sprite);
          });
          keysToRemove.push(key);
        }
      });
      keysToRemove.forEach(key => levelTiles.delete(key));

      if (levelTiles.size === 0) {
        this.renderedTiles.delete(level);
      }
    });
  }

  private clearRenderedTiles(): void {
    this.renderedTiles.forEach((tiles) =>
      tiles.forEach((spriteList) => spriteList.forEach(sprite => {
          sprite.parentContainer?.remove(sprite);
          sprite.destroy();
      }))
    );
    this.renderedTiles.clear();

    // CARDBOARD 3D: Limpar todas as faces laterais
    this.renderedSideFaces.forEach((sprites) => {
      sprites.forEach(s => {
        s.parentContainer?.remove(s);
        s.destroy();
      });
    });
    this.renderedSideFaces.clear();
  }

  private drawDebugHitboxes(): void {
    const graphics = this.debugGraphics;
    if (!graphics) return;
    graphics.clear();
    
    this.renderedTiles.forEach((levelMap) => {
      levelMap.forEach((sprites) => {
        const mainSprite = sprites[0];
        const body = mainSprite?.body as Phaser.Physics.Arcade.Body;
        if (body) {
            graphics.lineStyle(2, 0xff0000, 1);
            graphics.fillStyle(0xff0000, 0.3);
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

      if (!this.scene.textures.exists("cloud_noise")) {
          this.generateCloudTexture();
      }

      this.cloudMaskGraphics = this.scene.make.graphics({ x: 0, y: 0 });
      const mask = this.cloudMaskGraphics.createGeometryMask();

      const width = this.scene.scale.width + 512;
      const height = this.scene.scale.height + 512;
      
      this.cloudShadowSprite = this.scene.add.tileSprite(0, 0, width, height, "cloud_noise");
      this.cloudShadowSprite.setScrollFactor(0);
      this.cloudShadowSprite.setDepth(19000);
      this.cloudShadowSprite.setAlpha(0.35);
      this.cloudShadowSprite.setTint(0x000000);
      this.cloudShadowSprite.setMask(mask);
      this.isCloudSystemReady = true;
  }

  private generateCloudTexture(): void {
      const width = 2048;
      const height = 2048;
      const key = "cloud_noise";
      const canvas = this.scene.textures.createCanvas(key, width, height);
      if (!canvas) return;
      const ctx = canvas.getContext();
      ctx.clearRect(0, 0, width, height); 
      ctx.filter = 'blur(15px)'; 
      ctx.fillStyle = "white"; 
      const cloudCount = 2;
      
      const drawWrappedCircle = (cx: number, cy: number, r: number) => {
          const draw = (dx: number, dy: number) => {
              ctx.beginPath();
              ctx.arc(dx, dy, r, 0, Math.PI * 2);
              ctx.fill();
          };
          draw(cx, cy);
          if (cx - r < 0) draw(cx + width, cy);
          if (cx + r > width) draw(cx - width, cy);
          if (cy - r < 0) draw(cx, cy + height);
          if (cy + r > height) draw(cx, cy - height);
      };

      for (let i = 0; i < cloudCount; i++) {
          const cx = Math.random() * width;
          const cy = Math.random() * height;
          const baseRadius = 150 + Math.random() * 100;
          drawWrappedCircle(cx, cy, baseRadius);
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
        const enabled = PlayerState.getInstance().getDiagnosticSettings().enableClouds;
        this.cloudShadowSprite.setVisible(enabled);
        if (this.cloudMaskGraphics) this.cloudMaskGraphics.setVisible(enabled);
        if (!enabled) return;
        const cam = this.scene.cameras.main;
        this.cloudShadowSprite.setPosition(cam.width/2, cam.height/2);
        this.cloudShadowSprite.setSize(cam.width + 256, cam.height + 256);
        this.cloudShadowSprite.tilePositionX = cam.scrollX * 0.5 + (time * 0.02);
        this.cloudShadowSprite.tilePositionY = cam.scrollY * 0.5 + (time * 0.01);
  }

  private isExposedToSky(x: number, y: number, mapData: MultiLevelMapData): boolean {
      const currentLevelNum = parseInt(this.currentLevel);
      const mapLoader = (this.scene as any).mapLoader as MapLoader;
      
      for (const levelKey in mapData.levels) {
          const lvl = parseInt(levelKey);
          if (lvl <= currentLevelNum) continue;
          
          const symbol = mapLoader.getTileAt(x, y, levelKey);
          if (symbol && symbol !== "...") {
               const tileDef = mapData.tileDefinitions[symbol] || mapData.entityTemplates[symbol];
               if (tileDef && tileDef.id === "transparent") continue;
               return false;
          }
      }
      return true;
  }

  public updateCloudMask(gridX: number, gridY: number, minX: number, maxX: number, minY: number, maxY: number, mapData: MultiLevelMapData): void {
      if (!this.cloudMaskGraphics) this.initClouds();
      if (!this.cloudMaskGraphics) return;
      this.cloudMaskGraphics.clear();
      this.cloudMaskGraphics.fillStyle(0xffffff, 1);
      for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
               if (this.isExposedToSky(x, y, mapData)) {
                   this.cloudMaskGraphics.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
               }
          }
      }
  }

  public getRenderedTilesCount(): number {
    let count = 0;
    this.renderedTiles.forEach((levelTiles) => {
      count += levelTiles.size;
    });
    return count;
  }

  private clearLazyObjects(): void {
      this.renderedDecorations.forEach((sprites) => {
          sprites.forEach(s => this.tilePool.release(s));
      });
      this.renderedDecorations.clear();
  }

  private updateDecorations(gridX: number, gridY: number): void {
      const scene = this.scene as any;
      const decorationsMeta = scene.decorationsByLevel?.get(this.currentLevel);
      if (!decorationsMeta) return;

      const keysToKeep = new Set<string>();
      const radius = this.renderRadius;
      const tileSize = this.tileSize;
      
      decorationsMeta.forEach((meta: any) => {
          const dx = Math.floor(meta.worldX / tileSize);
          const dy = Math.floor(meta.worldY / tileSize);
          
          if (Math.abs(dx - gridX) <= radius && Math.abs(dy - gridY) <= radius) {
              const key = `dec_${dx}_${dy}_${meta.tileId}`;
              keysToKeep.add(key);
              
              if (!this.renderedDecorations.has(key)) {
                  const reusable = this.tilePool.get() || undefined;
                  const { sprite, additionalSprites } = TileRegistry.createTile(
                      this.scene,
                      meta.tileId,
                      meta.worldX,
                      meta.worldY,
                      { levelOffset: parseInt(this.currentLevel) * 10000, isUnderTile: false, reusableSprite: reusable }
                  );
                  
                  if (meta.scale) sprite.setScale(meta.scale);
                  if (meta.rotation) sprite.setRotation(meta.rotation);
                  sprite.setDepth(meta.worldY + (parseInt(this.currentLevel) * 10000) + 10);
                  
                  if (meta.isCollidable) {
                      this.scene.physics.add.existing(sprite, true);
                      const mapLoader = (this.scene as any).mapLoader;
                      mapLoader?.getWallsLayer?.(this.currentLevel)?.add(sprite);
                  }
                  
                  this.renderedDecorations.set(key, [sprite, ...additionalSprites]);
              }
          }
      });

      this.renderedDecorations.forEach((sprites, key) => {
          if (!keysToKeep.has(key)) {
              const mapLoader = (this.scene as any).mapLoader;
              const wallsLayer = mapLoader?.getWallsLayer?.(this.currentLevel);
              sprites.forEach(s => {
                  if (wallsLayer) wallsLayer.remove(s);
                  this.tilePool.release(s);
              });
              this.renderedDecorations.delete(key);
          }
      });
  }

  public updateEnemies(gridX: number, gridY: number): void {
      const scene = this.scene as any;
      const enemiesMeta = scene.enemiesByLevel?.get(this.currentLevel);
      if (!enemiesMeta) return;

      const keysToKeep = new Set<string>();
      const radius = this.renderRadius;
      const tileSize = this.tileSize;

      enemiesMeta.forEach((meta: any) => {
          const ex = Math.floor(meta.x / tileSize);
          const ey = Math.floor(meta.y / tileSize);

          if (Math.abs(ex - gridX) <= radius && Math.abs(ey - gridY) <= radius) {
              const key = meta.id;
              keysToKeep.add(key);

              if (!this.activeEnemies.has(key)) {
                  const deadEnemies = scene.deadEnemies || [];
                  const isDead = deadEnemies.some((d: any) => d.id === key);
                  if (!isDead) {
                      const EnemyClass = require('../entities/Enemy').default;
                      const enemy = new EnemyClass(this.scene, meta.x, meta.y, meta.type, meta.overrides);
                      enemy.id = key;
                      enemy.level = this.currentLevel;
                      enemy.respawnTime = meta.respawnTime;
                      this.activeEnemies.set(key, enemy);
                  }
              }
          }
      });

      this.activeEnemies.forEach((enemy, key) => {
          if (!keysToKeep.has(key)) {
              enemy.destroy();
              this.activeEnemies.delete(key);
          }
      });
  }

  public getDNAAnalysis(): { culprits: [string, number][], poolSize: number, types: Record<string, number> } {
      const textureBreakdown: Record<string, number> = {};
      const typeBreakdown: Record<string, number> = {};
      
      this.scene.children.each((child: any) => {
          // Object Type Breakdown
          const type = child.constructor.name || child.type || "Unknown";
          typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;

          // Texture Breakdown (Original Cullprits)
          const key = child.texture?.key || "no-texture";
          const label = `${type} (${key})`;
          textureBreakdown[label] = (textureBreakdown[label] || 0) + 1;
      });

      const culprits = Object.entries(textureBreakdown)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

      return {
          culprits,
          poolSize: this.tilePool.getRawPool().length,
          types: typeBreakdown
      };
  }

  public purgeOrphans(): void {
      console.log("☢️ NUCLEAR PURGE INITIATED");
      const trackedSprites = new Set<Phaser.GameObjects.GameObject>();
      
      this.renderedTiles.forEach(lv => lv.forEach(sprites => sprites.forEach(s => trackedSprites.add(s))));
      this.renderedDecorations.forEach(sprites => sprites.forEach(s => trackedSprites.add(s)));
      this.activeEnemies.forEach(e => {
          if (e.sprite) trackedSprites.add(e.sprite);
          if (e.healthBar?.bar) trackedSprites.add(e.healthBar.bar);
      });
      
      const scene = this.scene as any;
      if (scene.player?.sprite) trackedSprites.add(scene.player.sprite);
      
      let destroyedCount = 0;
      this.scene.children.each((child: any) => {
          if (child.ignorePurge) return;
          if (child.type === 'Graphics' && (child === this.debugGraphics || child === this.cloudMaskGraphics)) return;

          if (!trackedSprites.has(child)) {
              child.destroy();
              destroyedCount++;
          }
      });
      console.log(`☢️ Purge complete. Destroyed ${destroyedCount} orphaned objects.`);
  }

  public destroy(): void {
      this.clearLazyObjects();
      this.renderedTiles.forEach((tiles) => {
          tiles.forEach((sprites) => sprites.forEach(s => s.destroy()));
      });
      this.renderedTiles.clear();

      // CARDBOARD 3D: Limpar faces laterais
      this.renderedSideFaces.forEach((sprites) => {
          sprites.forEach(s => s.destroy());
      });
      this.renderedSideFaces.clear();
      
      this.levelContainers.forEach(c => c.destroy());
      this.levelContainers.clear();

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
