import { LootItem, EnemyDefinition } from "../types/gameTypes";
import { getWeaponDefinition, getAllWeaponsData } from "./WeaponRegistry";
import { ItemAttributeRegistry } from "../items/ItemAttributeRegistry";

function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export type { LootItem, EnemyDefinition };

const EXP_RATE = 15;

const enemies: EnemyDefinition[] = [
  {
    id: "rat",
    scale: 0.9,
    hitboxSize: 24,
    health: 15,
    damage: 5,
    speed: 200,
    exp: 5 * EXP_RATE,
    rangeVision: 3,
    aggroRange: 4,
    chaseRange: 8,
    returnToSpawn: true,
    pursuitRange: 5 * 32,
    stopDistance: 24,
    attackRange: 32,
    cooldown: 1000,
    respawnTime: 60000,
    defenseExp: 100,
    stability: 100,
    stabilityDamage: 100,
    defense: 0,
    armor: 0,
    loot: [
      { itemId: "wooden_sword", chance: 1.15, starChance: 100 },
      { itemId: "wooden_shield", chance: 0.05, starChance: 25 },
      { itemId: "rat_meat", chance: 0.8, minQuantity: 1, maxQuantity: 2 },
    ],
    magicAttacks: ["rat_bite"],
    bloodColor: 0xcc0000,
  },
  {
    id: "skeleton",
    scale: 1.5,
    health: 30,
    damage: 8,
    speed: 160,
    exp: 30 * EXP_RATE,
    rangeVision: 6,
    aggroRange: 5,
    chaseRange: 10,
    returnToSpawn: true,
    pursuitRange: 7 * 32,
    stopDistance: 32,
    attackRange: 32,
    hitboxSize: 32,
    cooldown: 1000,
    respawnTime: 60000,
    defenseExp: 100,
    stability: 100,
    defense: 15,
    stabilityDamage: 100,
    armor: 2,
    loot: [
      { itemId: "iron_axe", chance: 0.15, starChance: 25 },
      { itemId: "wooden_shield", chance: 0.1, starChance: 25 },
      { itemId: "short_bow", chance: 0.05, starChance: 25 },
    ],
    bloodColor: 0xe0e0e0,
    resistances: { fire: -0.2 },
    defenseResistances: { fire: 0.05 },
  },
  {
    id: "bear",
    scale: 1.55,
    hitboxSize: 40,
    health: 70,
    damage: 14,
    speed: 150,
    exp: 40 * EXP_RATE,
    rangeVision: 5,
    aggroRange: 4,
    chaseRange: 9,
    returnToSpawn: true,
    pursuitRange: 6 * 32,
    stopDistance: 36,
    attackRange: 36,
    cooldown: 1100,
    respawnTime: 90000,
    defenseExp: 100,
    stability: 120,
    defense: 10,
    stabilityDamage: 100,
    armor: 4,
    loot: [
      { itemId: "rat_meat", chance: 0.6, minQuantity: 2, maxQuantity: 4 },
      { itemId: "leather_armor", chance: 0.08, starChance: 25 },
    ],
    bloodColor: 0x8b0000,
  },
  {
    id: "goblin",
    scale: 1.4,
    health: 20,
    damage: 7,
    speed: 280,
    exp: 25 * EXP_RATE,
    rangeVision: 5,
    aggroRange: 5,
    chaseRange: 12,
    returnToSpawn: true,
    pursuitRange: 5 * 32,
    stopDistance: 32,
    attackRange: 32,
    hitboxSize: 32,
    cooldown: 1000,
    respawnTime: 60000,
    defenseExp: 100,
    stability: 100,
    defense: 4,
    stabilityDamage: 100,
    armor: 1,
    loot: [
      { itemId: "wooden_sword", chance: 0.2, starChance: 25 },
      { itemId: "iron_axe", chance: 0.08, starChance: 25 },
    ],
    bloodColor: 0x00aa00,
  },
  {
    id: "goblin_lanceiro",
    scale: 1.4,
    health: 25,
    damage: 9,
    speed: 260,
    exp: 30 * EXP_RATE,
    rangeVision: 6,
    aggroRange: 5,
    chaseRange: 14,
    returnToSpawn: true,
    pursuitRange: 6 * 32,
    stopDistance: 32,
    attackRange: 48,
    hitboxSize: 32,
    cooldown: 1200,
    respawnTime: 60000,
    defenseExp: 100,
    stability: 100,
    defense: 5,
    stabilityDamage: 100,
    armor: 1,
    loot: [
      { itemId: "wooden_sword", chance: 0.15, starChance: 25 },
      { itemId: "iron_axe", chance: 0.1, starChance: 25 },
    ],
    bloodColor: 0x00aa00,
  },
  {
    id: "orc",
    scale: 1.8,
    health: 45,
    damage: 12,
    speed: 400,
    exp: 35 * EXP_RATE,
    rangeVision: 6,
    aggroRange: 5,
    chaseRange: 10,
    returnToSpawn: true,
    pursuitRange: 7 * 32,
    stopDistance: 32,
    attackRange: 48,
    hitboxSize: 48,
    cooldown: 1000,
    respawnTime: 60000,
    defenseExp: 100,
    stability: 100,
    defense: 15,
    stabilityDamage: 100,
    armor: 3,
    loot: [
      { itemId: "iron_axe", chance: 0.25, starChance: 25 },
      { itemId: "iron_shield", chance: 0.15, starChance: 25 },
      { itemId: "short_bow", chance: 0.1, starChance: 25 },
    ],
    bloodColor: 0xcc0000,
  },
  {
    id: "demon",
    scale: 4.0,
    health: 600,
    damage: 500,
    speed: 2400,
    exp: 6000 * EXP_RATE,
    rangeVision: 6,
    aggroRange: 8,
    chaseRange: 20,
    returnToSpawn: true,
    pursuitRange: 7 * 32,
    stopDistance: 200,
    attackRange: 240,
    cooldown: 1000,
    respawnTime: 60000,
    defenseExp: 100,
    stability: 200,
    defense: 50,
    stabilityDamage: 100,
    armor: 15,
    loot: [
      { itemId: "tower_shield", chance: 1.0, starChance: 25 },
      { itemId: "short_bow", chance: 0.2, starChance: 25 },
      { itemId: "iron_axe", chance: 0.4, starChance: 25 },
    ],
    bloodColor: 0x330000,
  },
  {
    id: "dragon",
    scale: 6.5,
    health: 400,
    damage: 100,
    speed: 300,
    exp: 2000 * EXP_RATE,
    rangeVision: 8,
    aggroRange: 7,
    chaseRange: 15,
    returnToSpawn: true,
    pursuitRange: 10 * 32,
    stopDistance: 200,
    attackRange: 300,
    cooldown: 1500,
    respawnTime: 10000,
    defenseExp: 100,
    stability: 150,
    defense: 30,
    stabilityDamage: 100,
    armor: 10,
    loot: [
      { itemId: "iron_shield", chance: 0.15, starChance: 25 },
      { itemId: "iron_axe", chance: 0.15, starChance: 25 },
      { itemId: "dragon_axe", chance: 0.05, starChance: 25 },
      { itemId: "dragon_shield", chance: 0.05, starChance: 25 },
      { itemId: "dragon_armor", chance: 0.03, starChance: 25 },
    ],
    magicAttacks: ["dragon_fire"],
    bloodColor: 0xff4400,
    resistances: { fire: 0.8 },
    defenseResistances: { fire: 0.95 },
  },
  {
    id: "god",
    scale: 1.0,
    health: 10000,
    damage: 1000,
    speed: 1000,
    exp: 100000,
    rangeVision: 20,
    aggroRange: 20,
    chaseRange: 50,
    returnToSpawn: true,
    pursuitRange: 5000,
    stopDistance: 200,
    attackRange: 400,
    cooldown: 500,
    respawnTime: 60000,
    defenseExp: 1000,
    stability: 1000,
    defense: 100,
    stabilityDamage: 1000,
    armor: 50,
    loot: [
      { itemId: "dragon_axe", chance: 1.0, starChance: 100 },
      { itemId: "dragon_shield", chance: 1.0, starChance: 100 },
    ],
    magicAttacks: ["divine_wrath"],
    bloodColor: 0xffffff,
  },
  {
    id: "red_wizard",
    scale: 1.0,
    health: 500,
    damage: 80,
    speed: 400,
    exp: 5000,
    rangeVision: 10,
    aggroRange: 8,
    chaseRange: 20,
    returnToSpawn: true,
    pursuitRange: 2000,
    stopDistance: 300,
    attackRange: 450,
    cooldown: 2000,
    respawnTime: 15000,
    defenseExp: 500,
    stability: 100,
    defense: 20,
    stabilityDamage: 50,
    armor: 5,
    loot: [
      { itemId: "magic_rune", chance: 0.5, minQuantity: 5, maxQuantity: 10 },
      { itemId: "leather_armor", chance: 0.1 },
    ],
    magicAttacks: ["fireball", "curse"],
    bloodColor: 0x550000,
  },
];

export function getEnemyDefinition(enemyId: string): EnemyDefinition | undefined {
  return enemies.find((e) => e.id === enemyId);
}

export function getAllEnemyDefinitions(): EnemyDefinition[] {
  return enemies;
}

export function generateLoot(
  enemyId: string,
): { itemId: string; count: number; stars?: number; attributes?: any[] }[] {
  return generateLootData(enemyId);
}

export function generateLootData(
  enemyId: string,
): { itemId: string; count: number; stars?: number; attributes?: any[] }[] {
  const enemyDef = getEnemyDefinition(enemyId);
  if (!enemyDef) return [];

  const droppedItems: {
    itemId: string;
    count: number;
    stars?: number;
    attributes?: any[];
  }[] = [];

  enemyDef.loot.forEach((lootItem) => {
    const roll = Math.random();
    if (roll <= lootItem.chance) {
      const quantity =
        lootItem.minQuantity && lootItem.maxQuantity
          ? randBetween(lootItem.minQuantity, lootItem.maxQuantity)
          : 1;

      let stars = 0;
      const attributes: any[] = [];

      const weaponDef = getWeaponDefinition(lootItem.itemId);

      if (
        weaponDef &&
        weaponDef.possibleAttributes &&
        weaponDef.possibleAttributes.length > 0 &&
        lootItem.starChance
      ) {
        let currentStarChance = lootItem.starChance / 100;
        let attempts = 0;

        while (attempts < 5) {
          if (Math.random() <= currentStarChance) {
            stars++;
          } else {
            break;
          }
          attempts++;
        }

        if (stars > 0) {
          attributes.push(
            ...ItemAttributeRegistry.generateUniqueAttributes(stars),
          );
        }
      }

      for (let i = 0; i < quantity; i++) {
        droppedItems.push({
          itemId: lootItem.itemId,
          count: 1,
          stars: stars > 0 ? stars : undefined,
          attributes: attributes.length > 0 ? attributes : undefined,
        });
      }
    }
  });

  return droppedItems;
}

export const EnemyRegistry = {
  getEnemyDefinition,
  generateLoot,
  generateLootData,
  getAllEnemyDefinitions,
};
