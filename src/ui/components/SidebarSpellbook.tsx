import React, { useEffect, useState } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { RuneRegistry } from "../../game/magic/RuneRegistry";
import { t_game } from "../../game/i18n/translations";
import { useLanguage } from "../../context/LanguageContext";
import { useUI } from "../../context/UIContext";
import { formatItemTooltip } from "../../game/utils/TooltipUtils";

export const SidebarSpellbook: React.FC = () => {
  const { t } = useLanguage();
  const { setDraggedItem, draggedItem, showTooltip, hideTooltip } = useUI();
  const [runes, setRunes] = useState<any[]>([]);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [memoryCapacity, setMemoryCapacity] = useState(0);

  // Grid Size (Fixed or Dynamic?)
  const totalSlots = 20;

  useEffect(() => {
    const ps = PlayerState.getInstance();
    const update = () => {
      setRunes([...ps.getEnchantedRunes()]);
      setMemoryUsage(ps.getCurrentMemoryUsage());
      setMemoryCapacity(ps.getMemoryCapacity());
    };

    ps.on("runesUpdated", update);
    ps.on("altarUpdated", update); // In case we withdraw
    ps.on("statsChanged", update); // Int/Level affects capacity

    const interval = setInterval(update, 1000); // Polling for safety
    update();

    return () => {
      ps.off("runesUpdated", update);
      ps.off("altarUpdated", update);
      ps.off("statsChanged", update);
      clearInterval(interval);
    };
  }, []);

  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  // Transfer State
  const [transferRequest, setTransferRequest] = useState<{
    containerId: string;
    runeId: string;
  } | null>(null);
  const [transferQty, setTransferQty] = useState(1);

  const handleTransferConfirm = () => {
    if (!transferRequest) return;
    const ps = PlayerState.getInstance();
    const { containerId, runeId } = transferRequest;

    const runeDef = RuneRegistry.getRune(runeId);
    const memCost = runeDef ? runeDef.memoryCost : 0;

    if (ps.withdrawRuneFromAltar(containerId, runeId, transferQty)) {
      ps.addEnchantedRune(runeId, transferQty, memCost);
      ps.emit("message", t_game("msg_rune_added_spellbook"));
    }

    setTransferRequest(null);
    setTransferQty(1);
  };

  const handleTransferCancel = () => {
    setTransferRequest(null);
    setTransferQty(1);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false); // Reset visual

    let source = draggedItem?.source;
    let runeId = draggedItem?.runeId;
    let containerId = draggedItem?.containerId;

    // Fallback: Try parsing dataTransfer if context is missing
    if (!source || !runeId) {
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        if (data && data.source === "altar_storage") {
          source = data.source;
          runeId = data.runeId;
          containerId = data.altarId;
        }
      } catch (err) {
        /* Ignore invalid json */
      }
    }

    if (!source) return;

    // Logic: Altar Storage -> Spellbook
    if (source === "altar_storage") {
      // containerId is altarId
      if (containerId && runeId) {
        // Open Custom Modal instead of Prompt
        setTransferRequest({ containerId, runeId });
        setTransferQty(1);
      }

      setDraggedItem(null);
      PlayerState.getInstance().emit("uiDragEnd");
    }
  };

  const handleCast = (runeId: string) => {
    PlayerState.getInstance().emit("prepareRuneCast", runeId);
  };

  return (
    <div
      className={`flex flex-col h-full bg-[#111] p-1 transition-colors relative ${isDragOver ? "border-2 border-purple-500 bg-[#1a1a1a]" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Custom Quantity Overlay */}
      {transferRequest && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4">
          <span className="text-purple-300 text-xs mb-2 font-bold">
            {t("quantity" as any)}
          </span>
          <input
            type="number"
            min="1"
            max="100"
            className="w-16 bg-[#222] border border-purple-500 text-white text-center text-sm p-1 mb-3 focus:outline-none focus:ring-1 focus:ring-purple-400 no-spin"
            value={transferQty}
            onChange={(e) =>
              setTransferQty(Math.max(1, parseInt(e.target.value) || 1))
            }
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTransferConfirm();
              if (e.key === "Escape") handleTransferCancel();
            }}
          />
          <div className="flex gap-2 w-full justify-center">
            <button
              onClick={handleTransferConfirm}
              className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] px-3 py-1.5 rounded transition-colors font-bold"
            >
              OK
            </button>
            <button
              onClick={handleTransferCancel}
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-[10px] px-3 py-1.5 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Memory Bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] text-purple-300 mb-0.5">
          <span>{t("memory" as any)}</span>
          <span>
            {memoryUsage} / {memoryCapacity}
          </span>
        </div>
        <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-600 transition-all duration-300"
            style={{
              width: `${Math.min(100, (memoryUsage / memoryCapacity) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 gap-1 overflow-y-auto custom-scrollbar flex-1 pb-2">
        {/* Render Runes */}
        {runes.map((rune, idx) => {
          const def = RuneRegistry.getRune(rune.runeId);
          if (!def) return null;
          return (
            <div
              key={`rune-${idx}`}
              className="aspect-square bg-[#222] border border-[#444] rounded flex flex-col items-center justify-center relative group cursor-pointer hover:border-purple-500"
              // title={`${def.name}\nCharges: ${rune.count}\nMem: ${def.memoryCost}`} // Replaced by rich tooltip
              onClick={() => handleCast(rune.runeId)}
              onMouseEnter={(e) => {
                const mockDef = {
                  id: rune.runeId,
                  name: def.name,
                  weight: 0.1,
                  type: "rune",
                } as any;
                const { name, subtext } = formatItemTooltip(mockDef, {
                  weaponId: rune.runeId,
                  itemId: rune.runeId,
                  count: rune.count,
                });

                showTooltip({
                  text: name,
                  subtext: subtext,
                  x: e.clientX,
                  y: e.clientY,
                });
                e.currentTarget.style.borderColor = "#a855f7"; // purple-500 equivalent
              }}
              onMouseLeave={(e) => {
                hideTooltip();
                e.currentTarget.style.borderColor = "#444";
              }}
              draggable={true}
              onDragStart={(e) => {
                hideTooltip(); // Hide on drag start
                setDraggedItem({
                  uid: `spellbook_rune_${rune.runeId}`,
                  itemId: rune.runeId,
                  count: 1, // Drag 1 unit/stack
                  source: "spellbook",
                  containerId: "spellbook",
                });
                e.dataTransfer.setData(
                  "text/plain",
                  JSON.stringify({
                    source: "spellbook",
                    runeId: rune.runeId,
                    count: 1,
                  }),
                );
              }}
            >
              {/* Icon or Image */}
              <div className="w-full h-full p-1 flex items-center justify-center">
                <img
                  src={`assets/items/runes/${rune.runeId}.png`}
                  alt={def.name}
                  className="w-full h-full object-contain image-pixelated"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      // Fallback to text icon
                      parent.innerHTML = `<div class="w-6 h-6 bg-purple-900/40 rounded-full flex items-center justify-center text-[10px] text-purple-200 font-bold">${def.name.charAt(0)}</div>`;
                    }
                  }}
                />
              </div>

              {/* Count Overlay */}
              <div className="absolute bottom-0 right-0.5 text-[9px] text-gray-300 font-bold leading-none shadow-black drop-shadow-md cursor-default pointer-events-none">
                {rune.count}
              </div>
            </div>
          );
        })}

        {/* Empty Slots Filler */}
        {Array.from({ length: Math.max(0, totalSlots - runes.length) }).map(
          (_, i) => (
            <div
              key={`empty-${i}`}
              className="aspect-square bg-[#0a0a0a] border border-[#222] rounded flex items-center justify-center"
            >
              <div className="w-2 h-2 bg-[#1a1a1a] rounded-full opacity-20" />
            </div>
          ),
        )}
      </div>

      <div className="text-[9px] text-gray-500 text-center mt-1">
        {t("drag_rune_hint")}
      </div>
    </div>
  );
};
