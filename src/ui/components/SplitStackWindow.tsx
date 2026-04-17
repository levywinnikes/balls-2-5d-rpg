import React, { useState, useEffect } from "react";
import { useUI } from "../../context/UIContext";
import { useLanguage } from "../../context/LanguageContext";

export const SplitStackWindow: React.FC = () => {
  const { splitStackState, closeSplitStack, s, scale } = useUI();
  const { t } = useLanguage();
  const [count, setCount] = useState(1);

  useEffect(() => {
    if (splitStackState) {
      setCount(1);
    }
  }, [splitStackState]);

  if (!splitStackState) return null;

  const { item, max, onConfirm } = splitStackState;

  // Resolve Sprite
  let sprite = (item as any).sprite;
  if (!sprite && (item as any).def) sprite = (item as any).def.id;
  if (!sprite && item.weaponId) sprite = item.weaponId;
  sprite = sprite || "unknown";

  const handleConfirm = () => {
    onConfirm(count);
    closeSplitStack();
  };

  const handleCancel = () => {
    closeSplitStack();
  };

  // Position center screen
  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black bg-opacity-50 pointer-events-auto"
      onKeyDown={(e) => {
        if (e.key === "Enter") handleConfirm();
        if (e.key === "Escape") handleCancel();
      }}
    >
      <div
        className="bg-[#2d2d2d] border-2 border-[#555] p-4 rounded shadow-lg flex flex-col gap-4"
        style={{
          width: `${s(250)}px`,
          transform: `scale(${scale})`,
        }}
      >
        <h3 className="text-white text-center font-bold">Move Items</h3>

        <div className="flex items-center justify-center gap-2">
          <img
            src={`assets/sprites/${sprite}.png`}
            alt="item"
            className="w-8 h-8 pixelated"
            onError={(e) =>
              (e.currentTarget.src = "assets/sprites/unknown.png")
            }
          />
          <span className="text-gray-300">{t(item.def?.name || "Item")}</span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-white text-xs">
            <span>1</span>
            <span>{count}</span>
            <span>{max}</span>
          </div>
          <input
            type="range"
            min={1}
            max={max}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
            autoFocus
          />
        </div>

        <div className="flex justify-between gap-2">
          <button
            onClick={handleCancel}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-1 px-2 rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1 px-2 rounded text-sm"
          >
            Ok
          </button>
        </div>
      </div>
    </div>
  );
};
