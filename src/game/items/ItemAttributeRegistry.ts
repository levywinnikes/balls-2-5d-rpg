export interface StarAttribute {
    id: string; // e.g. "melee_crit_chance"
    type: "critical_chance" | "critical_damage" | "max_damage" | "max_health" | "speed" | "attack" | "defense" | "capacity" | "range" | "cooldown" | "exp_per_hit" | "exp_damage_percent" | "unknown";
    value: number;
    name: string; // Translation key e.g. "attr_crit_chance"
    tier: "bronze" | "silver" | "gold";
}

export interface AttributeDefinition {
    id: string;
    name: string; // Translation key
    type: "critical_chance" | "critical_damage" | "max_damage" | "max_health" | "speed" | "attack" | "defense" | "capacity" | "range" | "cooldown" | "exp_per_hit" | "exp_damage_percent" | "unknown";
    tiers: {
        bronze: number;
        silver: number;
        gold: number;
    };
    isPercentage: boolean;
}

export class ItemAttributeRegistry {
    
    private static attributes: AttributeDefinition[] = [
        {
            id: "attack_percent",
            name: "stats.attack", // "Ataque"
            type: "attack",
            tiers: {
                bronze: 15, // +15% Global
                silver: 35, // +35% Global
                gold: 50    // +50% Global
            },
            isPercentage: true
        },
        {
            id: "defense_percent",
            name: "stats.defense", // "Defesa"
            type: "defense",
            tiers: {
                bronze: 15, // +15% Global
                silver: 35, // +35% Global
                gold: 50    // +50% Global
            },
            isPercentage: true
        },
        {
            id: "crit_damage_percent",
            name: "stats.criticalDamage", // "Dano Crítico"
            type: "critical_damage",
            tiers: {
                bronze: 15, // +15% Additive
                silver: 30, // +30% Additive
                gold: 50    // +50% Additive
            },
            isPercentage: true
        },
        {
            id: "crit_chance_percent",
            name: "stats.criticalChance", // "Chance Crítica"
            type: "critical_chance",
            tiers: {
                bronze: 1.0, // +1.0%
                silver: 1.5, // +1.5%
                gold: 2.0    // +2.0%
            },
            isPercentage: true
        },
        {
            id: "speed_flat",
            name: "stats.speed", // "Velocidade"
            type: "speed",
            tiers: {
                bronze: 30, // +30
                silver: 55, // +55
                gold: 80    // +80
            },
            isPercentage: false
        },
        {
            id: "max_health_flat",
            name: "stats.maxHealth", // "Vida Máxima"
            type: "max_health",
            tiers: {
                bronze: 10, // +10 (Nerfed from 40)
                silver: 25, // +25 (Nerfed from 70)
                gold: 50    // +50 (Nerfed from 100)
            },
            isPercentage: false
        },
        {
            id: "capacity_flat",
            name: "stats.capacity", // "Capacidade"
            type: "capacity", // Ensure we add this type to the interface if missing
            tiers: {
                bronze: 40, // +40oz
                silver: 70, // +70oz
                gold: 100   // +100oz
            },
            isPercentage: false
        },
        {
            id: "range_bonus",
            name: "stats.range",
            type: "range",
            tiers: {
                bronze: 16, // +16px
                silver: 32, // +32px
                gold: 64    // +64px
            },
            isPercentage: false
        },
        {
            id: "cooldown_bonus",
            name: "stats.cooldown",
            type: "cooldown",
            tiers: {
                bronze: -50,  // -50ms
                silver: -100, // -100ms
                gold: -150    // -150ms
            },
            isPercentage: false
        },
        {
            id: "exp_hit_flat",
            name: "stats.offensiveExp",
            type: "exp_per_hit",
            tiers: {
                bronze: 5,  // +5 XP
                silver: 15, // +15 XP
                gold: 30    // +30 XP
            },
            isPercentage: false
        },
        {
            id: "exp_damage_percent",
            name: "stats.expDamagePercent",
            type: "exp_damage_percent",
            tiers: {
                bronze: 5,  // 5%
                silver: 15, // 15%
                gold: 30    // 30%
            },
            isPercentage: true
        }
    ];

    public static getAttributeDefinition(id: string): AttributeDefinition | undefined {
        return this.attributes.find(a => a.id === id);
    }

    public static getAttributeValue(id: string, tier: "bronze" | "silver" | "gold"): number {
        const def = this.getAttributeDefinition(id);
        if (!def) return 0;
        return def.tiers[tier];
    }
    
    public static getAttributeName(id: string): string {
         const def = this.getAttributeDefinition(id);
         return def ? def.name : id;
    }

    /**
     * Generates a single attribute (Legacy support).
     * Warning: Does not guarantee uniqueness if called multiple times.
     */
    public static generateAttribute(attributeId: string): StarAttribute | null {
        const def = this.getAttributeDefinition(attributeId);
        if (!def) return null;
        return this.rollTier(def);
    }

    /**
     * Generates N unique attributes from the available pool.
     */
    public static generateUniqueAttributes(count: number): StarAttribute[] {
        if (count <= 0) return [];
        
        // 1. Create Pool
        const pool = [...this.attributes];
        const result: StarAttribute[] = [];

        // 2. Loop
        for (let i = 0; i < count; i++) {
            if (pool.length === 0) break; // No more unique attributes

            // Pick Random
            const idx = Math.floor(Math.random() * pool.length);
            const def = pool[idx];
            
            // Remove from Pool (Unique Rule)
            pool.splice(idx, 1);

            // Roll Tier & Add
            result.push(this.rollTier(def));
        }

        return result;
    }

    private static rollTier(def: AttributeDefinition): StarAttribute {
        const roll = Math.random();
        let tier: "bronze" | "silver" | "gold" = "bronze";

        if (roll > 0.90) { // 10% Gold
            tier = "gold";
        } else if (roll > 0.60) { // 30% Silver
            tier = "silver";
        } else { // 60% Bronze
            tier = "bronze";
        }

        return {
            id: def.id,
            type: def.type,
            tier: tier,
            value: def.tiers[tier],
            name: def.name
        };
    }
}
