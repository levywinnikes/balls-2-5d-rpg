import React from "react";
import { PlayerState } from "../../../game/entities/Player/PlayerState";
import { useLanguage } from "../../../context/LanguageContext";
import { Sparkles, Beef } from "lucide-react";
import { XPTable } from "../../../game/data/XPTable";

interface ConditionDetailPanelProps {
    conditionType: 'willpower' | 'hunger' | 'strength' | 'dexterity' | 'intelligence' | 'reflex' | 'characterLevel';
}

export const ConditionDetailPanel: React.FC<ConditionDetailPanelProps> = ({ conditionType }) => {
    const { t } = useLanguage();
    const ps = PlayerState.getInstance();
    
    // Core Attributes
    if (['strength', 'dexterity', 'intelligence', 'reflex'].includes(conditionType)) {
        const attributeData: Record<string, { 
            title: string, 
            description: string, 
            affects: string[], 
            icon: React.ReactNode, // Changed to ReactNode for SVG components
            color: string, // Tailwind color class base (e.g., 'red', 'green')
            bonuses: { label: string, value: (level: number) => string }[]
        }> = {
            strength: {
                title: t('strength') || 'Força',
                description: 'Aumenta o dano de armas físicas e o dano crítico',
                affects: ['Ataque Físico +5%/nível', 'Dano Crítico +1%/nível'],
                icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-red-500">
                        <path d="M14.5 4L17 6.5L9 14.5C8.5 15 8.5 16 9 16.5L10.5 18C11 18.5 12 18.5 12.5 18L20.5 10L23 12.5L13 22.5C11.5 24 9.5 23.5 8.5 22.5L4.5 18.5C3.5 17.5 3 15.5 4.5 14L14.5 4Z" fill="currentColor"/>
                        <path d="M4 2L6.5 4.5L2.5 8.5L2 4C2 3 3 2 4 2Z" fill="currentColor" fillOpacity="0.5"/>
                    </svg>
                ), // Red Sword Icon style
                color: 'red',
                bonuses: [
                    { label: 'Bônus de Dano Físico', value: (level) => `+${level * 5}%` },
                    { label: 'Dano Crítico', value: (level) => `+${level * 1}%` }
                ]
            },
            dexterity: {
                title: t('dexterity') || 'Destreza',
                description: 'Aumenta o ataque com armas de destreza e chance crítica',
                affects: ['Ataque (Armas de Destreza) +5%/nível', 'Chance Crítica +0.2%/nível'],
                icon: (
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="22" y1="12" x2="18" y2="12" />
                        <line x1="6" y1="12" x2="2" y2="12" />
                        <line x1="12" y1="6" x2="12" y2="2" />
                        <line x1="12" y1="22" x2="12" y2="18" />
                    </svg>
                ), // Target Icon
                color: 'green',
                bonuses: [
                    { label: 'Bônus de Ataque (Distância)', value: (level) => `+${level * 5}%` },
                    { label: 'Chance Crítica', value: (level) => `+${(level * 0.2).toFixed(1)}%` }
                ]
            },
            intelligence: {
                title: t('intelligence') || 'Inteligência',
                description: 'Aumenta dano de armas mágicas e memória de feitiços',
                affects: ['Ataque Mágico +5%/nível', 'Memória +5/nível'],
                icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
                        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
                        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
                    </svg>
                ), // Brain Icon
                color: 'purple',
                bonuses: [
                    { label: 'Bônus de Dano Mágico', value: (level) => `+${level * 5}%` },
                    { label: 'Memória', value: (level) => `+${level * 5}` }
                ]
            },
            reflex: {
                title: t('reflex') || 'Reflexo',
                description: 'Aumenta a capacidade defensiva do personagem',
                affects: ['Defesa +5%/nível'],
                icon: (
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-500">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                ), // Shield Icon
                color: 'cyan',
                bonuses: [
                    { label: 'Bônus de Defesa', value: (level) => `+${level * 5}%` }
                ]
            }
        };
        
        const attr = attributeData[conditionType];
        const statData = conditionType === 'strength' ? ps.getStrengthData() :
                        conditionType === 'dexterity' ? ps.getDexterityData() :
                        conditionType === 'intelligence' ? ps.getIntelligenceData() :
                        ps.getReflexData();

        // Calculate XP Progress
        const levelInfo = XPTable.getLevelInfo(statData.experience); // Using same table for now or specific if needed
        const nextLevelXP = conditionType === 'strength' ? ps.getStrengthNextLevelExp() :
                           conditionType === 'dexterity' ? ps.getDexterityNextLevelExp() :
                           conditionType === 'intelligence' ? ps.getIntelligenceNextLevelExp() :
                           ps.getReflexNextLevelExp();
        
        // Progress percentage for the bar
        const progress = Math.min(100, Math.max(0, (statData.experience / nextLevelXP) * 100));

        // Color mapping for safe Tailwind usage
        const colorMap: Record<string, {
            text: string,
            textLight: string,
            textDark: string,
            border: string,
            bg: string,
            bgLight: string,
            barFrom: string,
            barTo: string,
            glow: string
        }> = {
            red: {
                text: 'text-red-300', textLight: 'text-red-400', textDark: 'text-red-500', 
                border: 'border-red-500/20', bg: 'bg-red-500/10', bgLight: 'bg-red-500/5',
                barFrom: 'from-red-600', barTo: 'to-red-400', glow: 'shadow-red-500/20'
            },
            green: {
                 text: 'text-green-300', textLight: 'text-green-400', textDark: 'text-green-500', 
                 border: 'border-green-500/20', bg: 'bg-green-500/10', bgLight: 'bg-green-500/5',
                 barFrom: 'from-green-600', barTo: 'to-green-400', glow: 'shadow-green-500/20'
            },
            purple: {
                 text: 'text-purple-300', textLight: 'text-purple-400', textDark: 'text-purple-500', 
                 border: 'border-purple-500/20', bg: 'bg-purple-500/10', bgLight: 'bg-purple-500/5',
                 barFrom: 'from-purple-600', barTo: 'to-purple-400', glow: 'shadow-purple-500/20'
            },
            cyan: {
                 text: 'text-cyan-300', textLight: 'text-cyan-400', textDark: 'text-cyan-500', 
                 border: 'border-cyan-500/20', bg: 'bg-cyan-500/10', bgLight: 'bg-cyan-500/5',
                 barFrom: 'from-cyan-600', barTo: 'to-cyan-400', glow: 'shadow-cyan-500/20'
            }
        };

        const colors = colorMap[attr.color] || colorMap['red'];
        
        return (
            <div className={`h-full flex flex-col bg-black/60 rounded-xl p-4 border ${colors.border}`}>
                {/* Header */}
                <div className={`border-b ${colors.border} pb-3 mb-4`}>
                    <div className={`text-xs ${colors.textLight} opacity-60 uppercase tracking-widest`}>
                        {t("character_overview" as any) || "Atributo"}
                    </div>
                    <div className={`text-lg font-bold ${colors.text} mt-1 flex items-center gap-2`}>
                        <span className="text-2xl drop-shadow-md filter">{attr.icon}</span>
                        {attr.title}
                    </div>
                </div>

                {/* Current Level - Styled like Character Level */}
                <div className={`text-center py-6 bg-gradient-to-r ${colors.bg} to-transparent rounded-lg border ${colors.border} mb-4 relative overflow-hidden group shadow-lg ${colors.glow}`}>
                    <div className={`absolute inset-0 ${colors.bgLight} opacity-0 group-hover:opacity-100 transition-opacity`} />
                    <div className={`text-[10px] ${colors.textLight} opacity-60 uppercase tracking-widest mb-2`}>Nível Atual</div>
                    <div className={`text-6xl font-black ${colors.text} drop-shadow-2xl scale-110`}>{statData.level}</div>
                    
                    {/* Bonus Badge */}
                    <div className="mt-3 flex flex-col items-center gap-2">
                        {attr.bonuses.map((bonus, idx) => (
                            <div key={idx} className={`px-3 py-1 rounded-full bg-black/40 border ${colors.border} backdrop-blur-sm`}>
                                 <div className={`text-xs ${colors.textLight} font-mono flex items-center gap-1`}>
                                     <span>{bonus.label}:</span> 
                                     <span className="font-bold text-white">{bonus.value(statData.level)}</span>
                                 </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                 {/* XP Progress */}
                <div className={`bg-black/40 rounded-lg p-3 border ${colors.border} mb-4 shadow-inner`}>
                    <div className="text-[10px] text-white/40 uppercase tracking-widest mb-2 flex justify-between">
                         <span>Progresso XP</span>
                         <span className={colors.textLight}>{Math.floor(progress)}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden mb-2 border border-white/5 relative">
                        <div 
                            className={`h-full bg-gradient-to-r ${colors.barFrom} ${colors.barTo} transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.2)]`}
                            style={{ width: `${progress}%` }} 
                        />
                    </div>
                    <div className="text-xs text-white/50 font-mono text-right">
                        {Math.floor(statData.experience)} / {Math.ceil(nextLevelXP)} XP
                    </div>
                </div>

                {/* Description */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="space-y-3">
                        <div>
                            <div className={`text-xs ${colors.textLight} opacity-80 font-bold uppercase tracking-wider mb-2`}>
                                Descrição
                            </div>
                            <div className="text-sm text-white/70 leading-relaxed bg-black/20 p-2 rounded border border-white/5">
                                {attr.description}
                            </div>
                        </div>

                        <div>
                            <div className={`text-xs ${colors.textLight} opacity-80 font-bold uppercase tracking-wider mb-2`}>
                                Afeta
                            </div>
                            <div className="grid gap-2 text-xs">
                                {attr.affects.map((effect, idx) => (
                                    <div key={idx} className={`${colors.bgLight} p-2.5 rounded border ${colors.border} flex items-center gap-2`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${colors.bg.replace('bg-', 'bg-').replace('/10', '')}`} />
                                        {effect}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={`${colors.bg} border ${colors.border} rounded-lg p-3 flex gap-3 items-start`}>
                            <div className="mt-0.5">💡</div>
                            <div>
                                <div className={`text-xs ${colors.text} font-bold mb-0.5`}>Dica</div>
                                <div className={`text-xs ${colors.textLight} opacity-80 leading-snug`}>
                                    Ganhe XP de {attr.title} combatendo inimigos e usando itens apropriados!
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
    if (conditionType === 'characterLevel') {
        const charLevel = ps.getLevel();
        const charExp = ps.getExperience();
        const levelInfo = XPTable.getLevelInfo(charExp);
        const charNextLevel = levelInfo.nextLevelXP;
        
        return (
            <div className="h-full flex flex-col bg-black/60 rounded-xl p-4 border border-yellow-500/20">
                {/* Header */}
                <div className="border-b border-yellow-500/20 pb-3 mb-4">
                    <div className="text-xs text-yellow-400/60 uppercase tracking-widest">
                        {t("character_overview" as any) || "Resumo do Personagem"}
                    </div>
                    <div className="text-lg font-bold text-yellow-300 mt-1 flex items-center gap-2">
                        <span className="text-2xl">⭐</span>
                        Nível do Personagem
                    </div>
                </div>

                {/* Current Level */}
                <div className="text-center py-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/20 mb-4">
                    <div className="text-[10px] text-yellow-400/60 uppercase tracking-widest mb-2">Nível Atual</div>
                    <div className="text-5xl font-bold text-yellow-300">{charLevel}</div>
                </div>

                {/* XP Progress */}
                <div className="bg-black/40 rounded-lg p-3 border border-yellow-500/10 mb-4">
                    <div className="text-[10px] text-white/40 uppercase tracking-widest mb-2">Progresso XP</div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                        <div 
                            className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-300"
                            style={{ width: `${levelInfo.progress * 100}%` }}
                        />
                    </div>
                    <div className="text-xs text-white/60 font-mono text-right">
                        {Math.floor(charExp)} / {charNextLevel === Infinity ? 'MAX' : charNextLevel} XP
                    </div>
                </div>

                {/* Description */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="space-y-3">
                        <div>
                            <div className="text-xs text-yellow-400/80 font-bold uppercase tracking-wider mb-2">
                                O que é o Nível?
                            </div>
                            <div className="text-sm text-white/70 leading-relaxed">
                                O nível representa a experiência geral do seu personagem. Cada nível aumenta seus atributos base.
                            </div>
                        </div>

                        <div>
                            <div className="text-xs text-yellow-400/80 font-bold uppercase tracking-wider mb-2">
                                Bônus por Nível
                            </div>
                            <div className="grid gap-2 text-xs">
                                <div className="bg-red-500/10 p-2 rounded border border-red-500/20">
                                    <div className="font-bold text-red-300">PV Máximo</div>
                                    <div className="text-white/60">+5 por nível (a partir do nível 2)</div>
                                </div>
                                <div className="bg-orange-500/10 p-2 rounded border border-orange-500/20">
                                    <div className="font-bold text-orange-300">Ataque</div>
                                    <div className="text-white/60">+1% por nível</div>
                                </div>
                                <div className="bg-blue-500/10 p-2 rounded border border-blue-500/20">
                                    <div className="font-bold text-blue-300">Defesa</div>
                                    <div className="text-white/60">+1% por nível</div>
                                </div>
                                <div className="bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
                                    <div className="font-bold text-yellow-300">Velocidade</div>
                                    <div className="text-white/60">+8 por nível</div>
                                </div>
                                <div className="bg-amber-500/10 p-2 rounded border border-amber-500/20">
                                    <div className="font-bold text-amber-300">Capacidade</div>
                                    <div className="text-white/60">+10 por nível</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                            <div className="text-xs text-green-400 font-bold mb-1">🎯 Dica</div>
                            <div className="text-xs text-green-300/80">
                                Complete missões e derrote inimigos para ganhar XP e subir de nível!
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    

    if (conditionType === 'willpower') {
        const wpTier = ps.getWillpowerTier();
        const wpExp = ps.getWillpowerExp();
        const wpTarget = ps.getWillpowerTarget();
        const wpBonus = ps.getWillpowerBonusPercent();
        
        // Character Level and XP
        const charLevel = ps.getLevel();
        const charExp = ps.getExperience();
        // Calculate next level XP (simple formula: level * 1000)
        const charNextLevel = (charLevel + 1) * 1000;
        
        return (
            <div className="h-full flex flex-col bg-black/60 rounded-xl p-4 border border-purple-500/20">
                {/* Header */}
                <div className="border-b border-purple-500/20 pb-3 mb-4">
                    <div className="text-xs text-purple-400/60 uppercase tracking-widest">
                        {t("character_overview" as any) || "Character Overview"}
                    </div>
                    <div className="text-lg font-bold text-purple-300 mt-1 flex items-center gap-2">
                        <Sparkles size={20} className="text-purple-400" />
                        {t("willpower") || "Força de Vontade"}
                    </div>
                </div>

                {/* Current Tier */}
                <div className="text-center py-6 bg-purple-500/10 rounded-lg border border-purple-500/20 mb-4">
                    <div className="text-[10px] text-purple-400/60 uppercase tracking-widest mb-2">Tier Atual</div>
                    <div className="text-5xl font-bold text-purple-300">{wpTier}</div>
                    <div className="text-sm text-purple-400/80 mt-2">+{wpBonus}% Stats</div>
                </div>

                {/* XP Progress */}
                <div className="bg-black/40 rounded-lg p-3 border border-purple-500/10 mb-4">
                    <div className="text-[10px] text-white/40 uppercase tracking-widest mb-2">Progresso XP</div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                        <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                            style={{ width: `${(wpExp / wpTarget) * 100}%` }}
                        />
                    </div>
                    <div className="text-xs text-white/60 font-mono text-right">
                        {Math.floor(wpExp)} / {wpTarget} XP
                    </div>
                </div>

                {/* Description */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="space-y-3">
                        <div>
                            <div className="text-xs text-purple-400/80 font-bold uppercase tracking-wider mb-2">
                                O que é Força de Vontade?
                            </div>
                            <div className="text-sm text-white/70 leading-relaxed">
                                {t("willpower_desc") || "Aumenta PV, Velocidade, Dano, Defesa e Armadura. Bônus de Sobrevivência: +1% no Total (após outros bônus) por Nível"}
                            </div>
                        </div>

                        <div>
                            <div className="text-xs text-purple-400/80 font-bold uppercase tracking-wider mb-2">
                                Stats Afetados
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-purple-500/10 p-2 rounded border border-purple-500/10">PV Máximo</div>
                                <div className="bg-purple-500/10 p-2 rounded border border-purple-500/10">Mana Máxima</div>
                                <div className="bg-purple-500/10 p-2 rounded border border-purple-500/10">Ataque</div>
                                <div className="bg-purple-500/10 p-2 rounded border border-purple-500/10">Defesa</div>
                                <div className="bg-purple-500/10 p-2 rounded border border-purple-500/10">Armadura</div>
                                <div className="bg-purple-500/10 p-2 rounded border border-purple-500/10">Velocidade</div>
                                <div className="bg-purple-500/10 p-2 rounded border border-purple-500/10">Capacidade</div>
                                <div className="bg-purple-500/10 p-2 rounded border border-purple-500/10">Memória</div>
                            </div>
                        </div>

                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                            <div className="text-xs text-yellow-400 font-bold mb-1">⚠️ Atenção</div>
                            <div className="text-xs text-yellow-300/80">
                                Morrer reseta a Força de Vontade para Tier 0
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
    // Hunger panel
    const hunger = ps.getHunger();
    const maxHunger = 1000; // Max hunger constant
    const hungerPercent = (hunger / maxHunger) * 100;
    
    // Determine tier based on hunger percentage
    let hungerTier = 0;
    let regenBonus = 0;
    if (hungerPercent >= 90) { hungerTier = 5; regenBonus = 100; }
    else if (hungerPercent >= 70) { hungerTier = 4; regenBonus = 75; }
    else if (hungerPercent >= 50) { hungerTier = 3; regenBonus = 50; }
    else if (hungerPercent >= 30) { hungerTier = 2; regenBonus = 25; }
    else if (hungerPercent >= 10) { hungerTier = 1; regenBonus = 10; }
    
    return (
        <div className="h-full flex flex-col bg-black/60 rounded-xl p-4 border border-orange-500/20">
            {/* Header */}
            <div className="border-b border-orange-500/20 pb-3 mb-4">
                <div className="text-xs text-orange-400/60 uppercase tracking-widest">
                    {t("character_overview" as any) || "Character Overview"}
                </div>
                <div className="text-lg font-bold text-orange-300 mt-1 flex items-center gap-2">
                    <Beef size={20} className="text-orange-400" />
                    {t("hunger") || "Fome"}
                </div>
            </div>

            {/* Current Tier */}
            <div className="text-center py-6 bg-orange-500/10 rounded-lg border border-orange-500/20 mb-4">
                <div className="text-[10px] text-orange-400/60 uppercase tracking-widest mb-2">Tier Atual</div>
                <div className="text-5xl font-bold text-orange-300">{hungerTier}</div>
                <div className="text-sm text-orange-400/80 mt-2">{regenBonus}% Regeneração</div>
            </div>

            {/* Hunger Bar */}
            <div className="bg-black/40 rounded-lg p-3 border border-orange-500/10 mb-4">
                <div className="text-[10px] text-white/40 uppercase tracking-widest mb-2">Nível de Fome</div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                    <div 
                        className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-300"
                        style={{ width: `${hungerPercent}%` }}
                    />
                </div>
                <div className="text-xs text-white/60 font-mono text-right">
                    {Math.floor(hunger)} / {maxHunger}
                </div>
            </div>

            {/* Description */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-3">
                    <div>
                        <div className="text-xs text-orange-400/80 font-bold uppercase tracking-wider mb-2">
                            O que é Fome?
                        </div>
                        <div className="text-sm text-white/70 leading-relaxed">
                            {t("hunger_desc") || "Fome determina regeneração."}
                        </div>
                    </div>

                    <div>
                        <div className="text-xs text-orange-400/80 font-bold uppercase tracking-wider mb-2">
                            Tiers de Fome
                        </div>
                        <div className="space-y-2 text-xs">
                            <div className={`p-2 rounded border ${hungerTier === 5 ? 'bg-orange-500/20 border-orange-500/40' : 'bg-orange-500/5 border-orange-500/10'}`}>
                                <div className="font-bold text-orange-300">Tier 5 (90-100%)</div>
                                <div className="text-white/60">100% Regeneração</div>
                            </div>
                            <div className={`p-2 rounded border ${hungerTier === 4 ? 'bg-orange-500/20 border-orange-500/40' : 'bg-orange-500/5 border-orange-500/10'}`}>
                                <div className="font-bold text-orange-300">Tier 4 (70-89%)</div>
                                <div className="text-white/60">75% Regeneração</div>
                            </div>
                            <div className={`p-2 rounded border ${hungerTier === 3 ? 'bg-orange-500/20 border-orange-500/40' : 'bg-orange-500/5 border-orange-500/10'}`}>
                                <div className="font-bold text-orange-300">Tier 3 (50-69%)</div>
                                <div className="text-white/60">50% Regeneração</div>
                            </div>
                            <div className={`p-2 rounded border ${hungerTier === 2 ? 'bg-orange-500/20 border-orange-500/40' : 'bg-orange-500/5 border-orange-500/10'}`}>
                                <div className="font-bold text-orange-300">Tier 2 (30-49%)</div>
                                <div className="text-white/60">25% Regeneração</div>
                            </div>
                            <div className={`p-2 rounded border ${hungerTier === 1 ? 'bg-orange-500/20 border-orange-500/40' : 'bg-orange-500/5 border-orange-500/10'}`}>
                                <div className="font-bold text-orange-300">Tier 1 (10-29%)</div>
                                <div className="text-white/60">10% Regeneração</div>
                            </div>
                            <div className={`p-2 rounded border ${hungerTier === 0 ? 'bg-red-500/20 border-red-500/40' : 'bg-red-500/5 border-red-500/10'}`}>
                                <div className="font-bold text-red-300">Tier 0 (0-9%)</div>
                                <div className="text-white/60">Sem Regeneração</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
