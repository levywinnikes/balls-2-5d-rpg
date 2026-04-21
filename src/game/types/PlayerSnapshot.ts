/**
 * PLAYER SNAPSHOT CONTRACT
 *
 * This interface defines the complete, serializable state of a player.
 * It serves as the single source of truth for save/load contracts between:
 * - PlayerState (source of truth) and SaveSystem (persistence layer)
 * - Enables modular refactoring of PlayerState without breaking SaveSystem
 *
 * INVARIANT: This snapshot must be:
 * 1. Fully serializable to JSON (no Symbols, Functions, Maps with non-string keys)
 * 2. Backward-compatible with legacy save formats via migration logic in loadState()
 * 3. Forward-compatible: new fields must have sensible defaults
 *
 * VERSION: 2.3.0 (must match SaveSystem.SAVE_VERSION)
 */

export interface SkillSnapshot {
  level: number;
  experience: number;
}

export interface BuffSnapshot {
  id: string; // e.g. "potion_strength"
  attr: string; // e.g. "strength"
  value: number; // e.g. 5
  duration: number; // ms remaining
  isPercent?: boolean;
}

export interface InventoryItemSnapshot {
  uid: string;
  itemId: string;
  count: number;
  stars?: number;
  attributes?: any[];
}

export interface EquipmentItemSnapshot {
  itemId?: string;
  count?: number;
  uid?: string;
}

export interface MapMarkerSnapshot {
  id: string;
  x: number;
  y: number;
  level: string;
  label: string;
  color: string;
}

export interface WindowConfigSnapshot {
  [windowType: string]: { x: number; y: number };
}

/**
 * Complete player state snapshot for persistence.
 * All fields are serializable (no Map/Set objects, only arrays).
 */
export interface PlayerSnapshot {
  // --- Identity & Vitals ---
  characterName?: string;
  health: number;
  maxHealth: number;
  level: number;
  experience: number;
  attackDamage: number;

  // --- Skills (Core 4) ---
  skills?: {
    strength: SkillSnapshot;
    dexterity: SkillSnapshot;
    reflex: SkillSnapshot;
    intelligence: SkillSnapshot;
  };

  // --- Legacy Skill Format (for backward compatibility) ---
  meleeLevel?: number;
  meleeExperience?: number;
  rangeLevel?: number;
  rangeExperience?: number;
  defenseLevel?: number;
  defenseExperience?: number;
  strengthLevel?: number;
  strengthExperience?: number;
  dexterityLevel?: number;
  dexterityExperience?: number;
  reflexLevel?: number;
  reflexExperience?: number;
  intelligenceLevel?: number;
  intelligenceExperience?: number;

  // --- Magic & Willpower ---
  willpowerExp?: number;
  willpowerTarget?: number;

  // --- Hunger ---
  hunger?: number;

  // --- Playtime ---
  playTime?: number;
  balance?: number;

  // --- Equipment IDs & Items ---
  equippedWeaponId: string | null;
  equippedWeaponItem?: EquipmentItemSnapshot | null;

  equippedShieldId?: string | null;
  equippedShieldItem?: EquipmentItemSnapshot | null;

  equippedHelmetId?: string | null;
  equippedHelmetItem?: EquipmentItemSnapshot | null;

  equippedArmorId?: string | null;
  equippedArmorItem?: EquipmentItemSnapshot | null;

  equippedLegsId?: string | null;
  equippedLegsItem?: EquipmentItemSnapshot | null;

  equippedBootsId?: string | null;
  equippedBootsItem?: EquipmentItemSnapshot | null;

  equippedNeckId?: string | null;
  equippedNeckItem?: EquipmentItemSnapshot | null;

  equippedRingId?: string | null;
  equippedRingItem?: EquipmentItemSnapshot | null;

  equippedAmmoId?: string | null;
  equippedAmmoItem?: EquipmentItemSnapshot | null;

  // --- Inventory ---
  inventory?: InventoryItemSnapshot[];
  shieldInventoryIds?: string[];
  inventoryWeaponIds?: string[];

  // --- World State ---
  exploredAreas?: [string, boolean[][]][]; // Map level -> grid of explored tiles
  persistentItems?: [string, any[]][]; // Map level -> dropped items
  containers?: [string, any[]][]; // Map container ID -> items inside
  visitedLevels?: string[]; // Levels visited by player
  deadEnemies3d?: Record<string, string[]>; // 3D world: killed enemy spawn keys per level

  // --- Altar & Magic ---
  altarStorage?: [string, any[]][]; // Map altar ID -> items stored
  enchantedRunes?: Array<{ runeId: string; count: number }>;
  equippedRuneSlots?: string[]; // Up to 3 rune IDs in hotbar slots (empty string = empty slot)

  // --- Quests & Status ---
  quests?: any; // QuestManager save data (delegates to QuestManager.getSaveData())
  activeBuffs?: BuffSnapshot[];

  // --- UI State ---
  markers?: MapMarkerSnapshot[];
  windowConfigs?: WindowConfigSnapshot; // Window open/close states and positions
}
