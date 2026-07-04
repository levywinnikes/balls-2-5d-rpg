import React, { useEffect, useRef, useState, useCallback } from "react";
import { HeroDashboard } from "../../ui/dashboard/HeroDashboard";
import { NotificationSystem } from "../../ui/components/NotificationSystem";
import { WindowLayer } from "../../ui/components/window/WindowLayer";
import { HUD } from "../../ui/HUD";
import { LevelUpNotification } from "../../ui/components/LevelUpNotification";
import { ThreeDFloatingText } from "../runtime/ThreeDFloatingText";
import { useWindowSystem } from "../../ui/components/window/WindowContext";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { createDebugSliceScene } from "../runtime/createDebugSliceScene";
import { MainMenuUI } from "../../ui/screens/MainMenuUI";
import { t_game } from "../../game/i18n/translations";
import { PerfMonitor } from "../../ui/components/PerfMonitor";
import { useUI } from "../../context/UIContext";
import { SystemMenuUI } from "../../ui/windows/SystemMenuUI";

// Default map for new 3D games. Will become the world map in Phase 3.
const DEFAULT_3D_MAP = "city_3d_mundi_p1";

export function ThreeDSliceView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<ReturnType<typeof createDebugSliceScene> | null>(
    null,
  );
  const [isInGame, setIsInGame] = useState(false);
  const [worldLoading, setWorldLoading] = useState(false);
  const [worldLoadError, setWorldLoadError] = useState<string | null>(null);
  const [runtimeBridge, setRuntimeBridge] = React.useState<{
    engine: any;
    scene: any;
  } | null>(null);
  // S7-FP1: track first-person mode to show/hide crosshair
  const [isFP, setIsFP] = useState(false);
  // S8-T2: rune hotbar HUD state
  const [runeSlots, setRuneSlots] = useState<string[]>([
    "fire_burst_rune",
    "",
    "",
  ]);
  const [activeRuneSlot, setActiveRuneSlot] = useState(0);
  // S9-T1: damage vignette flash
  const [vignetteActive, setVignetteActive] = useState(false);
  const vignetteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    toggleWindow: toggleRuntimeWindow,
    closeWindow,
    isWindowOpen,
    openWindow,
  } = useWindowSystem();
  const { windows, toggleWindow: toggleUiWindow } = useUI();

  // ── 1.3: Handle menu start (new game or load) ──────────────────────────────
  const handleThreeDStart = useCallback((data: any) => {
    const playerState = PlayerState.getInstance();

    if (data.isNewGame) {
      playerState.reset();
      if (data.charName) playerState.setName(data.charName);
      // Seed the map for createDebugSliceScene via URL param (dev-compatible)
      const url = new URL(window.location.href);
      url.searchParams.set("map", data.map || DEFAULT_3D_MAP);
      window.history.replaceState(null, "", url.toString());
    } else {
      // Load game: restore full PlayerState from save
      if (data.playerState) {
        playerState.loadState(data.playerState, data.timestamp);
      }
      // Restore map/level in URL so createDebugSliceScene picks them up
      const url = new URL(window.location.href);
      url.searchParams.set("map", data.map || DEFAULT_3D_MAP);
      if (data.currentLevel != null) {
        url.searchParams.set("level", String(data.currentLevel));
      }
      window.history.replaceState(null, "", url.toString());
    }

    setIsInGame(true);
    setWorldLoading(true);
    setWorldLoadError(null);
  }, []);

  // ── 1.4: Return to menu ────────────────────────────────────────────────────
  const handleReturnToMenu = useCallback(() => {
    if (runtimeRef.current) {
      runtimeRef.current.dispose();
      runtimeRef.current = null;
    }
    setRuntimeBridge(null);
    setIsInGame(false);
    setWorldLoading(false);
    setWorldLoadError(null);
    // Clean up map params so next session starts fresh
    const url = new URL(window.location.href);
    url.searchParams.delete("map");
    url.searchParams.delete("level");
    window.history.replaceState(null, "", url.toString());
  }, []);

  // ── Listen for "Return to Title" fired from in-game system menu ───────────
  useEffect(() => {
    const handler = () => handleReturnToMenu();
    window.addEventListener("returnToTitle", handler);
    return () => window.removeEventListener("returnToTitle", handler);
  }, [handleReturnToMenu]);

  // URL: ?map=debug_sandbox&autostart=1 (used by play-debug-sandbox.bat)
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autostart") !== "1") return;
    autoStartedRef.current = true;
    handleThreeDStart({
      isNewGame: true,
      map: params.get("map") || "debug_sandbox",
      charName: params.get("charName") || "Debug",
    });
  }, [handleThreeDStart]);

  // Hide HUD until spawn chunk + foot snap are ready (prevents limbo fall on debug start).
  useEffect(() => {
    if (!isInGame) {
      return;
    }

    const handleBootstrap = (event: Event) => {
      const detail = (event as CustomEvent<{ ready: boolean; error?: string }>)
        .detail;
      if (detail.ready) {
        setWorldLoading(false);
        setWorldLoadError(null);
        return;
      }
      setWorldLoading(false);
      setWorldLoadError(detail.error ?? t_game("loading_bms_metadata_missing"));
    };

    document.addEventListener("slice3d:worldBootstrap", handleBootstrap);
    return () => {
      document.removeEventListener("slice3d:worldBootstrap", handleBootstrap);
    };
  }, [isInGame]);

  // ── 1.1: Only start Babylon when isInGame = true ──────────────────────────
  useEffect(() => {
    if (!isInGame) return;
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const runtime = createDebugSliceScene(canvas);
    runtimeRef.current = runtime;
    setRuntimeBridge({ engine: runtime.engine, scene: runtime.scene });
    const handleResize = () => runtime.engine.resize();
    window.addEventListener("resize", handleResize);

    // S7-FP1: listen for camera mode changes to toggle crosshair
    const handleCameraMode = (e: Event) => {
      setIsFP((e as CustomEvent<{ firstPerson: boolean }>).detail.firstPerson);
    };
    document.addEventListener("slice3d:cameraModeChanged", handleCameraMode);

    // S8-T2: listen for rune slot changes
    const handleRuneSlot = (e: Event) => {
      const detail = (
        e as CustomEvent<{ slots: string[]; activeIndex: number }>
      ).detail;
      setRuneSlots(detail.slots);
      setActiveRuneSlot(detail.activeIndex);
    };
    document.addEventListener("slice3d:runeSlotChanged", handleRuneSlot);

    // S9-T1: listen for player hit → trigger vignette flash
    const handlePlayerHit = () => {
      setVignetteActive(true);
      if (vignetteTimerRef.current) clearTimeout(vignetteTimerRef.current);
      vignetteTimerRef.current = setTimeout(
        () => setVignetteActive(false),
        400,
      );
    };
    document.addEventListener("slice3d:playerHit", handlePlayerHit);

    // Bridge classic HUD/UIContext windows to WindowSystem ids used by ThreeDSliceView.
    const handleUiWindowToggled = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string; isOpen: boolean }>)
        .detail;
      const windowIdMap: Record<string, string> = {
        heroMenu: "hero_menu",
        settings: "settings",
        expandedMap: "expandedMap",
        questLog: "questLog",
        cheats: "cheats",
        // S11-T1: Grimorio now has its own window
        grimorio: "grimorio",
      };

      const mappedId = windowIdMap[detail.key];
      if (!mappedId) return;

      if (detail.isOpen) {
        openWindow(mappedId);
      } else {
        closeWindow(mappedId);
      }
    };
    document.addEventListener("ui:windowToggled", handleUiWindowToggled);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener(
        "slice3d:cameraModeChanged",
        handleCameraMode,
      );
      document.removeEventListener("slice3d:runeSlotChanged", handleRuneSlot);
      document.removeEventListener("slice3d:playerHit", handlePlayerHit);
      document.removeEventListener("ui:windowToggled", handleUiWindowToggled);
      if (vignetteTimerRef.current) clearTimeout(vignetteTimerRef.current);
      setRuntimeBridge(null);
      runtime.dispose();
    };
  }, [isInGame, openWindow, closeWindow]);

  const saveAndNotify = useCallback(async () => {
    if (!runtimeRef.current?.save) {
      return false;
    }

    const ok = await runtimeRef.current.save();
    PlayerState.getInstance().emit("uiNotification", {
      type: ok ? "success" : "error",
      message: ok ? t_game("msg_quick_saved") : t_game("msg_save_failed"),
    });
    return ok;
  }, []);

  const handleSystemSaveAndExit = useCallback(async () => {
    const ok = await saveAndNotify();
    if (ok) {
      handleReturnToMenu();
    }
    return ok;
  }, [saveAndNotify, handleReturnToMenu]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) {
        return;
      }

      const key = event.key.toLowerCase();
      const menuBlockingGameplay =
        isWindowOpen("hero_menu") || windows.systemMenu;

      if (menuBlockingGameplay) {
        const menuKeys = new Set(["i", "tab", "escape", "f5"]);
        if (!menuKeys.has(key) && event.key !== "Tab" && event.key !== "Escape") {
          return;
        }
      }

      if (key === "i" || event.key === "Tab") {
        event.preventDefault();
        toggleRuntimeWindow("hero_menu");
        return;
      }

      if (key === "j" || key === "l") {
        event.preventDefault();
        toggleRuntimeWindow("questLog");
        return;
      }

      if (key === "o") {
        event.preventDefault();
        toggleRuntimeWindow("settings");
        return;
      }

      if (key === "m") {
        event.preventDefault();
        toggleRuntimeWindow("expandedMap");
        return;
      }

      if (key === "escape") {
        event.preventDefault();
        if (isWindowOpen("hero_menu")) {
          closeWindow("hero_menu");
          return;
        }

        if (windows.systemMenu) {
          toggleUiWindow("systemMenu");
          return;
        }

        toggleUiWindow("systemMenu");
        if (isWindowOpen("settings")) closeWindow("settings");
        if (isWindowOpen("expandedMap")) closeWindow("expandedMap");
        return;
      }

      // F5 — manual save (2.5)
      if (event.key === "F5") {
        event.preventDefault();
        void saveAndNotify();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    toggleRuntimeWindow,
    closeWindow,
    isWindowOpen,
    windows.systemMenu,
    toggleUiWindow,
    saveAndNotify,
  ]);

  useEffect(() => {
    const ps = PlayerState.getInstance();

    const handleWindowOpen = (event: any) => {
      if (event.type !== "container") return;

      if (event.data && event.data.containerDefId === "altar") {
        openWindow("altar");
      } else {
        openWindow("container");
      }
    };

    const handleContainerClosed = () => {
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

  return (
    <div className="relative w-screen h-screen bg-[#0b0f17] overflow-hidden">
      {/* ── 1.2: Main menu overlay — visible until player enters game ── */}
      {!isInGame && <MainMenuUI onStart={handleThreeDStart} />}

      {/* Canvas is only in the DOM when in game, avoiding premature Babylon init */}
      {isInGame && (
        <>
          <canvas
            ref={canvasRef}
            className="w-full h-full block outline-none"
          />
          {worldLoading && (
            <div
              className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#0b0f17]/85 pointer-events-auto"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-amber-400 animate-spin" />
              <p className="mt-4 text-sm tracking-wide text-white/80">
                {t_game("loading_initializing_world")}
              </p>
            </div>
          )}
          {worldLoadError && !worldLoading && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#0b0f17]/90 pointer-events-auto px-6 text-center">
              <p className="text-sm text-red-300">{worldLoadError}</p>
              <button
                type="button"
                className="mt-4 rounded border border-white/20 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
                onClick={handleReturnToMenu}
              >
                {t_game("menu_back")}
              </button>
            </div>
          )}
          {!worldLoading && (
            <>
          {/* S9-T1: damage vignette flash — red radial border when player takes damage */}
          {vignetteActive && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background:
                  "radial-gradient(ellipse at center, transparent 55%, rgba(220,0,0,0.55) 100%)",
                animation: "none",
                opacity: 1,
                transition: "opacity 0.4s ease-out",
              }}
            />
          )}
          {/* S7-FP1: crosshair — only visible in first-person mode */}
          {isFP && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 10,
                height: 10,
                pointerEvents: "none",
              }}
            >
              {/* Horizontal bar */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: 0,
                  width: "100%",
                  height: 1.5,
                  background: "rgba(255,255,255,0.85)",
                  transform: "translateY(-50%)",
                }}
              />
              {/* Vertical bar */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 0,
                  width: 1.5,
                  height: "100%",
                  background: "rgba(255,255,255,0.85)",
                  transform: "translateX(-50%)",
                }}
              />
              {/* Center dot */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: 2,
                  height: 2,
                  background: "white",
                  borderRadius: "50%",
                  transform: "translate(-50%,-50%)",
                }}
              />
            </div>
          )}
          <HUD />
          {/* S8-T2: rune hotbar — Q casts active slot, R cycles slot */}
          <div
            style={{
              position: "absolute",
              bottom: 80,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 6,
              pointerEvents: "none",
            }}
          >
            {runeSlots.map((runeId, i) => (
              <div
                key={i}
                style={{
                  width: 48,
                  height: 48,
                  border:
                    i === activeRuneSlot
                      ? "2px solid #ff8800"
                      : "2px solid rgba(255,255,255,0.3)",
                  borderRadius: 6,
                  background: "rgba(0,0,0,0.6)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: runeId ? "#ffcc66" : "#555",
                  userSelect: "none",
                }}
              >
                <div style={{ fontSize: 18 }}>{runeId ? "✦" : "·"}</div>
                <div style={{ fontSize: 9, marginTop: 2, opacity: 0.75 }}>
                  {i + 1}
                </div>
              </div>
            ))}
          </div>
          <WindowLayer />
          <SystemMenuUI
            isOpen={windows.systemMenu}
            onClose={() => toggleUiWindow("systemMenu")}
            onSave={saveAndNotify}
            onSaveAndExit={handleSystemSaveAndExit}
            useScenePause={false}
          />
          <HeroDashboard />
          <NotificationSystem />
          <LevelUpNotification />
          <ThreeDFloatingText
            engine={runtimeBridge?.engine}
            scene={runtimeBridge?.scene}
          />
          <PerfMonitor />
            </>
          )}
        </>
      )}
    </div>
  );
}
