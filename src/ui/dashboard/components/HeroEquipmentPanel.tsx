import React from "react";
import { PlayerState, InventoryItem } from "../../../game/entities/Player/PlayerState";
import { usePlayerState } from "../../../hooks/usePlayerState";
import { useLanguage } from "../../../context/LanguageContext";
import { EquipmentSlot } from "../../../config/ItemConstants";
import { calculateItemScore, getItemTier } from "../../../game/utils/ItemUtils";
import { getStarIcon, getItemBorder, TIER_BG, StarIcon, getItemStars } from "../../utils/ItemVisuals";

// Minimal RPG Slot representation for Dashboard
const DashboardSlot: React.FC<{
    slotEnum: EquipmentSlot; // Added for callback identification
    slotName: string;
    isFocused: boolean;
    isSelected: boolean;
    item: InventoryItem | null;
    onHover: (slot: EquipmentSlot) => void;
    onLeave: () => void; // New prop
    onClick: (slot: EquipmentSlot) => void;
    onHoverItem: (item: any) => void;
}> = React.memo(({ slotEnum, slotName, isFocused, isSelected, item, onHover, onLeave, onClick, onHoverItem }) => {
    
    const score = item ? calculateItemScore(item) : 0;
    const tier = getItemTier(score);

    // Style
    // If item exists, use Tier Colors (Centralized Visuals). If empty, use default styling.
    const tierBorder = item ? getItemBorder(score) : "border-white/10";
    const tierShadow = item ? tier.shadow : "";
    const tierBg = item ? (tier.bg || TIER_BG.common) : "";
    
    // Check if stackable (naive check based on count existence or type if possible, 
    // but assuming count > 1 implies stackable for now as quick fix or strict logic)
    // User requested: item.stackable === true && item.quantity > 1.
    // Since we don't have full def here easily without registry lookups, we enforce count > 1 strict.
    // And ensure we don't show 0.
    const showCount = item && item.count > 1;

    // Focus overrides
    const focusClass = isFocused 
        ? "border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] scale-110 z-20 ring-2 ring-yellow-400/50 bg-black/60" 
        : `${tierBorder} hover:border-white/30 hover:bg-white/5 opacity-90`;

    const selectedClass = isSelected ? "bg-yellow-500/20 ring-2 ring-yellow-500/80" : "";

    const handleHover = () => {
        onHover(slotEnum);
        if (item) onHoverItem(item);
        else onHoverItem(null); // Or keep previous? Dashboard handles logic now.
    };

    return (
        <div 
            className={`
                relative w-16 h-16 rounded-xl border-2 transition-all duration-200 flex items-center justify-center bg-black/40 cursor-pointer group
                ${focusClass} ${selectedClass} ${tierShadow}
            `}
            onMouseEnter={handleHover}
            onMouseLeave={onLeave}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick(slotEnum);
            }}
        >
             {/* Rarity BG Glow */}
            {item && <div className={`absolute inset-0 ${tierBg} opacity-20 group-hover:opacity-40 transition-opacity rounded-xl`} />}

            {item ? (
                <>
                    <img 
                        src={`assets/items/${item.itemId}.png`} 
                        alt={item.itemId} 
                        className="w-12 h-12 pixelated object-contain relative z-10" 
                    />
                    
                    {/* Item Count */}
                    {showCount && (
                        <div className="absolute bottom-1 right-1 text-[10px] font-bold text-white drop-shadow-md z-20 bg-black/60 px-1.5 rounded-full border border-white/10">
                            {item.count}
                        </div>
                    )}

                    {/* Stars - NOW INSIDE (Top Right) to match Inventory */}
                    {(() => {
                        const stars = getItemStars(item);
                        if (stars.length > 0) {
                            return (
                                <div className="absolute top-1 right-1 z-20 flex flex-col gap-[1px]">
                                    {stars.map((quality, i) => (
                                        <StarIcon key={i} quality={quality} size={8} />
                                    ))}
                                </div>
                            );
                        }
                        return null;
                    })()}

                    {/* Equipped Label - Small, Top Center/Left */}
                    <div className="absolute top-1 left-1.5 text-[7px] text-white/30 uppercase font-bold tracking-wider z-10 pointer-events-none">
                        {slotName}
                    </div>
                </>
            ) : (
                // Empty Slot Label - Centered
                <span className="text-[10px] text-white/10 uppercase font-bold tracking-widest">{slotName}</span>
            )}
            
            {/* External Label REMOVED as per user request */}
        </div>
    );
});

export const HeroEquipmentPanel: React.FC<{
    focusedSlotName: EquipmentSlot;
    selectedSlot: EquipmentSlot | 'all' | 'consumables' | null;
    activeSection: string;
    onSlotHover: (slot: EquipmentSlot) => void;
    onSlotClick: (slot: EquipmentSlot) => void;
    onHoverItem: (item: any) => void;
    onLeaveItem: () => void; // Added prop
}> = React.memo(({ focusedSlotName, selectedSlot, activeSection, onSlotHover, onSlotClick, onHoverItem, onLeaveItem }) => {
    
    const { t } = useLanguage();
    const ps = PlayerState.getInstance();
    
    // Reactive Equipment Data
    const equipment = usePlayerState("equipmentChanged", () => ps.getEquipment(), {
        [EquipmentSlot.HEAD]: null, [EquipmentSlot.BODY]: null, [EquipmentSlot.LEGS]: null, [EquipmentSlot.BOOTS]: null, 
        [EquipmentSlot.MAIN_HAND]: null, [EquipmentSlot.OFF_HAND]: null, 
        [EquipmentSlot.NECK]: null, [EquipmentSlot.RING]: null, [EquipmentSlot.AMMO]: null
    } as any); 

    const getSlotLabel = (slot: string) => {
        // Map slot IDs to translation keys
        const map: Record<string, string> = {
            [EquipmentSlot.HEAD]: "head",
            [EquipmentSlot.NECK]: "neck",
            [EquipmentSlot.BODY]: "body",
            [EquipmentSlot.LEGS]: "legs",
            [EquipmentSlot.BOOTS]: "feet", 
            [EquipmentSlot.MAIN_HAND]: "hand",
            [EquipmentSlot.OFF_HAND]: "shield_slot", 
            [EquipmentSlot.AMMO]: "ammo",
            [EquipmentSlot.RING]: "ring"
        };
        const key = map[slot] || slot;
        return t(key as any) || slot;
    };

    const renderSlot = (slot: EquipmentSlot) => (
        <DashboardSlot 
            key={slot}
            slotEnum={slot}
            slotName={getSlotLabel(slot)}
            isFocused={activeSection === "EQUIPMENT" && focusedSlotName === slot}
            isSelected={selectedSlot === slot}
            item={(equipment as any)[slot]}
            onHover={onSlotHover}
            onLeave={onLeaveItem} // Pass down
            onClick={onSlotClick}
            onHoverItem={onHoverItem}
        />
    );

    return (
        <div 
            className="flex flex-col items-center gap-4 py-6 w-full"
            onClick={(e) => e.stopPropagation()}
        >
            <h3 className="text-white/40 text-[10px] font-bold tracking-[0.2em] uppercase mb-2 border-b border-white/10 pb-2 w-full text-center">
                {t("dashboard.equipment" as any) || "Equipment"}
            </h3>
            
            {/* Filter Buttons */}
            <div className="flex gap-2 mb-2">
                <button
                    onClick={() => onSlotClick('all' as any)}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-all ${
                        selectedSlot === 'all'
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                            : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                >
                    {t("all" as any) || "All"}
                </button>
                <button
                    onClick={() => onSlotClick('consumables' as any)}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-all ${
                        selectedSlot === 'consumables'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                            : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                >
                    {t("consumables" as any) || "Consumables"}
                </button>
            </div>
            
            {/* Paperdoll Grid */}
            <div className="relative">
                 {/* Background Silhouette (Optional) */}
                 <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                    {/* Could add a body silhouette image here */}
                 </div>

                <div className="grid grid-cols-3 gap-3 p-4 relative z-10 w-full max-w-[280px]">
                    
                    {/* Row 1: Amulet | Head | Ammo */}
                    <div className="flex justify-center items-end">{renderSlot(EquipmentSlot.NECK)}</div>
                    <div className="flex justify-center items-start">{renderSlot(EquipmentSlot.HEAD)}</div>
                    <div className="flex justify-center items-end">{renderSlot(EquipmentSlot.AMMO)}</div>

                    {/* Row 2: Weapon | Armor | Shield */}
                    <div className="flex justify-center items-center">{renderSlot(EquipmentSlot.MAIN_HAND)}</div>
                    <div className="flex justify-center items-center">{renderSlot(EquipmentSlot.BODY)}</div>
                    <div className="flex justify-center items-center">{renderSlot(EquipmentSlot.OFF_HAND)}</div>

                    {/* Row 3: Ring | Legs | (Empty) */}
                    <div className="flex justify-center items-start">{renderSlot(EquipmentSlot.RING)}</div>
                    <div className="flex justify-center items-start">{renderSlot(EquipmentSlot.LEGS)}</div>
                    <div className="flex justify-center items-start"></div> 

                    {/* Row 4: (Empty) | Boots | (Empty) */}
                    <div className="col-start-2 flex justify-center">{renderSlot(EquipmentSlot.BOOTS)}</div>
                </div>
            </div>
            
            <div className="text-white/30 text-[9px] mt-0 uppercase tracking-widest opacity-50">
                {activeSection === "EQUIPMENT" 
                    ? (t("dashboard.hint_nav" as any) || "Navigate / Select") 
                    : (t("dashboard.hint_select" as any) || "Equipment Panel")}
            </div>
        </div>
    );
});
