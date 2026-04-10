
export enum ItemType {
  // Weapons
  SWORD = "sword",
  AXE = "axe",
  CLUB = "club",
  WAND = "wand",
  ROD = "rod",
  DISTANCE = "distance", // Bows/Crossbows
  AMMUNITION = "ammo",

  // Defense
  SHIELD = "shield",
  
  // Armor
  HELMET = "helmet",
  BODY_ARMOR = "body_armor", // Renamed from 'armor' to avoid confusion with category
  LEGS = "legs",
  BOOTS = "boots",
  
  // Accessories
  AMULET = "amulet",
  RING = "ring",
  
  // Misc
  FOOD = "food",
  CONTAINER = "container",
  RESOURCE = "resource",
  RUNE = "rune",
  
  // Generic/Legacy (Try to avoid using these)
  MELEE = "melee",
  RANGED = "ranged",
  POTION = "potion"
}

export enum EquipmentSlot {
  HEAD = "head",
  NECK = "neck",
  BODY = "body",
  MAIN_HAND = "mainHand",
  OFF_HAND = "offHand",
  LEGS = "legs",
  BOOTS = "boots",
  RING = "ring",
  AMMO = "ammo"
}

export const SLOT_COMPATIBILITY: Record<EquipmentSlot, ItemType[]> = {
  [EquipmentSlot.HEAD]: [ItemType.HELMET],
  [EquipmentSlot.NECK]: [ItemType.AMULET],
  [EquipmentSlot.BODY]: [ItemType.BODY_ARMOR],
  [EquipmentSlot.LEGS]: [ItemType.LEGS],
  [EquipmentSlot.BOOTS]: [ItemType.BOOTS],
  [EquipmentSlot.RING]: [ItemType.RING],
  [EquipmentSlot.AMMO]: [ItemType.AMMUNITION],
  
  [EquipmentSlot.MAIN_HAND]: [
    ItemType.SWORD, 
    ItemType.AXE, 
    ItemType.CLUB, 
    ItemType.WAND, 
    ItemType.ROD, 
    ItemType.DISTANCE,
    // Generic fallbacks if needed
    ItemType.MELEE,
    ItemType.RANGED
  ],
  
  [EquipmentSlot.OFF_HAND]: [
    ItemType.SHIELD
  ]
};
