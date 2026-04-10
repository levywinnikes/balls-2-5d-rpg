import React, { useState, useEffect } from "react";
import { useUI } from "../../context/UIContext";
import { WeaponRegistry } from "../../game/entities/weapons/WeaponRegistry";

export const DragGhost: React.FC = () => {
  const { draggedItem, groundDrag, s } = useUI();
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Determine if we should track mouse
    // draggedItem comes from Inventory
    // groundDrag comes from Ground
    if (!draggedItem && !groundDrag) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };

    // Initialize position
    // We might miss the first frame, but it updates fast.
    
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [draggedItem, groundDrag]);

  if (!draggedItem && !groundDrag) return null;

  // Resolve Sprite
  let sprite = "unknown";
  let count = 1;
  let isAnimated = false;

  if (draggedItem) {
      const def = draggedItem.def || WeaponRegistry.getWeaponDefinition(draggedItem.id || draggedItem.itemId);
      sprite = def?.id || "unknown";
      count = draggedItem.count || 1;
  } else if (groundDrag) {
      const def = WeaponRegistry.getWeaponDefinition(groundDrag.item.weaponId);
      sprite = def?.id || "unknown";
      count = groundDrag.item.count || 1;
  }

  // Special Handling for Light Torch
  if (sprite === "light_torch") {
      isAnimated = true;
  }

  return (
    <div
      className="fixed pointer-events-none z-[999999]"
      style={{
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, -50%)", // Center on cursor
      }}
    >
      <div className="relative">
          {isAnimated ? (
              <div 
                  style={{
                      width: s(48), 
                      height: s(48), 
                      backgroundImage: "url('assets/items/light_torch/1.png')", // Fallback/Sequence
                      backgroundSize: "100% 100%", 
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                      animation: "play-torch-files 0.8s steps(1) infinite",
                      imageRendering: "pixelated",
                      filter: "drop-shadow(0 0 4px rgba(0,0,0,0.5))"
                  }}
              />
          ) : (
              <img
                src={`assets/items/${sprite}.png`}
                alt="dragged"
                className="pixelated opacity-90 filter drop-shadow-md"
                style={{ width: s(48), height: s(48), objectFit: "contain" }}
                onError={(e) => {
                    // Try alternatives if main fails (e.g. some might be inside folders or named differently?)
                    // For now fallback to unknown
                    if(sprite !== "unknown") e.currentTarget.src = "assets/items/unknown.png";
                }}
              />
          )}
          
          {count > 1 && (
            <span 
                className="absolute bottom-0 right-0 text-white font-bold drop-shadow-md bg-black/50 px-1 rounded text-[10px]"
            >
                {count}
            </span>
          )}
      </div>
    </div>
  );
};
