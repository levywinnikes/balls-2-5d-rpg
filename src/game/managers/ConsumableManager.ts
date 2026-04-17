import {
  ConsumableItem,
  ItemEffect,
  ItemType,
  ItemRarity,
} from "../types/ItemTypes";
import { ItemType as GameItemType } from "../../config/ItemConstants";
import { PlayerState } from "../entities/Player/PlayerState";
import type { WeaponDefinition } from "../entities/weapons/WeaponRegistry";

export class ConsumableManager {
  private playerState: PlayerState;

  constructor(playerState: PlayerState) {
    this.playerState = playerState;
  }

  /**
   * Tries to use an item.
   * @returns true if item was successfully used (and should be consumed)
   */
  public useItem(item: ConsumableItem): boolean {
    if (!item || !item.effects) return false;

    let used = false;

    // Process Effects
    for (const effect of item.effects) {
      if (this.applyEffect(effect)) {
        used = true;
      }
    }

    if (used) {
      // Visual / Sound feedback can be emitted here
      this.playerState.emit("itemUsed", item.id);
    }

    return used;
  }

  private applyEffect(effect: ItemEffect): boolean {
    switch (effect.type) {
      case "HEAL":
        // Logic: For food items, restore hunger instead of healing HP
        // Food items are mapped to HEAL type in adaptToConsumable
        this.playerState.eatFood(effect.value);
        return true;

      case "SATURATION":
        // Logic: Feed Player
        // this.playerState.feed(effect.value);
        return true;

      case "XP":
        this.playerState.gainExperience(effect.value);
        return true;

      default:
        console.warn("Unknown effect:", effect.type);
        return false;
    }
  }

  // --- ADAPTER (SHIM) ---
  // Converts old "WeaponDefinition" (which acts as a God Object) into strict "ConsumableItem"
  public adaptToConsumable(
    def: WeaponDefinition | undefined,
  ): ConsumableItem | null {
    if (!def) return null;

    // 1. Check if it looks like food
    if (def.type === GameItemType.FOOD || (def as any).hungerValue > 0) {
      const effects: ItemEffect[] = [];

      // Map hungerValue -> HEAL (for now, simplistic) or SATURATION
      if ((def as any).hungerValue) {
        effects.push({
          type: "HEAL", // Using HEAL for now as food heals in Tibia-like games usually unless hunger system exists
          value: (def as any).hungerValue,
        });
      }

      // Map custom effects here if any

      return {
        id: def.id,
        name: def.name,
        icon: def.id, // Assuming ID matches texture key often
        weight: def.weight || 0,
        stackable: def.stackable || true,
        rarity: ItemRarity.COMMON, // Default
        type: ItemType.CONSUMABLE,
        effects: effects,
        cooldown: 1000,
        consumesOnUse: true,
        description: def.description,
      };
    }

    // 2. Check runes (misc items that are consumable)
    // Using strict check or fallback for legacy "item" string if casting
    if (
      (def.type === GameItemType.RUNE || (def.type as any) === "item") &&
      (def as any).consumable
    ) {
      // Logic for runes?
      return {
        id: def.id,
        name: def.name,
        icon: def.id,
        weight: def.weight || 0,
        stackable: def.stackable,
        rarity: ItemRarity.COMMON,
        type: ItemType.CONSUMABLE,
        effects: [], // Add effects if defined
        cooldown: 2000,
        consumesOnUse: true,
      };
    }

    return null; // Not a consumable
  }
}
