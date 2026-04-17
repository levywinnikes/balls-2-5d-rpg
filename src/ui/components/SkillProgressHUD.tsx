import React, { useEffect, useState, useRef } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { StrengthXpTable } from "../../game/data/StrengthXpTable";
import { DexterityXpTable } from "../../game/data/DexterityXpTable";
import { ReflexXpTable } from "../../game/data/ReflexXpTable";
import { IntelligenceXpTable } from "../../game/data/IntelligenceXpTable";
import { useLanguage } from "../../context/LanguageContext";

type SkillType = "strength" | "dexterity" | "reflex" | "intelligence";

interface SkillUpdate {
  type: SkillType;
  label: string;
  level: number;
  progress: number;
  accumulatedXp: number;
  lastUpdated: number;
  isFadingOut?: boolean;
  colors: {
    bg: string;
    text: string;
  };
}

const SKILL_COLORS = {
  strength: { bg: "bg-rose-600", text: "text-rose-400" },
  dexterity: { bg: "bg-emerald-500", text: "text-emerald-400" },
  reflex: { bg: "bg-amber-500", text: "text-amber-400" },
  intelligence: { bg: "bg-blue-500", text: "text-blue-400" },
};

export const SkillProgressHUD: React.FC = () => {
  const { t } = useLanguage();
  const [activeSkills, setActiveSkills] = useState<SkillUpdate[]>([]);

  // Store previous XP to calculate gains
  const prevXp = useRef({
    strength: 0,
    dexterity: 0,
    reflex: 0,
    intelligence: 0,
  });

  useEffect(() => {
    const ps = PlayerState.getInstance();

    // Initialize base XP so we don't start with 0 and show 100% gain on the first hit
    prevXp.current = {
      strength: ps.getStrengthData().experience,
      dexterity: ps.getDexterityData().experience,
      reflex: ps.getReflexData().experience,
      intelligence: ps.getIntelligenceData().experience,
    };

    const handleXpGain = (
      type: SkillType,
      data: { level: number; experience: number },
      table: any,
      labelKey: string,
    ) => {
      const currentXp = data.experience;
      const previous = prevXp.current[type];
      const gained = Math.max(0, currentXp - previous);

      if (gained === 0) return;

      prevXp.current[type] = currentXp;
      const info = table.getLevelInfo(currentXp);

      setActiveSkills((prev) => {
        const existingIndex = prev.findIndex((s) => s.type === type);
        const now = Date.now();
        let newSkills = [...prev];

        if (existingIndex >= 0) {
          const existing = newSkills[existingIndex];
          // Update existing bar progress and accumulate XP
          newSkills[existingIndex] = {
            ...existing,
            level: info.level,
            progress: info.progress * 100,
            accumulatedXp: newSkills[existingIndex].accumulatedXp + gained,
            lastUpdated: now,
            isFadingOut: false,
          };

          // Removed splice/push to keep them in their original order as requested by user.
        } else {
          // Add new progressing skill
          newSkills.push({
            type,
            label: t(labelKey as any),
            level: info.level,
            progress: info.progress * 100,
            accumulatedXp: gained,
            lastUpdated: now,
            colors: SKILL_COLORS[type],
          });
        }

        return newSkills;
      });
    };

    const onStrength = (data: any) =>
      handleXpGain("strength", data, StrengthXpTable, "stats_strength");
    const onDexterity = (data: any) =>
      handleXpGain("dexterity", data, DexterityXpTable, "stats_dexterity");
    const onReflex = (data: any) =>
      handleXpGain("reflex", data, ReflexXpTable, "stats_reflex");
    const onIntelligence = (data: any) =>
      handleXpGain(
        "intelligence",
        data,
        IntelligenceXpTable,
        "stats_intelligence",
      );

    ps.on("strengthExperienceChanged", onStrength);
    ps.on("dexterityExperienceChanged", onDexterity);
    ps.on("reflexExperienceChanged", onReflex);
    ps.on("intelligenceExperienceChanged", onIntelligence);

    return () => {
      ps.off("strengthExperienceChanged", onStrength);
      ps.off("dexterityExperienceChanged", onDexterity);
      ps.off("reflexExperienceChanged", onReflex);
      ps.off("intelligenceExperienceChanged", onIntelligence);
    };
  }, [t]);

  // Timer to smoothly fade out inactive skills after 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveSkills((prev) => {
        let changed = false;
        const next = prev.map((s) => {
          if (now - s.lastUpdated >= 5000 && !s.isFadingOut) {
            changed = true;
            return { ...s, isFadingOut: true };
          }
          return s;
        });
        return changed ? next : prev;
      });
    }, 500); // Check every 500ms

    return () => clearInterval(interval);
  }, []);

  // Remove skills entirely from state after fade out completes
  useEffect(() => {
    const hasFading = activeSkills.some((s) => s.isFadingOut);
    if (hasFading) {
      const timeout = setTimeout(() => {
        setActiveSkills((prev) => prev.filter((s) => !s.isFadingOut));
      }, 500); // Wait for transition duration
      return () => clearTimeout(timeout);
    }
  }, [activeSkills]);

  return (
    <div className="flex flex-col gap-2 pointer-events-none transition-all duration-500 ease-out z-50">
      {activeSkills.map((skill) => {
        // We use opacity logic. The transition in css handles smooth enter/leave if we use react-transition-group,
        // but since we are removing it directly from array, the tailwind animate-in will animate its appearance.
        // To hide it, it simply unmounts. For a perfect disappear animation, we should probably
        // handle an exiting state, but a simple unmount is often acceptable.
        // The animate-in takes care of the fluid slide/fade on entry.

        return (
          <div
            key={skill.type}
            className={`flex flex-col w-56 bg-black/70 border border-white/20 rounded-md overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-500 ease-in-out
                            ${skill.isFadingOut ? "opacity-0 max-h-0 scale-95 border-b-0 m-0 shadow-none" : "opacity-100 max-h-24 scale-100 animate-in fade-in slide-in-from-right-8"}
                        `}
          >
            <div className="flex justify-between items-center px-2 py-1.5 text-[10px] font-bold text-white uppercase tracking-wider">
              <span className="text-white/80">
                {skill.label}{" "}
                <span className="text-white ml-1 text-xs">{skill.level}</span>
              </span>
              <span
                className={`${skill.colors.text} drop-shadow-md font-black`}
              >
                +{skill.accumulatedXp}
              </span>
            </div>
            {/* Progress Bar Container */}
            <div className="w-full h-1.5 bg-gray-900 border-t border-black/50 relative">
              {/* Bar Fill */}
              <div
                className={`h-full ${skill.colors.bg} relative transition-all duration-[800ms] ease-out shadow-[0_0_8px_currentColor]`}
                style={{
                  width: `${Math.max(0, Math.min(100, skill.progress))}%`,
                }}
              >
                {/* Glowing Tip */}
                <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/40 blur-[2px]" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
