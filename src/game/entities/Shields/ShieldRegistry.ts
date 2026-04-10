import Phaser from "phaser";
import { ShieldGraphic } from "./ShieldGraphic";

export type ShieldDefinition = {
  id: string;
  name: string;
  type: string;
  graphic: {
    preload: (scene: Phaser.Scene) => void;
    create: (scene: Phaser.Scene) => Phaser.GameObjects.Sprite;
  };
  defense: number;
  description?: string;
};

export class ShieldRegistry {
  private static shields: ShieldDefinition[] = [
    {
      id: "wooden_shield",
      name: "item_wooden_shield",
      type: "shield",
      graphic: ShieldGraphic,
      defense: 8,
      description: "A simple wooden shield."
    },
    {
      id: "iron_shield",
      name: "item_iron_shield",
      type: "shield",
      graphic: ShieldGraphic,
      defense: 12,
      description: "A sturdy iron shield."
    },
    {
      id: "tower_shield",
      name: "item_tower_shield",
      type: "shield",
      graphic: ShieldGraphic,
      defense: 16,
      description: "A heavy tower shield providing excellent protection."
    },
  ];

  static preloadAll(scene: Phaser.Scene): void {
    this.shields.forEach((shield) => {
      shield.graphic.preload(scene);
    });
  }

  static createShieldGraphic(
    scene: Phaser.Scene,
    shieldId: string
  ): Phaser.GameObjects.Sprite {
    const shieldDef = this.getShieldDefinition(shieldId);
    if (!shieldDef) throw new Error(`Shield ${shieldId} not registered`);
    return shieldDef.graphic.create(scene);
  }

  static getShieldDefinition(shieldId: string): ShieldDefinition | undefined {
    return this.shields.find((s) => s.id === shieldId);
  }

  static registerShield(shield: ShieldDefinition): void {
    this.shields.push(shield);
  }
}
