import React, { useEffect, useRef, useState } from "react";
import { HeroDashboard } from "../../ui/dashboard/HeroDashboard";
import { NotificationSystem } from "../../ui/components/NotificationSystem";
import { WindowLayer } from "../../ui/components/window/WindowLayer";
import { HUD } from "../../ui/HUD";
import { LevelUpNotification } from "../../ui/components/LevelUpNotification";
import { ThreeDFloatingText } from "../runtime/ThreeDFloatingText";
import { useWindowSystem } from "../../ui/components/window/WindowContext";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { createDebugSliceScene } from "../runtime/createDebugSliceScene";

export function ThreeDSliceView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [runtimeBridge, setRuntimeBridge] = React.useState<{
    engine: any;
    scene: any;
  } | null>(null);
  // S7-FP1: track first-person mode to show/hide crosshair
  const [isFP, setIsFP] = useState(false);
  // S8-T2: rune hotbar HUD state
  const [runeSlots, setRuneSlots] = useState<string[]>(["fire_burst_rune", "", ""]);
  const [activeRuneSlot, setActiveRuneSlot] = useState(0);
  // S9-T1: damage vignette flash
  const [vignetteActive, setVignetteActive] = useState(false);
  const vignetteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toggleWindow, closeWindow, isWindowOpen, openWindow } =
    useWindowSystem();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const runtime = createDebugSliceScene(canvas);
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
      const detail = (e as CustomEvent<{ slots: string[]; activeIndex: number }>).detail;
      setRuneSlots(detail.slots);
      setActiveRuneSlot(detail.activeIndex);
    };
    document.addEventListener("slice3d:runeSlotChanged", handleRuneSlot);

    // S9-T1: listen for player hit → trigger vignette flash
    const handlePlayerHit = () => {
      setVignetteActive(true);
      if (vignetteTimerRef.current) clearTimeout(vignetteTimerRef.current);
      vignetteTimerRef.current = setTimeout(() => setVignetteActive(false), 400);
    };
    document.addEventListener("slice3d:playerHit", handlePlayerHit);

    // Bridge classic HUD/UIContext windows to WindowSystem ids used by ThreeDSliceView.
    const handleUiWindowToggled = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string; isOpen: boolean }>).detail;
      const windowIdMap: Record<string, string> = {
        heroMenu: "hero_menu",
        settings: "settings",
        expandedMap: "expandedMap",
        questLog: "questLog",
        cheats: "cheats",
        // Temporary routing until Grimorio and SystemMenu are registered in WindowRegistry for 3D.
        grimorio: "hero_menu",
        systemMenu: "settings",
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
      document.removeEventListener("slice3d:cameraModeChanged", handleCameraMode);
      document.removeEventListener("slice3d:runeSlotChanged", handleRuneSlot);
      document.removeEventListener("slice3d:playerHit", handlePlayerHit);
      document.removeEventListener("ui:windowToggled", handleUiWindowToggled);
      if (vignetteTimerRef.current) clearTimeout(vignetteTimerRef.current);
      setRuntimeBridge(null);
      runtime.dispose();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "i" || event.key === "Tab") {
        event.preventDefault();
        toggleWindow("hero_menu");
        return;
      }

      if (key === "j" || key === "l") {
        event.preventDefault();
        toggleWindow("questLog");
        return;
      }

      if (key === "o") {
        event.preventDefault();
        toggleWindow("settings");
        return;
      }

      if (key === "m") {
        event.preventDefault();
        toggleWindow("expandedMap");
        return;
      }

      if (key === "escape" && isWindowOpen("hero_menu")) {
        event.preventDefault();
        closeWindow("hero_menu");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleWindow, closeWindow, isWindowOpen]);

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
      <canvas ref={canvasRef} className="w-full h-full block outline-none" />
      {/* S9-T1: damage vignette flash — red radial border when player takes damage */}
      {vignetteActive && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: "radial-gradient(ellipse at center, transparent 55%, rgba(220,0,0,0.55) 100%)",
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
          <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: 1.5, background: "rgba(255,255,255,0.85)", transform: "translateY(-50%)" }} />
          {/* Vertical bar */}
          <div style={{ position: "absolute", left: "50%", top: 0, width: 1.5, height: "100%", background: "rgba(255,255,255,0.85)", transform: "translateX(-50%)" }} />
          {/* Center dot */}
          <div style={{ position: "absolute", top: "50%", left: "50%", width: 2, height: 2, background: "white", borderRadius: "50%", transform: "translate(-50%,-50%)" }} />
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
              border: i === activeRuneSlot ? "2px solid #ff8800" : "2px solid rgba(255,255,255,0.3)",
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
            <div style={{ fontSize: 9, marginTop: 2, opacity: 0.75 }}>{i + 1}</div>
          </div>
        ))}
      </div>
      <WindowLayer />
      <HeroDashboard />
      <NotificationSystem suppressTypes={["exp"]} />
      <LevelUpNotification />
      <ThreeDFloatingText
        engine={runtimeBridge?.engine}
        scene={runtimeBridge?.scene}
      />
    </div>
  );
}
