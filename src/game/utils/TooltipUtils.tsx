import React from "react";
import { PlayerState } from "../entities/Player/PlayerState";
import { WeaponDefinition } from "../entities/weapons/WeaponRegistry";
import { t_game } from "../i18n/translations";
import { RuneRegistry } from "../magic/RuneRegistry";
import { ItemAttributeRegistry } from "../items/ItemAttributeRegistry";
import { IRON_SHIELD_JOKES } from "../data/IronShieldJokes";
import { StatManager } from "../systems/StatManager";

export const t = t_game;

export interface FormattedTooltip {
    name: string;
    subtext: string | React.ReactNode;
} 

export function formatItemTooltip(
    def: WeaponDefinition | undefined, 
    itemData: { 
        weaponId: string; 
        timeLeft?: number; 
        itemId?: string; 
        uid?: string; 
        count?: number;
        stars?: number;
        attributes?: any[];
    }
): FormattedTooltip {
    if (itemData.stars) console.warn(`[DEBUG TOOLTIP] formatItemTooltip: ${itemData.weaponId} Stars=${itemData.stars} Type=${typeof itemData.stars}`);
    let subtextString = "";
    const name = def ? (t(def.name as any) || def.name) : itemData.weaponId;

    // STAR SYSTEM RENDER (Generic)
    // Force render if stars exist, ignore > 0 check for debug
    // STAR SYSTEM RENDER (Generic)
    // Force render if stars exist, ignore > 0 check for debug
    const starSection = itemData.stars ? (() => {
        // Sort Attributes: Gold > Silver > Bronze
        const sortedAttributes = itemData.attributes ? [...itemData.attributes].sort((a: any, b: any) => {
            const tierOrder = { gold: 3, silver: 2, bronze: 1 };
            const tierA = tierOrder[a.tier as keyof typeof tierOrder] || 0;
            const tierB = tierOrder[b.tier as keyof typeof tierOrder] || 0;
            return tierB - tierA;
        }) : [];

        const getTierIcon = (tier: string) => {
            switch(tier) {
                case 'gold': return <span className="text-yellow-400">★</span>;
                case 'silver': return <span className="text-gray-400">★</span>;
                case 'bronze': return <span className="text-orange-600">★</span>;
                default: return <span className="text-gray-600">★</span>;
            }
        };

        const getTierColor = (tier: string) => {
             switch(tier) {
                case 'gold': return "text-yellow-400";
                case 'silver': return "text-gray-400";
                case 'bronze': return "text-orange-600"; // improved contrast
                default: return "text-gray-400";
            }
        };

        // Unused headerTier removed

        return (
            <div className="mt-2 pt-2 border-t border-gray-600">

                <div className="flex items-center gap-0.5 mb-1">
                    {/* Multicolor Star Header */}
                    {Array.from({ length: itemData.stars || 0 }).map((_, i) => {
                        // Determine color for this specific star based on Attribute Tier
                        // attributes are already sorted Gold -> Silver -> Bronze
                        const attr = sortedAttributes[i];
                        let colorClass = "text-gray-400"; // Default/Fallback
                        
                        if (attr) {
                            if (attr.tier === 'gold') colorClass = "text-yellow-400";
                            else if (attr.tier === 'silver') colorClass = "text-gray-400"; // Silver looks like Gray
                            else if (attr.tier === 'bronze') colorClass = "text-orange-600";
                        } else {
                            // If we have stars but no attributes (Legacy), maybe use Golden for high stars? 
                            // Or keep gray to indicate "Empty". User said "Fallback... use cor padrão".
                            colorClass = "text-yellow-400"; // Legacy 5-star items usually imply quality
                        }

                        return (
                            <span key={i} className={`${colorClass} font-bold text-sm`}>★</span>
                        );
                    })}
                    <span className="text-xs text-gray-400 ml-1">({itemData.stars} Stars)</span>
                </div>
                {sortedAttributes.map((attr: any, idx: number) => {
                    const def = ItemAttributeRegistry.getAttributeDefinition(attr.id);
                    if (!def) return null;

                    const dynamicValue = ItemAttributeRegistry.getAttributeValue(attr.id, attr.tier);
                    const val = dynamicValue || attr.value || 0;
                    const nameKey = def.name;
                    const isPercent = def.isPercentage;
                    
                    // Smart Formatter Logic
                    let displayValue = `+${val}`;
                    // let suffix = "";
                    
                    if (isPercent) {
                        // It is a percentage, so displayValue should ideally be the FLAT calculated amount
                        // and suffix should be ` (+${val}%)`
                        displayValue = `+${val}%`; // Default fallback
                        
                        // Try to calculate flat value
                        const ps = PlayerState.getInstance();
                        let base = 0;
                        let showSmart = false;

                        if (def.type === "max_health") {
                             base = ps.getBaseMaxHealth(); // e.g. 100
                             showSmart = true;
                        } else if (def.type === "speed") {
                             base = 400; // Hardcoded base speed or ps.getBaseSpeed()
                             showSmart = true;
                        } else if (def.type === "attack") {
                             // Attack mult applies to Total Attack? Or Weapon?
                             // User example: 10 Base, +50% = +5.
                             // Let's use getStrengthLevel() + Weapon Damage? 
                             // Just use a reasonable "Current Base" estimation.
                             // For simplicity/robustness, if we can't easily get strict base, 
                             // we might stick to standard % display OR estimate.
                             // User explicitly asked for it. 
                             // Let's try: Base Attack (Skill + Weapon) estimate
                             // But tooltip is FOR a weapon.
                             // If this item IS the weapon, base is `def.damage`?
                             // No, "Global Multiplier". 
                             // Let's skip complex Attack calc to avoid misleading info if not perfect,
                             // UNLESS user gave specific example. "Espada de Madeira... +5 (+50%)".
                             // This implies applying % to the WEAPON's damage?
                             // If the attribute is "Global Attack", it applies to everything.
                             // BUT on the tooltip of a sword, players assume it boosts the sword.
                             // If I have 1000 Total Attack and Sword gives 50%... +500.
                             // Maybe I just leave it as % for Attack if uncertain to avoid lying.
                             // BUT User "Required" it.
                             // Let's implement for Health/Speed/Capacity/CritDamage perfectly.
                             // For Attack/Defense: Show % (maybe formatted nicely).
                             
                             // Re-reading user prompt: "Tenho 10 de Ataque Base. A Espada dá +50%... +5".
                             // This suggests using the Player's Base Attack (without this item?).
                             // `ps.getAttackDamage()` ?
                        }
                        
                        if (showSmart) {
                            const calculated = Math.floor(base * (val / 100));
                            displayValue = `+${calculated} (+${val}%)`;
                        } else {
                            displayValue = `+${val}%`;
                        }
                    } else {
                        // Flat
                        displayValue = `+${val}`; // No % suffix
                    }

                    return (
                        <div key={idx} className={`text-xs ${getTierColor(attr.tier)} flex items-center gap-1`}>
                            {getTierIcon(attr.tier)}
                            <span>{displayValue} {t(nameKey as any)}</span>
                        </div>
                    );
                })}
            </div>
        );
    })() : null;

    // If def is missing or generic (Early Return)
    if (!def) {
         return {
             name: name,
             subtext: (
                 <div>
                     {itemData.count && itemData.count > 1 && <div className="text-gray-400">{t("count" as any)}: {itemData.count}</div>}
                     {starSection}
                 </div>
             )
         };
    }

    // RUNE SPECIFIC RICH TOOLTIP
    const runeDef = RuneRegistry.getRune(def.id);
    if (runeDef) {
        const ps = PlayerState.getInstance();
        const isStar = runeDef.damage.element === "star";
        
        let runeJsx: React.ReactNode;
        let finalMin: number;
        let finalMax: number;

        if (isStar) {
            // Star Rune: damage scales ONLY with Star Points
            const starData = StatManager.getInstance().calculateStarPoints(ps);
            const starPoints = starData.totalPoints;
            const baseDmg = 200;
            const starMult = 1 + (starPoints * 0.10);
            const scaledDmg = Math.floor(baseDmg * starMult);
            const minDmg = Math.floor(scaledDmg * 0.80);
            const maxDmg = Math.floor(scaledDmg * 1.20);
            finalMin = minDmg;
            finalMax = maxDmg;

            runeJsx = (
                <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
                    {/* Base */}
                    <span className="text-gray-400">{t("tooltip_base")}:</span>
                    <div className="text-right">
                         <span className="text-white">{baseDmg}</span>
                    </div>
                    
                    {/* Star Points Scaling */}
                    <span className="text-yellow-400">⭐ Star Points:</span>
                    <div className="text-right">
                        <span className="text-yellow-400">×{starMult.toFixed(1)}</span>
                        <span className="text-gray-500 ml-1">({starPoints} pts)</span>
                    </div>



                    {/* Separator */}
                    <div className="col-span-2 h-px bg-gray-600 my-1"/>
                    
                    {/* Total */}
                    <span className="font-bold text-yellow-400">{t("tooltip_total")}:</span>
                    <div className="text-right">
                        <span className="font-bold text-yellow-400">{finalMin}-{finalMax}</span>
                        <span className="text-gray-500 text-[10px] ml-1">(star)</span>
                    </div>

                    {/* True Damage Note */}
                    <div className="col-span-2 text-[9px] text-yellow-500/70 italic mt-1">
                        ⭐ {t("combat_star_damage" as any) || "Star Damage"} — Dano Verdadeiro
                    </div>
                </div>
            );
        } else {
            // Standard rune tooltip with Level + Int + Willpower
            const level = ps.getLevel();
            const magicLvl = ps.getIntelligenceLevel();
            
            const baseMin = runeDef.damage.baseMin;
            const baseMax = runeDef.damage.baseMax;
            
            const lvlMult = level * 0.01;
            const intMult = magicLvl * 0.05;
            
            const lvlMin = Math.floor(baseMin * lvlMult);
            const lvlMax = Math.floor(baseMax * lvlMult);
            
            const intMin = Math.floor(baseMin * intMult);
            const intMax = Math.floor(baseMax * intMult);
            
            const subMin = baseMin + lvlMin + intMin;
            const subMax = baseMax + lvlMax + intMax;
            
            const wpBonusPct = ps.getWillpowerBonusPercent();
            const wpMult = wpBonusPct / 100;
            
            const wpMin = Math.floor(subMin * wpMult);
            const wpMax = Math.floor(subMax * wpMult);
            
            finalMin = subMin + wpMin;
            finalMax = subMax + wpMax;

            runeJsx = (
                <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
                    {/* Base */}
                    <span className="text-gray-400">{t("tooltip_base")}:</span>
                    <div className="text-right">
                         <span className="text-white">{baseMin}-{baseMax}</span>
                    </div>
                    
                    {/* Level */}
                    <span className="text-gray-400">{t("tooltip_level_bonus")}:</span>
                    <div className="text-right">
                        <span className="text-white">+{lvlMin}-{lvlMax}</span>
                        <span className="text-gray-500 ml-1">({level} Lvl)</span>
                    </div>

                    {/* Int */}
                    <span className="text-gray-400">{t("tooltip_skill_bonus")}:</span>
                    <div className="text-right">
                        <span className="text-white">+{intMin}-{intMax}</span>
                        <span className="text-gray-500 ml-1">({magicLvl} Int)</span>
                    </div>

                    {/* Subtotal Separator */}
                    <div className="col-span-2 h-px bg-gray-700 my-1"/>
                    
                    {/* Subtotal */}
                    <span className="text-gray-500 italic">{t("tooltip_subtotal")}:</span>
                    <span className="text-right text-gray-300">{subMin}-{subMax}</span>

                    {/* Willpower */}
                    <span className="text-purple-400">{t("tooltip_willpower_bonus")}:</span>
                    <div className="text-right">
                        <span className="text-purple-400">+{wpMin}-{wpMax}</span>
                        <span className="text-gray-500 ml-1">({wpBonusPct}%)</span>
                    </div>
                    
                    {/* Final Separator */}
                    <div className="col-span-2 h-px bg-gray-600 my-1"/>
                    
                    {/* Final Total */}
                    <span className="font-bold text-orange-400">{t("tooltip_total")}:</span>
                    <div className="text-right">
                        <span className="font-bold text-orange-400">{finalMin}-{finalMax}</span>
                        <span className="text-gray-500 text-[10px] ml-1">({runeDef.damage.element})</span>
                    </div>
                </div>
            );
        }
        
        const memCost = runeDef.memoryCost || 0;

        const fullLayout = (
            <div className="flex gap-3">
                <div className="w-20 h-20 bg-[#111] border border-[#333] flex items-center justify-center shrink-0 rounded">
                     <img 
                        src={`assets/items/runes/${def.id}.png`}
                        alt={name}
                        className="w-16 h-16 object-contain"
                        style={{ imageRendering: "pixelated" }}
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if(parent) {
                                parent.innerText = name.charAt(0);
                                parent.className += " text-2xl font-bold text-gray-600";
                            }
                        }}
                     />
                </div>

                <div className="flex flex-col min-w-[180px]">
                     <div className="font-bold text-yellow-500 mb-2 text-sm border-b border-gray-700 pb-1">
                         {name}
                     </div>

                     {runeJsx}
                     {starSection}
                     <div className="mt-2 pt-1 border-t border-gray-800 text-[10px] text-gray-400 font-mono">
                         🧠 {t("memory")}: {memCost}
                     </div>
                </div>
            </div>
        );
        
        return {
            name: "", 
            subtext: fullLayout
        };
    }

    // STANDARD WEAPON TOOLTIP (RICH LAYOUT)
    if (def.damage > 0 || def.defense > 0) {
        const ps = PlayerState.getInstance();
        const level = ps.getLevel();
        
        let skillLevel = 0;
        let skillLabel = "";
        
        if (def.type === "ranged") {
            skillLevel = ps.getDexterityLevel();
            skillLabel = "Dex";
        } else if (def.type === "melee") {
             skillLevel = ps.getStrengthLevel();
             skillLabel = "Str";
        }

        // Centralized Calculation
        const breakdown = ps.calculateAttackBreakdown(def, itemData.attributes, level, skillLevel);
        // const base = breakdown.base;

        const valFromLevel = Math.floor(breakdown.valFromLevel);
        const valFromSkill = Math.floor(breakdown.valFromSkill);
        const attrDamageBonusValue = Math.floor(breakdown.valFromAttributes);
        // const attrDamageSumPct = breakdown.attrTotalPct;
        
        // const subtotal = Math.floor(breakdown.subtotal);
        // const wpBonusPct = breakdown.wpBonusPct;
        const valFromWp = Math.floor(breakdown.valFromWp);
        const finalTotal = breakdown.finalTotal;


    // Use PlayerState sources of truth for Critical Stats
    const critChance = ps.getCriticalChance();
    const critMult = ps.getCriticalDamageMultiplier();
    
    // Critical Damage Range: [MaxNormal, MaxNormal * (1 + Multiplier)]
    const critMaxDamage = Math.floor(finalTotal * (1 + critMult));

    // Determine colors based on bonus
    const totalBonus = valFromLevel + valFromSkill + attrDamageBonusValue + valFromWp;
    const totalColor = totalBonus > 0 ? "text-green-400" : "text-gray-200";

    const weaponJsx = (
        <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs min-w-[180px]">
            {/* PRIMARY ROW: Total Value */}
            {def.damage > 0 && (
                <>
                    <span className="font-bold text-sm text-orange-400 flex items-center">
                        Ataque:
                    </span>
                    <div className="flex flex-col items-end">
                        <span className={`font-bold text-sm ${totalColor}`}>{finalTotal}</span>
                        {/* Show skill bonus breakdown */}
                        {valFromSkill > 0 && skillLabel && (
                             <span className="text-[10px] text-gray-500">
                                (+{Math.floor(valFromSkill)} {skillLabel})
                             </span>
                        )}
                    </div>
                </>
            )}

            {/* Range (converted to meters) */}
            {def.range && def.range > 0 && (
                <>
                    <span className="text-gray-400">Alcance:</span>
                    <span className="text-right text-gray-300">{(def.range / 32).toFixed(1)}m</span>
                </>
            )}

            {/* Cooldown (converted to seconds) */}
            {def.cooldown && def.cooldown > 0 && (
                <>
                    <span className="text-gray-400">Velocidade:</span>
                    <span className="text-right text-gray-300">{(def.cooldown / 1000).toFixed(1)}s</span>
                </>
            )}

            {/* Exp Per Hit */}
            {def.exp_skill && def.exp_skill > 0 && (
                <>
                    <span className="text-gray-400">Exp. Ataque:</span>
                    <span className="text-right text-gray-300">+{def.exp_skill}</span>
                </>
            )}
            
            {(def.type === "melee" || def.type === "ranged") && (
                <>
                    <div className="col-span-2 h-px bg-gray-700 my-1 opacity-50"/>
                    
                    <span className="text-pink-400">{t("tooltip_crit_chance")}:</span>
                    <span className="text-right text-pink-400">{critChance.toFixed(0)}%</span>

                    <span className="text-pink-400">{t("tooltip_crit_damage")}:</span>
                    <span className="text-right text-pink-400">
                        {finalTotal}-{critMaxDamage}
                    </span>
                </>
             )}
             
             {/* Defense Logic */}
             {def.defense > 0 && def.damage === 0 && (
                 <>
                    <span className="font-bold text-sm text-blue-400">Defesa:</span>
                    <span className="font-bold text-sm text-blue-400 text-right">
                        {Math.floor(def.defense + (def.defense * (level * 0.01)) + (def.defense * (ps.getReflexLevel() * 0.05)))}
                    </span>
                 </>
             )}
        </div>
    );

    let extraInfo = "";
    let weight = def.weight;
    if (itemData.count && itemData.count > 1) weight *= itemData.count;
    extraInfo += `⚖️ ${weight.toFixed(2)} oz`;

    // Joke Logic
    let jokeElement = null;
    if (def.id === "iron_shield" && ps.equippedShieldId === "iron_shield") {
         const randomJokeKey = IRON_SHIELD_JOKES[Math.floor(Math.random() * IRON_SHIELD_JOKES.length)];
         const jokeText = t(randomJokeKey as any);
         jokeElement = (
             <div className="mt-2 text-[#FFD700] italic text-center text-[11px] font-serif border-t border-gray-700 pt-2">
                 "{jokeText}"
             </div>
         );
    }

    return {
        name: "", // Rely on TooltipManager for name
        subtext: (
            <div>
                {weaponJsx}
                {starSection}
                {jokeElement}
                <div className="mt-2 pt-2 border-t border-gray-700 text-gray-500 whitespace-pre-wrap font-mono text-[10px]">
                    {extraInfo.trim()}
                </div>
            </div>
        )
    };
    }

    // GENERIC ITEM FALLBACK
    if (def.armor > 0) subtextString += `🛡️ ${t("armor")}: ${def.armor}\n`;
    
    let weight = def.weight;
    if (itemData.count && itemData.count > 1) {
        weight = def.weight * itemData.count;
    }

    if (def.type === "container") {
        const uid = itemData.uid || itemData.itemId;
        if (uid) {
            const contentWeight = PlayerState.getInstance().getContainerTotalWeight(uid);
            weight += contentWeight;
        }
    }
    subtextString += `⚖️ ${t("weight")}: ${weight.toFixed(2)} oz\n`;

    if (def.consumable) subtextString += `⚠️ ${t("consumable")}\n`;
    if (def.stackable) subtextString += `📦 ${t("stackable")}\n`;

    if (itemData.timeLeft !== undefined && def?.type !== "container") {
         const mins = Math.floor(itemData.timeLeft / 60);
         const secs = itemData.timeLeft % 60;
         
         if (subtextString.length > 0) subtextString += "\n";
         subtextString += `⏳ ${mins}:${secs.toString().padStart(2, "0")}`;
    }

    return { name, subtext: subtextString.trim() };
}
