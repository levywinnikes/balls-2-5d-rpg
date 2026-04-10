import React, { useEffect, useState } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { t_game } from "../../game/i18n/translations";
import { AudioManager } from "../../game/systems/AudioManager";

export type LevelUpNotifType = "level" | "strength" | "dexterity" | "reflex" | "intelligence";

interface NotificationItem {
  type: LevelUpNotifType;
  level: number;
}

export const LevelUpNotification: React.FC = () => {
  const [queue, setQueue] = useState<NotificationItem[]>([]);
  const [current, setCurrent] = useState<NotificationItem | null>(null);
  const [animState, setAnimState] = useState<"hidden" | "in" | "hold" | "out">("hidden");

  useEffect(() => {
    const handleEvent = (data: NotificationItem) => {
       setQueue(prev => [...prev, data]);
    };

    const ps = PlayerState.getInstance();
    ps.on("skyrimSkillUp", handleEvent);
    return () => { ps.off("skyrimSkillUp", handleEvent); };
  }, []);

  // Process Queue
  useEffect(() => {
    if (!current && queue.length > 0) {
        const next = queue[0];
        setQueue(prev => prev.slice(1));
        setCurrent(next);
        // Do not set "in" yet. Let it render as hidden first.
    }
  }, [current, queue]);

  // Trigger Entry Animation (when current changes and we are hidden)
  useEffect(() => {
    if (current && animState === "hidden") {
        // Double RAF to ensure paint happens
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setAnimState("in");
            });
        });
    }
  }, [current, animState]);

  // Animation and Sound Sequence
  useEffect(() => {
    if (animState === "in") {
        AudioManager.getInstance().playLevelUp();
        const t = setTimeout(() => setAnimState("hold"), 1000); // 1s fade in
        return () => clearTimeout(t);
    }
    if (animState === "hold") {
        const t = setTimeout(() => setAnimState("out"), 3000); // 3s hold
        return () => clearTimeout(t);
    }
    if (animState === "out") {
        const t = setTimeout(() => {
            setCurrent(null);
            setAnimState("hidden");
        }, 1000); // 1s fade out
        return () => clearTimeout(t);
    }
  }, [animState]);

  if (!current) return null;

  const getTitle = () => {
     if (current.type === "level") return t_game("notif_level_up");
     return t_game(current.type).toUpperCase() + " " + t_game("notif_increased");
  };
  
  const getValue = () => {
    return current.level;
  };



  return (
    <div className={`fixed top-[15%] left-1/2 transform -translate-x-1/2 pointer-events-none flex flex-col items-center justify-center transition-all duration-1000 ease-out ${
        animState === "in" || animState === "hold" 
            ? "opacity-100 translate-y-0 scale-100" 
            : "opacity-0 translate-y-4 scale-95"
    }`}
      style={{ fontFamily: "'Cinzel', serif", textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}
    >
        {/* Glow Effect Container */}
        <div className="relative flex flex-col items-center justify-center py-4">
            
            {/* Background: Centered Animated Watermark Shield */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 opacity-20 select-none z-0">
                <img 
                    src="assets/items/iron_shield.png" 
                    alt="Upgrade" 
                    className="w-full h-full animate-[spin_8s_linear_infinite] drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                    style={{ imageRendering: 'pixelated' }}
                />
            </div>

            {/* Foreground: Text Content */}
            <div className="relative z-10 flex flex-col items-center">
                {/* Top Text: Skill Name */}
                <div className="text-[#cccccc] text-2xl tracking-[0.2em] font-light uppercase mb-1 text-center whitespace-nowrap drop-shadow-md">
                    {getTitle()}
                </div>

                {/* Value (Level) */}
                <div className="text-[#ffffff] text-5xl font-bold tracking-widest leading-none drop-shadow-lg">
                    {getValue()}
                </div>

                {/* Decorative Divider */}
                <div className="w-32 h-[2px] bg-gradient-to-r from-transparent via-[#ffffff]/70 to-transparent mt-3"></div>
            </div>
        </div>
    </div>
  );
};
