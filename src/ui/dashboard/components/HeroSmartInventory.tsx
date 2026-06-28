import React from "react";
import { EquipmentSlot, ItemType } from "../../../config/ItemConstants";
import { InventoryItem } from "../../../game/entities/Player/PlayerState";
import { useLanguage } from "../../../context/LanguageContext";
import { Ghost } from "lucide-react";
import { calculateItemScore, getItemTier } from "../../../game/utils/ItemUtils";
import {
  StarIcon,
  getItemStars,
  getItemBorder,
  TIER_BG,
} from "../../utils/ItemVisuals";
import { WeaponRegistry } from "../../../game/entities/weapons/WeaponRegistry";

// ... (helpers)

const InventorySlot: React.FC<{
  item: InventoryItem;
  index: number;
  isFocused: boolean;
  onClick: (index: number) => void;
  onHover: (item: any) => void;
  onLeave: () => void;
  onContextMenu: (event: React.MouseEvent, item: InventoryItem) => void;
}> = React.memo(
  ({ item, index, isFocused, onClick, onHover, onLeave, onContextMenu }) => {
    const score = calculateItemScore(item);
    const tier = getItemTier(score);
    const tierBorder = getItemBorder(score);

    return (
      <div
        className={`
            relative w-14 h-14 rounded border flex items-center justify-center bg-black/60
            transition-all duration-150 cursor-pointer group
            ${
              isFocused
                ? `border-white ring-2 ring-white/50 scale-110 z-20 bg-white/10 shadow-lg`
                : `${tierBorder} hover:bg-white/5 hover:border-white/50`
            }
            ${tier.shadow}
            `}
        onClick={(e) => {
          e.stopPropagation();
          onClick(index);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, item);
        }}
        onMouseEnter={() => onHover(item)}
        onMouseLeave={onLeave}
        title={`Inventory Item: ${item.itemId}`}
      >
        {/* Rarity BG Glow */}
        <div
          className={`absolute inset-0 ${tier.bg || TIER_BG.common} opacity-10 group-hover:opacity-20 transition-opacity`}
        />

        {item && (
          <>
            <img
              src={`assets/items/${item.itemId}.png`}
              alt={item.itemId}
              className="w-10 h-10 pixelated object-contain relative z-10"
            />

            {/* Count Indicator - Only if count > 1 */}
            {item.count > 1 && (
              <div className="absolute bottom-1 right-1 text-[9px] font-bold text-white drop-shadow-md z-20 bg-black/60 px-1 rounded-full border border-white/10">
                {item.count}
              </div>
            )}

            {/* Star / Tier Indicator */}
            {(() => {
              const stars = getItemStars(item);
              if (stars.length > 0) {
                return (
                  <div className="absolute top-1 right-1 z-20 flex flex-col gap-[1px]">
                    {stars.map((quality, i) => (
                      <StarIcon key={i} quality={quality} size={6} />
                    ))}
                  </div>
                );
              }

              // Non-Equipment Indicator
              const def = WeaponRegistry.getWeaponDefinition(item.itemId);
              if (
                def &&
                (def.consumable ||
                  def.type === ItemType.FOOD ||
                  def.type === ItemType.RESOURCE ||
                  def.type === ItemType.POTION)
              ) {
                return (
                  <div className="absolute top-1 right-1 z-20 text-white/40">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                  </div>
                );
              }

              return null;
            })()}
          </>
        )}
      </div>
    );
  },
);

export const HeroSmartInventory: React.FC<{
  activeSection: "EQUIPMENT" | "INVENTORY";
  selectedSlot: EquipmentSlot | "all" | "consumables" | null;
  focusedItemIndex: number;
  items: InventoryItem[];
  onEquip?: (item: InventoryItem) => void;
  onItemClick: (index: number) => void;
  onHoverItem: (item: any) => void;
  onLeaveItem: () => void;
  onItemContextMenu: (event: React.MouseEvent, item: InventoryItem) => void;
  filterMode?: "equipment" | "backpack" | "all";
}> = React.memo(
  ({
    activeSection,
    selectedSlot,
    focusedItemIndex,
    onEquip,
    items,
    onItemClick,
    onHoverItem,
    onLeaveItem,
    onItemContextMenu,
    filterMode = "all",
  }) => {
    const { t } = useLanguage();
    const filteredItems = items || [];

    return (
      <div
        className="h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Removed as per Clean Up request */}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 content-start custom-scrollbar">
          <div className="grid grid-cols-5 gap-3">
            {filteredItems.map((item, idx) => (
              <InventorySlot
                key={item.uid}
                item={item}
                index={idx}
                isFocused={
                  idx === focusedItemIndex && activeSection === "INVENTORY"
                }
                onClick={onItemClick}
                onHover={onHoverItem}
                onLeave={onLeaveItem}
                onContextMenu={onItemContextMenu}
              />
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="w-full h-full flex flex-col items-center justify-center min-h-[200px] text-white/20">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <Ghost size={24} className="opacity-50" />
              </div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
                {t("dashboard_empty" as any)}
              </p>
              <p className="text-[9px] text-white/20 mt-1">
                {selectedSlot
                  ? t("dashboard_no_items_compatible" as any)
                  : t("dashboard_inventory_empty" as any)}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  },
);
