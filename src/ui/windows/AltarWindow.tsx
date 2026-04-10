import React, { useEffect, useState } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { RuneRegistry } from "../../game/magic/RuneRegistry";
import { useLanguage } from "../../context/LanguageContext";
import { t_game } from "../../game/i18n/translations";
import { useUI } from "../../context/UIContext";

export const AltarContent: React.FC = () => {
    const { t } = useLanguage();
    const { setDraggedItem, draggedItem } = useUI();
    const [altarId, setAltarId] = useState<string | null>(null);
    const [selectedRuneId, setSelectedRuneId] = useState<string>(RuneRegistry.getAllRunes()[0]?.id || "");
    const [storedRunes, setStoredRunes] = useState<Array<{ runeId: string, count: number }>>([]);
    
    // Force update
    const [, ] = useState(0);

    useEffect(() => {
        const ps = PlayerState.getInstance();

        const handleWindowOpen = (event: any) => {
            if (event.type === "container" && event.data.containerDefId === "altar") {
                setAltarId(event.id);
                updateContent(event.id);
            }
        };

        const updateContent = (id: string) => {
            setStoredRunes([...ps.getAltarRunes(id)]);
        };

        const onContainerUpd = (id: string) => {
            if (id === altarId) updateContent(id);
        };
        const onAltarUpd = (id: string) => {
             if (id === altarId) updateContent(id);
        }
        
        const handleClose = (id: string) => {
             if (id === altarId) setAltarId(null);
        };

        ps.on("windowOpened", handleWindowOpen);
        ps.on("containerUpdated", onContainerUpd);
        ps.on("altarUpdated", onAltarUpd); // custom event for rune storage
        ps.on("containerClosed", handleClose);

        if (ps.currentOpenedContainerId && ps.currentOpenedContainerDefId === "altar" && !altarId) {
             setAltarId(ps.currentOpenedContainerId);
             updateContent(ps.currentOpenedContainerId);
        }

        return () => {
             ps.off("windowOpened", handleWindowOpen);
             ps.off("containerUpdated", onContainerUpd);
             ps.off("altarUpdated", onAltarUpd);
             ps.off("containerClosed", handleClose);
        };
    }, [altarId]);

    const [isDragOver, setIsDragOver] = useState(false);

    // Transfer State
    const [transferRequest, setTransferRequest] = useState<{ itemId: string, qty: number, direction: "store" | "withdraw" } | null>(null);
    const [transferQty, setTransferQty] = useState(1);
    
    // State for Memory and Inventory Blank Runes
    const [memoryCurrent, setMemoryCurrent] = useState(0);
    const [memoryMax, setMemoryMax] = useState(0);
    const [blankRunesCount, setBlankRunesCount] = useState(0);
    const [playerRunes, setPlayerRunes] = useState<Array<{ runeId: string, count: number }>>([]);

    useEffect(() => {
        const ps = PlayerState.getInstance();
        
        const updateStats = () => {
            setPlayerRunes([...ps.getEnchantedRunes()]);
            setMemoryCurrent(ps.getCurrentMemoryUsage());
            setMemoryMax(ps.getMemoryCapacity());
            
            const inv = ps.inventory;
            const count = inv.reduce((acc, item) => item.itemId === "magic_rune" ? acc + item.count : acc, 0);
            setBlankRunesCount(count);
        };

        updateStats();

        const onRunesUpd = () => updateStats();
        const onInvUpd = () => updateStats();
        
        ps.on("runesUpdated", onRunesUpd);
        ps.on("inventoryUpdated", onInvUpd);
        
        return () => {
             ps.off("runesUpdated", onRunesUpd);
             ps.off("inventoryUpdated", onInvUpd);
        };
    }, []);

    const handleStoreClick = (runeId: string) => {
         setTransferRequest({ itemId: runeId, qty: 1, direction: "store" });
         setTransferQty(1);
    };

    const handleWithdrawClick = (runeId: string) => {
         setTransferRequest({ itemId: runeId, qty: 1, direction: "withdraw" });
         setTransferQty(1);
    };

    const handleTransferConfirm = () => {
        if (!transferRequest || !altarId) return;
        const ps = PlayerState.getInstance();
        
        if (transferRequest.direction === "store") {
             if (ps.removeEnchantedRune(transferRequest.itemId, transferQty)) {
                ps.addRuneToAltar(altarId, transferRequest.itemId, transferQty);
                ps.emit("message", t_game("msg_rune_stored") || "Rune stored.");
             }
        } else {
             if (ps.withdrawRuneFromAltar(altarId, transferRequest.itemId, transferQty)) {
                 const def = RuneRegistry.getRune(transferRequest.itemId);
                 ps.addEnchantedRune(transferRequest.itemId, transferQty, def?.memoryCost || 0);
                 ps.emit("message", t_game("msg_rune_withdrawn") || "Rune withdrawn.");
             }
        }
        
        setTransferRequest(null);
        setDraggedItem(null);
        ps.emit("uiDragEnd");
    };

    const handleTransferCancel = () => {
        setTransferRequest(null);
        setDraggedItem(null);
        PlayerState.getInstance().emit("uiDragEnd");
    };

    const handleStorageDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
        if (!altarId) return;
        let itemData: any = draggedItem;
        if (!itemData) { try { const raw = e.dataTransfer.getData("text/plain"); if(raw) { const p = JSON.parse(raw); if(p.runeId && p.source === "spellbook") itemData = { itemId: p.runeId, source: "spellbook" }; } } catch(e){} }

        if (itemData && itemData.source === "spellbook") {
             setTransferRequest({ itemId: itemData.itemId, qty: 1, direction: "store" });
             setTransferQty(1);
        }
    };

    const handleCraft = () => {
        if (!altarId) return;
        
        const ps = PlayerState.getInstance();
        const inv = ps.getInventory();
        const blankRuneItem = inv.find(i => i.itemId === "magic_rune");

        if (!blankRuneItem) {
            ps.emit("message", t_game("msg_altar_need_blank"));
            return;
        }

        const runeDef = RuneRegistry.getRune(selectedRuneId);
        if (!runeDef) return;

        if (ps.decreaseInventoryItem(blankRuneItem.uid, 1)) {
            const charges = 3; 
            ps.addRuneToAltar(altarId, selectedRuneId, charges);
            ps.gainIntelligenceExperience(100);
            ps.emit("message", t_game("msg_rune_crafted"));
            
            import("../../game/systems/AudioManager").then(({ AudioManager }) => {
                AudioManager.getInstance().playEnchant(runeDef.enchantSound);
            });
        }
    };

    if (!altarId) return null;

    return (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "4px", gap: "8px" }}>
                
                {/* TOP: CRAFTING STATION */}
                <div style={{ padding: "8px", backgroundColor: "var(--bg-glass-heavy)", border: "1px solid var(--border-subtle)", borderRadius: "4px", display: "flex", gap: "12px", alignItems: "center" }}>
                     
                     <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                         <div style={{ fontSize: "10px", color: "#aaa", marginBottom: "4px" }}>{t("item_magic_rune" as any) || "Magic Rune"}</div>
                         <div 
                            style={{ 
                                width: "48px", height: "48px", 
                                border: "1px solid #444", 
                                display: "flex", alignItems: "center", justifyContent: "center",
                                backgroundColor: "#111",
                                borderRadius: "4px",
                                position: "relative"
                            }}
                         >
                             <img src={`assets/items/magic_rune.png`} alt="Magic Rune" style={{ width: "100%", height: "100%", imageRendering: "pixelated", opacity: blankRunesCount > 0 ? 1 : 0.5 }} />
                             <span style={{ position: "absolute", bottom: "1px", right: "2px", fontSize: "10px", color: "#fff", fontWeight: "bold", textShadow: "1px 1px 0 #000" }}>
                                 {blankRunesCount}
                             </span>
                         </div>
                     </div>

                     <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                         <div style={{ fontSize: "11px", fontWeight: "bold", color: "#d8b4fe" }}>{t("ui_craft" as any) || "Enchant Station"}</div>
                         <div style={{ display: "flex", gap: "6px" }}>
                             <select 
                                value={selectedRuneId}
                                onChange={(e) => setSelectedRuneId(e.target.value)}
                                style={{ flex: 1, padding: "4px", backgroundColor: "#333", color: "#fff", border: "1px solid #555", borderRadius: "4px", fontSize: "11px" }}
                             >
                                 {RuneRegistry.getAllRunes().map(r => (
                                     <option key={r.id} value={r.id}>{r.name} ({r.memoryCost} Mem)</option>
                                 ))}
                             </select>
                             <button 
                                onClick={handleCraft}
                                disabled={blankRunesCount <= 0}
                                style={{ 
                                    padding: "4px 12px", backgroundColor: blankRunesCount > 0 ? "#7e22ce" : "#444", 
                                    color: blankRunesCount > 0 ? "#fff" : "#888", border: "none", borderRadius: "4px", cursor: blankRunesCount > 0 ? "pointer" : "default", fontWeight: "bold", fontSize: "11px" 
                                }}
                             >
                                 {t("action_enchant" as any) || "Enchant"}
                             </button>
                         </div>
                     </div>
                </div>

                {/* MEMORY BAR (New) */}
                <div style={{ padding: "4px 8px", backgroundColor: "var(--bg-glass)", border: "1px solid var(--border-subtle)", borderRadius: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#ccc", marginBottom: "2px" }}>
                        <span>{t("memory" as any) || "Memory"}</span>
                        <span>{memoryCurrent} / {memoryMax}</span>
                    </div>
                    <div style={{ width: "100%", height: "6px", backgroundColor: "#333", borderRadius: "3px", overflow: "hidden" }}>
                        <div 
                            style={{ 
                                width: `${Math.min(100, (memoryCurrent / (memoryMax || 1)) * 100)}%`, 
                                height: "100%", 
                                backgroundColor: memoryCurrent > memoryMax ? "#ef4444" : "#a855f7",
                                transition: "width 0.3s"
                            }} 
                        />
                    </div>
                </div>

                {/* BOTTOM: SPLIT VIEW */}
                <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", minHeight: 0 }}>
                    
                    {/* LEFT: MY SPELLBOOK */}
                    <div style={{ display: "flex", flexDirection: "column", backgroundColor: "var(--bg-glass)", border: "1px solid var(--border-subtle)", borderRadius: "4px", padding: "4px" }}>
                        <div style={{ fontSize: "11px", fontWeight: "bold", color: "#93c5fd", marginBottom: "4px", textAlign: "center", borderBottom: "1px solid #333", paddingBottom: "2px" }}>
                            {t("ui_spellbook" as any) || "My Spellbook"}
                        </div>
                        <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
                             {playerRunes.length === 0 && <div style={{ color: "#555", fontSize: "10px", textAlign: "center", marginTop: "20px" }}>{t("ui_empty" as any) || "Empty"}</div>}
                             {playerRunes.map((rune, idx) => {
                                 const def = RuneRegistry.getRune(rune.runeId);
                                 return (
                                     <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px", backgroundColor: "#222", borderRadius: "2px" }}>
                                         <span style={{ fontSize: "11px", color: "#ccc" }}>{def?.name} (x{rune.count})</span>
                                         <button 
                                            onClick={() => handleStoreClick(rune.runeId)}
                                            title={t("drag_rune_hint" as any) || "Store"}
                                            style={{ cursor: "pointer", backgroundColor: "#333", border: "none", color: "#22c55e", padding: "2px 6px", borderRadius: "2px", fontSize: "10px" }}
                                         >
                                             {t("ui_store_btn" as any) || "Store ->"}
                                         </button>
                                     </div>
                                 )
                             })}
                        </div>
                    </div>

                    {/* RIGHT: ALTAR STORAGE */}
                    <div 
                        style={{ display: "flex", flexDirection: "column", backgroundColor: "var(--bg-glass)", border: isDragOver ? "2px dashed #22c55e" : "1px solid var(--border-subtle)", borderRadius: "4px", padding: "4px" }}
                        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleStorageDrop}
                    >
                        <div style={{ fontSize: "11px", fontWeight: "bold", color: "#86efac", marginBottom: "4px", textAlign: "center", borderBottom: "1px solid #333", paddingBottom: "2px" }}>
                            {t("ui_storage" as any) || "Altar Storage"}
                        </div>
                        <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
                             {storedRunes.length === 0 && <div style={{ color: "#555", fontSize: "10px", textAlign: "center", marginTop: "20px" }}>{t("ui_empty" as any) || "Empty"}</div>}
                             {storedRunes.map((rune, idx) => {
                                 const def = RuneRegistry.getRune(rune.runeId);
                                 return (
                                     <div 
                                         key={idx} 
                                         draggable
                                         onDragStart={(e) => {
                                             const dragData = {
                                                 source: "altar_storage",
                                                 runeId: rune.runeId,
                                                 containerId: altarId,
                                                 altarId: altarId
                                             };
                                             e.dataTransfer.setData("text/plain", JSON.stringify(dragData));
                                             setDraggedItem(dragData);
                                             PlayerState.getInstance().emit("uiDragStart");
                                         }}
                                         onDragEnd={() => {
                                             setDraggedItem(null);
                                             PlayerState.getInstance().emit("uiDragEnd");
                                         }}
                                         style={{ 
                                             display: "flex", 
                                             justifyContent: "space-between", 
                                             alignItems: "center", 
                                             padding: "4px", 
                                             backgroundColor: "#222", 
                                             borderRadius: "2px",
                                             cursor: "grab" 
                                         }}
                                     >
                                         <button 
                                            onClick={() => handleWithdrawClick(rune.runeId)}
                                            title={t("msg_rune_withdrawn" as any) || "Withdraw"}
                                            style={{ cursor: "pointer", backgroundColor: "#333", border: "none", color: "#3b82f6", padding: "2px 6px", borderRadius: "2px", fontSize: "10px" }}
                                         >
                                             {t("ui_withdraw_btn" as any) || "<- Withdraw"}
                                         </button>
                                         <span style={{ fontSize: "11px", color: "#ccc" }}>{def?.name} (x{rune.count})</span>
                                     </div>
                                 )
                             })}
                        </div>
                    </div>

                </div>
                
                {/* Custom Quantity Overlay */}
                {transferRequest && (
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.95)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "8px" }}>
                        <span style={{ color: "#d8b4fe", fontSize: "12px", marginBottom: "8px", fontWeight: "bold" }}>
                            {transferRequest.direction === "store" ? (t("ui_store_qty_title" as any) || "Store Quantity") : (t("ui_withdraw_qty_title" as any) || "Withdraw Quantity")}
                        </span>
                        <input 
                            type="number" 
                            min="1"
                            max="100" // We could parse max from actual count
                            style={{ width: "60px", backgroundColor: "#222", border: "1px solid #a855f7", color: "#fff", textAlign: "center", padding: "4px", marginBottom: "12px", outline: "none", borderRadius: "4px" }}
                            value={transferQty}
                            onChange={(e) => setTransferQty(Math.max(1, parseInt(e.target.value) || 1))}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleTransferConfirm();
                                if (e.key === "Escape") handleTransferCancel();
                            }}
                        />
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button 
                                onClick={handleTransferConfirm} 
                                style={{ backgroundColor: "#9333ea", color: "#fff", border: "none", padding: "6px 16px", fontSize: "11px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                            >
                                {t("ui_confirm" as any) || "Confirm"}
                            </button>
                            <button 
                                onClick={handleTransferCancel} 
                                style={{ backgroundColor: "#374151", color: "#d1d5db", border: "none", padding: "6px 12px", fontSize: "11px", borderRadius: "4px", cursor: "pointer" }}
                            >
                                {t("ui_cancel" as any) || "Cancel"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
    );
};
