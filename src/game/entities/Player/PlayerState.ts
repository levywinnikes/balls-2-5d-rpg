import { ItemType } from "../../../config/ItemConstants";
import { EventEmitter } from "events";
import { WeaponDefinition, WeaponRegistry } from "../weapons/WeaponRegistry";
import { ReflexXpTable } from "../../data/ReflexXpTable";
import { StrengthXpTable } from "../../data/StrengthXpTable";
import { DexterityXpTable } from "../../data/DexterityXpTable";
import { IntelligenceXpTable } from "../../data/IntelligenceXpTable";
import { XPTable } from "../../data/XPTable";
import { StatManager } from "../../systems/StatManager";
import { ShieldDefinition, ShieldRegistry } from "../Shields/ShieldRegistry";
import { RuneRegistry } from "../../magic/RuneRegistry";
import { QuestManager } from "../../systems/QuestManager";

import { t_game } from "../../i18n/translations";
import { ConsumableManager } from "../../managers/ConsumableManager";

export type NotificationType = "success" | "warning" | "error" | "info" | "exp" | "pickup" | "willpower" | "heal";

// Interfaces
export interface InventoryItem {
  uid: string;
  itemId: string;
  count: number;
  stars?: number;
  attributes?: any[];
}

export interface GroundDragData {
  item: {
    uid?: string; // Optional for compatibility, but DroppedItems provide it
    itemId: string;
    weaponId: string;
    x: number;
    y: number;
    level: string;
    count?: number;
    stars?: number;
    attributes?: any[];
  };
  sprite: Phaser.GameObjects.GameObject;
}

export interface DroppedItemData {
  itemId: string;
  weaponId: string;
  x: number;
  y: number;
  // Optional stats for tooltip
  def?: WeaponDefinition;
  timeLeft?: number;
  createdAt?: number;
  count?: number;
  stars?: number;
  attributes?: any[];
}

export interface Buff {
    id: string; // e.g. "potion_strength"
    attr: string; // e.g. "strength"
    value: number; // e.g. 5
    duration: number; // ms remaining
    isPercent?: boolean;
}

export interface SkillState {
    level: number;
    experience: number;
}

export class PlayerState extends EventEmitter {
  private static instance: PlayerState;
  
  private consumableManager: ConsumableManager;

  // Posição
  private _currentPosition: { x: number; y: number; level: string } = {
    x: 0,
    y: 0,
    level: "0",
  };
  private currentLevel: string = "0";
  private fallSafetyEnabled: boolean = true; // Default ON

  public getZLevel(): string {
      return this.currentLevel;
  }

  // Status
  private health: number = 100;
  private maxHealth: number = 100;
  private mana: number = 100;
  private maxMana: number = 100;
  private characterName: string = "";
  private level: number = 1;
  private experience: number = 0;
  private playTime: number = 0; // Saved play time (seconds)
  private sessionStartTime: number = Date.now();
  private balance: number = 0; // Grandfather's Coin (GC)
  private limitCapacity: boolean = false;

  // Rune Cooldown System
  private lastRuneCastTime: number = 0;
  private runeCooldownDuration: number = 1000; // 1 second in milliseconds

  // Capacidade não é mais fixa aqui, é calculada no getCapacity()

  // Skills
  private strength: SkillState = { level: 1, experience: 0 };
  private dexterity: SkillState = { level: 1, experience: 0 };
  private reflex: SkillState = { level: 1, experience: 0 };
  private intelligence: SkillState = { level: 1, experience: 0 };

  // --- Skill Getters with XP ---
  public getStrengthData() { return this.strength; }
  public getStrengthNextLevelExp() { return StrengthXpTable.getLevelInfo(this.strength.experience).nextLevelXP; }

  public getDexterityData() { return this.dexterity; }
  public getDexterityNextLevelExp() { return DexterityXpTable.getLevelInfo(this.dexterity.experience).nextLevelXP; }

  public getReflexData() { return this.reflex; }
  public getReflexNextLevelExp() { return ReflexXpTable.getLevelInfo(this.reflex.experience).nextLevelXP; }

  public getIntelligenceData() { return this.intelligence; }
  public getIntelligenceNextLevelExp() { return IntelligenceXpTable.getLevelInfo(this.intelligence.experience).nextLevelXP; }

  // --- Skill Experience Handling ---
  // (Methods are defined at the bottom of the file: gainStrengthExperience, etc.)

  public getMana(): number { return this.mana; }
  public setMana(val: number) { 
      this.mana = Math.min(Math.max(0, val), this.maxMana);
      this.emit("manaChanged", this.mana);
  }
  public getMaxMana(): number { return this.maxMana; }
  public setMaxMana(val: number) { 
      this.maxMana = val; 
      // Ensure current mana respects new max? Or just let it be.
      if (this.mana > this.maxMana) this.mana = this.maxMana;
      this.emit("manaChanged", this.mana);
  }
  private attackDamage: number = 10;
  private baseSpeed: number = 400;
  private sprintMultiplier: number = 1.3;

  // Input Blocking
  private isInputBlocked: boolean = false;

  public setInputBlocked(blocked: boolean) {
    this.isInputBlocked = blocked;
  }

  /**
   * Pauses the game scene to improve performance when menu is open
   */
  public pauseGame() {
    try {
      if (typeof window !== 'undefined' && (window as any).phaserGame) {
        const game = (window as any).phaserGame;
        if (!game || !game.scene) return;
        
        // Direct SceneManager usage is more reliable
        // Check if scene is running before pausing
        if (game.scene.isActive('GameScene')) {
            game.scene.pause('GameScene');
        }
      }
    } catch (error) {
      console.warn('[PlayerState] Failed to pause game:', error);
    }
  }

  /**
   * Resumes the game scene when menu closes
   */
  public resumeGame() {
    try {
      if (typeof window !== 'undefined' && (window as any).phaserGame) {
        const game = (window as any).phaserGame;
        if (!game || !game.scene) return;
        
        // Direct SceneManager usage
        if (game.scene.isPaused('GameScene')) {
            game.scene.resume('GameScene');
        }
      }
    } catch (error) {
      console.warn('[PlayerState] Failed to resume game:', error);
    }
  }

  public getInputBlocked(): boolean {
      return this.isInputBlocked;
  }
  
  // Willpower System (Survival Bonus)
  private willpowerExp: number = 0;
  private willpowerTarget: number = 300; // Base target for Level 1
  
  // Hunger System
  private hunger: number = 1000;
  private maxHunger: number = 1000;
  private statusTimer: number = 0; // Defines tick for regeneration/hunger
  private lastHungerDecay: number = 0;
  private lastRegen: number = 0;

  // Buff System (Centralized)
  private activeBuffs: Map<string, Buff> = new Map();
  
  // Interaction
  public pickupRange: number = 200; // ~1.5 tiles

  // Inventário
  public inventory: InventoryItem[] = [];

  public equippedHelmetId: string | null = null;
  public equippedNeckId: string | null = null; // Added
  public equippedArmorId: string | null = null;
  public equippedLegsId: string | null = null;
  public equippedBootsId: string | null = null;
  public equippedShieldId: string | null = null;
  public equippedWeaponId: string | null = "wooden_sword";
  public equippedRingId: string | null = null; // Added
  public equippedAmmoId: string | null = null; // Added

  // --- DASHBOARD HELPERS ---

  // --- DASHBOARD HELPERS ---
  // (getEquipment moved to bottom)

  public requestEquip(itemUid: string, targetSlot?: string): boolean {
      const item = this.getInventoryItem(itemUid);
      if (!item) return false;
      
      const def = WeaponRegistry.getWeaponDefinition(item.itemId);
      if (!def) return false;

      const type = def.type;
      
      // Map ItemType to PlayerState internal slot keys if needed, or calling specific methods
      
      if (
          type === ItemType.SWORD || 
          type === ItemType.AXE || 
          type === ItemType.CLUB || 
          type === ItemType.WAND || 
          type === ItemType.ROD || 
          type === ItemType.DISTANCE ||
          type === ItemType.MELEE || // Legacy fallback
          type === ItemType.RANGED // Legacy fallback
      ) {
           // Main Hand
           return this.equipWeapon(itemUid);
      } else if (type === ItemType.SHIELD) {
           return this.equipShield(itemUid);
      } else if (type === ItemType.HELMET) {
           return this.equipItem(itemUid, "helmet");
      } else if (type === ItemType.BODY_ARMOR) {
           return this.equipItem(itemUid, "armor");
      } else if (type === ItemType.LEGS) {
           return this.equipItem(itemUid, "legs");
      } else if (type === ItemType.BOOTS) {
           return this.equipItem(itemUid, "boots");
      } else if (type === ItemType.AMULET) {
           // Implement equipAmulet if exists, or generic equipItem
           // console.warn("Amulet equipping not fully implemented in PlayerState yet");
           return false; 
      } else if (type === ItemType.RING) {
           // Implement equipRing
           return false;
      } else if (type === ItemType.AMMUNITION) {
           // Implement equipAmmo
           return false;
      }
      
      return false;
  }

  // Item Objects (for Attributes/Stars persistence)

  public equippedHelmetItem: InventoryItem | null = null;
  public equippedNeckItem: InventoryItem | null = null; // Added
  public equippedArmorItem: InventoryItem | null = null;
  public equippedLegsItem: InventoryItem | null = null;
  public equippedBootsItem: InventoryItem | null = null;
  public equippedShieldItem: InventoryItem | null = null;
  public equippedWeaponItem: InventoryItem | null = null;
  public equippedRingItem: InventoryItem | null = null; // Added
  public equippedAmmoItem: InventoryItem | null = null; // Added

  public shieldInventoryIds: string[] = [];

  // Persistência
  private exploredAreas: Map<string, boolean[][]> = new Map();
  private droppedItems: Map<string, DroppedItemData[]> = new Map();
  
  // Container System
  // Map<ContainerUUID, InventoryItem[]>
  // Map<ContainerUUID, InventoryItem[]>
  private containers: Map<string, InventoryItem[]> = new Map();

  // --- MAGIC & MEMORY SYSTEM ---
  public enchantedRunes: Array<{ runeId: string, count: number }> = [];
  public baseMemory: number = 10; 
  // Map<AltarID, Array<{ runeId: string, count: number }>>
  private altarStorage: Map<string, Array<{ runeId: string, count: number }>> = new Map();

  public getAltarRunes(altarId: string) {
      return this.altarStorage.get(altarId) || [];
  }

  public addRuneToAltar(altarId: string, runeId: string, count: number) {
      const runes = this.getAltarRunes(altarId);
      const existing = runes.find(r => r.runeId === runeId);
      if (existing) {
          existing.count += count;
      } else {
          runes.push({ runeId, count });
      }
      this.altarStorage.set(altarId, runes);
      this.emit("altarUpdated", altarId);
  }

  public withdrawRuneFromAltar(altarId: string, runeId: string, count: number): boolean {
      const runes = this.getAltarRunes(altarId);
      const index = runes.findIndex(r => r.runeId === runeId);
      if (index === -1) return false;

      const rune = runes[index];
      if (rune.count >= count) {
          rune.count -= count;
          if (rune.count <= 0) runes.splice(index, 1);
          this.altarStorage.set(altarId, runes);
          this.emit("altarUpdated", altarId);
          return true;
      }
      return false;
  }

  private groundDragData: GroundDragData | null = null;

  // UI & Save
  private openWindows: any = {};
  public currentOpenedContainerId: string | null = null; // Track single opened container
  public currentOpenedContainerDefId: string | null = null; // Track definition for UI Title

  // Level Visit Tracking (Prevent Duplicate Map Item Spawning)
  private visitedLevels: Set<string> = new Set();

  private _debugCollision: boolean = false;
  private _cloudShadowsEnabled: boolean = true;

  private constructor() {
    super();
    this.consumableManager = new ConsumableManager(this);
  }

  // --- PERFORMANCE TRACKING ---
  private _perfData = {
      fps: 0,
      enemyTime: 0,
      mapTime: 0,
      physicsTime: 0,
      totalUpdateTime: 0,
      activeEnemies: 0,
      renderedTiles: 0,
      totalObjects: 0,
      culprits: [] as [string, number][]
  };

  private _diagnosticSettings = {
      enableAI: true,
      enableMapUpdate: true,
      enableClouds: true,
      enableLighting: true,
      enableItemDepth: true,
      enablePhysics: true,
      enablePlayerState: true,
      hideTiles: false,
      hideEnemies: false,
      hideItems: false
  };

  public updatePerfMetrics(metrics: any) {
      this._perfData = { ...this._perfData, ...metrics };
      this.emit("perfUpdated", this._perfData);
  }

  public getPerfData() {
      return this._perfData;
  }

  public getDiagnosticSettings() {
      return this._diagnosticSettings;
  }

  public updateDiagnosticSetting(key: keyof typeof PlayerState.prototype._diagnosticSettings, value: boolean) {
      (this._diagnosticSettings as any)[key] = value;
      this.emit("diagnosticUpdated", this._diagnosticSettings);
  }



  public static getInstance(): PlayerState {
    const win = window as any;
    if (!win._playerStateInstance) {
      win._playerStateInstance = new PlayerState();
      win._playerStateInstance.setMaxListeners(50); // Increase limit for UI hooks
    }
    return win._playerStateInstance;
  }
  
  // --- CONTAINER LOGIC ---
  public getContainerItems(containerId: string): InventoryItem[] {
      return this.containers.get(containerId) || [];
  }

  public registerContainer(containerId: string, initialItems: InventoryItem[] = []) {
      if(!this.containers.has(containerId)) {
          this.containers.set(containerId, initialItems);
      }
  }



  // Removed redundant closeContainer method
  // See implementation around line 242

  public addItemToContainer(containerId: string, itemId: string, count: number, explicitUid?: string, stars: number = 0, attributes: any[] = []): boolean {
      if (!this.containers.has(containerId)) {
          // Auto-init container (e.g. for MapLoader seeding)
          this.containers.set(containerId, []);
      }
      
      const items = this.containers.get(containerId)!;
      // Check Capacity? (Optional: 1000 oz limit?)
      // For now, infinite or standard slot limit (e.g. 20 slots)
      if (items.length >= 20) {
          this.emit("message", t_game("container_full"));
          return false;
      }
      
      
      items.push({
          uid: explicitUid || this.generateUID(),
          itemId,
          count,
          stars,
          attributes
      });
      this.containers.set(containerId, items);
      this.emit("containerUpdated", containerId);
      return true;
  }
  
  public removeItemFromContainer(containerId: string, itemUid: string, count: number = 1): boolean {
      if (!this.containers.has(containerId)) return false;
      const items = this.containers.get(containerId)!;
      
      const index = items.findIndex(i => i.uid === itemUid);
      if (index === -1) return false;

      const item = items[index];
      if (item.count > count) {
          item.count -= count;
      } else {
          items.splice(index, 1);
      }

      this.containers.set(containerId, items);
      this.emit("containerUpdated", containerId);
      this.emit("inventoryUpdated");
      return true;
  }

  public unequipItemToContainer(slot: "helmet" | "armor" | "legs" | "boots" | "shield" | "weapon", containerId: string): boolean {
       let slotKey: keyof PlayerState = "equippedHelmetId";
       if (slot === "weapon") slotKey = "equippedWeaponId";
       else if (slot === "shield") slotKey = "equippedShieldId";
       else if (slot === "helmet") slotKey = "equippedHelmetId";
       else if (slot === "armor") slotKey = "equippedArmorId";
       else if (slot === "legs") slotKey = "equippedLegsId";
       else if (slot === "boots") slotKey = "equippedBootsId";

       const itemId = (this as any)[slotKey] as string | null;

       if (itemId) {
           // 1. Try Add to Container FIRST (Prevent Limbo if full)
           // Equipment items are count 1.
           if (this.addItemToContainer(containerId, itemId, 1)) {
               // 2. Remove from slot ONLY if successful
               (this as any)[slotKey] = null;
               this.emit("equipmentChanged");
               this.emit("weaponEquipped", null); 
               
               // 3. Update Weight/Stats
               this.emit("inventoryUpdated");
               return true;
           }
           // Else: Container full. Item stays equipped.
           return false;
       }
       return false;
   }

  public dropEquippedItem(slot: "helmet" | "armor" | "legs" | "boots" | "shield" | "weapon", dropX?: number, dropY?: number): void {
      let itemId: string | null = null;
      let slotKey: keyof PlayerState = "equippedHelmetId";
      
      if (slot === "weapon") slotKey = "equippedWeaponId";
      else if (slot === "shield") slotKey = "equippedShieldId";
      else if (slot === "helmet") slotKey = "equippedHelmetId";
      else if (slot === "armor") slotKey = "equippedArmorId";
      else if (slot === "legs") slotKey = "equippedLegsId";
      else if (slot === "boots") slotKey = "equippedBootsId";

      itemId = this[slotKey] as string | null;

      if (itemId) {
          // Remove from slot
          // Capture stats BEFORE removing
          const itemObj = (this as any)[slotKey.replace('Id', 'Item')] as InventoryItem | null;
          const stars = itemObj?.stars || 0;
          const attributes = itemObj?.attributes || [];

          (this as any)[slotKey] = null;
          (this as any)[slotKey.replace('Id', 'Item')] = null;

          
          // Emit UI updates
          this.emit("equipmentChanged");
          this.emit("inventoryUpdated"); // for weight
          this.emit("weaponEquipped", null); // safe to emit null even if not weapon

          // Request Spawn on Ground (via GameScene)
          // We need a specific event for "Spawn Dropped Item" that doesn't check inventory
          // Passing count=1 as eq items are 1.
          // WeaponDefinition needed to know if stackable? Usually eq not stackable.
          this.emit("spawnDroppedItem", { 
              itemId: itemId, 
              weaponId: itemId, 
              count: 1, 
              x: dropX, 
              y: dropY,
              stars: stars,
              attributes: attributes
          });
      }
  }

  public getOpenWindows() {
      return this.openWindows;
  }

  public openContainer(uid: string, containerTypeId: string, name: string, worldPos?: { x: number; y: number; level: string }): void {
      // Single Container Policy REMOVED to allow Altar + Chest
      // We no longer auto-close other containers.

      // Check if already open
      // if (this.openWindows[uid]) return; // REMOVED: Allow re-emitting event to focus/bring to front

      // Initialize if new
      if (!this.containers.has(uid)) {
          this.containers.set(uid, []);
      }

      // Track as open window
      this.openWindows[uid] = {
          type: "container",
          id: uid, 
          title: name,
          x: 400, // Default Pos
          y: 200,
          worldPos // Store world position for distance checks
      };

      this.currentOpenedContainerId = uid;
      this.currentOpenedContainerDefId = containerTypeId;
      
      this.emit("windowOpened", {
          id: uid,
          type: "container",
          title: name,
          data: { containerId: uid, containerDefId: containerTypeId }
      });
  }

  public closeContainer(targetId?: string): void {
      const id = targetId || this.currentOpenedContainerId;
      if (!id) return;
      
      // If closing the "current", handle pointers
      if (this.currentOpenedContainerId === id) {
          this.currentOpenedContainerId = null;
          this.currentOpenedContainerDefId = null;
      }
      
      if (this.openWindows[id]) {
          delete this.openWindows[id];
      }
      
      this.emit("containerClosed", id);
      this.emit("windowClosed", { id, type: "container" });
  }

  public getContainersMap() {
    return this.containers;
  }

  public getOpenContainerWorldPos(id: string): { x: number; y: number; level: string } | undefined {
      if (this.openWindows[id] && this.openWindows[id].worldPos) {
          return this.openWindows[id].worldPos;
      }
      return undefined;
  }

  public getInventoryItem(uid: string): InventoryItem | undefined {
      return this.inventory.find(i => i.uid === uid);
  }

  // --- INVENTORY HELPERS ---
  public removeInventoryItem(uid: string): void {
      this.inventory = this.inventory.filter(i => i.uid !== uid);
      this.emit("inventoryUpdated");
  }

  public addInventoryItem(itemId: string, count: number, explicitUid?: string, stars: number = 0, attributes: any[] = []): boolean {
      if (this.inventory.length >= 20) return false;
      this.inventory.push({
          uid: explicitUid || this.generateUID(),
          itemId,
          count,
          stars,
          attributes
      });
      this.emit("inventoryUpdated");
      return true;
  }

  public getInventory(): InventoryItem[] {
      return this.inventory;
  }

  public decreaseInventoryItem(uid: string, amount: number = 1): boolean {
      const item = this.inventory.find(i => i.uid === uid);
      if (!item) return false;

      if (item.count > amount) {
          item.count -= amount;
          this.emit("inventoryUpdated");
          return true;
      } else if (item.count === amount) {
          this.removeInventoryItem(uid);
          return true;
      }
      return false;
  }

  // =================================================================
  // LÓGICA DE CAPACIDADE E PESO (CORRIGIDA)
  // =================================================================

  // NOTE: Logic moved to "WEIGHT & CAPACITY SYSTEM" section below.
  // Keeping hasCapacity as a wrapper for now if needed, or removing if duplicate.
  // Actually, I will remove these duplicates entirely to rely on the new implementation below.
  
  public hasCapacity(weight: number): boolean {
      return this.getCurrentWeight() + weight <= this.getCapacity() + 0.01;
  }

  public getCurrentWeight(): number {
      return this.getInventoryWeight();
  }

  public getContainerTotalWeight(containerId: string): number {
      const items = this.containers.get(containerId);
      if (!items) return 0;
      
      let weight = 0;
      items.forEach(item => {
          const def = WeaponRegistry.getWeaponDefinition(item.itemId);
          if (def) {
              weight += def.weight * item.count;
               if (def.type === "container") {
                  weight += this.getContainerTotalWeight(item.uid);
              }
          }
      });
      return weight;
  }
    public dropItem(index: number, x?: number, y?: number) {
      if (index < 0 || index >= this.inventory.length) return;
      
      const item = this.inventory[index];
      // Define explicit UID if missing
      if (!item.uid) item.uid = this.generateUID();
      
      // Remove from inventory
      this.inventory.splice(index, 1);
      
      this.emit("inventoryUpdated", this.inventory);
      
      // Emit event for GameScene to spawn the entity
      // Data matches onSpawnDroppedItem signature in GameScene
      this.emit("spawnDroppedItem", {
          itemId: item.uid, // Use UID as the dropped item ID to persist uniqueness
          weaponId: item.itemId, // The actual definition ID
          count: item.count,
          x: x || this._currentPosition.x,
          y: y || this._currentPosition.y,
          attributes: item.attributes, // Pass attributes to persist
          stars: item.stars
      });
      
      console.log(`[PlayerState] Dropped item index ${index}: ${item.itemId}`);
  } 
  public addItem(
    itemId: string, 
    count: number = 1, 
    explicitUid?: string, 
    stars: number = 0, 
    attributes: any[] = []
  ): boolean {
    console.log(`[DEBUG] PlayerState.addItem: ${itemId} Stars=${stars}`);
    const def = WeaponRegistry.getWeaponDefinition(itemId);
    if (!def) return false;

    // CHECK PICKUPABLE STATUS
    if (def.pickupable === false) {
        this.emit("message", t_game("msg_cannot_pickup"));
        return false;
    }

    // 1. VERIFICAÇÃO DE PESO
    // For container, we should technically count its contents if we are picking it up?
    // But calculateInventoryWeight will calc it AFTER it is added.
    // If we pick up a heavy chest, we should check its weight NOW.
    let weightToAdd = def.weight * count;
    
    // If explicitly preserving UID (picking up container), check its contents weight too
    // Note: getContainerContentWeight sums the items inside.
    if (explicitUid && def.type === "container") {
        weightToAdd += this.getContainerContentWeight(explicitUid);
    }

    const currentWeight = this.getCurrentWeight();
    const maxCapacity = this.getCapacity();

    // Usamos uma pequena margem (0.01) para evitar erros de ponto flutuante
    if (currentWeight + weightToAdd > maxCapacity + 0.01) {
      console.warn(
        `PlayerState: Capacidade excedida (${
          currentWeight + weightToAdd
        } / ${maxCapacity}) - Overburdened!`
      );
      this.emit("message", t_game("msg_too_heavy")); // "Too heavy" matches logic
      // OVERBURDEN SYSTEM: Do NOT return false. Allow pickup.
      // return false; 
    }

    // 2. Adiciona o item
    // If item has stars, it should NOT stack (unless we implement "stack compatible" check, which is complex)
    // For now, assume starred items are weapons/equipment and thus unstackable.
    // Even if stackable=true in registry, if stars > 0, treat as unique? 
    // Let's rely on standard logic: if stackable, search existing.
    
    if (def.stackable && stars === 0) {
      const existingSlot = this.inventory.find((i) => i.itemId === itemId && (!i.stars || i.stars === 0));
      if (existingSlot) {
        existingSlot.count += count;
      } else {
        this.inventory.push({ 
            uid: explicitUid || this.generateUID(), 
            itemId, 
            count,
            stars, // 0
            attributes // []
        });
      }
    } else {
      for (let i = 0; i < count; i++) {
        // If count > 1 and explicitUid provided, it only applies to FIRST?
        // Usually non-stackable pickup is count=1.
        const uid = (i === 0 && explicitUid) ? explicitUid : this.generateUID();
        this.inventory.push({ 
            uid, 
            itemId, 
            count: 1,
            stars,
            attributes
        });
      }
    }

    this.emit("inventoryUpdated");
    return true;
  }

  public removeItem(itemId: string, count: number = 1): boolean {
    const index = this.inventory.findIndex((i) => i.itemId === itemId);
    if (index === -1) return false;

    const slot = this.inventory[index];
    if (slot.count > count) {
      slot.count -= count;
    } else {
      this.inventory.splice(index, 1);
    }
    this.emit("inventoryUpdated");
    return true;
  }

    // =================================================================
    // WEIGHT & CAPACITY SYSTEM
    // =================================================================

    public getItemWeight(itemId: string, count: number = 1, uid?: string): number {
        const def = WeaponRegistry.getWeaponDefinition(itemId);
        if (!def) return 0;
        
        let total = (def.weight || 0) * count;
        
        // If it's a container and has a UID, recursively add contents weight
        if (uid && this.containers.has(uid)) {
            total += this.getContainerContentWeight(uid);
        }
        
        return total;
    }

    public getContainerContentWeight(containerUid: string): number {
        const items = this.containers.get(containerUid);
        if (!items) return 0;
        
        let weight = 0;
        for (const item of items) {
             weight += this.getItemWeight(item.itemId, item.count, item.uid);
        }
        return weight;
    }

    public getInventoryWeight(): number {
        let weight = 0;
        
        // Inventory items
        for (const item of this.inventory) {
             weight += this.getItemWeight(item.itemId, item.count, item.uid);
        }
        
        // Equipment (optional, usually equipped items count differently or same?)
        // Tibia usually counts equipped items towards capacity.
        if (this.equippedHelmetId) weight += this.getItemWeight(this.equippedHelmetId);
        if (this.equippedArmorId) weight += this.getItemWeight(this.equippedArmorId);
        if (this.equippedLegsId) weight += this.getItemWeight(this.equippedLegsId);
        if (this.equippedBootsId) weight += this.getItemWeight(this.equippedBootsId);
        if (this.equippedWeaponId) weight += this.getItemWeight(this.equippedWeaponId);
        if (this.equippedShieldId) weight += this.getItemWeight(this.equippedShieldId);

        return parseFloat(weight.toFixed(2));
    }
    
    public getCapacity(): number {
        return StatManager.getInstance().calculateStat("capacity", this).finalValue;
    }

    // =================================================================
    // MAGIC MEMORY SYSTEM
    // =================================================================

    public removeEnchantedRune(runeId: string, count: number): boolean {
      const idx = this.enchantedRunes.findIndex(r => r.runeId === runeId);
      if (idx !== -1) {
          const removed = this.enchantedRunes[idx];
          if (removed.count > count) {
              removed.count -= count;
              this.emit("runesUpdated");
              return true;
          } else if (removed.count === count) {
              this.enchantedRunes.splice(idx, 1);
              this.emit("runesUpdated");
              return true;
          }
      }
      return false;
  }

  public getEnchantedRunes() {
        return this.enchantedRunes;
    }

    public getMemoryCapacity(): number {
        return StatManager.getInstance().calculateStat("memory", this).finalValue;
    }

    public getCurrentMemoryUsage(): number {
        return this.enchantedRunes.reduce((total, rune) => {
             const def = RuneRegistry.getRune(rune.runeId);
             const cost = def ? def.memoryCost : 0;
             return total + (cost * rune.count);
        }, 0);
    }

    /**
     * Used by RuneRegistry import or injected logic
     */
    public recalculateMemoryUsage(runeRegistryGetter: (id: string) => number): number {
         return this.enchantedRunes.reduce((total, rune) => {
             return total + (runeRegistryGetter(rune.runeId) * rune.count);
        }, 0);
    }

    public addEnchantedRune(runeId: string, charges: number, memoryCostPerCharge: number): boolean {
        // const memoryNeeded = charges * memoryCostPerCharge;
        // Check Capacity (Allow overfill? User said: "pode carregar mais... só que não funcionam")
        // User said: "Entretanto vc pode carregar mais runas do que sua capacidade de memória, só que elas não vão funcionar..."
        // So we ALWAYS allow adding, but usage checks capacity.
        
        const existing = this.enchantedRunes.find(r => r.runeId === runeId);
        if (existing) {
            existing.count += charges;
        } else {
            this.enchantedRunes.push({ runeId, count: charges });
        }
        
        this.emit("runesUpdated"); // For Spellbook UI
        return true;
    }

    public consumeRuneCharge(runeId: string, amount: number = 1): boolean {
        const index = this.enchantedRunes.findIndex(r => r.runeId === runeId);
        if (index === -1) return false;

        const rune = this.enchantedRunes[index];
        if (rune.count >= amount) {
            rune.count -= amount;
            if (rune.count <= 0) {
                this.enchantedRunes.splice(index, 1);
            }
            this.emit("runesUpdated");
            return true;
        }
        return false;
    }

  // =================================================================
  // OUTROS MÉTODOS
  // =================================================================




  // Compatibilidade
  public get inventoryWeaponIds(): string[] {
    return this.inventory.map((i) => i.itemId);
  }

  public set inventoryWeaponIds(ids: string[]) {
    this.inventory = [];
    ids.forEach((id) => this.addItem(id)); // Note: Isso pode falhar se exceder peso no load, mas ok para load inicial
  }

  public addWeaponToInventory(weaponId: string): boolean {
    return this.addItem(weaponId);
  }

  public removeWeaponFromInventory(weaponId: string): void {
    this.removeItem(weaponId);
  }

  public getInventoryWeapons(): WeaponDefinition[] {
    return this.inventory
      .map((slot) => WeaponRegistry.getWeaponDefinition(slot.itemId))
      .filter((w): w is WeaponDefinition => !!w);
  }

  public getInventoryItems(): (InventoryItem & { def: WeaponDefinition })[] {
    // AGGRESSIVE DEBUG
    // console.warn("[DEBUG] Full Inventory Dump:", JSON.parse(JSON.stringify(this.inventory)));
    
    return this.inventory
      .map((slot) => {
        const def = WeaponRegistry.getWeaponDefinition(slot.itemId);
        if ((slot.stars && slot.stars > 0) || (slot.attributes && slot.attributes.length > 0)) {
             console.warn(`[DEBUG WRN] Item ${slot.itemId} Stars=${slot.stars} Attrs=${JSON.stringify(slot.attributes)}`);
        }
        return def ? { 
            ...slot, 
            def,
            stars: slot.stars,
            attributes: slot.attributes
        } : null;
      })
      .filter(Boolean) as any;
  }

  public getBaseSpeed(): number {
    return this.baseSpeed;
  }

  public getCurrentSpeed(): number {
    return StatManager.getInstance().calculateStat("speed", this).finalValue;
  }

  public getSprintSpeed(): number {
    return Math.floor(this.getCurrentSpeed() * this.sprintMultiplier);
  }

  public getAttackDamage(): number {
    return this.getTotalAttack();
  }

  public calculateAttackBreakdown(
      weapon: WeaponDefinition, 
      attributes?: any[],
      overrideLevel?: number,
      overrideSkill?: number
  ) {
      // Delegate to Single Source of Truth
      return StatManager.getInstance().calculateWeaponAttack(
          weapon, 
          attributes || [], // Ensure array
          this, 
          overrideLevel, 
          overrideSkill
      );
  }

  public getTotalAttack(): number {
      return StatManager.getInstance().calculateStat("attack", this).finalValue;
  }

  public getExpPerHit(): number {
      return StatManager.getInstance().calculateStat("expPerHit", this).finalValue;
  }

  public getExpDamagePercent(): number {
      return StatManager.getInstance().calculateStat("expDamagePercent", this).finalValue;
  }



  public calculateDefenseBreakdown(
      weapon: WeaponDefinition | null,
      shield: WeaponDefinition | null,
      weaponAttributes: any[] = [],
      shieldAttributes: any[] = [],
      overrideLevel?: number,
      overrideSkill?: number
  ) {
      const weaponDef = weapon?.defense || 0;
      const shieldDef = shield?.defense || 0;
      const baseDefense = weaponDef + shieldDef;
      
      const level = overrideLevel ?? this.level;
      const skill = overrideSkill ?? this.reflex.level;

      const levelBonusPct = level * 1; // 1% per level (based on 0.01 mult)
      const skillBonusPct = skill * 5; // 5% per skill level

      // Attributes (Placeholder for future defense attributes)
      let attrBonusPct = 0;
      // ... iterate attributes if we add defense codes

      const totalBonusPct = levelBonusPct + skillBonusPct + attrBonusPct;
      
      // Additive Stacking
      const subtotal = baseDefense * (1 + (totalBonusPct / 100));

      const wpBonusPct = this.getWillpowerBonusPercent();
      const wpMultiplier = 1 + (wpBonusPct / 100);
      
      const finalTotal = Math.floor(subtotal * wpMultiplier);
      // const valFromWp = finalTotal - Math.floor(subtotal);

      return {
          base: baseDefense,
          levelBonusPct,
          skillBonusPct,
          wpBonusPct,
          finalTotal
      };
  }

  public getTotalDefense(): number {
      return StatManager.getInstance().calculateStat("defense", this).finalValue;
  }

  public calculateArmorBreakdown() {
      // Sum base armor from all slots
      let totalBaseArmor = 0;
      const slots = ["helmet", "armor", "legs", "boots", "shield", "weapon"] as const;
      
      slots.forEach(slot => {
      slots.forEach(slot => {
          const item = this.getEquippedItemObject(slot);
          if (item) {
              const def = WeaponRegistry.getWeaponDefinition(item.itemId);
              if (def && def.armor) totalBaseArmor += def.armor;
          }
      });
      });

      // Attributes? (e.g. +Armor on ring)
      // let attrBonus = 0;

      const wpBonusPct = this.getWillpowerBonusPercent();
      const wpMultiplier = 1 + (wpBonusPct / 100);
      
      const finalTotal = Math.floor(totalBaseArmor * wpMultiplier);
      
      return {
          base: totalBaseArmor,
          wpBonusPct,
          finalTotal
      };
  }

  public getTotalArmor(): number {
      return StatManager.getInstance().calculateStat("armor", this).finalValue;
  }

  public reconstructWorldState(): any {
    return new Map();
  }

  // --- TOOLTIP EVENTS ---
  public requestItemTooltip(item: DroppedItemData): void {
      this.emit("requestItemTooltip", item);
  }

  public clearItemTooltip(): void {
      this.emit("clearItemTooltip");
  }

  public requestItemDrop(itemId: string, count?: number, x?: number, y?: number) {
      this.emit("dropItem", itemId, count, x, y);
  }

  public requestPickup(itemUid: string, count?: number) {
      this.emit("requestPickup", { uid: itemUid, count });
  }

  public requestContainerItemDrop(containerId: string, itemUid: string, itemId: string, count: number) {
      this.emit("dropContainerItem", { containerId, itemUid, itemId, count });
  }

  // --- DRAG & DROP ---
  private dragOrigin: { x: number, y: number, level: string } | null = null;
  
  public startGroundDrag(data: GroundDragData): void {
    this.groundDragData = data;
    this.dragOrigin = { x: data.item.x, y: data.item.y, level: data.item.level || this.currentLevel };
    this.emit("startGroundDrag", data);
  }

  public validateDragDistance(playerX: number, playerY: number, level: string): boolean {
      if (!this.dragOrigin) return true; // No drag active or no origin tracked
      if (level !== this.dragOrigin.level) return false;

      const dist = Phaser.Math.Distance.Between(playerX, playerY, this.dragOrigin.x, this.dragOrigin.y);
      return dist <= (this.pickupRange * 1.5) + 32; // Allow slightly more than pickup range (buffer)
      // Standard pickup range is ~150. Buffer prevents flickering if right on edge.
  }

  public cancelGroundDrag(): void {
      if (!this.groundDragData) return;
      this.resetGroundDrag(); // Reuses existing reset logic
      this.emit("cancelDrag"); // Specific event for UI/Ghost cleanup
  }

  public endGroundDrag(success: boolean = false): void {
    if (!this.groundDragData) return;

    // Se sucesso (foi para o inventário), destrói o sprite do chão e remove da persistência
    if (success) {
      if (this.groundDragData.sprite && this.groundDragData.sprite.destroy) {
        this.groundDragData.sprite.destroy();
      }
      this.removePersistentDroppedItem(
        this.groundDragData.item.level,
        this.groundDragData.item.itemId
      );
    } else {
      // Se falhou (ex: peso excedido), torna visível novamente
      if (
        this.groundDragData.sprite &&
        (this.groundDragData.sprite as any).setVisible
      ) {
        (this.groundDragData.sprite as any).setVisible(true);
      }
    }
    this.groundDragData = null;
    this.dragOrigin = null; // Clear origin
    this.emit("endGroundDrag", success);
  }



  // --- WILLPOWER SYSTEM ---
  
  public getWillpowerExp() { return this.willpowerExp; }
  public getWillpowerTarget() { return this.willpowerTarget; }

  public getWillpowerTier(): number {
      if (this.willpowerTarget <= 0) return 0;
      const pct = this.willpowerExp / this.willpowerTarget;
      // Cap at 10 (100%)
      return Math.min(10, Math.floor(pct * 10));
  }

  public getWillpowerBonusPercent(): number {
      const tier = this.getWillpowerTier();
      if (tier === 10) return 15; // Mastery Bonus
      return tier; // 1% per tier
  }

  private updateWillpower(gainedXp: number) {
      // System active on Level 2+
      if (this.level < 2) {
          this.willpowerExp = 0;
          this.willpowerTarget = 0;
          return;
      }

      // Initialize Target if missing (First time hitting Lvl 2 or loading old save)
      if (this.willpowerTarget <= 0) {
          // Default Target for current level: XP(Lvl) - XP(Lvl-1)
          const currentBase = XPTable.getXPRequiredForLevel(this.level);
          const prevBase = XPTable.getXPRequiredForLevel(this.level - 1);
          this.willpowerTarget = Math.max(1, currentBase - prevBase);
      }

      // Add XP (Cap at Target)
      if (this.willpowerExp < this.willpowerTarget) {
          const oldTier = this.getWillpowerTier();
          this.willpowerExp = Math.min(this.willpowerTarget, this.willpowerExp + gainedXp);
          const newTier = this.getWillpowerTier();
          
          this.emit("willpowerUpdated", { 
              current: this.willpowerExp, 
              max: this.willpowerTarget, 
              tier: newTier 
          });


          if (newTier > oldTier) {
             // Log only (no red pop-up)
             this.log("msg_willpower_tier_up", { tier: newTier }, "#c084fc");
             // Specific event for UI effects
             this.emit("willpowerTierUp", newTier);
             // CRITICAL: Max Health changes with Willpower Tier
             this.emit("maxHealthChanged", this.getMaxHealth()); 
          }
      }
  }

  // Called on Death
  public resetWillpower() {
      if (this.level < 2) return;
      
      this.willpowerExp = 0;
      // Recalc Target based on CURRENT level difficulty
      // XP(Level) - XP(Level-1)
      const currentBase = XPTable.getXPRequiredForLevel(this.level);
      const prevBase = XPTable.getXPRequiredForLevel(this.level - 1);
      this.willpowerTarget = Math.max(1, currentBase - prevBase);
      
      this.emit("willpowerUpdated", { 
          current: this.willpowerExp, 
          max: this.willpowerTarget, 
          tier: 0
      });
      // Maybe emit a lost message?
      // Log only
      this.log("msg_willpower_lost", undefined, "#c084fc");
      // CRITICAL: Update Max Health HUD as tier drops to 0
      this.emit("maxHealthChanged", this.getMaxHealth());
  }

  public resetGroundDrag(): void {
      if (!this.groundDragData) return;
      this.emit("resetGroundDrag"); // Signal to DroppedItem to snap back
      this.endGroundDrag(false); // Cleanup state
  }

  // --- EQUIPAMENTOS ---
  // --- EQUIPMENT SYSTEM (UNIFIED) ---

  /**
   * Main entry point for equipping any item.
   * Resolves the item and slot, then delegates to the internal handler.
   */
  public equipItem(itemIdOrUid: string, targetSlot?: "helmet" | "armor" | "legs" | "boots" | "shield" | "weapon" | "neck" | "ring" | "ammo"): boolean {
    const currentState = PlayerState.getInstance();
    let index = currentState.inventory.findIndex(i => i.uid === itemIdOrUid);
    if (index === -1) {
       index = currentState.inventory.findIndex(i => i.itemId === itemIdOrUid);
    }
    
    if (index === -1) return false;
    
    const item = currentState.inventory[index];
    const def = WeaponRegistry.getWeaponDefinition(item.itemId);
    if (!def) return false;

    // Check for Torch Special Case
    const isTorch = item.itemId === "torch" || item.itemId === "light_torch";

    // Map item type to slot
    let slot: "helmet" | "armor" | "legs" | "boots" | "shield" | "weapon" | "neck" | "ring" | "ammo" | null = null;
    
    // Weapon Types List
    const WEAPON_TYPES = [
        ItemType.SWORD, ItemType.AXE, ItemType.CLUB, 
        ItemType.WAND, ItemType.ROD, ItemType.DISTANCE,
        ItemType.MELEE, ItemType.RANGED
    ];

    // 1. Explicit Target Slot (Drag & Drop)
    if (targetSlot) {
        // Validate if item matches target slot
        if (targetSlot === "weapon" && WEAPON_TYPES.includes(def.type)) slot = "weapon";
        else if (targetSlot === "weapon" && isTorch) slot = "weapon";
        else if (targetSlot === "shield" && (def.type === ItemType.SHIELD || isTorch)) slot = "shield";
        else if (targetSlot === "helmet" && def.type === ItemType.HELMET) slot = "helmet";
        else if (targetSlot === "armor" && def.type === ItemType.BODY_ARMOR) slot = "armor";
        else if (targetSlot === "legs" && def.type === ItemType.LEGS) slot = "legs";
        else if (targetSlot === "boots" && def.type === ItemType.BOOTS) slot = "boots";
        else if (targetSlot === "neck" && def.type === ItemType.AMULET) slot = "neck";
        else if (targetSlot === "ring" && def.type === ItemType.RING) slot = "ring";
        else if (targetSlot === "ammo" && def.type === ItemType.AMMUNITION) slot = "ammo";
        else {
            // Invalid slot for this item
            return false;
        }
    } else {
        // 2. Auto-Detect Slot (Double Click)
        if (isTorch) {
            // Smart Torch: Put in Weapon if empty, else Shield if empty, else Weapon (Swap)
            if (!this.equippedWeaponId) slot = "weapon";
            else if (!this.equippedShieldId) slot = "shield";
            else slot = "weapon";
        }
        else if (WEAPON_TYPES.includes(def.type)) slot = "weapon";
        else if (def.type === ItemType.SHIELD) slot = "shield";
        else if (def.type === ItemType.HELMET) slot = "helmet";
        else if (def.type === ItemType.BODY_ARMOR) slot = "armor";
        else if (def.type === ItemType.LEGS) slot = "legs";
        else if (def.type === ItemType.BOOTS) slot = "boots";
        else if (def.type === ItemType.AMULET) slot = "neck";
        else if (def.type === ItemType.RING) slot = "ring";
        else if (def.type === ItemType.AMMUNITION) slot = "ammo";
    }

    if (!slot) return false;

    return this.equipInternal(index, slot, def);
  }

  /**
   * Internal method to handle the actual swap of items.
   * Handles object persistence (stars/attributes) for ALL slots.
   */
  private equipInternal(inventoryIndex: number, slot: "helmet" | "armor" | "legs" | "boots" | "shield" | "weapon" | "neck" | "ring" | "ammo", def: WeaponDefinition): boolean {
      const itemToEquip = this.inventory[inventoryIndex];
      
      // Determine state keys based on slot
      let idKey: keyof PlayerState;
      let itemKey: keyof PlayerState;
      
      switch(slot) {
          case "weapon": idKey = "equippedWeaponId"; itemKey = "equippedWeaponItem"; break;
          case "shield": idKey = "equippedShieldId"; itemKey = "equippedShieldItem"; break;
          case "helmet": idKey = "equippedHelmetId"; itemKey = "equippedHelmetItem"; break;
          case "armor":  idKey = "equippedArmorId";  itemKey = "equippedArmorItem"; break;
          case "legs":   idKey = "equippedLegsId";   itemKey = "equippedLegsItem"; break;
          case "boots":  idKey = "equippedBootsId";  itemKey = "equippedBootsItem"; break;
          case "neck":   idKey = "equippedNeckId";   itemKey = "equippedNeckItem"; break;
          case "ring":   idKey = "equippedRingId";   itemKey = "equippedRingItem"; break;
          case "ammo":   idKey = "equippedAmmoId";   itemKey = "equippedAmmoItem"; break;
          default: return false;
      }

      // 1. Get currently equipped item (if any) to swap back
      const oldEquippedItem = (this as any)[itemKey] as InventoryItem | null;

      // 2. Remove new item from inventory
      this.inventory.splice(inventoryIndex, 1);

      // 3. Unequip current (clear keys)
      (this as any)[idKey] = null;
      (this as any)[itemKey] = null;

      // 4. Return old item to inventory (if exists)
      if (oldEquippedItem) {
          this.inventory.push(oldEquippedItem);
      }

      // 5. Equip new item
      (this as any)[idKey] = itemToEquip.itemId;
      (this as any)[itemKey] = itemToEquip;

      // 6. Emit events
      this.emit("inventoryUpdated");
      this.emit("equipmentChanged"); // Generic update for all slots
      
      // Legacy/Specific events for UI compat
      if (slot === "weapon") this.emit("weaponEquipped", def);
      if (slot === "shield") this.emit("shieldEquipped", def);

      this.recalculateMaxHealth();
      return true;
  }

  // Wrapper for backward compatibility or direct usage
  public equipWeapon(id: string) { return this.equipItem(id, "weapon"); }
  public equipShield(id: string) { return this.equipItem(id, "shield"); }
  public equipGear(id: string, s: any) { return this.equipItem(id); } // Legacy

  /**
   * Recalculates Max Health based on StatManager (Level + Equipment + Buffs)
   * and clamps current health if necessary.
   */
  public recalculateMaxHealth(): void {
      const result = StatManager.getInstance().calculateStat("maxHealth", this);
      const newMax = result.finalValue;

      if (this.maxHealth !== newMax) {

          this.maxHealth = newMax;
          this.emit("maxHealthChanged", this.maxHealth);
          
          // Clamp Current HP
          if (this.health > this.maxHealth) {
              this.health = this.maxHealth;
              this.emit("healthChanged", this.health);
          }
      }
  }

  public unequipItem(slot: "helmet" | "armor" | "legs" | "boots" | "shield" | "weapon" | "neck" | "ring" | "ammo"): boolean {
     // Determine keys
     let idKey: keyof PlayerState;
     let itemKey: keyof PlayerState;

     switch(slot) {
         case "weapon": idKey = "equippedWeaponId"; itemKey = "equippedWeaponItem"; break;
         case "shield": idKey = "equippedShieldId"; itemKey = "equippedShieldItem"; break;
         case "helmet": idKey = "equippedHelmetId"; itemKey = "equippedHelmetItem"; break;
         case "armor":  idKey = "equippedArmorId";  itemKey = "equippedArmorItem"; break;
         case "legs":   idKey = "equippedLegsId";   itemKey = "equippedLegsItem"; break;
         case "boots":  idKey = "equippedBootsId";  itemKey = "equippedBootsItem"; break;
         case "neck":   idKey = "equippedNeckId";   itemKey = "equippedNeckItem"; break;
         case "ring":   idKey = "equippedRingId";   itemKey = "equippedRingItem"; break;
         case "ammo":   idKey = "equippedAmmoId";   itemKey = "equippedAmmoItem"; break;
         default: return false;
     }

     const currentItem = (this as any)[itemKey] as InventoryItem | null;
     const currentId = (this as any)[idKey] as string | null;
     
     if (!currentId) return false;

     // STRICT VALIDATION: Try to add back to inventory
     let success = false;
     
     if (currentItem) {
         // Using addItem to enforce weight/cap check even for existing object
         // We pass null UID? No, we want to keep properties.
         // addItem(id, count, uid, stars, attrs)
         success = this.addItem(currentId, currentItem.count, currentItem.uid, currentItem.stars, currentItem.attributes);
     } else {
         success = this.addItem(currentId, 1);
     }

     if (!success) return false;

     // Clear slot
     (this as any)[idKey] = null;
     (this as any)[itemKey] = null;
     
     this.emit("inventoryUpdated");
     this.emit("equipmentChanged");

     if (slot === "weapon") this.emit("weaponEquipped", null);
     if (slot === "shield") this.emit("shieldEquipped", null);

     this.recalculateMaxHealth();

     return true;
  }

  // Specific unequip wrappers (can keep for now or deprecate)
  public unequipWeapon(): boolean { return this.unequipItem("weapon"); }
  public unequipShield(): boolean { return this.unequipItem("shield"); }

  public getEquippedItem(slot: "helmet" | "armor" | "legs" | "boots" | "shield" | "weapon"): WeaponDefinition | null {
     if(slot === "weapon") return this.getEquippedWeapon();
     if(slot === "shield") return this.getEquippedShield();
     
     let id: string | null = null;
     if(slot === "helmet") id = this.equippedHelmetId;
     if(slot === "armor") id = this.equippedArmorId;
     if(slot === "legs") id = this.equippedLegsId;
     if(slot === "boots") id = this.equippedBootsId;

     if(id) return WeaponRegistry.getWeaponDefinition(id) || null;
     return null;
  }

  public getEquippedItemObject(slot: "helmet" | "armor" | "legs" | "boots" | "shield" | "weapon"): InventoryItem | null {
      if(slot === "weapon") return this.equippedWeaponItem || (this.equippedWeaponId ? { itemId: this.equippedWeaponId, count: 1, uid: "equipped_weapon" } as InventoryItem : null);
      if(slot === "shield") return this.equippedShieldItem || (this.equippedShieldId ? { itemId: this.equippedShieldId, count: 1, uid: "equipped_shield" } as InventoryItem : null);
      
      let id: string | null = null;
      let item: InventoryItem | null = null;

      if(slot === "helmet") { id = this.equippedHelmetId; item = this.equippedHelmetItem; }
      if(slot === "armor") { id = this.equippedArmorId; item = this.equippedArmorItem; }
      if(slot === "legs") { id = this.equippedLegsId; item = this.equippedLegsItem; }
      if(slot === "boots") { id = this.equippedBootsId; item = this.equippedBootsItem; }

      if(item) return item;
      if(id) return { itemId: id, count: 1, uid: `equipped_${slot}` } as InventoryItem;
      
      return null;
  }

  public getEquippedWeapon(): WeaponDefinition | null {
    if (!this.equippedWeaponId) return null;
    return WeaponRegistry.getWeaponDefinition(this.equippedWeaponId) || null;
  }

  public getEquippedBoots(): WeaponDefinition | null {
      return this.equippedBootsId
        ? (WeaponRegistry.getWeaponDefinition(this.equippedBootsId) || null)
        : null;
  }

  /**
   * Unified accessor for equipped items using EquipmentSlot enum keys.
   * Dictionary-style access or switch-case.
   */
  public getEquippedItemInSlot(slot: string): InventoryItem | null {
      switch(slot) {
          case "head": return this.equippedHelmetItem;
          case "neck": return this.equippedNeckItem;
          case "body": return this.equippedArmorItem;
          case "legs": return this.equippedLegsItem;
          case "boots": return this.equippedBootsItem;
          case "mainHand": return this.equippedWeaponItem;
          case "offHand": return this.equippedShieldItem;
          case "ring": return this.equippedRingItem;
          case "ammo": return this.equippedAmmoItem;
          
          // Compat with older keys if necessary (though we try to move to Enum)
          case "weapon": return this.equippedWeaponItem;
          case "shield": return this.equippedShieldItem;
          case "armor": return this.equippedArmorItem; // ambiguous with body?
          case "helmet": return this.equippedHelmetItem;
          
          default: return null;
      }
  }


  


  // Deprecating special shield inventory ops for standard item ops
  public addShieldToInventory(id: string) { this.addItem(id); }
  public removeShieldFromInventory(id: string) { this.removeItem(id); }

  public getEquippedShield(): WeaponDefinition | null {
    if (!this.equippedShieldId) return null;
    return WeaponRegistry.getWeaponDefinition(this.equippedShieldId) || null;
  }
  public getShieldInventory(): ShieldDefinition[] {
    return this.shieldInventoryIds
      .map((id) => ShieldRegistry.getShieldDefinition(id))
      .filter((s): s is ShieldDefinition => !!s);
  }

  public toggleEquippedTorch(): boolean {
      let toggled = false;

      // Check Weapon Slot
      if (this.equippedWeaponId === "torch") {
          this.equippedWeaponId = "light_torch";
          toggled = true;
      } else if (this.equippedWeaponId === "light_torch") {
          this.equippedWeaponId = "torch";
          toggled = true;
      }

      // Check Shield Slot
      if (this.equippedShieldId === "torch") {
          this.equippedShieldId = "light_torch";
          toggled = true;
      } else if (this.equippedShieldId === "light_torch") {
          this.equippedShieldId = "torch";
          toggled = true;
      }

      if (toggled) {
          this.emit("equipmentChanged");
          this.emit("inventoryUpdated");
          this.emit("weaponEquipped", this.getEquippedWeapon());
          this.emit("torchToggled");
          return true;
      }

      return false;
  }

  public isTorchLit(): boolean {
      return this.equippedWeaponId === "light_torch" || this.equippedShieldId === "light_torch";
  }

  public lightTorch(): boolean {
      // Only toggle if we have an unlit torch equipped and no lit torch (or simpler: just try to toggle unlit ones)
      // Actually toggleEquippedTorch toggles ALL. 
      // We want to ensure we result in LIT state.
      // If toggleEquippedTorch flips everything, we might extinguish one while lighting another?
      // Let's rely on toggleEquippedTorch logic which swaps explicitly.
      
      // If currently unlit, toggle will make it lit.
      if (!this.isTorchLit()) {
          return this.toggleEquippedTorch();
      }
      return false;
  }

  public extinguishTorch(): boolean {
      // If currently lit, toggle will make it unlit.
      if (this.isTorchLit()) {
          return this.toggleEquippedTorch();
      }
      return false;
  }

  /**
   * Tries to use an item from inventory.
   * If Consumable -> Delegate to Manager.
   * If Equippable -> Equip it.
   */
  public useInventoryItem(index: number): boolean {
      const item = this.inventory[index];
      if (!item) return false;

      const def = WeaponRegistry.getWeaponDefinition(item.itemId);
      if (!def) return false;

      // 1. Try as Consumable
      const consumable = this.consumableManager.adaptToConsumable(def);
      if (consumable) {
          const success = this.consumableManager.useItem(consumable);
          if (success && consumable.consumesOnUse) {
              this.removeItemAtIndex(index, 1);
          }
          return success;
      }

      // 2. Try as Equippable (Smart Equip Logic)
      return this.requestEquip(item.uid);
  }

  public removeItemAtIndex(index: number, count: number = 1) {
      if (index < 0 || index >= this.inventory.length) return;

      const item = this.inventory[index];
      if (item.count > count) {
          item.count -= count;
          this.emit("itemQuantityChanged", item.uid, item.count);
      } else {
          this.inventory.splice(index, 1);
          this.emit("itemRemoved", item.uid);
      }
      this.emit("inventoryUpdated");
  }

  public toggleInventoryItem(uid: string): boolean {
      const item = this.inventory.find(i => i.uid === uid);
      if (!item) return false;

      let toggled = false;
      if (item.itemId === "torch") {
          item.itemId = "light_torch";
          toggled = true;
      } else if (item.itemId === "light_torch") {
          item.itemId = "torch";
          toggled = true;
      }

      if (toggled) {
          this.emit("inventoryUpdated");
      }
      return toggled;
  }

  public toggleContainerItem(containerId: string, itemUid: string): boolean {
      const items = this.containers.get(containerId);
      if (!items) return false;

      const item = items.find(i => i.uid === itemUid);
      if (!item) return false;

      let toggled = false;
      if (item.itemId === "torch") {
          item.itemId = "light_torch";
          toggled = true;
      } else if (item.itemId === "light_torch") {
          item.itemId = "torch";
          toggled = true;
      }

      if (toggled) {
          this.emit("containerUpdated", containerId);
          this.emit("inventoryUpdated"); // For weight/visual sync if needed
      }
      return toggled;
  }

  public toggleGroundItem(itemUid: string): boolean {
      let found = false;
      this.droppedItems.forEach((items, level) => {
          const item = items.find(i => i.itemId === itemUid);
          if (item) {
              if (item.weaponId === "torch") {
                  item.weaponId = "light_torch";
                  found = true;
              } else if (item.weaponId === "light_torch") {
                  item.weaponId = "torch";
                  found = true;
              }
          }
      });
      
      if (found) {
          this.emit("torchToggled"); // Notify GameScene to refresh sprites
      }
      return found;
  }

  // --- OVERBURDEN SYSTEM ---
  public getSpeedPenaltyMultiplier(): number {
      const currentWeight = this.getCurrentWeight();
      const capacity = this.getCapacity();
      
      if (currentWeight <= capacity) return 1.0;
      
      const excess = currentWeight - capacity;
      const ratio = excess / capacity;
      
      // New Formula: 50% Excess = 100% Penalty (Immobile)
      // 10% Excess = ? -> 1 - (0.1 * 2) = 0.8 (20% Penalty)
      return Math.max(0, 1.0 - (ratio * 2));
  }

  public generateUID(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  public getPosition() {
    return this._currentPosition;
  }
  public recordPlayerPosition(level: string, x: number, y: number) {
    this._currentPosition = { x, y, level };
  }

  public getCurrentLevel() {
    return this.currentLevel;
  }

  public isFallSafetyEnabled(): boolean {
      return this.fallSafetyEnabled;
  }

  public toggleFallSafety(): boolean {
      this.fallSafetyEnabled = !this.fallSafetyEnabled;
      this.emit("fallSafetyChanged", this.fallSafetyEnabled);
      return this.fallSafetyEnabled;
  }

  public isDebugCollisionEnabled(): boolean {
    return this._debugCollision;
  }

  public toggleDebugCollision(): boolean {
    this._debugCollision = !this._debugCollision;
    this.emit("debugCollisionChanged", this._debugCollision);
    return this._debugCollision;
  }

  public setLimitCapacity(value: boolean) {
    this.limitCapacity = value;
  }

  public setCurrentLevel(level: string) {
    if (this.currentLevel !== level) {
      this.currentLevel = level;
      this._currentPosition.level = level;
      this.emit("minimapUpdated", level);
    }
  }

  public getHealth() {
    return this.health;
  }
  public getDisplayedHealth() {
      return Math.floor(this.health);
  }
  public isDead(): boolean {
      return Math.floor(this.health) <= 0;
  }
  public getMaxHealth() {
    return StatManager.getInstance().calculateStat("maxHealth", this).finalValue;
  }
  public getBaseMaxHealth() {
      return this.maxHealth;
  }

  public gainHealth(amount: number) {
      if (this.isDead()) return;
      const max = this.getMaxHealth();
      this.health = Math.min(max, this.health + amount);
      this.emit("healthChanged", this.health, max);
      
      // Visual Feedback
      this.emit("uiNotification", {
          type: "heal",
          message: `+${amount}`,
          color: "#4ade80" // Green
      });
  }
  public getLevel() {
    return this.level;
  }
  public getExperience() {
    return this.experience;
  }
  public getPlayTime(): number {
    return this.playTime + Math.floor((Date.now() - this.sessionStartTime) / 1000);
  }

  // --- CURRENCY (GC) ---
  public getBalance(): number {
      return this.balance;
  }
  
  public addBalance(amount: number): void {
      this.balance += Math.floor(Math.max(0, amount));
      this.emit("balanceChanged", this.balance);
      this.log("currency_gain", { amount, total: this.balance }, "#ffd700");
      this.emit("message", `+${amount} GC`);
  }
  
  public removeBalance(amount: number): boolean {
      if (this.balance >= amount) {
          this.balance -= Math.floor(Math.max(0, amount));
          this.emit("balanceChanged", this.balance);
          return true;
      }
      return false;
  }

  public setHealth(v: number) {
    this.health = v;
    this.emit("healthChanged", v);
  }
  public setMaxHealth(v: number) {
    this.maxHealth = v;
    this.emit("maxHealthChanged", v);
  }
  public setLevel(v: number) {
    this.level = v;
  }
  public setExperience(v: number) {
    this.experience = v;
    this.emit("experienceChanged", v);
    
    // Check Level Up handled elsewhere? 
    // Usually addExperience calls setExperience.
    // Wait, addExperience logic is separate? Let's check hooks.
    // Assuming addExperience triggers this.
  }
  

  public setAttackDamage(v: number) {
    this.attackDamage = v;
  }


  public getStrengthExperience() {
    return this.strength.experience;
  }

  public setStrengthExperience(v: number) {
    this.strength.experience = v;
  }


  public getDexterityExperience() {
    return this.dexterity.experience;
  }

  public setDexterityExperience(v: number) {
    this.dexterity.experience = v;
  }


  public getReflexExperience() {
    return this.reflex.experience;
  }

  public setReflexExperience(v: number) {
    this.reflex.experience = v;
  }


  public getIntelligenceExperience() {
    return this.intelligence.experience;
  }

  public setIntelligenceExperience(v: number) {
    this.intelligence.experience = v;
  }

  public gainExperience(amount: number) {
    const oldLevel = this.level;
    const oldXP = this.experience;
    
    this.experience += amount;
    this.updateWillpower(amount);

    const oldInfo = XPTable.getLevelInfo(oldXP);
    const info = XPTable.getLevelInfo(this.experience);
    
    // Calculate progress for UI
    let startProgress = oldInfo.progress;
    let endProgress = info.progress;

    // If level up, we start the bar from 0 in the new level 
    // (matches user's request: "vai encher já a partir do nivel 30")
    if (info.level > oldInfo.level) {
        startProgress = 0;
    }

    // Emit Notification
    this.emit("uiNotification", {
        type: "exp",
        message: t_game("notif_exp").replace("{xp}", amount.toString()),
        value: amount,
        startProgress,
        endProgress
    });

    this.emit("experienceChanged", this.experience);
    if (info.level > oldLevel) {
      this.level = info.level;

      // Calculate Levels Gained
      const levelsGained = this.level - oldLevel;
      
      // FIX: Enforce Minimum Max Health based on Level Formula
      // Base (100) + (Level-1)*5
      const expectedMaxHP = 100 + (this.level - 1) * 5;
      
      if (this.maxHealth < expectedMaxHP) {
          // If current max is less than formula, snap to formula!
          this.maxHealth = expectedMaxHP;
      } else {
          // Otherwise just add +5 per level
          this.maxHealth += (5 * levelsGained);
      }

      // Same for Base Speed
      this.baseSpeed += (4 * levelsGained); 
      
      // --- WILLPOWER SCALING ---
      // Update Target for new level, but PRESERVE the current percentage (Tier) 
      const oldTarget = this.willpowerTarget;
      const oldExp = this.willpowerExp;

      if (oldTarget > 0) {
          const currentXpReq = XPTable.getXPRequiredForLevel(this.level);
          const prevXpReq = XPTable.getXPRequiredForLevel(this.level - 1);
          const newTarget = Math.max(1, currentXpReq - prevXpReq);
          
          // Scale Exp to match new Target
          const ratio = oldExp / oldTarget;
          this.willpowerTarget = newTarget;
          // Use round to prevent precision loss dropping a Tier
          this.willpowerExp = Math.round(newTarget * ratio);

          this.emit("willpowerUpdated", { 
              current: this.willpowerExp, 
              max: this.willpowerTarget, 
              tier: this.getWillpowerTier() 
          });
      }

      // Heal to FULL EFFECTIVE health
      this.health = this.getMaxHealth();
      
      // Emit updates for UI
      this.emit("maxHealthChanged", this.getMaxHealth());
      this.emit("healthChanged", this.health);

      this.emit("levelUp", { newLevel: this.level, oldLevel: oldLevel });
      this.log("combat_level_up", { old: oldLevel, new: this.level }, "#fbbf24");
      this.emit("skyrimSkillUp", { type: "level", level: this.level });
    }
  }

  public gainStrengthExperience(amount: number): boolean {
    const old = this.strength.level;
    this.strength.experience += amount;
    const info = StrengthXpTable.getLevelInfo(this.strength.experience);
    if (info.level > old) {
      this.strength.level = info.level;
      this.emit("strengthExperienceChanged", {
        level: info.level,
        experience: this.strength.experience,
      });
      this.log("combat_skill_up", { skill: "Strength", level: info.level }, "#fbbf24");
      this.emit("skyrimSkillUp", { type: "strength", level: info.level });
      return true;
    }
    this.emit("strengthExperienceChanged", {
      level: this.strength.level,
      experience: this.strength.experience,
    });
    return false;
  }

  public gainDexterityExperience(amount: number): boolean {
    const old = this.dexterity.level;
    this.dexterity.experience += amount;
    const info = DexterityXpTable.getLevelInfo(this.dexterity.experience);
    if (info.level > old) {
      this.dexterity.level = info.level;
      this.emit("dexterityExperienceChanged", {
        level: info.level,
        experience: this.dexterity.experience,
      });
      this.log("combat_skill_up", { skill: "Dexterity", level: info.level }, "#fbbf24");
      this.emit("skyrimSkillUp", { type: "dexterity", level: info.level });
      return true;
    }
    this.emit("dexterityExperienceChanged", {
      level: this.dexterity.level,
      experience: this.dexterity.experience,
    });
    return false;
  }

  public gainReflexExperience(amount: number): boolean {
    const old = this.reflex.level;
    this.reflex.experience += amount;
    const info = ReflexXpTable.getLevelInfo(this.reflex.experience);
    if (info.level > old) {
      this.reflex.level = info.level;
      this.emit("reflexExperienceChanged", {
        level: info.level,
        experience: this.reflex.experience,
      });
      this.log("combat_skill_up", { skill: "Reflex", level: info.level }, "#fbbf24");
      this.emit("skyrimSkillUp", { type: "reflex", level: info.level });
      return true;
    }
    this.emit("reflexExperienceChanged", {
      level: this.reflex.level,
      experience: this.reflex.experience,
    });
    return false;
  }

  public gainIntelligenceExperience(amount: number): boolean {
    const old = this.intelligence.level;
    this.intelligence.experience += amount;
    const info = IntelligenceXpTable.getLevelInfo(this.intelligence.experience);
    if (info.level > old) {
      this.intelligence.level = info.level;
      this.emit("intelligenceExperienceChanged", {
        level: info.level,
        experience: this.intelligence.experience,
      });
      this.log("combat_skill_up", { skill: "Intelligence", level: info.level }, "#fbbf24");
      this.emit("skyrimSkillUp", { type: "intelligence", level: info.level });
      return true;
    }
    this.emit("intelligenceExperienceChanged", {
      level: this.intelligence.level,
      experience: this.intelligence.experience,
    });
    return false;
  }

  // --- ATTRIBUTE SETTERS (CHEATS/DEBUG) ---
  public setStrengthLevel(level: number): void {
      this.strength.level = level;
      this.strength.experience = StrengthXpTable.getXPRequiredForLevel(level);
      
      this.emit("strengthExperienceChanged", {
          level: this.strength.level,
          experience: this.strength.experience
      });
      this.recalculateMaxHealth();
      this.emit("statsUpdated");
  }

  public setDexterityLevel(level: number): void {
      this.dexterity.level = level;
      this.dexterity.experience = DexterityXpTable.getXPRequiredForLevel(level);

      this.emit("dexterityExperienceChanged", {
          level: this.dexterity.level,
          experience: this.dexterity.experience
      });
      // Speed update?
      this.emit("statsUpdated");
  }

  public setReflexLevel(level: number): void {
      this.reflex.level = level;
      this.reflex.experience = ReflexXpTable.getXPRequiredForLevel(level);

      this.emit("reflexExperienceChanged", {
          level: this.reflex.level,
          experience: this.reflex.experience
      });
      this.emit("statsUpdated");
  }

  public setIntelligenceLevel(level: number): void {
      this.intelligence.level = level;
      this.intelligence.experience = IntelligenceXpTable.getXPRequiredForLevel(level);

      this.emit("intelligenceExperienceChanged", {
          level: this.intelligence.level,
          experience: this.intelligence.experience
      });
      this.setMaxMana(this.intelligence.level * 10); // Example mana scaling
      this.emit("statsUpdated");
  }

  public getBaseStrengthLevel(): number { return this.strength.level; }
  public getBaseDexterityLevel(): number { return this.dexterity.level; }
  public getBaseReflexLevel(): number { return this.reflex.level; }
  public getBaseIntelligenceLevel(): number { return this.intelligence.level; }

  // --- TOTAL STAT GETTERS (Base + Modifiers) ---
  public getStrengthLevel(): number {
      return StatManager.getInstance().calculateStat("strength", this).finalValue;
  }
  public getDexterityLevel(): number {
      return StatManager.getInstance().calculateStat("dexterity", this).finalValue;
  }
  public getReflexLevel(): number {
      return StatManager.getInstance().calculateStat("reflex", this).finalValue;
  }
  public getIntelligenceLevel(): number {
      return StatManager.getInstance().calculateStat("intelligence", this).finalValue;
  }

  public takeDamage(amount: number): boolean {
    this.health = Math.max(0, this.health - amount);
    this.emit("healthChanged", this.health);
    return this.isDead();
  }

  public exploreArea(
    level: string,
    centerX: number,
    centerY: number,
    radius: number,
    mapWidth: number,
    mapHeight: number
  ): void {
    if (!this.exploredAreas.has(level)) {
      const grid = Array(mapHeight)
        .fill(false)
        .map(() => Array(mapWidth).fill(false));
      this.exploredAreas.set(level, grid);
    }
    const grid = this.exploredAreas.get(level)!;
    let changed = false;
    for (let y = centerY - radius; y <= centerY + radius; y++) {
      for (let x = centerX - radius; x <= centerX + radius; x++) {
        if (y >= 0 && y < mapHeight && x >= 0 && x < mapWidth) {
          if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2) {
            if (!grid[y][x]) {
              grid[y][x] = true;
              changed = true;
            }
          }
        }
      }
    }
    if (changed) this.emit("minimapUpdated", level);
  }

  public getExploredArea(level: string) {
    return this.exploredAreas.get(level);
  }

  public addPersistentDroppedItem(level: string, item: DroppedItemData): void {
      const items = this.droppedItems.get(level) || [];
      // Prevent duplicates based on unique ID
      if (!items.some(i => i.itemId === item.itemId)) {
          // Normalize count
          if (!item.count) item.count = 1;
          
          items.push(item);
          this.droppedItems.set(level, items);
          // console.log(`[PlayerState] Added persistent item: ${item.itemId} (Total: ${items.length})`);
      } else {
          // console.warn(`[PlayerState] Duplicate persistent item ignored: ${item.itemId}`);
      }
  }
  public getPersistentDroppedItems(level: string) {
    return this.droppedItems.get(level) || [];
  }
  public removePersistentDroppedItem(level: string, itemId: string) {
    const items = this.droppedItems.get(level) || [];
    this.droppedItems.set(
      level,
      items.filter((i) => i.itemId !== itemId)
    );
  }

  public recordEnemyChange(l: string, e: any) {
    this.emit("enemyChanged", { level: l, enemy: e });
  }
  public recordItemChange(l: string, i: any) {
    this.emit("itemChanged", { level: l, item: i });
  }

  public log(key: string, params?: any, color?: string) {
      this.emit("log", key, params, color);
  }

  // --- ATTRIBUTE SCALING ---
  public getEquippedItems(): InventoryItem[] {
      const items: InventoryItem[] = [];
      const slots = ["weapon", "shield", "helmet", "armor", "legs", "boots", "ring", "amulet"] as const;
      
      for(const slot of slots) {
          const item = this.getEquippedItemInSlot(slot === "weapon" ? "main_hand" : (slot === "shield" ? "off_hand" : slot) as any);
          if (item) items.push(item);
      }
      return items;
  }



  public getCriticalChance(): number {
      return StatManager.getInstance().getCriticalChance(this).finalValue;
  }

  public getCriticalDamageMultiplier(): number {
      return StatManager.getInstance().calculateStat("melee_crit_damage", this).finalValue;
  }

  public getAttackBonusPercentage(): number {
      return StatManager.getInstance().calculateStat("melee_max_damage", this).finalValue;
  }

  public reset(): void {
    // Core Stats
    this.health = this.maxHealth;
    this.mana = this.maxMana;
    this.level = 1;
    this.experience = 0;
    this.attackDamage = 10; // Base?
    this.characterName = "";
    this.playTime = 0;
    this.sessionStartTime = Date.now();
    this.balance = 0;
    this.hunger = 0;

    // Skills
    this.strength = { level: 1, experience: 0 };
    this.dexterity = { level: 1, experience: 0 };
    this.intelligence = { level: 1, experience: 0 };
    this.reflex = { level: 1, experience: 0 };

    // Inventory & Equipment
    this.inventory = [];
    
    this.equippedWeaponId = "sword_t1"; // Start with sword? Or null? Let's give default sword.
    this.equippedShieldId = "torch"; // Start with torch?
    this.equippedHelmetId = null;
    this.equippedArmorId = null;
    this.equippedLegsId = null;
    this.equippedBootsId = null;
    this.equippedNeckId = null;
    this.equippedRingId = null;
    this.equippedAmmoId = null;

    this.equippedWeaponItem = null; // Should ideally regenerate item object
    this.equippedShieldItem = null;
    this.equippedHelmetItem = null;
    this.equippedArmorItem = null;
    this.equippedLegsItem = null;
    this.equippedBootsItem = null;
    this.equippedNeckItem = null;
    this.equippedRingItem = null;
    this.equippedAmmoItem = null;

    // Persistence
    this.activeBuffs.clear();
    this.droppedItems.clear();
    this.exploredAreas.clear();
    // this.visitedLevels? (checked before, variable name check needed)
    
    // Add Starting Items to Inventory (if not equipping directly)
    // Actually, equipping directly above is just IDs. We need valid item objects/logic.
    // Better strategy: Clear all, then use addItem/equipItem properly.
    
    this.equippedWeaponId = null;
    this.equippedShieldId = null;
    
    // Add defaults
    this.addItem("sword_t1", 1);
    this.addItem("torch", 1);

    // Auto-equip? Or let user do it? 
    // Usually starting with them in inventory is safer/standard.
    this.emit("hungerUpdated", 0);
  }

  public getName(): string { return this.characterName; }
  public getHunger(): number { return this.hunger; }








  public getEquipment(): any {
      return {
          "head": (this as any).equippedHelmetItem || null,
          "neck": (this as any).equippedNeckItem || null,
          "body": (this as any).equippedArmorItem || null,
          "legs": (this as any).equippedLegsItem || null,
          "boots": (this as any).equippedBootsItem || null, // Changed from 'feet' to 'boots'
          "mainHand": (this as any).equippedWeaponItem || null, // Changed from 'hand' to 'mainHand'
          "offHand": (this as any).equippedShieldItem || null, // Changed from 'shield_slot' to 'offHand'
          "ammo": (this as any).equippedAmmoItem || null,
          "ring": (this as any).equippedRingItem || null
      };
  }


  public getDroppedItemsMap() {
    return this.droppedItems;
  }
  public setDroppedItemsForLevel(level: string, items: DroppedItemData[]) {
    this.droppedItems.set(level, items);
  }

  public getExploredAreas() {
      return this.exploredAreas;
  }

  // --- VISITED LEVELS ---
  public hasVisitedLevel(level: string): boolean {
      return this.visitedLevels.has(level);
  }

  public markLevelVisited(level: string): void {
      this.visitedLevels.add(level);
  }

  public getVisitedLevels(): string[] {
      return Array.from(this.visitedLevels);
  }
  
  public setVisitedLevels(levels: string[]) {
      this.visitedLevels = new Set(levels);
  }

  public loadState(data: any, saveTimestamp?: number) { // saveTimestamp added
    if (!data) return;

    if (data.visitedLevels) {
        this.visitedLevels = new Set(data.visitedLevels);
    } else {
        this.visitedLevels.clear();
    }

    if (data.characterName) this.characterName = data.characterName;
    if (data.health !== undefined) this.health = data.health;
    if (data.level !== undefined) {
        this.level = data.level;
        // Sanitization: Recalculate MaxHealth based on Level to fix any save corruption
        this.level = data.level;
        // Sanitization: Recalculate MaxHealth based on Level to fix any save corruption
        const baseHealth = 100;
        // Adjusted to 5 HP per level (User Request)
        this.maxHealth = baseHealth + (this.level - 1) * 5;
        // Adjusted to 4 Speed per level (User Request) & Fix missing load logic
        this.baseSpeed = 400 + (this.level - 1) * 4;
        
        // Force update immediately
        this.emit("maxHealthChanged", this.getMaxHealth());
    }
    // if (data.maxHealth !== undefined) this.maxHealth = data.maxHealth; // Deprecated: Always calculated from Level
    if (data.experience !== undefined) this.experience = data.experience;
    if (data.attackDamage !== undefined) this.attackDamage = data.attackDamage;
    if (data.attackDamage !== undefined) this.attackDamage = data.attackDamage;

    // --- MIGRATION & LOAD ---
    // Strength (was Melee)
    if (data.skills && data.skills.strength) { // Modern
         this.strength.level = data.skills.strength.level;
         this.strength.experience = data.skills.strength.experience;
    } else if (data.skills && data.skills.melee) { // Nested Old
         this.strength.level = data.skills.melee.level;
         this.strength.experience = data.skills.melee.experience;
    } else if (data.meleeLevel !== undefined) { // Flat Old
         this.strength.level = data.meleeLevel;
         this.strength.experience = data.meleeExperience || 0;
    }

    // Dexterity (was Range)
    if (data.skills && data.skills.dexterity) {
         this.dexterity.level = data.skills.dexterity.level;
         this.dexterity.experience = data.skills.dexterity.experience;
    } else if (data.skills && data.skills.range) {
         this.dexterity.level = data.skills.range.level;
         this.dexterity.experience = data.skills.range.experience;
    } else if (data.rangeLevel !== undefined) {
         this.dexterity.level = data.rangeLevel;
         this.dexterity.experience = data.rangeExperience || 0;
    }

    // Reflex (was Defense Skill)
    if (data.skills && data.skills.reflex) {
         this.reflex.level = data.skills.reflex.level;
         this.reflex.experience = data.skills.reflex.experience;
    } else if (data.skills && data.skills.defense) {
         this.reflex.level = data.skills.defense.level;
         this.reflex.experience = data.skills.defense.experience;
    } else if (data.defenseLevel !== undefined) {
         this.reflex.level = data.defenseLevel;
         this.reflex.experience = data.defenseExperience || 0;
    }
    
    // Intelligence (New)
    if (data.skills && data.skills.intelligence) {
         this.intelligence.level = data.skills.intelligence.level;
         this.intelligence.experience = data.skills.intelligence.experience;
    } else {
         // Default
         this.intelligence = { level: 1, experience: 0 };
    }

    if (data.playTime !== undefined) this.playTime = data.playTime;
    if (data.balance !== undefined) this.balance = data.balance;
    this.sessionStartTime = Date.now(); // Always reset session start time on load
    
    // Inventory
    this.inventory = [];
    if (data.inventory) {
        data.inventory.forEach((item: any) => {
            this.inventory.push({
                uid: item.uid || this.generateUID(),
                itemId: item.itemId,
                count: item.count,
                stars: item.stars,
                attributes: item.attributes
            });
        });
    }

    // Restore Active Buffs
    if (data.activeBuffs && Array.isArray(data.activeBuffs)) {
        this.activeBuffs.clear();
        const now = Date.now();
        const elapsed = saveTimestamp ? (now - saveTimestamp) : 0;
        
        data.activeBuffs.forEach((buff: Buff) => {
            // Reduce duration by elapsed time since save
            const remaining = buff.duration - elapsed;
            
            if (remaining > 0) {
                // Re-apply buff
                this.addBuff(buff.id, buff.attr, buff.value, remaining, buff.isPercent);
            }
        });
    }

    this.equippedWeaponId = data.equippedWeaponId || null; 
    this.equippedWeaponItem = data.equippedWeaponItem || (this.equippedWeaponId ? { itemId: this.equippedWeaponId, count: 1, uid: "equipped_weapon" } : null);

    this.equippedShieldId = data.equippedShieldId || null; 
    this.equippedShieldItem = data.equippedShieldItem || (this.equippedShieldId ? { itemId: this.equippedShieldId, count: 1, uid: "equipped_shield" } : null);

    this.equippedHelmetId = data.equippedHelmetId || null;
    this.equippedHelmetItem = data.equippedHelmetItem || (this.equippedHelmetId ? { itemId: this.equippedHelmetId, count: 1, uid: "equipped_helmet" } : null);

    this.equippedArmorId = data.equippedArmorId || null;
    this.equippedArmorItem = data.equippedArmorItem || (this.equippedArmorId ? { itemId: this.equippedArmorId, count: 1, uid: "equipped_armor" } : null);

    this.equippedLegsId = data.equippedLegsId || null;
    this.equippedLegsItem = data.equippedLegsItem || (this.equippedLegsId ? { itemId: this.equippedLegsId, count: 1, uid: "equipped_legs" } : null);

    this.equippedBootsId = data.equippedBootsId || null;
    this.equippedBootsItem = data.equippedBootsItem || (this.equippedBootsId ? { itemId: this.equippedBootsId, count: 1, uid: "equipped_boots" } : null);
    this.shieldInventoryIds = data.shieldInventoryIds || []; // Ensure empty array if undefined
    
    // Persistent Items
    this.containers.clear();
    if (data.containers) {
        data.containers.forEach(([id, items]: [string, any[]]) => {
            this.containers.set(id, items);
        });
    }
    
    this.droppedItems.clear();
    if (data.persistentItems) {
        // Calculate Time Offset (Current Time - Save Time)
        // We add this offset to item.createdAt so that (Now - NewCreatedAt) == (SaveTime - OldCreatedAt) is NOT what we want.
        // We want (Now - NewCreatedAt) == (SaveTime - OldCreatedAt).
        // Let's do math:
        // Elapsed_Old = SaveTime - OldCreatedAt
        // Elapsed_New = Now - NewCreatedAt
        // We want Elapsed_New = Elapsed_Old
        // Now - NewCreatedAt = SaveTime - OldCreatedAt
        // NewCreatedAt = Now - (SaveTime - OldCreatedAt)
        // NewCreatedAt = Now - SaveTime + OldCreatedAt
        
        let timeShift = 0;
        if (saveTimestamp) {
            timeShift = Date.now() - saveTimestamp;
        }

        data.persistentItems.forEach(([level, items]: [string, any[]]) => {
            const seenIds = new Set<string>();
            const adjustedItems: any[] = [];

            items.forEach(item => {
                 // DEDUPLICATION: Check if ID was already processed in this level
                 if (seenIds.has(item.itemId)) {
                     // console.warn(`[PlayerState] Removing duplicate item ${item.itemId} from Level ${level} during Load`);
                     return;
                 }
                 seenIds.add(item.itemId);

                 if (item.createdAt && saveTimestamp) {
                     // Shift the creation time forward by the duration we were offline
                     // So if we were offline for 1 hour, createdAt moves forward by 1 hour.
                     item.createdAt = item.createdAt + timeShift;
                 }
                 adjustedItems.push(item);
            });
            this.droppedItems.set(level, adjustedItems);
        });
    }

    // Explored Areas
    this.exploredAreas.clear();
    if (data.exploredAreas) {
        data.exploredAreas.forEach(([level, area]: [string, boolean[][]]) => {
            this.exploredAreas.set(level, area);
        });
    }
    
    // Altar & Magic
    this.altarStorage.clear();
    if (data.altarStorage) {
        data.altarStorage.forEach(([id, items]: [string, any[]]) => {
            this.altarStorage.set(id, items);
        });
    }
    
    if (data.enchantedRunes) {
        this.enchantedRunes = data.enchantedRunes;
    } else {
        this.enchantedRunes = [];
    }
    
    // Force UI Update
    this.emit("reset");
    this.emit("inventoryUpdated");
    this.emit("healthChanged", this.health);
    this.emit("healthChanged", this.health);
    this.emit("experienceChanged", this.experience);
    this.emit("balanceChanged", this.balance);
    this.emit("maxHealthChanged", this.maxHealth);
    this.emit("maxHealthChanged", this.maxHealth);
    this.emit("strengthExperienceChanged", this.strength);
    this.emit("dexterityExperienceChanged", this.dexterity);
    this.emit("reflexExperienceChanged", this.reflex);
    this.emit("intelligenceExperienceChanged", this.intelligence);
    this.emit("stateLoaded"); // Added this emit as it was in the instruction
  }

  public setName(n: string) {
      this.characterName = n;
      this.emit("nameChanged", n);
  }


  public loadFromData(data: any) {
    if (!data) return;

    // Restore Name
    if (data.characterName) this.characterName = data.characterName;
    
    // Restore Core Vitals
    if (data.level !== undefined) this.level = data.level;
    if (data.experience !== undefined) this.experience = data.experience;
    
    // Skills
    if (data.meleeLevel !== undefined) this.strength.level = data.meleeLevel;
    else if(data.strengthLevel !== undefined) this.strength.level = data.strengthLevel;

    if (data.meleeExperience !== undefined) this.strength.experience = data.meleeExperience;
    else if (data.strengthExperience !== undefined) this.strength.experience = data.strengthExperience;

    if (data.rangeLevel !== undefined) this.dexterity.level = data.rangeLevel;
    else if (data.dexterityLevel !== undefined) this.dexterity.level = data.dexterityLevel;

    if (data.rangeExperience !== undefined) this.dexterity.experience = data.rangeExperience;
    else if (data.dexterityExperience !== undefined) this.dexterity.experience = data.dexterityExperience;
    
    if (data.defenseLevel !== undefined) this.reflex.level = data.defenseLevel;
    else if (data.reflexLevel !== undefined) this.reflex.level = data.reflexLevel;

    if (data.defenseExperience !== undefined) this.reflex.experience = data.defenseExperience;
    else if (data.reflexExperience !== undefined) this.reflex.experience = data.reflexExperience;

    if (data.intelligenceLevel !== undefined) {
         this.intelligence.level = data.intelligenceLevel;
         this.intelligence.experience = data.intelligenceExperience || 0;
    }
    
    // Hunger
    if (data.hunger !== undefined) this.hunger = data.hunger;
    
    // Willpower
    if (data.willpowerExp !== undefined) this.willpowerExp = data.willpowerExp;
    if (data.willpowerTarget !== undefined) this.willpowerTarget = data.willpowerTarget;
    
    // Equipment IDs
    // Equipment Items
    if (data.equippedWeaponId !== undefined) {
        this.equippedWeaponId = data.equippedWeaponId;
        this.equippedWeaponItem = data.equippedWeaponItem || (data.equippedWeaponId ? { itemId: data.equippedWeaponId, count: 1, uid: "equipped_weapon" } : null);
    }
    if (data.equippedShieldId !== undefined) {
        this.equippedShieldId = data.equippedShieldId;
        this.equippedShieldItem = data.equippedShieldItem || (data.equippedShieldId ? { itemId: data.equippedShieldId, count: 1, uid: "equipped_shield" } : null);
    }
    if (data.equippedHelmetId !== undefined) {
        this.equippedHelmetId = data.equippedHelmetId;
        this.equippedHelmetItem = data.equippedHelmetItem || (data.equippedHelmetId ? { itemId: data.equippedHelmetId, count: 1, uid: "equipped_helmet" } : null);
    }
    if (data.equippedArmorId !== undefined) {
        this.equippedArmorId = data.equippedArmorId;
        this.equippedArmorItem = data.equippedArmorItem || (data.equippedArmorId ? { itemId: data.equippedArmorId, count: 1, uid: "equipped_armor" } : null);
    }
    if (data.equippedLegsId !== undefined) {
        this.equippedLegsId = data.equippedLegsId;
        this.equippedLegsItem = data.equippedLegsItem || (data.equippedLegsId ? { itemId: data.equippedLegsId, count: 1, uid: "equipped_legs" } : null);
    }
    if (data.equippedBootsId !== undefined) {
        this.equippedBootsId = data.equippedBootsId;
        this.equippedBootsItem = data.equippedBootsItem || (data.equippedBootsId ? { itemId: data.equippedBootsId, count: 1, uid: "equipped_boots" } : null);
    }
    
    // New Slots
    if (data.equippedNeckId !== undefined) {
        this.equippedNeckId = data.equippedNeckId;
        this.equippedNeckItem = data.equippedNeckItem || (data.equippedNeckId ? { itemId: data.equippedNeckId, count: 1, uid: "equipped_neck" } : null);
    }
    if (data.equippedRingId !== undefined) {
        this.equippedRingId = data.equippedRingId;
        this.equippedRingItem = data.equippedRingItem || (data.equippedRingId ? { itemId: data.equippedRingId, count: 1, uid: "equipped_ring" } : null);
    }
    if (data.equippedAmmoId !== undefined) {
        this.equippedAmmoId = data.equippedAmmoId;
        this.equippedAmmoItem = data.equippedAmmoItem || (data.equippedAmmoId ? { itemId: data.equippedAmmoId, count: 1, uid: "equipped_ammo" } : null);
    }
    
    // Inventory
    this.inventory = [];
    if (data.inventory) {
        data.inventory.forEach((item: any) => {
            this.inventory.push({
                uid: item.uid || this.generateUID(),
                itemId: item.itemId,
                count: item.count,
                stars: item.stars,
                attributes: item.attributes
            });
        });
    }

    // Containers (MAP & INVENTORY)
    this.containers.clear();
    if (data.containers) {
        data.containers.forEach(([id, items]: [string, any[]]) => {
            this.containers.set(id, items);
        });
    }
    
    // Visited Levels
    this.visitedLevels.clear();
    if (data.visitedLevels) {
        data.visitedLevels.forEach((lvl: string) => this.visitedLevels.add(lvl));
    }
    
    // Persistent Items (Dropped on Ground)
    this.droppedItems.clear();
    if (data.persistentItems) {
        data.persistentItems.forEach(([level, items]: [string, any[]]) => {
            this.droppedItems.set(level, items);
        });
    }
    
    // Explored Areas
    this.exploredAreas.clear();
    if (data.exploredAreas) {
        data.exploredAreas.forEach(([level, area]: [string, boolean[][]]) => {
            this.exploredAreas.set(level, area);
        });
    }

    // Emit Updates to UI
    this.emit("reset");
    this.emit("stateLoaded");
    
    // Load Quests
    if (data.quests) {
        QuestManager.getInstance().loadSaveData(data.quests);
    }
    this.emit("inventoryUpdated");
    this.emit("healthChanged", this.health);
    // ... possibly others
  }

  public respawn(): void {
      this.resetWillpower();
      this.recalculateMaxHealth();
      this.health = this.maxHealth;
      this.emit("healthChanged", this.health);
  }

  public getWindowPosition(type: string) {
    return this.openWindows[type];
  }
  public setWindowPosition(type: string, x: number, y: number) {
    this.openWindows[type] = { x, y };
  }
  public update(time: number, delta: number): void {
      // Periodic updates (called by GameScene)
      this.statusTimer += delta;

      // Hunger Decay: -1 every 2 seconds (2000ms)
      if (time - this.lastHungerDecay > 2000) {
          this.hunger = Math.max(0, this.hunger - 1);
          this.lastHungerDecay = time;
          this.emit("hungerUpdated", this.hunger);
      }

      // Regeneration: Every 2 seconds (aligned with hunger for simplicity, or separate)
      if (time - this.lastRegen > 2000) {
          this.regenerateHealth();
          this.lastRegen = time;
      }

      // Update Buffs
      if (this.activeBuffs.size > 0) {
          this.activeBuffs.forEach((buff, key) => {
              buff.duration -= delta;
              if (buff.duration <= 0) {
                  this.removeBuff(key);
              }
          });
      }
  }

  // --- BUFF METHODS ---
  public addBuff(id: string, attr: string, value: number, duration: number, isPercent: boolean = false) {
      this.activeBuffs.set(id, { id, attr, value, duration, isPercent });
      this.emit("buffsChanged");
      this.emit("requestTooltipUpdate"); // Force tooltip refresh if open
  }

  public removeBuff(id: string) {
      if (this.activeBuffs.delete(id)) {
          this.emit("buffsChanged");
          this.emit("requestTooltipUpdate");
      }
  }

  public getBuffs(): Buff[] {
      return Array.from(this.activeBuffs.values());
  }

  public getBuffsSaveData(): Buff[] {
      return Array.from(this.activeBuffs.values());
  }

  public getHealthRegen(): number {
      const tier = this.getHungerTier();
      const regenBonusPct = tier * 0.2; // 0.2% per tier
      // Calculate based on Total Max Health (including buffs)
      // Allow float regen
      return Math.max(0, this.getMaxHealth() * (regenBonusPct / 100));
  }

  private regenerateHealth() {
      const maxHP = this.getMaxHealth();
      if (this.health >= maxHP) return;
      if (this.isDead()) return; // Dead players don't regen

      const regenAmount = this.getHealthRegen();
      
      if (regenAmount > 0) {
          this.setHealth(Math.min(maxHP, this.health + regenAmount));
      }
  }



  public getHungerTier(): number {
      // 0-100 = Tier 0? Or Tier 1?
      // "Cada tier de fome vai dar um bonus... checando ao tier 10"
      // 1000 Total. 10 Tiers = 100 each.
      // Stockpile (1001-2000) counts as Tier 10? Or just "Stock"?
      // Assuming Tier = Math.floor(hunger / 100). Max 10.
      return Math.min(10, Math.floor(this.hunger / 100));
  }

  public eatFood(amount: number) {
      // Max 2000 (1000 normal + 1000 stock)
      this.hunger = Math.min(2000, this.hunger + amount);
      this.emit("hungerUpdated", this.hunger);
      this.log("msg_ate_food", { amount }, "#10b981");
  }
  
  public consumeItem(uid: string): boolean {
      const item = this.getInventoryItem(uid);
      if (!item) return false;
      
      const def = WeaponRegistry.getWeaponDefinition(item.itemId);
      if (!def || !def.consumable || def.type !== "food") return false;
      
      // Check Max Hunger Overflow
      const val = def.hungerValue || 0;
      if (this.hunger + val > 2000) {
          this.emit("message", t_game("msg_hunger_full"));
          return false;
      }
      
      // Consume logic
      if (val > 0) {
          this.eatFood(val);
      }
      
      // Decrease count or Remove
      if (item.count > 1) {
          item.count--;
          this.emit("inventoryUpdated");
      } else {
          this.removeInventoryItem(uid);
      }
      
      return true;
  }

  public clearWindowPositions() {
    this.openWindows = {};
  }
  




  public isCloudShadowsEnabled(): boolean {
      return this._cloudShadowsEnabled;
  }

  public setCloudShadowsEnabled(enabled: boolean): void {
      if (this._cloudShadowsEnabled !== enabled) {
          this._cloudShadowsEnabled = enabled;
          this.emit("cloudShadowsChanged", enabled);
      }
  }

  public toggleCloudShadows(): void {
      this.setCloudShadowsEnabled(!this._cloudShadowsEnabled);
  }

  // --- Rune Cooldown System ---
  public isRuneOnCooldown(): boolean {
      const now = Date.now();
      return (now - this.lastRuneCastTime) < this.runeCooldownDuration;
  }

  public getRemainingCooldown(): number {
      const now = Date.now();
      const elapsed = now - this.lastRuneCastTime;
      return Math.max(0, this.runeCooldownDuration - elapsed);
  }

  public startRuneCooldown(): void {
      this.lastRuneCastTime = Date.now();
  }
}
