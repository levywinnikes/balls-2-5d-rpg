import React from "react";
import { translateAttribute, formatAttributeValue, translateItemType, StarIcon, getItemStars } from "../../utils/ItemVisuals";
import { WeaponRegistry } from "../../../game/entities/weapons/WeaponRegistry";
import { ShieldRegistry } from "../../../game/entities/Shields/ShieldRegistry";
import { FoodRegistry } from "../../../game/entities/food/FoodRegistry"; // ADDED
import { useLanguage } from "../../../context/LanguageContext";
import { sortAttributes } from "../../../game/utils/ItemUtils";
import { PlayerState } from "../../../game/entities/Player/PlayerState";
import { StatManager } from "../../../game/systems/StatManager";

interface ItemDetailPanelProps {
    item: any;
    onClose?: () => void;
    onDrop?: () => void;
    onEquip?: () => void;
    onUnequip?: () => void; // For equipped items
    onLight?: () => void; // For unlit torches
    onExtinguish?: () => void; // For lit torches
    onUse?: () => void; // For consumables
    isEquippable?: boolean;
    isEquipped?: boolean; // New: True if item is currently equipped
}

export const ItemDetailPanel: React.FC<ItemDetailPanelProps> = ({ item, onClose, onDrop, onEquip, onUnequip, onLight, onExtinguish, onUse, isEquippable, isEquipped }) => {
    const { t } = useLanguage();
    const ps = PlayerState.getInstance();
    const sm = StatManager.getInstance();

    if (!item) {
        return (
            <div className="h-full flex items-center justify-center text-white/20 italic text-sm p-8 text-center border-2 border-dashed border-white/10 rounded-xl">
                {t("dashboard.select_item_hint" as any) || "Selecione um item para ver detalhes"}
            </div>
        );
    }

    // Attempt to resolve definition
    const def = WeaponRegistry.getWeaponDefinition(item.itemId) 
             || ShieldRegistry.getShieldDefinition(item.itemId)
             || FoodRegistry.foods.find(f => f.id === item.itemId); // Added Food lookup
    const type = def?.type || "unknown";
    const typeLabel = translateItemType(type);
    
    // Check if item is consumable (food, potion, rune)
    const isConsumable = type === "food" || type === "potion" || type === "rune";

    // Parsing Attributes for Display
    const rawAttributes = item.attributes && item.attributes.length > 0 ? item.attributes : [];
    
    // Sort logic moved here to ensure robustness with new quality/tier check
    const attributesList = [...rawAttributes].sort((a, b) => {
        const tierWeight: Record<string, number> = { 'gold': 3, 'silver': 2, 'bronze': 1 };
        const qA = (a.quality || a.tier || "").toLowerCase();
        const qB = (b.quality || b.tier || "").toLowerCase();
        return (tierWeight[qB] || 0) - (tierWeight[qA] || 0);
    });
    
    const renderStars = () => {
         const stars = getItemStars(item);
         if (stars.length > 0) {
              return (
                  <div className="flex gap-0.5">
                      {stars.map((quality, i) => (
                          <StarIcon key={i} quality={quality} size={12} />
                      ))}
                  </div>
              )
         }
         return null;
    };

    return (
        <div className="h-full flex flex-col bg-black/60 rounded-xl p-4 border border-white/10 relative overflow-hidden">
             
             {/* Header */}
             <div className="flex gap-4 border-b border-white/10 pb-4 mb-4">
                 <div className="w-16 h-16 rounded bg-black/50 border border-white/20 flex items-center justify-center relative shadow-inner">
                     <img 
                        src={`assets/items/${item.itemId}.png`} 
                        alt={item.itemId}
                        className="w-12 h-12 pixelated object-contain"
                     />
                     {item.count > 1 && (
                         <span className="absolute bottom-1 right-1 text-xs font-bold text-white drop-shadow">{item.count}</span>
                     )}
                 </div>
                 
                 <div className="flex flex-col justify-center">
                     <h2 className="text-lg font-bold text-white leading-tight">{t((def?.name || item.itemId) as any)}</h2>
                     <span className="text-xs text-white/50 uppercase tracking-widest">{typeLabel}</span>
                     <div className="mt-1">{renderStars()}</div>
                 </div>
             </div>

             {/* Prominent DPS for Weapons */}
             {def && (def as any).damage > 0 && (
                 <div className="mb-4 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 text-center">
                     <div className="text-[10px] text-blue-300/60 uppercase tracking-widest mb-1 font-bold">Dano por Segundo (DPS)</div>
                     <div className="text-4xl font-black text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.4)]">
                         {sm.calculateItemDPS(item, ps)}
                     </div>
                     <div className="text-[9px] text-white/20 mt-1 uppercase italic">Considerando seus atributos atuais</div>
                 </div>
             )}

             {/* Attributes List */}
             <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                 {/* Basic Stats if available (Atk/Def) */}
                 {def && (
                     <div className="grid grid-cols-2 gap-2 mb-2 p-2 bg-white/5 rounded">
                         {(def as any).damage > 0 && (
                             <div className="flex flex-col">
                                 <span className="text-[10px] text-white/40 uppercase">Ataque</span>
                                 <span className="text-sm font-bold text-white">{(def as any).damage}</span>
                             </div>
                         )}
                         {def.defense > 0 && (
                             <div className="flex flex-col">
                                 <span className="text-[10px] text-white/40 uppercase">Defesa</span>
                                 <span className="text-sm font-bold text-white">{def.defense}</span>
                             </div>
                         )}
                     </div>
                 )}

                 {/* Magic/Bonus Attributes */}
                 {attributesList.length > 0 && (
                     <div className="space-y-1">
                         <div className="text-[10px] text-yellow-500/80 font-bold uppercase tracking-wider mb-1">
                            {t("item_attributes" as any) || "Bônus de Atributos"}
                         </div>
                         {attributesList.map((attr: any, idx: number) => {
                             const rawKey = attr.source || attr.type || attr.name; // Fallback to name if source/type missing
                             const quality = (attr.quality || attr.tier || "common").toLowerCase();
                             
                             // 1. Determine Display Label
                             const label = translateAttribute(rawKey);

                            // 2. Determine Display Value
                            const valueDisplay = formatAttributeValue(rawKey, attr.value);

                             return (
                                 <div key={idx} className={`flex items-center gap-2 text-xs text-white/80 group`}>
                                     <StarIcon quality={quality} size={10} className="group-hover:scale-125 transition-transform" />
                                     <span>{label}</span>
                                     <span className="ml-auto font-bold text-white">{valueDisplay}</span>
                                 </div>
                             )
                         })}
                     </div>
                 )}
                 
                 {/* Description */}
                 {def?.description && (
                     <div className="mt-4 text-xs text-white/40 italic border-t border-white/10 pt-2">
                         {t(def.description as any)}
                     </div>
                 )}
             </div>

             {/* Footer Actions */}
             <div className="mt-auto pt-4 border-t border-white/10 grid gap-2">
                 {/* Use Button for Consumables */}
                 {isConsumable && onUse && (
                     <button 
                        onClick={onUse}
                        className="group w-full py-2.5 relative overflow-hidden rounded border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/30 transition-all duration-300"
                     >
                         <div className="absolute inset-0 flex items-center justify-center gap-2 z-10">
                            <span className="text-blue-400 group-hover:text-blue-300 font-bold uppercase tracking-widest text-xs shadow-black drop-shadow-md">
                                🍖 {t("common_use" as any) || "Usar"}
                            </span>
                         </div>
                         <div className="absolute inset-0 bg-blue-400/5 opacity-0 group-hover:opacity-100 transition-opacity blur-md" />
                     </button>
                 )}
                 

                 {/* Light Button */}
                 {onLight && (
                     <button 
                        onClick={onLight}
                        className="group w-full py-2.5 relative overflow-hidden rounded border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 active:bg-orange-500/30 transition-all duration-300"
                     >
                         <div className="absolute inset-0 flex items-center justify-center gap-2 z-10">
                            <span className="text-orange-400 group-hover:text-orange-300 font-bold uppercase tracking-widest text-xs shadow-black drop-shadow-md">
                                🔥 {t("common_light" as any) || "Acender"}
                            </span>
                         </div>
                         <div className="absolute inset-0 bg-orange-400/5 opacity-0 group-hover:opacity-100 transition-opacity blur-md" />
                     </button>
                 )}

                 {/* Extinguish Button */}
                 {onExtinguish && (
                     <button 
                        onClick={onExtinguish}
                        className="group w-full py-2.5 relative overflow-hidden rounded border border-gray-500/30 bg-gray-500/10 hover:bg-gray-500/20 active:bg-gray-500/30 transition-all duration-300"
                     >
                         <div className="absolute inset-0 flex items-center justify-center gap-2 z-10">
                            <span className="text-gray-400 group-hover:text-gray-300 font-bold uppercase tracking-widest text-xs shadow-black drop-shadow-md">
                                💨 {t("common_extinguish" as any) || "Apagar"}
                            </span>
                         </div>
                         <div className="absolute inset-0 bg-gray-400/5 opacity-0 group-hover:opacity-100 transition-opacity blur-md" />
                     </button>
                 )}
                 
                 {/* Equip Button - Hide if item is already equipped */}
                 {!isConsumable && !isEquipped && onEquip && isEquippable && (
                     <button 
                        onClick={onEquip}
                        className="group w-full py-2.5 relative overflow-hidden rounded border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 active:bg-green-500/30 transition-all duration-300"
                     >
                         <div className="absolute inset-0 flex items-center justify-center gap-2 z-10">
                            <span className="text-green-400 group-hover:text-green-300 font-bold uppercase tracking-widest text-xs shadow-black drop-shadow-md">
                                ⚡ {t("common.equip" as any) || "Equipar"}
                            </span>
                         </div>
                         {/* Hover Glow */}
                         <div className="absolute inset-0 bg-green-400/5 opacity-0 group-hover:opacity-100 transition-opacity blur-md" />
                     </button>
                 )}
                 
                 {/* Unequip Button - Only show for equipped items */}
                 {isEquipped && onUnequip && (
                     <button 
                        onClick={onUnequip}
                        className="group w-full py-2.5 relative overflow-hidden rounded border border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20 active:bg-yellow-500/30 transition-all duration-300"
                     >
                         <div className="absolute inset-0 flex items-center justify-center gap-2 z-10">
                            <span className="text-yellow-400 group-hover:text-yellow-300 font-bold uppercase tracking-widest text-xs shadow-black drop-shadow-md">
                                ⬅️ {t("common_unequip" as any) || "Desequipar"}
                            </span>
                         </div>
                         <div className="absolute inset-0 bg-yellow-400/5 opacity-0 group-hover:opacity-100 transition-opacity blur-md" />
                     </button>
                 )}
                 
                 {/* Drop Button */}
                 {onDrop && (
                     <button 
                        onClick={onDrop}
                        className="group w-full py-2.5 relative overflow-hidden rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 transition-all duration-300"
                     >
                         <div className="absolute inset-0 flex items-center justify-center gap-2 z-10">
                            <span className="text-red-400 group-hover:text-red-300 font-bold uppercase tracking-widest text-xs shadow-black drop-shadow-md">
                                🗑️ {t("common.drop" as any) || "Largar"}
                            </span>
                         </div>
                          {/* Hover Glow */}
                         <div className="absolute inset-0 bg-red-400/5 opacity-0 group-hover:opacity-100 transition-opacity blur-md" />
                     </button>
                 )}
             </div>
        </div>
    );
};
