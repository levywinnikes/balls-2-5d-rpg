// EnemyRegistry.ts
import Phaser from "phaser";
import { RatGraphic } from "../graphics/enemies/RatGraphic";
import { SkeletonGraphic } from "../graphics/enemies/SkeletonGraphic";
import { GoblinGraphic } from "../graphics/enemies/GoblinGraphic";
import { OrcGraphic } from "../graphics/enemies/OrcGraphic";
import { DemonGraphic } from "../graphics/enemies/DemonGraphic";
import { DragonGraphic } from "../graphics/enemies/DragonGraphic";
import { GodGraphic } from "../graphics/enemies/GodGraphic";
import { RedWizardGraphic } from "../graphics/enemies/RedWizardGraphic";

// Interface para itens de loot
export interface LootItem {
  itemId: string; // ID do item (weapon ou shield)
  chance: number; // Chance de drop (0.0 a 1.0)
  minQuantity?: number; // Quantidade mínima (opcional)
  maxQuantity?: number; // Quantidade máxima (opcional)
  starChance?: number; // Chance for first star (%)
}

export type EnemyDefinition = {
  id: string;
  graphic: {
    preload: (scene: Phaser.Scene) => void;
    create: (
      scene: Phaser.Scene,
      x: number,
      y: number
    ) => Phaser.Physics.Arcade.Sprite;
  };
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
  aggroRange: number; // Tiles
  chaseRange: number; // Tiles
  returnToSpawn: boolean;
  loot: LootItem[]; 
  scale?: number; // Visual scale modifier
  armor: number;
  magicAttacks?: string[]; // IDs of magic attacks
  bloodColor?: number; // 0xRRGGBB
  hitboxSize?: number; // World pixel size of hitbox (default 96)
  resistances?: Record<string, number>; // Elemental resistances (inherent)
  defenseResistances?: Record<string, number>; // Elemental resistances (when blocking)
};

export class EnemyRegistry {
  private static readonly EXP_RATE: number = 15;
  private static enemies: EnemyDefinition[] = [
    {
      id: "rat",
      graphic: RatGraphic,
      scale: 0.9, // Reduced by 40% from 1.5
      hitboxSize: 24, // Smaller hitbox for small rat
      health: 15,
      damage: 5,
      speed: 200,
      exp: 5 * this.EXP_RATE,
      rangeVision: 3, 
      aggroRange: 4, 
      chaseRange: 8,
      returnToSpawn: true,
      pursuitRange: 5 * 32,
      stopDistance: 24,
      attackRange: 32,
      cooldown: 1000,
      respawnTime: 5000,
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
      graphic: SkeletonGraphic,
      scale: 4.0, // Restoring original size
      health: 30,
      damage: 8,
      speed: 160,
      exp: 30 * this.EXP_RATE,
      rangeVision: 6,
      aggroRange: 5,
      chaseRange: 10,
      returnToSpawn: true,
      pursuitRange: 7 * 32,
      stopDistance: 32,
      attackRange: 32,
      hitboxSize: 32,
      cooldown: 1000,
      respawnTime: 5000,
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
      bloodColor: 0xe0e0e0, // Bone / dust
      resistances: { fire: -0.2 }, // 20% Inherent Vulnerability
      defenseResistances: { fire: 0.05 } // Only 5% mitigated on block
    },
    {
      id: "goblin",
      graphic: GoblinGraphic,
      scale: 4.0,
      health: 20,
      damage: 7,
      speed: 280,
      exp: 25 * this.EXP_RATE,
      rangeVision: 5,
      aggroRange: 5,
      chaseRange: 12,
      returnToSpawn: true,
      pursuitRange: 5 * 32,
      stopDistance: 32,
      attackRange: 32,
      hitboxSize: 32,
      cooldown: 1000,
      respawnTime: 5000,
      defenseExp: 100,
      stability: 100,
      defense: 4,
      stabilityDamage: 100,
      armor: 1,
      loot: [
        { itemId: "wooden_sword", chance: 0.2, starChance: 25 },
        { itemId: "iron_axe", chance: 0.08, starChance: 25 },
      ],
      bloodColor: 0x00aa00, // Green
    },
    {
      id: "orc",
      graphic: OrcGraphic,
      scale: 0.61,
      health: 45,
      damage: 12,
      speed: 400,
      exp: 35 * this.EXP_RATE,
      rangeVision: 6,
      aggroRange: 5,
      chaseRange: 10,
      returnToSpawn: true,
      pursuitRange: 7 * 32,
      stopDistance: 32,
      attackRange: 48, // Slightly longer reach for orc?
      hitboxSize: 48, // Bulkier orc
      cooldown: 1000,
      respawnTime: 5000,
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
      bloodColor: 0xcc0000, // Red
    },
    {
      id: "demon",
      graphic: DemonGraphic,
      scale: 4.0,
      health: 600,
      damage: 500,
      speed: 2400,
      exp: 6000 * this.EXP_RATE,
      rangeVision: 6,
      aggroRange: 8,
      chaseRange: 20,
      returnToSpawn: true,
      pursuitRange: 7 * 32,
      stopDistance: 200,
      attackRange: 240,
      cooldown: 1000,
      respawnTime: 5000,
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
      bloodColor: 0x330000, // Very dark red
    },
    {
      id: "dragon",
      graphic: DragonGraphic,
      scale: 0.8,
      health: 400,
      damage: 100,
      speed: 300,
      exp: 2000 * this.EXP_RATE,
      rangeVision: 8,
      aggroRange: 7,
      chaseRange: 15,
      returnToSpawn: true,
      pursuitRange: 10 * 32,
      stopDistance: 200, // Ranged attack?
      attackRange: 300, // Spits fire from distance
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
      bloodColor: 0xff4400, // Magma / Fire
      resistances: { fire: 0.8 }, // 80% Inherent Resistance
      defenseResistances: { fire: 0.95 } // 95% mitigated on block (very efficient)
    },
    {
      id: "god",
      graphic: GodGraphic,
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
      graphic: RedWizardGraphic,
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

  static preloadAll(scene: Phaser.Scene): void {
    this.enemies.forEach((enemy) => {
      enemy.graphic.preload(scene);
    });
  }

  static createEnemy(
    scene: Phaser.Scene,
    enemyId: string,
    x: number,
    y: number,
    overrides?: Partial<EnemyDefinition>
  ): {
    sprite: Phaser.Physics.Arcade.Sprite;
    health: number;
    damage: number;
    speed: number;
    rangeVision: number;
    pursuitRange: number;
    stopDistance: number;
    armor: number;
    attackRange: number;
    cooldown: number;
    exp: number;
    respawnTime: number;
    loot: LootItem[];
    aggroRange: number;
    chaseRange: number;
    returnToSpawn: boolean;
    magicAttacks: string[];
  } {
    const enemyDef = this.enemies.find((e) => e.id === enemyId);
    if (!enemyDef) throw new Error(`Enemy ${enemyId} not registered`);

    // Apply Overrides
    const stats = { ...enemyDef, ...overrides };

    const sprite = enemyDef.graphic.create(scene, x, y);
    // Apply configured scale or default to 4 (legacy size)
    const scale = stats.scale ?? 4.0;
    sprite.setScale(scale);

    // FIX: Calculate body size to ensure consistent World Hitbox.
    // Target World Hitbox is ~32px (1 tile size), or custom.
    // LocalBodySize = Target / Scale.
    const targetWorldSize = stats.hitboxSize ?? 32;
    const localSize = targetWorldSize / scale;

    // Use unscaled texture dimensions to center the body
    const frameWidth = sprite.width;
    const frameHeight = sprite.height;

    sprite.setSize(localSize, localSize);
    
    // Center the body
    const offsetX = (frameWidth - localSize) / 2;
    const offsetY = (frameHeight - localSize) / 2;
    sprite.setOffset(offsetX, offsetY);

    return {
      sprite,
      health: stats.health,
      damage: stats.damage,
      speed: stats.speed,
      rangeVision: stats.rangeVision,
      pursuitRange: stats.pursuitRange,
      stopDistance: stats.stopDistance,
      attackRange: stats.attackRange,
      cooldown: stats.cooldown,
      exp: stats.exp,
      respawnTime: stats.respawnTime,
      loot: stats.loot,
      aggroRange: stats.aggroRange * 32, // Convert tiles to pixels
      chaseRange: stats.chaseRange * 32, // Convert tiles to pixels
      returnToSpawn: stats.returnToSpawn,
      armor: stats.armor,
      magicAttacks: stats.magicAttacks || []
    };
  }

  static registerEnemy(enemy: EnemyDefinition): void {
    this.enemies.push(enemy);
  }

  static getEnemyDefinition(enemyId: string): EnemyDefinition | undefined {
    return this.enemies.find((e) => e.id === enemyId);
  }

  // Novo método para gerar loot
  static generateLoot(enemyId: string): { itemId: string; count: number; stars?: number; attributes?: any[] }[] {
    const enemyDef = this.getEnemyDefinition(enemyId);
    if (!enemyDef) return [];

    const droppedItems: { itemId: string; count: number; stars?: number; attributes?: any[] }[] = [];

    enemyDef.loot.forEach((lootItem) => {
      const roll = Math.random();
      // Debug log (optional)
      // console.log(`[Loot] Rolling for ${lootItem.itemId}: needed ${lootItem.chance}, got ${roll}`);
      
      if (roll <= lootItem.chance) {
        // Item dropou!
        const quantity =
          lootItem.minQuantity && lootItem.maxQuantity
            ? Phaser.Math.Between(lootItem.minQuantity, lootItem.maxQuantity)
            : 1;

        // STAR SYSTEM
        let stars = 0;
        const attributes: any[] = [];
        
        // Check if weapon allows stars
        const { WeaponRegistry } = require("./weapons/WeaponRegistry"); // Lazy load to avoid circular dependency
        const { ItemAttributeRegistry } = require("../items/ItemAttributeRegistry");
        
        const weaponDef = WeaponRegistry.getWeaponDefinition(lootItem.itemId);
        
        // Only generate stars if weapon allows it AND enemy has a starChance configured
        if (weaponDef && weaponDef.possibleAttributes && weaponDef.possibleAttributes.length > 0 && lootItem.starChance) {
             let currentStarChance = lootItem.starChance / 100; // Convert 10 (10%) to 0.1
             let attempts = 0;
             
             // 1. Determine Star Count (Recursive Roll)
             // Roll for 1st star, if success roll for 2nd, etc.
             while (attempts < 5) {
                 if (Math.random() <= currentStarChance) {
                     stars++;
                     // Reduce chance for next star? Or Keep constant?
                     // Standard ARPG: Chance diminishes. 
                     // But User request implies "Gold" tier is possible, current logic was constant.
                     // Let's keep existing probability logic: constant chance for next star.
                 } else {
                     break; // Failed to roll next star
                 }
                 attempts++;
             }

             // 2. Generate Unique Attributes if keys exist
             if (stars > 0) {
                 // Use the new Pool System
                 attributes.push(...ItemAttributeRegistry.generateUniqueAttributes(stars));
             }
        }

        // Add single entry with quantity 1 if unstackable? 
        // Or one entry with count? 
        // Usually weapons are unstackable, so we push multiple times if count > 1
        // But for stackable items (runes), stars don't apply usually.
        // Let's assume draggable/stackable logic handles count.
        // If stars > 0, we probably should treat as unique instance (count=1).
        
        for (let i = 0; i < quantity; i++) {
             // For non-stackable gear with stars, likely want individual drops.
             // But existing logic pushed itemId strings.
             // If we return objects, consumer handles them.
             droppedItems.push({
                 itemId: lootItem.itemId,
                 count: 1, 
                 stars: stars,
                 attributes: attributes.length > 0 ? attributes : undefined
             });
        }
      }
    });

    return droppedItems;
  }
}
