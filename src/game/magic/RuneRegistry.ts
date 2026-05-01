export interface RuneDefinition {
  id: string;
  name: string;
  description: string;
  memoryCost: number; // Cost per charge
  graphic: {
    texture: string;
    frame?: string | number;
  };
  damage: {
    element: "fire" | "ice" | "energy" | "physical" | "star";
    baseMin: number;
    baseMax: number;
    area: number; // Radius in pixels (0 = single target)
  };
  enchantSound?: string; // Audio key for enchantment (e.g., "fire", "ice", "energy", "star")
  singleTargetOnly?: boolean; // If true, only fires on enemy click, not ground
  /** Visual descriptor used by the 3D runtime projectile effect */
  effect3d?: {
    color: string; // CSS hex color for emissive material
    radius: number; // Impact flash radius in world units
    speed: number; // Projectile speed in world units/sec
  };
}

export class RuneRegistry {
  private static runes: Record<string, RuneDefinition> = {
    fire_burst_rune: {
      id: "fire_burst_rune",
      name: "Fire Burst Rune",
      description: "Explodes in a fiery burst.",
      memoryCost: 2, // 2 Memory units per charge
      graphic: {
        texture: "fire_burst_anim",
        frame: 0,
      },
      damage: {
        element: "fire",
        baseMin: 30,
        baseMax: 50,
        area: 120, // 3-4 tiles radius
      },
      enchantSound: "fire",
      effect3d: { color: "#ff5500", radius: 1.5, speed: 14 },
    },
    star_rune: {
      id: "star_rune",
      name: "item_star_rune",
      description: "desc_star_rune",
      memoryCost: 3,
      graphic: {
        texture: "items",
        frame: 0,
      },
      damage: {
        element: "star",
        baseMin: 200,
        baseMax: 200,
        area: 0, // Single target
      },
      enchantSound: "star",
      singleTargetOnly: true,
      effect3d: { color: "#ffffaa", radius: 0.8, speed: 18 },
    },
  };

  public static getRune(id: string): RuneDefinition | undefined {
    return this.runes[id];
  }

  public static getAllRunes(): RuneDefinition[] {
    return Object.values(this.runes);
  }

  /**
   * Calculates scaled damage based on level and intelligence.
   * Formula: Base * (1 + (Level * 0.01) + (Int * 0.05))
   */
  public static calculateDamage(
    runeId: string,
    playerLevel: number,
    playerInt: number,
  ): { min: number; max: number } {
    const rune = this.runes[runeId];
    if (!rune) return { min: 0, max: 0 };

    const multiplier = 1 + playerLevel * 0.01 + playerInt * 0.05;

    return {
      min: Math.floor(rune.damage.baseMin * multiplier),
      max: Math.floor(rune.damage.baseMax * multiplier),
    };
  }

  /**
   * Star Rune damage formula:
   * baseDamage * (1 + starPoints * 0.10) * random(0.80, 1.20)
   */
  public static calculateStarRuneDamage(starPoints: number): number {
    const baseDamage = 200;
    const scaled = baseDamage * (1 + starPoints * 0.1);
    const variance = 0.8 + Math.random() * 0.4; // 0.80 to 1.20
    return Math.round(scaled * variance);
  }
}
