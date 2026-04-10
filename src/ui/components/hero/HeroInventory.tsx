import React, { useState } from "react";
import { Grid, List } from "lucide-react";
import { useUI } from "../../../context/UIContext";
import { useLanguage } from "../../../context/LanguageContext";
import { usePlayerState } from "../../../hooks/usePlayerState";
import { PlayerState, InventoryItem } from "../../../game/entities/Player/PlayerState";
import { RPGSlot } from "../common/RPGSlot";
import { formatItemTooltip } from "../../../game/utils/TooltipUtils";

import { WeaponDefinition } from "../../../game/entities/weapons/WeaponRegistry";

interface HeroInventoryProps {
    items: (InventoryItem & { def: WeaponDefinition })[];
    balance: number;
}

export const HeroInventory = React.memo(({ items, balance }: HeroInventoryProps) => {
    const { 
        setDraggedItem, showTooltip, hideTooltip, draggedItem
    } = useUI();
    const { t } = useLanguage();
    // ps removed as we use props, but we still need it for drag/drop handlers?
    // Wait, handlers below use 'ps'. So we need to keep 'ps' instance but NOT subscriptions.
    const ps = PlayerState.getInstance();

    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    
    // Handlers
    const handleDragStart = (e: React.DragEvent, item: InventoryItem) => {
        hideTooltip();
        setDraggedItem({ ...item, source: "inventory" });
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", JSON.stringify({ uid: item.uid, source: "inventory" }));
        const img = new Image();
        img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        e.dataTransfer.setDragImage(img, 0, 0);
        ps.emit("uiDragStart");
    };

    const handleDragEnd = () => {
        hideTooltip();
        setDraggedItem(null);
        ps.emit("uiDragEnd");
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!draggedItem) return;

        if (draggedItem.source === "container" && draggedItem.containerId) {
             if (ps.removeItemFromContainer(draggedItem.containerId, draggedItem.uid, draggedItem.count)) {
                 if (!ps.addInventoryItem(draggedItem.itemId, draggedItem.count)) {
                      ps.addItemToContainer(draggedItem.containerId, draggedItem.itemId, draggedItem.count);
                 }
             }
             setDraggedItem(null);
        }
        else if (draggedItem.source === "equipment") {
             const slot = draggedItem.uid.replace("equipped_", "");
             if (slot === "weapon") ps.unequipWeapon();
             else ps.unequipItem(slot as any); 
             setDraggedItem(null);
        }
    };

    const handleItemClick = (e: React.MouseEvent, item: InventoryItem) => {
        hideTooltip();
        if (e.shiftKey) {
            ps.requestItemDrop(item.uid);
        } else {
            ps.equipItem(item.itemId);
        }
    };

    return (
        <div 
            className="flex-1 bg-[var(--bg-glass)] border border-[var(--border-subtle)] rounded p-1 flex flex-col shadow-sm backdrop-blur-sm min-h-[150px] shrink-0"
            onDragOver={(e) => e.preventDefault()} 
            onDrop={handleDrop}
        >   
            <div className="flex justify-between items-center px-1 mb-1 border-b border-[var(--border-subtle)] pb-1">
                <div className="flex flex-col">
                    <span className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">{t("backpack")} ({items.length} items)</span>
                    <span className="text-xs text-[var(--accent-gold)] font-bold tracking-wider">💰 {balance} GC</span>
                </div>
                <div className="flex gap-1">
                        <button onClick={() => setViewMode("grid")} className={`p-1 rounded transition-colors ${viewMode==="grid"?"bg-[var(--bg-glass-hover)] text-[var(--accent-gold)]":"text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}><Grid size={12}/></button>
                        <button onClick={() => setViewMode("list")} className={`p-1 rounded transition-colors ${viewMode==="list"?"bg-[var(--bg-glass-hover)] text-[var(--accent-gold)]":"text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}><List size={12}/></button>
                </div>
            </div>

            <div className="flex-1 custom-scrollbar overflow-y-auto p-1 bg-black/20 rounded inner-shadow" style={{ minHeight: "150px" }}>
                {viewMode === "grid" ? (
                    <div className="flex flex-wrap gap-1 content-start">
                        {items.map((slot) => (
                            <RPGSlot
                                key={slot.uid}
                                item={slot}
                                def={slot.def}
                                onClick={(e: React.MouseEvent) => handleItemClick(e, slot)}
                                onDragStart={(e: React.DragEvent) => handleDragStart(e, slot)}
                                onDragEnd={handleDragEnd}
                                onMouseEnter={(e: React.MouseEvent) => showTooltip({
                                    text: t(slot.def.name as any),
                                    subtext: formatItemTooltip(slot.def, { 
                                        weaponId: slot.def.id, 
                                        itemId: slot.uid, 
                                        count: slot.count,
                                        stars: slot.stars,
                                        attributes: slot.attributes
                                    }).subtext,
                                    x: e.clientX, y: e.clientY, item: slot.def
                                })}
                                onMouseLeave={hideTooltip}
                                size={36}
                            />
                        ))}
                        {Array.from({ length: Math.max(0, 30 - items.length) }).map((_, i) => (
                            <RPGSlot key={`empty-${i}`} size={36} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {items.map((slot) => (
                            <div
                                key={slot.uid}
                                onClick={(e) => handleItemClick(e, slot)}
                                draggable
                                onDragStart={(e) => handleDragStart(e, slot)}
                                onContextMenu={(e) => { e.preventDefault(); ps.consumeItem(slot.uid); }}
                                className="flex items-center gap-2 p-1 rounded border border-[var(--border-subtle)] bg-black/20 hover:bg-[var(--bg-glass-hover)] hover:border-[var(--border-highlight)] cursor-grab transition-all"
                            >
                                <div className="w-6 h-6 bg-black/40 rounded flex items-center justify-center border border-[var(--border-subtle)]">
                                        <img src={`assets/items/${slot.def.id}.png`} alt={slot.def.name} className="w-full h-full object-contain pixelated" />
                                </div>
                                <div className="flex-1 text-xs text-[var(--text-primary)]">
                                    {t(slot.def.name as any)} {slot.count > 1 && <span className="text-[var(--text-muted)]">(x{slot.count})</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});
