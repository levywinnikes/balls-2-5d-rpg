import Phaser from "phaser";
import LevelRenderer from "../../game/maps/LevelRenderer";
import { MapLoader } from "../../game/maps/MapLoader";
import { TileRegistry } from "../../game/graphics/tiles/TileRegistry";

export class EditorScene extends Phaser.Scene {
    private levelRenderer!: LevelRenderer;
    public mapLoader!: MapLoader; // Public so Renderer can access
    private controls: any; // Camera controls
    private spaceKey!: Phaser.Input.Keyboard.Key;
    private gridGraphics!: Phaser.GameObjects.Graphics;
    
    // Editor State
    private currentLayer: number = 0;
    private selectedTool: "brush" | "eraser" = "brush";
    private selectedTile: string = "grass";
    private isDragging: boolean = false;
    private lastPointer: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private ghostSprite: Phaser.GameObjects.Sprite | null = null;

    constructor() {
        super("EditorScene");
    }

    preload() {
        // Load Map
        this.load.json("newmap_data", "newmap.json");
        
        // Load standard assets (subset for editor?)
        // Ideally we load same as BootScene
        this.load.spritesheet("tiles", "assets/tiles/tileset.png", { 
            frameWidth: 32, frameHeight: 32 
        });
        
        // Load individual tiles if TileRegistry uses them? 
        // BootScene loads many.
        // For MVP Editor, let's assume we need to load at least ground/walls.
        // We can copy-paste asset loading or import a loader helper.
        // For now, let's load a few critical ones or use the atlas strategy if applied.
        // Assuming TileRegistry.preload() exists? static? 
        TileRegistry.preloadAll(this);
    }

    create() {
        // Mock Registry
        this.registry.set("currentMap", "newmap");
        this.registry.set("currentLevel", "0");

        // Initialize MapLoader (needed for Renderer)
        this.mapLoader = new MapLoader(this);
        // We need to manually inject the loaded JSON into MapLoader logic or simpler:
        // MapLoader usually loads via 'loadMap' which expects 'map_data' in cache.
        // We loaded 'newmap_data'.
        
        // Create Renderer
        this.levelRenderer = new LevelRenderer(this, 32, "0");
        this.levelRenderer.renderRadius = 40; // Larger view for editor

        // Camera
        this.cameras.main.setBackgroundColor("#111");
        this.cameras.main.setZoom(0.5);

        // Input Setup
        this.input.on('pointerdown', this.handlePointerDown, this);
        this.input.on('pointermove', this.handlePointerMove, this);
        this.input.on('pointerup', () => { this.isDragging = false; });
        
        // Grid
        this.gridGraphics = this.add.graphics();
        this.drawGrid();

        // Mock Player for Renderer (it expects player position)
        (this as any).player = {
            sprite: {
                 body: true, // Fake body existence
                 getBounds: () => new Phaser.Geom.Rectangle(0,0,0,0)
            }
        };
        (this as any).droppedItemsGroup = { getChildren: () => [] }; // Mock
        
        // Keyboard (WASD Pan)
        // Keyboard (WASD Pan)
        if(this.input.keyboard) {
            this.controls = this.input.keyboard.addKeys({
                W: Phaser.Input.Keyboard.KeyCodes.W,
                A: Phaser.Input.Keyboard.KeyCodes.A,
                S: Phaser.Input.Keyboard.KeyCodes.S,
                D: Phaser.Input.Keyboard.KeyCodes.D
            });
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        }
    }

    update(time: number, delta: number) {
        // Camera Movement
        const speed = 10;
        if (this.controls?.W?.isDown) this.cameras.main.scrollY -= speed;
        if (this.controls?.S?.isDown) this.cameras.main.scrollY += speed;
        if (this.controls?.A?.isDown) this.cameras.main.scrollX -= speed;
        if (this.controls?.D?.isDown) this.cameras.main.scrollX += speed;

        // Render Map (Centered on Camera)
        const cam = this.cameras.main;
        const centerX = cam.scrollX + cam.width / 2;
        const centerY = cam.scrollY + cam.height / 2;
        
        this.levelRenderer.update(centerX, centerY);
        
        // Sync Grid
        this.gridGraphics.x = 0; // cam.scrollX ... actually Graphics in ScrollFactor 1 moves with world.
        // Re-draw grid to match camera view if optimizing? 
        // Or just huge grid?
    }
    
    // --- EDITOR INTERFACE ---
    public setEditorState(state: { layer: number, tool: "brush"|"eraser", tile: string }) {
        this.currentLayer = state.layer;
        this.selectedTool = state.tool;
        this.selectedTile = state.tile;
        
        this.registry.set("currentLevel", this.currentLayer.toString());
        // Force renderer refresh
        this.levelRenderer.setCurrentLevel(this.currentLayer.toString());
    }

    public getMapData(): any {
        return this.cache.json.get("newmap_data");
    }

    // --- INTERACTION ---
    private handlePointerDown(pointer: Phaser.Input.Pointer) {
        if (pointer.button === 2) {
             // Right Click Pan? or Eraser?
             // Let's use Middle for Pan or Space.
             // For now assume Left Click = Paint
        }
        this.isDragging = true;
        this.lastPointer.set(pointer.x, pointer.y);
        
        if (pointer.primaryDown) {
             this.paintTile(pointer.worldX, pointer.worldY);
        }
    }

    // ... (input handling)

    private handlePointerMove(pointer: Phaser.Input.Pointer) {
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        const gridX = Math.floor(worldX / 32) * 32 + 16; // Center of tile
        const gridY = Math.floor(worldY / 32) * 32 + 16; 

        // Update Ghost
        if (this.ghostSprite) {
            this.ghostSprite.destroy();
        }
        
        if (this.selectedTool === "brush" && this.selectedTile) {
             try {
                 // Create visual preview
                 const { sprite } = TileRegistry.createTile(
                     this, 
                     this.selectedTile, 
                     gridX, 
                     gridY, 
                     { levelOffset: 999999 } // High depth for preview
                 );
                 sprite.setAlpha(0.6);
                 sprite.setDepth(999999);
                 this.ghostSprite = sprite;
             } catch(e) {
                 // Ignore if registry miss
             }
        }

        if (this.isDragging) {
             if (pointer.primaryDown) { // Painting
                 this.paintTile(pointer.worldX, pointer.worldY);
             } else if (pointer.middleButtonDown() || (pointer.isDown && this.spaceKey && this.spaceKey.isDown)) {
                 // Pan
                 const dx = pointer.x - this.lastPointer.x;
                 const dy = pointer.y - this.lastPointer.y;
                 this.cameras.main.scrollX -= dx;
                 this.cameras.main.scrollY -= dy;
             }
        }
        this.lastPointer.set(pointer.x, pointer.y);
    }

    private paintTile(worldX: number, worldY: number) {
        const x = Math.floor(worldX / 32);
        const y = Math.floor(worldY / 32);
        
        const mapData = this.cache.json.get("newmap_data");
        const levelStr = this.currentLayer.toString();
        
        if (!mapData.levels[levelStr]) {
            mapData.levels[levelStr] = { map: [] };
        }
        
        const map = mapData.levels[levelStr].map;
        
        // Ensure rows exist
        if (!map[y]) {
             for(let i=0; i<=y; i++) {
                 if(!map[i]) map[i] = [];
             }
        }
        
        if (!mapData.tiles) {
             mapData.tiles = {};
        }
        
        let symbolToPlace = "";
        
        if (this.selectedTool === "eraser") {
            symbolToPlace = ""; 
        } else {
            // Find existing symbol
            const entry = Object.entries(mapData.tiles).find(([sym, def]: any) => def.id === this.selectedTile);
            if(entry) {
                symbolToPlace = entry[0];
            } else {
                // AUTO-CREATE SYMBOL
                // Generate a unique symbol (e.g. from ID first chars or random)
                // Simple strategy: use ID if short, or generate "t1", "t2"...
                let attempt = this.selectedTile.substring(0, 2);
                let counter = 1;
                while (mapData.tiles[attempt] || mapData.entities[attempt]) {
                    attempt = this.selectedTile.substring(0, 2) + counter++;
                }
                
                // Add definition
                console.log(`[Editor] Creating new symbol '${attempt}' for tile '${this.selectedTile}'`);
                mapData.tiles[attempt] = { id: this.selectedTile };
                symbolToPlace = attempt;
            }
        }

        if (map[y][x] !== symbolToPlace) {
            map[y][x] = symbolToPlace;
            this.invalidateTile(x, y, levelStr);
        }
    }
    
    private invalidateTile(x: number, y: number, level: string) {
        // Access private renderedTiles via cast
        const levelTiles = (this.levelRenderer as any).renderedTiles.get(level);
        if (levelTiles && levelTiles instanceof Map) {
             const prefix = `${level}_${x}_${y}`;
             const keysToRemove: string[] = [];
             
             levelTiles.forEach((_, key: string) => {
                 if (key.startsWith(prefix)) {
                     keysToRemove.push(key);
                 }
             });
             
             keysToRemove.forEach(key => {
                 const sprite = levelTiles.get(key);
                 if(sprite) {
                     sprite.destroy();
                     levelTiles.delete(key);
                 }
             });
        }
    }

    private drawGrid() {
        this.gridGraphics.clear();
        this.gridGraphics.lineStyle(1, 0x333333, 0.5);
        this.gridGraphics.beginPath();
        // Infinite grid effect... just draw around camera?
        // For static map, draw huge grid? 100x100
        for(let x=0; x<3200; x+=32) {
            this.gridGraphics.moveTo(x, 0);
            this.gridGraphics.lineTo(x, 3200);
        }
        for(let y=0; y<3200; y+=32) {
            this.gridGraphics.moveTo(0, y);
            this.gridGraphics.lineTo(3200, y);
        }
        this.gridGraphics.strokePath();
    }
}
