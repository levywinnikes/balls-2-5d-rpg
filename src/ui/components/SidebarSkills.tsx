import React from "react";
import { usePlayerState } from "../../hooks/usePlayerState";
import {
  PlayerState,
  SkillState,
} from "../../game/entities/Player/PlayerState";
import { useUI } from "../../context/UIContext";
import { useLanguage } from "../../context/LanguageContext";
import { XPTable } from "../../game/data/XPTable";
import { StrengthXpTable } from "../../game/data/StrengthXpTable";
import { DexterityXpTable } from "../../game/data/DexterityXpTable";
import { ReflexXpTable } from "../../game/data/ReflexXpTable";
import { IntelligenceXpTable } from "../../game/data/IntelligenceXpTable";
import {
  Sword,
  Shield,
  Crosshair,
  Star,
  Zap,
  Utensils,
  Brain,
} from "lucide-react";
import { ProgressBar } from "./ProgressBar";

const SkillRow: React.FC<{
  label: string;
  value: number;
  percent: number;
  icon: React.ReactNode;
  color: string;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}> = ({ label, value, percent, icon, color, onMouseEnter, onMouseLeave }) => (
  <div className="mb-2" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
    <div className="flex items-center justify-between text-[11px] text-[#aaa]">
      <div className="flex items-center gap-1.5">
        <div style={{ color }}>{icon}</div>
        <span>{label}</span>
      </div>
      <span style={{ color }} className="font-bold">
        {value}
      </span>
    </div>
    <ProgressBar value={percent} max={100} color={color} height="h-1" />
  </div>
);

export const SidebarSkills: React.FC = () => {
  const playerState = PlayerState.getInstance();
  const { t } = useLanguage();
  const { scale, showTooltip, hideTooltip } = useUI();

  // Hooks for data
  const levelData = usePlayerState(
    ["experienceChanged", "levelUp", "reset"],
    () => ({
      level: playerState.getLevel(),
      percent: XPTable.getLevelInfo(playerState.getExperience()).progress * 100,
    }),
    { level: 1, percent: 0 },
  );

  const strengthData = usePlayerState(
    "strengthExperienceChanged",
    () => ({
      level: playerState.getStrengthLevel(),
      percent:
        StrengthXpTable.getLevelInfo(playerState.getStrengthExperience())
          .progress * 100,
    }),
    { level: 1, percent: 0 },
  );

  const dexterityData = usePlayerState(
    "dexterityExperienceChanged",
    () => ({
      level: playerState.getDexterityLevel(),
      percent:
        DexterityXpTable.getLevelInfo(playerState.getDexterityExperience())
          .progress * 100,
    }),
    { level: 1, percent: 0 },
  );

  const reflexData = usePlayerState(
    "reflexExperienceChanged",
    () => ({
      level: playerState.getReflexLevel(),
      percent:
        ReflexXpTable.getLevelInfo(playerState.getReflexExperience()).progress *
        100,
    }),
    { level: 1, percent: 0 },
  );

  const intelligenceData = usePlayerState(
    "intelligenceExperienceChanged",
    () => ({
      level: playerState.getIntelligenceLevel(),
      percent:
        IntelligenceXpTable.getLevelInfo(
          playerState.getIntelligenceExperience(),
        ).progress * 100,
    }),
    { level: 1, percent: 0 },
  );

  const stats = {
    atk: usePlayerState(
      [
        "equipmentChanged",
        "strengthExperienceChanged",
        "dexterityExperienceChanged",
        "levelUp",
      ],
      () => playerState.getTotalAttack(),
      10,
    ),
    def: usePlayerState(
      ["equipmentChanged", "reflexExperienceChanged", "levelUp"],
      () => playerState.getTotalDefense(),
      0,
    ),
    armor: usePlayerState(
      ["equipmentChanged", "levelUp"],
      () => playerState.getTotalArmor(),
      0,
    ),
    speed: usePlayerState(
      ["equipmentChanged", "willpowerUpdated", "levelUp"],
      () => playerState.getCurrentSpeed(),
      100,
    ),
    capacity: usePlayerState(["levelUp"], () => playerState.getCapacity(), 400),
    currentWeight: usePlayerState(
      "inventoryUpdated",
      () => playerState.getCurrentWeight(),
      0,
    ),
  };

  const willpowerData = usePlayerState(
    ["willpowerUpdated", "reset", "levelUp"],
    () => ({
      tier: playerState.getWillpowerTier(),
      unlocked: playerState.getLevel() >= 2,
    }),
    { tier: 0, unlocked: false },
  );

  const hunger = usePlayerState(
    ["hungerUpdated", "reset"],
    () => playerState.getHunger(),
    1000,
  );

  return (
    <div className="flex flex-col p-2 h-full overflow-y-auto custom-scrollbar">
      {/* Level */}
      <div className="mb-3">
        <SkillRow
          label={t("level")}
          value={levelData.level}
          percent={levelData.percent}
          color="#fbbf24"
          icon={<Star size={12 * scale} />}
          onMouseEnter={(e) =>
            showTooltip({
              text: t("level"),
              subtext: `${t("experience")}: ${playerState.getExperience()}\n${t("tooltip_next" as any)}: ${Math.ceil(XPTable.getXPRequiredForLevel(levelData.level + 1))}`,
              x: e.clientX,
              y: e.clientY,
            })
          }
          onMouseLeave={hideTooltip}
        />
        <div className="text-[9px] text-[#666] text-right -mt-1 mb-1 pr-1">
          {levelData.level * 100 - levelData.percent}{" "}
          {t("tooltip_xp_to_next" as any)}
        </div>
      </div>

      {/* Combat Skills */}
      {/* Combat Skills */}
      <SkillRow
        label={t("strength")}
        value={strengthData.level}
        percent={strengthData.percent}
        color="#f87171"
        icon={<Sword size={12 * scale} />}
        onMouseEnter={(e) =>
          showTooltip({
            text: t("strength"),
            subtext: `${t("level")} ${strengthData.level}\n${t("tooltip_progress" as any)}: ${strengthData.percent.toFixed(1)}%`,
            x: e.clientX,
            y: e.clientY,
          })
        }
        onMouseLeave={hideTooltip}
      />
      <SkillRow
        label={t("dexterity")}
        value={dexterityData.level}
        percent={dexterityData.percent}
        color="#34d399"
        icon={<Crosshair size={12 * scale} />}
        onMouseEnter={(e) =>
          showTooltip({
            text: t("dexterity"),
            subtext: `${t("level")} ${dexterityData.level}\n${t("tooltip_progress" as any)}: ${dexterityData.percent.toFixed(1)}%`,
            x: e.clientX,
            y: e.clientY,
          })
        }
        onMouseLeave={hideTooltip}
      />
      <SkillRow
        label={t("reflex")}
        value={reflexData.level}
        percent={reflexData.percent}
        color="#60a5fa"
        icon={<Shield size={12 * scale} />}
        onMouseEnter={(e) =>
          showTooltip({
            text: t("reflex"),
            subtext: `${t("level")} ${reflexData.level}\n${t("tooltip_progress" as any)}: ${reflexData.percent.toFixed(1)}%`,
            x: e.clientX,
            y: e.clientY,
          })
        }
        onMouseLeave={hideTooltip}
      />
      <SkillRow
        label={t("intelligence")}
        value={intelligenceData.level}
        percent={intelligenceData.percent}
        color="#a78bfa"
        icon={<Brain size={12 * scale} />}
        onMouseEnter={(e) =>
          showTooltip({
            text: t("intelligence"),
            subtext: `${t("level")} ${intelligenceData.level}\n${t("tooltip_progress" as any)}: ${intelligenceData.percent.toFixed(1)}%`,
            x: e.clientX,
            y: e.clientY,
          })
        }
        onMouseLeave={hideTooltip}
      />

      <div className="h-px bg-[#333] my-2" />

      {/* Combat Totals with Detailed Tooltips */}
      <div className="grid grid-cols-2 gap-y-2 gap-x-1 text-[10px] text-[#aaa] mb-2">
        {/* ATTACK / MAGIC DMG */}
        <div
          className="flex items-center gap-1.5"
          onMouseEnter={(e) => {
            const weapon = playerState.getEquippedWeapon();
            const baseDmg = weapon ? weapon.damage : 5;
            const levelBonusPct = playerState.getLevel() - 1;

            let skillBonusPct = 0;
            let isMagic = false;

            if (weapon?.element === "fire") {
              skillBonusPct = playerState.getIntelligenceLevel() * 5;
              isMagic = true;
            } else if (!weapon || weapon.type === "melee") {
              skillBonusPct = playerState.getStrengthLevel() * 5;
            } else if (weapon.type === "ranged") {
              skillBonusPct = playerState.getDexterityLevel() * 5;
            }

            const wpBonusPct = playerState.getWillpowerBonusPercent();

            const base = baseDmg;
            const valFromLevel = Math.floor(base * (levelBonusPct / 100));
            const valFromSkill = Math.floor(base * (skillBonusPct / 100));

            const subtotal = base + valFromLevel + valFromSkill;

            const wpMultiplier = wpBonusPct / 100;
            const valFromWp = Math.floor(subtotal * wpMultiplier);

            const tooltipContent = (
              <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[10px]">
                <span className="text-gray-400">{t("tooltip_base")}:</span>
                <span className="text-right text-white">{base}</span>

                <span className="text-gray-400">
                  {t("tooltip_level_bonus")}:
                </span>
                <div className="text-right">
                  <span className="text-white">+{valFromLevel}</span>
                  <span className="text-gray-500 ml-1">({levelBonusPct}%)</span>
                </div>

                <span className="text-gray-400">
                  {t("tooltip_skill_bonus")}:
                </span>
                <div className="text-right">
                  <span className="text-white">+{valFromSkill}</span>
                  <span className="text-gray-500 ml-1">({skillBonusPct}%)</span>
                </div>

                <div className="col-span-2 h-px bg-gray-600 my-0.5" />
                <span className="text-gray-500 italic">
                  {t("tooltip_subtotal")}
                </span>
                <span className="text-right text-gray-300">{subtotal}</span>

                <span className="text-purple-400">
                  {t("tooltip_willpower_bonus")}:
                </span>
                <div className="text-right">
                  <span className="text-purple-400">+{valFromWp}</span>
                  <span className="text-gray-500 ml-1">({wpBonusPct}%)</span>
                </div>

                <div className="col-span-2 h-px bg-gray-600 my-0.5" />
                <span
                  className={`font-bold ${isMagic ? "text-purple-400" : "text-orange-400"}`}
                >
                  {t("tooltip_total")}:
                </span>
                <span
                  className={`font-bold ${isMagic ? "text-purple-400" : "text-orange-400"} text-right`}
                >
                  {stats.atk}
                </span>
              </div>
            );

            showTooltip({
              text: isMagic ? t("magic_damage" as any) : t("attack"),
              subtext: tooltipContent,
              x: e.clientX,
              y: e.clientY,
            });
          }}
          onMouseLeave={hideTooltip}
        >
          {playerState.getEquippedWeapon()?.element === "fire" ? (
            <Star size={12 * scale} className="text-purple-400" />
          ) : (
            <Sword size={12 * scale} className="text-orange-400" />
          )}
          <span
            className={
              playerState.getEquippedWeapon()?.element === "fire"
                ? "text-purple-400"
                : ""
            }
          >
            {playerState.getEquippedWeapon()?.element === "fire"
              ? t("magic_damage" as any)
              : t("attack")}
          </span>
        </div>
        <span
          className={`font-bold text-right ${playerState.getEquippedWeapon()?.element === "fire" ? "text-purple-400" : "text-orange-400"}`}
        >
          {stats.atk}
        </span>

        {/* DEFENSE */}
        <div
          className="flex items-center gap-1.5"
          onMouseEnter={(e) => {
            const weaponDefense = playerState.getEquippedWeapon()?.defense || 0;
            const shieldDefense = playerState.getEquippedShield()?.defense || 0;
            const baseDefense = weaponDefense + shieldDefense;
            const levelBonusPct = playerState.getLevel(); // 1%
            const skillBonusPct = playerState.getReflexLevel() * 5;
            const wpBonusPct = playerState.getWillpowerBonusPercent();

            const base = baseDefense;
            const valFromLevel = Math.floor(base * (levelBonusPct / 100));
            const valFromSkill = Math.floor(base * (skillBonusPct / 100));
            const subtotal = base + valFromLevel + valFromSkill;
            const wpMultiplier = wpBonusPct / 100;
            const valFromWp = Math.floor(subtotal * wpMultiplier);

            const tooltipContent = (
              <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[10px]">
                <span className="text-gray-400">{t("tooltip_base")}:</span>
                <span className="text-right text-white">{base}</span>

                <span className="text-gray-400">
                  {t("tooltip_level_bonus")}:
                </span>
                <div className="text-right">
                  <span className="text-white">+{valFromLevel}</span>
                  <span className="text-gray-500 ml-1">({levelBonusPct}%)</span>
                </div>

                <span className="text-gray-400">
                  {t("tooltip_skill_bonus")}:
                </span>
                <div className="text-right">
                  <span className="text-white">+{valFromSkill}</span>
                  <span className="text-gray-500 ml-1">({skillBonusPct}%)</span>
                </div>

                <div className="col-span-2 h-px bg-gray-700 my-0.5" />
                <span className="text-gray-500 italic">
                  {t("tooltip_subtotal")}
                </span>
                <span className="text-right text-gray-300">{subtotal}</span>

                <span className="text-purple-400">
                  {t("tooltip_willpower_bonus")}:
                </span>
                <div className="text-right">
                  <span className="text-purple-400">+{valFromWp}</span>
                  <span className="text-gray-500 ml-1">({wpBonusPct}%)</span>
                </div>

                <div className="col-span-2 h-px bg-gray-600 my-0.5" />
                <span className="font-bold text-green-400">
                  {t("tooltip_total")}:
                </span>
                <span className="font-bold text-green-400 text-right">
                  {stats.def}
                </span>
              </div>
            );
            showTooltip({
              text: t("defense"),
              subtext: tooltipContent,
              x: e.clientX,
              y: e.clientY,
            });
          }}
          onMouseLeave={hideTooltip}
        >
          <Shield size={12 * scale} className="text-green-400" />
          <span>{t("defense")}</span>
        </div>
        <span className="font-bold text-green-400 text-right">{stats.def}</span>

        {/* ARMOR */}
        <div
          className="flex items-center gap-1.5"
          onMouseEnter={(e) => {
            const wpBonusPct = playerState.getWillpowerBonusPercent();
            const multiplier = 1 + wpBonusPct / 100;
            const rawArmor = Math.round(stats.armor / multiplier);
            const valFromWp = stats.armor - rawArmor;

            const tooltipContent = (
              <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[10px]">
                <span className="text-gray-400">{t("tooltip_base")}:</span>
                <span className="text-right text-white">{rawArmor}</span>

                <div className="col-span-2 h-px bg-gray-700 my-0.5" />
                <span className="text-gray-500 italic">Subtotal:</span>
                <span className="text-right text-gray-300">{rawArmor}</span>

                <span className="text-purple-400">
                  {t("tooltip_willpower_bonus")}:
                </span>
                <div className="text-right">
                  <span className="text-purple-400">+{valFromWp}</span>
                  <span className="text-gray-500 ml-1">({wpBonusPct}%)</span>
                </div>

                <div className="col-span-2 h-px bg-gray-600 my-0.5" />
                <span className="font-bold text-slate-300">
                  {t("tooltip_total")}:
                </span>
                <span className="font-bold text-slate-300 text-right">
                  {stats.armor}
                </span>
              </div>
            );
            showTooltip({
              text: t("armor"),
              subtext: tooltipContent,
              x: e.clientX,
              y: e.clientY,
            });
          }}
          onMouseLeave={hideTooltip}
        >
          <Shield size={12 * scale} className="text-slate-400" />
          <span>{t("armor")}</span>
        </div>
        <span className="font-bold text-slate-400 text-right">
          {stats.armor}
        </span>

        {/* SPEED */}
        <div
          className="flex items-center gap-1.5"
          onMouseEnter={(e) => {
            const baseSpeed = playerState.getBaseSpeed();
            const levelBonus = (playerState.getLevel() - 1) * 8;
            const wpBonusPct = playerState.getWillpowerBonusPercent();
            const subtotal = baseSpeed + levelBonus;
            const wpBonusVal = Math.floor(subtotal * (wpBonusPct / 100));

            const tooltipContent = (
              <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[10px]">
                <span className="text-gray-400">{t("tooltip_base")}:</span>
                <span className="text-right text-white">{baseSpeed}</span>

                <span className="text-gray-400">
                  {t("tooltip_level_bonus")}:
                </span>
                <div className="text-right">
                  <span className="text-white">+{levelBonus}</span>
                </div>

                <div className="col-span-2 h-px bg-gray-700 my-0.5" />
                <span className="text-gray-500 italic">Subtotal:</span>
                <span className="text-right text-gray-300">{subtotal}</span>

                <span className="text-purple-400">
                  {t("tooltip_willpower_bonus")}:
                </span>
                <div className="text-right">
                  <span className="text-purple-400">+{wpBonusVal}</span>
                  <span className="text-gray-500 ml-1">({wpBonusPct}%)</span>
                </div>

                <div className="col-span-2 h-px bg-gray-600 my-0.5" />
                <span className="font-bold text-yellow-400">
                  {t("tooltip_total")}:
                </span>
                <span className="font-bold text-yellow-400 text-right">
                  {stats.speed}
                </span>
              </div>
            );
            showTooltip({
              text: t("speed"),
              subtext: tooltipContent,
              x: e.clientX,
              y: e.clientY,
            });
          }}
          onMouseLeave={hideTooltip}
        >
          <Zap size={12 * scale} className="text-yellow-400" />
          <span>{t("speed")}</span>
        </div>
        <span className="font-bold text-yellow-400 text-right">
          {stats.speed}
        </span>
      </div>

      <div className="h-px bg-[#333] my-2" />

      {/* Hunger & Willpower */}
      <div className="flex flex-col gap-2 mb-2">
        {/* Hunger */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-[#aaa]">
            <div className="flex items-center gap-1.5">
              <Utensils size={12 * scale} className="text-yellow-500" />
              <span>{t("hunger")}</span>
            </div>
            <span className="text-yellow-500 font-bold">
              {Math.min(100, Math.floor(Math.min(1000, hunger) / 10))} / 100
            </span>
          </div>
          <div className="flex gap-0.5 w-full h-1.5">
            {[...Array(10)].map((_, i) => {
              const start = i * 100;
              const end = (i + 1) * 100;
              const visibleHunger = Math.min(1000, hunger);
              let fillPct = 0;
              if (visibleHunger >= end) fillPct = 100;
              else if (visibleHunger <= start) fillPct = 0;
              else fillPct = ((visibleHunger - start) / 100) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 h-full bg-[#222] border-r border-[#111] last:border-0 relative overflow-hidden rounded-[1px]"
                  onMouseEnter={(e) => {
                    const regenBonus = ((i + 1) * 0.2).toFixed(1);
                    showTooltip({
                      text: `${t("hunger_tier")} ${i + 1}`,
                      subtext: `${t("hunger_regen")}: +${regenBonus}% HP`,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  onMouseLeave={hideTooltip}
                >
                  <div
                    style={{ width: `${fillPct}%` }}
                    className="h-full bg-yellow-500 transition-all duration-300"
                  />
                </div>
              );
            })}
          </div>
          {/* Stock Bar (1001-2000) */}
          {hunger > 1000 && (
            <div
              className="w-full h-1 bg-[#222] border border-[#333] rounded overflow-hidden"
              onMouseEnter={(e) => {
                showTooltip({
                  text: t("hunger_stock"),
                  subtext: `${t("hunger_stock_desc")}: ${hunger - 1000} / 1000`,
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
              onMouseLeave={hideTooltip}
            >
              <div
                style={{
                  width: `${((hunger - 1000) / 1000) * 100}%`,
                  height: "100%",
                  backgroundColor: "#34d399", // Green for stock
                  transition: "width 0.3s ease-out",
                }}
              />
            </div>
          )}
        </div>

        {/* Willpower (Updated to 10-Segment view like CharacterUI) */}
        {willpowerData.unlocked && (
          <div
            className="flex flex-col gap-1"
            onMouseEnter={(e) => {
              const wpBonus = playerState.getWillpowerBonusPercent();
              showTooltip({
                text: t("willpower"),
                subtext: `${t("willpower_desc")}\n${t("tooltip_willpower_bonus")}: +${wpBonus}%`,
                x: e.clientX,
                y: e.clientY,
              });
            }}
            onMouseLeave={hideTooltip}
          >
            <div className="flex items-center justify-between text-[10px] text-[#aaa]">
              <div className="flex items-center gap-1.5">
                <Zap size={12 * scale} className="text-purple-500" />
                <span>{t("willpower")}</span>
              </div>
              <span className="text-purple-500 font-bold">
                {t("rank")} {willpowerData.tier}
              </span>
            </div>

            <div className="flex gap-0.5 w-full h-1.5">
              {[...Array(10)].map((_, i) => {
                const xpPerTier = playerState.getWillpowerTarget() / 10;
                const segmentStart = i * xpPerTier;
                const segmentEnd = (i + 1) * xpPerTier;
                const wExp = playerState.getWillpowerExp();

                let fillPct = 0;
                if (wExp >= segmentEnd) fillPct = 100;
                else if (wExp <= segmentStart) fillPct = 0;
                else fillPct = ((wExp - segmentStart) / xpPerTier) * 100;

                const needed = Math.max(0, segmentEnd - wExp).toFixed(0);

                return (
                  <div
                    key={i}
                    className="flex-1 h-full bg-[#222] border-r border-[#111] last:border-0 relative overflow-hidden rounded-[1px]"
                    onMouseEnter={(e) => {
                      e.stopPropagation(); // Avoid triggering parent tooltip
                      showTooltip({
                        text: `Tier ${i + 1}`,
                        subtext:
                          fillPct === 100
                            ? "Completed"
                            : `XP: ${Math.floor(Math.max(0, wExp - segmentStart))}/${Math.floor(xpPerTier)}\nRemaining: ${needed}`,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    onMouseLeave={hideTooltip}
                  >
                    <div
                      style={{ width: `${fillPct}%` }}
                      className="h-full bg-purple-500 transition-all duration-300"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
