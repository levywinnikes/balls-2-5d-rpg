import Phaser from "phaser";
import { ItemGraphic } from "../../graphics/ItemGraphic";
import { WeaponDefinition } from "../../types/gameTypes";
import { ItemType } from "../../../config/ItemConstants";

export class ItemRegistry {
  private static items: WeaponDefinition[] = [
    {
      id: "magic_rune",
      name: "item_magic_rune",
      description: "desc_magic_rune",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "magic_rune"),
        create: (scene) => ItemGraphic.create(scene, "magic_rune"),
      },
      damage: 0,
      armor: 0,
      defense: 0,
      cooldown: 0,
      range: 0,
      type: ItemType.RUNE,
      exp_skill: 0,
      weight: 1.2,
      stackable: true,
      consumable: false,
    },
  ];

  static preloadAll(scene: Phaser.Scene): void {
    this.items.forEach((item) => {
      if (item.graphic) item.graphic.preload(scene);
    });
  }

  static getItem(id: string): WeaponDefinition | undefined {
    return this.items.find((i) => i.id === id);
  }

  static getItems(): WeaponDefinition[] {
    return this.items;
  }
}
