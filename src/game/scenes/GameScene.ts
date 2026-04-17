/**
 * MAIN GAME SCENE
 * Controls the primary game loop, physics, and world interaction.
 * DOCUMENTATION:
 * - High-level Architecture: /docs/ARCHITECTURE_OVERVIEW.md
 * - Map System (BMS): /docs/SYSTEM_BMS.md
 */
import { TileRegistry } from "../graphics/tiles/TileRegistry";
import { ContainerRegistry } from "../entities/containers/ContainerRegistry";
import { AudioManager } from "../systems/AudioManager";
import { RuneRegistry } from "../magic/RuneRegistry";

import { EnemyRegistry } from "../entities/EnemyRegistry";
import { registerDefaultMagics } from "../entities/EnemyMagicRegistry";
import { PathfindingManager } from "../systems/PathfindingManager";
import { PlayerGraphic } from "../graphics/PlayerGraphic";
import Player from "../entities/Player";
import { NPC, NPCData } from "../entities/NPC";
import { PlayerState } from "../entities/Player/PlayerState";
import { t_game } from "../i18n/translations";
import Enemy from "../entities/Enemy";
import { EnemySelectionIndicator } from "../hud/EnemySelectionIndicator";
import { MapLoader } from "../maps/MapLoader";
import LevelRenderer from "../maps/LevelRenderer";
import BattleSystem from "../systems/BattleSystem";
import { InventorySystem } from "../systems/InventorySystem";
import { TransitionSystem } from "../systems/TransitionSystem";
import { WeaponRegistry } from "../entities/weapons/WeaponRegistry";
import { DroppedItem } from "../entities/DroppedItem";
import { AutoSaveSystem } from "../systems/AutoSaveSystem";
import { SaveSystem } from "../systems/SaveSystem";
import { DialogueManager } from "../systems/DialogueManager";
import { QuestManager } from "../systems/QuestManager";
import { RuntimeErrorMonitor } from "../services/RuntimeErrorMonitor";
// // import { MultiLevelMapData } from "../maps/MapTypes"; // Removed unused // Removed unused

export interface DeadEnemy {
  id: string;
  type: string;
  x: number;
  y: number;
  level: string;
  respawnTime: number;
  elapsed: number;
}

export interface ActiveEnemyState {
  id: string;
  x: number;
  y: number;
  health: number;
  level: string;
}

export default class GameScene extends Phaser.Scene {
  // easystar removed
  private pathfindingGrid: number[][] = [];
  private pathfindingManager!: PathfindingManager;

  public player: Player | null = null;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  public ctrlKey!: Phaser.Input.Keyboard.Key; // Public for Entities to check
  public mapLoader!: MapLoader;
  public levelRenderer!: LevelRenderer;
  battleSystem!: BattleSystem;
  public enemiesByLevel: Map<string, any[]> = new Map();
  private decorationsByLevel: Map<string, any[]> = new Map();
  // Getter for safe access or just make public.
  // Since we already made it public above (renamed private to public in replacement),
  // or we can just add a getter if we want to keep it private.
  // Actually, for simplicity and performance in game loop, public property is fine.

  public getLevelEnemiesMetadata(level: string): any[] {
    return this.enemiesByLevel.get(level) || [];
  }

  public getActiveEnemies(): Enemy[] {
    if (!this.levelRenderer) return [];
    return Array.from(this.levelRenderer.activeEnemies.values());
  }
  private deadEnemies: DeadEnemy[] = [];
  private isInitialized: boolean = false;
  private selectedEnemy: Enemy | null = null;
  private selectionGraphics: Phaser.GameObjects.Graphics | null = null;
  private transitionSystem!: TransitionSystem;
  private enemySelectionIndicator!: EnemySelectionIndicator;
  private inventorySystem!: InventorySystem;
  private currentLevel: string = "0";
  private droppedItemsGroup!: Phaser.Physics.Arcade.Group;
  private pickupZone!: Phaser.Physics.Arcade.Sprite;
  private readonly PICKUP_RADIUS: number = 48;
  private isPathfindingReady: boolean = false;
  private autoSaveSystem!: AutoSaveSystem;
  public saveSystem!: SaveSystem;
  private isRespawning: boolean = false;
  private isTransitioning: boolean = false;
  private activeEnemiesToLoad: ActiveEnemyState[] = [];
  private npcs!: Phaser.Physics.Arcade.Group;

  // Variáveis para controle de duplo clique (Adicionadas para evitar erro TS2339)
  private lastItemClickTime: number = 0;
  private lastClickedItem: DroppedItem | null = null;
  private isUiDragging: boolean = false;
  private benchmarkMode: boolean = false;
  private benchmarkStarted: boolean = false;
  private benchmarkName: string = "Benchmark";
  private benchmarkAutoClose: boolean = false;
  private benchmarkReportPath: string | null = null;

  private darkOverlay!: Phaser.GameObjects.RenderTexture;
  private darknessLayer!: Phaser.GameObjects.Graphics;
  private lightGlowSprite!: Phaser.GameObjects.Image;
  private hasLitTorch: boolean = false;
  private torchLightRadius: number = 0;
  private fireParticles!: Phaser.GameObjects.Particles.ParticleEmitter;

  // MAGIC SYSTEM
  private cursorMode: "default" | "target" = "default";
  private targetRuneId: string | null = null;
  private targetingGraphics!: Phaser.GameObjects.Graphics;

  // PROJECTILES
  public projectiles!: Phaser.Physics.Arcade.Group; // Made public for BattleSystem access

  // PERFORMANCE METRICS
  public perf = {
    startTime: 0,
    enemyTime: 0,
    mapTime: 0,
    physicsTime: 0,
    totalUpdateTime: 0,
    activeEnemies: 0,
    renderedTiles: 0,
    totalObjects: 0,
    poolSize: 0,
    types: {} as Record<string, number>,
    culprits: [] as [string, number][],
  };

  private processedData: any = null;

  constructor() {
    super({ key: "GameScene" });
  }

  preload(): void {
    TileRegistry.preloadAll(this);
    PlayerGraphic.preload(this);
    EnemyRegistry.preloadAll(this);
    registerDefaultMagics();
    WeaponRegistry.preloadAll(this);
    this.load.json("npcs_data", "data/npcs.json");
    this.load.json("enemies_data", "data/enemies.json");
    this.load.json("dialogues_data", "data/dialogues.json");
    this.load.json("quest_rats", "data/quests/rats.json");
  }

  init(data: any) {
    this.processedData = data.processedData || null;
    this.isTransitioning = false;
    this.enemiesByLevel.clear(); // FIX: Clear stale enemies from previous run
    this.benchmarkMode = !!data.benchmarkMode;
    this.benchmarkName = data.benchmarkName || this.benchmarkName;
    this.benchmarkAutoClose = !!data.benchmarkAutoClose;
    this.benchmarkReportPath =
      typeof data.benchmarkReportPath === "string"
        ? data.benchmarkReportPath
        : null;

    // START: Handle New Game - Clear Stale Registry Data
    if (data.isNewGame) {
      console.log("🆕 Starting New Game - Clearing Registry and State");
      this.registry.remove("playerPos");
      this.registry.remove("currentLevel");
      this.registry.remove("deadEnemies");
      this.registry.remove("activeEnemies");

      // Ensure strictly clean state
      this.deadEnemies = [];
      this.activeEnemiesToLoad = [];
      this.currentLevel = "0"; // Default start level

      PlayerState.getInstance().reset();
      if (data.charName) PlayerState.getInstance().setName(data.charName);
    }
    // END: New Game Handling

    this.registry.set("currentMap", data.map || "newmap");
    this.isRespawning = !!data.isRespawn;

    // If NOT new game (and not respawning with specific level), try to load level from data or keep default "0"
    if (!data.isNewGame) {
      this.currentLevel =
        data.isRespawn && data.currentLevel
          ? data.currentLevel
          : data.currentLevel || "0";

      // RESTORE PLAYER STATE FROM SAVE DATA
      if (data.playerState) {
        console.log("💾 Restoring Player State from Save Data...");
        PlayerState.getInstance().loadFromData(data.playerState);
      }
    }

    this.registry.set("currentLevel", this.currentLevel);
    PlayerState.getInstance().setCurrentLevel(this.currentLevel);

    if (data.playerPos) this.registry.set("playerPos", data.playerPos);

    // Handle enemies loading (Persist on Save Load AND Respawn)
    if (data.deadEnemies && !data.isNewGame)
      this.deadEnemies = data.deadEnemies;
    else if (!this.deadEnemies) this.deadEnemies = []; // Safety init

    if (data.activeEnemies && !data.isNewGame) {
      this.activeEnemiesToLoad = data.activeEnemies;
    } else {
      this.activeEnemiesToLoad = [];
    }

    // Load Player State if a save file is provided
    if (data.playerState && !data.isNewGame && !this.isRespawning) {
      console.log("📂 Loading Player State from Save Data");
      // Pass timestamp to adjust decay timers
      PlayerState.getInstance().loadState(data.playerState, data.timestamp);
    }
    // Note: persistentItems are handled within loadState if present in data
  }

  // --- BUSCA GLOBAL DE SPAWN ---
  public getSpawnCoordinate(): { x: number; y: number; level: string } {
    if (this.processedData?.spawnInfo) {
      return this.processedData.spawnInfo;
    }

    const mapName = this.registry.get("currentMap") || "newmap";
    const mapData =
      this.cache.json.get(`${mapName}_data`) || this.cache.json.get(mapName);
    const fallback = { x: 4096, y: 4096, level: "0" }; // Center of 256x256 map

    if (!mapData) {
      return fallback;
    }

    // [OPTIMIZATION] Check for global config first (v5.5)
    if (mapData.config && mapData.config.startLevel) {
      const startLv = mapData.config.startLevel;
      if (mapData.levels[startLv] && mapData.levels[startLv].playerPos) {
        return {
          x: mapData.levels[startLv].playerPos.x,
          y: mapData.levels[startLv].playerPos.y,
          level: startLv,
        };
      }
    }

    if (
      mapData.levels &&
      mapData.levels["0"] &&
      mapData.levels["0"].playerPos
    ) {
      return {
        x: mapData.levels["0"].playerPos.x,
        y: mapData.levels["0"].playerPos.y,
        level: "0",
      };
    }

    // Fallback: Scan map for 'player' type key
    let playerSymbol = "ply";
    if (mapData.entityTemplates) {
      const foundKey = Object.keys(mapData.entityTemplates).find(
        (key) => mapData.entityTemplates[key].type === "player",
      );
      if (foundKey) playerSymbol = foundKey;
    }

    // --- BUSCA BINÁRIA DE SPAWN ---
    const orderedLevels = [
      "1",
      "0",
      ...Object.keys(mapData.levels).filter((k) => k !== "0" && k !== "1"),
    ];

    for (const levelKey of orderedLevels) {
      const levelData = mapData.levels[levelKey];
      if (!levelData) continue;

      for (let y = 0; y < mapData.height; y++) {
        for (let x = 0; x < mapData.width; x++) {
          const symbol = this.mapLoader.getTileAt(x, y, levelKey);
          if (symbol === playerSymbol) {
            const size = mapData.tileSize || 32;
            return {
              x: x * size + size / 2,
              y: y * size + size / 2,
              level: levelKey,
            };
          }
        }
      }
    }

    return fallback;
  }

  public loadDecorations(mapData: any): void {
    // We NO LONGER create Sprites here. We store the metadata for the LevelRenderer.
    this.decorationsByLevel.clear();

    for (const level in mapData.levels) {
      const levelData = mapData.levels[level];
      const result = (this.mapLoader as any).parseEntities(
        levelData,
        this.mapLoader.getTileSize(),
      );
      const levelDecorations: any[] = [];

      result.decorations.forEach((data: any) => {
        const tileDefInMap = mapData.tileDefinitions[data.symbol];
        const entityDefInMap = mapData.entityTemplates?.[data.symbol];
        const tileId = tileDefInMap?.id || entityDefInMap?.id || data.symbol;

        levelDecorations.push({
          tileId,
          worldX: data.x,
          worldY: data.y,
          scale: data.scale,
          rotation: data.rotation,
          isCollidable: data.isCollidable,
        });
      });
      this.decorationsByLevel.set(level, levelDecorations);
    }
    console.log(
      `[GameScene] Cached decorations meta for ${this.decorationsByLevel.size} levels.`,
    );
  }

  public async loadEnemies(mapData: any): Promise<void> {
    this.enemiesByLevel.clear();

    // Store as metadata for lazy instantiation
    for (const level in mapData.levels) {
      const enemyData = this.mapLoader.getEnemiesForLevel(level);
      const levelEnemies: any[] = [];
      enemyData.forEach((data) => {
        levelEnemies.push({
          id: `${level}_${data.x}_${data.y}`,
          type: data.type,
          x: data.x,
          y: data.y,
          respawnTime:
            data.respawnTime ||
            EnemyRegistry.getEnemyDefinition(data.type)?.respawnTime ||
            5000,
        });
      });
      this.enemiesByLevel.set(level, levelEnemies);
    }

    // Load external enemies metadata
    if (this.cache.json.exists("enemies_data")) {
      const externalArgs = this.cache.json.get("enemies_data");
      const currentMap = this.registry.get("currentMap") || "newmap";
      const mapEnemiesBlob = externalArgs[currentMap];

      if (Array.isArray(mapEnemiesBlob)) {
        mapEnemiesBlob.forEach((def: any) => {
          const level = def.level || "0";
          const existing = this.enemiesByLevel.get(level) || [];
          existing.push({
            id: `ext_${level}_${def.x}_${def.y}`,
            type: def.id,
            x: def.x,
            y: def.y,
            respawnTime:
              def.respawnTime ||
              EnemyRegistry.getEnemyDefinition(def.id)?.respawnTime ||
              5000,
            overrides: def.overrides,
          });
          this.enemiesByLevel.set(level, existing);
        });
      }
    }
    console.log(`[GameScene] Cached enemies meta.`);
  }

  // --- PROXIMITY LOOT SYSTEM ---

  public getNearbyItems(range: number = 96): DroppedItem[] {
    if (!this.player || !this.droppedItemsGroup) return [];

    const playerX = this.player.sprite.x;
    const playerY = this.player.sprite.y;
    const nearby: DroppedItem[] = [];

    this.droppedItemsGroup.getChildren().forEach((go) => {
      const item = go as DroppedItem;
      // Filter by Level
      if (item.level !== this.currentLevel) return;

      const dist = Phaser.Math.Distance.Between(
        playerX,
        playerY,
        item.x,
        item.y,
      );
      if (dist <= range) {
        nearby.push(item);
      }
    });

    // Sort by distance (closest first)
    nearby.sort((a, b) => {
      const dA = Phaser.Math.Distance.Between(playerX, playerY, a.x, a.y);
      const dB = Phaser.Math.Distance.Between(playerX, playerY, b.x, b.y);
      return dA - dB;
    });

    return nearby;
  }

  public pickupNearbyItem() {
    const nearby = this.getNearbyItems();
    if (nearby.length > 0) {
      const target = nearby[0];
      console.log(`[Loot 2.0] Picking up ${target.itemId}`);
      target.pickup();
    }
  }

  // --- DROP ZONES VISUALIZATION ---
  private showDropZones() {
    if (!this.player || !this.player.sprite || !this.mapLoader) return;

    // Ensure fresh graphics
    if (this.dropHighlights) {
      this.dropHighlights.destroy();
    }
    if (!this.sys || !this.add) return;
    this.dropHighlights = this.add.graphics();
    this.dropHighlights.setDepth(9999); // Topmost

    // User requested "far away" throws, so we cover the visible screen area (approx 15-20 tiles radius)
    const range = 20 * this.mapLoader.getTileSize();
    const tileSize = this.mapLoader.getTileSize();
    const rangeInTiles = Math.ceil(range / tileSize);

    const pX = this.player.sprite.x;
    const pY = this.player.sprite.y;

    const centerTileX = Math.floor(pX / tileSize);
    const centerTileY = Math.floor(pY / tileSize);

    // Iterate area
    // Red for BLOCKED/INVALID
    this.dropHighlights.fillStyle(0xff5555, 0.15); // Much more subtle red
    this.dropHighlights.lineStyle(1, 0xff0000, 0.2);

    const mapWidthTiles = this.mapLoader.getMapWidth() / tileSize;
    const mapHeightTiles = this.mapLoader.getMapHeight() / tileSize;

    for (let y = -rangeInTiles; y <= rangeInTiles; y++) {
      for (let x = -rangeInTiles; x <= rangeInTiles; x++) {
        const tileX = centerTileX + x;
        const tileY = centerTileY + y;

        // Check bounds
        if (
          tileX < 0 ||
          tileY < 0 ||
          tileX >= mapWidthTiles ||
          tileY >= mapHeightTiles
        )
          continue;

        const worldX = tileX * tileSize;
        const worldY = tileY * tileSize;

        // Check validity (Walls, Void, etc)
        let isBlocked = this.isTileBlocked(tileX, tileY);

        // Check Line of Sight (if not already blocked)
        if (!isBlocked && this.player) {
          // Center of tile check
          if (
            !this.player.checkLineOfSight(
              worldX + tileSize / 2,
              worldY + tileSize / 2,
            )
          ) {
            isBlocked = true;
          }
        }

        if (isBlocked) {
          this.dropHighlights.fillStyle(0xff5555, 0.15); // Subtle Red
          this.dropHighlights.lineStyle(2, 0xff0000, 0.2); // Thicker but transparent stroke
          this.dropHighlights.fillRect(worldX, worldY, tileSize, tileSize);
          this.dropHighlights.strokeRect(worldX, worldY, tileSize, tileSize);
        } else {
          this.dropHighlights.fillStyle(0x00ff00, 0.1); // Very subtle Green
          // Removed stroke for valid tiles to be cleaner, or keep it very faint
          this.dropHighlights.fillRect(worldX, worldY, tileSize, tileSize);
        }
      }
    }
  }

  private hideDropZones() {
    if (this.dropHighlights) {
      this.dropHighlights.clear();
      this.dropHighlights.destroy();
      this.dropHighlights = null;
    }
  }

  private dropHighlights: Phaser.GameObjects.Graphics | null = null;
  private currentMap: string = "newmap";

  // Event Handlers (Bound)
  private onStartGroundDrag = () => this.showDropZones();
  private onEndGroundDrag = () => {
    this.isUiDragging = false;
    this.hideDropZones();
  };
  private onUiDragStart = () => {
    this.isUiDragging = true;
    // Stop player immediately to prevent infinite walking
    if (this.player?.sprite?.body) this.player.sprite.setVelocity(0);
    this.showDropZones();
  };
  private onUiDragEnd = () => {
    this.isUiDragging = false;
    this.hideDropZones();
  };

  private onPrepareRuneCast = (runeId: string) => {
    this.cursorMode = "target";
    this.targetRuneId = runeId;
    try {
      if (this.input && this.input.manager) {
        this.input.setDefaultCursor("crosshair");
      }
      PlayerState.getInstance().emit("uiNotification", {
        type: "info",
        message: "Select target...",
      });
    } catch (e) {
      console.warn("[GameScene] onPrepareRuneCast cursor error:", e);
    }
  };

  private onSpawnDroppedItem = (data: {
    itemId: string;
    weaponId: string;
    count: number;
    x?: number;
    y?: number;
    attributes?: any[];
    stars?: number;
  }) => {
    if (!this.player || !this.player.sprite) return;

    let x = data.x ?? this.player.sprite.x;
    let y = data.y ?? this.player.sprite.y;

    // Validate Drop Target (if explicit coords provided)
    if (data.x !== undefined && data.y !== undefined) {
      if (!this.validateItemDrop(x, y)) {
        this.showFloatingText(x, y, "Blocked!", 0xff0000);
        // Fallback to feet
        x = this.player.sprite.x;
        y = this.player.sprite.y;
      }
    }

    const item = new DroppedItem(
      this,
      x,
      y,
      data.weaponId,
      this.currentLevel,
      Date.now(),
    );
    item.itemId = data.itemId || PlayerState.getInstance().generateUID(); // Ensure UID
    if (data.count) item.count = data.count;
    if (data.stars) item.stars = data.stars;
    if (data.attributes) item.attributes = data.attributes;

    this.droppedItemsGroup.add(item);

    // Persist
    PlayerState.getInstance().addPersistentDroppedItem(this.currentLevel, {
      itemId: item.itemId,
      weaponId: data.weaponId,
      x: x,
      y: y,
      createdAt: Date.now(),
      count: data.count,
      stars: data.stars,
      attributes: data.attributes,
    });
  };

  private onMessage = (msg: string) => {
    // Placeholder for potential message display (e.g. floating text)
  };

  private onZJump = async (delta: number) => {
    if (!this.player || !this.player.sprite || !this.transitionSystem) return;

    const currentLevelStr = this.registry.get("currentLevel") || "0";
    const currentLevelInt = parseInt(currentLevelStr);
    const nextLevelInt = currentLevelInt + delta;
    const nextLevelStr = nextLevelInt.toString();

    const mapName = this.registry.get("currentMap") || "newmap";
    const mapData = this.cache.json.get(`${mapName}_data`);

    if (mapData && mapData.levels && mapData.levels[nextLevelStr]) {
      console.log(`[DEBUG] Z-Jump: ${currentLevelStr} -> ${nextLevelStr}`);
      const gridX = Math.floor(this.player.sprite.x / 32);
      const gridY = Math.floor(this.player.sprite.y / 32);

      // Use performTransition directly from transitionSystem
      // We cast to any if performTransition is private, but it's private in TransitionSystem.ts.
      // I should make it public or use a wrapper.
      // Wait, performTransition is private. I'll make it public in TransitionSystem.ts in the next step.
      (this.transitionSystem as any).performTransition(
        nextLevelStr,
        gridX,
        gridY,
        32,
        mapData,
      );
    } else {
      this.showFloatingText(
        this.player.sprite.x,
        this.player.sprite.y - 40,
        "Level Not Found",
        0xff0000,
      );
    }
  };

  async create(): Promise<void> {
    // Changed to match file (async)
    try {
      this.input.mouse?.disableContextMenu();

      // START: Clear previous listeners to prevent duplicates
      PlayerState.getInstance().off("message", this.onMessage);
      PlayerState.getInstance().off("requestZJump", this.onZJump);

      // Register listeners immediately
      PlayerState.getInstance().on("startGroundDrag", this.onStartGroundDrag);
      PlayerState.getInstance().on("endGroundDrag", this.onEndGroundDrag);
      PlayerState.getInstance().on("uiDragStart", this.onUiDragStart);
      PlayerState.getInstance().on("uiDragEnd", this.onUiDragEnd);
      PlayerState.getInstance().on("requestZJump", this.onZJump);

      // Cleanup previous potential listeners
      PlayerState.getInstance().on("prepareRuneCast", this.onPrepareRuneCast);
      PlayerState.getInstance().on("spawnDroppedItem", this.onSpawnDroppedItem);

      this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
      this.events.on(Phaser.Scenes.Events.DESTROY, this.shutdown, this);

      const initialMap = this.registry.get("currentMap") || "newmap";
      this.mapLoader = new MapLoader(this);

      await this.mapLoader.loadAllLevels(initialMap);

      // Init Dialogue Manager
      if (this.cache.json.exists("dialogues_data")) {
        const dialogues = this.cache.json.get("dialogues_data");
        DialogueManager.getInstance().loadDialogues(dialogues);
      }

      let initialPlayerPos = this.registry.get("playerPos");

      // v5.6: FORCE Level switch if map defines a startLevel and we aren't loading a specific save
      const mapData = this.cache.json.get(`${initialMap}_data`);
      if (
        mapData?.config?.startLevel &&
        !this.isRespawning &&
        !this.processedData?.playerState
      ) {
        console.log(
          `[SPAWN] Forcing Start Level: ${mapData.config.startLevel}`,
        );
        this.currentLevel = mapData.config.startLevel;
        this.registry.set("currentLevel", this.currentLevel);
        PlayerState.getInstance().setCurrentLevel(this.currentLevel);
        // Also clear stale playerPos if it exists to force re-search
        this.registry.remove("playerPos");
        initialPlayerPos = null;
      }

      if (!initialPlayerPos || this.isRespawning) {
        const spawnInfo = this.getSpawnCoordinate();
        initialPlayerPos = { x: spawnInfo.x, y: spawnInfo.y };
        if (this.currentLevel !== spawnInfo.level) {
          this.currentLevel = spawnInfo.level;
          this.registry.set("currentLevel", this.currentLevel);
          PlayerState.getInstance().setCurrentLevel(this.currentLevel);
        }
      }

      // If we are respawning, ignore the 'playerPos' from registry if it's stale (though handlePlayerDeath sets it)
      // Actually, handlePlayerDeath sets explicit playerPos in start data.
      // But let's verify if we need to force spawn search.
      if (!initialPlayerPos || this.isRespawning) {
        // Re-verify spawn to be absolutely sure we are at start
        const spawnInfo = this.getSpawnCoordinate();

        // Only override if respawning or if logic demands it (level 0 start)
        if (this.isRespawning) {
          initialPlayerPos = { x: spawnInfo.x, y: spawnInfo.y };
          this.currentLevel = spawnInfo.level;
        } else if (!initialPlayerPos) {
          initialPlayerPos = { x: spawnInfo.x, y: spawnInfo.y };
          if (this.currentLevel === "0" && spawnInfo.level !== "0") {
            this.currentLevel = spawnInfo.level;
          }
        }

        // Sync registry/state
        this.registry.set("currentLevel", this.currentLevel);
        PlayerState.getInstance().setCurrentLevel(this.currentLevel);
      }

      // --- EMERGENCY SCALE FIX ---
      // If the player position in the registry looks like it was from the 128px era, reset it.
      // 32px maps typically spawn within reasonable bounds. Increased for 512x512 Continental Scale.
      if (
        initialPlayerPos &&
        (initialPlayerPos.x > 20000 || initialPlayerPos.y > 20000)
      ) {
        console.warn("⚠️ Extreme scale detected. Resetting player to spawn.");
        initialPlayerPos = null;
        this.registry.remove("playerPos");
      }

      console.log(`Starting/Respawning at Level ${this.currentLevel}`);

      const { wallsLayer, mapWidth, mapHeight, items } =
        await this.mapLoader.setActiveLevel(this.currentLevel);
      if (!wallsLayer) throw new Error("Falha ao inicializar walls layer");

      if (items) {
        const state = PlayerState.getInstance();

        // CORRECTION: Only spawn "Map Default Items" if we have NOT visited this level before.
        // If we visited, we rely ENTIRELY on Persistence (which tracks what was picked up or moved).
        // Exceptions: If we want to support "Respawning Map Items" we would need a different logic,
        // but for standard RPG loot, "Daily Respawn" is separate.

        if (!state.hasVisitedLevel(this.currentLevel)) {
          console.log(
            `[LEVEL:INIT] First visit to Level ${this.currentLevel}. seeding Map Items.`,
          );

          items.forEach((mapItem) => {
            const uniqueId =
              mapItem.itemId ||
              `map_${this.currentLevel}_${mapItem.x}_${mapItem.y}`;

            // Double check against persistence just in case (e.g. save file corruption or weird state)
            // But primarily we trust 'visitedLevels'.
            state.addPersistentDroppedItem(this.currentLevel, {
              itemId: uniqueId,
              weaponId: mapItem.weaponId,
              x: mapItem.x,
              y: mapItem.y,
              createdAt: Date.now(),
            });

            if (mapItem.contents && mapItem.contents.length > 0) {
              mapItem.contents.forEach((content) => {
                for (let i = 0; i < content.count; i++) {
                  state.addItemToContainer(uniqueId, content.id, 1);
                }
              });
            }
          });

          state.markLevelVisited(this.currentLevel);
        } else {
          console.log(
            `[LEVEL:LOAD] Level ${this.currentLevel} already visited. Ignoring Map Default Items (Using Persistence).`,
          );
        }
      }

      this.transitionSystem = new TransitionSystem(this, this.mapLoader);
      this.levelRenderer = new LevelRenderer(
        this,
        this.mapLoader.getTileSize(),
        this.currentLevel,
      );
      this.enemySelectionIndicator = new EnemySelectionIndicator(this);

      // PRE-RENDER WORLD MAP (Now handled with BMS binary data)
      if (!this.processedData) {
        const { WorldMapService } = require("../../services/WorldMapService");
        WorldMapService.preRenderAll(mapData, this.mapLoader.getBinaryLevels());
      }

      await this.loadEnemies(mapData);
      this.loadDecorations(mapData);

      this.cursors = this.input.keyboard!.createCursorKeys();
      this.cameras.main.setRoundPixels(true);

      this.player = new Player(
        this,
        initialPlayerPos.x,
        initialPlayerPos.y,
        PlayerGraphic.TEXTURE_KEY,
      );
      this.registry.set("player", this.player);
      this.registry.set("playerInitialized", true);

      // Camera setup: Follow player and lock to map bounds
      this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
      this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
      this.physics.world.setBounds(0, 0, mapWidth, mapHeight);

      this.autoSaveSystem = new AutoSaveSystem(this);
      this.saveSystem = new SaveSystem(this);

      // AutoSave system was removed
      // Instead of restoring from autosave, we rely on the registry or explicit save file logic initiated in init()

      this.droppedItemsGroup = this.physics.add.group({
        classType: DroppedItem,
        runChildUpdate: true,
        collideWorldBounds: false,
      });

      // Init Projectiles
      const {
        RuneProjectile,
      } = require("../entities/projectiles/RuneProjectile");
      this.projectiles = this.physics.add.group({
        classType: RuneProjectile,
        runChildUpdate: true, // Important for homing update()
        collideWorldBounds: false,
      });

      this.pickupZone = this.physics.add
        .sprite(initialPlayerPos.x, initialPlayerPos.y, "blank")
        .setVisible(false);
      (this.pickupZone.body as Phaser.Physics.Arcade.Body).setCircle(
        this.PICKUP_RADIUS,
      );

      // --- PROCEDURAL NPC TEXTURES ---
      const npcColors: [string, number][] = [
        ["npc_elder", 0x6677aa], // Elder: blue/purple robe
        ["npc_guard", 0x557755], // Guard: green armor
      ];
      npcColors.forEach(([key, color]) => {
        if (!this.textures.exists(key)) {
          const g = this.add.graphics();
          g.fillStyle(color, 1); // Body
          g.fillRect(8, 12, 16, 18);
          g.fillStyle(0xffcc99, 1); // Face
          g.fillRect(10, 4, 12, 10);
          g.fillStyle(0x333333, 1); // Eyes
          g.fillRect(12, 7, 3, 3);
          g.fillRect(17, 7, 3, 3);
          g.generateTexture(key, 32, 32);
          g.destroy();
        }
      });

      // --- PROCEDURAL FIREBALL ANIMATION FRAMES ---
      const fireColors = [0xff8800, 0xff5500, 0xff3300, 0xffaa00];
      const fireSizes = [6, 8, 10, 7];
      for (let i = 1; i <= 4; i++) {
        const key = `fireball_${i}`;
        if (!this.textures.exists(key)) {
          const g = this.add.graphics();
          // Outer glow
          g.fillStyle(fireColors[i - 1], 0.4);
          g.fillCircle(16, 16, fireSizes[i - 1] + 3);
          // Inner core
          g.fillStyle(fireColors[i - 1], 1);
          g.fillCircle(16, 16, fireSizes[i - 1]);
          // White-hot center
          g.fillStyle(0xffffff, 0.8);
          g.fillCircle(16, 16, Math.max(2, fireSizes[i - 1] - 4));
          g.generateTexture(key, 32, 32);
          g.destroy();
        }
      }

      // --- PROCEDURAL LIGHT GLOW TEXTURE ---
      if (!this.textures.exists("light_glow")) {
        const g = this.add.graphics();
        // Radial white-to-transparent gradient (approximated with concentric circles)
        for (let r = 128; r >= 0; r -= 8) {
          const alpha = (1 - r / 128) * 0.6;
          g.fillStyle(0xffffff, alpha);
          g.fillCircle(128, 128, r);
        }
        g.generateTexture("light_glow", 256, 256);
        g.destroy();
      }

      // Create Projectile Animations
      if (!this.anims.exists("fire_burst_anim")) {
        this.anims.create({
          key: "fire_burst_anim",
          frames: [
            { key: "fireball_1" },
            { key: "fireball_2" },
            { key: "fireball_3" },
            { key: "fireball_4" },
          ],
          frameRate: 15,
          repeat: -1,
        });
      }

      this.loadPersistentItems();

      if (wallsLayer) this.physics.add.collider(this.player.sprite, wallsLayer);

      this.createPlayerAnimations();
      this.player.sprite.play("player-idle");

      this.battleSystem = new BattleSystem(this, this.player);
      this.player.setBattleSystem(this.battleSystem);

      this.inventorySystem = new InventorySystem(
        this,
        this.player,
        PlayerState.getInstance(),
      );

      this.physics.world.setFPS(60);
      this.player.sprite.setPushable(false);
      this.player.sprite.setMass(10);

      // Initialize Pathfinding Manager
      this.pathfindingManager = PathfindingManager.getInstance();

      // --- NPC SYSTEM ---
      this.npcs = this.physics.add.group({ runChildUpdate: true });
      if (this.cache.json.exists("npcs_data")) {
        const npcData = this.cache.json.get("npcs_data");
        const mapNPCs = npcData[initialMap] as NPCData[];
        if (mapNPCs) {
          mapNPCs.forEach((data) => {
            console.log("Spawning NPC:", data.name);
            // Check if NPC sprite exists, fallback to player texture if not to avoid crash
            if (!this.textures.exists(data.sprite)) {
              console.warn(
                `NPC Sprite ${data.sprite} missing, using fallback.`,
              );
              data.sprite = "player"; // Fallback
            }
            const npc = new NPC(this, data);
            this.npcs.add(npc);
          });
        }
      }
      this.physics.add.collider(this.player.sprite, this.npcs);
      this.physics.add.collider(this.npcs, wallsLayer!);

      await this.updateLevelCollisions();
      this.setupCamera(mapWidth, mapHeight);

      this.restoreEnemyStates();

      // FORCE UPDATE of visibility right now to prevent disappearing enemies
      this.levelRenderer.update(this.player.sprite.x, this.player.sprite.y);

      // --- QUEST SYSTEM ---
      const qm = QuestManager.getInstance();
      if (this.cache.json.exists("quest_rats")) {
        const ratsQuest = this.cache.json.get("quest_rats");
        qm.loadQuests(ratsQuest);
      }

      // --- INPUTS ---
      if (this.input.keyboard) {
        this.ctrlKey = this.input.keyboard.addKey(
          Phaser.Input.Keyboard.KeyCodes.CTRL,
        );
      }

      this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.leftButtonDown()) this.handleLeftClick(pointer);
        if (pointer.rightButtonDown()) this.handleRightClick(pointer);
      });

      // Handle Global Messages from PlayerState
      PlayerState.getInstance().on("message", this.onMessage);

      // Cleanup on Shutdown

      /*
      this.input.on("pointerup", () => {
        // Se soltou o mouse no "nada", cancela o drag (se estiver acontecendo)
        PlayerState.getInstance().endGroundDrag(false);
      });
      */

      PlayerState.getInstance().on(
        "dropContainerItem",
        this.onDropContainerItem,
      );

      PlayerState.getInstance().on("dropItem", this.onDropItem);

      PlayerState.getInstance().on("requestPickup", this.onRequestPickup);

      PlayerState.getInstance().on("torchToggled", this.onTorchToggled);

      PlayerState.getInstance().on(
        "performContextAction",
        this.onPerformContextAction,
      );

      // Listener para mensagens flutuantes (Too Heavy, etc)
      // Listener para mensagens flutuantes (Too Heavy, etc)
      PlayerState.getInstance().on("message", this.onMessage);

      PlayerState.getInstance().on("willpowerTierUp", this.onWillpowerTierUp);

      // Rune Casting System
      PlayerState.getInstance().on("prepareRuneCast", this.onPrepareRuneCast);

      await this.setupPathfindingGrid(
        wallsLayer,
        mapWidth,
        mapHeight,
        this.mapLoader.getTileSize(),
      );

      // --- CAMERA SETUP ---
      // Initial Zoom
      this.handleResize();

      // Handle Resize
      this.scale.on("resize", this.handleResize);

      this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

      this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

      // --- DARKNESS SYSTEM ---
      // Ensure RT covers the actual screen/canvas size
      const screenW = this.cameras.main.width;
      const screenH = this.cameras.main.height;
      this.darkOverlay = this.add.renderTexture(0, 0, screenW, screenH);
      this.darkOverlay.setDepth(1000); // Above map/players, below UI
      this.darkOverlay.setScrollFactor(0);
      this.darkOverlay.setOrigin(0, 0); // Crucial for setScrollFactor(0)

      this.darknessLayer = this.add.graphics();
      this.darknessLayer.setVisible(false); // Only use for drawing to RenderTexture

      const particleManager = this.add.particles(0, 0, "blank", {
        speed: { min: 20, max: 40 },
        scale: { start: 0.4, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 800,
        gravityY: -50,
        blendMode: "ADD",
        tint: [0xffaa00, 0xff4400, 0xffff00],
        frequency: 30,
        emitting: false,
      });
      this.fireParticles = particleManager;
      // --- GENERATE LIGHT SPRITE ---
      this.lightGlowSprite = this.make.image({ key: "light_glow", add: false });
      // Ensure origin is center for proper scaling
      this.lightGlowSprite.setOrigin(0.5, 0.5);

      // --- AUDIO INITIALIZATION ---
      this.input.once("pointerdown", () => {
        const audio = AudioManager.getInstance();
        audio.init().then(() => {
          audio.startTitleMusic();
        });
      });

      this.isInitialized = true;
      this.isPathfindingReady = true;

      if (this.benchmarkMode) {
        this.time.delayedCall(800, () => {
          void this.runBenchmark();
        });
      }
    } catch (error) {
      console.error("Erro ao inicializar GameScene:", error);
      this.isPathfindingReady = false;
    }
  }

  private benchmarkDelay(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private showBenchmarkSummary(
    passed: boolean,
    steps: Array<{ label: string; ok: boolean; durationMs: number; error?: string }>,
    totalMs: number,
  ): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const panelWidth = Math.min(760, width - 48);
    const lines = [
      `${this.benchmarkName} ${passed ? "PASS" : "FAIL"}`,
      `Total: ${(totalMs / 1000).toFixed(2)}s`,
      "",
      ...steps.map((step, i) => {
        const status = step.ok ? "PASS" : "FAIL";
        const timing = `${(step.durationMs / 1000).toFixed(2)}s`;
        const extra = step.error ? ` (${step.error})` : "";
        return `${i + 1}. ${status} ${step.label} - ${timing}${extra}`;
      }),
    ];

    const panelHeight = Math.min(height - 56, 132 + steps.length * 24);

    const panelBg = this.add
      .rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x000000, 0.88)
      .setStrokeStyle(2, passed ? 0x22c55e : 0xef4444, 0.9)
      .setScrollFactor(0)
      .setDepth(500000);

    const panelText = this.add
      .text(
        width / 2 - panelWidth / 2 + 18,
        height / 2 - panelHeight / 2 + 16,
        lines.join("\n"),
        {
          fontFamily: "monospace",
          fontSize: "16px",
          color: "#f8fafc",
          wordWrap: { width: panelWidth - 36, useAdvancedWrap: true },
          lineSpacing: 4,
        },
      )
      .setScrollFactor(0)
      .setDepth(500001);

    this.time.delayedCall(3600, () => {
      panelText.destroy();
      panelBg.destroy();
      window.dispatchEvent(new Event("returnToTitle"));
    });
  }

  private async publishBenchmarkResult(payload: {
    passed: boolean;
    totalMs: number;
    steps: Array<{ label: string; ok: boolean; durationMs: number; error?: string }>;
  }): Promise<void> {
    const runtimeErrors = RuntimeErrorMonitor.getErrors();
    const report = {
      benchmarkName: this.benchmarkName,
      map: this.registry.get("currentMap") || "unknown",
      level: this.currentLevel,
      passed: payload.passed,
      totalMs: payload.totalMs,
      completedAtIso: new Date().toISOString(),
      steps: payload.steps,
      runtimeErrors,
    };

    const electronAPI = (window as any).electronAPI;

    if (electronAPI?.writeBenchmarkReport && this.benchmarkReportPath) {
      const result = await electronAPI.writeBenchmarkReport(
        this.benchmarkReportPath,
        report,
      );
      if (!result?.success) {
        console.error(
          `[Benchmark] Failed to write report: ${result?.error || "unknown"}`,
        );
      } else {
        console.log(`[Benchmark] Report written to ${result.path}`);
      }
    } else {
      (window as any).__LAST_BENCHMARK_RESULT__ = report;
    }

    if (this.benchmarkAutoClose && electronAPI?.exitBenchmarkRun) {
      await this.benchmarkDelay(200);
      await electronAPI.exitBenchmarkRun(payload.passed ? 0 : 1);
      return;
    }

    this.showBenchmarkSummary(payload.passed, payload.steps, payload.totalMs);
  }

  private moveBenchmarkPlayer(x: number, y: number): void {
    if (!this.player || !this.player.sprite) return;
    this.player.sprite.setPosition(x, y);
    this.player.sprite.body?.updateFromGameObject();
    if (this.pickupZone) {
      this.pickupZone.setPosition(x, y);
    }
  }

  private async runBenchmark(): Promise<void> {
    if (this.benchmarkStarted || !this.player || !this.transitionSystem) return;
    this.benchmarkStarted = true;
    RuntimeErrorMonitor.clear();
    const benchmarkSaveName = `${this.benchmarkName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")}_${Date.now()}`;

    const playerState = PlayerState.getInstance();
    const startedAt = this.time.now;
    const stepResults: Array<{
      label: string;
      ok: boolean;
      durationMs: number;
      error?: string;
    }> = [];
    const fail = (message: string) => {
      console.error(`[Benchmark] FAIL ${message}`);
      playerState.emit("uiNotification", { type: "error", message });
    };

    const step = async (label: string, action: () => Promise<boolean> | boolean) => {
      console.log(`[Benchmark] STEP ${label}`);
      playerState.emit("uiNotification", {
        type: "info",
        message: `${this.benchmarkName}: ${label}`,
      });
      const t0 = this.time.now;
      await this.benchmarkDelay(250);
      let ok = false;
      let errorMsg: string | undefined;
      try {
        ok = await action();
      } catch (error) {
        errorMsg = error instanceof Error ? error.message : String(error);
      }

      const durationMs = this.time.now - t0;
      stepResults.push({
        label,
        ok,
        durationMs,
        error: ok ? undefined : errorMsg,
      });

      if (!ok) {
        throw new Error(errorMsg ? `${label}: ${errorMsg}` : label);
      }
    };

    let passed = false;
    try {
      await step("spawn ready", async () => {
        this.moveBenchmarkPlayer(96, 96);
        await this.benchmarkDelay(100);
        return this.currentLevel === "0";
      });

      await step("pickup loot", async () => {
        this.moveBenchmarkPlayer(336, 112);
        const maxAttempts = 5;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          this.pickupNearbyItem();
          await this.benchmarkDelay(120);

          const hasTorch = playerState
            .getInventory()
            .some((item) => item.itemId === "light_torch");

          if (hasTorch) {
            return true;
          }
        }

        const nearby = this.getNearbyItems(160).map((item) => ({
          weaponId: item.weaponId,
          level: item.level,
          x: item.x,
          y: item.y,
          count: item.count,
        }));
        const inventoryIds = playerState
          .getInventory()
          .map((item) => item.itemId)
          .slice(0, 12);

        throw new Error(
          `missing light_torch after pickup attempts | nearby=${JSON.stringify(nearby)} | inventory=${JSON.stringify(inventoryIds)}`,
        );
      });

      await step("transition down", async () => {
        this.moveBenchmarkPlayer(272, 272);
        await this.transitionSystem.tryManualTransition(8, 8, 32);
        await this.benchmarkDelay(350);
        return this.currentLevel === "-1";
      });

      await step("transition up", async () => {
        this.moveBenchmarkPlayer(272, 272);
        await this.transitionSystem.tryManualTransition(8, 8, 32);
        await this.benchmarkDelay(350);
        return this.currentLevel === "0";
      });

      await step("save/load roundtrip", async () => {
        const saved = await this.saveSystem.saveGame(benchmarkSaveName);
        if (!saved) {
          throw new Error("saveGame returned false");
        }

        const loaded = await this.saveSystem.loadCharacter(benchmarkSaveName);
        if (!loaded) {
          throw new Error("loadCharacter returned null");
        }

        const snapshot = playerState.exportSnapshot();
        const expectedInventory = snapshot.inventory?.some(
          (item) => item.itemId === "light_torch",
        );
        const loadedInventory = loaded.playerState.inventory?.some(
          (item) => item.itemId === "light_torch",
        );

        const isMatch =
          loaded.map === "smoke_test" &&
          loaded.currentLevel === this.currentLevel &&
          loaded.playerState.characterName === snapshot.characterName &&
          expectedInventory === loadedInventory;

        if (!isMatch) {
          throw new Error(
            `loaded save mismatch | map=${loaded.map} level=${loaded.currentLevel} name=${loaded.playerState.characterName} inventoryMatch=${expectedInventory === loadedInventory}`,
          );
        }

        return true;
      });

      passed = true;
      console.log(
        `[Benchmark] PASS ${stepResults.length}/${stepResults.length} steps`,
      );
      playerState.emit("uiNotification", {
        type: "success",
        message: `${this.benchmarkName} OK (${stepResults.length} steps)`,
      });
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    } finally {
      const runtimeErrors = RuntimeErrorMonitor.getErrors();
      if (passed && runtimeErrors.length > 0) {
        passed = false;
        stepResults.push({
          label: "runtime error check",
          ok: false,
          durationMs: 0,
          error: `${runtimeErrors.length} runtime error(s) captured`,
        });
      }

      await this.publishBenchmarkResult({
        passed,
        steps: stepResults,
        totalMs: this.time.now - startedAt,
      });

      try {
        await this.saveSystem.deleteCharacter(benchmarkSaveName);
      } catch (error) {
        console.warn(
          `[Benchmark] Failed to clean up temporary save ${benchmarkSaveName}`,
          error,
        );
      }
    }
  }

  private handleResize = () => {
    if (!this.cameras || !this.cameras.main) return;
    const VISIBLE_TILES_WIDTH = 20; // How many 32px tiles should be visible horizontally
    const TILE_SIZE = 32; // New tile size (was 128, now procedural 32px)
    const width = this.scale.width;
    // Calculate Zoom to fit exactly VISIBLE_TILES_WIDTH tiles
    const zoom = width / (VISIBLE_TILES_WIDTH * TILE_SIZE);
    this.cameras.main.setZoom(zoom);
  };

  public pickupItem(item: DroppedItem, count?: number): void {
    const playerState = PlayerState.getInstance();
    console.log(
      `[DEBUG] GameScene.pickupItem: ${item.weaponId} Stars=${item.stars} Attrs=${JSON.stringify(item.attributes)}`,
    );
    const pickupCount = count || item.count; // Default to all if not specified

    // Tenta adicionar a quantidade solicitada
    // CRITICAL: Pass item.itemId (UID) to preserve container contents!

    // Sound Effect
    AudioManager.getInstance().playPickup();

    const success = playerState.addItem(
      item.weaponId,
      pickupCount,
      item.itemId,
      item.stars || 0,
      [...(item.attributes || [])],
    );

    if (success) {
      // Logic for partial pickup? PlayerState.addItem returns boolean (all or nothing?)
      // Assuming addItem handles capacity for the whole batch.

      if (pickupCount >= item.count) {
        playerState.removePersistentDroppedItem(item.level, item.itemId);
        this.droppedItemsGroup.remove(item, true, true);
      } else {
        item.count -= pickupCount;
        // Update persistence count (accessing internal state or using utility)
        const pItems = playerState.getPersistentDroppedItems(this.currentLevel);
        const pItem = pItems.find((i) => i.itemId === item.itemId);
        if (pItem) pItem.count = item.count;
      }

      const def = WeaponRegistry.getWeaponDefinition(item.weaponId);
      const itemName = def ? t_game(("item_" + def.id) as any) : item.weaponId;

      PlayerState.getInstance().emit("uiNotification", {
        type: "pickup",
        message: t_game("notif_item_get")
          .replace("{amount}", pickupCount.toString())
          .replace("{item}", itemName),
      });
      playerState.endGroundDrag(true); // Clear drag state and visuals
    } else {
      // Se falhou (mochila cheia)
      item.setAlpha(1);
      item.setVisible(true);
      PlayerState.getInstance().emit("uiNotification", {
        type: "error",
        message: t_game("msg_cap_full") || "Full Cap",
      });
      playerState.endGroundDrag(false); // Clear visuals
    }
  }

  private async handleRightClick(pointer: Phaser.Input.Pointer): Promise<void> {
    if (PlayerState.getInstance().getInputBlocked()) {
      console.log("[GameScene] Input Blocked. Ignoring Right Click.");
      return;
    }

    if (this.cursorMode === "target") {
      // Cancel Casting
      this.cursorMode = "default";
      this.targetRuneId = null;
      this.input.setDefaultCursor("default");
      PlayerState.getInstance().emit("uiNotification", {
        type: "info",
        message: "Canceled.",
      });
      return;
    }

    if (!this.player || !this.player.sprite) return;

    const worldX = pointer.worldX;
    const worldY = pointer.worldY;
    const tileSize = 32;
    const gridX = Math.floor(worldX / 32);
    const gridY = Math.floor(worldY / 32);

    const playerGridX = Math.floor(this.player.sprite.x / tileSize);
    const playerGridY = Math.floor(this.player.sprite.y / tileSize);

    // Distance check (must be adjacent or on tile)
    const dist = Phaser.Math.Distance.Between(
      playerGridX,
      playerGridY,
      gridX,
      gridY,
    );

    // --- TORCH TOGGLE (Click on Player or Adjacent) ---

    // Allow interaction if distance < 2 (adjacent including diagonals, roughly)
    if (dist < 2) {
      // Check for Ground Items to Interact (Eat)
      const itemsAtTile = this.droppedItemsGroup
        .getChildren()
        .filter((child: any) => {
          const item = child as DroppedItem;
          return (
            Math.floor(item.x / tileSize) === gridX &&
            Math.floor(item.y / tileSize) === gridY
          );
        }) as DroppedItem[];

      if (itemsAtTile.length > 0) {
        // Try to consume the top item
        // Sort by Y/Depth if needed, but just take the last one (rendered on top usually)
        const topItem = itemsAtTile[itemsAtTile.length - 1];
        const def = WeaponRegistry.getWeaponDefinition(topItem.weaponId);

        // CONTEXT MENU (Ctrl + Right Click)
        if (pointer.event.ctrlKey) {
          const e = pointer.event as MouseEvent;
          PlayerState.getInstance().emit("requestContextMenu", {
            x: e.clientX,
            y: e.clientY,
            type: "ground_item",
            item: topItem,
            def: def,
          });
          return;
        }

        // PICKUP ALL (Shift + Right Click)
        if (pointer.event.shiftKey) {
          console.log(
            `[DEBUG] Shift+RightClick Pickup: ${topItem.weaponId} Stars=${topItem.stars}`,
          );
          this.pickupItem(topItem, topItem.count);
          return;
        }

        if (def && def.consumable && def.type === "food" && def.hungerValue) {
          // Check Overflow
          if (PlayerState.getInstance().getHunger() + def.hungerValue > 2000) {
            this.showFloatingText(
              worldX,
              worldY,
              t_game("msg_hunger_full"),
              0xff5555,
            );
            return;
          }
          PlayerState.getInstance().eatFood(def.hungerValue);

          // Stack Logic
          if (topItem.count > 1) {
            topItem.count--;
            // Update Persistence
            const state = PlayerState.getInstance();
            const pItems = state.getPersistentDroppedItems(this.currentLevel);
            const pItem = pItems.find((i: any) => i.itemId === topItem.itemId);
            if (pItem) pItem.count = topItem.count;

            // Visual Feedback? (Maybe shake or small text "-1")
            this.showFloatingText(worldX, worldY, "-1", 0xffffff, "24px");
          } else {
            // Remove from world and state
            PlayerState.getInstance().removePersistentDroppedItem(
              this.currentLevel,
              topItem.itemId,
            );
            this.droppedItemsGroup.remove(topItem, true, true); // Destroy sprite
          }
          return; // Consumed, stop processing
        }

        // CHECK IF IT IS A CONTAINER (Dropped/Moved)
        // If item is not food/context/pickup, check if it's a container to open
        const potentialContainerDef = WeaponRegistry.getWeaponDefinition(
          topItem.weaponId,
        );
        if (
          potentialContainerDef &&
          (potentialContainerDef.type === "container" ||
            ContainerRegistry.getContainer(potentialContainerDef.id))
        ) {
          const containerDef = ContainerRegistry.getContainer(
            potentialContainerDef.id,
          );
          if (containerDef) {
            // Line of Sight Check (Reuse existing check logic)
            if (!this.hasLineOfSight(playerGridX, playerGridY, gridX, gridY)) {
              this.showFloatingText(
                worldX,
                worldY,
                t_game("msg_blocked"),
                0xff5555,
              );
              return;
            }

            // Use the DroppedItem's UUID as the Container UID.
            // This ensures that if we picked up a chest with stuff, it keeps its stuff.
            // provided persistence logic preserved the mapping.
            PlayerState.getInstance().openContainer(
              topItem.itemId, // This UID must match the one in PlayerState.containers map
              containerDef.id,
              t_game(containerDef.name as any),
              { x: topItem.x, y: topItem.y, level: this.currentLevel },
            );
            return;
          }
        }
      }

      // ===== MAP CONTAINER INTERACTION =====
      // If no item on ground, check if the clicked TILE is a container
      if (!pointer.event.shiftKey && !pointer.event.ctrlKey) {
        // We need map data. It is usually in cache.
        const currentMap = this.registry.get("currentMap");
        const mapData = this.cache.json.get(`${currentMap}_data`);

        if (mapData && mapData.levels && mapData.levels[this.currentLevel]) {
          const symbol = this.mapLoader.getTileAt(
            gridX,
            gridY,
            this.currentLevel,
          );
          if (symbol) {
            let tileDef = mapData.tileDefinitions[symbol];

            // Fallback to checking entityTemplates if not in tileDefinitions
            if (!tileDef && mapData.entityTemplates) {
              tileDef = mapData.entityTemplates[symbol];
            }

            console.log(
              `[Interaction] Clicked: ${gridX},${gridY} Symbol: ${symbol} ID: ${tileDef?.id}`,
            );
            if (tileDef) {
              // GHOST CHECK: If it's a movable item, it should have been handled by sprite logic above.
              // If we see it here in static map data but no sprite was clicked, it means it's gone/moved.
              if (tileDef.type === "item") return;

              const containerDef = ContainerRegistry.getContainer(tileDef.id);
              console.log(`[Interaction] ContainerDef:`, containerDef);
              if (containerDef) {
                // Line of Sight Check
                // We check if the path is clear.
                if (
                  !this.hasLineOfSight(playerGridX, playerGridY, gridX, gridY)
                ) {
                  this.showFloatingText(
                    worldX,
                    worldY,
                    t_game("msg_blocked"),
                    0xff5555,
                  );
                  return;
                }

                // It IS a container! Open it.
                let containerUid = `map_${this.currentLevel}_${gridX}_${gridY}`;

                // Check for specific UUID override in Entities layer
                if (mapData.entityTemplates) {
                  const entityDef = mapData.entityTemplates[symbol];
                  if (entityDef && entityDef.uuid) {
                    containerUid = entityDef.uuid;
                  }
                }

                // Calculate world position center of tile
                const tileWorldX = gridX * tileSize + tileSize / 2;
                const tileWorldY = gridY * tileSize + tileSize / 2;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                PlayerState.getInstance().openContainer(
                  containerUid,
                  containerDef.id,
                  t_game(containerDef.name as any),
                  { x: tileWorldX, y: tileWorldY, level: this.currentLevel },
                );
                return; // Stop processing (don't transition)
              }
            }
          }
        }
      }

      await this.transitionSystem.tryManualTransition(gridX, gridY, tileSize);
    } else {
      this.showFloatingText(worldX, worldY, "Too far", 0xffffff);
    }
  }

  // Optimized Bresenham/Raycast for Tile Grid
  private hasLineOfSight(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): boolean {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let cx = x0;
    let cy = y0;

    // Max iterations safety
    let loops = 0;
    while (true) {
      if (loops++ > 100) break; // Safety break

      if (cx === x1 && cy === y1) return true; // Reached target

      // Check collision at current storage
      // Note: We skip the start tile (player position)
      if (cx !== x0 || cy !== y0) {
        if (this.isTileBlocked(cx, cy)) return false;
      }

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
    return true;
  }

  public isTileBlocked(x: number, y: number): boolean {
    const currentMap = this.registry.get("currentMap");
    const mapData = this.cache.json.get(`${currentMap}_data`);
    if (!mapData || !mapData.levels || !this.mapLoader) return true; // Blocked if no data

    const symbol = this.mapLoader.getTileAt(x, y, this.currentLevel);
    if (!symbol || symbol === "...") return true; // Blocked (Void)

    // Check collision
    const tileDef =
      mapData.tileDefinitions[symbol] ||
      (mapData.entityTemplates ? mapData.entityTemplates[symbol] : null);
    if (tileDef && tileDef.block) return true;

    return false;
  }

  // ... (keeping existing methods)

  // In update loop (auto-close fix)
  // Replaces lines 1268-1312 roughly, but I need to target correctly.
  // Wait, I can't replace scattered chunks easily.
  // I will target the specific block in update method.

  // Actually, I should do this in two chunks if they are far apart, but handleRightClick ends around 705.
  // Update loop starts around 1226.
  // I will use two replace calls or carefully target the update loop separately.
  // The Instruction above says Update handleRightClick AND Update loop.
  // But replace_file_content expects a SINGLE CONTIGUOUS BLOCK.
  // These are NOT contiguous. I must use separate calls or check line numbers.
  // handleRightClick block is ~687-695.
  // Update loop block is ~1268-1312.
  // They are very far apart. I MUST use MULTI_REPLACE or separate calls.
  // I will use separate calls for safety. This specific call will target handleRightClick.

  public showFloatingText = (
    x: number,
    y: number,
    message: string | number,
    color: string | number = 0xffffff,
    fontSize: string = "128px",
  ): void => {
    // Automatic Redirection to Notification Stack
    let type: "info" | "warning" | "error" | "success" = "info";

    const c = typeof color === "string" ? color : color;
    if (c === 0xff0000 || c === "#ff0000") type = "error";
    else if (c === 0xffa500 || c === 0xff5555 || c === "#ffa500")
      type = "warning";

    // Filter out small damage numbers? User wants "Everything".
    // "-1" is consumed food (white). -> Info.
    // "Too far" (Orange) -> Warning.
    // "Blocked" (Red) -> Error.

    PlayerState.getInstance().emit("uiNotification", {
      type: type,
      message: String(message),
    });
  };

  private handlePlayerDeath(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    console.log("💀 Player died. Initiating full reset.");
    AudioManager.getInstance().playHeroDeath();

    if (this.player?.sprite?.body) this.player.sprite.body.stop();
    this.physics.world.pause();

    // Play Death Animation
    if (this.player?.sprite) {
      this.player.sprite.play("player-death", true);
    }

    // Wait for animation (e.g., 2 seconds) before resetting
    this.time.delayedCall(2000, () => {
      // Reset Player State completely
      PlayerState.getInstance().respawn();

      this.executeRespawn();
    });
  }

  private executeRespawn(): void {
    // Capture current enemy state before restart to ensure persistence
    // CHANGE: User requested enemies reset to initial pos/full HP.
    // So we DO NOT capture activeEnemies. We only capture deadEnemies to respect respawn timers.
    const activeEnemies: ActiveEnemyState[] = [];
    /*
    if (this.enemiesByLevel) {
        // console.warn(`💀 specific debug: enemiesByLevel size = ${this.enemiesByLevel.size}`);
        this.enemiesByLevel.forEach((enemies, level) => {
            // console.warn(`💀 Level ${level} has ${enemies.length} enemies.`);
            enemies.forEach((enemy) => {
                const defeated = enemy.isDefeated();
                const spriteActive = enemy.sprite && enemy.sprite.active;
                
                if (!defeated && spriteActive) {
                    activeEnemies.push({
                        id: enemy.id,
                        x: enemy.sprite.x,
                        y: enemy.sprite.y,
                        health: enemy.health, 
                        level: level
                    });
                } else {
                    // console.log(`❌ Failed to capture enemy ${enemy.id}: Defeated=${defeated}, SpriteActive=${spriteActive}`);
                }
            });
        });
    }
    */

    // Preserve dead enemies (so they don't respawn instantly)
    const deadEnemies = this.deadEnemies || [];

    // 1. Get exact spawn info from map file (Level 0 priority)
    const spawnInfo = this.getSpawnCoordinate();
    const currentMap = this.registry.get("currentMap") || "newmap";

    console.log("Respawning at:", spawnInfo);

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.restart({
        isRespawn: true,
        currentLevel: spawnInfo.level, // Explicitly pass the respawn level
        playerPos: { x: spawnInfo.x, y: spawnInfo.y },
        map: currentMap,
        deadEnemies: deadEnemies, // Pass preserved dead
        activeEnemies: activeEnemies, // Pass preserved living
        playerState: null, // Force reload/reset of state management logic, but Inventory/Skills persist via Singleton usually?
        // Wait, PlayerState.respawn() was called above. That resets experience/health?
        // PlayerState is distinct from Scene. restart() destroys scene.
        // Singleton PlayerState persists across scenes.
      });
    });
  }

  public findPlayerStartPosition(
    mapName: string,
    specificLevel?: string,
  ): { x: number; y: number } {
    const data = this.getSpawnCoordinate();
    if (specificLevel && data.level !== specificLevel) return { x: 32, y: 32 };
    return { x: data.x, y: data.y };
  }

  private validateItemDrop(worldX: number, worldY: number): boolean {
    const mapLoader = this.mapLoader as MapLoader;
    const tileSize = mapLoader.getTileSize();
    const gridX = Math.floor(worldX / tileSize);
    const gridY = Math.floor(worldY / tileSize);

    // 1. Boundary Check
    if (
      gridX < 0 ||
      gridX >= mapLoader.getMapWidth() ||
      gridY < 0 ||
      gridY >= mapLoader.getMapHeight()
    ) {
      console.warn(
        `[GameScene] Drop blocked: (${gridX},${gridY}) is outside map bounds.`,
      );
      return false;
    }

    // 2. Distance & LOS Check
    if (this.player) {
      const distance = Phaser.Math.Distance.Between(
        worldX,
        worldY,
        this.player.sprite.x,
        this.player.sprite.y,
      );
      if (distance > 600) {
        console.warn("[GameScene] Drop blocked: Too far away.");
        this.showFloatingText(worldX, worldY, "Too far!", 0xffa500);
        return false;
      }
      if (!this.player.checkLineOfSight(worldX, worldY)) {
        console.warn("[GameScene] Drop blocked: No line of sight.");
        this.showFloatingText(worldX, worldY, "No line of sight", 0xffa500);
        return false;
      }
    }

    // 3. Wall Check on current level
    // 3. Wall Check on current level
    if (this.isTileBlocked(gridX, gridY)) {
      console.warn(
        `[GameScene] Drop blocked: Wall collision at (${gridX},${gridY})`,
      );
      this.showFloatingText(worldX, worldY, "Blocked", 0xff0000);
      return false;
    }

    return true;
  }

  public dropItemFromInventory(
    uid: string,
    worldX: number,
    worldY: number,
    requestedCount?: number,
  ): void {
    if (!this.validateItemDrop(worldX, worldY)) {
      return;
    }
    console.log(
      `[GameScene] Requesting Drop Item UID: ${uid} at ${worldX},${worldY} Count: ${requestedCount}`,
    );
    const playerState = PlayerState.getInstance();

    // ROBUSTNESS: If UI incorrectly routed an Equipment Drop here, redirect it.
    if (uid.startsWith("equipped_")) {
      console.warn(
        `[GameScene] Redirecting 'dropItem' for equipment '${uid}' to 'dropEquippedItem'.`,
      );
      const slot = uid.replace("equipped_", "");
      playerState.dropEquippedItem(slot as any, worldX, worldY);
      return;
    }

    // 1. Get Item Info (Definition ID needed for graphics)
    let item = playerState.getInventoryItem(uid);

    // FALLBACK: If UI sent itemId instead of UID (Common React UI issue)
    if (!item) {
      // Try to find by itemId
      const inventory = playerState.getInventoryItems();
      item = inventory.find((i) => i.itemId === uid);

      if (item && item.uid) {
        console.warn(
          `[GameScene] Drop Request used ItemID '${uid}' instead of UID. Found UID '${item.uid}'. Proceeding.`,
        );
        uid = item.uid; // Update UID to correct one
      }
    }

    if (!item) {
      console.warn(`Attempted to drop missing item UID: ${uid}`);
      return;
    }

    const weaponId = item.itemId;
    const dropCount = requestedCount || item.count; // Default to ALL if not specified

    // 2. Reduce or Remove
    if (dropCount >= item.count) {
      playerState.removeInventoryItem(uid);
    } else {
      item.count -= dropCount;
      playerState.emit("inventoryUpdated");
    }

    // 3. Spawn reusing the UID (Preserves Container Contents) IF dropping all?
    // If splitting, we should generate NEW UID for dropped item?
    // Actually, DroppedItem constructor generates new UID.
    // If we pass `preservedUid`, it uses that.
    // If we drop ALL, we can preserve UID.
    // If we split, we MUST generate new UID for ground item, and keep old UID in inventory.

    const uidToPreserve = dropCount >= item.count ? uid : undefined;

    try {
      this.spawnDroppedItem(
        weaponId,
        worldX,
        worldY,
        uidToPreserve,
        undefined,
        undefined,
        dropCount,
        item.stars,
        item.attributes,
      );
    } catch (err) {
      console.error(
        `[GameScene] Failed to spawn dropped item ${weaponId}:`,
        err,
      );
      this.showFloatingText(worldX, worldY, "Drop Error", 0xff0000);
      // Refund item if spawn failed?
      // Ideally yes, but complexity risks dupe.
      // For now, logging prevents crash loop.
    }
  }

  public dropItemFromContainer(
    containerId: string,
    itemUid: string,
    itemId: string,
    count: number,
    worldX: number,
    worldY: number,
  ): void {
    if (!this.validateItemDrop(worldX, worldY)) {
      return;
    }
    const playerState = PlayerState.getInstance();
    // Logic: Attempt to remove from container
    if (playerState.removeItemFromContainer(containerId, itemUid)) {
      // Success: Create Dropped Item
      this.spawnDroppedItem(itemId, worldX, worldY);
    } else {
      // Failure: Do nothing (or notify)
      console.warn("Failed to drop item from container (not found or error).");
    }
  }

  public calculateItemLanding(
    startX: number,
    startY: number,
    startLevel: string,
    direction?: { x: number; y: number },
  ): { x: number; y: number; level: string } {
    const mapData = this.cache.json.get(
      `${this.registry.get("currentMap")}_data`,
    );
    if (!mapData) return { x: startX, y: startY, level: startLevel };

    let currentX = startX;
    let currentY = startY;
    let currentLevelIdx = parseInt(startLevel);

    console.log(
      `[ItemLanding] Start: (${startX},${startY}) Lvl:${startLevel} Dir:`,
      direction,
    );

    // --- HANDLE FALLING (Recursive) ---
    let iterations = 0;
    let appliedDisplacement = false;

    while (iterations < 10) {
      iterations++;
      const tile = this.mapLoader.getTileAt(
        currentX,
        currentY,
        currentLevelIdx.toString(),
      );

      // If NOT void, it lands here
      if (tile && tile !== "...") {
        console.log(
          `[ItemLanding] Landed on Level ${currentLevelIdx} at (${currentX},${currentY}) - Tile: ${tile}`,
        );
        return { x: currentX, y: currentY, level: currentLevelIdx.toString() };
      }

      // If void, fall to level below if possible
      const nextLevelIdx = currentLevelIdx - 1;
      if (!mapData.levels[nextLevelIdx.toString()]) {
        console.log(
          `[ItemLanding] Rock bottom reached at Level ${currentLevelIdx}`,
        );
        return { x: currentX, y: currentY, level: currentLevelIdx.toString() };
      }

      // Displacement Logic based on user request (Apply ONLY ONCE per fall path)
      if (!appliedDisplacement && direction) {
        if (direction.x > 0) {
          currentX -= 1; // Throw Right -> Land x-1
          console.log(
            `[ItemLanding] Applying Right Displacement -> newX: ${currentX}`,
          );
        } else if (direction.y > 0) {
          currentY += 1; // Throw Down -> Land y+1
          console.log(
            `[ItemLanding] Applying Down Displacement -> newY: ${currentY}`,
          );
        }
        appliedDisplacement = true;
      }

      currentLevelIdx = nextLevelIdx;
      console.log(`[ItemLanding] Falling to Level ${currentLevelIdx}...`);
    }

    console.warn(
      `[ItemLanding] Safety limit reached. Landing at (${currentX},${currentY}) Lvl:${currentLevelIdx}`,
    );
    return { x: currentX, y: currentY, level: currentLevelIdx.toString() };
  }

  public spawnDroppedItem(
    weaponId: string,
    worldX: number,
    worldY: number,
    preservedUid?: string,
    startLevel?: string,
    createdAt?: number,
    count: number = 1,
    stars: number = 0,
    attributes: any[] = [],
  ) {
    if (!this.droppedItemsGroup) return;

    const tileSize = this.mapLoader.getTileSize();
    const gridX = Math.floor(worldX / tileSize);
    const gridY = Math.floor(worldY / tileSize);

    // Determine direction relative to player for displacement
    let dir = undefined;
    if (this.player) {
      dir = {
        x: gridX - Math.floor(this.player.sprite.x / tileSize),
        y: gridY - Math.floor(this.player.sprite.y / tileSize),
      };
    }

    // Calculate landing (Supports falling through holes)
    const initialLevel = startLevel || this.currentLevel;
    const landing = this.calculateItemLanding(gridX, gridY, initialLevel, dir);

    // Create Sprite
    const item = new DroppedItem(
      this,
      landing.x * tileSize + tileSize / 2,
      landing.y * tileSize + tileSize / 2,
      weaponId,
      landing.level,
      createdAt || Date.now(),
      count,
      stars,
      attributes,
    );

    if (preservedUid) {
      item.itemId = preservedUid;
    }

    this.droppedItemsGroup.add(item);

    // Persistence
    const state = PlayerState.getInstance();
    state.addPersistentDroppedItem(landing.level, {
      itemId: item.itemId,
      weaponId: item.weaponId,
      x: item.x,
      y: item.y,
      createdAt: item.createdAt,
      count: count,
      stars: stars,
      attributes: attributes,
    });
  }

  private restoreEnemyStates(): void {
    console.warn(
      `[LIFECYCLE:RESTORE] Start. DeadCount=${this.deadEnemies.length}, ActiveCount=${this.activeEnemiesToLoad.length}`,
    );
    // 1. Handle Dead Enemies
    const deadIds = new Set(this.deadEnemies.map((d) => d.id));

    // 2. Map of Active Enemy States for fast lookup
    const activeStateMap = new Map<string, ActiveEnemyState>();
    this.activeEnemiesToLoad.forEach((s) => activeStateMap.set(s.id, s));

    this.enemiesByLevel.forEach((enemies, level) => {
      enemies.forEach((enemy) => {
        if (deadIds.has(enemy.id)) {
          console.warn(
            `[LIFECYCLE:RESTORE] Killing persistent dead enemy: ${enemy.id}`,
          );
          // Kill it silently due to deadEnemies persistence
          enemy.health = 0;
          enemy.sprite.setActive(false);
          enemy.sprite.setVisible(false);
          // console.log(`💀 Marking ${enemy.id} as dead (persistent)`);
        } else if (activeStateMap.has(enemy.id)) {
          const state = activeStateMap.get(enemy.id)!;
          enemy.health = state.health;
          // Only move if on same level (IDs include level, so unique)
          enemy.sprite.setPosition(state.x, state.y);
        }
      });
    });
  }

  private createPlayerAnimations() {
    if (!this.anims.exists("player-idle")) {
      this.anims.create({
        key: "player-idle",
        frames: this.anims.generateFrameNumbers(PlayerGraphic.TEXTURE_KEY, {
          frames: [0, 1],
        }),
        frameRate: 4,
        repeat: -1,
      });
    }
    if (!this.anims.exists("player-walk")) {
      this.anims.create({
        key: "player-walk",
        frames: this.anims.generateFrameNumbers(PlayerGraphic.TEXTURE_KEY, {
          frames: [2, 3, 4, 5],
        }),
        frameRate: 8,
        repeat: -1,
      });
    }
  }

  private loadPersistentItems(): void {
    const playerState = PlayerState.getInstance();
    const persistent = playerState.getPersistentDroppedItems(this.currentLevel);
    console.log(
      `[DEBUG] Loading Persistent Items for Level ${this.currentLevel}: Count=${persistent.length}`,
    );
    persistent.forEach((data: any) => {
      const { itemId, weaponId, x, y, createdAt, count, stars, attributes } =
        data;
      console.log(
        `[DEBUG] Spawning Persistent Item: ${weaponId} (ID: ${itemId}) at ${x},${y} Stars: ${stars}`,
      );
      const droppedItem = new DroppedItem(
        this,
        x,
        y,
        weaponId,
        this.currentLevel,
        createdAt,
        count || 1,
        stars || 0,
        attributes || [],
      );
      droppedItem.itemId = itemId;
      this.droppedItemsGroup.add(droppedItem);
    });
  }

  private updateLevelCollisions(
    centerX?: number,
    centerY?: number,
    radius: number = 20,
  ): void {
    const wallsLayer = this.mapLoader.getWallsLayer();
    if (!wallsLayer || !this.player) return;

    // SAFE: Clear physics world colliders to prevent stacking
    if (this.physics.world.colliders) {
      this.physics.world.colliders.getActive().forEach((c) => c.destroy());
    }

    // 1. REBUILD LANDING SHIELD (Solidify nearby blocks)
    if (centerX !== undefined && centerY !== undefined) {
      wallsLayer.clear(true, true);

      const mapData = this.cache.json.get(
        `${this.registry.get("currentMap")}_data`,
      );

      const startY = Math.max(0, Math.floor(centerY / 32) - radius);
      const endY = Math.min(
        mapData.height - 1,
        Math.floor(centerY / 32) + radius,
      );
      const startX = Math.max(0, Math.floor(centerX / 32) - radius);
      const endX = Math.min(
        mapData.width - 1,
        Math.floor(centerX / 32) + radius,
      );

      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          const symbol = this.mapLoader.getTileAt(x, y, this.currentLevel);
          if (symbol && symbol !== "...") {
            const tileDef =
              mapData.tileDefinitions[symbol] ||
              mapData.entityTemplates[symbol];

            if (
              tileDef &&
              (tileDef.block || tileDef.type === "wall" || tileDef.isCollidable)
            ) {
              const wx = x * 32 + 16;
              const wy = y * 32 + 16;
              const obj = wallsLayer.create(wx, wy);
              obj.setVisible(false);
              obj.setActive(false);
              if (obj.body) obj.body.updateFromGameObject();
            }
          }
        }
      }
    }

    // 2. Set up Colliders
    this.physics.add.collider(this.player.sprite, wallsLayer);

    const currentEnemies = this.enemiesByLevel.get(this.currentLevel) || [];
    const activeSprites = currentEnemies
      .map((e) => e.sprite)
      .filter((s) => s && s.active);

    if (activeSprites.length > 0) {
      this.physics.add.collider(activeSprites, wallsLayer);
      this.physics.add.collider(activeSprites, activeSprites);
      currentEnemies.forEach((enemy) => {
        this.physics.add.collider(this.player!.sprite, enemy.sprite);
      });
    }
  }

  private async setupPathfindingGrid(
    wallsLayer: Phaser.Physics.Arcade.StaticGroup | null,
    mapWidth: number,
    mapHeight: number,
    tileSize: number,
  ): Promise<void> {
    const gridWidth = Math.ceil(mapWidth / tileSize);
    const gridHeight = Math.ceil(mapHeight / tileSize);

    // Check if we have a valid pre-calculated grid
    const preGrid = this.processedData?.pathfindingGrids?.[this.currentLevel];
    const hasValidPreGrid =
      Array.isArray(preGrid) &&
      preGrid.length > 0 &&
      Array.isArray(preGrid[0]) &&
      preGrid[0].length > 0;

    if (hasValidPreGrid) {
      console.log(
        `[Pathfinding] Using pre-calculated grid for Level ${this.currentLevel}`,
      );
      this.pathfindingGrid = preGrid as number[][];
      this.pathfindingManager.updateGrid(this.pathfindingGrid);
      return;
    }

    this.pathfindingGrid = Array(gridHeight)
      .fill(0)
      .map(() => Array(gridWidth).fill(0));
    const mapData = this.cache.json.get(
      `${this.registry.get("currentMap")}_data`,
    );
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const tileSymbol = this.mapLoader.getTileAt(x, y, this.currentLevel);
        const tileDef =
          mapData.tileDefinitions[tileSymbol || ""] ||
          mapData.entityTemplates[tileSymbol || ""];
        if (
          tileSymbol === "..." ||
          (tileDef && (tileDef.block || tileDef.type === "wall"))
        ) {
          this.pathfindingGrid[y][x] = 1;
        } else {
          this.pathfindingGrid[y][x] = 0;
        }
      }
    }
    if (wallsLayer && wallsLayer.getChildren) {
      wallsLayer.getChildren().forEach((wall: any) => {
        const gridX = Math.floor(wall.x / tileSize);
        const gridY = Math.floor(wall.y / tileSize);
        if (
          gridY >= 0 &&
          gridY < gridHeight &&
          gridX >= 0 &&
          gridX < gridWidth
        ) {
          this.pathfindingGrid[gridY][gridX] = 1;
        }
      });
    }

    this.pathfindingManager.updateGrid(this.pathfindingGrid);
    this.isPathfindingReady = true;
  }

  public async updatePathfindingGrid(): Promise<void> {
    const wallsLayer = this.mapLoader.getWallsLayer();
    if (!wallsLayer) {
      this.isPathfindingReady = false;
      return;
    }
    const mapData = this.cache.json.get(
      `${this.registry.get("currentMap")}_${this.currentLevel}`,
    );
    if (mapData) {
      await this.setupPathfindingGrid(
        wallsLayer,
        mapData.mapWidth,
        mapData.mapHeight,
        this.mapLoader.getTileSize(),
      );
    } else {
      this.isPathfindingReady = false;
    }
  }

  private setupCamera(mapWidth: number, mapHeight: number): void {
    if (!this.player) return;
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.setZoom(0.45);
  }

  update(time: number, delta: number): void {
    if (!this.isInitialized) return;

    this.perf.startTime = performance.now();

    if (this.levelRenderer) {
      this.levelRenderer.updatePerspective(delta);
    }

    const diag = PlayerState.getInstance().getDiagnosticSettings();

    // Update PlayerState (Hunger, Regen, etc)
    if (
      this.player &&
      this.player.sprite &&
      this.player.sprite.active &&
      diag.enablePlayerState
    ) {
      PlayerState.getInstance().update(time, delta);
    }

    // Update Rune Targeting Visuals
    this.updateTargetingOverlay();

    // Update input (check for clicks/keys)
    if (
      !this.player?.sprite?.body ||
      !this.battleSystem ||
      this.isTransitioning
    )
      return;
    if (PlayerState.getInstance().getHealth() <= 0) {
      this.handlePlayerDeath();
      return;
    }

    // Loot 2.0 Logic
    const keyE = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    if (keyE && Phaser.Input.Keyboard.JustDown(keyE)) {
      this.pickupNearbyItem();
    }

    if (time % 200 < delta * 2) {
      const items = this.getNearbyItems();
      const simpleItems = items.map((i) => ({
        uid: i.uid,
        itemId: i.itemId,
        name: i.itemId,
        x: i.x,
        y: i.y,
      }));
      PlayerState.getInstance().emit("nearbyLoot", simpleItems);
    }

    if (this.player) {
      const playerState = PlayerState.getInstance();
      playerState.recordPlayerPosition(
        this.currentLevel,
        this.player.sprite.x,
        this.player.sprite.y,
      );
      const tileSize = this.mapLoader.getTileSize();
      const gridX = Math.floor(this.player.sprite.x / tileSize);
      const gridY = Math.floor(this.player.sprite.y / tileSize);
      const mapData = this.cache.json.get(
        `${this.registry.get("currentMap")}_data`,
      );
      const mapHeight = mapData.height;
      const mapWidth = mapData.width;
      playerState.exploreArea(
        this.currentLevel,
        gridX,
        gridY,
        8,
        mapWidth,
        mapHeight,
      );

      // Auto-Close Container Check
      // Auto-Close Container Check (Iterate ALL open windows)
      const openWindows = playerState.getOpenWindows(); // Get reference to map
      const pX = this.player.sprite.x;
      const pY = this.player.sprite.y;

      // Iterate via keys
      Object.keys(openWindows).forEach((id) => {
        const win = openWindows[id];
        if (!win) return; // Safety check
        if (win.type === "container" && win.worldPos) {
          const targetX = win.worldPos.x;
          const targetY = win.worldPos.y;
          const targetLevel = win.worldPos.level;

          if (targetLevel === this.currentLevel) {
            const dist = Phaser.Math.Distance.Between(pX, pY, targetX, targetY);
            // 180px ~ 1.5 tiles hysteresis? Or 250?
            // User complained "veja como funciona a logica de containers"
            // Standard Tibia is usually 1-2 tiles.
            if (dist > 200) {
              console.log(
                `[GameScene] Auto-Closing Container ${id} (Dist: ${dist})`,
              );
              playerState.closeContainer();
              // Wait, closeContainer() only closes 'current'.
              // We need closeContainerById(id).
              // If PlayerState doesn't have it, we must mock it or fix PlayerState first?
              // If we call closeContainer(), it closes 'current'.
              // If multiple are open, this might be messy.
              // But usually only 1 is open.
              // Let's assume 1 is open for now and verify if we need a new method.
              // Actually, AltarWindow relies on event 'containerClosed' with ID.
              // If we close 'current', it emits 'current'.
              // If 'id' IS 'current', we are good.
              if (playerState.currentOpenedContainerId === id) {
                playerState.closeContainer();
              } else {
                // Force close specific via internal emit?
                // Ideally add closeWindow(id).
                // Hack: delete from map and emit.
                // But standard way is best.
                // Let's rely on current for now.
              }
            }
          } else {
            // Different level? Close immediately.
            if (playerState.currentOpenedContainerId === id) {
              playerState.closeContainer();
            }
          }
        }
      });
    }

    this.pickupZone.setPosition(this.player.sprite.x, this.player.sprite.y);
    const hideItems = diag.hideItems;
    this.droppedItemsGroup.getChildren().forEach((item: any) => {
      if (item.active) {
        item.setVisible(!hideItems);
        if (!hideItems && diag.enableItemDepth && !item.isBeingDragged) {
          item.updateDepth();
        }
      }
    });

    // Drag Validation (Tibia-like: cancel if walk away)
    if (
      !PlayerState.getInstance().validateDragDistance(
        this.player.sprite.x,
        this.player.sprite.y,
        this.currentLevel,
      )
    ) {
      PlayerState.getInstance().cancelGroundDrag();
    }

    // Update Dynamic Floor Rendering
    const mapStart = performance.now();
    if (diag.enableMapUpdate) {
      this.levelRenderer.update(this.player.sprite.x, this.player.sprite.y);

      // SYNC ENTITIES TO PERSPECTIVE CONTAINERS
      if (this.player?.sprite) {
        // Shadow FIRST, then Sprite (Last is on top)
        if ((this.player as any).shadow) {
          this.levelRenderer.syncEntityToContainer(
            (this.player as any).shadow,
            this.currentLevel,
          );
        }
        this.levelRenderer.syncEntityToContainer(
          this.player.sprite,
          this.currentLevel,
        );
      }
    }
    this.perf.mapTime = performance.now() - mapStart;

    if (diag.enableClouds) {
      this.levelRenderer.updateClouds(time, delta);
    }

    const physicsStart = performance.now();
    const walls = this.mapLoader.getWallsLayer();
    if (walls && diag.enablePhysics)
      this.physics.world.collide(this.player.sprite, walls);
    this.perf.physicsTime = performance.now() - physicsStart;

    if (!this.isUiDragging) {
      this.player.update(this.cursors);
    } else {
      // Ensure player stays stopped while dragging
      this.player.sprite.setVelocity(0);
      // Optional: Force Idle animation
      if (
        this.player.sprite.anims.currentAnim &&
        this.player.sprite.anims.currentAnim.key.startsWith("player-walk")
      ) {
        this.player.sprite.anims.stop();
      }
    }
    this.inventorySystem.update();

    if (this.player?.sprite) {
      this.transitionSystem.checkTileTransition(
        this.player.sprite,
        this.mapLoader.getTileSize(),
      );
    }

    const enemyStart = performance.now();
    const activeEnemies = this.getActiveEnemies();
    const hideEnemies = diag.hideEnemies;

    activeEnemies.forEach((enemy) => {
      if (enemy.sprite && this.player) {
        enemy.sprite.setVisible(!hideEnemies);

        // Sync to container for perspective (Shadow FIRST)
        if (enemy.shadow) {
          this.levelRenderer.syncEntityToContainer(enemy.shadow, enemy.level);
        }
        this.levelRenderer.syncEntityToContainer(enemy.sprite, enemy.level);

        if (diag.enableAI && !hideEnemies) {
          enemy.update(this.player);
        }
      }
    });

    // SYNC DROPPED ITEMS
    this.droppedItemsGroup.getChildren().forEach((child: any) => {
      if (child.active) {
        this.levelRenderer.syncEntityToContainer(
          child,
          (child as any).level || this.currentLevel,
        );
      }
    });

    this.perf.enemyTime = performance.now() - enemyStart;
    this.perf.activeEnemies = activeEnemies.length;

    if (
      this.selectedEnemy &&
      (this.selectedEnemy.isDefeated() ||
        this.selectedEnemy.level !== this.currentLevel)
    ) {
      this.clearAllSelection();
    }

    if (
      this.selectedEnemy &&
      !this.selectedEnemy.isDefeated() &&
      this.selectedEnemy.level === this.currentLevel &&
      diag.enableAI
    ) {
      if (this.player.canAttack(this.selectedEnemy)) {
        this.battleSystem.startBattle(this.player, this.selectedEnemy);
        this.player.setLastAttackTime(Date.now());
      }
    }

    this.updateRespawns(delta);

    // Apply Lighting LAST to overwrite renderer/enemy resets
    if (diag.enableLighting) {
      this.updateDarkness(time, delta);
    } else {
      // Clear tints if disabled
      if (this.levelRenderer) (this.levelRenderer as any).resetLighting?.();
      this.enemiesByLevel.forEach((list) =>
        list.forEach((e) => e.sprite?.clearTint()),
      );
      this.droppedItemsGroup
        .getChildren()
        .forEach((item: any) => item.clearTint());
    }

    this.perf.totalUpdateTime = performance.now() - this.perf.startTime;
    const dna = this.levelRenderer.getDNAAnalysis();
    this.perf.culprits = dna.culprits;
    this.perf.types = dna.types;
    this.perf.poolSize = dna.poolSize;
    this.perf.totalObjects = this.children.length;
    PlayerState.getInstance().updatePerfMetrics(this.perf);
  }

  private updateEnemies(): number {
    let tickingCount = 0;
    this.enemiesByLevel.forEach((levelEnemies, lvl) => {
      const newLevelEnemies = levelEnemies.filter((enemy) => {
        // FIX: Detect "Zombie" state
        if (enemy.health > 0 && enemy.sprite && !enemy.sprite.active) {
          if (!enemy.sprite.scene) {
            console.warn(
              `[LIFECYCLE:UPDATE] 🧟 Found Destroyed Zombie ${enemy.id}. Removing.`,
            );
            return false;
          }

          // Sprite is just inactive but valid. Revive it.
          console.warn(
            `[LIFECYCLE:UPDATE] 🧟 Found Zombie Enemy ${enemy.id} (HP=${enemy.health}, Active=false). Reviving!`,
          );
          enemy.sprite.setActive(true);
          enemy.sprite.setVisible(true);
          if (enemy.sprite.body) enemy.sprite.body.enable = true;
        }

        if (enemy.isDefeated()) {
          console.warn(
            `[LIFECYCLE:UPDATE] Defeat detected for ${enemy.id}. HP=${enemy.health}, Active=${enemy.sprite.active}`,
          );
          this.handleEnemyDeath(enemy);
          return false;
        }
        const levelNum = parseInt(lvl);
        const currentNum = parseInt(this.currentLevel);
        const diff = levelNum - currentNum;

        // --- OPTIMIZATION: PROXIMITY CULLING ---
        // Only update AI for enemies on current level and within distance
        // Distant enemies or enemies on other floors stay static.
        const distToPlayer = Phaser.Math.Distance.Between(
          enemy.sprite.x,
          enemy.sprite.y,
          this.player!.sprite.x,
          this.player!.sprite.y,
        );

        if (diff !== 0 || distToPlayer > 1400) {
          // Far away or different floor?
          if (enemy.sprite.body) enemy.sprite.setVelocity(0, 0);

          // Still handle visibility for multi-floor rendering
          let visible = false;
          if (diff < 0) {
            const gridX = Math.floor(
              enemy.sprite.x / this.mapLoader.getTileSize(),
            );
            const gridY = Math.floor(
              enemy.sprite.y / this.mapLoader.getTileSize(),
            );
            visible = this.isPositionVisibleFromAbove(
              currentNum,
              levelNum,
              gridX,
              gridY,
            );
          } else if (diff === 0) {
            visible = true; // In range for update distance, but viewport cull handled by Phaser
          }

          enemy.sprite.setVisible(visible);
          return true;
        }

        tickingCount++;
        const gridX = Math.floor(enemy.sprite.x / this.mapLoader.getTileSize());
        const gridY = Math.floor(enemy.sprite.y / this.mapLoader.getTileSize());
        let visible = false;

        if (diff === 0) {
          visible = true;
          enemy.sprite.setTint(0xffffff);
          enemy.sprite.setAlpha(1);
          if (this.player && this.isPathfindingReady) {
            enemy.update(this.player);
          }
        } else if (diff < 0) {
          // Player is above enemy
          // FIX: Ensure enemy stops moving if it's no longer updated
          if (enemy.sprite.body) enemy.sprite.setVelocity(0, 0);

          visible = this.isPositionVisibleFromAbove(
            currentNum,
            levelNum,
            gridX,
            gridY,
          );
          if (visible) {
            enemy.sprite.setTint(0x666666);
            enemy.sprite.setAlpha(0.8);
          }
        } else {
          // Player is below enemy or far away
          // FIX: Ensure enemy stops moving
          if (enemy.sprite.body) enemy.sprite.setVelocity(0, 0);

          const isCurrentTileTransparent = this.mapLoader.isPositionTransparent(
            this.currentLevel,
            gridX,
            gridY,
          );
          const mapData = this.cache.json.get(
            `${this.registry.get("currentMap")}_data`,
          );
          const upperTile = this.mapLoader.getTileAt(gridX, gridY, lvl);
          const isUpperTileTransparent =
            upperTile === "..." ||
            mapData.tileDefinitions[upperTile || ""]?.under === "...";
          const isUpperTileRendered = this.isTileRenderedInLevel(
            lvl,
            gridX,
            gridY,
          );
          visible =
            isCurrentTileTransparent &&
            (isUpperTileRendered || isUpperTileTransparent);

          if (visible) {
            enemy.sprite.setTint(0xaaaaaa);
            enemy.sprite.setAlpha(0.7);
          }
        }
        enemy.sprite.setVisible(visible);
        enemy.sprite.setDepth(diff * 100 + 50);
        return true;
      });
      this.enemiesByLevel.set(lvl, newLevelEnemies);
    });
    return tickingCount;
  }

  // Fall Safety System
  public checkPlayerVoidMove(
    pixelX: number,
    pixelY: number,
    dir: { x: number; y: number },
  ): boolean {
    const tileSize = this.mapLoader.getTileSize();
    const currentTileX = Math.floor(pixelX / tileSize);
    const currentTileY = Math.floor(pixelY / tileSize);

    const targetTileX = currentTileX + dir.x;
    const targetTileY = currentTileY + dir.y;

    // DEBUG: Trace movement and tile detection
    console.log(
      `[FallSafety] Pos: (${currentTileX},${currentTileY}) -> Target: (${targetTileX},${targetTileY}) Dir: ${dir.x},${dir.y}`,
    );

    const symbol = this.mapLoader.getTileAt(
      targetTileX,
      targetTileY,
      this.currentLevel,
    );

    // We treat "..." or empty as void.
    const isVoid = !symbol || symbol === "...";

    if (isVoid) {
      const state = PlayerState.getInstance();
      if (state.isFallSafetyEnabled()) {
        // DEBOUNCE: Prevent spamming safety message
        const now = Date.now();
        const lastMsg = (this as any)._lastSafetyMsgTime || 0;
        if (now - lastMsg > 2000) {
          // Check if there is a wall on the CURRENT level blocking this move
          // if there is a wall, we don't show the safety message (as it's annoying)
          // but we ALWAYS return true to prevent "flying" into void.
          const wallInWay = this.physics.world.staticBodies
            .getArray()
            .some((body) => {
              if (!body.enable || !body.gameObject?.active) return false;
              // Ensure the wall is on the same level
              if (
                body.gameObject.name &&
                !body.gameObject.name.startsWith(this.currentLevel + "_")
              )
                return false;

              const b = body as Phaser.Physics.Arcade.StaticBody;
              const targetRect = new Phaser.Geom.Rectangle(
                targetTileX * tileSize,
                targetTileY * tileSize,
                tileSize,
                tileSize,
              );
              const bodyRect = new Phaser.Geom.Rectangle(
                b.x,
                b.y,
                b.width,
                b.height,
              );
              return Phaser.Geom.Intersects.RectangleToRectangle(
                targetRect,
                bodyRect,
              );
            });

          if (!wallInWay) {
            this.showFloatingText(
              pixelX,
              pixelY - 80,
              t_game("fall_safety_active") || "Safety active!",
              "#00ff00",
            );
            (this as any)._lastSafetyMsgTime = now;
          }
        }
        return true; // Block move!
      } else {
        this.handlePlayerFall(dir, targetTileX, targetTileY, this.currentLevel);
        return true; // Block standard movement to take control
      }
    }
    return false;
  }

  private updateRespawns(delta: number): void {
    if (!this.player) return;
    const tileSize = this.mapLoader.getTileSize();

    // Process dead enemies from last to first (safe for splice)
    for (let i = this.deadEnemies.length - 1; i >= 0; i--) {
      const dead = this.deadEnemies[i];

      // Calculate distance between player and spawn point
      const dist = Phaser.Math.Distance.Between(
        this.player.sprite.x,
        this.player.sprite.y,
        dead.x,
        dead.y,
      );

      const distInTiles = dist / tileSize;

      // Rule (v2.62): Respawn timer ONLY counts if far away (> 32 tiles) or on different level
      const sameLevel = dead.level === this.currentLevel;
      const isFarEnough = !sameLevel || distInTiles > 32;

      if (isFarEnough) {
        dead.elapsed += delta;
        if (dead.elapsed >= dead.respawnTime) {
          this.respawnEnemy(dead);
          this.deadEnemies.splice(i, 1);
        }
      }
    }
  }

  private respawnEnemy(dead: DeadEnemy): void {
    if (!this.player) return;

    let enemyData: any = null;
    // Removed unused 'type' variable
    let overrides = undefined;

    // 1. Check if it's an External Enemy (from enemies.json)
    if (dead.id.startsWith("ext_")) {
      // Try to find in cache
      const externalArgs = this.cache.json.get("enemies_data");
      const currentMap = this.registry.get("currentMap") || "newmap";
      if (externalArgs && externalArgs[currentMap]) {
        // Find matching definition
        // Note: external ID is built as `ext_${level}_${x}_${y}`
        // We can reconstruct it or search. Since dead.id IS the unique ID, we search by location/type roughly?
        // No, we passed 'overrides' to constructor, but we didn't store them in DeadEnemy.
        // Ideally we find the original JSON entry.
        // Optimization: We can parse x,y from dead.id or use dead.x/y (which are spawn pos now).
        // Let's search the list for a match.
        const list = externalArgs[currentMap];
        enemyData = list.find((e: any) => {
          const genId = `ext_${e.level || "0"}_${e.x}_${e.y}`;
          return genId === dead.id;
        });

        if (enemyData) {
          overrides = enemyData.overrides;
          // Ensure coordinates match exactly (they should)
        }
      }
    } else {
      // 2. Fallback to Map Loader (Legacy)
      const enemies = this.mapLoader.getEnemiesForLevel(dead.level);
      enemyData = enemies.find(
        (e) => `${dead.level}_${e.x}_${e.y}` === dead.id,
      );
    }

    // Safety: If no definition found (e.g. data mismatch), use DeadEnemy data as fallback
    // This loses overrides but respawns the base enemy.
    const spawnX = enemyData ? enemyData.x : dead.x;
    const spawnY = enemyData ? enemyData.y : dead.y;

    if (!enemyData) {
      console.warn(
        `[Respawn] Definition missing for ${dead.id}. Using fallback data.`,
      );
    }

    const enemy = new Enemy(this, spawnX, spawnY, dead.type, overrides);
    enemy.level = dead.level;
    enemy.id = dead.id;
    enemy.respawnTime = dead.respawnTime;
    enemy.sprite.setVisible(false);

    const levelEnemies = this.enemiesByLevel.get(dead.level) || [];
    levelEnemies.push(enemy);
    this.enemiesByLevel.set(dead.level, levelEnemies);

    if (dead.level === this.currentLevel) {
      const wallsLayer = this.mapLoader.getWallsLayer();
      if (wallsLayer) {
        this.physics.add.collider(enemy.sprite, wallsLayer);

        // FIX: Always collide with player (removed stopDistance check)
        if (this.player) {
          this.physics.add.collider(this.player.sprite, enemy.sprite);
        }

        // FIX: Collide with other existing enemies to prevent stacking
        // We filter out the new enemy itself just in case
        const levelEnemies = this.enemiesByLevel.get(dead.level) || [];
        const otherSprites = levelEnemies
          .filter((e) => e !== enemy && e.sprite && e.sprite.active)
          .map((e) => e.sprite);

        if (otherSprites.length > 0) {
          this.physics.add.collider(enemy.sprite, otherSprites);
        }
      }
    }
    enemy.sprite.setAlpha(0);
    this.tweens.add({ targets: enemy.sprite, alpha: 1, duration: 500 });
  }

  public destroyAllEnemies(): void {
    this.enemiesByLevel.forEach((enemies, level) => {
      enemies.forEach((enemy) => {
        if (enemy.hud) {
          enemy.hud.destroy();
          enemy.hud = null;
        }
        enemy.sprite.destroy();
      });
      this.enemiesByLevel.set(level, []);
    });
    this.deadEnemies = [];
  }

  private isPositionVisibleFromAbove(
    currentNum: number,
    levelNum: number,
    gridX: number,
    gridY: number,
  ): boolean {
    for (let lvl = currentNum; lvl > levelNum; lvl--) {
      if (!this.mapLoader.isPositionTransparent(lvl.toString(), gridX, gridY))
        return false;
    }
    return true;
  }

  private isTileRenderedInLevel(
    level: string,
    gridX: number,
    gridY: number,
  ): boolean {
    const tileKey = `${level}_${gridX}_${gridY}_upper`;
    const tiles = this.levelRenderer.getRenderedTiles(level);
    return tiles.some(
      (tile: Phaser.GameObjects.Sprite) => tile.name === tileKey,
    );
  }

  shutdown(): void {
    console.log("🛑 GameScene Shutdown - Cleaning up Listeners");
    const ps = PlayerState.getInstance();

    // Core Listeners
    ps.off("startGroundDrag", this.onStartGroundDrag);
    ps.off("endGroundDrag", this.onEndGroundDrag);
    ps.off("uiDragStart", this.onUiDragStart);
    ps.off("uiDragEnd", this.onUiDragEnd);
    ps.off("prepareRuneCast", this.onPrepareRuneCast);
    ps.off("spawnDroppedItem", this.onSpawnDroppedItem);

    // Refactored Listeners
    ps.off("message", this.onMessage);
    ps.off("willpowerTierUp", this.onWillpowerTierUp);
    ps.off("dropContainerItem", this.onDropContainerItem);
    ps.off("dropItem", this.onDropItem);
    ps.off("requestPickup", this.onRequestPickup);
    ps.off("torchToggled", this.onTorchToggled);
    ps.off("performContextAction", this.onPerformContextAction);

    if (this.inventorySystem) this.inventorySystem.destroy();
    if (this.autoSaveSystem) this.autoSaveSystem.destroy();
    try {
      if (this.droppedItemsGroup) {
        this.droppedItemsGroup
          .getChildren()
          .forEach((child) => child.destroy());
        this.droppedItemsGroup.destroy();
      }
      if (this.pickupZone) this.pickupZone.destroy();
      if (this.battleSystem) this.battleSystem.cleanup();
      if (this.mapLoader) this.mapLoader.destroy();
      if (this.levelRenderer) this.levelRenderer.destroy();

      // Metadata doesn't need destruction, only clearing
      this.enemiesByLevel.clear();
      this.decorationsByLevel.clear();
      this.deadEnemies = [];

      if (this.player) {
        this.player.sprite?.destroy();
        this.player = null;
      }
      this.registry.remove("player");
      this.registry.remove("playerInitialized");
      this.input.off("pointerdown");
      this.scale.off("resize", this.handleResize);
      this.input.keyboard?.off("keydown-S");
      this.input.keyboard?.off("keydown-L");
      this.isPathfindingReady = false;
    } catch (e) {
      console.error("Error on shutdown:", e);
    }
  }

  private handleLeftClick(pointer: Phaser.Input.Pointer): void {
    if (PlayerState.getInstance().getInputBlocked()) return;
    if (!this.player) return;

    // If Targeting Mode
    if (this.cursorMode === "target" && this.targetRuneId) {
      this.castRuneAt(pointer);
      return;
    }

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    if (!this.isInitialized) return;

    this.enemySelectionIndicator.setTarget(null);
    this.selectedEnemy = null;
    let clickedEnemy: Enemy | null = null;

    this.levelRenderer.activeEnemies.forEach((enemy: any) => {
      if (
        !enemy.isDefeated() &&
        enemy.sprite &&
        enemy.sprite.active &&
        enemy.sprite.getBounds().contains(worldPoint.x, worldPoint.y)
      ) {
        clickedEnemy = enemy;
      }
    });

    if (clickedEnemy) {
      this.selectedEnemy = clickedEnemy;
      this.enemySelectionIndicator.setTarget(clickedEnemy);
      const color = this.getEnemyColor(clickedEnemy);
      this.enemySelectionIndicator.setColor(color);
    }
  }

  private getEnemyColor(enemy: Enemy): number {
    switch (enemy.enemyType) {
      case "boss":
        return 0xff0000;
      case "elite":
        return 0xff9900;
      default:
        return 0xffff00;
    }
  }

  // --- MAGIC CASTING ---
  private castRuneAt(pointer: Phaser.Input.Pointer) {
    if (!this.player || !this.targetRuneId) return;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const x = worldPoint.x;
    const y = worldPoint.y;

    // FIRST: Check if clicking on an enemy (for single-target or AoE)
    let targetEnemy: Enemy | null = null;

    this.levelRenderer.activeEnemies.forEach((enemy: any) => {
      if (!enemy.sprite || !enemy.sprite.active || enemy.isDefeated()) return;
      const bounds = enemy.sprite.getBounds();
      if (bounds.contains(x, y)) {
        targetEnemy = enemy;
      }
    });

    if (targetEnemy) {
      // Enemy-targeted: Use enemy position for AoE
      const ps = PlayerState.getInstance();
      const rune = ps
        .getEnchantedRunes()
        .find((r) => r.runeId === this.targetRuneId);

      if (rune && rune.count > 0) {
        // Check Memory Overload
        const currentMem = ps.getCurrentMemoryUsage();
        const maxMem = ps.getMemoryCapacity();
        if (currentMem > maxMem) {
          ps.emit("uiNotification", {
            type: "error",
            message: "Memory Overload! Runes inactive.",
          });
          return;
        }

        // Check Rune Cooldown - if on cooldown, just don't cast but keep targeting
        if (!ps.isRuneOnCooldown()) {
          // Consume charge FIRST
          if (ps.consumeRuneCharge(this.targetRuneId)) {
            // Use BattleSystem to cast rune at enemy position (includes XP, damage calc, validation, etc.)
            this.battleSystem.castRuneEffect(
              this.targetRuneId,
              (targetEnemy as Enemy).sprite.x,
              (targetEnemy as Enemy).sprite.y,
            );
            // Start cooldown and emit event to trigger UI cooldown bar
            ps.startRuneCooldown();
            ps.emit("runeCasted");
            // DON'T reset cursor mode - keep rune selected for continuous casting
          } else {
            ps.emit("uiNotification", {
              type: "error",
              message: "No charges left.",
            });
          }
        }
        // If on cooldown, do nothing - just keep targeting mode active
        return;
      }
    }

    // FALLBACK: Ground-targeted rune cast (original logic)
    // Block ground targeting for single-target runes (e.g. Star Rune)
    const { RuneRegistry } = require("../magic/RuneRegistry");
    const runeDef = RuneRegistry.getRune(this.targetRuneId);
    if (runeDef && runeDef.singleTargetOnly) {
      PlayerState.getInstance().emit(
        "message",
        t_game("msg_star_rune_no_target" as any) ||
          "This rune requires a target!",
      );
      return; // Keep targeting mode active so player can click an enemy
    }

    // Calculate tile coords
    const tileSize = this.mapLoader.getTileSize();
    const gridX = Math.floor(x / tileSize);
    const gridY = Math.floor(y / tileSize);

    // Validate Range / LOS
    // "selecting a target location on the ground"
    // Verify transparency/walls for LOS
    // We use player Grid Coords
    const pGridX = Math.floor(this.player.sprite.x / tileSize);
    const pGridY = Math.floor(this.player.sprite.y / tileSize);

    if (!this.hasLineOfSight(pGridX, pGridY, gridX, gridY)) {
      PlayerState.getInstance().emit("message", t_game("msg_blocked"));
      return; // Allow retry
    }

    const ps = PlayerState.getInstance();

    // Check Memory again (redundant but safe)
    const currentMem = ps.getCurrentMemoryUsage();
    const maxMem = ps.getMemoryCapacity();
    if (currentMem > maxMem) {
      ps.emit("uiNotification", {
        type: "error",
        message: "Memory Overload! Runes inactive.",
      });
      this.resetCursorMode();
      return;
    }

    // Check Rune Cooldown for ground targeting too
    if (ps.isRuneOnCooldown()) {
      const remaining = Math.ceil(ps.getRemainingCooldown() / 1000);
      ps.emit("uiNotification", {
        type: "error",
        message: `Rune on cooldown! Wait ${remaining}s`,
      });
      return;
    }

    if (ps.consumeRuneCharge(this.targetRuneId)) {
      // Execute visual and effect
      this.battleSystem.castRuneEffect(this.targetRuneId, x, y);

      // Start cooldown and emit event
      ps.startRuneCooldown();
      ps.emit("runeCasted");

      // DON'T reset cursor mode - keep rune selected for continuous casting
    } else {
      ps.emit("uiNotification", { type: "error", message: "No charges left." });
      // DON'T reset cursor mode - allow manual cancel or rune change
    }
  }

  private resetCursorMode() {
    this.cursorMode = "default";
    this.targetRuneId = null;
    this.input.setDefaultCursor("default");
  }

  private clearSelection(): void {
    if (this.selectionGraphics) {
      this.selectionGraphics.destroy();
      this.selectionGraphics = null;
    }
  }

  public clearAllSelection(): void {
    this.clearSelection();
    this.selectedEnemy = null;
  }

  public setCurrentLevel(level: string): void {
    this.currentLevel = level;
    this.registry.set("currentLevel", level);

    // 1. Sync State
    const playerState = PlayerState.getInstance();
    playerState.setCurrentLevel(level);

    // 2. Clear Visual Layout
    this.levelRenderer.setCurrentLevel(level);
    this.clearAllSelection();

    // 3. Clear OLD Item Sprites (Prevention of Transition Duplication)
    if (this.droppedItemsGroup) {
      this.droppedItemsGroup.clear(true, true);
    }

    // 4. Seed Map Items (If first visit to this specific floor)
    // This ensures items exist in persistence before we try to load them below.
    if (!playerState.hasVisitedLevel(level)) {
      console.log(
        `[LEVEL:TRANSITION] First visit to Level ${level}. seeding Map Items.`,
      );
      this.mapLoader.seedMapItemsToPersistence(
        this.registry.get("currentMap") || "newmap",
        level,
      );
      playerState.markLevelVisited(level);
    }

    // 5. Heavy Rebuilds (Synchronous again to avoid freezes)
    const targetX = this.player?.sprite.x || 4096;
    const targetY = this.player?.sprite.y || 4096;
    this.updateLevelCollisions(targetX, targetY, 32);
    this.updatePathfindingGrid();

    // 6. Visuals
    // Decorations are stored as metadata and rendered lazily by LevelRenderer.
    // Visibility is controlled by `levelRenderer.setCurrentLevel(level)` above.

    // 7. Load Items
    this.loadPersistentItems();
  }

  private applyAutoSaveData(autoSaveData: any): void {
    if (!autoSaveData) return;
    if (autoSaveData.playerState) {
      PlayerState.getInstance().loadState(
        autoSaveData.playerState,
        autoSaveData.timestamp,
      );
    }

    if (autoSaveData.playerPos && this.player) {
      this.player.setPosition(
        autoSaveData.playerPos.x,
        autoSaveData.playerPos.y,
      );
    }
    if (autoSaveData.currentLevel) {
      this.currentLevel = autoSaveData.currentLevel;
      this.registry.set("currentLevel", this.currentLevel);
      PlayerState.getInstance().setCurrentLevel(this.currentLevel);
    }
    if (autoSaveData.map) this.registry.set("currentMap", autoSaveData.map);
    if (autoSaveData.deadEnemies) this.deadEnemies = autoSaveData.deadEnemies;

    const playerState = PlayerState.getInstance();
    if (autoSaveData.persistentItems) {
      autoSaveData.persistentItems.forEach((item: any) => {
        playerState.addPersistentDroppedItem(item.level, {
          itemId: item.itemId,
          weaponId: item.weaponId,
          x: item.x,
          y: item.y,
        });
      });
    }
  }

  public handleEnemyDeath(enemy: Enemy): void {
    console.warn(
      `[LIFECYCLE:DEATH] Handling death for ${enemy.id}. AlreadyDeadList=${this.deadEnemies.some((d) => d.id === enemy.id)}`,
    );
    // FIX: Check if enemy is already in deadEnemies (restored from save/respawn)
    // If so, it means it was already processed, so we skip adding it again and skip loot.
    const alreadyDead = this.deadEnemies.some((d) => d.id === enemy.id);
    if (alreadyDead) {
      console.warn(`[LIFECYCLE:DEATH] Skipping ${enemy.id} (Always Dead).`);
      return;
    }

    console.log(`Processing NEW death for ${enemy.id}. Dropping loot.`);

    // Notify Quest Manager
    QuestManager.getInstance().onEnemyKilled(enemy.enemyType);

    // Capture dead enemy for respawn logic
    this.deadEnemies.push({
      id: enemy.id,
      type: enemy.enemyType,
      x: enemy.spawnPosition.x,
      y: enemy.spawnPosition.y,
      level: enemy.level,
      respawnTime: enemy.respawnTime,
      elapsed: 0,
    });

    const loot = enemy.generateLoot();
    console.log(
      `[LIFECYCLE:DEATH] Enemy ${enemy.id} generated ${loot.length} loot items.`,
    );

    loot.forEach((itemDef) => {
      this.spawnDroppedItem(
        itemDef.itemId,
        enemy.sprite.x,
        enemy.sprite.y,
        undefined, // uid
        enemy.level,
        undefined, // createdAt
        itemDef.count,
        itemDef.stars,
        itemDef.attributes,
      );
    });
  }

  // Fall Safety System
  private async handlePlayerFall(
    dir: { x: number; y: number },
    startX: number,
    startY: number,
    startLevel: string,
  ) {
    if (!this.player || this.player.isFalling) return;
    this.player.isFalling = true;

    let floorsFallen = 0;
    let currentLevelIdx = parseInt(startLevel);
    let currentX = startX;
    let currentY = startY;

    // Momentum Fix: Apply displacement ONLY once at the start of the fall
    if (dir.x > 0)
      currentX += 1; // Fall Right
    else if (dir.x < 0)
      currentX -= 0; // Fall Left (stays at same X as void tile)
    else if (dir.y > 0) currentY += 1; // Fall Down (Y increases)

    // Visual Polish: Fade out
    this.cameras.main.fadeOut(150, 0, 0, 0);

    // Fall Loop
    while (true) {
      const nextLevelIdx = currentLevelIdx - 1;
      if (nextLevelIdx < 0) break;

      floorsFallen++;
      currentLevelIdx = nextLevelIdx;

      const tile = this.mapLoader.getTileAt(
        currentX,
        currentY,
        currentLevelIdx.toString(),
      );

      // If we hit solid ground, stop falling
      if (tile !== "...") {
        break;
      }

      if (floorsFallen > 10) break;
    }

    let damagePercent = 0;
    if (floorsFallen === 1) damagePercent = 0.1;
    else if (floorsFallen === 2) damagePercent = 0.3;
    else if (floorsFallen === 3) damagePercent = 0.7;
    else damagePercent = 1.0;

    const playerState = PlayerState.getInstance();
    const damage = Math.floor(playerState.getMaxHealth() * damagePercent);

    // Visual Sync: Use setCurrentLevel to notify all systems
    const newLevelStr = currentLevelIdx.toString();
    await this.mapLoader.setActiveLevel(newLevelStr);
    this.setCurrentLevel(newLevelStr);

    const tileSize = this.mapLoader.getTileSize();
    this.player.sprite.setPosition(
      currentX * tileSize + tileSize / 2,
      currentY * tileSize + tileSize / 2,
    );

    // Fade in and get up
    this.cameras.main.fadeIn(250);

    // Animation: Stand up (Reverse Death)
    this.player.sprite.playReverse("player-death");

    // Wait for animation or brief moment
    await new Promise((resolve) => this.time.delayedCall(1000, resolve));

    this.showFloatingText(
      this.player.sprite.x,
      this.player.sprite.y - 60,
      `FALL!`,
      "#ff0000",
    );
    this.showFloatingText(
      this.player.sprite.x,
      this.player.sprite.y - 40,
      `-${damage}`,
      "#ff0000",
    );
    playerState.takeDamage(damage);

    this.player.sprite.play("player-idle");
    this.player.isFalling = false;
  }

  private refreshTorchState() {
    const state = PlayerState.getInstance();
    const weapon = state.getEquippedWeapon();
    const shield = state.getEquippedShield();

    this.hasLitTorch =
      weapon?.id === "light_torch" || shield?.id === "light_torch";
    this.torchLightRadius = this.hasLitTorch ? 1200 : 0;

    if (this.fireParticles) {
      this.fireParticles.emitting = this.hasLitTorch;
    }
  }

  private updateDarkness(time: number, delta: number) {
    this.updateTargetingOverlay();

    if (!this.player) return;

    const level = parseInt(this.currentLevel);
    // Dark levels (Dungeon) check.
    const isDarkLevel = level < 0;

    this.refreshTorchState();

    // PART 1: Handle Light Sources (Particles)
    if (this.hasLitTorch) {
      this.fireParticles.emitting = true;
      this.fireParticles.setPosition(
        this.player.sprite.x,
        this.player.sprite.y - 20,
      );
    } else {
      if (this.fireParticles) this.fireParticles.emitting = false;
    }

    // PART 2: LIGHTING SYSTEM SWITCH
    // Disable Overlay System fully
    if (this.darkOverlay) this.darkOverlay.setVisible(false);
    if (this.lightGlowSprite) this.lightGlowSprite.setVisible(false);

    const renderer = this.levelRenderer; // Use class property directly
    const enemies = this.enemiesByLevel.get(this.currentLevel) || []; // Use active enemies list

    if (!isDarkLevel) {
      // Reset Lighting (Daylight)
      this.cameras.main.setBackgroundColor(0x000000);

      if (renderer && renderer.resetLighting) {
        renderer.resetLighting();
      }
      // Reset Enemies
      enemies.forEach((enemy: any) => {
        if (enemy.sprite) enemy.sprite.clearTint();
      });
      return;
    }

    // DARKNESS ENABLED
    this.cameras.main.setBackgroundColor(0x000000);

    // 1. Determine Light Radius
    let baseRadius = 250; // Increased base radius for tile visibility
    if (this.hasLitTorch) {
      const state = PlayerState.getInstance();
      const weapon = state.getEquippedWeapon();
      const shield = state.getEquippedShield();

      if (weapon && (weapon.id === "torch" || weapon.id === "light_torch")) {
        const def = WeaponRegistry.getWeaponDefinition(weapon.id);
        baseRadius = def?.lightRadius || 1350;
      } else if (
        shield &&
        (shield.id === "torch" || shield.id === "light_torch")
      ) {
        const def = WeaponRegistry.getWeaponDefinition(shield.id);
        baseRadius = def?.lightRadius || 1350;
      }
    }

    const flicker = Math.sin(time * 0.005) * (this.hasLitTorch ? 10 : 2);
    const finalRadiusWorld = baseRadius + flicker;

    const px = this.player.sprite.x;
    const py = this.player.sprite.y;

    // 2. Update Tile Lighting
    if (
      renderer &&
      renderer.updateLighting &&
      PlayerState.getInstance().getDiagnosticSettings().enableLighting
    ) {
      renderer.updateLighting(px, py, finalRadiusWorld);
    }

    // 3. Update Enemy Lighting
    const radiusSq = finalRadiusWorld * finalRadiusWorld;

    const updateEntityTint = (ent: {
      x: number;
      y: number;
      setTint: (c: number) => void;
    }) => {
      const dx = ent.x - px;
      const dy = ent.y - py;
      const distSq = dx * dx + dy * dy;

      if (distSq > radiusSq) {
        ent.setTint(0x000000);
      } else {
        const dist = Math.sqrt(distSq);
        const intensity = 1 - dist / finalRadiusWorld;
        // Smooth falloff
        const smoothIntensity = intensity * intensity * (3 - 2 * intensity);
        const val = Math.floor(smoothIntensity * 255);
        const color = Phaser.Display.Color.GetColor(val, val, val);
        ent.setTint(color);
      }
    };

    enemies.forEach((enemy: any) => {
      if (enemy.sprite) updateEntityTint(enemy.sprite);
    });

    // 4. Update Dropped Items Lighting
    if (this.droppedItemsGroup) {
      this.droppedItemsGroup.getChildren().forEach((item: any) => {
        // item is likely a DroppedItem (Physics Sprite)
        updateEntityTint(item);
      });
    }

    // Removed Debug Text
  }

  // --- RUNE TARGETING VISUALIZATION ---
  private updateTargetingOverlay() {
    if (!this.targetingGraphics) {
      this.targetingGraphics = this.add.graphics();
      this.targetingGraphics.setDepth(10000); // Topmost
    }

    this.targetingGraphics.clear();

    if (this.cursorMode !== "target" || !this.targetRuneId) return;

    const rune = RuneRegistry.getRune(this.targetRuneId);
    if (!rune) return;

    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    // Draw AoE
    // If Area > 0, draw circle/box
    const area = rune.damage.area || 0;

    if (area > 0) {
      this.targetingGraphics.fillStyle(0xff0000, 0.3);
      this.targetingGraphics.lineStyle(1, 0xff0000, 0.8);
      this.targetingGraphics.fillCircle(worldPoint.x, worldPoint.y, area);
      this.targetingGraphics.strokeCircle(worldPoint.x, worldPoint.y, area);
    }
  }

  private onWillpowerTierUp = (tier: number) => {
    // Placeholder for future effects
  };

  private onDropContainerItem = (data: any) => {
    const { containerId, itemUid, itemId, count } = data;
    if (this.player && this.player.sprite) {
      this.dropItemFromContainer(
        containerId,
        itemUid,
        itemId,
        count,
        this.player.sprite.x,
        this.player.sprite.y,
      );
    }
  };

  private onDropItem = (
    uid: string,
    count?: number,
    x?: number,
    y?: number,
  ) => {
    if (this.player && this.player.sprite.active) {
      this.dropItemFromInventory(
        uid,
        x ?? this.player.sprite.x,
        y ?? this.player.sprite.y,
        count,
      );
    }
  };

  private onRequestPickup = (data: any) => {
    const { uid, count } = data;
    if (this.droppedItemsGroup) {
      // Find item by UID
      const item = this.droppedItemsGroup
        .getChildren()
        .find((c: any) => c.itemId === uid) as DroppedItem;
      if (item) {
        if (this.player && this.player.sprite) {
          // Use original position if being dragged to avoid "Too Far" when dragging to HUD corner
          const targetX = (item as any).isBeingDragged
            ? item.originalPosition.x
            : item.x;
          const targetY = (item as any).isBeingDragged
            ? item.originalPosition.y
            : item.y;

          const dist = Phaser.Math.Distance.Between(
            this.player.sprite.x,
            this.player.sprite.y,
            targetX,
            targetY,
          );
          // Relaxed Range for Drag-Drop ease of use
          const range = (PlayerState.getInstance().pickupRange || 150) + 150;
          if (dist > range) {
            PlayerState.getInstance().emit("uiNotification", {
              type: "warning",
              message: t_game("msg_too_far"),
            });
            PlayerState.getInstance().emit("resetGroundDrag");
            return;
          }
        }
        this.pickupItem(item, count);
      } else {
        console.warn(`[GameScene] Pickup requested for missing item: ${uid}`);
      }
    }
  };

  private onTorchToggled = () => {
    this.refreshTorchState();

    // Sync Dropped Items Visuals
    if (this.droppedItemsGroup) {
      const pItems = PlayerState.getInstance().getPersistentDroppedItems(
        this.currentLevel,
      );
      this.droppedItemsGroup.getChildren().forEach((child: any) => {
        const item = child as DroppedItem;
        const persistent = pItems.find((p) => p.itemId === item.itemId);
        if (persistent && persistent.weaponId !== item.weaponId) {
          item.updateWeaponId(persistent.weaponId);
        }
      });
    }
  };

  private onPerformContextAction = (data: any) => {
    const { action, itemUid, count } = data;
    if (this.droppedItemsGroup) {
      const item = this.droppedItemsGroup
        .getChildren()
        .find((c: any) => c.itemId === itemUid) as DroppedItem;
      if (item) {
        if (action === "pickup") {
          this.pickupItem(item, count);
        } else if (action === "eat") {
          const def = WeaponRegistry.getWeaponDefinition(item.weaponId);
          if (def && def.consumable && def.type === "food") {
            const val = def.hungerValue || 0;
            if (PlayerState.getInstance().getHunger() + val > 2000) {
              PlayerState.getInstance().emit("uiNotification", {
                type: "warning",
                message: t_game("msg_hunger_full"),
              });
              return;
            }
            PlayerState.getInstance().eatFood(val);
            if (item.count > 1) {
              item.count--;
              const pItems =
                PlayerState.getInstance().getPersistentDroppedItems(
                  this.currentLevel,
                );
              const pItem = pItems.find((i) => i.itemId === item.itemId);
              if (pItem) pItem.count = item.count;
              const itemName = def ? t_game(`item_${def.id}` as any) : "Item";
              PlayerState.getInstance().emit("uiNotification", {
                type: "info",
                message: "Consumed 1x " + itemName,
              });
            } else {
              PlayerState.getInstance().removePersistentDroppedItem(
                this.currentLevel,
                item.itemId,
              );
              this.droppedItemsGroup.remove(item, true, true);
              PlayerState.getInstance().emit("hideGroundTooltip");
            }
          }
        }
      }
    }
  };
}
