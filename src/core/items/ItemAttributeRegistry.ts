export interface StarAttribute {
    id: string;
    type: "critical_chance" | "critical_damage" | "max_damage" | "max_health" | "speed" | "attack" | "defense" | "capacity" | "range" | "cooldown" | "exp_per_hit" | "exp_damage_percent" | "unknown";
    value: number;
    name: string;
    tier: "bronze" | "silver" | "gold";
}

export interface AttributeDefinition {
    id: string;
    name: string;
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
            name: "stats.attack",
            type: "attack",
            tiers: { bronze: 15, silver: 35, gold: 50 },
            isPercentage: true,
        },
        {
            id: "defense_percent",
            name: "stats.defense",
            type: "defense",
            tiers: { bronze: 15, silver: 35, gold: 50 },
            isPercentage: true,
        },
        {
            id: "crit_damage_percent",
            name: "stats.criticalDamage",
            type: "critical_damage",
            tiers: { bronze: 10, silver: 25, gold: 40 },
            isPercentage: true,
        },
        {
            id: "crit_chance",
            name: "stats.critChance",
            type: "critical_chance",
            tiers: { bronze: 2, silver: 5, gold: 10 },
            isPercentage: true,
        },
        {
            id: "max_damage",
            name: "stats.maxDamage",
            type: "max_damage",
            tiers: { bronze: 3, silver: 7, gold: 15 },
            isPercentage: false,
        },
        {
            id: "max_health",
            name: "stats.maxHealth",
            type: "max_health",
            tiers: { bronze: 10, silver: 25, gold: 50 },
            isPercentage: false,
        },
        {
            id: "speed",
            name: "stats.speed",
            type: "speed",
            tiers: { bronze: 5, silver: 10, gold: 20 },
            isPercentage: true,
        },
        {
            id: "capacity",
            name: "stats.capacity",
            type: "capacity",
            tiers: { bronze: 5, silver: 10, gold: 20 },
            isPercentage: true,
        },
        {
            id: "range",
            name: "stats.range",
            type: "range",
            tiers: { bronze: 5, silver: 10, gold: 20 },
            isPercentage: true,
        },
        {
            id: "cooldown",
            name: "stats.cooldown",
            type: "cooldown",
            tiers: { bronze: -5, silver: -10, gold: -20 },
            isPercentage: true,
        },
        {
            id: "exp_per_hit",
            name: "stats.expPerHit",
            type: "exp_per_hit",
            tiers: { bronze: 5, silver: 10, gold: 20 },
            isPercentage: true,
        },
        {
            id: "exp_damage_percent",
            name: "stats.expDamagePercent",
            type: "exp_damage_percent",
            tiers: { bronze: 3, silver: 7, gold: 15 },
            isPercentage: true,
        },
    ];

    static getAttribute(id: string): AttributeDefinition | undefined {
        return this.attributes.find((a) => a.id === id);
    }

    static getAllAttributes(): AttributeDefinition[] {
        return this.attributes;
    }

    static generateUniqueAttributes(numStars: number): StarAttribute[] {
        if (numStars <= 0) return [];
        const attributes: StarAttribute[] = [];
        const allowedTypes = new Set<string>();

        for (let i = 0; i < numStars; i++) {
            let available = this.attributes;
            if (allowedTypes.size > 0) {
                available = available.filter((a) => !allowedTypes.has(a.id));
            }
            if (available.length === 0) break;

            const pick = available[Math.floor(Math.random() * available.length)];
            allowedTypes.add(pick.id);

            const tiers: ("bronze" | "silver" | "gold")[] = ["bronze", "silver", "gold"];
            const tier = tiers[Math.floor(Math.random() * tiers.length)];

            attributes.push({
                id: pick.id,
                type: pick.type,
                name: pick.name,
                value: pick.tiers[tier],
                tier,
            });
        }

        return attributes;
    }
}
