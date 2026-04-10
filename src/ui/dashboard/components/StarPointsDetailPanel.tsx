import React, { useMemo } from "react";
import { StatManager } from "../../../game/systems/StatManager";
import { PlayerState } from "../../../game/entities/Player/PlayerState";
import { useLanguage } from "../../../context/LanguageContext";
import { usePlayerState } from "../../../hooks/usePlayerState";
import { Star } from "lucide-react";

export const StarPointsDetailPanel: React.FC = () => {
    const { t } = useLanguage();
    const ps = PlayerState.getInstance();
    const sm = StatManager.getInstance();

    // Re-calculate when equipment or level changes
    const version = usePlayerState(["equipmentChanged", "levelUp"], () => Date.now(), 0);

    const data = useMemo(() => {
        return sm.calculateStarPoints(ps);
    }, [version]);

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'bronze': return 'text-amber-500';
            case 'silver': return 'text-slate-300';
            case 'gold': return 'text-yellow-400';
            default: return 'text-white/50';
        }
    };

    const getTierBg = (tier: string) => {
        switch (tier) {
            case 'bronze': return 'bg-amber-600/15 border-amber-500/30';
            case 'silver': return 'bg-slate-300/15 border-slate-400/30';
            case 'gold': return 'bg-yellow-500/15 border-yellow-400/30';
            default: return 'bg-white/5 border-white/10';
        }
    };

    const getTierLabel = (tier: string) => {
        switch (tier) {
            case 'bronze': return t('star_points_bronze' as any) || 'Bronze';
            case 'silver': return t('star_points_silver' as any) || 'Silver';
            case 'gold': return t('star_points_gold' as any) || 'Gold';
            default: return tier;
        }
    };

    return (
        <div className="h-full flex flex-col bg-black/60 rounded-xl p-4 border border-white/10">
            {/* Header */}
            <div className="border-b border-white/10 pb-3 mb-4">
                <div className="text-xs text-white/40 uppercase tracking-widest">
                    {t("character_overview" as any) || "Character Overview"}
                </div>
                <div className="text-lg font-bold text-yellow-300 mt-1 flex items-center gap-2">
                    <Star size={18} className="text-yellow-400 fill-yellow-400" />
                    {t("star_points" as any) || "Star Points"}
                </div>
            </div>

            {/* Total Value */}
            <div className="text-center py-6 bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-orange-500/10 rounded-lg border border-yellow-500/20 mb-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(234,179,8,0.08)_0%,_transparent_70%)]" />
                <div className="relative z-10">
                    <div className="text-[10px] text-yellow-400/60 uppercase tracking-widest mb-2">Total</div>
                    <div className="text-4xl font-bold text-yellow-300">{data.totalPoints}</div>
                </div>
            </div>

            {/* Breakdown */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                
                {/* Level Contribution */}
                <div className="space-y-2">
                    <div className="text-[10px] text-white/30 uppercase tracking-widest pl-1">
                        {t("star_points_from_level" as any) || "Level Bonus"}
                    </div>
                    <div className="flex justify-between items-center text-sm p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                        <div className="flex flex-col">
                            <span className="text-yellow-200 font-medium">
                                Level {ps.getLevel()}
                            </span>
                            <span className="text-[9px] text-yellow-400/50 uppercase">
                                +1 pt / level
                            </span>
                        </div>
                        <span className="font-bold text-yellow-300">+{data.levelPoints}</span>
                    </div>
                </div>

                {/* Equipment Breakdown */}
                {data.equipmentBreakdown.length > 0 && (
                    <div className="space-y-2 mt-3">
                        <div className="text-[10px] text-white/30 uppercase tracking-widest pl-1">
                            {t("star_points_from_equipment" as any) || "Equipment Stars"}
                        </div>
                        {data.equipmentBreakdown.map((item, i) => (
                            <div 
                                key={i} 
                                className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-2"
                            >
                                <div className="flex justify-between items-center">
                                    <span className="text-white/80 font-medium text-sm">{item.itemName}</span>
                                    <span className="font-bold text-yellow-300 text-sm">+{item.totalItemPoints}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {item.stars.map((star, j) => (
                                        <div 
                                            key={j}
                                            className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border ${getTierBg(star.tier)}`}
                                        >
                                            <Star size={8} className={`${getTierColor(star.tier)} fill-current`} />
                                            <span className={getTierColor(star.tier)}>{getTierLabel(star.tier)}</span>
                                            <span className="text-white/40">+{star.points}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {data.equipmentBreakdown.length === 0 && (
                    <div className="text-center text-sm text-white/20 italic py-4">
                        {t("star_points_from_equipment" as any) || "Equipment Stars"}: 0
                    </div>
                )}

                {/* Willpower Multiplier */}
                {data.willpowerTier > 0 && (
                    <div className="space-y-2 mt-3">
                        <div className="text-[10px] text-purple-400/50 uppercase tracking-widest pl-1">
                            {t("willpower" as any) || "Willpower"}
                        </div>
                        <div className="flex justify-between items-center text-sm p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                            <div className="flex flex-col">
                                <span className="text-purple-300 font-medium">
                                    Tier {data.willpowerTier}
                                </span>
                                <span className="text-[9px] text-purple-400/50 uppercase">
                                    +{data.willpowerPercent}% total
                                </span>
                            </div>
                            <span className="font-bold text-purple-300">+{data.willpowerBonus}</span>
                        </div>
                    </div>
                )}

                {/* Mysterious Description */}
                <div className="mt-4 p-3 bg-purple-500/5 rounded-lg border border-purple-500/15">
                    <p className="text-[10px] text-purple-300/60 italic leading-relaxed">
                        ✨ {t("star_points_desc" as any) || "An ancient force resonates through your stars..."}
                    </p>
                </div>
            </div>
        </div>
    );
};
