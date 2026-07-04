import { RuneDefinition } from "../types/gameTypes";

const runes: Record<string, RuneDefinition> = {
  fire_burst_rune: {
    id: "fire_burst_rune",
    name: "Fire Burst Rune",
    description: "A burst of fire damage.",
    memoryCost: 10,
    damage: {
      element: "fire",
      baseMin: 20,
      baseMax: 40,
      area: 64,
    },
    enchantSound: "fire",
    effect3d: {
      color: "#ff4400",
      radius: 2,
      speed: 20,
    },
  },
  ice_shard_rune: {
    id: "ice_shard_rune",
    name: "Ice Shard Rune",
    description: "A piercing shard of ice.",
    memoryCost: 12,
    damage: {
      element: "ice",
      baseMin: 25,
      baseMax: 45,
      area: 32,
    },
    enchantSound: "ice",
    singleTargetOnly: true,
    effect3d: {
      color: "#00ccff",
      radius: 1.5,
      speed: 25,
    },
  },
  energy_bolt_rune: {
    id: "energy_bolt_rune",
    name: "Energy Bolt Rune",
    description: "A bolt of pure energy.",
    memoryCost: 15,
    damage: {
      element: "energy",
      baseMin: 30,
      baseMax: 55,
      area: 0,
    },
    enchantSound: "energy",
    singleTargetOnly: true,
    effect3d: {
      color: "#ffff00",
      radius: 1.5,
      speed: 30,
    },
  },
  star_fall_rune: {
    id: "star_fall_rune",
    name: "Star Fall Rune",
    description: "Calls down a star upon the target.",
    memoryCost: 20,
    damage: {
      element: "star",
      baseMin: 50,
      baseMax: 80,
      area: 96,
    },
    enchantSound: "star",
    effect3d: {
      color: "#ff00ff",
      radius: 3,
      speed: 15,
    },
  },
};

export function getRuneDefinition(id: string): RuneDefinition | undefined {
  return runes[id];
}

export function getAllRuneDefinitions(): RuneDefinition[] {
  return Object.values(runes);
}

export function calculateDamage(
  runeId: string,
  playerLevel: number,
  playerInt: number,
): { min: number; max: number } {
  const rune = runes[runeId];
  if (!rune) return { min: 0, max: 0 };

  const multiplier = 1 + playerLevel * 0.01 + playerInt * 0.05;

  return {
    min: Math.floor(rune.damage.baseMin * multiplier),
    max: Math.floor(rune.damage.baseMax * multiplier),
  };
}

export const RuneRegistry = {
  getRune: getRuneDefinition,
  getRuneDefinition,
  getAllRuneDefinitions,
  getAllRunes: getAllRuneDefinitions,
  calculateDamage,
};
