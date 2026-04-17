import React, { useMemo } from "react";
import {
  Star,
  Shield,
  Zap,
  Sword,
  Heart,
  Activity,
  Brain,
  Box,
  Wind,
  Crosshair,
  Sparkles,
  Beef,
} from "lucide-react";
import { usePlayerState } from "../../../hooks/usePlayerState";
import { PlayerState } from "../../../game/entities/Player/PlayerState";
import { StatManager } from "../../../game/systems/StatManager";
import { useLanguage } from "../../../context/LanguageContext";
import { ProgressBar } from "../../components/ProgressBar";
// import { translateAttribute, formatAttributeValue } from "../../utils/ItemVisuals"; // Removed unused imports
import { XPTable } from "../../../game/data/XPTable";
import { StrengthXpTable } from "../../../game/data/StrengthXpTable";
import { DexterityXpTable } from "../../../game/data/DexterityXpTable";
import { IntelligenceXpTable } from "../../../game/data/IntelligenceXpTable";
import { ReflexXpTable } from "../../../game/data/ReflexXpTable";

interface HeroStatsTabProps {
  onStatSelect?: (statKey: string, label: string) => void;
  onConditionClick?: (conditionType: "willpower" | "hunger") => void;
}

export const HeroStatsTab: React.FC<HeroStatsTabProps> = ({
  onStatSelect,
  onConditionClick,
}) => {
  const ps = PlayerState.getInstance();
  const { t } = useLanguage();

  // --- Survival Hooks ---
  const hp = usePlayerState(
    ["healthChanged", "levelUp", "equipmentChanged"],
    () => ps.getHealth(),
    100,
  );
  const maxHp = usePlayerState(
    ["levelUp", "equipmentChanged", "buffsChanged"],
    () => ps.getMaxHealth(),
    100,
  );

  // Hunger (Max 2000 strict as per source)
  const hunger = usePlayerState(
    ["hungerUpdated", "reset"],
    () => ps.getHunger(),
    1000,
  );
  const maxHunger = 2000; // Defined in PlayerState source

  // --- Core Stats with XP ---
  const strData = usePlayerState(
    "strengthExperienceChanged",
    () => {
      const d = ps.getStrengthData();
      return {
        ...StrengthXpTable.getLevelInfo(d.experience),
        totalXP: d.experience,
      };
    },
    { level: 1, currentLevelXP: 0, nextLevelXP: 100, progress: 0, totalXP: 0 },
  );

  const dexData = usePlayerState(
    "dexterityExperienceChanged",
    () => {
      const d = ps.getDexterityData();
      return {
        ...DexterityXpTable.getLevelInfo(d.experience),
        totalXP: d.experience,
      };
    },
    { level: 1, currentLevelXP: 0, nextLevelXP: 100, progress: 0, totalXP: 0 },
  );

  const intData = usePlayerState(
    "intelligenceExperienceChanged",
    () => {
      const d = ps.getIntelligenceData();
      return {
        ...IntelligenceXpTable.getLevelInfo(d.experience),
        totalXP: d.experience,
      };
    },
    { level: 1, currentLevelXP: 0, nextLevelXP: 100, progress: 0, totalXP: 0 },
  );

  const refData = usePlayerState(
    "reflexExperienceChanged",
    () => {
      const d = ps.getReflexData();
      return {
        ...ReflexXpTable.getLevelInfo(d.experience),
        totalXP: d.experience,
      };
    },
    { level: 1, currentLevelXP: 0, nextLevelXP: 100, progress: 0, totalXP: 0 },
  );

  // --- Willpower ---
  const wpExp = usePlayerState(
    "willpowerUpdated",
    () => ps.getWillpowerExp(),
    0,
  );
  const wpTarget = usePlayerState(
    "willpowerUpdated",
    () => ps.getWillpowerTarget(),
    300,
  );
  const wpTier = usePlayerState(
    "willpowerUpdated",
    () => ps.getWillpowerTier(),
    0,
  );
  const wpBonus = usePlayerState(
    "willpowerUpdated",
    () => ps.getWillpowerBonusPercent(),
    0,
  );

  // --- Derived Stats ---
  // We fetch these once or on equipment changes
  const derivedStatsVersion = usePlayerState(
    ["equipmentChanged", "buffsChanged", "levelUp"],
    () => Date.now(),
    0,
  );

  const derived = useMemo(() => {
    void derivedStatsVersion;
    const sm = StatManager.getInstance();
    return {
      attack: sm.calculateStat("attack", ps).finalValue,
      defense: sm.calculateStat("defense", ps).finalValue,
      armor: sm.calculateStat("armor", ps).finalValue,
      critChance: sm.calculateStat("criticalChance", ps).finalValue,
      critDmg: sm.calculateStat("criticalDamage", ps).finalValue,
      speed: sm.calculateStat("speed", ps).finalValue,
      capacity: sm.calculateStat("capacity", ps).finalValue,
      range: sm.calculateStat("range", ps).finalValue,
      cooldown: sm.calculateStat("cooldown", ps).finalValue,
      // Resistances
      phys: sm.calculateStat("physicalResist", ps).finalValue,
      fire: sm.calculateStat("fireResist", ps).finalValue,
    };
  }, [derivedStatsVersion, ps]);

  const dpsData = useMemo(() => {
    const sm = StatManager.getInstance();
    void derivedStatsVersion;
    return sm.calculateDPSBreakdown(ps);
  }, [derivedStatsVersion, ps]);

  const starPoints = useMemo(() => {
    void derivedStatsVersion;
    const sm = StatManager.getInstance();
    return sm.calculateStarPoints(ps).totalPoints;
  }, [derivedStatsVersion, ps]);

  const handleStatClick = (statKey: string, label: string) => {
    if (onStatSelect) {
      onStatSelect(statKey, label);
    }
  };

  // Helper for Core Stat Cards
  const renderCoreCard = (
    label: string,
    statKey: string,
    data: {
      level: number;
      progress: number;
      currentLevelXP: number;
      nextLevelXP: number;
      totalXP: number;
    },
    icon: React.ReactNode,
    color: string,
  ) => {
    // XP display values
    const xpInLevel = data.totalXP - data.currentLevelXP;
    const xpForNextLevel = data.nextLevelXP - data.currentLevelXP;
    const displayTarget =
      data.nextLevelXP === Infinity ? "MAX" : xpForNextLevel;

    // Use progress directly from XpTable (already calculated correctly)
    // const progressPercent = data.nextLevelXP === Infinity ? 100 : (data.progress * 100);

    return (
      <div
        className="bg-black/40 rounded-md p-2 border border-white/5 relative overflow-hidden group cursor-pointer hover:border-white/20 transition-colors"
        onClick={() => onStatSelect?.(statKey, label)}
      >
        <div
          className={`absolute top-0 right-0 p-1 opacity-20 group-hover:opacity-40 transition-opacity ${color}`}
        >
          {icon}
        </div>
        <div className="flex flex-col relative z-10 h-full justify-between">
          <div>
            <span className="text-[10px] uppercase text-white/50 tracking-widest font-bold block">
              {label}
            </span>
            <span
              className={`text-2xl font-bold ${color} leading-none my-1 block`}
            >
              {data.level}
            </span>
          </div>

          {/* XP Bar */}
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-2 relative">
            {(() => {
              const percent =
                data.nextLevelXP === Infinity ? 100 : data.progress * 100;
              // Map text colors to RGB values
              const colorMap: Record<string, string> = {
                "text-red-500": "rgb(239, 68, 68)", // Força
                "text-green-400": "rgb(74, 222, 128)", // Destreza
                "text-purple-400": "rgb(192, 132, 252)", // Inteligência
                "text-blue-400": "rgb(96, 165, 250)", // Reflexo
              };
              const bgColor = colorMap[color] || "rgb(255, 255, 255)";
              return (
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: bgColor,
                  }}
                />
              );
            })()}
          </div>

          {/* XP Text */}
          <div className="text-[9px] text-white/30 font-mono mt-1 text-right">
            {data.nextLevelXP === Infinity
              ? t("max_level" as any)
              : `${Math.floor(xpInLevel)} / ${displayTarget} XP`}
          </div>
        </div>
      </div>
    );
  };

  const renderDetailRow = (
    statKey: string,
    label: string,
    value: string | number,
    icon: React.ReactNode,
  ) => (
    <div
      onClick={() => handleStatClick(statKey, label)}
      className="flex items-center justify-between p-1.5 rounded bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/20 transition-all cursor-pointer active:scale-95"
    >
      <div className="flex items-center gap-2 text-white/60">
        {React.cloneElement(icon as React.ReactElement<any>, { size: 12 })}
        <span className="text-[10px] uppercase font-bold tracking-wide">
          {label}
        </span>
      </div>
      <span className="text-xs font-bold text-white">{value}</span>
    </div>
  );

  return (
    <div
      className="h-full flex flex-col p-1 gap-2 overflow-y-auto custom-scrollbar relative"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Character Level (Clickable Star) */}
      <div
        className="bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-yellow-500/10 rounded-lg border border-yellow-500/30 p-3 cursor-pointer hover:border-yellow-500/60 transition-all relative overflow-hidden group"
        onClick={() => onStatSelect?.("characterLevel", t("level") as string)}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center justify-between mb-2 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⭐</span>
            <div>
              <div className="text-[10px] text-yellow-400/60 uppercase tracking-widest">
                {t("character_overview" as any)}
              </div>
              <div className="text-xl font-bold text-yellow-300">
                {ps.getLevel()}
              </div>
            </div>
          </div>
          <div className="text-xs text-yellow-400/60 font-mono">
            {Math.floor(ps.getExperience())} /{" "}
            {Math.ceil(XPTable.getXPRequiredForLevel(ps.getLevel() + 1))} XP
          </div>
        </div>
        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden relative z-10">
          {(() => {
            const levelInfo = XPTable.getLevelInfo(ps.getExperience());
            return (
              <div
                className="h-full bg-gradient-to-r from-yellow-500 via-orange-400 to-yellow-500 transition-all duration-300"
                style={{ width: `${levelInfo.progress * 100}%` }}
              />
            );
          })()}
        </div>
      </div>

      {/* 1. SURVIVAL SECTION (Top) */}
      <div className="grid gap-2">
        {/* Health */}
        <div
          className="relative h-7 bg-black/60 rounded border border-red-900/40 overflow-hidden shrink-0 cursor-pointer hover:border-red-500/60 transition-colors"
          onClick={() => onStatSelect?.("maxHealth", String(t("health")))}
        >
          <div
            className="absolute inset-y-0 left-0 bg-red-600/40 transition-all duration-300"
            style={{ width: `${(hp / maxHp) * 100}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-between px-3 z-10">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-red-100 shadow-black drop-shadow-md">
              <Heart size={10} className="fill-red-500 text-red-500" />{" "}
              {t("health")}
            </span>
            <span className="text-xs font-bold text-white shadow-black drop-shadow-md">
              {Math.floor(hp)} / {maxHp}
            </span>
          </div>
        </div>

        {/* Hunger */}
        <div
          className="relative h-7 bg-black/60 rounded border border-orange-900/40 overflow-hidden shrink-0 cursor-pointer hover:border-orange-500/60 transition-colors"
          onClick={() => onConditionClick?.("hunger")}
        >
          <div
            className="absolute inset-y-0 left-0 bg-orange-600/40 transition-all duration-300"
            style={{ width: `${(hunger / maxHunger) * 100}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-between px-3 z-10">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-orange-100 shadow-black drop-shadow-md">
              <Beef size={10} className="fill-orange-500 text-orange-500" />{" "}
              {t("hunger")}
            </span>
            <span className="text-xs font-bold text-white shadow-black drop-shadow-md">
              {Math.floor(hunger)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. CORE ATTRIBUTES (Grid 2x2) */}
      <div className="grid grid-cols-2 gap-2 mt-1">
        {renderCoreCard(
          t("strength"),
          "strength",
          strData,
          <Sword />,
          "text-red-500",
        )}
        {renderCoreCard(
          t("dexterity"),
          "dexterity",
          dexData,
          <Crosshair />,
          "text-green-400",
        )}
        {renderCoreCard(
          t("intelligence"),
          "intelligence",
          intData,
          <Brain />,
          "text-purple-400",
        )}
        {renderCoreCard(
          t("reflex"),
          "reflex",
          refData,
          <Wind />,
          "text-blue-400",
        )}
      </div>

      {/* 3. WILLPOWER HIGHLIGHT (Improved UX) */}
      <div
        className="mt-4 bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded border border-purple-500/20 p-3 relative overflow-hidden shadow-lg shadow-purple-900/5 cursor-pointer hover:border-purple-500/40 transition-colors"
        onClick={() => onConditionClick?.("willpower")}
      >
        <div className="absolute inset-0 bg-purple-500/5 backdrop-blur-[1px]" />
        <div className="relative z-10 flex flex-col gap-2">
          <div className="flex justify-between items-center bg-black/20 p-1 rounded">
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase text-purple-200 tracking-widest pl-1">
              <Sparkles size={12} className="text-purple-400" />{" "}
              {t("willpower")}
            </span>
            <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/20">
              Tier {wpTier}
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-white/50 font-mono px-1">
            <span>
              XP: {Math.floor(wpExp)} / {wpTarget}
            </span>
            <span className="text-purple-300 font-bold">
              +{wpBonus}% {t("panel_all_stats" as any)}
            </span>
          </div>

          <ProgressBar
            value={wpExp}
            max={wpTarget}
            color="bg-purple-500"
            height="h-1.5"
            className="mt-0"
          />
        </div>
      </div>

      {/* 4. DERIVED STATS GRID (Clickable) */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {renderDetailRow(
          "dps",
          t("stats.dps" as any),
          dpsData.totalDPS,
          <Sword className="text-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />,
        )}
        {renderDetailRow(
          "cooldown",
          t("stats.cooldown" as any),
          `${dpsData.aps} APS`,
          <Zap className="text-yellow-400" />,
        )}
        {renderDetailRow(
          "attack",
          t("attack"),
          derived.attack,
          <Sword className="text-red-400" />,
        )}
        {renderDetailRow(
          "defense",
          t("defense"),
          derived.defense,
          <Shield className="text-blue-400" />,
        )}
        {renderDetailRow(
          "armor",
          t("armor"),
          derived.armor,
          <Shield className="text-slate-400" />,
        )}
        {renderDetailRow(
          "criticalChance",
          "Crit %",
          `${derived.critChance}%`,
          <Activity className="text-yellow-400" />,
        )}
        {renderDetailRow(
          "criticalDamage",
          "Crit Dmg",
          `${derived.critDmg}%`,
          <Activity className="text-orange-400" />,
        )}
        {renderDetailRow(
          "speed",
          t("speed"),
          derived.speed,
          <Wind className="text-cyan-400" />,
        )}
        {renderDetailRow(
          "capacity",
          "Weight",
          `${(ps.getCurrentWeight() / 100).toFixed(1)} / ${derived.capacity}`,
          <Box className="text-amber-700" />,
        )}
        {renderDetailRow(
          "starPoints",
          t("star_points" as any),
          starPoints,
          <Star className="text-yellow-400 fill-yellow-400" />,
        )}
      </div>
    </div>
  );
};
