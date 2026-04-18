import React from "react";
import { InventoryItem } from "../../../game/entities/Player/PlayerState";
import { WeaponDefinition } from "../../../game/entities/weapons/WeaponRegistry";

interface RPGSlotProps {
  item?: InventoryItem; // If null, renders empty slot
  def?: WeaponDefinition; // Definition for image/name
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  selected?: boolean;
  className?: string;
  size?: number | string; // Size in px (default 40) or "100%"
  imagePath?: string; // Optional override for image source
}

export const RPGSlot: React.FC<RPGSlotProps> = ({
  item,
  def,
  onClick,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
  onDragStart,
  onDragEnd,
  selected = false,
  className = "",
  size = "100%",
  imagePath,
}) => {
  const rarityColor = React.useMemo(() => {
    const attrs = item?.attributes ?? [];
    const legacyStars = item?.stars ?? 0;

    if (attrs.some((attr) => attr.tier === "gold") || legacyStars >= 3) {
      return "var(--rarity-legendary)";
    }
    if (attrs.some((attr) => attr.tier === "silver") || legacyStars === 2) {
      return "var(--rarity-rare)";
    }
    if (attrs.some((attr) => attr.tier === "bronze") || legacyStars === 1) {
      return "var(--rarity-uncommon)";
    }

    return "var(--rarity-common)";
  }, [item]);

  const hasItem = !!item && !!def;

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      draggable={hasItem}
      onDragStart={hasItem ? onDragStart : undefined}
      onDragEnd={hasItem ? onDragEnd : undefined}
      className={`
        relative flex items-center justify-center rounded
        border border-[var(--border-subtle)] bg-black/30
        transition-all duration-200
        ${hasItem ? "cursor-grab hover:border-[var(--border-highlight)] hover:bg-[var(--bg-glass-hover)] hover:shadow-[var(--accent-glow)]" : ""}
        ${selected ? "border-[var(--accent-gold)] shadow-[var(--accent-glow)]" : ""}
        ${className}
      `}
      style={{
        width: size,
        height: size,
        borderColor: selected ? undefined : hasItem ? rarityColor : undefined,
      }}
    >
      {/* Background Pattern (Optional) */}
      {!hasItem && (
        <div className="absolute inset-0 opacity-[0.03] bg-stripes pointer-events-none" />
      )}

      {hasItem && (
        <>
          <img
            src={imagePath || `assets/items/${def!.id}.png`}
            alt={def!.name}
            className="w-[85%] h-[85%] object-contain pixelated drop-shadow-md pointer-events-none"
          />

          {/* Count Indicator */}
          {item!.count > 1 && (
            <span className="absolute bottom-0 right-1 text-[10px] font-bold text-white drop-shadow-md pointer-events-none font-mono tracking-tighter">
              {item!.count}
            </span>
          )}

          {/* Stars/Quality Indicator (Rainbow Ordered) */}
          {item!.attributes && item!.attributes.length > 0 ? (
            <div className="absolute top-0 right-0 p-0.5 pointer-events-none flex flex-row-reverse gap-[-2px]">
              {/* Sort: Bronze -> Silver -> Gold (Rendered Reverse so Gold is Rightmost? Or User wants Gold -> Silver? User: "Ouro -> Prata -> Bronze") 
                         Visual Example: [O][O][P][B]
                         Flex-row-reverse makes first in DOM appear last on right? 
                         Let's just use normal flex and sort correctly.
                     */}
              {[...item!.attributes]
                .sort((a, b) => {
                  const tierOrder = { gold: 3, silver: 2, bronze: 1 };
                  // @ts-ignore
                  return tierOrder[b.tier] - tierOrder[a.tier];
                })
                .map((attr, idx) => {
                  let color = "#cd7f32"; // Bronze
                  if (attr.tier === "silver") color = "#c0c0c0";
                  if (attr.tier === "gold") color = "#fbbf24";

                  return (
                    <span
                      key={idx}
                      style={{ color }}
                      className="text-[9px] drop-shadow-md -ml-0.5"
                    >
                      ★
                    </span>
                  );
                })}
            </div>
          ) : (
            // Fallback for Legacy Items (Count only)
            item!.stars &&
            item!.stars > 0 && (
              <div className="absolute top-0 right-0 p-0.5 pointer-events-none">
                {Array.from({ length: item!.stars }).map((_, i) => (
                  <span
                    key={i}
                    className="text-[9px] text-[var(--accent-gold)] -ml-0.5"
                  >
                    ★
                  </span>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
};
