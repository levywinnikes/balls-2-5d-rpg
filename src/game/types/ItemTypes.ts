
export enum ItemType {
    WEAPON = "weapon",
    SHIELD = "shield",
    ARMOR = "armor",
    LEGS = "legs",
    HELMET = "helmet",
    BOOTS = "boots",
    RING = "ring",
    AMULET = "amulet",
    CONSUMABLE = "consumable",
    MATERIAL = "material",
    CONTAINER = "container"
}

export enum ItemRarity {
    COMMON = "common",
    UNCOMMON = "uncommon",
    RARE = "rare",
    EPIC = "epic",
    LEGENDARY = "legendary"
}

export interface BaseItem {
    id: string;
    name: string; // Translation key
    icon: string; // Texture key
    weight: number;
    stackable: boolean;
    rarity: ItemRarity; 
    type: ItemType;
    description?: string;
}

export interface ItemEffect {
    type: "HEAL" | "MANA" | "XP" | "BUFF" | "SATURATION";
    value: number;
    duration?: number; // ms, if applicable
    attribute?: string; // For BUFF, e.g., "strength"
}

export interface ConsumableItem extends BaseItem {
    type: ItemType.CONSUMABLE;
    effects: ItemEffect[];
    cooldown: number; // ms
    consumesOnUse: boolean;
}

export interface EquippableItem extends BaseItem {
    type: ItemType.WEAPON | ItemType.SHIELD | ItemType.ARMOR | ItemType.LEGS | ItemType.HELMET | ItemType.BOOTS | ItemType.RING | ItemType.AMULET;
    slot: string; // To be refined with Enum if needed
    defense?: number;
    armor?: number;
}
