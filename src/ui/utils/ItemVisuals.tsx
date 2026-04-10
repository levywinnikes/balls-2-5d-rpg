import React from "react";
import { Star } from "lucide-react";

// --- COLORS & STYLES ---

export const TIER_COLORS = {
    bronze: "text-orange-600",
    silver: "text-slate-300",
    gold: "text-yellow-400",
    platinum: "text-cyan-400",
    common: "text-gray-400"
};

export const TIER_BORDERS = {
    bronze: "border-orange-700",
    silver: "border-slate-400",
    gold: "border-yellow-500",
    platinum: "border-cyan-400",
    common: "border-white/10"
};

export const TIER_BG = {
    bronze: "bg-orange-700/10",
    silver: "bg-slate-400/10",
    gold: "bg-yellow-500/10",
    platinum: "bg-cyan-400/10",
    common: "bg-black/40"
};

export const getTierColor = (quality?: string): string => {
    // Normalize input
    const key = (quality || "common").toLowerCase().trim();
    
    if (key.includes("platinum") || key === "mythic") return TIER_COLORS.platinum;
    if (key.includes("gold") || key === "legendary") return TIER_COLORS.gold;
    if (key.includes("silver") || key === "epic") return TIER_COLORS.silver;
    if (key.includes("bronze") || key === "rare") return TIER_COLORS.bronze;
    
    return TIER_COLORS.common;
};

export const getItemBorder = (score: number): string => {
    if (score >= 15) return TIER_BORDERS.platinum;
    if (score >= 10) return TIER_BORDERS.gold;
    if (score >= 5)  return TIER_BORDERS.silver;
    if (score >= 1)  return TIER_BORDERS.bronze;
    return TIER_BORDERS.common;
};

// --- ICONS & COMPONENTS ---

export const StarIcon: React.FC<{ quality?: string; size?: number; className?: string }> = ({ quality, size = 10, className }) => {
    const colorClass = getTierColor(quality);
    // Fill current ensures the inside is colored too, or we can use fill={color} if we mapped hex
    // But text-color works for stroke. For fill we might need `fill-current`.
    return <Star size={size} className={`${colorClass} fill-current ${className || ''}`} />;
};

/**
 * @deprecated Use <StarIcon /> instead
 */
/**
 * @deprecated Use <StarIcon /> instead
 */
export const getStarIcon = (quality: string, size: number = 10) => {
    return <StarIcon quality={quality} size={size} />;
};

/**
 * Parses an item to determine the list of stars to render.
 * Respects item attributes for mixed qualities (e.g. 1 Gold, 2 Silver).
 * Falls back to item.stars count if no attributes are present.
 */
export const getItemStars = (item: any): string[] => {
    if (!item) return [];

    // 1. Try to build stars from Attributes (Gold/Silver/Bronze)
    if (item.attributes && item.attributes.length > 0) {
        const starAttributes = item.attributes.filter((a: any) => a.quality || a.tier || a.stars);
        
        if (starAttributes.length > 0) {
            const tierWeight: Record<string, number> = { 'platinum': 4, 'gold': 3, 'silver': 2, 'bronze': 1, 'common': 0 };
            
            return starAttributes
                .map((a: any) => (a.quality || a.tier || "common").toLowerCase())
                .sort((a: string, b: string) => (tierWeight[b] || 0) - (tierWeight[a] || 0));
        }
    }

    // 2. Fallback to simple star count (Default to Gold if >= 3, else Silver? Or just Gold?)
    // User complaint: "why 5 stars gold when it should be mixed?".
    // If we only have a number, we can't know the mix. 
    // BUT if the user sees mixed stars, they must have attributes.
    // So for legacy/simple items, we return N stars.
    if (item.stars && item.stars > 0) {
        return Array(item.stars).fill(item.stars >= 5 ? "gold" : "silver"); // Simple heuristic or default
    }

    return [];
};

// --- TRANSLATIONS ---

export const ITEM_TYPE_LABELS: Record<string, string> = {
    sword: "Espada",
    axe: "Machado",
    club: "Clava",
    wand: "Varinha",
    rod: "Cetro",
    distance: "Distância",
    ammo: "Munição",
    shield: "Escudo",
    helmet: "Capacete",
    body_armor: "Armadura",
    legs: "Calças",
    boots: "Botas",
    amulet: "Amuleto",
    ring: "Anel",
    food: "Comida",
    container: "Bolsa",
    resource: "Recurso",
    rune: "Runa",
    
    // Fallback keys if raw enum keys are passed
    "ITEM.TYPE.SWORD": "Espada",
    "ITEM.TYPE.AXE": "Machado",
    "ITEM.TYPE.SHIELD": "Escudo",
    "ITEM.TYPE.ARMOR": "Armadura",
    "ITEM.TYPE.LEGS": "Calças",
    "ITEM.TYPE.BOOTS": "Botas",
    "ITEM.TYPE.HELMET": "Capacete",
    "ITEM.TYPE.RING": "Anel",
    "ITEM.TYPE.AMULET": "Amuleto"
};

export const ATTRIBUTE_LABELS: Record<string, string> = {
    // Base Stats
    attack: "Ataque",
    defense: "Defesa",
    armor: "Armadura",
    range: "Alcance",
    magic: "Magic Level",
    max_health: "Vida Máxima",
    max_mana: "Mana Máxima",
    capacity: "Capacidade (Peso)",

    // Attributes
    strength: "Força",
    agility: "Agilidade",
    intelligence: "Inteligência",
    vitality: "Vitalidade",
    wisdom: "Sabedoria",

    // Combat
    crit_chance: "Chance Crítica",
    critical_chance: "Chance Crítica",
    crit_damage: "Dano Crítico",
    critical_damage: "Dano Crítico",
    attack_speed: "Velocidade de Ataque",
    speed: "Velocidade de Movimento",
    velocity: "Velocidade de Movimento",
    life_steal: "Roubo de Vida",
    mana_steal: "Roubo de Mana",
    cooldown: "Velocidade de Ataque",
    magic_damage: "Dano Mágico",
    physical_damage: "Dano Físico",
    
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
    luck: "Sorte",
    exp_per_hit: "XP por Golpe",
    health_regen: "Regeneração de Vida",
    mana_regen: "Regeneração de Mana",
    life_regen: "Regeneração de Vida", // Alias

    // New Discovered Attributes
    thorns: "Espinhos",
    gold_find: "Ouro Extra",
    magic_find: "Sorte (Drop)",
    exp_bonus: "Bônus de XP",
    resource_cost_reduction: "Redução de Custo",
    cooldown_reduction: "Redução de Cooldown",
    
    // Advanced Combat
    area_damage: "Dano em Área",
    elite_damage: "Dano em Elites",
    exp_damage_percent: "Dano Baseado em XP (%)",
    elemental_mastery: "Maestria Elemental",
    resistance_penetration: "Penetração de Resist.",
    
    // System
    melee_crit_chance: "Crítico Melee",
    melee_max_damage: "Dano Máximo",
    melee_crit_damage: "Crítico Dano"
};

export const translateItemType = (type: string): string => {
    return ITEM_TYPE_LABELS[type] || ITEM_TYPE_LABELS[`ITEM.TYPE.${type.toUpperCase()}`] || type.replace(/_/g, " ");
};

export const translateAttribute = (key: string): string => {
    if (!key) return "";
    return ATTRIBUTE_LABELS[key] || ATTRIBUTE_LABELS[key.toLowerCase()] || key.replace(/_/g, ' ').toUpperCase();
};

export const formatAttributeValue = (key: string, value: number): string => {
    const k = key.toLowerCase();
    
    // Explicit percentage keys or known percentage attributes
    if (
        k.includes("percent") || 
        k.includes("chance") || 
        k.includes("rate") || 
        k.includes("steal") || 
        k.includes("reduction") || 
        k.includes("bonus") || 
        k.includes("crit") || 
        k.includes("critical") || 
        k.includes("efficiency") || 
        k.includes("mastery") ||
        k.includes("penetration") || // resistance_penetration
        k.includes("find") || // gold_find, magic_find
        k === "attack" || 
        k === "defense" || 
        k === "armor" ||
        k === "damage" ||
        k === "area_damage" ||
        k === "elite_damage"
    ) {
        return `${value > 0 ? '+' : ''}${value}%`;
    }

    if (k.includes("cooldown") && !k.includes("reduction")) { // reduction handled above
        return `${value}ms`;
    }
    
    return `${value > 0 && !k.includes("range") && !k.includes("capacity") ? '+' : ''}${value}`;
};
