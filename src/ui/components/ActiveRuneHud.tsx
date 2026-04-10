import React, { useEffect, useState, useRef } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { RuneRegistry } from "../../game/magic/RuneRegistry";
import { useUI } from "../../context/UIContext";
import { formatItemTooltip } from "../../game/utils/TooltipUtils";

export const ActiveRuneHud: React.FC = () => {
    const { draggedItem, setDraggedItem, showTooltip, hideTooltip, windows } = useUI();
    const [runes, setRunes] = useState<any[]>([]);
    const [activeRuneId, setActiveRuneId] = useState<string | null>(null);
    const [memoryUsage, setMemoryUsage] = useState(0);
    const [memoryCapacity, setMemoryCapacity] = useState(0);
    const [cooldownProgress, setCooldownProgress] = useState(100); // 0-100%
    const [isOnCooldown, setIsOnCooldown] = useState(false);
    const cooldownTimerRef = useRef<number | null>(null);

    const startCooldown = () => {
        setIsOnCooldown(true);
        setCooldownProgress(0);
        
        const duration = 1000; // 1 second
        const startTime = performance.now();
        
        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min((elapsed / duration) * 100, 100);
            
            setCooldownProgress(progress);
            
            if (progress < 100) {
                cooldownTimerRef.current = requestAnimationFrame(animate);
            } else {
                setIsOnCooldown(false);
                setCooldownProgress(100);
            }
        };
        
        cooldownTimerRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        const ps = PlayerState.getInstance();
        const update = () => {
            const currentRunes = ps.getEnchantedRunes();
            setRunes([...currentRunes]);
            setMemoryUsage(ps.getCurrentMemoryUsage());
            setMemoryCapacity(ps.getMemoryCapacity());
            
            if (activeRuneId && !currentRunes.find((r: any) => r.runeId === activeRuneId)) {
                setActiveRuneId(null);
            }
        };

        const onRuneCasted = () => {
            startCooldown();
        };

        ps.on("runesUpdated", update);
        ps.on("reset", update);
        ps.on("statsChanged", update);
        ps.on("runeCasted", onRuneCasted);
        update();

        return () => {
            ps.off("runesUpdated", update);
            ps.off("reset", update);
            ps.off("statsChanged", update);
            ps.off("runeCasted", onRuneCasted);
            // NOTE: Do NOT cancel cooldown here — activeRuneId changes
            // would kill the animation mid-flight. Cleanup is in separate effect.
        };
    }, [activeRuneId]);

    // Cooldown animation cleanup — only on component unmount
    useEffect(() => {
        return () => {
            if (cooldownTimerRef.current) {
                cancelAnimationFrame(cooldownTimerRef.current);
                cooldownTimerRef.current = null;
            }
        };
    }, []);

    const handleCast = (runeId: string) => {
        if (isOnCooldown) {
            PlayerState.getInstance().emit("message", "Cooldown active!");
            return;
        }
        
        setActiveRuneId(runeId);
        PlayerState.getInstance().emit("prepareRuneCast", runeId);
        // Cooldown will start when rune is actually cast (on "runeCasted" event)
    };

    const handleCancelSelection = () => {
        setActiveRuneId(null);
        PlayerState.getInstance().emit("cancelRuneCast");
    };



    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        let source = draggedItem?.source;
        let runeId = draggedItem?.runeId;
        let containerId = draggedItem?.altarId;

        if (!draggedItem) {
            try {
                 const data = JSON.parse(e.dataTransfer.getData("text/plain"));
                 if (data && data.source === "altar_storage") {
                     source = data.source;
                     runeId = data.runeId;
                     containerId = data.altarId;
                 }
             } catch (err) { }
        }

        if (source === "altar_storage" && containerId && runeId) {
             if (PlayerState.getInstance().withdrawRuneFromAltar(containerId, runeId, 1)) { 
                const runeDef = RuneRegistry.getRune(runeId);
                const memCost = runeDef ? runeDef.memoryCost : 0;
                PlayerState.getInstance().addEnchantedRune(runeId, 1, memCost);
                PlayerState.getInstance().emit("message", "Rune equipped.");
            }
        }
        
        PlayerState.getInstance().emit("uiDragEnd");
        setDraggedItem(null);
    };

    if (runes.length === 0) {
        return null;
    }

    // Hide Grimório if window is closed
    if (!windows.grimorio) {
        return null;
    }

    const isOverloaded = memoryUsage > memoryCapacity;

    return (
        <div 
            className="fixed right-4 top-[220px] w-48 flex flex-col gap-2 p-2.5 rounded-2xl bg-black/80 backdrop-blur-md border-4 border-gray-800 transition-all duration-300 shadow-2xl pointer-events-auto"
            style={{ zIndex: 40 }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            <div className="flex justify-between items-center">
                <div className="text-[10px] text-purple-300 font-bold uppercase tracking-widest">
                    Grimório
                </div>
                {activeRuneId && (
                    <button 
                        onClick={handleCancelSelection}
                        className="text-[8px] text-red-400 hover:text-red-300 border border-red-500/30 bg-red-900/20 px-1 py-0.5 rounded hover:bg-red-900/40 transition-colors"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Memory Bar */}
            <div className="w-full">
                <div className="flex justify-between text-[8px] text-gray-400 mb-0.5 font-mono font-bold">
                    <span>MEMO</span>
                    <span className={isOverloaded ? "text-red-500 animate-pulse" : "text-purple-300"}>
                        {memoryUsage}/{memoryCapacity}
                    </span>
                </div>
                <div className="h-1.5 bg-[#1a1a1a] rounded-sm overflow-hidden border border-white/10 shadow-inner">
                    <div 
                        className={`h-full transition-all duration-300 ${isOverloaded ? "bg-red-600" : "bg-gradient-to-r from-purple-700 to-purple-500"}`}
                        style={{ width: `${Math.min(100, (memoryUsage / Math.max(1, memoryCapacity)) * 100)}%` }}
                    />
                </div>
            </div>

            {/* Cooldown Bar */}
            <div className="w-full">
                <div className="flex justify-between text-[8px] text-gray-400 mb-0.5 font-mono font-bold">
                    <span>CD</span>
                    <span className={isOnCooldown ? "text-yellow-400" : "text-green-400"}>
                        {isOnCooldown ? "WAIT" : "RDY"}
                    </span>
                </div>
                <div className="h-1.5 bg-[#1a1a1a] rounded-sm overflow-hidden border border-white/10 shadow-inner">
                    <div 
                        className="h-full transition-all duration-75 bg-gradient-to-r from-yellow-600 to-green-500"
                        style={{ width: `${cooldownProgress}%` }}
                    />
                </div>
            </div>
            
            {/* Runes Grid - Max 3 per row, dynamic height */}
            <div className="grid grid-cols-3 gap-1.5">
                {runes.map((rune) => {
                    const def = RuneRegistry.getRune(rune.runeId);
                    const isActive = activeRuneId === rune.runeId;
                    
                    return (
                        <div 
                            key={rune.runeId}
                            className={`relative group w-full aspect-square rounded-lg border-2 transition-all flex items-center justify-center shrink-0 pointer-events-auto
                                ${isActive 
                                    ? "border-purple-500 bg-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.5)] scale-105" 
                                    : "border-white/10 bg-black/40 hover:border-purple-500/50 hover:bg-purple-500/10"
                                }
                                ${isOnCooldown && !isActive ? "opacity-60" : ""}
                            `}
                            style={{ cursor: isOnCooldown ? 'not-allowed' : 'pointer', zIndex: isActive ? 42 : 41 }}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCast(rune.runeId);
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCast(rune.runeId);
                            }}
                            onMouseEnter={(e) => {
                                 if (!def) return;
                                 const { name, subtext } = formatItemTooltip(
                                     { ...def, id: rune.runeId } as any, 
                                     { weaponId: rune.runeId, itemId: rune.runeId, count: rune.count }
                                 );
                                 showTooltip({
                                     text: name,
                                     subtext: subtext,
                                     x: e.clientX - 220, 
                                     y: e.clientY
                                 });
                            }}
                            onMouseLeave={hideTooltip}
                        >
                            {/* Icon */}
                            {def && (
                                <img 
                                    src={`assets/items/runes/${rune.runeId}.png`} 
                                    alt={def.name}
                                    className={`w-10 h-10 object-contain pixelated drop-shadow-md transition-opacity ${isOverloaded && !isActive ? "opacity-50 grayscale" : ""}`}
                                />
                            )}
                            
                            {/* Count Badge */}
                            <div className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[8px] font-bold px-1 rounded border border-white/20">
                                {rune.count}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
