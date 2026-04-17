import React from "react";
import { StatManager } from "../../../game/systems/StatManager";
import { PlayerState } from "../../../game/entities/Player/PlayerState";
import { useLanguage } from "../../../context/LanguageContext";
import { Zap, Target, Flame, ChevronRight } from "lucide-react";

export const DPSDetailPanel: React.FC = () => {
    const { t } = useLanguage();
    const ps = PlayerState.getInstance();
    const sm = StatManager.getInstance();
    
    const breakdown = sm.calculateDPSBreakdown(ps);
    
    return (
        <div className="h-full flex flex-col bg-black/60 rounded-xl p-4 border border-white/10">
            {/* Header */}
            <div className="border-b border-white/10 pb-3 mb-4">
                <div className="text-xs text-white/40 uppercase tracking-widest">
                    {t("character_overview" as any)}
                </div>
                <div className="text-lg font-bold text-white mt-1">{t("panel_dps_title" as any)}</div>
            </div>

            {/* Total Value */}
            <div className="text-center py-6 bg-blue-500/10 rounded-lg border border-blue-500/20 mb-4">
                <div className="text-[10px] text-white/40 uppercase tracking-widest mb-2">{t("panel_total_dps" as any)}</div>
                <div className="text-5xl font-bold text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.3)]">
                    {breakdown.totalDPS}
                </div>
            </div>

            {/* Breakdown */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                
                {/* 1. Base Damage Component */}
                <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                    <div className="p-3 border-b border-white/5 flex items-center justify-between bg-white/5">
                        <div className="flex items-center gap-2">
                            <Flame size={14} className="text-orange-400" />
                            <span className="text-[10px] text-white/60 uppercase font-bold tracking-widest">{t("panel_base_damage" as any)}</span>
                        </div>
                        <span className="text-xs font-mono text-white/30">1 - {breakdown.maxAttack}</span>
                    </div>
                    
                    <div className="p-4 space-y-4">
                        {/* Normal Average */}
                        <div className="flex justify-between items-center group">
                            <div className="flex flex-col">
                                <span className="text-xs text-white/80 font-semibold italic">{t("panel_normal_average" as any)}</span>
                                <span className="text-[9px] text-white/30 uppercase tracking-tighter">{t("panel_no_critical_hits" as any)}</span>
                            </div>
                            <div className="text-xl font-bold text-white">{breakdown.avgNormalDmg}</div>
                        </div>

                        {/* Critical Breakdown */}
                        <div className="space-y-2 pt-2 border-t border-white/5">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-1.5">
                                    <ChevronRight size={10} className="text-yellow-500" />
                                    <span className="text-xs text-yellow-400/90 font-semibold italic">{t("panel_critical_bonus" as any)}</span>
                                </div>
                                <span className="text-md font-bold text-yellow-500">
                                    +{((breakdown.avgCritDmg - breakdown.avgNormalDmg) * (breakdown.critChance/100)).toFixed(1)}
                                </span>
                            </div>

                            {/* Detailed Crit Stats */}
                            <div className="grid grid-cols-2 gap-2 mt-1">
                                <div className="bg-black/40 p-2 rounded border border-white/5">
                                    <div className="text-[8px] text-white/30 uppercase tracking-widest mb-0.5">{t("panel_chance" as any)}</div>
                                    <div className="text-xs font-bold text-white/90">{breakdown.critChance.toFixed(1)}%</div>
                                    <div className="text-[8px] text-white/20 mt-0.5">{t("stats.dexterity" as any)} {breakdown.dexterity}</div>
                                </div>
                                <div className="bg-black/40 p-2 rounded border border-white/5">
                                    <div className="text-[8px] text-white/30 uppercase tracking-widest mb-0.5">{t("panel_multiplier" as any)}</div>
                                    <div className="text-xs font-bold text-white/90">+{breakdown.critMultiplier.toFixed(0)}%</div>
                                    <div className="text-[8px] text-white/20 mt-0.5">{t("stats.strength" as any)} {breakdown.strength}</div>
                                </div>
                            </div>
                        </div>

                        {/* Resulting Avg */}
                        <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                            <span className="text-xs font-bold text-blue-300 uppercase tracking-widest">{t("panel_total_damage_per_hit" as any)}</span>
                            <div className="text-xl font-black text-blue-400">
                                {(breakdown.totalDPS / (breakdown.aps || 1)).toFixed(1)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Frequency Component */}
                <div className="bg-white/5 rounded-xl border border-white/10 p-4 flex justify-between items-center hover:bg-white/10 transition-colors">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <Zap size={14} className="text-yellow-400" />
                            <span className="text-xs text-white/80 font-bold uppercase tracking-widest">{t("panel_frequency" as any)}</span>
                        </div>
                        <span className="text-[9px] text-white/30 uppercase tracking-tighter mt-1">{t("panel_attacks_per_second_multiplier" as any)}</span>
                    </div>
                    <div className="text-2xl font-black text-white px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                        x{breakdown.aps}
                    </div>
                </div>

                {/* 3. Willpower (If Active) */}
                {breakdown.willpowerBonus > 0 && (
                    <div className="bg-purple-500/10 rounded-xl border border-purple-500/20 p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <Target size={16} className="text-purple-400" />
                            </div>
                            <div>
                                <div className="text-xs text-purple-300 font-bold uppercase tracking-widest">{t("willpower" as any)}</div>
                                <div className="text-[9px] text-purple-400/60 uppercase tracking-tighter">{t("panel_global_stat_multiplier" as any)}</div>
                            </div>
                        </div>
                        <div className="text-xl font-bold text-purple-400">
                            +{(breakdown.willpowerBonus).toFixed(1)}%
                        </div>
                    </div>
                )}

                {/* Formula Footer */}
                <div className="py-2 px-1 opacity-40">
                    <div className="text-[9px] font-mono text-center leading-relaxed text-white/60">
                        {t("panel_dps_formula" as any)}
                    </div>
                </div>

            </div>
        </div>
    );
};
