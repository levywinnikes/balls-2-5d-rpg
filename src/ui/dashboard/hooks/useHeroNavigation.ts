import { useState, useEffect, useCallback } from "react";

import { EquipmentSlot } from "../../../config/ItemConstants";

export type Section = "EQUIPMENT" | "INVENTORY";
export type DashboardTab = "equipment" | "stats";

// Slot Order for Navigation
export const EQUIPMENT_SLOTS = [
    EquipmentSlot.HEAD, EquipmentSlot.BODY, EquipmentSlot.LEGS, EquipmentSlot.BOOTS, 
    EquipmentSlot.MAIN_HAND, EquipmentSlot.OFF_HAND, EquipmentSlot.AMMO, EquipmentSlot.NECK, EquipmentSlot.RING
];

export const useHeroNavigation = (isOpen: boolean) => {
    const [activeTab, setActiveTab] = useState<DashboardTab>("equipment");
    const [activeSection, setActiveSection] = useState<Section>("EQUIPMENT");
    const [focusedSlotIndex, setFocusedSlotIndex] = useState(0); // For Equipment
    const [focusedItemIndex, setFocusedItemIndex] = useState(0); // For Inventory
    const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot | 'all' | 'consumables' | null>(null); // Fixed slot for filtering

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setActiveTab("equipment");
            setActiveSection("EQUIPMENT");
            setFocusedSlotIndex(0);
            setFocusedItemIndex(0);
            setSelectedSlot(null);
        }
    }, [isOpen]);

    const handleEquipmentNav = useCallback((key: string) => {
        // Map visual layout to neighbors
        const neighbors: Partial<Record<EquipmentSlot, { up?: EquipmentSlot, down?: EquipmentSlot, left?: EquipmentSlot, right?: EquipmentSlot }>> = {
            [EquipmentSlot.NECK]: { down: EquipmentSlot.MAIN_HAND, right: EquipmentSlot.HEAD },
            [EquipmentSlot.HEAD]: { down: EquipmentSlot.BODY, left: EquipmentSlot.NECK, right: EquipmentSlot.AMMO },
            [EquipmentSlot.AMMO]: { down: EquipmentSlot.OFF_HAND, left: EquipmentSlot.HEAD },
            [EquipmentSlot.MAIN_HAND]: { up: EquipmentSlot.NECK, down: EquipmentSlot.RING, right: EquipmentSlot.BODY },
            [EquipmentSlot.BODY]: { up: EquipmentSlot.HEAD, down: EquipmentSlot.LEGS, left: EquipmentSlot.MAIN_HAND, right: EquipmentSlot.OFF_HAND },
            [EquipmentSlot.OFF_HAND]: { up: EquipmentSlot.AMMO, left: EquipmentSlot.BODY },
            [EquipmentSlot.RING]: { up: EquipmentSlot.MAIN_HAND, right: EquipmentSlot.LEGS },
            [EquipmentSlot.LEGS]: { up: EquipmentSlot.BODY, down: EquipmentSlot.BOOTS, left: EquipmentSlot.RING },
            [EquipmentSlot.BOOTS]: { up: EquipmentSlot.LEGS }
        };

        const currentSlot = EQUIPMENT_SLOTS[focusedSlotIndex];
        const mapping = neighbors[currentSlot];

        if (!mapping) return;

        let nextSlot: EquipmentSlot | undefined;

        if (key === "ArrowDown") nextSlot = mapping.down;
        else if (key === "ArrowUp") nextSlot = mapping.up;
        else if (key === "ArrowRight") nextSlot = mapping.right;
        else if (key === "ArrowLeft") nextSlot = mapping.left;
        else if (key === "Enter" || key === " ") {
            setSelectedSlot(currentSlot);
            setActiveSection("INVENTORY");
            setFocusedItemIndex(0);
            return;
        }

        if (nextSlot) {
            const nextIndex = EQUIPMENT_SLOTS.indexOf(nextSlot);
            if (nextIndex !== -1) setFocusedSlotIndex(nextIndex);
        }
    }, [focusedSlotIndex]);

    const handleInventoryNav = useCallback((key: string, filteredItemCount: number) => {
        const COLUMNS = 5; 
        
        if (filteredItemCount === 0) {
            if (key === "Escape") {
                setActiveSection("EQUIPMENT");
                setSelectedSlot(null);
            }
            return false;
        }

        if (key === "ArrowRight") {
            setFocusedItemIndex(prev => Math.min(prev + 1, filteredItemCount - 1));
        } else if (key === "ArrowLeft") {
            setFocusedItemIndex(prev => Math.max(prev - 1, 0));
        } else if (key === "ArrowDown") {
             setFocusedItemIndex(prev => Math.min(prev + COLUMNS, filteredItemCount - 1));
        } else if (key === "ArrowUp") {
             setFocusedItemIndex(prev => Math.max(prev - COLUMNS, 0));
        } else if (key === "Escape") {
             setActiveSection("EQUIPMENT");
             setSelectedSlot(null);
        } else if (key === "Enter" || key === " ") {
             return true; 
        }
        return false;
    }, []);

    const handleTabSwitch = useCallback((direction: "next" | "prev" | "toggle") => {
        setActiveTab(prev => {
            if (direction === "toggle") return prev === "equipment" ? "stats" : "equipment";
            // For now only 2 tabs, so next/prev is same as toggle
            return prev === "equipment" ? "stats" : "equipment";
        });
    }, []);

    return {
        activeTab,
        setActiveTab,
        activeSection,
        setActiveSection,
        focusedSlotIndex,
        setFocusedSlotIndex,
        focusedItemIndex,
        setFocusedItemIndex,
        selectedSlot,
        setSelectedSlot,
        handleEquipmentNav,
        handleInventoryNav,
        handleTabSwitch,
        focusedSlotName: EQUIPMENT_SLOTS[focusedSlotIndex]
    };
};
