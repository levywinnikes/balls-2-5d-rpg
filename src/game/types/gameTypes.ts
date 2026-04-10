import { ItemType } from "../../config/ItemConstants";

export type { ItemType };

export type WeaponDefinition = {
  id: string;
  name: string;
  graphic: {
    preload: (scene: Phaser.Scene) => void;
    create: (scene: Phaser.Scene) => Phaser.GameObjects.Sprite;
  };
  damage: number;
  armor: number; // Armor value
  defense: number; // Defense (Shields/Weapons)
  cooldown: number;
  range: number;
  type: ItemType;
  exp_skill: number;
  weight: number;
  stackable: boolean;
  consumable: boolean;
  hungerValue?: number; // Food value
  pickupable?: boolean; // Control pickup logic
  description?: string; // Flavor text / Description key
  element?: "fire" | "ice" | "energy";
  lightRadius?: number;
  resistances?: Record<string, number>; // Elemental resistances (inherent)
  defenseResistances?: Record<string, number>; // Elemental resistances (when blocking)
  terrainResistance?: number; // 0.0 to 1.0 (1 = 100% reduction of penalty)
  speedBonus?: number;
};
