export enum ItemType {
  SWORD = "sword",
  AXE = "axe",
  CLUB = "club",
  WAND = "wand",
  ROD = "rod",
  DISTANCE = "distance",
  AMMUNITION = "ammo",
  SHIELD = "shield",
  HELMET = "helmet",
  BODY_ARMOR = "body_armor",
  LEGS = "legs",
  BOOTS = "boots",
  AMULET = "amulet",
  RING = "ring",
  FOOD = "food",
  CONTAINER = "container",
  RESOURCE = "resource",
  RUNE = "rune",
  MELEE = "melee",
  RANGED = "ranged",
  POTION = "potion",
}

export type WeaponDefinition = {
  id: string;
  name: string;
  damage: number;
  armor: number;
  defense: number;
  cooldown: number;
  range: number;
  type: ItemType;
  exp_skill: number;
  weight: number;
  stackable: boolean;
  consumable: boolean;
  hungerValue?: number;
  pickupable?: boolean;
  description?: string;
  element?: "fire" | "ice" | "energy";
  lightRadius?: number;
  resistances?: Record<string, number>;
  defenseResistances?: Record<string, number>;
  terrainResistance?: number;
  speedBonus?: number;
  possibleAttributes?: string[];
  graphic?: any;
};

export type ShieldDefinition = {
  id: string;
  name: string;
  description?: string;
  defense: number;
  armor: number;
  weight: number;
  type: ItemType;
  exp_skill: number;
  stackable: boolean;
  possibleAttributes?: string[];
};

export interface ContainerDefinition {
  id: string;
  name: string;
  slots: number;
  weight: number;
  type: ItemType;
}

export interface FoodDefinition {
  id: string;
  name: string;
  hungerValue: number;
  weight: number;
  type: ItemType;
  stackable: boolean;
  description?: string;
}

export interface LootItem {
  itemId: string;
  chance: number;
  minQuantity?: number;
  maxQuantity?: number;
  starChance?: number;
}

export type EnemyDefinition = {
  id: string;
  health: number;
  damage: number;
  speed: number;
  rangeVision: number;
  cooldown: number;
  pursuitRange: number;
  stopDistance: number;
  attackRange: number;
  exp: number;
  respawnTime: number;
  defenseExp: number;
  defense: number;
  stability: number;
  stabilityDamage: number;
  aggroRange: number;
  chaseRange: number;
  returnToSpawn: boolean;
  loot: LootItem[];
  scale?: number;
  armor: number;
  magicAttacks?: string[];
  bloodColor?: number;
  hitboxSize?: number;
  resistances?: Record<string, number>;
  defenseResistances?: Record<string, number>;
};

export interface RuneDefinition {
  id: string;
  name: string;
  description: string;
  memoryCost: number;
  graphic?: { texture: string; frame?: string | number };
  damage: {
    element: "fire" | "ice" | "energy" | "physical" | "star";
    baseMin: number;
    baseMax: number;
    area: number;
  };
  enchantSound?: string;
  singleTargetOnly?: boolean;
  effect3d?: {
    color: string;
    radius: number;
    speed: number;
  };
}

export type HeroSkinId = "wojtek";

export type HeroSkinUnlockRule =
  | { type: "character_name"; names: string[] }
  | { type: "always" };

export type HeroSkinDefinition = {
  id: HeroSkinId;
  displayName: string;
  bodyEntityId: string;
  unlock: HeroSkinUnlockRule;
};

export enum ItemRarity {
  COMMON = "common",
  UNCOMMON = "uncommon",
  RARE = "rare",
  EPIC = "epic",
  LEGENDARY = "legendary",
}

export interface ItemEffect {
  type: "HEAL" | "MANA" | "XP" | "BUFF" | "SATURATION";
  value: number;
  duration?: number;
  attribute?: string;
}

export interface ConsumableItem {
  id: string;
  name: string;
  weight: number;
  stackable: boolean;
  rarity: ItemRarity;
  type: ItemType;
  description?: string;
  icon?: string;
  effects: ItemEffect[];
  cooldown: number;
  consumesOnUse: boolean;
}

export interface SkillSnapshot {
  level: number;
  experience: number;
}

export interface BuffSnapshot {
  id: string;
  attr: string;
  value: number;
  duration: number;
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

export interface DoorStateSnapshot {
  open: boolean;
  locked?: boolean;
  keyId?: string | null;
}

export interface PlayerSnapshot {
  characterName?: string;
  unlockedHeroSkinIds?: string[];
  activeHeroSkinId?: string | null;
  health: number;
  maxHealth: number;
  level: number;
  experience: number;
  attackDamage: number;
  skills?: {
    strength: SkillSnapshot;
    dexterity: SkillSnapshot;
    reflex: SkillSnapshot;
    intelligence: SkillSnapshot;
  };
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
  willpowerExp?: number;
  willpowerTarget?: number;
  hunger?: number;
  playTime?: number;
  balance?: number;
  equippedWeaponId: string | null;
  equippedWeaponItem?: EquipmentItemSnapshot | null;
  equippedShieldId?: string | null;
  equippedShieldItem?: EquipmentItemSnapshot | null;
  equippedHelmetId?: string | null;
  equippedHelmetItem?: EquipmentItemSnapshot | null;
  equippedHairId?: string | null;
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
  inventory?: InventoryItemSnapshot[];
  shieldInventoryIds?: string[];
  inventoryWeaponIds?: string[];
  exploredAreas?: [string, boolean[][]][];
  persistentItems?: [string, any[]][];
  containers?: [string, any[]][];
  visitedLevels?: string[];
  deadEnemies3d?: Record<string, string[]>;
  doorStates?: Record<string, DoorStateSnapshot>;
  altarStorage?: [string, any[]][];
  enchantedRunes?: Array<{ runeId: string; count: number }>;
  equippedRuneSlots?: string[];
  quests?: any;
  activeBuffs?: BuffSnapshot[];
  markers?: MapMarkerSnapshot[];
  windowConfigs?: WindowConfigSnapshot;
}

export const EquipmentSlot = {
  HEAD: "head",
  NECK: "neck",
  BODY: "body",
  MAIN_HAND: "mainHand",
  OFF_HAND: "offHand",
  LEGS: "legs",
  BOOTS: "boots",
  RING: "ring",
  AMMO: "ammo",
} as const;

export const SLOT_COMPATIBILITY: Record<string, ItemType[]> = {
  head: [ItemType.HELMET],
  neck: [ItemType.AMULET],
  body: [ItemType.BODY_ARMOR],
  legs: [ItemType.LEGS],
  boots: [ItemType.BOOTS],
  ring: [ItemType.RING],
  ammo: [ItemType.AMMUNITION],
  mainHand: [ItemType.SWORD, ItemType.AXE, ItemType.CLUB, ItemType.WAND, ItemType.ROD, ItemType.DISTANCE, ItemType.MELEE, ItemType.RANGED],
  offHand: [ItemType.SHIELD],
};
