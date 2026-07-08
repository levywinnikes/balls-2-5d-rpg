import { PlayerState } from "../../game/entities/Player/PlayerState";

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
      writeRuntimeLog: (
        data: unknown,
      ) => Promise<{ success: boolean; path?: string; error?: string }>;
    };
  }
}

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

export interface GameSaveData {
  map: string;
  currentLevel: string;
  playerPos: { x: number; y: number };
  playerY?: number;
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
    hunger?: number;
    playTime?: number;
    equippedWeaponId: string | null;
    equippedWeaponItem?: any;
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
    containers?: [string, any[]][];
    visitedLevels?: string[];
    altarStorage?: [string, any[]][];
    enchantedRunes?: Array<{ runeId: string; count: number }>;
    quests?: any;
    activeBuffs?: any[];
    markers?: any[];
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
  private readonly SAVE_VERSION = "2.3.0";
  private currentCharacterName: string | null = null;
  private memorySaveData: GameSaveData | null = null;

  private warnBrowserFallback(context: string): void {
    console.warn(
      `[SaveSystem] ${context}: persistent local saves are supported only via Electron (window.electronAPI). Browser mode is ephemeral and non-persistent.`,
    );
  }

  public isNative(): boolean {
    return !!window.electronAPI;
  }

  // --- Character Management ---

  public async createCharacter(name: string): Promise<boolean> {
    this.currentCharacterName = name;
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
    this.currentCharacterName = name;

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
        console.error("deleteGame API not found.");
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

  // --- File Export/Import (Web Only) ---

  public exportSave(name: string): void {
    if (this.isNative()) return;

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

  public async saveGame(context: {
    map: string;
    currentLevel: string;
    playerPos: { x: number; y: number };
    playerY?: number;
    deadEnemies?: DeadEnemy[];
    activeEnemies?: ActiveEnemyState[];
    uiData?: any;
  }): Promise<boolean> {
    const playerState = PlayerState.getInstance();
    const characterName =
      playerState.getName() || this.currentCharacterName || "Unknown";
    this.currentCharacterName = characterName;

    const saveData: GameSaveData = {
      map: context.map,
      currentLevel: context.currentLevel,
      playerPos: context.playerPos,
      playerY: context.playerY,
      playerState: playerState.exportSnapshot(),
      deadEnemies: context.deadEnemies ?? [],
      activeEnemies: context.activeEnemies ?? [],
      ui: context.uiData,
      timestamp: Date.now(),
      version: this.SAVE_VERSION,
    };

    if (this.isNative()) {
      const result = await window.electronAPI!.saveGame(
        characterName,
        saveData,
      );
      if (result.success) {
        console.log(`[SaveSystem] Save OK: ${characterName}`);
        return true;
      }
      console.error(`[SaveSystem] Save failed:`, result.error);
      return false;
    } else {
      this.warnBrowserFallback("saveGame");
      this.memorySaveData = saveData;
      return true;
    }
  }

  public async saveGameDirect(context: {
    map: string;
    currentLevel: string;
    playerPos: { x: number; y: number };
    playerY?: number;
    deadEnemies?: DeadEnemy[];
    activeEnemies?: ActiveEnemyState[];
  }): Promise<boolean> {
    return this.saveGame(context);
  }

  public clearSave(): void {
    this.memorySaveData = null;
  }

  public hasSaveData(): boolean {
    return !!this.memorySaveData;
  }

  // --- Initial Data ---

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
}
