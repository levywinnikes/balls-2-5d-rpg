import type { PlayerState } from "../../game/entities/Player/PlayerState";
import type { ConsumableItem, ItemEffect } from "../types/gameTypes";
import { ItemType, ItemRarity } from "../types/gameTypes";
import type { WeaponDefinition } from "../types/gameTypes";

export class ConsumableManager {
  private playerState: PlayerState;

  constructor(playerState: PlayerState) {
    this.playerState = playerState;
  }

  public adaptToConsumable(def: WeaponDefinition | undefined): ConsumableItem | null {
    if (!def) return null;

    if (def.type === ItemType.FOOD || (def as any).hungerValue > 0) {
      const effects: ItemEffect[] = [];

      if ((def as any).hungerValue) {
        effects.push({
          type: "HEAL",
          value: (def as any).hungerValue,
        });
      }

      return {
        id: def.id,
        name: def.name,
        icon: def.id,
        weight: def.weight || 0,
        stackable: def.stackable || true,
        rarity: ItemRarity.COMMON,
        type: ItemType.FOOD,
        effects,
        cooldown: 1000,
        consumesOnUse: true,
        description: def.description,
      };
    }

    if (
      (def.type === ItemType.RUNE || (def.type as any) === "item") &&
      (def as any).consumable
    ) {
      return {
        id: def.id,
        name: def.name,
        icon: def.id,
        weight: def.weight || 0,
        stackable: def.stackable,
        rarity: ItemRarity.COMMON,
        type: ItemType.RUNE,
        effects: [],
        cooldown: 2000,
        consumesOnUse: true,
      };
    }

    return null;
  }

  public useItem(item: { effects?: { type: string; value: number; duration?: number; attribute?: string }[] }): boolean {
    if (!item || !item.effects) return false;

    let used = false;

    for (const effect of item.effects) {
      if (this.applyEffect(effect)) {
        used = true;
      }
    }

    return used;
  }

  private applyEffect(effect: { type: string; value: number; duration?: number; attribute?: string }): boolean {
    switch (effect.type) {
      case "HEAL": {
        const player = this.playerState as any;
        const newHealth = Math.min(
          (player as any).health + effect.value,
          (player as any).maxHealth,
        );
        (player as any).health = newHealth;
        player.emit("updateStats");
        return true;
      }
      case "MANA": {
        const player = this.playerState as any;
        const newMana = Math.min(
          (player as any).mana + effect.value,
          (player as any).maxMana,
        );
        (player as any).mana = newMana;
        player.emit("updateStats");
        return true;
      }
      case "XP": {
        (this.playerState as any).addExperience(effect.value);
        return true;
      }
      case "BUFF": {
        if (effect.attribute && effect.duration) {
          (this.playerState as any).addBuff({
            id: `consumable_${effect.attribute}`,
            attr: effect.attribute,
            value: effect.value,
            duration: effect.duration,
            isPercent: false,
          });
          return true;
        }
        return false;
      }
      case "SATURATION": {
        (this.playerState as any).addHunger?.(-effect.value);
        return true;
      }
      default:
        return false;
    }
  }
}
