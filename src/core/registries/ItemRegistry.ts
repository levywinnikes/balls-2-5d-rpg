import { ItemType, WeaponDefinition } from "../types/gameTypes";

const items: WeaponDefinition[] = [
  {
    id: "magic_rune",
    name: "item_magic_rune",
    description: "desc_magic_rune",
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

export function getItemData(id: string): WeaponDefinition | undefined {
  return items.find((i) => i.id === id);
}

export function getAllItemsData(): WeaponDefinition[] {
  return items;
}

export const ItemRegistry = {
  getItem: getItemData,
  getItemData,
  getAllItemsData,
};
