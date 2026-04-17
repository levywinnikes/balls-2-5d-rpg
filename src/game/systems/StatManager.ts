import { PlayerState } from "../entities/Player/PlayerState";
import {
  WeaponRegistry,
  WeaponDefinition,
} from "../entities/weapons/WeaponRegistry";
import { EquipmentSlot, ItemType } from "../../config/ItemConstants";

import { t_game } from "../i18n/translations";

export interface StatModifier {
  source: string; // e.g. "Iron Helmet", "Star Bonus", "Potion of Strength"
  attr: string; // e.g. "strength", "dexterity", "attack", "defense"
  type: "FLAT" | "PERCENT";
  value: number;
  category: "base" | "equipment" | "buff" | "consumable" | "passive" | "skill";
  color?: string; // Specific color hex e.g. "#a855f7"
  cssClass?: string; // Tailwind classes
  quality?: "bronze" | "silver" | "gold" | "diamond"; // ADDED for premium visuals
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

  /**
   * The Single Source of Truth for any attribute calculation.
   * Use this for: Strength, Dexterity, Intelligence, Reflex, Speed, etc.
   */
  public calculateStat(
    statName: string,
    state: PlayerState,
    overrides?: Map<EquipmentSlot, any>,
  ): StatResult {
    const modifiers: StatModifier[] = this.gatherModifiers(
      statName,
      state,
      overrides,
    );

    // 1. Base Value
    let baseValue = 0;
    const baseMod = modifiers.find((m) => m.category === "base");
    if (baseMod) {
      baseValue = baseMod.value;
    }

    // 2. Additive Flats (Sum of all Flat Bonuses)
    // Example: +50 Damage from Weapon, +5 Strength from Chest
    // We add these BEFORE Percentages to ensure they get scaled.
    const flatModifiers = modifiers.filter(
      (m) => m.type === "FLAT" && m.category !== "base",
    );
    const totalFlat = flatModifiers.reduce((acc, m) => acc + m.value, 0);

    const subtotalFlat = baseValue + totalFlat;

    // 3. Additive Percentages (Sum of all %)
    // Example: +10% from Ring, +5% from Passive = +15% Total
    const percentModifiers = modifiers.filter((m) => m.type === "PERCENT");
    const totalPercent = percentModifiers.reduce((acc, m) => acc + m.value, 0); // e.g. 15

    // Apply % to (Base + Flat)
    // Result = (Base + Flat) * (1 + 0.15)
    let afterPercent = subtotalFlat * (1 + totalPercent / 100);

    // SPECIAL CASE: Critical Chance & Damage are "Additive Percentages"
    // If we have +5% Crit Chance (PERCENT), we want to ADD 5, not multiply by 1.05.
    // Base is 0. So we just sum everything.
    if (statName === "criticalChance" || statName === "criticalDamage") {
      afterPercent = subtotalFlat + totalPercent;
    }

    // No step 4 (Post-Add Flats) unless needed. Assuming all flats scale.
    let afterFlat = afterPercent;

    // 4. Global Multipliers (The "VIP" Section)
    let globalMult = 1.0;
    const globalMultipliers: StatModifier[] = [];

    // Willpower Logic: Tier 10 Spike
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
        const wpVal = 1 + wpPercent / 100; // e.g. 1.15
        globalMult *= wpVal;

        globalMultipliers.push({
          source: `Willpower (Tier ${state.getWillpowerTier()})`,
          attr: statName,
          type: "PERCENT",
          value: wpVal, // Store as Multiplier (1.15) for UI
          category: "passive",
          color: "#a855f7",
        });
      }
    }

    let finalValue = afterFlat * globalMult;

    // Critical Chance and Damage should KEEP decimals for precision
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
    const slots: EquipmentSlot[] = [
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

  /**
   * Calculates Star Points — a mysterious aggregate stat.
   * Level = +1 point per level.
   * Each star attribute on equipped items: bronze=1, silver=3, gold=5.
   * Willpower multiplier is applied to the total.
   */
  public calculateStarPoints(state: PlayerState): {
    totalPoints: number;
    levelPoints: number;
    equipmentPoints: number;
    willpowerBonus: number;
    willpowerTier: number;
    willpowerPercent: number;
    equipmentBreakdown: {
      itemName: string;
      slot: EquipmentSlot;
      stars: { tier: string; points: number }[];
      totalItemPoints: number;
    }[];
  } {
    const levelPoints = state.getLevel();

    const slots: EquipmentSlot[] = [
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
      slot: EquipmentSlot;
      stars: { tier: string; points: number }[];
      totalItemPoints: number;
    }[] = [];

    let equipmentPoints = 0;

    slots.forEach((slot) => {
      const item = state.getEquippedItemInSlot(slot);
      if (item && item.attributes && item.attributes.length > 0) {
        const def = WeaponRegistry.getWeaponDefinition(item.itemId);
        const name = def ? t_game(def.name as any) : item.itemId;

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

    // Apply Willpower multiplier
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

  /**
   * Aggregates all sources of modifiers for a given stat.
   */
  private gatherModifiers(
    statName: string,
    state: PlayerState,
    overrides?: Map<EquipmentSlot, any>,
  ): StatModifier[] {
    const modifiers: StatModifier[] = [];

    // A. Base Stats (Level/Skill based)
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
        break; // Base 0% (1.0x Multiplier)
      case "speed":
        baseVal = 200;
        break; // Base Speed

      case "range":
        baseVal = 0;
        break; // Weapon Dependent
      case "cooldown":
        baseVal = 0;
        break; // Weapon is added as modifier in gatherModifiers
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
        break; // New Stat

      case "attack":
        baseVal = 0;
        break; // Strict: Weapon is Modifier
      case "defense":
        baseVal = 0;
        break; // Strict: Shield is Modifier
      case "armor":
        baseVal = 0;
        break; // Strict: Equipment is Modifier

      case "memory":
        baseVal = state.baseMemory;
        break;
      case "capacity":
        baseVal = 400;
        break;
    }

    // Default Base Modifier
    if (baseVal > 0 || statName === "criticalDamage" || statName === "speed") {
      modifiers.push({
        source: "Base Character",
        attr: statName,
        type: "FLAT",
        value: baseVal,
        category: "base",
      });
    }

    // C. Active Buffs
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

    // C. Skill/Level Modifiers for Derived Stats
    if (statName === "attack") {
      // Level Bonus: (Level - 1)%
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

      // Skill Bonus (Strength/Dex/Int)
      // Determine type based on weapon
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
        // Assuming fire element implies magic for now logic matches PlayerState
        skillVal = state.getIntelligenceLevel();
        sourceName = "Intelligence";
      }

      // 5% per skill level
      modifiers.push({
        source: `${sourceName} Bonus`,
        attr: "attack",
        type: "PERCENT",
        value: skillVal * 5,
        category: "skill",
      });
    } else if (statName === "defense") {
      // Level Bonus: 1% per level
      const lvl = state.getLevel();
      modifiers.push({
        source: "Level Bonus",
        attr: "defense",
        type: "PERCENT",
        value: lvl * 1,
        category: "skill",
      });

      // Reflex Bonus: 5% per level
      const reflex = state.getReflexLevel();
      modifiers.push({
        source: "Reflex Bonus",
        attr: "defense",
        type: "PERCENT",
        value: reflex * 5,
        category: "skill",
      });
    } else if (statName === "speed") {
      // Level Bonus: (Level - 1) * 4 FLAT
      const lvl = state.getLevel();
      if (lvl > 1) {
        modifiers.push({
          source: "Level Bonus",
          attr: "speed",
          type: "FLAT", // Tibia speed is usually Flat added per level
          value: (lvl - 1) * 4,
          category: "skill",
        });
      }
    } else if (statName === "memory") {
      // Level Bonus: 1 per level
      const lvl = state.getLevel();
      modifiers.push({
        source: "Level Bonus",
        attr: "memory",
        type: "FLAT",
        value: lvl * 1,
        category: "skill",
      });

      // Intelligence Bonus: 5 per level
      const int = state.getIntelligenceLevel();
      modifiers.push({
        source: "Intelligence Bonus",
        attr: "memory",
        type: "FLAT",
        value: int * 5,
        category: "skill",
      });
    } else if (statName === "maxHealth") {
      // Level Bonus: 5 per level (Standard Tibia-like scaling)
      const lvl = state.getLevel();
      if (lvl > 1) {
        modifiers.push({
          source: "Level Bonus",
          attr: "maxHealth",
          type: "FLAT",
          value: (lvl - 1) * 5, // e.g. Level 2 = +5 HP
          category: "skill",
        });
      }
    } else if (statName === "capacity") {
      // Level Bonus: 10 per level
      const lvl = state.getLevel();
      modifiers.push({
        source: "Level Bonus",
        attr: "capacity",
        type: "FLAT",
        value: lvl * 10,
        category: "skill",
      });
    } else if (statName === "criticalChance") {
      // Dexterity Bonus: 0.2% per point
      // This ensures it appears in Truth Table
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
      // Strength Bonus: 1% per point (User Req)
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

    // B. Equipment Modifiers (Main + Stars)
    // Using direct slot access to ensure we get dynamic attributes from InventoryItems
    // (Since getEquippedWeapon() returns pure Definition, losing dynamic stats)
    const slots: EquipmentSlot[] = [
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
        const translatedName = t_game(name as any);

        // --- IMPLICIT STAR BONUSES REMOVED (Strict Mode) ---
        // Only explicit attributes are counted now

        // Dynamic Attributes (Explicit Attributes)
        if (equippedItem.attributes) {
          equippedItem.attributes.forEach((attr: any) => {
            // Direct consumption of StarAttribute
            // Interface: { type, value, tier, id }
            // const tierKey = `tier.${attr.tier}`; // Removed unused variable
            // If we have a valid tier, use it for quality.
            // Display source: "ItemName" only (we'll add the star in UI based on quality)
            const sourceName = translatedName;

            switch (attr.type) {
              case "critical_chance":
                if (statName === "criticalChance") {
                  modifiers.push({
                    source: sourceName,
                    attr: "criticalChance",
                    type: "FLAT", // Additive % points (e.g. Base 0 + 1 = 1%)
                    value: attr.value,
                    category: "equipment",
                    quality: attr.tier, // Populate quality
                  });
                }
                break;
              case "critical_damage":
                if (statName === "criticalDamage") {
                  modifiers.push({
                    source: sourceName,
                    attr: "criticalDamage",
                    type: "FLAT", // Additive % points (e.g. Base 0 + 15 = 15%)
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
                    type: "PERCENT", // Global Multiplier (summed with others)
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
                    type: "PERCENT", // Global Multiplier
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

              // NEW ATTRIBUTES
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
                    value: attr.value, // Negative value (-50 etc)
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
                    type: "FLAT", // Additive Percent (5 + 15 = 20%)
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

        // Static Definition Stats
        if (def) {
          // Boots Speed
          if (
            statName === "speed" &&
            def.type === ItemType.BOOTS &&
            def.speedBonus
          ) {
            modifiers.push({
              source: translatedName,
              attr: "speed",
              type: "FLAT",
              value: def.speedBonus,
              category: "equipment",
            });
          }

          // Defense (Shields/Weapons) -> "defense"
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
                source: translatedName,
                attr: "defense",
                type: "FLAT",
                value: def.defense,
                category: "equipment",
              });
            }
          }

          // Armor (Body Equipment) -> "armor"
          // Armor (Body Equipment) -> "armor"
          if (statName === "armor") {
            // Strict Body Armor
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
                  source: translatedName,
                  attr: "armor",
                  type: "FLAT",
                  value: def.armor,
                  category: "equipment",
                });
              }
              // Fallback: If 'defense' is used as armor value in JSON for body items
              else if (def.defense) {
                modifiers.push({
                  source: translatedName,
                  attr: "armor",
                  type: "FLAT",
                  value: def.defense,
                  category: "equipment",
                });
              }
            }
          }

          // Weapon Attack (Generic "attack")
          // Since Base is now 0, we treat Weapon Damage as a FLAT Modifier
          if (statName === "attack" && def.damage) {
            modifiers.push({
              source: translatedName,
              attr: "attack",
              type: "FLAT",
              value: def.damage,
              category: "equipment",
            });
          }

          // Range
          if (statName === "range" && def.range) {
            modifiers.push({
              source: translatedName,
              attr: "range",
              type: "FLAT",
              value: def.range,
              category: "equipment",
            });
          }

          // Cooldown
          if (statName === "cooldown" && def.cooldown) {
            modifiers.push({
              source: translatedName,
              attr: "cooldown",
              type: "FLAT",
              value: def.cooldown,
              category: "equipment",
            });
          }

          // Light Radius
          if (statName === "lightRadius" && def.lightRadius) {
            modifiers.push({
              source: translatedName,
              attr: "lightRadius",
              type: "FLAT",
              value: def.lightRadius,
              category: "equipment",
            });
          }

          // Exp Per Hit
          if (statName === "expPerHit" && def.exp_skill) {
            modifiers.push({
              source: translatedName,
              attr: "expPerHit",
              type: "FLAT",
              value: def.exp_skill,
              category: "equipment",
            });
          }

          // Resistances
          if (def.resistances) {
            if (statName === "fireResist" && def.resistances.fire)
              modifiers.push({
                source: translatedName,
                attr: "fireResist",
                type: "FLAT",
                value: def.resistances.fire * 100,
                category: "equipment",
              });
            if (statName === "iceResist" && def.resistances.ice)
              modifiers.push({
                source: translatedName,
                attr: "iceResist",
                type: "FLAT",
                value: def.resistances.ice * 100,
                category: "equipment",
              });
            if (statName === "poisonResist" && def.resistances.poison)
              modifiers.push({
                source: translatedName,
                attr: "poisonResist",
                type: "FLAT",
                value: def.resistances.poison * 100,
                category: "equipment",
              });
            if (statName === "energyResist" && def.resistances.energy)
              modifiers.push({
                source: translatedName,
                attr: "energyResist",
                type: "FLAT",
                value: def.resistances.energy * 100,
                category: "equipment",
              });
            if (statName === "physicalResist" && def.resistances.physical)
              modifiers.push({
                source: translatedName,
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

  // --- Specific Calculation Wrappers ---

  public getCriticalChance(state: PlayerState): StatResult {
    // Wrapper ensures Tooltips match Truth Table
    return this.calculateStat("criticalChance", state);
  }

  /**
   * Calculates the breakdown for a specific item (hypothetical),
   * used by Tooltips to ensure they match the Single Source of Truth.
   */
  public calculateWeaponAttack(
    def: WeaponDefinition,
    attributes: any[] = [],
    state: PlayerState,
    overrideLevel?: number,
    overrideSkill?: number,
  ) {
    // 1. Base Damage
    let base = def.damage || 0;

    // 2. Skill Bonus
    const level =
      overrideLevel !== undefined ? overrideLevel : state.getLevel();
    const str = state.getStrengthLevel();
    const dex = state.getDexterityLevel(); // These might need overrides too?
    const int = state.getIntelligenceLevel(); // Usually skill is the main stat.

    // Level Bonus: (Level - 1)%
    const valFromLevel = base * (Math.max(0, level - 1) / 100);

    // Skill Bonus
    let skillVal = 0;
    if (overrideSkill !== undefined) {
      skillVal = overrideSkill;
    } else {
      if (def.type === "ranged") skillVal = dex;
      else if (def.element === "fire") skillVal = int;
      else skillVal = str; // Default Melee
    }

    // 5% per Skill Level
    const valFromSkill = base * (skillVal * 0.05);

    // 3. Attribute Bonuses (Star/Elite)
    let valFromAttributes = 0;
    let attrTotalPct = 0;

    if (attributes) {
      attributes.forEach((attr: any) => {
        // Direct consumption of StarAttribute
        // Interface: { type, value, tier, id }

        // Map Attributes to Attack
        // Example: max_damage is PERCENT
        if (attr.type === "max_damage" || attr.type === "attack") {
          // We just sum percentage here
          // 'attack' attributes on weapons are treated as Global Attack % by StatManager,
          // so we must include them here to match the Total Attack calculation.
          attrTotalPct += attr.value;
        }
      });
    }

    valFromAttributes = base * (attrTotalPct / 100);

    // Subtotal
    const subtotal = base + valFromLevel + valFromSkill + valFromAttributes;

    // 4. Willpower
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

  // Placeholder Correct Implementation
  public getWillpowerBonusPercent(state: PlayerState): number {
    const tier = state.getWillpowerTier();
    if (tier >= 10) return 15;
    return tier * 1;
  }

  /**
   * DYNAMIC STATS API
   * Returns a list of all stats that have a non-zero value (or are critical).
   * Used for the HeroMenu Stats Tab to avoid hardcoded lists.
   */
  public getAllNonZeroStats(
    state: PlayerState,
  ): { id: string; result: StatResult }[] {
    // List of all possible stats we care about
    // Expand this list as needed.
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
      "reflex", // Base stats
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
      // Include if final value > 0 OR if it has any modifiers (e.g. 0 base but +10 equip)
      // For crit chance/dmg, always include if > 0 (which is always true for crit dmg base 0 but might have items)

      // Special case logic:
      if (res.finalValue > 0 || res.breakdown.sources.length > 0) {
        results.push({ id: stat, result: res });
      }
    }

    // Sort? Maybe predefined order is better?
    // Let's rely on the input array order for now.
    return results;
  }

  /**
   * Get Offensive XP Bonus (from Weapons, Gloves, Offensive Rings)
   */
  public getOffensiveExpBonus(state: PlayerState): StatResult {
    const modifiers: StatModifier[] = [];
    modifiers.push({
      source: "Base Character",
      attr: "offensiveExp",
      type: "FLAT",
      value: 0,
      category: "base",
    });

    // Only consider weapons and offensive accessories
    const offensiveSlots: EquipmentSlot[] = [
      EquipmentSlot.MAIN_HAND,
      EquipmentSlot.RING,
      EquipmentSlot.NECK,
    ];

    offensiveSlots.forEach((slot) => {
      const item = state.getEquippedItemInSlot(slot);
      if (item) {
        const def = WeaponRegistry.getWeaponDefinition(item.itemId);
        if (def) {
          const name = t_game(def.name as any);
          const isWeapon = def.type === "melee" || def.type === "ranged";

          // Implicit Star Bonus Removed (Strict Mode)

          // Base exp_skill from weapons
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

  /**
   * Get Defensive XP Bonus (from Shields, Armor, Boots)
   */
  public getDefensiveExpBonus(state: PlayerState): StatResult {
    const modifiers: StatModifier[] = [];
    modifiers.push({
      source: "Base Character",
      attr: "defensiveExp",
      type: "FLAT",
      value: 0,
      category: "base",
    });

    // Only consider shields, armor, and boots
    const defensiveSlots: EquipmentSlot[] = [
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
          const name = t_game(def.name as any);
          const isArmorOrShield = [
            ItemType.BODY_ARMOR,
            ItemType.LEGS,
            ItemType.HELMET,
            ItemType.BOOTS,
            ItemType.SHIELD,
          ].includes(def.type);

          // Star bonuses for armor/shields
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

          // Base exp_skill from shields/armor
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
    const critChance = critChanceRes.finalValue; // e.g. 15.0
    const critMultiplier = critDmgRes.finalValue / 100; // e.g. 0.5 for +50%

    const aps = cooldownRes.finalValue > 0 ? 1000 / cooldownRes.finalValue : 0;

    // Formula components
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

  /**
   * Calculates the hypothetical DPS if a specific item was equipped.
   */
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

    // Create override map
    const overrides = new Map<EquipmentSlot, any>();
    overrides.set(EquipmentSlot.MAIN_HAND, item);

    // Calculate components hypothetically
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
