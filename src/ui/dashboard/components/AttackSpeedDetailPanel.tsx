import React from "react";
import { StatManager } from "../../../game/systems/StatManager";
import { PlayerState } from "../../../game/entities/Player/PlayerState";
import { useLanguage } from "../../../context/LanguageContext";
import { Zap, Timer, Sword } from "lucide-react";

export const AttackSpeedDetailPanel: React.FC = () => {
    const { t } = useLanguage();
    const ps = PlayerState.getInstance();
    const sm = StatManager.getInstance();
    
    const breakdown = sm.calculateAPSBreakdown(ps);
    
    return (
        <div className="h-full flex flex-col bg-black/60 rounded-xl p-4 border border-white/10">
            {/* Header */}
            <div className="border-b border-white/10 pb-3 mb-4">
                <div className="text-xs text-white/40 uppercase tracking-widest">
                    {t("character_overview" as any) || "Character Overview"}
                </div>
                <div className="text-lg font-bold text-white mt-1">Velocidade de Ataque (APS)</div>
            </div>

            {/* Total Value */}
            <div className="text-center py-6 bg-yellow-500/10 rounded-lg border border-yellow-500/20 mb-4">
                <div className="text-[10px] text-white/40 uppercase tracking-widest mb-2">Ataques por Segundo</div>
                <div className="text-5xl font-bold text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]">
                    {breakdown.aps} <span className="text-xl opacity-50">APS</span>
                </div>
            </div>

            {/* Breakdown */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                
                {/* 1. Cooldown Math */}
                <div className="space-y-3">
                    <div className="text-[10px] text-white/30 uppercase tracking-widest pl-1 font-bold">Breakdown da Recarga</div>
                    <div className="bg-black/40 rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5">
                        
                        {/* Base Weapon */}
                        <div className="p-4 flex justify-between items-center group hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/5 rounded-lg">
                                    <Sword size={16} className="text-white/60" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs text-white/80 font-semibold italic">Base da Arma</span>
                                    <span className="text-[10px] text-white/40 uppercase tracking-tighter">Recarga padrão do item equipado</span>
                                </div>
                            </div>
                            <div className="text-xl font-bold text-white">{breakdown.baseCooldown}ms</div>
                        </div>

                        {/* Modifiers */}
                        {breakdown.modifiers.length > 0 && (
                            <div className="p-4 flex flex-col gap-3 group hover:bg-white/5 transition-colors">
                                <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Reduções de Equipamento</div>
                                <div className="space-y-2">
                                    {breakdown.modifiers.map((mod, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/5">
                                            <span className="text-[11px] text-white/70">{mod.source}</span>
                                            <span className="text-xs font-mono font-bold text-green-400">{mod.value > 0 ? `+${mod.value}` : mod.value}ms</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Final Delay */}
                        <div className="p-4 bg-yellow-500/5 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-yellow-500/20 rounded-lg">
                                    <Timer size={16} className="text-yellow-400" />
                                </div>
                                <span className="text-sm font-bold text-yellow-200 uppercase tracking-widest">Recarga Final</span>
                            </div>
                            <div className="text-2xl font-black text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">
                                {breakdown.finalCooldown}ms
                            </div>
                        </div>

                    </div>
                </div>

                {/* 2. Frequency Logic */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-500/20 rounded-lg">
                            <Zap size={20} className="text-yellow-400" />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-white tracking-widest uppercase">Fórmula de APS</div>
                            <div className="text-[10px] text-white/40 uppercase tracking-tighter italic">Transformando milissegundos em frequência</div>
                        </div>
                    </div>
                    
                    <div className="bg-black/40 p-3 rounded-lg border border-white/5 font-mono text-center">
                        <span className="text-white/40">1000ms / </span>
                        <span className="text-yellow-400 font-bold">{breakdown.finalCooldown}ms</span>
                        <span className="text-white/40"> = </span>
                        <span className="text-white font-bold">{breakdown.aps} APS</span>
                    </div>

                    <p className="text-xs text-white/50 leading-relaxed px-1">
                        A Velocidade de Ataque (Attacks Per Second) determina quantos golpes você desfere por segundo. 
                        Quanto menor sua recarga (ms), maior será sua frequência de ataques.
                    </p>
                </div>

            </div>
        </div>
    );
};
