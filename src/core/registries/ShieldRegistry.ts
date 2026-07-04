import { ShieldDefinition, ItemType } from "../types/gameTypes";

const shields: ShieldDefinition[] = [
  {
    id: "wooden_shield",
    name: "item_wooden_shield",
    type: ItemType.SHIELD,
    defense: 8,
    armor: 0,
    weight: 25,
    exp_skill: 50,
    stackable: false,
    description: "A simple wooden shield.",
  },
  {
    id: "iron_shield",
    name: "item_iron_shield",
    type: ItemType.SHIELD,
    defense: 12,
    armor: 0,
    weight: 40,
    exp_skill: 75,
    stackable: false,
    description: "A sturdy iron shield.",
  },
  {
    id: "tower_shield",
    name: "item_tower_shield",
    type: ItemType.SHIELD,
    defense: 16,
    armor: 0,
    weight: 60,
    exp_skill: 100,
    stackable: false,
    description: "A heavy tower shield providing excellent protection.",
  },
];

export function getShieldDefinition(shieldId: string): ShieldDefinition | undefined {
  return shields.find((s) => s.id === shieldId);
}

export const ShieldRegistry = {
  getShieldDefinition,
};

export type { ShieldDefinition };
