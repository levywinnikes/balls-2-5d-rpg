import React from "react";
import { usePlayerState } from "../../hooks/usePlayerState";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { useUI } from "../../context/UIContext";
import { useLanguage } from "../../context/LanguageContext";
import { Heart, Star, Backpack } from "lucide-react";
import { XPTable } from "../../game/data/XPTable";

export const StatusWidget: React.FC = () => {
    const playerState = PlayerState.getInstance();
    const { scale, showTooltip, hideTooltip, toggleWindow } = useUI();
    const { t } = useLanguage();

    // Data Hooks
    const currentHp = usePlayerState("healthChanged", () => playerState.getHealth(), 100);
    const maxHp = usePlayerState("maxHealthChanged", () => playerState.getMaxHealth(), 100);
    const hpPercent = (currentHp / maxHp) * 100;
    // const isLowHp = hpPercent < 30; // Unused for now

    const currentXp = usePlayerState("experienceChanged", () => playerState.getExperience(), 0);
    const xpInfo = XPTable.getLevelInfo(currentXp);
    const xpPercent = xpInfo.progress * 100;

    usePlayerState("inventoryUpdated", () => null, null);
    const cap = playerState.getCapacity();
    const currentWeight = playerState.getCurrentWeight();
    const capPercent = (currentWeight / cap) * 100; 
    // const isLowCap = capPercent > 90; // Unused for now

    // Helper for Bar
    const Bar = ({ 
        percent, 
        color, 
        icon: Icon, 
        value, 
        label, 
        onClick,
        tooltip 
    }: any) => (
        <div 
            onClick={onClick}
            onMouseEnter={(e) => tooltip && showTooltip({ ...tooltip, x: e.clientX, y: e.clientY })}
            onMouseLeave={hideTooltip}
            className={`
                group relative h-12 bg-black/60 border border-white/10 rounded overflow-hidden 
                flex items-center transition-all duration-200 hover:scale-105 hover:border-white/30 cursor-pointer
                flex-1 min-w-[100px] shadow-lg backdrop-blur-sm
            `}
        >
            {/* Background Fill */}
            <div 
                className="absolute inset-y-0 left-0 transition-all duration-500 ease-out opacity-80 group-hover:opacity-100"
                style={{ 
                    width: `${percent}%`, 
                    background: color, // CSS gradient or color
                    borderRadius: "0 2px 2px 0"
                }}
            />

            {/* Icon Box */}
            <div className="relative z-10 h-full aspect-square flex items-center justify-center bg-black/20 mr-1">
                <Icon size={16} className="text-white drop-shadow-md" />
            </div>

            {/* Value Text */}
            <div className="relative z-10 px-2 font-bold text-white text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] whitespace-nowrap">
                {value}
            </div>
            
            {/* Gloss */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
        </div>
    );

    // Alerts Logic
    const isOverburdened = capPercent > 100;
    const isHeavy = capPercent >= 80;
    const showWeightAlert = isHeavy;

    return (
        <div className="absolute top-4 left-6 flex flex-col gap-1 z-[45] pointer-events-auto select-none">
            {/* ALERT ICONS ROW (Above HP) */}
            <div className="flex items-center gap-2 h-5 pl-1">
                 {showWeightAlert && (
                     <div 
                        className={`flex items-center justify-center p-1 rounded-full bg-black/50 border ${isOverburdened ? "border-red-500 animate-pulse" : "border-yellow-500"}`}
                        title={isOverburdened ? t("msg_too_heavy") : "Heavy Load"}
                     >
                         <Backpack size={12} className={isOverburdened ? "text-red-500" : "text-yellow-500"} />
                     </div>
                 )}
            </div>

            {/* Compact HP + XP Layout */}
            <div className="flex flex-col gap-[2px] items-start">
                {/* HP */}
                <div className="w-[320px]">
                    <Bar 
                        percent={hpPercent}
                        color="linear-gradient(90deg, #991b1b, #ef4444)"
                        icon={Heart}
                        value={`${Math.floor(currentHp)} / ${maxHp}`}
                        label="Health"
                        onClick={() => toggleWindow("heroMenu")}
                        tooltip={{ text: t("hit_points"), subtext: "Click to open Hero Menu" }}
                    />
                </div>

                {/* XP - Thin Line */}
                <div 
                    className="w-[320px] h-[6px] bg-black/60 rounded-full overflow-hidden border border-white/10 relative cursor-pointer"
                    onMouseEnter={(e) => showTooltip({ 
                        text: t("level_progress"), 
                        subtext: `${xpPercent.toFixed(1)}% (${Math.floor(xpInfo.nextLevelXP - currentXp)} left)`,
                        x: e.clientX,
                        y: e.clientY
                    })}
                    onMouseLeave={hideTooltip}
                    onClick={() => toggleWindow("heroMenu")}
                >
                     <div 
                        className="h-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(234,179,8,0.5)]"
                        style={{ 
                            width: `${xpPercent}%`, 
                            background: "linear-gradient(90deg, #854d0e, #eab308)"
                        }}
                    />
                </div>
            </div>

        </div>
    );
};
