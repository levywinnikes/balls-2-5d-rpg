import Phaser from "phaser";
import { ItemGraphic } from "../../graphics/ItemGraphic";
import { WeaponDefinition } from "../weapons/WeaponRegistry";
import { ItemType } from "../../../config/ItemConstants";

export class FoodRegistry {
  public static readonly foods: WeaponDefinition[] = [
    {
      id: "rat_meat",
      name: "item_rat_meat",
      description: "desc_rat_meat",
      graphic: {
        preload: (scene) => ItemGraphic.preload(scene, "rat_meat", "rat_meat.png"),
        create: (scene) => ItemGraphic.create(scene, "rat_meat"),
      },
      damage: 0,
      armor: 0,
      defense: 0,
      cooldown: 0,
      range: 0,
      type: ItemType.FOOD,
      exp_skill: 0,
      weight: 5.0,
      stackable: true,
      consumable: true,
      hungerValue: 60
    }
  ];
}
