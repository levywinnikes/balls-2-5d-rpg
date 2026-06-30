import React, { useEffect, useState } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { formatEnemyDisplayNameWithTranslator } from "../../game/i18n/formatEnemyDisplayName";
import { useLanguage } from "../../context/LanguageContext";

const MAX_BARS = 4;
const FADE_AFTER_MS = 5000;

export interface CombatEnemyHitPayload {
  uid: string;
  enemyType: string;
  health: number;
  maxHealth: number;
  damage: number;
  isFocused?: boolean;
}

export interface CombatFocusChangedPayload {
  uid: string | null;
  enemyType?: string;
  health?: number;
  maxHealth?: number;
}

export interface CombatEnemyHealthChangedPayload {
  uid: string;
  health: number;
  maxHealth: number;
}

interface EnemyHealthEntry {
  uid: string;
  enemyType: string;
  health: number;
  maxHealth: number;
  accumulatedDamage: number;
  lastUpdated: number;
  isFocused: boolean;
  isFadingOut?: boolean;
}

function reorderEntries(list: EnemyHealthEntry[]): EnemyHealthEntry[] {
  const focused = list.find((entry) => entry.isFocused);
  const others = list
    .filter((entry) => entry.uid !== focused?.uid)
    .sort((a, b) => b.lastUpdated - a.lastUpdated)
    .slice(0, focused ? MAX_BARS - 1 : MAX_BARS);

  if (focused) {
    return [{ ...focused, isFadingOut: false }, ...others];
  }
  return others;
}

export const CombatTargetHealthHUD: React.FC = () => {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<EnemyHealthEntry[]>([]);

  useEffect(() => {
    const ps = PlayerState.getInstance();

    const onHit = (payload: CombatEnemyHitPayload) => {
      if (!payload.uid || payload.damage <= 0) {
        return;
      }

      const now = Date.now();
      const isFocused = payload.isFocused === true;

      setEntries((prev) => {
        const next = [...prev];
        const index = next.findIndex((entry) => entry.uid === payload.uid);

        if (index >= 0) {
          const existing = next[index];
          next[index] = {
            ...existing,
            enemyType: payload.enemyType,
            health: payload.health,
            maxHealth: payload.maxHealth,
            accumulatedDamage: existing.accumulatedDamage + payload.damage,
            lastUpdated: now,
            isFocused: isFocused || existing.isFocused,
            isFadingOut: false,
          };
        } else {
          next.push({
            uid: payload.uid,
            enemyType: payload.enemyType,
            health: payload.health,
            maxHealth: payload.maxHealth,
            accumulatedDamage: payload.damage,
            lastUpdated: now,
            isFocused,
          });
        }

        if (isFocused) {
          next.forEach((entry) => {
            if (entry.uid !== payload.uid) {
              entry.isFocused = false;
            }
          });
        }

        return reorderEntries(next);
      });
    };

    const onFocusChanged = (payload: CombatFocusChangedPayload) => {
      setEntries((prev) => {
        const demoted = prev.map((entry) => ({
          ...entry,
          isFocused: false,
        }));

        if (!payload.uid) {
          return demoted;
        }

        const index = demoted.findIndex((entry) => entry.uid === payload.uid);
        const enemyType = payload.enemyType || "enemy";
        let focusedEntry: EnemyHealthEntry;

        if (index >= 0) {
          const existing = demoted[index];
          focusedEntry = {
            ...existing,
            enemyType,
            health: payload.health ?? existing.health,
            maxHealth: payload.maxHealth ?? existing.maxHealth,
            isFocused: true,
            isFadingOut: false,
          };
          demoted.splice(index, 1);
        } else {
          focusedEntry = {
            uid: payload.uid,
            enemyType,
            health: payload.health ?? 0,
            maxHealth: Math.max(1, payload.maxHealth ?? 1),
            accumulatedDamage: 0,
            lastUpdated: Date.now(),
            isFocused: true,
          };
        }

        const others = demoted
          .sort((a, b) => b.lastUpdated - a.lastUpdated)
          .slice(0, MAX_BARS - 1);

        return [focusedEntry, ...others];
      });
    };

    const onHealthChanged = (payload: CombatEnemyHealthChangedPayload) => {
      setEntries((prev) => {
        const index = prev.findIndex((entry) => entry.uid === payload.uid);
        if (index < 0) {
          return prev;
        }

        const existing = prev[index];
        if (
          existing.health === payload.health &&
          existing.maxHealth === payload.maxHealth
        ) {
          return prev;
        }

        const next = [...prev];
        next[index] = {
          ...existing,
          health: payload.health,
          maxHealth: payload.maxHealth,
        };
        return next;
      });
    };

    const onRemoved = (payload: { uid: string }) => {
      setEntries((prev) => prev.filter((entry) => entry.uid !== payload.uid));
    };

    ps.on("combatEnemyHit", onHit);
    ps.on("combatFocusChanged", onFocusChanged);
    ps.on("combatEnemyHealthChanged", onHealthChanged);
    ps.on("combatEnemyRemoved", onRemoved);

    return () => {
      ps.off("combatEnemyHit", onHit);
      ps.off("combatFocusChanged", onFocusChanged);
      ps.off("combatEnemyHealthChanged", onHealthChanged);
      ps.off("combatEnemyRemoved", onRemoved);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setEntries((prev) => {
        let changed = false;
        const next = prev.map((entry) => {
          if (
            entry.isFocused ||
            entry.isFadingOut ||
            now - entry.lastUpdated < FADE_AFTER_MS
          ) {
            return entry;
          }
          changed = true;
          return { ...entry, isFadingOut: true };
        });
        return changed ? next : prev;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const hasFading = entries.some((entry) => entry.isFadingOut);
    if (!hasFading) {
      return;
    }

    const timeout = setTimeout(() => {
      setEntries((prev) => prev.filter((entry) => !entry.isFadingOut));
    }, 500);

    return () => clearTimeout(timeout);
  }, [entries]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 pointer-events-none transition-all duration-500 ease-out z-[45]">
      {entries.map((entry) => {
        const hpPercent =
          entry.maxHealth > 0
            ? Math.max(0, Math.min(100, (entry.health / entry.maxHealth) * 100))
            : 0;
        const showCombo = entry.accumulatedDamage > 0;
        const name = formatEnemyDisplayNameWithTranslator(entry.enemyType, t);

        return (
          <div
            key={entry.uid}
            className={`flex flex-col w-56 bg-black/70 border rounded-md overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-500 ease-in-out
              ${
                entry.isFocused
                  ? "border-yellow-400/80 ring-2 ring-yellow-400/70"
                  : "border-red-900/40"
              }
              ${
                entry.isFadingOut
                  ? "opacity-0 max-h-0 scale-95 border-b-0 m-0 shadow-none"
                  : "opacity-100 max-h-24 scale-100 animate-in fade-in slide-in-from-left-8"
              }`}
          >
            <div className="flex justify-between items-center px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider">
              <span className="text-red-400/90 truncate pr-2">{name}</span>
              {showCombo && (
                <span className="text-red-400 drop-shadow-md font-black shrink-0">
                  -{entry.accumulatedDamage}
                </span>
              )}
            </div>
            <div className="w-full h-1.5 bg-gray-900 border-t border-black/50 relative">
              <div
                className="h-full bg-red-600 relative transition-all duration-[800ms] ease-out shadow-[0_0_8px_rgba(220,38,38,0.6)]"
                style={{ width: `${hpPercent}%` }}
              >
                <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/30 blur-[2px]" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
