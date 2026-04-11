import Phaser from "phaser";
import { DynamicLevelRenderer } from "../maps/DynamicLevelRenderer";
import { TileRegistry } from "../graphics/tiles/TileRegistry";
import { EnemyRegistry } from "../entities/EnemyRegistry";
import { MultiLevelMapData } from "../maps/MapTypes";
// import { UIContext } from "../../context/UIContext"; // Not used in scene logic directly yet

export class MapEditorScene extends Phaser.Scene {
  private levelRenderer!: DynamicLevelRenderer; // Renamed from renderer
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private controls!: Phaser.Cameras.Controls.FixedKeyControl;
  private currentLevel: string = "0";
  private mapData!: MultiLevelMapData;
  private isDrawing: boolean = false;
  private currentTool: "brush" | "eraser" = "brush";
  private selectedTileId: string | null = "grs"; // Default grass
  private entitiesGroup!: Phaser.GameObjects.Group;
  
  // Grid Marker
  private marker!: Phaser.GameObjects.Graphics;

  constructor() {
    super("MapEditorScene");
  }

  preload() {
    TileRegistry.preloadAll(this);
    EnemyRegistry.preloadAll(this);
    this.load.json("newmap_data", "newmap.json");
  }

  create() {
    // Setup Registry for DynamicLevelRenderer
    this.registry.set("currentMap", "newmap");
    this.registry.set("currentLevel", this.currentLevel);

    this.mapData = this.cache.json.get("newmap_data");
    if (!this.mapData) {
        console.error("Failed to load map data");
        return;
    }

    // Initialize Renderer
    this.entitiesGroup = this.add.group();
    this.levelRenderer = new DynamicLevelRenderer(this, 32, this.currentLevel); // Updated
    
    // Camera Controls - Start at Player Start or Center
    let startX = 0;
    let startY = 0;
    
    // Try to find player start in current level (0)
    const level0 = this.mapData.levels["0"];
    if (level0 && level0.playerPos) {
        startX = level0.playerPos.x;
        startY = level0.playerPos.y;
    } else {
        // Fallback: Try to find center of map content
        // Or just default to safe 50,50 * tileSize
        startX = 50 * 32;
        startY = 50 * 32;
    }

    this.cameras.main.centerOn(startX, startY);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.controls = new Phaser.Cameras.Controls.FixedKeyControl({
      camera: this.cameras.main,
      left: this.cursors.left,
      right: this.cursors.right,
      up: this.cursors.up,
      down: this.cursors.down,
      speed: 2.0, // Increased speed for easier navigation
      zoomIn: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      zoomOut: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E),
    });

    // Grid Marker
    this.marker = this.add.graphics();
    this.marker.lineStyle(2, 0xffffff, 1);
    this.marker.strokeRect(0, 0, 32, 32);
    this.marker.setDepth(100000);

    // Input Events
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) {
            // Right click pan? Or maybe dropper?
            return;
        }
        this.isDrawing = true;
        this.paintTile(pointer);
    });

    this.input.on("pointerup", () => {
        this.isDrawing = false;
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        this.updateMarker(pointer);
        if (this.isDrawing) {
            this.paintTile(pointer);
        }
    });
    
    // Initial Render
    this.levelRenderer.update(startX, startY);
  }

  update(time: number, delta: number) {
    this.controls.update(delta);
    
    // Keep renderer updated around camera center
    const cam = this.cameras.main;
    // We update renderer based on camera center to keep tiles visible
    this.levelRenderer.update(cam.worldView.centerX, cam.worldView.centerY);
  }

  private updateMarker(pointer: Phaser.Input.Pointer) {
      const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      const gridX = Math.floor(worldPoint.x / 32);
      const gridY = Math.floor(worldPoint.y / 32);
      
      this.marker.x = gridX * 32;
      this.marker.y = gridY * 32;
  }

  private paintTile(pointer: Phaser.Input.Pointer) {
      // Check if clicking on UI (simplified check, ideally use DOM event bubbling blocks)
      // Actually Phaser input is separate. We assume UI is overlay.
      
      const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      const gridX = Math.floor(worldPoint.x / 128);
      const gridY = Math.floor(worldPoint.y / 128);

      if (!this.mapData.levels[this.currentLevel]) {
          // Initialize level if missing 
          // For now return
          return; 
      }

      const map = this.mapData.levels[this.currentLevel].map;
      
      // Ensure bounds
      if (gridY < 0 || gridY >= map.length || gridX < 0 || gridX >= map[0].length) {
          return;
      }

      if (this.currentTool === "eraser") {
          map[gridY][gridX] = "..."; // Empty tile
      } else {
          if (this.selectedTileId) {
             const oldSymbol = map[gridY][gridX];
             const enemyDef = EnemyRegistry.getEnemyDefinition(this.selectedTileId);
             const tileDef = TileRegistry.getTileDefinition(this.selectedTileId);
             
             // Decisions:
             // 1. Is it an Enemy? Always Layer.
             // 2. Is it a High Tile (Depth > 0)? Layer if placing on something.
             // 3. Otherwise (Floor), Replace.
             
             const isHighTile = tileDef && (tileDef.baseDepth || 0) > 0;
             const shouldLayer = enemyDef || isHighTile;

             if (shouldLayer && oldSymbol && oldSymbol !== "...") {
                 // --- Layering Logic ---
                 
                 // Resolve the requested "under" tile (the ground)
                 let groundTile = oldSymbol;
                 
                  // Resolve Map Symbol to Tile ID 
                 if (this.mapData.tiles && this.mapData.tiles[oldSymbol]) {
                    groundTile = this.mapData.tiles[oldSymbol].id; // e.g. "hwb" -> "house-wall" (Wait. No. If placing wall on wall, this gets the WALL id.)
                    // If placing Wall on Wall, we probably want the UNDER of the old wall.
                    if (this.mapData.tiles[oldSymbol].under) {
                        groundTile = this.mapData.tiles[oldSymbol].under!;
                    }
                 } else if (this.mapData.entities && this.mapData.entities[oldSymbol]) {
                      // If placing on an entity, get its under.
                     groundTile = this.mapData.entities[oldSymbol].under || groundTile;
                 }
                 
                 // If groundTile ends up being a high tile itself (e.g. replacing a wall that had no under?), 
                 // we might be in trouble. But usually 'under' should be a floor.
                 // Let's assume groundTile is safe to use as 'under'.
                 
                 // Generate Composite Key
                 // Format: "id_on_under" (e.g. "goblin_on_grass" or "house-wall_on_grass")
                 // Shorten if possible? No, uniqueness is key.
                 // We must sanitize IDs to avoid huge keys?
                 const newKey = `${this.selectedTileId}_on_${groundTile}`;
                 
                 // Store Definition
                 if (enemyDef) {
                     // It is an ENTITY
                     if (!this.mapData.entities) this.mapData.entities = {};
                     if (!this.mapData.entities[newKey]) {
                         this.mapData.entities[newKey] = {
                             type: "enemy",
                             id: this.selectedTileId,
                             under: groundTile
                         };
                     }
                 } else {
                     // It is a TILE
                     if (!this.mapData.tiles) this.mapData.tiles = {};
                     if (!this.mapData.tiles[newKey]) {
                         this.mapData.tiles[newKey] = {
                             id: this.selectedTileId,
                             // Copy properties from registry or default?
                             // DynamicLevelRenderer uses TileRegistry for props, so we just need ID.
                             block: tileDef?.isCollidable,
                             under: groundTile
                         };
                     }
                 }
                 
                 map[gridY][gridX] = newKey;
                 
             } else {
                 // --- Replacement Logic (Floors or Empty) ---
                 map[gridY][gridX] = this.selectedTileId;
             }
          }
      }

      // Invalidate Renderer
      this.levelRenderer.invalidateTile(this.currentLevel, gridX, gridY);
      this.renderEntities(); // Refresh entities
  }
  
  // API for UI
  public setTool(tool: "brush" | "eraser") {
      this.currentTool = tool;
  }
  
  public setSelectedTile(tileId: string) {
      this.selectedTileId = tileId;
      this.currentTool = "brush";
  }
  
  public setLevel(level: string) {
      this.currentLevel = level;
      this.registry.set("currentLevel", level); // Sync registry
      this.levelRenderer.setCurrentLevel(level);
      this.levelRenderer.reloadMap(); // Full reload to clear old level visuals
      this.renderEntities();
  }
  
  public getMapData() {
      return this.mapData;
  }
  
  public saveMap() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.mapData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "newmap.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  private renderEntities() {
      if (!this.entitiesGroup) return;
      this.entitiesGroup.clear(true, true);
      
      const levelData = this.mapData.levels[this.currentLevel];
      if (!levelData) return;
      
      const map = levelData.map;
      
      for (let y = 0; y < map.length; y++) {
          for (let x = 0; x < map[y].length; x++) {
              const symbol = map[y][x];
              if (!symbol || symbol === "...") continue;
              
              let entityId = symbol;
              if (this.mapData.entities && this.mapData.entities[symbol]) {
                  entityId = this.mapData.entities[symbol].id;
              }
              
              const enemyDef = EnemyRegistry.getEnemyDefinition(entityId);
              if (enemyDef) {
                  try {
                       const { sprite } = EnemyRegistry.createEnemy(this, entityId, x * 32 + 16, y * 32 + 16);
                       sprite.setAlpha(0.8);
                       if (sprite.body) sprite.body.enable = false;
                       this.entitiesGroup.add(sprite);
                  } catch (e) {
                      // Ignore
                  }
              }
          }
      }
  }
}
