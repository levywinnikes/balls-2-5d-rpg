import React from "react";
import { Sword, Crosshair, Brain, Shield, Utensils } from "lucide-react";
import { usePlayerState } from "../../../hooks/usePlayerState";
import { PlayerState } from "../../../game/entities/Player/PlayerState";
import { StatusRowWithTooltip } from "../StatusRowWithTooltip";
import { StrengthXpTable } from "../../../game/data/StrengthXpTable";
import { DexterityXpTable } from "../../../game/data/DexterityXpTable";
import { IntelligenceXpTable } from "../../../game/data/IntelligenceXpTable";
import { ReflexXpTable } from "../../../game/data/ReflexXpTable";
import { useLanguage } from "../../../context/LanguageContext";
import { StatManager } from "../../../game/systems/StatManager";

const getProgress = (current: number, table: any, lvl: number) => {
  const info = table.getLevelInfo(current);
  return (info.progress || 0) * 100;
};

// Helper: Needs to be duplicated or exported shared?
// Ideally shared, but for now copying to avoid circular deps if in HeroMenu.
const renderStatTooltip = (
  label: string,
  statName: string,
  derivedStats?: React.ReactNode,
  ps: PlayerState = PlayerState.getInstance(),
) => {
  const res = StatManager.getInstance().calculateStat(statName, ps);
  return (
    <>
      <div className="mb-1 font-bold">
        {label}: <span className="text-white">{res.finalValue}</span>
      </div>
      <div className="flex flex-col gap-0.5 text-xs text-gray-400 mb-2">
        <div className="flex justify-between">
          <span>Base:</span>
          <span>{res.breakdown.base}</span>
        </div>
        {res.breakdown.sources
          .filter((s) => s.category !== "base")
          .map((s, i) => (
            <div key={i} className="flex justify-between text-yellow-100/70">
              <span>+ {s.source}:</span>
              <span>{s.type === "PERCENT" ? `${s.value}%` : s.value}</span>
            </div>
          ))}
      </div>
      {derivedStats && (
        <div className="border-t border-white/20 pt-1 mt-1">{derivedStats}</div>
      )}
    </>
  );
};

// Helper to get specific bonus value from StatManager
const getStatBonus = (
  targetStat: string,
  sourceFragment: string,
  ps: PlayerState,
) => {
  const res = StatManager.getInstance().calculateStat(targetStat, ps);
  const mod = res.breakdown.sources.find((s) =>
    s.source.includes(sourceFragment),
  );
  return mod ? mod.value : 0;
};

// SKILLS
export const StrengthRow = React.memo(() => {
  const ps = PlayerState.getInstance();
  const { t } = useLanguage();
  const val = usePlayerState(
    "strengthExperienceChanged",
    () => ps.getStrengthLevel(),
    1,
  );
  const exp = usePlayerState(
    "strengthExperienceChanged",
    () => ps.getStrengthExperience(),
    0,
  );

  return (
    <StatusRowWithTooltip
      label={t("strength")}
      value={val}
      icon={<Sword size={12} />}
      color="#f87171"
      progress={getProgress(exp, StrengthXpTable, val)}
      type="skill"
      customTooltip={{
        text: `${t("strength")}`,
        subtext: renderStatTooltip(
          t("strength"),
          "strength",
          <div className="grid grid-cols-1 gap-0.5 mt-1 text-xs">
            <div className="text-red-400">
              {t("tooltip_bonus_melee").replace(
                "{value}",
                getStatBonus("attack", "Strength Bonus", ps).toFixed(1),
              )}
            </div>
            <div className="text-amber-400">
              {t("tooltip_bonus_crit_dmg").replace(
                "{value}",
                (val * 1).toFixed(0),
              )}
            </div>
          </div>,
          ps,
        ),
      }}
    />
  );
});

export const DexterityRow = React.memo(() => {
  const ps = PlayerState.getInstance();
  const { t } = useLanguage();
  const val = usePlayerState(
    "dexterityExperienceChanged",
    () => ps.getDexterityLevel(),
    1,
  );
  const exp = usePlayerState(
    "dexterityExperienceChanged",
    () => ps.getDexterityExperience(),
    0,
  );

  return (
    <StatusRowWithTooltip
      label={t("dexterity")}
      value={val}
      icon={<Crosshair size={12} />}
      color="#34d399"
      progress={getProgress(exp, DexterityXpTable, val)}
      type="skill"
      customTooltip={{
        text: `${t("dexterity")}`,
        subtext: renderStatTooltip(
          t("dexterity"),
          "dexterity",
          <div className="grid grid-cols-1 gap-0.5 mt-1 text-xs">
            <div className="text-green-400">
              {t("tooltip_bonus_ranged").replace(
                "{value}",
                getStatBonus("attack", "Dexterity Bonus", ps).toFixed(1),
              )}
            </div>
            <div className="text-yellow-400">
              {t("tooltip_bonus_crit_chance").replace(
                "{value}",
                StatManager.getInstance()
                  .getCriticalChance(ps)
                  .finalValue.toFixed(1),
              )}
            </div>
          </div>,
          ps,
        ),
      }}
    />
  );
});

export const IntelligenceRow = React.memo(() => {
  const ps = PlayerState.getInstance();
  const { t } = useLanguage();
  const val = usePlayerState(
    "intelligenceExperienceChanged",
    () => ps.getIntelligenceLevel(),
    1,
  );
  const exp = usePlayerState(
    "intelligenceExperienceChanged",
    () => ps.getIntelligenceExperience(),
    0,
  );

  return (
    <StatusRowWithTooltip
      label={t("intelligence")}
      value={val}
      icon={<Brain size={12} />}
      color="#a78bfa"
      progress={getProgress(exp, IntelligenceXpTable, val)}
      type="skill"
      customTooltip={{
        text: `${t("intelligence")}`,
        subtext: renderStatTooltip(
          t("intelligence"),
          "intelligence",
          <div className="grid grid-cols-1 gap-0.5 mt-1 text-xs">
            <div className="text-purple-400">
              {t("tooltip_bonus_magic").replace(
                "{value}",
                getStatBonus("attack", "Intelligence Bonus", ps).toFixed(1),
              )}
            </div>
            <div className="text-blue-400">
              {t("tooltip_bonus_memory").replace(
                "{value}",
                getStatBonus("memory", "Intelligence Bonus", ps).toFixed(0),
              )}
            </div>
          </div>,
          ps,
        ),
      }}
    />
  );
});

export const ReflexRow = React.memo(() => {
  const ps = PlayerState.getInstance();
  const { t } = useLanguage();
  const val = usePlayerState(
    "reflexExperienceChanged",
    () => ps.getReflexLevel(),
    1,
  );
  const exp = usePlayerState(
    "reflexExperienceChanged",
    () => ps.getReflexExperience(),
    0,
  );

  return (
    <StatusRowWithTooltip
      label={t("reflex")}
      value={val}
      icon={<Shield size={12} />}
      color="#60a5fa"
      progress={getProgress(exp, ReflexXpTable, val)}
      type="skill"
      customTooltip={{
        text: `${t("reflex")}`,
        subtext: renderStatTooltip(
          t("reflex"),
          "reflex",
          <div className="text-blue-300 text-xs mt-1">
            {t("tooltip_bonus_defense").replace(
              "{value}",
              getStatBonus("defense", "Reflex Bonus", ps).toFixed(1),
            )}
          </div>,
          ps,
        ),
      }}
    />
  );
});

// CONDITIONS
export const HungerRow = React.memo(() => {
  const ps = PlayerState.getInstance();
  const { t } = useLanguage();
  const hunger = usePlayerState(
    ["hungerUpdated", "reset"],
    () => ps.getHunger(),
    1000,
  );

  return (
    <StatusRowWithTooltip
      label={t("hunger")}
      value={`${Math.ceil(hunger / 10)}%`}
      icon={<Utensils size={12} />}
      color="#fb923c"
      progress={(hunger / 1000) * 100}
      customTooltip={{
        text: `${t("hunger")}`,
        subtext: (
          <>
            <div className="mb-1">{t("hunger_desc")}</div>
            <div className="text-orange-300 text-xs mt-1">
              {t("tooltip_hunger_effect").replace(
                "{value}",
                (1 + (hunger > 900 ? 5 : 0)).toString(),
              )}
            </div>
          </>
        ),
      }}
    />
  );
});

export const WillpowerRow = React.memo(() => {
  const ps = PlayerState.getInstance();
  const { t } = useLanguage();
  const willpowerTier = usePlayerState(
    ["willpowerUpdated", "reset", "levelUp"],
    () => ps.getWillpowerTier(),
    0,
  );
  const wExp = usePlayerState(
    "willpowerUpdated",
    () => ps.getWillpowerExp(),
    0,
  );
  const wTarget = usePlayerState(
    "willpowerUpdated",
    () => ps.getWillpowerTarget(),
    100,
  );

  return (
    <StatusRowWithTooltip
      label={t("willpower")}
      value={`Tier ${willpowerTier}`}
      icon={<Brain size={12} />}
      color="#c084fc"
      progress={(wExp / wTarget) * 100}
      customTooltip={{
        text: `${t("willpower")}`,
        subtext: (
          <>
            <div className="mb-1">{t("tooltip_wp_effect")}</div>
            <div className="text-purple-300 font-bold mt-1 text-xs">
              {t("tooltip_wp_current").replace(
                "{value}",
                StatManager.getInstance()
                  .getWillpowerBonusPercent(ps)
                  .toString(),
              )}
            </div>
          </>
        ),
      }}
    />
  );
});
