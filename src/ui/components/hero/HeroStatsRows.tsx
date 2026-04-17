import React from "react";
import { Heart, Star, Shield, Sword, Zap, Weight } from "lucide-react";
import { usePlayerState } from "../../../hooks/usePlayerState";
import { PlayerState } from "../../../game/entities/Player/PlayerState";
import { StatusRowWithTooltip } from "../StatusRowWithTooltip";
import { XPTable } from "../../../game/data/XPTable";
import { useLanguage } from "../../../context/LanguageContext";
import { StatManager } from "../../../game/systems/StatManager";

// --- HELPERS ---
const getProgress = (current: number, table: any, lvl: number) => {
  const info = table.getLevelInfo(current);
  return (info.progress || 0) * 100;
};

// Helper to render detailed breakdown
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

// 1. LEVEL ROW
export const LevelRow = React.memo(() => {
  const ps = PlayerState.getInstance();
  const { t } = useLanguage();
  const level = usePlayerState(["levelUp", "reset"], () => ps.getLevel(), 1);
  const xp = usePlayerState("experienceChanged", () => ps.getExperience(), 0);

  return (
    <StatusRowWithTooltip
      label="Level"
      value={level}
      icon={<Star size={12} />}
      color="#fbbf24"
      progress={getProgress(xp, XPTable, level)}
      type="skill"
      customTooltip={{
        text: `${t("level")} ${level}`,
        subtext: (
          <>
            <div className="mb-1">{t("tooltip_level_info")}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
              <div className="text-red-400">
                {t("tooltip_bonus_hp").replace(
                  "{value}",
                  ((level - 1) * 5).toString(),
                )}
              </div>
              <div className="text-gray-400">
                {t("tooltip_bonus_cap").replace(
                  "{value}",
                  (level * 10).toString(),
                )}
              </div>
              <div className="text-yellow-400">
                {t("tooltip_bonus_speed").replace(
                  "{value}",
                  ((level - 1) * 4).toString(),
                )}
              </div>
              <div className="text-blue-400">
                {t("tooltip_bonus_memory").replace(
                  "{value}",
                  (level * 1).toString(),
                )}
              </div>
              <div className="text-orange-400 col-span-2">
                {t("tooltip_bonus_all_dmg").replace(
                  "{value}",
                  (level * 1).toFixed(0),
                )}
              </div>
            </div>
          </>
        ),
      }}
    />
  );
});

// 2. HEALTH ROW (VERY VOLATILE)
export const HealthRow = React.memo(() => {
  const ps = PlayerState.getInstance();
  const { t } = useLanguage();
  // Subscribes to health updates
  const hp = usePlayerState("healthChanged", () => ps.getHealth(), 100);
  const maxHp = usePlayerState(
    "maxHealthChanged",
    () => ps.getMaxHealth(),
    100,
  );

  return (
    <StatusRowWithTooltip
      label={t("hit_points")}
      value={`${Math.floor(hp)}/${maxHp}`}
      icon={<Heart size={12} />}
      color="#ef4444"
      progress={(hp / maxHp) * 100}
      customTooltip={{
        text: t("hit_points"),
        subtext: (
          <>
            <div className="mb-1">{t("tooltip_hp_info")}</div>
            <div className="text-gray-400 mt-1">{t("tooltip_regen_info")}</div>
          </>
        ),
      }}
    />
  );
});

// 3. CAP ROW
export const CapRow = React.memo(() => {
  const ps = PlayerState.getInstance();
  const { t } = useLanguage();

  // Cap depends on Level (handled by getCapacity logic usually, but listener on levelUp?)
  // Actually capacity is static per level unless modified.
  // getCapacity() calculation might need reactive update if level changes.
  // Inventory Weight changes on inventory update.
  const capacity = usePlayerState(
    ["levelUp", "reset", "buffStarted", "buffEnded"],
    () => ps.getCapacity(),
    100,
  );
  const currentWeight = usePlayerState(
    "inventoryUpdated",
    () => ps.getCurrentWeight(),
    0,
  );
  const freeCap = capacity - currentWeight;

  return (
    <StatusRowWithTooltip
      label="Cap"
      value={`${freeCap.toFixed(0)} oz`}
      icon={<Weight size={12} />}
      color="#9ca3af"
      progress={((capacity - currentWeight) / capacity) * 100}
      customTooltip={{
        text: t("capacity"),
        subtext: (
          <>
            <div className="mb-1">{t("tooltip_cap_info")}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
              <div className="text-gray-400">
                {t("tooltip_cap_total").replace("{value}", capacity.toString())}
              </div>
              <div className="text-gray-400">
                {t("tooltip_cap_used").replace(
                  "{value}",
                  currentWeight.toFixed(1),
                )}
              </div>
            </div>
          </>
        ),
      }}
    />
  );
});

// 4. Combat Stats (Atk, Def, Arm, Spd)
// These change less frequently (Equipment change, Buffs).
// Could be combined, but separate is fine.
export const AttackRow = React.memo(() => {
  const ps = PlayerState.getInstance();
  const { t } = useLanguage();
  // Re-check on equip/buff
  const val = usePlayerState(
    [
      "equipmentChanged",
      "buffStarted",
      "buffEnded",
      "levelUp",
      "strengthExperienceChanged",
      "dexterityExperienceChanged",
      "intelligenceExperienceChanged",
    ],
    () => ps.getTotalAttack(),
    10,
  );

  // For tooltip calculation, we need to ensure renderStatTooltip is reactive?
  // renderStatTooltip calls calculateStat(ps). If ps isn't changing, it's fine.
  // BUT calculateStat uses current PS state. Since this component re-renders on events, PS state is derived fresh.

  return (
    <StatusRowWithTooltip
      label={t("attack")}
      value={val}
      icon={<Sword size={12} />}
      color="#fb923c"
      customTooltip={{
        text: t("attack"),
        subtext: renderStatTooltip(
          t("attack"),
          "attack",
          <>
            <div className="mb-1">{t("tooltip_atk_info")}</div>
            <div className="text-xs text-gray-500 italic">
              {t("tooltip_affected_atk")}
            </div>
          </>,
          ps,
        ),
      }}
    />
  );
});

export const DefenseRow = React.memo(() => {
  const ps = PlayerState.getInstance();
  const { t } = useLanguage();
  const val = usePlayerState(
    [
      "equipmentChanged",
      "buffStarted",
      "buffEnded",
      "reflexExperienceChanged",
      "levelUp",
    ],
    () => ps.getTotalDefense(),
    0,
  );

  return (
    <StatusRowWithTooltip
      label={t("defense")}
      value={val}
      icon={<Shield size={12} />}
      color="#4ade80"
      customTooltip={{
        text: t("defense"),
        subtext: renderStatTooltip(
          t("defense"),
          "defense",
          <>
            <div className="mb-1">{t("tooltip_def_info")}</div>
            <div className="text-xs text-gray-500 italic">
              {t("tooltip_affected_def")}
            </div>
          </>,
          ps,
        ),
      }}
    />
  );
});

export const ArmorRow = React.memo(() => {
  const ps = PlayerState.getInstance();
  const { t } = useLanguage();
  const val = usePlayerState(
    ["equipmentChanged", "reset"],
    () => ps.getTotalArmor(),
    0,
  );

  return (
    <StatusRowWithTooltip
      label={t("armor")}
      value={val}
      icon={<Shield size={12} />}
      color="#94a3b8"
      customTooltip={{
        text: t("armor"),
        subtext: renderStatTooltip(
          t("armor"),
          "armor",
          <>
            <div className="mb-1">{t("tooltip_arm_info")}</div>
            <div className="text-xs text-gray-500 italic">
              {t("tooltip_sum_armor")}
            </div>
          </>,
          ps,
        ),
      }}
    />
  );
});

export const SpeedRow = React.memo(() => {
  const ps = PlayerState.getInstance();
  const { t } = useLanguage();
  const val = usePlayerState(
    ["equipmentChanged", "buffStarted", "buffEnded", "levelUp"],
    () => ps.getCurrentSpeed(),
    0,
  );

  return (
    <StatusRowWithTooltip
      label={t("speed")}
      value={val}
      icon={<Zap size={12} />}
      color="#facc15"
      customTooltip={{
        text: t("speed"),
        subtext: renderStatTooltip(
          t("speed"),
          "speed",
          <>
            <div className="mb-1">{t("tooltip_spd_info")}</div>
            <div className="text-xs text-gray-500 italic">
              {t("tooltip_affected_spd")}
            </div>
          </>,
          ps,
        ),
      }}
    />
  );
});
