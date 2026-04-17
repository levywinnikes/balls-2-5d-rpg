import React from "react";
import { StatManager } from "../../../game/systems/StatManager";
import { PlayerState } from "../../../game/entities/Player/PlayerState";
import { useLanguage } from "../../../context/LanguageContext";

interface StatDetailPanelProps {
  statKey: string;
  label: string;
}

export const StatDetailPanel: React.FC<StatDetailPanelProps> = ({
  statKey,
  label,
}) => {
  const { t } = useLanguage();
  const ps = PlayerState.getInstance();
  const sm = StatManager.getInstance();

  const result = sm.calculateStat(statKey, ps);

  // Helper to get star quality styling
  const getQualityStyles = (quality: string) => {
    switch (quality.toLowerCase()) {
      case "bronze":
        return "bg-amber-600/15 border-amber-500/40";
      case "silver":
        return "bg-slate-300/15 border-slate-400/40";
      case "gold":
        return "bg-yellow-500/15 border-yellow-400/40";
      case "diamond":
        return "bg-cyan-400/15 border-cyan-300/40";
      default:
        return "bg-white/5 border-white/5";
    }
  };

  // Calculate absolute contributions for PERCENT modifiers
  const baseValue = result.breakdown.base;
  const flatTotal = result.breakdown.sources
    .filter((m) => m.type === "FLAT" && m.category !== "base")
    .reduce((acc, m) => acc + m.value, 0);
  const subtotal = baseValue + flatTotal;

  // Enhance modifiers with absolute contribution
  const enhancedModifiers = result.breakdown.sources.map((mod) => {
    if (mod.type === "PERCENT") {
      const absoluteContribution = parseFloat(
        ((subtotal * mod.value) / 100).toFixed(2),
      );
      return { ...mod, absoluteContribution };
    }
    return mod;
  });

  return (
    <div className="h-full flex flex-col bg-black/60 rounded-xl p-4 border border-white/10">
      {/* Header */}
      <div className="border-b border-white/10 pb-3 mb-4">
        <div className="text-xs text-white/40 uppercase tracking-widest">
          {t("character_overview" as any)}
        </div>
        <div className="text-lg font-bold text-white mt-1">{label}</div>
      </div>

      {/* Total Value */}
      <div className="text-center py-6 bg-white/5 rounded-lg border border-white/5 mb-4">
        <div className="text-[10px] text-white/40 uppercase tracking-widest mb-2">
          {t("panel_total" as any)}
        </div>
        <div className="text-4xl font-bold text-blue-400">
          {result.finalValue}
        </div>
      </div>

      {/* Breakdown */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
        {/* Modifiers */}
        {enhancedModifiers.length > 0 ? (
          <div className="space-y-2">
            <div className="text-[10px] text-white/30 uppercase tracking-widest pl-1">
              {t("panel_modifiers" as any)}
            </div>
            {enhancedModifiers.map((mod: any, i: number) => {
              const qualityStyles = mod.quality
                ? getQualityStyles(mod.quality)
                : "bg-white/5 border-white/5";
              const absoluteText = mod.absoluteContribution
                ? ` (${mod.absoluteContribution})`
                : "";
              const categoryTranslated =
                t(`stat_category_${mod.category}` as any) || mod.category;

              return (
                <div
                  key={i}
                  className={`flex justify-between items-center text-sm p-3 rounded-lg border ${qualityStyles}`}
                >
                  <div className="flex flex-col">
                    <span className="text-white/80 font-medium">
                      {mod.source}
                    </span>
                    <span className="text-[9px] text-white/40 uppercase">
                      {categoryTranslated}
                    </span>
                  </div>
                  <div
                    className={`font-bold ${mod.value > 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {absoluteText && (
                      <span className="text-white/60 mr-1">{absoluteText}</span>
                    )}
                    {mod.value > 0 ? "+" : ""}
                    {mod.value}
                    {mod.type === "PERCENT" ? "%" : ""}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-sm text-white/30 italic py-6">
            {t("panel_no_modifiers" as any)}
          </div>
        )}

        {/* Global Multipliers */}
        {result.breakdown.globalMultipliers &&
          result.breakdown.globalMultipliers.length > 0 && (
            <div className="space-y-2 mt-3">
              <div className="text-[10px] text-purple-400/50 uppercase tracking-widest pl-1">
                {t("panel_multipliers" as any)}
              </div>
              {result.breakdown.globalMultipliers.map((mod: any, i: number) => {
                // Calculate absolute contribution for multipliers
                // The multiplier is applied to the subtotal after PERCENT bonuses
                const percentTotal = result.breakdown.sources
                  .filter((m) => m.type === "PERCENT")
                  .reduce((acc, m) => acc + m.value, 0);
                const afterPercent = subtotal * (1 + percentTotal / 100);
                const absoluteContribution = parseFloat(
                  (afterPercent * (mod.value - 1)).toFixed(2),
                );
                const categoryTranslated =
                  t(`stat_category_${mod.category}` as any) || mod.category;

                return (
                  <div
                    key={i}
                    className="flex justify-between items-center text-sm p-3 bg-purple-500/10 rounded-lg border border-purple-500/20"
                  >
                    <div className="flex flex-col">
                      <span className="text-purple-300 font-medium">
                        {mod.source}
                      </span>
                      <span className="text-[9px] text-purple-400/60 uppercase">
                        {categoryTranslated}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {absoluteContribution > 0 && (
                        <span className="text-white/60 text-sm">
                          ({absoluteContribution})
                        </span>
                      )}
                      <span className="font-bold text-purple-300">
                        x{mod.value.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
};
