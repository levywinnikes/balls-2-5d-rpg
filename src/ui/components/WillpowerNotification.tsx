import React, { useEffect, useState } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { t_game } from "../../game/i18n/translations";

export const WillpowerNotification: React.FC = () => {
  const [tier, setTier] = useState<number | null>(null);
  const [animState, setAnimState] = useState<"hidden" | "in" | "hold" | "out">("hidden");

  useEffect(() => {
    const handleEvent = (newTier: number) => {
       setTier(newTier);
       // Start hidden, let effect pick it up
       setAnimState("hidden");
    };

    const ps = PlayerState.getInstance();
    ps.on("willpowerTierUp", handleEvent);
    return () => { ps.off("willpowerTierUp", handleEvent); };
  }, []);

  // Trigger Entry
  useEffect(() => {
      if (tier !== null && animState === "hidden") {
          requestAnimationFrame(() => {
             requestAnimationFrame(() => {
                 setAnimState("in");
             });
          });
      }
  }, [tier, animState]);

  // Animation Sequence
  useEffect(() => {
    if (animState === "in") {
        const t = setTimeout(() => setAnimState("hold"), 1000); // 1s fade in
        return () => clearTimeout(t);
    }
    if (animState === "hold") {
        const t = setTimeout(() => setAnimState("out"), 3000); // 3s hold
        return () => clearTimeout(t);
    }
    if (animState === "out") {
        const t = setTimeout(() => {
            setTier(null);
            setAnimState("hidden");
        }, 1000); // 1s fade out
        return () => clearTimeout(t);
    }
  }, [animState]);

  if (tier === null) return null;

  return (
    <div className={`fixed bottom-4 left-4 pointer-events-none flex items-center transition-all duration-1000 ease-out z-[9000] ${
        animState === "in" || animState === "hold" 
            ? "opacity-100 translate-x-0" 
            : "opacity-0 -translate-x-4"
    }`}>
        <div className="bg-black/80 border-l-4 border-purple-500 px-4 py-3 rounded shadow-lg backdrop-blur-sm">
            <div className="flex flex-col">
                <span className="text-purple-400 text-xs font-bold uppercase tracking-wider">
                    {t_game("notif_willpower_increased")}
                </span>
                <span className="text-white text-sm font-semibold">
                    {t_game("notif_reached_tier").replace("{tier}", tier.toString())}
                </span>
            </div>
            {/* Optional Icon or visual element */}
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
        </div>
    </div>
  );
};
