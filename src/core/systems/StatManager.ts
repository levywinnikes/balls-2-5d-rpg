import { PlayerState } from "../../game/entities/Player/PlayerState";
import {
  WeaponRegistry,
  WeaponDefinition,
} from "../registries/WeaponRegistry";
import { EquipmentSlot, ItemType } from "../types/gameTypes";

export interface StatModifier {
  source: string;
  attr: string;
  type: "FLAT" | "PERCENT";
  value: number;
  category: "base" | "equipment" | "buff" | "consumable" | "passive" | "skill";
  color?: string;
  cssClass?: string;
  quality?: "bronze" | "silver" | "gold" | "diamond";
}

export interface StatResult {
  finalValue: number;
  breakdown: {
    base: number;
    percentTotal: number;
    flatTotal: number;
    globalMultiplier: number;
    sources: StatModifier[];
    globalMultipliers: StatModifier[];
  };
}

export class StatManager {
  private static instance: StatManager;

  private constructor() {}

  public static getInstance(): StatManager {
    if (!StatManager.instance) {
      StatManager.instance = new StatManager();
    }
    return StatManager.instance;
  }

  public calculateStat(
    statName: string,
    state: PlayerState,
    overrides?: Map<string, any>,
  ): StatResult {
    const modifiers: StatModifier[] = this.gatherModifiers(
      statName,
      state,
      overrides,
    );

    let baseValue = 0;
    const baseMod = modifiers.find((m) => m.category === "base");
    if (baseMod) {
      baseValue = baseMod.value;
    }

    const flatModifiers = modifiers.filter(
      (m) => m.type === "FLAT" && m.category !== "base",
    );
    const totalFlat = flatModifiers.reduce((acc, m) => acc + m.value, 0);

    const subtotalFlat = baseValue + totalFlat;

    const percentModifiers = modifiers.filter((m) => m.type === "PERCENT");
    const totalPercent = percentModifiers.reduce((acc, m) => acc + m.value, 0);

    let afterPercent = subtotalFlat * (1 + totalPercent / 100);

    if (statName === "criticalChance" || statName === "criticalDamage") {
      afterPercent = subtotalFlat + totalPercent;
    }

    let afterFlat = afterPercent;

    let globalMult = 1.0;
    const globalMultipliers: StatModifier[] = [];

    const wpPercent = this.getWillpowerBonusPercent(state);
    if (wpPercent > 0) {
      if (
        [
          "maxHealth",
          "maxMana",
          "attack",
          "defense",
          "armor",
          "speed",
          "capacity",
          "memory",
        ].includes(statName)
      ) {
        const wpVal = 1 + wpPercent / 100;
        globalMult *= wpVal;

        globalMultipliers.push({
          source: `Willpower (Tier ${state.getWillpowerTier()})`,
          attr: statName,
          type: "PERCENT",
          value: wpVal,
          category: "passive",
          color: "#a855f7",
        });
      }
    }

    let finalValue = afterFlat * globalMult;

    if (statName !== "criticalChance" && statName !== "criticalDamage") {
      finalValue = Math.floor(finalValue);
    } else {
      finalValue = Number(finalValue.toFixed(2));
    }

    return {
      finalValue,
      breakdown: {
        base: baseValue,
        percentTotal: totalPercent,
        flatTotal: totalFlat,
        globalMultiplier: globalMult,
        sources: modifiers,
        globalMultipliers,
      },
    };
  }

  public getEquippedStarCounts(state: PlayerState): {
    gold: number;
    silver: number;
    bronze: number;
  } {
    let gold = 0;
    let silver = 0;
    let bronze = 0;
    const slots: string[] = [
      EquipmentSlot.HEAD,
      EquipmentSlot.BODY,
      EquipmentSlot.LEGS,
      EquipmentSlot.BOOTS,
      EquipmentSlot.MAIN_HAND,
      EquipmentSlot.OFF_HAND,
      EquipmentSlot.RING,
      EquipmentSlot.NECK,
    ];

    slots.forEach((slot) => {
      const item = state.getEquippedItemInSlot(slot);
      if (item && item.stars) {
        if (item.stars >= 3) gold++;
        else if (item.stars === 2) silver++;
        else if (item.stars === 1) bronze++;
      }
    });
    return { gold, silver, bronze };
  }

  public calculateStarPoints(state: PlayerState): {
    totalPoints: number;
    levelPoints: number;
    equipmentPoints: number;
    willpowerBonus: number;
    willpowerTier: number;
    willpowerPercent: number;
    equipmentBreakdown: {
      itemName: string;
      slot: string;
      stars: { tier: string; points: number }[];
      totalItemPoints: number;
    }[];
  } {
    const levelPoints = state.getLevel();

    const slots: string[] = [
      EquipmentSlot.HEAD,
      EquipmentSlot.BODY,
      EquipmentSlot.LEGS,
      EquipmentSlot.BOOTS,
      EquipmentSlot.MAIN_HAND,
      EquipmentSlot.OFF_HAND,
      EquipmentSlot.RING,
      EquipmentSlot.NECK,
    ];

    const tierPointMap: Record<string, number> = {
      bronze: 1,
      silver: 3,
      gold: 5,
    };

    const equipmentBreakdown: {
      itemName: string;
      slot: string;
      stars: { tier: string; points: number }[];
      totalItemPoints: number;
    }[] = [];

    let equipmentPoints = 0;

    slots.forEach((slot) => {
      const item = state.getEquippedItemInSlot(slot);
      if (item && item.attributes && item.attributes.length > 0) {
        const def = WeaponRegistry.getWeaponDefinition(item.itemId);
        const name = def ? def.name : item.itemId;

        const starDetails: { tier: string; points: number }[] = [];
        let itemTotal = 0;

        item.attributes.forEach((attr: any) => {
          if (attr.tier && tierPointMap[attr.tier]) {
            const pts = tierPointMap[attr.tier];
            starDetails.push({ tier: attr.tier, points: pts });
            itemTotal += pts;
          }
        });

        if (itemTotal > 0) {
          equipmentBreakdown.push({
            itemName: name,
            slot,
            stars: starDetails,
            totalItemPoints: itemTotal,
          });
          equipmentPoints += itemTotal;
        }
      }
    });

    const subtotal = levelPoints + equipmentPoints;
    const wpPercent = this.getWillpowerBonusPercent(state);
    const wpTier = state.getWillpowerTier();
    const willpowerBonus = Math.round(subtotal * (wpPercent / 100));
    const totalPoints = subtotal + willpowerBonus;

    return {
      totalPoints,
      levelPoints,
      equipmentPoints,
      willpowerBonus,
      willpowerTier: wpTier,
      willpowerPercent: wpPercent,
      equipmentBreakdown,
    };
  }

  private gatherModifiers(
    statName: string,
    state: PlayerState,
    overrides?: Map<string, any>,
  ): StatModifier[] {
    const modifiers: StatModifier[] = [];

    let baseVal = 0;
    switch (statName) {
      case "strength":
        baseVal = state.getBaseStrengthLevel();
        break;
      case "dexterity":
        baseVal = state.getBaseDexterityLevel();
        break;
      case "reflex":
        baseVal = state.getBaseReflexLevel();
        break;
      case "intelligence":
        baseVal = state.getBaseIntelligenceLevel();
        break;
      case "level":
        baseVal = state.getLevel();
        break;
      case "maxHealth":
        baseVal = 100;
        break;
      case "maxMana":
        baseVal = 100;
        break;
      case "criticalChance":
        baseVal = 0;
        break;
      case "criticalDamage":
        baseVal = 0;
        break;
      case "speed":
        baseVal = 200;
        break;

      case "range":
        baseVal = 0;
        break;
      case "cooldown":
        baseVal = 0;
        break;
      case "lightRadius":
        baseVal = 0;
        break;
      case "expPerHit":
        baseVal = 0;
        break;
      case "fireResist":
        baseVal = 0;
        break;
      case "iceResist":
        baseVal = 0;
        break;
      case "poisonResist":
        baseVal = 0;
        break;
      case "energyResist":
        baseVal = 0;
        break;
      case "physicalResist":
        baseVal = 0;
        break;
      case "expDamagePercent":
        baseVal = 0;
        break;

      case "attack": {
        const unarmedSlotItem = state.getEquippedItemInSlot(
          EquipmentSlot.MAIN_HAND,
        );
        baseVal = unarmedSlotItem ? 0 : 5;
        break;
      }
      case "defense":
        baseVal = 0;
        break;
      case "armor":
        baseVal = 0;
        break;

      case "memory":
        baseVal = state.baseMemory;
        break;
      case "capacity":
        baseVal = 400;
        break;
    }

    if (baseVal > 0 || statName === "criticalDamage" || statName === "speed") {
      modifiers.push({
        source: "Base Character",
        attr: statName,
        type: "FLAT",
        value: baseVal,
        category: "base",
      });
    }

    const buffs = state.getBuffs();
    buffs.forEach((buff) => {
      if (buff.attr === statName) {
        modifiers.push({
          source: `Buff: ${buff.id}`,
          attr: statName,
          type: buff.isPercent ? "PERCENT" : "FLAT",
          value: buff.value,
          category: "buff",
        });
      }
    });

    if (statName === "attack") {
      const lvl = state.getLevel();
      if (lvl > 1) {
        modifiers.push({
          source: "Level Bonus",
          attr: "attack",
          type: "PERCENT",
          value: Math.max(0, lvl - 1),
          category: "skill",
        });
      }

      const weaponItem =
        overrides?.get(EquipmentSlot.MAIN_HAND) ||
        state.getEquippedItemInSlot(EquipmentSlot.MAIN_HAND);
      const weapon = weaponItem
        ? WeaponRegistry.getWeaponDefinition(weaponItem.itemId)
        : null;
      let skillVal = 0;
      let sourceName = "Strength";

      if (
        !weapon ||
        weapon.type === ItemType.MELEE ||
        weapon.type === ItemType.SWORD ||
        weapon.type === ItemType.AXE ||
        weapon.type === ItemType.CLUB
      ) {
        skillVal = state.getStrengthLevel();
        sourceName = "Strength";
      } else if (
        weapon.type === ItemType.RANGED ||
        weapon.type === ItemType.DISTANCE
      ) {
        skillVal = state.getDexterityLevel();
        sourceName = "Dexterity";
      } else if (weapon.element === "fire") {
        skillVal = state.getIntelligenceLevel();
        sourceName = "Intelligence";
      }

      modifiers.push({
        source: `${sourceName} Bonus`,
        attr: "attack",
        type: "PERCENT",
        value: skillVal * 5,
        category: "skill",
      });
    } else if (statName === "defense") {
      const lvl = state.getLevel();
      modifiers.push({
        source: "Level Bonus",
        attr: "defense",
        type: "PERCENT",
        value: lvl * 1,
        category: "skill",
      });

      const reflex = state.getReflexLevel();
      modifiers.push({
        source: "Reflex Bonus",
        attr: "defense",
        type: "PERCENT",
        value: reflex * 5,
        category: "skill",
      });
    } else if (statName === "speed") {
      const lvl = state.getLevel();
      if (lvl > 1) {
        modifiers.push({
          source: "Level Bonus",
          attr: "speed",
          type: "FLAT",
          value: (lvl - 1) * 4,
          category: "skill",
        });
      }
    } else if (statName === "memory") {
      const lvl = state.getLevel();
      modifiers.push({
        source: "Level Bonus",
        attr: "memory",
        type: "FLAT",
        value: lvl * 1,
        category: "skill",
      });

      const int = state.getIntelligenceLevel();
      modifiers.push({
        source: "Intelligence Bonus",
        attr: "memory",
        type: "FLAT",
        value: int * 5,
        category: "skill",
      });
    } else if (statName === "maxHealth") {
      const lvl = state.getLevel();
      if (lvl > 1) {
        modifiers.push({
          source: "Level Bonus",
          attr: "maxHealth",
          type: "FLAT",
          value: (lvl - 1) * 5,
          category: "skill",
        });
      }
    } else if (statName === "capacity") {
      const lvl = state.getLevel();
      modifiers.push({
        source: "Level Bonus",
        attr: "capacity",
        type: "FLAT",
        value: lvl * 10,
        category: "skill",
      });
    } else if (statName === "criticalChance") {
      const dex = state.getDexterityLevel();
      if (dex > 0) {
        modifiers.push({
          source: "Dexterity Bonus",
          attr: "criticalChance",
          type: "FLAT",
          value: Number((dex * 0.2).toFixed(2)),
          category: "skill",
        });
      }
    } else if (statName === "criticalDamage") {
      const str = state.getStrengthLevel();
      if (str > 0) {
        modifiers.push({
          source: "Strength Bonus",
          attr: "criticalDamage",
          type: "PERCENT",
          value: str * 1,
          category: "skill",
        });
      }
    }

    const slots: string[] = [
      EquipmentSlot.HEAD,
      EquipmentSlot.BODY,
      EquipmentSlot.LEGS,
      EquipmentSlot.BOOTS,
      EquipmentSlot.MAIN_HAND,
      EquipmentSlot.OFF_HAND,
      EquipmentSlot.RING,
      EquipmentSlot.NECK,
    ];

    slots.forEach((slot) => {
      const equippedItem = overrides?.has(slot)
        ? overrides.get(slot)
        : state.getEquippedItemInSlot(slot);
      if (equippedItem) {
        const def = WeaponRegistry.getWeaponDefinition(equippedItem.itemId);
        const name = def ? def.name : equippedItem.itemId;

        if (equippedItem.attributes) {
          equippedItem.attributes.forEach((attr: any) => {
            const sourceName = name;

            switch (attr.type) {
              case "critical_chance":
                if (statName === "criticalChance") {
                  modifiers.push({
                    source: sourceName,
                    attr: "criticalChance",
                    type: "FLAT",
                    value: attr.value,
                    category: "equipment",
                    quality: attr.tier,
                  });
                }
                break;
              case "critical_damage":
                if (statName === "criticalDamage") {
                  modifiers.push({
                    source: sourceName,
                    attr: "criticalDamage",
                    type: "FLAT",
                    value: attr.value,
                    category: "equipment",
                    quality: attr.tier,
                  });
                }
                break;
              case "attack":
                if (statName === "attack") {
                  modifiers.push({
                    source: sourceName,
                    attr: "attack",
                    type: "PERCENT",
                    value: attr.value,
                    category: "equipment",
                    quality: attr.tier,
                  });
                }
                break;
              case "defense":
                if (statName === "defense") {
                  modifiers.push({
                    source: sourceName,
                    attr: "defense",
                    type: "PERCENT",
                    value: attr.value,
                    category: "equipment",
                    quality: attr.tier,
                  });
                }
                break;
              case "max_health":
                if (statName === "maxHealth") {
                  modifiers.push({
                    source: sourceName,
                    attr: "maxHealth",
                    type: "FLAT",
                    value: attr.value,
                    category: "equipment",
                    quality: attr.tier,
                  });
                }
                break;
              case "speed":
                if (statName === "speed") {
                  modifiers.push({
                    source: sourceName,
                    attr: "speed",
                    type: "FLAT",
                    value: attr.value,
                    category: "equipment",
                    quality: attr.tier,
                  });
                }
                break;

              case "range":
                if (statName === "range") {
                  modifiers.push({
                    source: sourceName,
                    attr: "range",
                    type: "FLAT",
                    value: attr.value,
                    category: "equipment",
                    quality: attr.tier,
                  });
                }
                break;
              case "cooldown":
                if (statName === "cooldown") {
                  modifiers.push({
                    source: sourceName,
                    attr: "cooldown",
                    type: "FLAT",
                    value: attr.value,
                    category: "equipment",
                    quality: attr.tier,
                  });
                }
                break;
              case "exp_per_hit":
                if (statName === "expPerHit") {
                  modifiers.push({
                    source: sourceName,
                    attr: "expPerHit",
                    type: "FLAT",
                    value: attr.value,
                    category: "equipment",
                    quality: attr.tier,
                  });
                }
                break;
              case "exp_damage_percent":
                if (statName === "expDamagePercent") {
                  modifiers.push({
                    source: sourceName,
                    attr: "expDamagePercent",
                    type: "FLAT",
                    value: attr.value,
                    category: "equipment",
                    quality: attr.tier,
                  });
                }
                break;
              case "capacity":
                if (statName === "capacity") {
                  modifiers.push({
                    source: sourceName,
                    attr: "capacity",
                    type: "FLAT",
                    value: attr.value,
                    category: "equipment",
                    quality: attr.tier,
                  });
                }
                break;
            }
          });
        }

        if (def) {
          if (
            statName === "speed" &&
            def.type === ItemType.BOOTS &&
            def.speedBonus
          ) {
            modifiers.push({
              source: name,
              attr: "speed",
              type: "FLAT",
              value: def.speedBonus,
              category: "equipment",
            });
          }

          if (statName === "defense") {
            if (
              (def.type === ItemType.SHIELD ||
                def.type === ItemType.MELEE ||
                def.type === ItemType.RANGED ||
                def.type === ItemType.SWORD ||
                def.type === ItemType.AXE ||
                def.type === ItemType.CLUB) &&
              def.defense
            ) {
              modifiers.push({
                source: name,
                attr: "defense",
                type: "FLAT",
                value: def.defense,
                category: "equipment",
              });
            }
          }

          if (statName === "armor") {
            if (
              [
                ItemType.BODY_ARMOR,
                ItemType.LEGS,
                ItemType.HELMET,
                ItemType.BOOTS,
                ItemType.RING,
                ItemType.AMULET,
              ].includes(def.type)
            ) {
              if (def.armor) {
                modifiers.push({
                  source: name,
                  attr: "armor",
                  type: "FLAT",
                  value: def.armor,
                  category: "equipment",
                });
              }
              else if (def.defense) {
                modifiers.push({
                  source: name,
                  attr: "armor",
                  type: "FLAT",
                  value: def.defense,
                  category: "equipment",
                });
              }
            }
          }

          if (
            statName === "attack" &&
            def.damage &&
            slot === EquipmentSlot.MAIN_HAND
          ) {
            modifiers.push({
              source: name,
              attr: "attack",
              type: "FLAT",
              value: def.damage,
              category: "equipment",
            });
          }

          if (statName === "range" && def.range) {
            modifiers.push({
              source: name,
              attr: "range",
              type: "FLAT",
              value: def.range,
              category: "equipment",
            });
          }

          if (statName === "cooldown" && def.cooldown) {
            modifiers.push({
              source: name,
              attr: "cooldown",
              type: "FLAT",
              value: def.cooldown,
              category: "equipment",
            });
          }

          if (statName === "lightRadius" && def.lightRadius) {
            modifiers.push({
              source: name,
              attr: "lightRadius",
              type: "FLAT",
              value: def.lightRadius,
              category: "equipment",
            });
          }

          if (statName === "expPerHit" && def.exp_skill) {
            modifiers.push({
              source: name,
              attr: "expPerHit",
              type: "FLAT",
              value: def.exp_skill,
              category: "equipment",
            });
          }

          if (def.resistances) {
            if (statName === "fireResist" && def.resistances.fire)
              modifiers.push({
                source: name,
                attr: "fireResist",
                type: "FLAT",
                value: def.resistances.fire * 100,
                category: "equipment",
              });
            if (statName === "iceResist" && def.resistances.ice)
              modifiers.push({
                source: name,
                attr: "iceResist",
                type: "FLAT",
                value: def.resistances.ice * 100,
                category: "equipment",
              });
            if (statName === "poisonResist" && def.resistances.poison)
              modifiers.push({
                source: name,
                attr: "poisonResist",
                type: "FLAT",
                value: def.resistances.poison * 100,
                category: "equipment",
              });
            if (statName === "energyResist" && def.resistances.energy)
              modifiers.push({
                source: name,
                attr: "energyResist",
                type: "FLAT",
                value: def.resistances.energy * 100,
                category: "equipment",
              });
            if (statName === "physicalResist" && def.resistances.physical)
              modifiers.push({
                source: name,
                attr: "physicalResist",
                type: "FLAT",
                value: def.resistances.physical * 100,
                category: "equipment",
              });
          }
        }
      }
    });

    return modifiers;
  }

  public getCriticalChance(state: PlayerState): StatResult {
    return this.calculateStat("criticalChance", state);
  }

  public calculateWeaponAttack(
    def: WeaponDefinition,
    attributes: any[] = [],
    state: PlayerState,
    overrideLevel?: number,
    overrideSkill?: number,
  ) {
    let base = def.damage || 0;

    const level =
      overrideLevel !== undefined ? overrideLevel : state.getLevel();
    const str = state.getStrengthLevel();
    const dex = state.getDexterityLevel();
    const int = state.getIntelligenceLevel();

    const valFromLevel = base * (Math.max(0, level - 1) / 100);

    let skillVal = 0;
    if (overrideSkill !== undefined) {
      skillVal = overrideSkill;
    } else {
      if (def.type === "ranged") skillVal = dex;
      else if (def.element === "fire") skillVal = int;
      else skillVal = str;
    }

    const valFromSkill = base * (skillVal * 0.05);

    let valFromAttributes = 0;
    let attrTotalPct = 0;

    if (attributes) {
      attributes.forEach((attr: any) => {
        if (attr.type === "max_damage" || attr.type === "attack") {
          attrTotalPct += attr.value;
        }
      });
    }

    valFromAttributes = base * (attrTotalPct / 100);

    const subtotal = base + valFromLevel + valFromSkill + valFromAttributes;

    const wpPct = state.getWillpowerBonusPercent();
    const valFromWp = subtotal * (wpPct / 100);

    const finalTotal = Math.floor(subtotal + valFromWp);

    return {
      base,
      valFromLevel,
      valFromSkill,
      valFromAttributes,
      attrTotalPct,
      subtotal,
      wpBonusPct: wpPct,
      valFromWp,
      finalTotal,
    };
  }

  public getWillpowerBonusPercent(state: PlayerState): number {
    const tier = state.getWillpowerTier();
    if (tier >= 10) return 15;
    return tier * 1;
  }

  public getAllNonZeroStats(
    state: PlayerState,
  ): { id: string; result: StatResult }[] {
    const allStats = [
      "maxHealth",
      "maxMana",
      "attack",
      "defense",
      "armor",
      "speed",
      "capacity",
      "memory",
      "criticalChance",
      "criticalDamage",
      "strength",
      "dexterity",
      "intelligence",
      "reflex",
      "range",
      "cooldown",
      "lightRadius",
      "fireResist",
      "iceResist",
      "poisonResist",
      "energyResist",
      "physicalResist",
    ];

    const results: { id: string; result: StatResult }[] = [];

    for (const stat of allStats) {
      const res = this.calculateStat(stat, state);
      if (res.finalValue > 0 || res.breakdown.sources.length > 0) {
        results.push({ id: stat, result: res });
      }
    }

    return results;
  }

  public getOffensiveExpBonus(state: PlayerState): StatResult {
    const modifiers: StatModifier[] = [];
    modifiers.push({
      source: "Base Character",
      attr: "offensiveExp",
      type: "FLAT",
      value: 0,
      category: "base",
    });

    const offensiveSlots: string[] = [
      EquipmentSlot.MAIN_HAND,
      EquipmentSlot.RING,
      EquipmentSlot.NECK,
    ];

    offensiveSlots.forEach((slot) => {
      const item = state.getEquippedItemInSlot(slot);
      if (item) {
        const def = WeaponRegistry.getWeaponDefinition(item.itemId);
        if (def) {
          const name = def.name;
          const isWeapon = def.type === "melee" || def.type === "ranged";

          if (def.exp_skill && isWeapon) {
            modifiers.push({
              source: name,
              attr: "offensiveExp",
              type: "FLAT",
              value: def.exp_skill,
              category: "equipment",
            });
          }
        }
      }
    });

    const totalFlat = modifiers
      .filter((m) => m.category !== "base")
      .reduce((acc, m) => acc + m.value, 0);

    return {
      finalValue: totalFlat,
      breakdown: {
        base: 0,
        percentTotal: 0,
        flatTotal: totalFlat,
        globalMultiplier: 1,
        sources: modifiers,
        globalMultipliers: [],
      },
    };
  }

  public getDefensiveExpBonus(state: PlayerState): StatResult {
    const modifiers: StatModifier[] = [];
    modifiers.push({
      source: "Base Character",
      attr: "defensiveExp",
      type: "FLAT",
      value: 0,
      category: "base",
    });

    const defensiveSlots: string[] = [
      EquipmentSlot.OFF_HAND,
      EquipmentSlot.HEAD,
      EquipmentSlot.BODY,
      EquipmentSlot.LEGS,
      EquipmentSlot.BOOTS,
    ];

    defensiveSlots.forEach((slot) => {
      const item = state.getEquippedItemInSlot(slot);
      if (item) {
        const def = WeaponRegistry.getWeaponDefinition(item.itemId);
        if (def) {
          const name = def.name;
          const isArmorOrShield = [
            ItemType.BODY_ARMOR,
            ItemType.LEGS,
            ItemType.HELMET,
            ItemType.BOOTS,
            ItemType.SHIELD,
          ].includes(def.type);

          if (item.stars && item.stars > 0 && isArmorOrShield) {
            const bonus = item.stars >= 3 ? 2 : item.stars === 2 ? 1 : 0;
            if (bonus > 0) {
              let tierName: "bronze" | "silver" | "gold" = "bronze";
              if (item.stars >= 3) tierName = "gold";
              else if (item.stars === 2) tierName = "silver";

              modifiers.push({
                source: `${name} (Star)`,
                attr: "defensiveExp",
                type: "FLAT",
                value: bonus,
                category: "equipment",
                quality: tierName,
                color: "#eab308",
              });
            }
          }

          if (def.exp_skill && isArmorOrShield) {
            modifiers.push({
              source: name,
              attr: "defensiveExp",
              type: "FLAT",
              value: def.exp_skill,
              category: "equipment",
            });
          }
        }
      }
    });

    const totalFlat = modifiers
      .filter((m) => m.category !== "base")
      .reduce((acc, m) => acc + m.value, 0);

    return {
      finalValue: totalFlat,
      breakdown: {
        base: 0,
        percentTotal: 0,
        flatTotal: totalFlat,
        globalMultiplier: 1,
        sources: modifiers,
        globalMultipliers: [],
      },
    };
  }

  public calculateDPSBreakdown(state: PlayerState) {
    const attackRes = this.calculateStat("attack", state);
    const critChanceRes = this.calculateStat("criticalChance", state);
    const critDmgRes = this.calculateStat("criticalDamage", state);
    const cooldownRes = this.calculateStat("cooldown", state);

    const maxAttack = attackRes.finalValue;
    const critChance = critChanceRes.finalValue;
    const critMultiplier = critDmgRes.finalValue / 100;

    const aps = cooldownRes.finalValue > 0 ? 1000 / cooldownRes.finalValue : 0;

    const avgNormalDmg = (1 + maxAttack) / 2;
    const maxCritDmg = Math.floor(maxAttack * (1 + critMultiplier));
    const avgCritDmg = (maxAttack + maxCritDmg) / 2;

    const willpowerBonus = this.getWillpowerBonusPercent(state);
    const dexterity = state.getDexterityLevel();
    const strength = state.getStrengthLevel();

    const dps =
      ((1 - critChance / 100) * avgNormalDmg +
        (critChance / 100) * avgCritDmg) *
      aps;

    return {
      totalDPS: Number(dps.toFixed(2)),
      aps: Number(aps.toFixed(2)),
      cooldown: cooldownRes.finalValue,
      avgNormalDmg: Number(avgNormalDmg.toFixed(1)),
      avgCritDmg: Number(avgCritDmg.toFixed(1)),
      critChance,
      critMultiplier: Number((critMultiplier * 100).toFixed(1)),
      maxAttack,
      maxCritDmg,
      willpowerBonus,
      dexterity,
      strength,
    };
  }

  public calculateAPSBreakdown(state: PlayerState) {
    const cooldownRes = this.calculateStat("cooldown", state);
    const baseValue = cooldownRes.breakdown.base;
    const finalCooldown = cooldownRes.finalValue;
    const aps = finalCooldown > 0 ? 1000 / finalCooldown : 0;

    return {
      aps: Number(aps.toFixed(2)),
      baseCooldown: baseValue,
      finalCooldown: finalCooldown,
      modifiers: cooldownRes.breakdown.sources.filter(
        (m) => m.category !== "base",
      ),
    };
  }

  public calculateItemDPS(item: any, state: PlayerState): number {
    const def = WeaponRegistry.getWeaponDefinition(item.itemId);
    if (
      !def ||
      (def.type !== ItemType.MELEE &&
        def.type !== ItemType.SWORD &&
        def.type !== ItemType.AXE &&
        def.type !== ItemType.CLUB &&
        def.type !== ItemType.RANGED &&
        def.type !== ItemType.DISTANCE)
    ) {
      return 0;
    }

    const overrides = new Map<string, any>();
    overrides.set(EquipmentSlot.MAIN_HAND, item);

    const attackRes = this.calculateStat("attack", state, overrides);
    const critChanceRes = this.calculateStat(
      "criticalChance",
      state,
      overrides,
    );
    const critDmgRes = this.calculateStat("criticalDamage", state, overrides);
    const cooldownRes = this.calculateStat("cooldown", state, overrides);

    const maxAttack = attackRes.finalValue;
    const critChance = critChanceRes.finalValue;
    const critMultiplier = critDmgRes.finalValue / 100;
    const aps = cooldownRes.finalValue > 0 ? 1000 / cooldownRes.finalValue : 0;

    const avgNormalDmg = (1 + maxAttack) / 2;
    const maxCritDmg = Math.floor(maxAttack * (1 + critMultiplier));
    const avgCritDmg = (maxAttack + maxCritDmg) / 2;

    const dps =
      ((1 - critChance / 100) * avgNormalDmg +
        (critChance / 100) * avgCritDmg) *
      aps;

    return Number(dps.toFixed(2));
  }
}
