import React, { useState, useEffect, useCallback, useMemo } from "react";
// Removed unused useUI import
import { useWindowSystem } from "../components/window/WindowContext";
import { X, Sword, Shield } from "lucide-react";

// Components
import { HeroEquipmentPanel } from "./components/HeroEquipmentPanel";
import { HeroSmartInventory } from "./components/HeroSmartInventory";
import { HeroStatsTab } from "../components/hero/HeroStatsTab";
import { ItemDetailPanel } from "./components/ItemDetailPanel";
import { StatDetailPanel } from "./components/StatDetailPanel";
import { DPSDetailPanel } from "./components/DPSDetailPanel";
import { AttackSpeedDetailPanel } from "./components/AttackSpeedDetailPanel";
import { StarPointsDetailPanel } from "./components/StarPointsDetailPanel";
import { ConditionDetailPanel } from "./components/ConditionDetailPanel";
import { ContextMenu, type ContextMenuOption } from "../components/ContextMenu";
import { useHeroNavigation } from "./hooks/useHeroNavigation";

// Game Data
import { PlayerState } from "../../game/entities/Player/PlayerState";
import type { InventoryItem } from "../../game/entities/Player/PlayerState";
import { usePlayerState } from "../../hooks/usePlayerState";
import { useLanguage } from "../../context/LanguageContext";
import { WeaponRegistry } from "../../game/entities/weapons/WeaponRegistry";
import { FoodRegistry } from "../../game/entities/food/FoodRegistry"; // ADDED
import {
  EquipmentSlot,
  SLOT_COMPATIBILITY,
  ItemType,
} from "../../config/ItemConstants";

export const HeroDashboard: React.FC = () => {
  const { isWindowOpen, closeWindow } = useWindowSystem();
  const isOpen = isWindowOpen("hero_menu");
  const { t } = useLanguage();

  // Sync Input Blocking and Game Pause
  useEffect(() => {
    const ps = PlayerState.getInstance();
    ps.setInputBlocked(isOpen);

    // Pause/Resume game to improve FPS
    if (isOpen) {
      ps.pauseGame();
    } else {
      ps.resumeGame();
    }
  }, [isOpen]);

  // Navigation Hook
  const {
    activeTab,
    setActiveTab,
    activeSection,
    setActiveSection,
    setFocusedSlotIndex,
    focusedItemIndex,
    setFocusedItemIndex,
    selectedSlot, // Now potentially EquipmentSlot
    setSelectedSlot,
    handleEquipmentNav,
    handleInventoryNav,
    handleTabSwitch,
    focusedSlotName,
  } = useHeroNavigation(isOpen);

  // Data Fetching - FIX REACTIVITY by cloning array
  const inventory = usePlayerState(
    "inventoryUpdated",
    () => [...PlayerState.getInstance().getInventory()],
    [],
  );
  const equipment = usePlayerState(
    "equipmentChanged",
    () => {
      const ps = PlayerState.getInstance();
      return {
        [EquipmentSlot.MAIN_HAND]: ps.equippedWeaponItem,
        [EquipmentSlot.OFF_HAND]: ps.equippedShieldItem,
        [EquipmentSlot.HEAD]: ps.equippedHelmetItem,
        [EquipmentSlot.BODY]: ps.equippedArmorItem,
        [EquipmentSlot.LEGS]: ps.equippedLegsItem,
        [EquipmentSlot.BOOTS]: ps.equippedBootsItem,
        [EquipmentSlot.RING]: ps.equippedRingItem,
        [EquipmentSlot.NECK]: ps.equippedNeckItem, // Ensure these are mapped
        [EquipmentSlot.AMMO]: ps.equippedAmmoItem,
      } as Record<EquipmentSlot, any>;
    },
    {} as any,
  ); // Fixed default value

  // ... (cache logic)

  // Optimized Handlers

  // Cache item definitions to avoid repeated registry lookups
  const itemDefsCache = useMemo(() => {
    const cache = new Map();
    inventory.forEach((item: any) => {
      if (!cache.has(item.itemId)) {
        const def =
          WeaponRegistry.getWeaponDefinition(item.itemId) ||
          FoodRegistry.foods.find((f) => f.id === item.itemId);
        // Add other registries if needed (Shields usually covered by WeaponRegistry in some contexts, but let's be safe)
        // Actually ShieldRegistry is imported in ItemDetailPanel but not here?
        // Let's assume WeaponRegistry covers most, but Food was missing.
        cache.set(item.itemId, def);
      }
    });
    return cache;
  }, [inventory]);

  // Derived Filter for Navigation Limits (Memoized with cache)
  const filteredItems = useMemo(() => {
    // Special filter: Show all items
    if (selectedSlot === "all") return inventory;

    // Special filter: Show only consumables (Food, Runes, Potions)
    if (selectedSlot === "consumables") {
      return inventory.filter((item: any) => {
        const def = itemDefsCache.get(item.itemId);
        if (!def) return false;
        const type = def.type;
        return (
          type === ItemType.FOOD ||
          type === ItemType.RUNE ||
          type === ItemType.POTION
        );
      });
    }

    // No filter selected: show all
    if (!selectedSlot) return inventory;

    // Equipment slot filter
    return inventory.filter((item: any) => {
      const def = itemDefsCache.get(item.itemId);
      if (!def) {
        return false;
      }
      const type = def.type;

      // Check Matrix
      const slotKey = selectedSlot as EquipmentSlot;
      const allowedTypes = SLOT_COMPATIBILITY[slotKey];

      if (!allowedTypes) {
        return true;
      }

      return allowedTypes.includes(type);
    });
  }, [selectedSlot, itemDefsCache, inventory]);

  // Hover State (Visual Preview Only)
  const [hoveredItem, setHoveredItem] = useState<any | null>(null);
  const [inventoryContextMenu, setInventoryContextMenu] = useState<{
    x: number;
    y: number;
    item: InventoryItem;
    options: ContextMenuOption[];
  } | null>(null);

  // Get selected equipped item (when equipment slot is clicked)
  // Get selected equipped item (when equipment slot is clicked)
  const selectedEquippedItem =
    selectedSlot && selectedSlot !== "all" && selectedSlot !== "consumables"
      ? (equipment as any)[selectedSlot as EquipmentSlot]
      : null;

  // Left Panel State (Item Details vs Stat Breakdown)
  const [leftPanelMode, setLeftPanelMode] = useState<
    "item" | "stat" | "condition"
  >("item");
  const [selectedStat, setSelectedStat] = useState<{
    key: string;
    label: string;
  } | null>(null);
  const [selectedCondition, setSelectedCondition] = useState<
    | "willpower"
    | "hunger"
    | "strength"
    | "dexterity"
    | "intelligence"
    | "reflex"
    | "characterLevel"
    | null
  >(null);

  // Initial Load Fix: Force update inventory/equipment on mount
  useEffect(() => {
    if (isOpen) {
      PlayerState.getInstance().emit("inventoryUpdated");
      PlayerState.getInstance().emit("equipmentChanged");
    }
  }, [isOpen]);

  // Input Handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const keys = [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Enter",
        " ",
        "Escape",
        "Tab",
        "q",
        "e",
      ];
      if (!keys.includes(e.key.toLowerCase()) && !keys.includes(e.key)) return;

      // Tab / Q / E Handling
      if (
        e.key === "Tab" ||
        e.key.toLowerCase() === "q" ||
        e.key.toLowerCase() === "e"
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleTabSwitch("toggle");
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (activeTab === "stats") {
        if (e.key === "Escape") {
          closeWindow("hero_menu");
        }
        return;
      }

      // Clear hover on keyboard nav to avoid confusion
      setHoveredItem(null);

      // Equipment Tab Navigation
      if (activeSection === "EQUIPMENT") {
        handleEquipmentNav(e.key);
        if (e.key === "Escape") closeWindow("hero_menu");
      } else {
        handleInventoryNav(e.key, filteredItems.length);
        if (e.key === "Enter" || e.key === " ") {
          // Use / Equip Logic
          if (filteredItems[focusedItemIndex]) {
            const globalIndex = inventory.findIndex(
              (i: any) => i.uid === filteredItems[focusedItemIndex].uid,
            );
            if (globalIndex !== -1) {
              PlayerState.getInstance().useInventoryItem(globalIndex);
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [
    isOpen,
    activeTab,
    activeSection,
    filteredItems,
    focusedItemIndex,
    selectedSlot,
    setFocusedSlotIndex,
    closeWindow,
    handleEquipmentNav,
    handleInventoryNav,
    handleTabSwitch,
    inventory,
  ]);

  // CSS Classes for transitions (Optimized Blur)
  const containerClasses = `
        fixed top-0 right-0 h-full w-[45vw] 
        bg-black/90 border-l border-white/10 shadow-2xl 
        transition-transform duration-300 ease-out z-[100]
        flex flex-col
        ${isOpen ? "translate-x-0" : "translate-x-full"}
        pointer-events-auto
    `;

  // Optimized Handlers
  const handleSlotClick = useCallback(
    (slotEnum: EquipmentSlot) => {
      setSelectedSlot(slotEnum);
      setFocusedItemIndex(-1); // Explicitly deselect inventory
      setActiveSection("EQUIPMENT"); // Keep section as EQUIPMENT to show selected item details
      setHoveredItem(null);
    },
    [setSelectedSlot, setFocusedItemIndex, setActiveSection],
  );

  const handleItemHover = useCallback((item: any) => {
    setHoveredItem((prev: any) => {
      if (prev === item || (prev && item && prev.uid === item.uid)) return prev;
      return item;
    });
    setLeftPanelMode("item"); // Reset to item mode when hovering items
  }, []);

  const handleItemLeave = useCallback(() => {
    setHoveredItem(null); // On blur, clear hover so it falls back to selected
  }, []);

  const handleItemClick = useCallback(
    (index: number) => {
      setFocusedItemIndex(index);
      setFocusedSlotIndex(-1); // Deselect equipment when selecting inventory
      setActiveSection("INVENTORY");
      setHoveredItem(null);
      setLeftPanelMode("item");
    },
    [setFocusedItemIndex, setFocusedSlotIndex, setActiveSection],
  );

  const handleSlotHover = useCallback((slot: EquipmentSlot) => {
    // No-op
  }, []);

  const buildInventoryContextOptions = useCallback(
    (item: InventoryItem): ContextMenuOption[] => {
      const def =
        WeaponRegistry.getWeaponDefinition(item.itemId) ||
        FoodRegistry.foods.find((food) => food.id === item.itemId);
      if (!def) {
        return [{ label: "Largar", action: "drop" }];
      }

      const isConsumable =
        !!def.consumable ||
        def.type === ItemType.FOOD ||
        def.type === ItemType.POTION;
      const isEquippable =
        !isConsumable &&
        def.type !== ItemType.RUNE &&
        def.type !== ItemType.RESOURCE &&
        def.type !== ItemType.CONTAINER;

      const options: ContextMenuOption[] = [];
      if (isConsumable) {
        options.push({ label: "Usar", action: "use" });
      }
      if (isEquippable) {
        options.push({ label: "Equipar", action: "equip" });
      }
      options.push({ label: "Largar", action: "drop" });
      return options;
    },
    [],
  );

  const handleInventoryContextMenu = useCallback(
    (event: React.MouseEvent, item: InventoryItem) => {
      setFocusedItemIndex(filteredItems.findIndex((entry) => entry.uid === item.uid));
      setFocusedSlotIndex(-1);
      setActiveSection("INVENTORY");
      setHoveredItem(item);
      setLeftPanelMode("item");
      setInventoryContextMenu({
        x: event.clientX,
        y: event.clientY,
        item,
        options: buildInventoryContextOptions(item),
      });
    },
    [
      buildInventoryContextOptions,
      filteredItems,
      setActiveSection,
      setFocusedItemIndex,
      setFocusedSlotIndex,
    ],
  );

  const handleInventoryContextSelect = useCallback(
    (action: string) => {
      if (!inventoryContextMenu) {
        return;
      }

      const item = inventoryContextMenu.item;
      const globalIndex = inventory.findIndex((entry: any) => entry.uid === item.uid);
      if (globalIndex === -1) {
        setInventoryContextMenu(null);
        return;
      }

      const ps = PlayerState.getInstance();
      if (action === "equip") {
        ps.equipItem(item.uid);
      } else if (action === "use") {
        ps.useInventoryItem(globalIndex);
      } else if (action === "drop") {
        ps.dropItem(globalIndex);
      }

      setInventoryContextMenu(null);
    },
    [inventory, inventoryContextMenu],
  );

  const handleStatSelect = useCallback((statKey: string, label: string) => {
    // Check if it's a core attribute (use condition panel) or derived stat (use stat panel)
    const coreAttributes = [
      "strength",
      "dexterity",
      "intelligence",
      "reflex",
      "characterLevel",
    ];
    if (coreAttributes.includes(statKey)) {
      setSelectedCondition(
        statKey as
          | "strength"
          | "dexterity"
          | "intelligence"
          | "reflex"
          | "characterLevel",
      );
      setLeftPanelMode("condition");
    } else {
      setSelectedStat({ key: statKey, label });
      setLeftPanelMode("stat");
    }
  }, []);

  const handleConditionClick = useCallback(
    (conditionType: "willpower" | "hunger") => {
      setSelectedCondition(conditionType);
      setLeftPanelMode("condition");
    },
    [],
  );

  // Initial Load Fix: Force update inventory/equipment on mount
  useEffect(() => {
    if (isOpen) {
      // Force a refresh from PlayerState even if no event fired yet
      const ps = PlayerState.getInstance();
      if (
        ps.getInventory().length > 0 ||
        Object.keys(ps.getEquipment()).length > 0
      ) {
        ps.emit("inventoryUpdated");
        ps.emit("equipmentChanged");
      }
    }
  }, [isOpen]);

  return (
    <>
      {/* Backdrop (Only visible when open) */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 z-[90] ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => closeWindow("hero_menu")}
      />

      {/* Dashboard Panel */}
      <div className={containerClasses} onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-12 h-full">
          {/* LEFT COLUMN (Details) */}
          <div className="col-span-4 border-r border-white/10 bg-black/40 h-full overflow-hidden relative">
            {/* Switch between Item Details, Stat Breakdown, and Condition Details */}
            {leftPanelMode === "condition" && selectedCondition ? (
              <ConditionDetailPanel conditionType={selectedCondition} />
            ) : leftPanelMode === "stat" &&
              selectedStat?.key === "starPoints" ? (
              <StarPointsDetailPanel />
            ) : leftPanelMode === "stat" && selectedStat?.key === "dps" ? (
              <DPSDetailPanel />
            ) : leftPanelMode === "stat" && selectedStat?.key === "cooldown" ? (
              <AttackSpeedDetailPanel />
            ) : leftPanelMode === "stat" && selectedStat ? (
              <StatDetailPanel
                statKey={selectedStat.key}
                label={selectedStat.label}
              />
            ) : activeTab === "equipment" ? (
              // Show equipped item if equipment slot is selected, otherwise show inventory item
              (() => {
                const focusedInventoryItem = filteredItems[focusedItemIndex];
                // Precedence: Hover -> Active Section's Selection -> Fallback
                const targetItem =
                  hoveredItem ||
                  (activeSection === "EQUIPMENT"
                    ? selectedEquippedItem
                    : focusedInventoryItem) ||
                  selectedEquippedItem ||
                  focusedInventoryItem;

                return targetItem ? (
                  <ItemDetailPanel
                    item={targetItem}
                    isEquipped={
                      !!selectedEquippedItem &&
                      targetItem === selectedEquippedItem
                    }
                    onLight={(() => {
                      return targetItem.itemId === "torch"
                        ? () => PlayerState.getInstance().lightTorch()
                        : undefined;
                    })()}
                    onExtinguish={(() => {
                      return targetItem.itemId === "light_torch"
                        ? () => PlayerState.getInstance().extinguishTorch()
                        : undefined;
                    })()}
                    onUse={() => {
                      if (!targetItem) return;
                      const globalIndex = inventory.findIndex(
                        (i: any) => i.uid === targetItem.uid,
                      );
                      if (globalIndex !== -1) {
                        PlayerState.getInstance().useInventoryItem(globalIndex);
                      }
                    }}
                    onEquip={() => {
                      if (!targetItem) return;
                      PlayerState.getInstance().equipItem(targetItem.uid);
                    }}
                    onUnequip={() => {
                      if (
                        selectedSlot &&
                        selectedSlot !== "all" &&
                        selectedSlot !== "consumables"
                      ) {
                        const slotMap: Record<EquipmentSlot, string> = {
                          [EquipmentSlot.MAIN_HAND]: "weapon",
                          [EquipmentSlot.OFF_HAND]: "shield",
                          [EquipmentSlot.HEAD]: "helmet",
                          [EquipmentSlot.BODY]: "armor",
                          [EquipmentSlot.LEGS]: "legs",
                          [EquipmentSlot.BOOTS]: "boots",
                          [EquipmentSlot.RING]: "ring",
                          [EquipmentSlot.NECK]: "neck",
                          [EquipmentSlot.AMMO]: "ammo",
                        };
                        const slot = slotMap[selectedSlot as EquipmentSlot];
                        if (slot) {
                          PlayerState.getInstance().unequipItem(slot as any);
                        }
                      }
                    }}
                    onDrop={() => {
                      if (!targetItem) return;
                      const globalIndex = inventory.findIndex(
                        (i: any) => i.uid === targetItem.uid,
                      );

                      if (globalIndex !== -1) {
                        PlayerState.getInstance().dropItem(globalIndex);
                      }
                    }}
                    isEquippable={true}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-white/20 text-xs uppercase tracking-widest">
                    {t("dashboard_select_item" as any)}
                  </div>
                );
              })()
            ) : (
              <div className="h-full flex items-center justify-center text-white/20 text-xs uppercase tracking-widest p-8 text-center">
                {t("character_overview" as any)}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN (Content) */}
          <div className="col-span-8 flex flex-col h-full bg-black/10">
            {/* Header / Tabs */}
            <div className="h-16 border-b border-white/10 flex items-center justify-center px-6 bg-white/5 relative z-[110] gap-8">
              {/* Overview Tab - Hidden as per user request (redundant/unused)
                                <button 
                                    className={`flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-colors cursor-pointer z-50 ${activeTab === 'overview' ? 'text-yellow-400' : 'text-white/40 hover:text-white'}`}
                                    onClick={() => setActiveTab('overview')}
                                >
                                    <div className={`p-1.5 rounded ${activeTab === 'overview' ? 'bg-yellow-400/10' : 'bg-white/5'}`}>
                                        <Ghost size={16} />
                                    </div>
                                    {t("overview" as any)}
                                </button>
                                */}

              <button
                className={`flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-colors cursor-pointer z-50 ${activeTab === "equipment" ? "text-yellow-400" : "text-white/40 hover:text-white"}`}
                onClick={() => setActiveTab("equipment")}
              >
                <div
                  className={`p-1.5 rounded ${activeTab === "equipment" ? "bg-yellow-400/10" : "bg-white/5"}`}
                >
                  <Sword size={16} />
                </div>
                {t("equipment" as any)}
              </button>

              <button
                className={`flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-colors cursor-pointer z-50 ${activeTab === "stats" ? "text-yellow-400" : "text-white/40 hover:text-white"}`}
                onClick={() => setActiveTab("stats")}
              >
                <div
                  className={`p-1.5 rounded ${activeTab === "stats" ? "bg-yellow-400/10" : "bg-white/5"}`}
                >
                  <Shield size={16} />
                </div>
                {t("attributes" as any)}
              </button>

              {/* Close Button */}
              <button
                onClick={() => closeWindow("hero_menu")}
                className="absolute right-6 p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all"
                title="Close Hero Menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
              {activeTab === "equipment" && (
                <div className="h-full flex flex-col">
                  {/* Equipment Slots */}
                  <div className="flex-none p-6 border-b border-white/5 bg-gradient-to-b from-black/20 to-transparent">
                    <HeroEquipmentPanel
                      activeSection={activeSection}
                      focusedSlotName={focusedSlotName}
                      selectedSlot={selectedSlot}
                      onSlotClick={handleSlotClick}
                      onSlotHover={handleSlotHover}
                      onHoverItem={handleItemHover}
                      onLeaveItem={handleItemLeave} // NEW PROP
                    />
                  </div>

                  {/* Inventory Grid */}
                  <div className="flex-1 overflow-hidden flex flex-col bg-black/20">
                    {/* Removed Redundant Header */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                      <HeroSmartInventory
                        items={filteredItems}
                        focusedItemIndex={focusedItemIndex}
                        activeSection={activeSection}
                        selectedSlot={selectedSlot}
                        onItemClick={handleItemClick}
                        onHoverItem={handleItemHover}
                        onLeaveItem={handleItemLeave} // NEW PROP
                        onItemContextMenu={handleInventoryContextMenu}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "stats" && (
                <div className="h-full overflow-y-auto p-6 custom-scrollbar">
                  <HeroStatsTab
                    onStatSelect={handleStatSelect}
                    onConditionClick={handleConditionClick}
                  />
                </div>
              )}
            </div>

            {/* Footer Controls Hint */}
            <div className="h-10 border-t border-white/10 bg-black/40 flex items-center justify-center gap-6 text-[10px] text-white/40 uppercase tracking-widest shrink-0">
              <span className="flex items-center gap-1">
                <kbd className="bg-white/10 px-1 rounded">TAB</kbd>{" "}
                {t("dashboard.hint_switch_tab" as any)}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-white/10 px-1 rounded">Arrows</kbd>{" "}
                {t("dashboard.hint_nav" as any)}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-white/10 px-1 rounded">Enter</kbd>{" "}
                {t("dashboard.hint_select" as any)}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-white/10 px-1 rounded">Esc</kbd>{" "}
                {t("dashboard.hint_back" as any)}
              </span>
            </div>
          </div>
        </div>
        {inventoryContextMenu && (
          <ContextMenu
            x={inventoryContextMenu.x}
            y={inventoryContextMenu.y}
            options={inventoryContextMenu.options}
            onSelect={handleInventoryContextSelect}
            onClose={() => setInventoryContextMenu(null)}
          />
        )}
      </div>
    </>
  );
};
