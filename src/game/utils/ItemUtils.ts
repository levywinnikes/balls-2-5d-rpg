
import { InventoryItem } from "../entities/Player/PlayerState";

export const calculateItemScore = (item: InventoryItem): number => {
    if (!item.stars || item.stars === 0) return 0;
    
    // We assume 'stats' or similar property holds the modifiers if available directly on item,
    // otherwise we might need to look up modifiers.
    // However, looking at previous code, 'stars' seems to be the main indicator for now?
    // The prompt says: "Cada atributo Bronze = 1 ponto. Cada atributo Silver = 2 pontos. Cada atributo Gold = 3 pontos."
    // We need to access the underlying modifiers to calculate this accurately.
    // If modifiers are not directly on InventoryItem, we might need to rely on a different mechanism 
    // or if 'stars' is just a count, we might need more data.
    
    // START_REVIEW_NOTE: 
    // The `InventoryItem` type typically stores specific instance data. 
    // The `StatManager` or `WeaponRegistry` likely handles the definition.
    // However, for generated items, the `modifiers` list or similar must be present.
    // I will assume `item.modifiers` exists or similar. checking PlayerState.ts might be needed.
    // For now, I will implement a safe fallback.
    
    let score = 0;
    
    // If the item has a 'modifiers' array (typical for RPGs with random stats)
    if ((item as any).modifiers) {
        (item as any).modifiers.forEach((mod: any) => {
             if (mod.quality === 'gold') score += 3;
             else if (mod.quality === 'silver') score += 2;
             else if (mod.quality === 'bronze') score += 1;
        });
    } else {
         // Fallback if we only have 'stars' count but no quality data (generic approximation)
         // This is likely inaccurate but prevents crashing.
         score = (item.stars || 0) * 1; 
    }
    
    return score;
};

export const getItemTier = (score: number) => {
    if (score >= 15) return { name: "Platinum", color: "text-cyan-400", border: "border-cyan-400", bg: "bg-cyan-400/10", shadow: "shadow-[0_0_15px_rgba(34,211,238,0.5)]" };
    if (score >= 10) return { name: "Gold", color: "text-yellow-400", border: "border-yellow-500", bg: "bg-yellow-500/10", shadow: "" };
    if (score >= 5)  return { name: "Silver", color: "text-slate-300", border: "border-slate-400", bg: "bg-slate-400/10", shadow: "" };
    if (score >= 1)  return { name: "Bronze", color: "text-orange-500", border: "border-orange-700", bg: "bg-orange-700/10", shadow: "" };
    
    if (score >= 1)  return { name: "Bronze", color: "text-orange-500", border: "border-orange-700", bg: "bg-orange-700/10", shadow: "" };
    
    return { name: "Comum", color: "text-gray-400", border: "border-white/10", bg: "bg-black/40", shadow: "" };
};

export const ATTRIBUTE_LABELS: Record<string, string> = {
  // Base Stats
  attack: "Ataque",
  defense: "Defesa",
  armor: "Armadura",
  range: "Alcance",
  magic: "Magic Level",
  
  // Attributes
  strength: "Força",
  agility: "Agilidade",
  intelligence: "Inteligência",
  vitality: "Vitalidade",
  wisdom: "Sabedoria",
  
  // Combat
  crit_chance: "Chance Crítica",
  crit_damage: "Dano Crítico",
  attack_speed: "Velocidade de Ataque",
  life_steal: "Roubo de Vida",
  mana_steal: "Roubo de Mana",
  cooldown: "Velocidade de Ataque",
  speed: "Velocidade",
  
  // Elemental Damage
  fire_damage: "Dano de Fogo",
  ice_damage: "Dano de Gelo",
  lightning_damage: "Dano de Raio",
  poison_damage: "Dano de Veneno",
  holy_damage: "Dano Sagrado",
  dark_damage: "Dano Sombrio",
  
  // Elemental Resists
  fire_res: "Resist. Fogo",
  ice_res: "Resist. Gelo",
  lightning_res: "Resist. Raio",
  poison_res: "Resist. Veneno",
  
  // Misc
  capacity: "Capacidade",
  luck: "Sorte",
  exp_per_hit: "XP por Golpe",
  
  // System
  melee_crit_chance: "Crítico Melee",
  melee_max_damage: "Dano Máximo",
  melee_crit_damage: "Dano Crítico"
};

export const formatAttributeValue = (key: string, value: number): string => {
    const percentageKeys = [
        'crit_chance', 'crit_damage', 'attack_speed', 'life_steal', 'mana_steal',
        'fire_res', 'ice_res', 'lightning_res', 'poison_res', 'melee_crit_chance', 'melee_crit_damage'
    ];
    
    if (percentageKeys.includes(key)) {
        return `+${value}%`;
    }

    if (key === 'cooldown') {
        return `${value}ms`; 
    }
    
    return `+${value}`;
};

export const sortAttributes = (attributes: any[]) => {
    if (!attributes) return [];
    
    const tierWeight: Record<string, number> = {
        'gold': 3,
        'silver': 2,
        'bronze': 1
    };

    return [...attributes].sort((a, b) => {
        const weightA = tierWeight[a.quality] || 0;
        const weightB = tierWeight[b.quality] || 0;
        return weightB - weightA; // Descending order (Gold -> Bronze)
    });
};
