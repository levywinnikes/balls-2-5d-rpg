import React from "react";
import { usePlayerState } from "../../hooks/usePlayerState";
import { PlayerState, InventoryItem } from "../../game/entities/Player/PlayerState";
import { WeaponDefinition, WeaponRegistry } from "../../game/entities/weapons/WeaponRegistry";
import { useUI } from "../../context/UIContext";
import { useLanguage } from "../../context/LanguageContext";
import { GhostImageUtils } from "../../game/utils/GhostImageUtils";

import { formatItemTooltip } from "../../game/utils/TooltipUtils";

const EquipSlot: React.FC<{
    label: string;
    item?: WeaponDefinition | null;
    itemObject?: InventoryItem | null; // NEW: Pass full object
    onClick?: () => void;
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnd?: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    className?: string;
    size?: number;
    expectedType?: string; // Type validation
}> = ({ label, item, itemObject, onClick, onDragStart, onDragEnd, onContextMenu, className, size, expectedType }) => {
    const { s, showTooltip, hideTooltip, groundDrag, draggedItem, setDraggedItem } = useUI();
    const { t } = useLanguage();

    const slotSize = size || s(34); // Default small size for sidebar
    
    // Determine if this slot is a valid target for the current drag
    let isValidTarget = false;
    
    // 1. Check Ground Drag
    if (groundDrag && groundDrag.item.weaponId) {
        const def = WeaponRegistry.getWeaponDefinition(groundDrag.item.weaponId);
        if (def && (def.type === expectedType || (expectedType === "hand" && (def.type === "melee" || def.type === "ranged")))) {
             isValidTarget = true;
        }
    }
    // 2. Check UI Drag (Inventory OR Container)
    else if (draggedItem && (draggedItem.source === "inventory" || draggedItem.source === "container")) {
        const def = WeaponRegistry.getWeaponDefinition(draggedItem.itemId);
        if (def && (def.type === expectedType || (expectedType === "hand" && (def.type === "melee" || def.type === "ranged")) || (expectedType === "shield" && (def.id === "torch" || def.id === "light_torch")))) {
             isValidTarget = true;
        }
    }
    // 3. Check UI Drag (Equipment)
    else if (draggedItem && draggedItem.source === "equipment") {
        const def = WeaponRegistry.getWeaponDefinition(draggedItem.itemId);
        if (def && (def.type === expectedType || (expectedType === "hand" && (def.type === "melee" || def.type === "ranged")) || (expectedType === "shield" && (def.id === "torch" || def.id === "light_torch")))) {
             isValidTarget = true;
        }
    }

    const handleMouseUp = () => {
        if (groundDrag && isValidTarget) {
            console.log(`Equip Item ${groundDrag.item.itemId} to ${expectedType}`);
            const ps = PlayerState.getInstance();
            if(ps.addItem(groundDrag.item.weaponId, 1, groundDrag.item.itemId)) {
                 ps.removePersistentDroppedItem(groundDrag.item.level, groundDrag.item.itemId);
                 ps.equipItem(groundDrag.item.weaponId);
                 ps.endGroundDrag(true); 
            }
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Stop bubbling
        
        const ps = PlayerState.getInstance();
        if(!draggedItem || !isValidTarget) return;

        // Use UID for precise item targeting from Inventory
        const targetId = draggedItem.source === "inventory" ? draggedItem.uid : draggedItem.itemId;

        if (draggedItem.source === "inventory") {
            // Explicit Slot Drop
            // We pass the UID and the expected slot.
            // PS.equipItem handles UID lookup.
            if (expectedType === "hand") ps.equipWeapon(targetId);
            else if (expectedType === "shield") ps.equipShield(targetId);
            else ps.equipItem(targetId, expectedType as any); 
            
            setDraggedItem(null);
        } else if (draggedItem.source === "container") {
             // Move Container -> Inventory -> Equip
             // For container items, we might not have a clean Inventory UID yet until added.
             // We use 'itemId' (Def ID) for the ADD, then equip?
             // Or simply: addItem(itemId) -> Returns success -> But we don't know the new UID.
             // Auto-equip usually picks the best (or first) item.
             
             if(ps.addItem(draggedItem.itemId, draggedItem.count)) {
                 if(draggedItem.containerId) ps.removeItemFromContainer(draggedItem.containerId, draggedItem.uid, draggedItem.count);
                 
                 // Now equip any item of that type?
                 // This is imprecise but standard for "Move and Equip".
                 if (expectedType === "hand") ps.equipWeapon(draggedItem.itemId);
                 else if (expectedType === "shield") ps.equipShield(draggedItem.itemId);
                 else ps.equipItem(draggedItem.itemId, expectedType as any); 
             } else {
                 PlayerState.getInstance().emit("uiNotification", { type: "error", message: t("msg_cap_full") });
             }
             setDraggedItem(null);
             PlayerState.getInstance().emit("uiDragEnd");
        } else if (draggedItem.source === "equipment") {
             // Swapping Equipment Slots?
             // Unequip current slot first
             const slot = draggedItem.uid.replace("equipped_", "");
             // Only if different from target?
             // If I drag Sword (Hand) to Shield (Shield Slot)?
             // And Sword is Melee? Shield Slot accepts Shield?
             // If I drag 2H Sword to Hand?
             
             // Logic: Just unequip the old one, then equip to new.
             if (slot === "weapon") ps.unequipWeapon();
             else ps.unequipItem(slot as any);
             
             if (expectedType === "hand") ps.equipWeapon(draggedItem.itemId);
             else if (expectedType === "shield") ps.equipShield(draggedItem.itemId);
             else ps.equipItem(draggedItem.itemId, expectedType as any);
             
             setDraggedItem(null);
             PlayerState.getInstance().emit("uiDragEnd");
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (isValidTarget) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
        }
    };

    const highlightStyle = isValidTarget 
        ? { borderColor: "#00d2ff", borderStyle: "dashed" } 
        : { borderColor: "#444" };

    return (
        <div
            onClick={onClick}
            onMouseUp={handleMouseUp}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            draggable={!!item}
            onDragStart={item && onDragStart ? onDragStart : undefined}
            onDragEnd={onDragEnd}
            onContextMenu={onContextMenu}
            onMouseEnter={(e) => {
                if (!item || groundDrag) return;
                
                // Use Object for Tooltip if available, else fallback
                const tooltipData = formatItemTooltip(item, { 
                    weaponId: item.id, 
                    count: 1, 
                    stars: itemObject?.stars, 
                    attributes: itemObject?.attributes 
                });

                showTooltip({
                    text: tooltipData.name || t(item.name as any), 
                    subtext: tooltipData.subtext,
                    x: e.clientX,
                    y: e.clientY,
                    item: item
                });
                if (!isValidTarget) e.currentTarget.style.borderColor = "#fbbf24";
            }}
            onMouseLeave={(e) => {
                hideTooltip();
                if (!isValidTarget) e.currentTarget.style.borderColor = "#444";
            }}
            className={`bg-[#222] border flex items-center justify-center cursor-default relative rounded text-[#555] uppercase ${className} ${item ? '!cursor-grab' : ''}`}
            style={{ 
                width: `${slotSize}px`, 
                height: `${slotSize}px`,
                ...highlightStyle
            }} 
        >
            {item ? (
                <div 
                    className="w-[90%] h-[90%] relative overflow-hidden flex items-center justify-center"
                    style={{ imageRendering: "pixelated" }}
                >
                    {item.id === "light_torch" ? (
                         <div 
                            style={{
                                width: "100%", 
                                height: "100%",
                                backgroundSize: "100% 100%", 
                                backgroundPosition: "center",
                                backgroundRepeat: "no-repeat",
                                animation: "play-torch-files 0.8s steps(1) infinite"
                            }}
                         />
                    ) : (
                        <img 
                            src={`assets/items/${item.id}.png`}
                            className="w-full h-full object-contain pixelated"
                            alt={item.name}
                        />
                    )}
                </div>
            ) : (
                <span className="text-[9px]" style={{ fontSize: size ? size * 0.25 : undefined }}>{label}</span>
            )}
        </div>
    );
};

export const EquipmentWidget: React.FC<{ customSlotSize?: number }> = ({ customSlotSize }) => {
    const playerState = PlayerState.getInstance();
    const { setDraggedItem, hideTooltip, s } = useUI();
    const { t } = useLanguage();

    const SLOT_SIZE = customSlotSize || s(44);

    // Data Hooks (Now fetching OBJECTS)
    const weaponItem = usePlayerState(["weaponEquipped", "reset"], () => playerState.getEquippedItemObject("weapon"), null);
    const helmetItem = usePlayerState(["equipmentChanged", "reset"], () => playerState.getEquippedItemObject("helmet"), null);
    const armorItemObj = usePlayerState(["equipmentChanged", "reset"], () => playerState.getEquippedItemObject("armor"), null);
    const legsItem = usePlayerState(["equipmentChanged", "reset"], () => playerState.getEquippedItemObject("legs"), null);
    const bootsItem = usePlayerState(["equipmentChanged", "reset"], () => playerState.getEquippedItemObject("boots"), null);
    const shieldItem = usePlayerState(["equipmentChanged", "reset"], () => playerState.getEquippedItemObject("shield"), null);

    // Helpers to get specific defs from objects if needed (EquipSlot usage might need updates)
    const getDef = (item: InventoryItem | null) => item ? WeaponRegistry.getWeaponDefinition(item.itemId) || null : null;

    const weapon = getDef(weaponItem);
    const helmet = getDef(helmetItem);
    const armorItem = getDef(armorItemObj);
    const legs = getDef(legsItem);
    const boots = getDef(bootsItem);
    const shield = getDef(shieldItem);

    const tryUnequip = (slot: string) => {
        let success = false;
        if (slot === "weapon") success = playerState.unequipWeapon();
        else if (slot === "shield") success = playerState.unequipItem("shield");
        else success = playerState.unequipItem(slot as any);

        if (!success) {
            playerState.emit("uiNotification", { type: "error", message: t("msg_cap_full") });
        }
    };

    const handleDragStart = (e: React.DragEvent, item: WeaponDefinition, slotId: string) => {
        hideTooltip();
        const mockInvItem: InventoryItem = {
            uid: `equipped_${slotId}`,
            itemId: item.id,
            count: 1
        };
        e.stopPropagation(); // Prevent parent window drag
        setDraggedItem({ ...mockInvItem, source: "equipment" } as any);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", JSON.stringify({ uid: mockInvItem.uid, source: "equipment" })); // Required for drag
        const ghost = GhostImageUtils.getEmptyDragImage();
        e.dataTransfer.setDragImage(ghost, 0, 0);
        
        PlayerState.getInstance().emit("uiDragStart");
    };

    const handleDragEnd = () => {
        // Small delay to ensure Drop event fires before clearing state (HTML5 DnD Race Condition)
        setTimeout(() => {
            setDraggedItem(null);
            hideTooltip();
            PlayerState.getInstance().emit("uiDragEnd");
        }, 50);
    };

    return (
        <div className="bg-[#1a1a1a] border border-[#333] p-3 rounded mb-2 shadow-lg flex flex-col items-center gap-2 w-full self-center">
            {/* TOP ROW: HEAD */}
            <EquipSlot 
                label={t("head")} 
                item={helmet}
                itemObject={helmetItem}
                size={SLOT_SIZE}
                expectedType="helmet"
                onClick={() => tryUnequip("helmet")}
                onDragStart={(e) => helmet && handleDragStart(e, helmet, 'helmet')}
                onDragEnd={handleDragEnd}
            />
            
            {/* MIDDLE ROW: WEAPON | BODY | SHIELD */}
            <div className="flex gap-2 items-center">
                 <EquipSlot
                    label={t("hand")}
                    item={weapon}
                    itemObject={weaponItem}
                    size={SLOT_SIZE}
                    expectedType="hand"
                    onClick={() => {
                        if (weapon && (weapon.id === "torch" || weapon.id === "light_torch")) {
                            playerState.toggleEquippedTorch();
                        } else {
                            tryUnequip("weapon");
                        }
                    }}
                    onDragStart={(e) => weapon && handleDragStart(e, weapon, 'weapon')}
                    onDragEnd={handleDragEnd}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        if (weapon && (weapon.id === "torch" || weapon.id === "light_torch")) {
                            playerState.toggleEquippedTorch();
                        }
                    }}
                />
                 <EquipSlot 
                    label={t("body")}
                    item={armorItem}
                    itemObject={armorItemObj}
                    size={SLOT_SIZE}
                    expectedType="armor"
                    onClick={() => tryUnequip("armor")}
                    onDragStart={(e) => armorItem && handleDragStart(e, armorItem, 'armor')}
                    onDragEnd={handleDragEnd}
                />
                 <EquipSlot 
                    label={t("shield")}
                    item={shield}
                    itemObject={shieldItem}
                    size={SLOT_SIZE}
                    expectedType="shield"
                    onClick={() => {
                        if (shield && (shield.id === "torch" || shield.id === "light_torch")) {
                            playerState.toggleEquippedTorch();
                        } else {
                            tryUnequip("shield");
                        }
                    }}
                    onDragStart={(e) => shield && handleDragStart(e, shield, 'shield')}
                    onDragEnd={handleDragEnd}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        if (shield && (shield.id === "torch" || shield.id === "light_torch")) {
                            playerState.toggleEquippedTorch();
                        }
                    }}
                />
            </div>

            {/* LEGS */}
            <EquipSlot 
                label={t("legs")}
                item={legs}
                itemObject={legsItem}
                size={SLOT_SIZE}
                expectedType="legs"
                onClick={() => tryUnequip("legs")}
                onDragStart={(e) => legs && handleDragStart(e, legs, 'legs')}
                onDragEnd={handleDragEnd}
            />

            {/* FEET */}
            <EquipSlot 
                label={t("feet")}
                item={boots}
                itemObject={bootsItem}
                size={SLOT_SIZE}
                expectedType="boots"
                onClick={() => tryUnequip("boots")}
                onDragStart={(e) => boots && handleDragStart(e, boots, 'boots')}
            />

            {/* CSS Animation for Torch */}
            <style>{`
                @keyframes play-strip {
                    from { background-position: 0 0; }
                    to { background-position: -400% 0; } 
                }
            `}</style>
        </div>
    );
};
