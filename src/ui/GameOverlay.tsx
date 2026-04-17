import React, { useEffect, useState, useRef, useCallback } from "react";
import { DragGhost } from "./components/DragGhost";
import { SystemMenuUI } from "./windows/SystemMenuUI";
import { DialogueWindow } from "./components/DialogueWindow";
import { ContextMenu, ContextMenuOption } from "./components/ContextMenu";
import { useUI } from "../context/UIContext";
import { PlayerState } from "../game/entities/Player/PlayerState";
import { GroundTooltip } from "./components/GroundTooltip";
import { SplitStackWindow } from "./components/SplitStackWindow";
import { LevelUpNotification } from "./components/LevelUpNotification";
import { NotificationSystem } from "./components/NotificationSystem";
import { LootPrompt } from "./components/LootPrompt";
import { HUD } from "./HUD";
import { MapEditorUI } from "./screens/MapEditorUI";
import { ActiveRuneHud } from "./components/ActiveRuneHud";
import { WindowLayer } from "./components/window/WindowLayer";
import { useWindowSystem } from "./components/window/WindowContext";
import { HeroDashboard } from "./dashboard/HeroDashboard";
import { useFPS } from "../hooks/useFPS";
import { PerfMonitor } from "./components/PerfMonitor";
import { useLanguage } from "../context/LanguageContext";

export const GameOverlay: React.FC = () => {
  const {
    windows,
    toggleWindow,
    windowPositions,
    draggedItem,
    setDraggedItem,
    showFPS,
    isEditorMode,
    scale,
  } = useUI();
  const { t } = useLanguage();
  const { openWindow, closeWindow, isWindowOpen, openWindows } =
    useWindowSystem();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    options: ContextMenuOption[];
    data: any;
  } | null>(null);
  const fps = useFPS(); // Independent FPS counter using requestAnimationFrame

  const prevWindows = useRef(windows);
  const prevOpenWindows = useRef(openWindows);

  // 1. Sync UIContext -> WindowSystem (Only on UI Change)
  useEffect(() => {
    const map: Record<string, string> = {
      heroMenu: "hero_menu",
      settings: "settings",
      expandedMap: "expandedMap",
      questLog: "questLog",
      cheats: "cheats",
    };

    // Check what changed in UI
    Object.entries(map).forEach(([uiKey, windowId]) => {
      const wasOpen = prevWindows.current[uiKey as keyof typeof windows];
      const nowOpen = windows[uiKey as keyof typeof windows];

      if (nowOpen !== wasOpen) {
        if (nowOpen) openWindow(windowId);
        else closeWindow(windowId);
      } else if (nowOpen && !isWindowOpen(windowId)) {
        // Failsafe: If UI is open but System is closed (init load), open it.
        // We check 'prev' to avoid loops, but this handles the 'initial render' case
        // where prev=initial and windows=initial (no diff), but sys is empty.
        openWindow(windowId);
      }
    });
    prevWindows.current = windows;
  }, [windows, openWindow, closeWindow, isWindowOpen]);

  // 2. Sync WindowSystem -> UIContext (Only on System Close)
  useEffect(() => {
    const map: Record<string, string> = {
      heroMenu: "hero_menu",
      settings: "settings",
      expandedMap: "expandedMap",
      questLog: "questLog",
      cheats: "cheats",
    };

    // Detect removals
    const removedIds = Object.keys(prevOpenWindows.current).filter(
      (id) => !openWindows[id],
    );

    removedIds.forEach((id) => {
      const uiKey = Object.keys(map).find((k) => map[k] === id);
      if (uiKey && windows[uiKey as keyof typeof windows]) {
        toggleWindow(uiKey as any);
      }
    });
    prevOpenWindows.current = openWindows;
  }, [openWindows, windows, toggleWindow]);

  // 3. Dynamic Windows (Container, Altar) - Listen to PlayerState
  useEffect(() => {
    const ps = PlayerState.getInstance();

    const handleWindowOpen = (event: any) => {
      if (event.type === "container") {
        if (event.data && event.data.containerDefId === "altar") {
          openWindow("altar");
        } else {
          openWindow("container");
        }
      }
    };

    const handleContainerClosed = (id: string) => {
      // We don't verify ID here easily as we don't track it in Overlay,
      // but we can check if any container is open?
      // Ideally we should close 'container' if the closed ID matches.
      // For simplicity, PlayerState usually manages the 'current' container.
      // If PlayerState says close, we check if we should close the window.

      // However, WindowSystem closing is visual.
      // If logic closes it, we close window.
      // Simple fallback: Check PlayerState current
      if (!ps.currentOpenedContainerId) {
        closeWindow("container");
        closeWindow("altar");
      }
    };

    ps.on("windowOpened", handleWindowOpen);
    ps.on("containerClosed", handleContainerClosed);

    return () => {
      ps.off("windowOpened", handleWindowOpen);
      ps.off("containerClosed", handleContainerClosed);
    };
  }, [openWindow, closeWindow]);

  // --- PAUSE SYSTEM ---
  // Pauses GameScene logic/rendering when heavy UI is open
  useEffect(() => {
    const game = (window as any).game;
    if (!game) return;

    // We check specific windows that should "Pause" the game
    const shouldPause =
      windows.heroMenu ||
      windows.settings ||
      windows.systemMenu ||
      windows.cheats;

    const sceneKey = "GameScene";
    // Check if scene exists
    const scenePlugin = game.scene;
    if (!scenePlugin) return;

    // We use 'isPaused' from ScenePlugin or check the scene state directly
    const isPaused = scenePlugin.isPaused(sceneKey);
    const isActive = scenePlugin.isActive(sceneKey);

    if (shouldPause) {
      if (isActive && !isPaused) {
        // console.log("[GameOverlay] Pausing GameScene for Menu");
        scenePlugin.pause(sceneKey);
      }
    } else {
      if (isPaused) {
        // console.log("[GameOverlay] Resuming GameScene");
        scenePlugin.resume(sceneKey);
      }
    }
  }, [windows.heroMenu, windows.settings, windows.systemMenu, windows.cheats]);

  // --- End Window System Sync ---

  // Quick Save/Load
  const handleQuickSave = useCallback(async () => {
    const scene = (window as any).game?.scene.getScene("GameScene");
    if (!scene || !scene.saveSystem) return;

    const charName = PlayerState.getInstance().getName() || "QuickSave";
    const uiData = { windows, positions: windowPositions }; // Legacy positions might be stale, but safe to keep

    await scene.saveSystem.saveGame(charName, uiData);

    if (!(window as any).electronAPI) {
      scene.saveSystem.exportSave(charName);
    }

    if (scene.showFloatingText && scene.player?.sprite) {
      scene.showFloatingText(
        scene.player.sprite.x,
        scene.player.sprite.y - 50,
        t("msg_quick_saved"),
        0x00ff00,
      );
    }
  }, [windows, windowPositions, t]);

  const handleQuickLoad = useCallback(async () => {
    const scene = (window as any).game?.scene.getScene("GameScene");
    if (!scene || !scene.saveSystem) return;

    const charName = PlayerState.getInstance().getName();
    if (!charName) return;

    if ((window as any).electronAPI) {
      const data = await scene.saveSystem.loadCharacter(charName);
      if (data) {
        scene.scene.restart(data);
        if (scene.showFloatingText && scene.player?.sprite) {
          setTimeout(
            () =>
              scene.showFloatingText(
                scene.player.sprite.x,
                scene.player.sprite.y - 50,
                t("msg_quick_loaded"),
                0xffff00,
              ),
            100,
          );
        }
      }
    } else {
      alert(t("msg_quick_load_native_only"));
    }
  }, [t]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key.toLowerCase()) {
        case "f5":
          e.preventDefault();
          handleQuickSave();
          break;
        case "f9":
          e.preventDefault();
          handleQuickLoad();
          break;
        case "tab":
        case "i":
          e.preventDefault();
          console.log("Toggle Dashboard Key Pressed");
          toggleWindow("heroMenu");
          break;
        case "c": // Alternate for Character
          toggleWindow("heroMenu");
          break;
        case "l":
        case "j":
          toggleWindow("questLog");
          break;
        case "m":
          toggleWindow("expandedMap");
          break;
        case "escape":
          if (windows.systemMenu) toggleWindow("systemMenu");
          else {
            toggleWindow("systemMenu");
            if (windows.settings) toggleWindow("settings");
            if (windows.expandedMap) toggleWindow("expandedMap");
            // if (windows.statusHud) toggleWindow("statusHud"); // Do we want to close HUD?
          }
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    windows,
    windowPositions,
    isEditorMode,
    toggleWindow,
    handleQuickSave,
    handleQuickLoad,
  ]);

  // Global Drop Handler
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      if (draggedItem) {
        e.preventDefault();
        const ps = PlayerState.getInstance();

        const scene = (window as any).game?.scene.getScene("GameScene");
        let dropX = 0;
        let dropY = 0;

        if (scene && scene.cameras.main) {
          const canvas = scene.game.canvas;
          const rect = canvas.getBoundingClientRect();
          const domX = e.clientX - rect.left;
          const domY = e.clientY - rect.top;

          const worldPoint = scene.cameras.main.getWorldPoint(domX, domY);
          dropX = worldPoint.x;
          dropY = worldPoint.y;
        }

        const isEquipment =
          draggedItem.source === "equipment" ||
          (draggedItem.uid && draggedItem.uid.startsWith("equipped_"));

        if (draggedItem.source === "container") {
          ps.requestContainerItemDrop(
            draggedItem.containerId!,
            draggedItem.uid,
            draggedItem.itemId,
            draggedItem.count,
          );
        } else if (isEquipment) {
          const slot = draggedItem.uid.replace("equipped_", "");
          ps.dropEquippedItem(slot as any, dropX, dropY);
        } else if (draggedItem.source === "inventory") {
          ps.requestItemDrop(draggedItem.uid, draggedItem.count, dropX, dropY);
        }

        setDraggedItem(null);
        ps.emit("uiDragEnd");
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    // Safety Net
    const handleMouseUp = () => {
      if (draggedItem) setDraggedItem(null);
      PlayerState.getInstance().emit("uiDragEnd");
    };
    window.addEventListener("mouseup", handleMouseUp);

    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const cancelKeys = [
        "escape",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        "w",
        "a",
        "s",
        "d",
      ];

      if (cancelKeys.includes(k)) {
        if (draggedItem) setDraggedItem(null);
        PlayerState.getInstance().emit("uiDragEnd");
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [draggedItem, setDraggedItem]);

  // Context Menu
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleRequest = (req: any) => {
      const options: ContextMenuOption[] = [];
      if (req.type === "ground_item") {
        const { item, def } = req;
        if (def?.consumable) options.push({ label: "Use/Eat", action: "eat" });
        options.push({ label: "Pickup", action: "pickup" });
        if (item.count > 1)
          options.push({
            label: `Pickup All (${item.count})`,
            action: "pickup_all",
          });
      }
      if (options.length > 0) {
        setContextMenu({ x: req.x, y: req.y, options, data: req });
      }
    };
    PlayerState.getInstance().on("requestContextMenu", handleRequest);
    return () => {
      PlayerState.getInstance().off("requestContextMenu", handleRequest);
    };
  }, []);

  const handleMenuSelect = (action: string) => {
    if (!contextMenu) return;

    const { data } = contextMenu;

    if (data.type === "ground_item") {
      const item = data.item;
      let count = 1;
      if (action === "pickup_all") count = item.count;

      PlayerState.getInstance().emit("performContextAction", {
        action: action === "pickup_all" ? "pickup" : action,
        itemUid: item.itemId,
        count: count,
      });
    }

    setContextMenu(null);
  };

  // Render Logic
  if (isEditorMode) {
    return <MapEditorUI />;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none text-white select-none"
      style={{
        width: `${100 / scale}%`,
        height: `${100 / scale}%`,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      }}
    >
      {/* 1. LAYER: HUD (Always Visible, underlying windows) */}
      <HUD />

      {/* 2. LAYER: Windows (Managed by WindowSystem) */}
      <WindowLayer />
      <HeroDashboard />

      {/* 3. Legacy / Modals */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 60 }}
      >
        {/* Enable pointer events for actual windows if they were here */}
        {/* SystemMenu is fixed/modal */}
        <div className="contents pointer-events-auto">
          <SystemMenuUI
            isOpen={windows.systemMenu}
            onClose={() => toggleWindow("systemMenu")}
          />
          <DialogueWindow />
        </div>
      </div>

      {/* 4. LAYER: Context Menu, Tooltips, Notifications (Most Top) */}
      {contextMenu && (
        <div className="pointer-events-auto absolute inset-0 z-[9999]">
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            options={contextMenu.options}
            onSelect={handleMenuSelect}
            onClose={() => setContextMenu(null)}
          />
        </div>
      )}

      {showFPS && (
        <div className="absolute top-2 right-2 z-[9000] bg-black/50 text-[#00ff00] font-mono font-bold text-xs px-2 py-1 rounded border border-[#00ff00]/30 pointer-events-none">
          FPS: {fps}
        </div>
      )}

      <PerfMonitor />

      <GroundTooltip />
      <NotificationSystem />
      <LevelUpNotification />
      <LootPrompt />
      <SplitStackWindow />

      <SplitStackWindow />
      <ActiveRuneHud />

      <DragGhost />
    </div>
  );
};
