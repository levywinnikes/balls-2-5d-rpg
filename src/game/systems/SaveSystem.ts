import Phaser from "phaser";
import { DeadEnemy, ActiveEnemyState } from "../scenes/GameScene";
import Player from "../entities/Player";
import { PlayerState } from "../entities/Player/PlayerState";
import { DroppedItem } from "../entities/DroppedItem";

// Declare global Electron API
declare global {
  interface Window {
    electronAPI?: {
      saveGame: (
        name: string,
        data: any,
      ) => Promise<{ success: boolean; path?: string; error?: string }>;
      loadGame: (
        name: string,
      ) => Promise<{ success: boolean; data?: GameSaveData; error?: string }>;
      listSaves: () => Promise<{
        success: boolean;
        files?: Array<{ name: string; path: string; stat: any }>;
      }>;
      deleteGame: (
        name: string,
      ) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

export interface GameSaveData {
  map: string;
  currentLevel: string;
  playerPos: { x: number; y: number };
  playerState: {
    characterName?: string;
    health: number;
    maxHealth: number;
    level: number;
    experience: number;
    attackDamage: number;
    skills?: {
      strength: { level: number; experience: number };
      dexterity: { level: number; experience: number };
      reflex: { level: number; experience: number };
      intelligence: { level: number; experience: number };
    };
    willpowerExp?: number;
    willpowerTarget?: number;
    hunger?: number; // Hunger (0-2000)
    playTime?: number;
    equippedWeaponId: string | null;
    equippedWeaponItem?: any; // InventoryItem
    equippedShieldId?: string | null;
    equippedShieldItem?: any;
    equippedHelmetId?: string | null;
    equippedHelmetItem?: any;
    equippedArmorId?: string | null;
    equippedArmorItem?: any;
    equippedLegsId?: string | null;
    equippedLegsItem?: any;
    equippedBootsId?: string | null;
    equippedBootsItem?: any;

    // New Slots
    equippedNeckId?: string | null;
    equippedNeckItem?: any;
    equippedRingId?: string | null;
    equippedRingItem?: any;
    equippedAmmoId?: string | null;
    equippedAmmoItem?: any;

    inventory?: Array<{
      uid?: string;
      itemId: string;
      count: number;
      stars?: number;
      attributes?: any[];
    }>;
    shieldInventoryIds?: string[];
    inventoryWeaponIds?: string[];
    exploredAreas?: [string, boolean[][]][];
    persistentItems?: [string, any[]][];
    containers?: [string, any[]][]; // Add containers definition
    visitedLevels?: string[];
    // Altar
    altarStorage?: [string, any[]][];
    enchantedRunes?: Array<{ runeId: string; count: number }>;
    quests?: any;
    activeBuffs?: any[]; // Save active buffs
    markers?: any[]; // Save map markers
  };
  deadEnemies: DeadEnemy[];
  activeEnemies: ActiveEnemyState[];
  ui?: {
    windows: any;
    positions: any;
  };
  timestamp: number;
  version: string;
}

export class SaveSystem {
  private scene: Phaser.Scene;
  private readonly SAVE_VERSION = "2.3.0"; // Bump version
  private currentCharacterName: string | null = null;
  private memorySaveData: GameSaveData | null = null; // Ephemeral fallback for Browser-only sessions

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  private warnBrowserFallback(context: string): void {
    console.warn(
      `[SaveSystem] ${context}: persistent local saves are supported only via Electron (window.electronAPI). Browser mode is ephemeral and non-persistent.`,
    );
  }
  // ... (omitted methods)

  // ... inside saveGame ...
  // We need to target the block around line 280-340 containing the object construction.
  // To use replace_file_content effectively, I need to match the content exactly.
  // I will target the specific block in the interface first, then the saveGame method in a second chunk or using multi_replace.

  public isNative(): boolean {
    return !!window.electronAPI;
  }

  // --- Character Management ---

  public async createCharacter(name: string): Promise<boolean> {
    this.currentCharacterName = name;

    // Create initial data
    const initialData = this.createInitialSaveData(name);

    if (this.isNative()) {
      const result = await window.electronAPI!.saveGame(name, initialData);
      if (result.success) {
        console.log(`Native: Created character ${name} at ${result.path}`);
        return true;
      } else {
        console.error("Native create failed", result.error);
        return false;
      }
    } else {
      // Browser fallback: session-only, not persisted to disk
      this.warnBrowserFallback("createCharacter");
      this.memorySaveData = initialData;
      console.log(`Web: Character session created (ephemeral): ${name}`);
      return true;
    }
  }

  public async listCharacters(): Promise<
    { name: string; level: number; timestamp: number; playTime: number }[]
  > {
    if (this.isNative()) {
      const result = await window.electronAPI!.listSaves();
      if (result.success && result.files) {
        const list: any[] = [];
        for (const f of result.files) {
          const name = f.name.replace(/\.(dat|json)$/, "");
          const loadRes = await window.electronAPI!.loadGame(name);
          if (loadRes.success && loadRes.data) {
            list.push({
              name: loadRes.data.playerState.characterName || name,
              level: loadRes.data.playerState.level,
              timestamp: loadRes.data.timestamp,
              playTime: loadRes.data.playerState.playTime || 0,
            });
          }
        }
        return list.sort((a: any, b: any) => b.timestamp - a.timestamp);
      }
      return [];
    } else {
      // Browser fallback: only current in-memory session
      this.warnBrowserFallback("listCharacters");
      if (this.memorySaveData && this.currentCharacterName) {
        return [
          {
            name: this.currentCharacterName,
            level: this.memorySaveData.playerState.level,
            timestamp: this.memorySaveData.timestamp,
            playTime: this.memorySaveData.playerState.playTime || 0,
          },
        ];
      }
      return [];
    }
  }

  public async loadCharacter(name: string): Promise<GameSaveData | null> {
    this.currentCharacterName = name; // Ensure name is set

    if (this.isNative()) {
      const result = await window.electronAPI!.loadGame(name);
      if (result.success && result.data) {
        console.log(`Native: Loaded character ${name}`);
        return result.data;
      } else {
        console.error(`Native load failed for ${name}:`, result.error);
        return null;
      }
    } else {
      // Browser fallback: load only current in-memory session
      this.warnBrowserFallback("loadCharacter");
      if (name === this.currentCharacterName && this.memorySaveData) {
        return this.memorySaveData;
      }
      return null;
    }
  }

  public async deleteCharacter(name: string): Promise<boolean> {
    if (this.isNative()) {
      if (!window.electronAPI?.deleteGame) {
        console.error("deleteGame API not found. Restart required.");
        alert(
          "Please restart the game (close terminal/window) to enable deletion feature.",
        );
        return false;
      }
      const res = await window.electronAPI.deleteGame(name);
      return res.success;
    } else {
      if (this.currentCharacterName === name) {
        this.memorySaveData = null;
        this.currentCharacterName = null;
      }
      return true;
    }
  }

  // --- File Export/Import (Web Only mostly) ---

  public exportSave(name: string): void {
    if (this.isNative()) return; // No need to export validation in native

    if (!this.memorySaveData) {
      // Try to capture
      this.saveGame(name);
    }

    // ... (Web export logic remains same, abstracted below)
    if (!this.memorySaveData) return;
    const jsonString = JSON.stringify(this.memorySaveData);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tgs_save_${name}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public importSave(jsonString: string): string | null {
    // Returns the character name found in file
    try {
      const data = JSON.parse(jsonString) as GameSaveData;
      if (!data.version || !data.playerState)
        throw new Error("Invalid save file");

      this.memorySaveData = data;
      const name = data.playerState.characterName || `Imported_${Date.now()}`;
      this.currentCharacterName = name;
      return name;
    } catch (e) {
      console.error("Import failed", e);
      return null;
    }
  }

  public getCurrentCharacterName(): string | null {
    return this.currentCharacterName;
  }

  // --- Save Logic ---

  public async saveGame(
    characterName?: string,
    uiData?: any,
  ): Promise<boolean> {
    const targetName = characterName || this.currentCharacterName || "Unknown";
    this.currentCharacterName = targetName;

    try {
      // Gather Data
      let saveData: GameSaveData;

      // If no player (e.g. init), start with defaults
      if (
        !this.scene ||
        !this.scene.registry ||
        !this.scene.registry.get("player")
      ) {
        saveData = this.createInitialSaveData(targetName);
      } else {
        // Capture Full State
        const player = this.scene.registry.get("player") as Player;
        const playerState = PlayerState.getInstance();
        const currentLevel =
          this.scene.registry.get("currentLevel")?.toString() ?? "0";
        const currentMap =
          this.scene.registry.get("currentMap")?.toString() ?? "newmap";

        // Sync Visual Items to PlayerState (Truth)
        const gameScene = this.scene as any;
        if (gameScene.droppedItemsGroup) {
          const items: DroppedItem[] =
            gameScene.droppedItemsGroup.getChildren();
          const levelItems = items
            .filter((i) => i.active)
            .map((i) => ({
              itemId: i.itemId,
              weaponId: i.getWeaponId(),
              x: i.x,
              y: i.y,
              level: i.getLevel(),
              createdAt: i.createdAt,
              count: i.count,
              stars: i.stars,
              attributes: i.attributes,
            }));
          playerState.setDroppedItemsForLevel(currentLevel, levelItems);
        }

        saveData = {
          map: currentMap,
          currentLevel: currentLevel,
          playerPos: {
            x: Math.round(player.sprite.x * 100) / 100,
            y: Math.round(player.sprite.y * 100) / 100,
          },
          playerState: playerState.exportSnapshot(),
          deadEnemies: [],
          activeEnemies: [],
          ui: uiData,
          timestamp: Date.now(),
          version: this.SAVE_VERSION,
        };

        // Capture Scene Details (Enemies Only)
        try {
          if (gameScene.deadEnemies)
            saveData.deadEnemies = gameScene.deadEnemies;

          if (gameScene.enemiesByLevel) {
            const activeEnemies: ActiveEnemyState[] = [];
            gameScene.enemiesByLevel.forEach(
              (enemies: any[], level: string) => {
                enemies.forEach((enemy: any) => {
                  if (
                    !enemy.isDefeated() &&
                    enemy.sprite &&
                    enemy.sprite.active
                  ) {
                    activeEnemies.push({
                      id: enemy.id,
                      x: enemy.sprite.x,
                      y: enemy.sprite.y,
                      health: enemy.health,
                      level: level,
                    });
                  }
                });
              },
            );
            saveData.activeEnemies = activeEnemies;
          }
        } catch (e) {
          console.warn("Could not capture full scene state", e);
        }
      }

      // Execute Save
      if (this.isNative()) {
        const result = await window.electronAPI!.saveGame(targetName, saveData);
        if (result.success) {
          console.log(`Native Save Success: ${targetName}`);
          return true;
        } else {
          console.error(`Native Save Failed: ${result.error}`);
          return false;
        }
      } else {
        this.warnBrowserFallback("saveGame");
        this.memorySaveData = saveData;
        console.log(
          `Web Save: Stored in memory only (ephemeral) for ${targetName}`,
        );
        return true;
      }
    } catch (error) {
      console.error("Error saving game:", error);
      return false;
    }
  }

  private createInitialSaveData(name: string): GameSaveData {
    return {
      map: "city_3d_multi",
      currentLevel: "0",
      playerPos: { x: 320, y: 320 },
      playerState: {
        characterName: name,
        health: 100,
        maxHealth: 100,
        level: 1,
        experience: 0,
        attackDamage: 10,
        skills: {
          strength: { level: 1, experience: 0 },
          dexterity: { level: 1, experience: 0 },
          reflex: { level: 1, experience: 0 },
          intelligence: { level: 1, experience: 0 },
        },
        willpowerExp: 0,
        willpowerTarget: 300,
        hunger: 0,
        playTime: 0,
        equippedWeaponId: "wooden_sword",
        inventory: [{ itemId: "wooden_sword", count: 1 }],
        persistentItems: [],
        exploredAreas: [],
        quests: { active: [], completed: [] },
        markers: [],
      },
      deadEnemies: [],
      activeEnemies: [],
      timestamp: Date.now(),
      version: this.SAVE_VERSION,
    };
  }

  public clearSave(): void {
    this.memorySaveData = null;
  }

  public hasSaveData(): boolean {
    return !!this.memorySaveData;
  }

  /**
   * saveGameDirect — save path for the 3D engine.
   * Does NOT require a Phaser.Scene; caller provides position/level/map context.
   * All player progression comes from PlayerState.exportSnapshot().
   */
  public async saveGameDirect(context: {
    map: string;
    currentLevel: string;
    playerPos: { x: number; y: number };
    deadEnemies?: DeadEnemy[];
    activeEnemies?: ActiveEnemyState[];
  }): Promise<boolean> {
    const playerState = PlayerState.getInstance();
    const characterName =
      playerState.getName() || this.currentCharacterName || "Unknown";
    this.currentCharacterName = characterName;

    const saveData: GameSaveData = {
      map: context.map,
      currentLevel: context.currentLevel,
      playerPos: context.playerPos,
      playerState: playerState.exportSnapshot(),
      deadEnemies: context.deadEnemies ?? [],
      activeEnemies: context.activeEnemies ?? [],
      timestamp: Date.now(),
      version: this.SAVE_VERSION,
    };

    if (this.isNative()) {
      const result = await window.electronAPI!.saveGame(characterName, saveData);
      if (result.success) {
        console.log(`[SaveSystem] 3D save OK: ${characterName}`);
        return true;
      }
      console.error(`[SaveSystem] 3D save failed:`, result.error);
      return false;
    } else {
      this.warnBrowserFallback("saveGameDirect");
      this.memorySaveData = saveData;
      return true;
    }
  }
}
