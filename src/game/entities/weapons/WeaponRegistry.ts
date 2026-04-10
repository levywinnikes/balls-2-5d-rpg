import Phaser from "phaser";
import { ItemGraphic } from "../../graphics/ItemGraphic";
import { ContainerRegistry } from "../containers/ContainerRegistry";
import { FoodRegistry } from "../food/FoodRegistry";
import { ItemRegistry } from "../items/ItemRegistry";
import { ShieldRegistry } from "../Shields/ShieldRegistry";
import { WeaponDefinition as BaseWeaponDefinition } from "../../types/gameTypes";
import { ItemType } from "../../../config/ItemConstants";

// Extend the base definition
export interface WeaponDefinition extends BaseWeaponDefinition {
    possibleAttributes?: string[];
}

export class WeaponRegistry {
  private static weapons: WeaponDefinition[] = [
    // --- WEAPONS ---
    {
      id: "wooden_sword",
      name: "item_wooden_sword",
      description: "desc_wooden_sword",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "wooden_sword", "wooden_sword.png"),
        create: (scene) => ItemGraphic.create(scene, "wooden_sword"),
      },
      damage: 8,
      armor: 0,
      defense: 3,
      cooldown: 1000,
      range: 200,
      type: ItemType.SWORD,
      exp_skill: 100,
      weight: 25.0,
      stackable: false,
      consumable: false,
      possibleAttributes: ["melee_crit_chance", "melee_max_damage"],
    },
    {
      id: "torch",
      name: "item_torch",
      description: "desc_torch",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "torch", "torch.png"),
        create: (scene) => ItemGraphic.create(scene, "torch"),
      },
      damage: 1,
      armor: 0,
      defense: 2,
      cooldown: 800,
      range: 150,
      type: ItemType.CLUB, // Torch acts as a club/melee
      exp_skill: 10,
      weight: 15.0,
      stackable: false,
      consumable: false,
      lightRadius: 1200,
    },
    {
      id: "light_torch",
      name: "item_light_torch",
      description: "desc_light_torch",
      graphic: {
        preload: (scene) => {
            // Load 4 separate frames for Light Torch
            scene.load.image("light_torch_1", "assets/items/light_torch/1.png");
            scene.load.image("light_torch_2", "assets/items/light_torch/2.png");
            scene.load.image("light_torch_3", "assets/items/light_torch/3.png");
            scene.load.image("light_torch_4", "assets/items/light_torch/4.png");
        },
        create: (scene) => {
            // Create sprite using the first frame
            const sprite = scene.add.sprite(0, 0, "light_torch_1");
            
            if (!scene.anims.exists("light_torch_anim")) {
                scene.anims.create({
                    key: "light_torch_anim",
                    frames: [
                        { key: "light_torch_1" },
                        { key: "light_torch_2" },
                        { key: "light_torch_3" },
                        { key: "light_torch_4" }
                    ],
                    frameRate: 5,
                    repeat: -1
                });
            }
            sprite.play("light_torch_anim");
            sprite.setDisplaySize(32, 32);
            return sprite;
        },
      },
      damage: 5,
      armor: 0,
      defense: 2,
      cooldown: 800,
      range: 150,
      type: ItemType.CLUB,
      element: "fire",
      lightRadius: 1200,
      exp_skill: 100,
      weight: 15.0,
      stackable: false,
      consumable: false,
    },
    {
      id: "iron_axe",
      name: "item_iron_axe",
      description: "desc_iron_axe",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "iron_axe", "iron_axe.png"),
        create: (scene) => ItemGraphic.create(scene, "iron_axe"),
      },
      damage: 15,
      armor: 0,
      defense: 1,
      cooldown: 1000,
      range: 200,
      type: ItemType.AXE,
      exp_skill: 100,
      weight: 45.0,
      stackable: false,
      consumable: false,
      possibleAttributes: ["melee_crit_chance", "melee_max_damage", "melee_crit_damage"],

    },
    {
      id: "dragon_axe",
      name: "item_dragon_axe",
      description: "desc_dragon_axe",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "dragon_axe", "dragon_axe.png"),
        create: (scene) => ItemGraphic.create(scene, "dragon_axe"),
      },
      damage: 35, // Significantly better than Iron Axe (15)
      armor: 0,
      defense: 2,
      cooldown: 1000,
      range: 200,
      type: ItemType.AXE,
      exp_skill: 120,
      weight: 60.0,
      stackable: false,
      consumable: false,
      resistances: { fire: 0.1 },
      defenseResistances: { fire: 0.7 },
      possibleAttributes: ["melee_crit_chance", "melee_max_damage", "melee_crit_damage"],
    },
    {
      id: "short_bow",
      name: "item_short_bow",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "short_bow", "short_bow.png"),
        create: (scene) => ItemGraphic.create(scene, "short_bow"),
      },
      damage: 20,
      armor: 0,
      defense: 0,
      cooldown: 1000,
      range: 2000,
      type: ItemType.DISTANCE,
      exp_skill: 100,
      weight: 15.0,
      stackable: false,
      consumable: false,
    },
    {
      id: "throwing_star",
      name: "item_throwing_star",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "throwing_star", "throwing_star.png"),
        create: (scene) => ItemGraphic.create(scene, "throwing_star"),
      },
      damage: 12,
      armor: 0,
      defense: 0,
      cooldown: 600,
      range: 800,
      type: ItemType.DISTANCE, // or ItemType.AMMUNITION? Generally stars are weapons
      exp_skill: 10,
      weight: 2.0,
      stackable: true,
      consumable: true,
    },

    // --- SHIELDS ---
    {
      id: "wooden_shield",
      name: "item_wooden_shield",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "wooden_shield", "wooden_shield.png"),
        create: (scene) => ItemGraphic.create(scene, "wooden_shield"),
      },
      damage: 0,
      armor: 0,
      defense: 10,
      cooldown: 0,
      range: 0,
      type: ItemType.SHIELD,
      exp_skill: 100,
      weight: 30.0,
      stackable: false,
      consumable: false,
      resistances: { fire: 0.05 }, // Slightly resists heat by itself
      defenseResistances: { fire: -0.8 } // Very poor for active fire defense (burns)
    },
    {
      id: "iron_shield",
      name: "item_iron_shield",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "iron_shield", "iron_shield.png"),
        create: (scene) => ItemGraphic.create(scene, "iron_shield"),
      },
      damage: 0,
      armor: 0,
      defense: 20,
      cooldown: 0,
      range: 0,
      type: ItemType.SHIELD,
      exp_skill: 100,
      weight: 55.0,
      stackable: false,
      consumable: false,
    },
    {
      id: "tower_shield",
      name: "item_tower_shield",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "tower_shield", "tower_shield.png"),
        create: (scene) => ItemGraphic.create(scene, "tower_shield"),
      },
      damage: 0,
      armor: 0,
      defense: 35,
      cooldown: 0,
      range: 0,
      type: ItemType.SHIELD,
      exp_skill: 100,
      weight: 90.0,
      stackable: false,
      consumable: false,
    },
    {
      id: "dragon_shield",
      name: "item_dragon_shield",
      description: "desc_dragon_shield",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "dragon_shield", "dragon_shield.png"),
        create: (scene) => ItemGraphic.create(scene, "dragon_shield"),
      },
      damage: 0,
      armor: 0,
      defense: 38, // Better than Tower (35)
      cooldown: 0,
      range: 0,
      type: ItemType.SHIELD,
      exp_skill: 100,
      weight: 65.0, // Lighter than Tower (90)
      stackable: false,
      consumable: false,
    },
    
    // --- ARMOR SET (LEATHER) ---
    {
      id: "dragon_armor",
      name: "item_dragon_armor",
      description: "desc_dragon_armor",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "dragon_armor", "dragon_armor.png"),
        create: (scene) => ItemGraphic.create(scene, "dragon_armor"),
      },
      damage: 0,
      armor: 14, // Better than Plate (10)
      defense: 0,
      cooldown: 0,
      range: 0,
      type: ItemType.BODY_ARMOR,
      exp_skill: 0,
      weight: 100.0,
      stackable: false,
      consumable: false,
    },

    {
      id: "leather_helmet",
      name: "item_leather_helmet",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "leather_helmet", "leather_helmet.png"),
        create: (scene) => ItemGraphic.create(scene, "leather_helmet"),
      },
      damage: 0,
      armor: 2,
      defense: 0,
      cooldown: 0,
      range: 0,
      type: ItemType.HELMET,
      exp_skill: 0,
      weight: 12.0,
      stackable: false,
      consumable: false,
    },
    {
      id: "leather_armor",
      name: "item_leather_armor",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "leather_armor", "leather_armor.png"),
        create: (scene) => ItemGraphic.create(scene, "leather_armor"),
      },
      damage: 0,
      armor: 4,
      defense: 0,
      cooldown: 0,
      range: 0,
      type: ItemType.BODY_ARMOR,
      exp_skill: 0,
      weight: 40.0,
      stackable: false,
      consumable: false,
    },
    {
      id: "leather_legs",
      name: "item_leather_legs",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "leather_legs", "leather_legs.png"),
        create: (scene) => ItemGraphic.create(scene, "leather_legs"),
      },
      damage: 0,
      armor: 2,
      defense: 0,
      cooldown: 0,
      range: 0,
      type: ItemType.LEGS,
      exp_skill: 0,
      weight: 25.0,
      stackable: false,
      consumable: false,
    },
    {
      id: "leather_boots",
      name: "item_leather_boots",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "leather_boots", "leather_boots.png"),
        create: (scene) => ItemGraphic.create(scene, "leather_boots"),
      },
      damage: 0,
      armor: 1,
      defense: 0,
      cooldown: 0,
      range: 0,
      type: ItemType.BOOTS,
      exp_skill: 0,
      weight: 8.0,
      stackable: false,
      consumable: false,
      terrainResistance: 0.5 // 50% penalty reduction
    },
    // --- PLATE SET ---
    {
      id: "plate_armor",
      name: "item_plate_armor",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "plate_armor", "plate_armor.png"),
        create: (scene) => ItemGraphic.create(scene, "plate_armor"),
      },
      damage: 0,
      armor: 10,
      defense: 0,
      cooldown: 0,
      range: 0,
      type: ItemType.BODY_ARMOR,
      exp_skill: 0,
      weight: 120.0,
      stackable: false,
      consumable: false,
      resistances: { fire: 0.2 },
      defenseResistances: { fire: 0.9 }
    },
    {
      id: "plate_legs",
      name: "item_plate_legs",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "plate_legs", "plate_legs.png"),
        create: (scene) => ItemGraphic.create(scene, "plate_legs"),
      },
      damage: 0,
      armor: 7,
      defense: 0,
      cooldown: 0,
      range: 0,
      type: ItemType.LEGS,
      exp_skill: 0,
      weight: 50.0,
      stackable: false,
      consumable: false,
    },
    {
      id: "iron_helmet",
      name: "item_iron_helmet",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "iron_helmet", "iron_helmet.png"),
        create: (scene) => ItemGraphic.create(scene, "iron_helmet"),
      },
      damage: 0,
      armor: 5,
      defense: 0,
      cooldown: 0,
      range: 0,
      type: ItemType.HELMET,
      exp_skill: 0,
      weight: 30.0,
      stackable: false,
      consumable: false,
    },
     {
      id: "viking_helmet",
      name: "item_viking_helmet",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "viking_helmet", "viking_helmet.png"),
        create: (scene) => ItemGraphic.create(scene, "viking_helmet"),
      },
      damage: 0,
      armor: 4,
      defense: 0,
      cooldown: 0,
      range: 0,
      type: ItemType.HELMET,
      exp_skill: 0,
      weight: 25.0,
      stackable: false,
      consumable: false,
    },
    {
      id: "steel_boots",
      name: "item_steel_boots",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "steel_boots", "steel_boots.png"),
        create: (scene) => ItemGraphic.create(scene, "steel_boots"),
      },
      damage: 0,
      armor: 3,
      defense: 0,
      cooldown: 0,
      range: 0,
      type: ItemType.BOOTS,
      exp_skill: 0,
      weight: 30.0,
      stackable: false,
      consumable: false,
    },
    // --- FOOD ---
    ...FoodRegistry.foods
  ];

  static preloadAll(scene: Phaser.Scene): void {
    this.weapons.forEach((weapon) => {
      if (weapon.graphic) weapon.graphic.preload(scene);
    });
    // Preload Containers
    ContainerRegistry.preloadAll(scene);
    // Preload Misc Items
    ItemRegistry.preloadAll(scene);
    // Preload Shields
    ShieldRegistry.preloadAll(scene);
  }

  static createWeaponGraphic(
    scene: Phaser.Scene,
    weaponId: string
  ): Phaser.GameObjects.Sprite {
    const weaponDef = this.getWeaponDefinition(weaponId);
    if (!weaponDef) {
        console.error(`Weapon ${weaponId} not registered. Using fallback.`);
        // Fallback: Create a text or basic sprite
        const fallback = scene.add.text(0, 0, "?", { fontSize: "32px", color: "#ff0000" });
        // Wrap in Container or convert to Sprite? 
        // Easier: Create a blank sprite if texture exists
        if (scene.textures.exists("default_item")) {
             fallback.destroy();
             return scene.add.sprite(0, 0, "default_item");
        }
        return fallback as any; // Temporary cast if signature expects Sprite
    }
    return weaponDef.graphic.create(scene);
  }

  static getWeaponDefinition(weaponId: string): WeaponDefinition | undefined {
    const weapon = this.weapons.find((w) => w.id === weaponId);
    if (weapon) return weapon;

    // Facade: Check Food Registry
    const food = FoodRegistry.foods.find(f => f.id === weaponId);
    if (food) return food;

    // Facade: Check Shield Registry
    const shield = ShieldRegistry.getShieldDefinition(weaponId);
    if (shield) {
        return {
            id: shield.id,
            name: shield.name,
            graphic: shield.graphic,
            defense: shield.defense,
            type: ItemType.SHIELD,
            // Adapter Defaults
            damage: 0,
            armor: 0,
            cooldown: 0,
            range: 0,
            exp_skill: 0,
            weight: 45.0, // Default weight
            stackable: false,
            consumable: false,
        } as WeaponDefinition;
    }


    // Facade: Check Item Registry
    const item = ItemRegistry.getItem(weaponId);
    if (item) return item;

    // Facade: Check Container Registry
    const container = ContainerRegistry.getContainer(weaponId);
    if (container) {
        return {
            id: container.id,
            name: container.name,
            graphic: container.graphic,
            weight: container.weight,
            type: ItemType.CONTAINER,
            // Defaults for WeaponDefinition compliance
            damage: 0,
            armor: 0,
            defense: 0,
            cooldown: 0,
            range: 0,
            exp_skill: 0,
            stackable: false,
            consumable: false,
            pickupable: container.pickupable
        } as WeaponDefinition;
    }

    return undefined;
  }

  static registerWeapon(weapon: WeaponDefinition): void {
    this.weapons.push(weapon);
  }
}

