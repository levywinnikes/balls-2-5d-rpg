import React from "react";
import { usePlayerState } from "../../hooks/usePlayerState";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { useUI } from "../../context/UIContext";
import { useLanguage } from "../../context/LanguageContext";
import { Heart, Star, Backpack, ShieldCheck, ShieldAlert } from "lucide-react";
import { XPTable } from "../../game/data/XPTable";

export const SidebarStatus: React.FC = () => {
  const playerState = PlayerState.getInstance();
  const { scale, showTooltip, hideTooltip, toggleWindow } = useUI();
  const { t } = useLanguage();

  // Hooks para dados
  const currentHp = usePlayerState("healthChanged", () => playerState.getHealth(), 100);
  const maxHp = usePlayerState("maxHealthChanged", () => playerState.getMaxHealth(), 100);
  const playName = usePlayerState(["reset", "nameChanged"], () => playerState.getName(), "Hero");
  
  // XP e Level
  const currentXp = usePlayerState("experienceChanged", () => playerState.getExperience(), 0);
  const level = usePlayerState(["levelUp", "reset", "experienceChanged"], () => playerState.getLevel(), 1);
  const xpInfo = XPTable.getLevelInfo(currentXp);

  // Capacidade
  usePlayerState("inventoryUpdated", () => null, null);
  const cap = playerState.getCapacity();
  const currentWeight = playerState.getCurrentWeight();
  const capPercent = (currentWeight / cap) * 100;
  
  const hpPercent = (currentHp / maxHp) * 100;
  const xpPercent = xpInfo.progress * 100;

  // Animation Triggers
    const isLowHp = hpPercent < 30;
    const isHighXp = xpPercent >= 90;
    const isLowCap = capPercent > 90;

    return (
        <div className="flex flex-col gap-2 p-2 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-lg mb-2">
            {/* Name Header & Fall Safety */}
            <div className="flex items-center gap-1">
                <div className="flex-1 text-center font-bold text-sm text-[#fbbf24] bg-[#222] rounded-md py-1 border border-[#333] shadow-inner truncate cursor-default">
                    {playName} <span className="text-gray-400 text-xs">(Lvl {level})</span>
                </div>
                <SafetyToggle />
            </div>

            {/* Status Grid */}
            <div className="grid grid-cols-3 gap-2">
                
                {/* HEART (HP) */}
                <div 
                    onClick={() => toggleWindow("character")}
                    onMouseEnter={(e) => showTooltip({ text: t("hp_tooltip"), subtext: `${Math.floor(currentHp)} / ${maxHp}`, x: e.clientX, y: e.clientY })}
                    onMouseLeave={hideTooltip}
                    className={`relative flex items-center justify-center h-12 bg-[#2a1a1a] rounded-xl border border-red-900/30 shadow-sm overflow-hidden group transition-transform duration-200 cursor-pointer hover:scale-105 ${isLowHp ? 'animate-pulse ring-1 ring-red-500' : ''}`}
                    title={t("hud_character")}
                >   
                    {/* Liquid Fill Background */}
                    <div 
                        className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-red-900/60 to-red-800/40 transition-all duration-500 ease-out"
                        style={{ height: `${hpPercent}%` }}
                    />

                    <Heart 
                        size={32 * scale} 
                        className={`absolute text-red-600/20 group-hover:text-red-500/30 transition-colors fill-current ${isLowHp ? 'animate-bounce' : ''}`}
                        strokeWidth={1.5}
                    />
                    <Heart 
                        size={24 * scale} 
                        className="text-red-500 mb-2 z-10" 
                        fill="currentColor" 
                        strokeWidth={0}
                    />
                   <span className="absolute mt-1 font-bold text-sm text-yellow-300 drop-shadow-md z-10">
                        {Math.floor(currentHp)}
                    </span>
                </div>

                {/* STAR (XP %) */}
                <div 
                    onMouseEnter={(e) => showTooltip({ 
                        text: t("level_progress"), 
                        subtext: `${xpPercent.toFixed(1)}% (${Math.floor(xpInfo.nextLevelXP - currentXp)} left)`, 
                        x: e.clientX, 
                        y: e.clientY 
                    })}
                    onMouseLeave={hideTooltip}
                    className={`relative flex items-center justify-center h-12 bg-[#2a2510] rounded-xl border border-yellow-900/30 shadow-sm overflow-hidden group transition-transform duration-200 cursor-default hover:scale-105 ${isHighXp ? 'animate-pulse ring-1 ring-yellow-400' : ''}`}
                >
                    {/* Liquid Fill Background */}
                    <div 
                        className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-yellow-900/60 to-yellow-800/40 transition-all duration-500 ease-out"
                        style={{ height: `${xpPercent}%` }}
                    />

                    <Star 
                         size={32 * scale} 
                         className="absolute text-yellow-500/20 group-hover:text-yellow-400/30 transition-colors fill-current"
                         strokeWidth={1.5}
                    />
                    <Star 
                        size={24 * scale} 
                        className="text-yellow-400 mb-2 z-10" 
                        fill="currentColor"
                        strokeWidth={0}
                    />
                    <span className="absolute mt-1 font-bold text-sm text-white drop-shadow-md z-10">
                        {xpPercent.toFixed(0)}<span className="text-[10px]">%</span>
                    </span>
                </div>

                {/* WEIGHT (Capacity/Inventory) */}
                <div 
                    onClick={() => toggleWindow("inventory")}
                    onMouseEnter={(e) => showTooltip({ 
                        text: t("capacity"), 
                        subtext: `${(cap - currentWeight).toFixed(1)} ${t("cap_free")}`, 
                        x: e.clientX, 
                        y: e.clientY 
                    })}
                    onMouseLeave={hideTooltip}
                    className={`relative flex items-center justify-center h-12 bg-[#1a1a1a] rounded-xl border border-gray-700/30 shadow-sm overflow-hidden group transition-transform duration-200 cursor-pointer hover:scale-105 ${isLowCap ? 'animate-pulse ring-1 ring-gray-400' : ''}`}
                    title={t("hud_inventory")}
                >
                    {/* Liquid Fill Background (Shows USED Space) */}
                    <div 
                        className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-gray-700/50 to-gray-600/30 transition-all duration-500 ease-out"
                        style={{ height: `${capPercent}%` }}
                    />

                    <Backpack 
                         size={32 * scale} 
                         className="absolute text-gray-400/20 group-hover:text-gray-300/30 transition-colors"
                         strokeWidth={1.5}
                    />
                    <Backpack 
                         size={24 * scale} 
                         className="text-gray-400 mb-2 z-10" 
                         // fill="currentColor" 
                         strokeWidth={2}
                    />
                    <span className="absolute mt-1 font-bold text-sm text-white drop-shadow-md z-10">
                        {(cap - currentWeight).toFixed(0)}
                    </span>
                </div>
            </div>
            
        </div>
    );
};

const SafetyToggle: React.FC = () => {
    const playerState = PlayerState.getInstance();
    const { t } = useLanguage();
    const { showTooltip, hideTooltip } = useUI();
    const isSafe = usePlayerState("fallSafetyChanged", () => playerState.isFallSafetyEnabled(), true);

    return (
        <button
            onClick={() => playerState.toggleFallSafety()}
            onMouseEnter={(e) => showTooltip({ 
                text: isSafe ? t("fall_safety_on") : t("fall_safety_off"), 
                subtext: isSafe ? t("fall_safety_on_desc") : t("fall_safety_off_desc"),
                x: e.clientX, 
                y: e.clientY 
            })}
            onMouseLeave={hideTooltip}
            className={`p-1 rounded-md border shadow-sm transition-all hover:scale-105 ${
                isSafe 
                ? "bg-green-900/30 border-green-500/50 text-green-400 hover:bg-green-900/50" 
                : "bg-red-900/30 border-red-500/50 text-red-400 hover:bg-red-900/50 animate-pulse"
            }`}
        >
            {isSafe ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
        </button>
    );
};
