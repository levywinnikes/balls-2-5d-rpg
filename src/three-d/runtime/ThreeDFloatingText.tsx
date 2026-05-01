import React, { useCallback, useEffect, useState, useRef } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { Matrix, Vector3 } from "@babylonjs/core";

export interface FloatingTextData {
  x: number;
  y: number;
  z: number;
  damage?: number;
  message?: string;
  isCritical?: boolean;
  icon?: string;
  customColor?: string;
  isAmbient?: boolean;
}

interface ActiveFloatingText extends FloatingTextData {
  id: string;
  screenX: number;
  screenY: number;
  createdAt: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  stackOffset: number;
  lifetimeMs: number;
}

/**
 * ThreeDFloatingText — React overlay for damage/healing popups in 3D slice
 * Receives world position from PlayerState events, converts to screen coords
 * Uses Babylon.js camera for perspective transform
 */
export const ThreeDFloatingText: React.FC<{ engine?: any; scene?: any }> = ({
  engine,
  scene,
}) => {
  const [floatingTexts, setFloatingTexts] = useState<ActiveFloatingText[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const floatingTextsRef = useRef<ActiveFloatingText[]>([]);
  const recentEventRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    floatingTextsRef.current = floatingTexts;
  }, [floatingTexts]);

  useEffect(() => {
    if (document.getElementById("three-d-floating-text-keyframes")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "three-d-floating-text-keyframes";
    style.textContent = `
      @keyframes ftPopIn {
        0% { transform: scale(0.5); }
        100% { transform: scale(1); }
      }
      @keyframes ftFloatFade {
        0%   { opacity: 1; transform: translate(-50%, -100%) translateY(0px); }
        100% { opacity: 0; transform: translate(-50%, -100%) translateY(-42px); }
      }
      @keyframes ftCriticalPulse {
        0% { filter: saturate(1); }
        50% { filter: saturate(1.35); }
        100% { filter: saturate(1); }
      }
    `;

    document.head.appendChild(style);
  }, []);

  const projectToScreen = useCallback(
    (wx: number, wy: number, wz: number) => {
      if (!scene || !engine || !scene.activeCamera) {
        return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      }

      const world = Vector3.Project(
        new Vector3(wx, wy + 0.75, wz),
        Matrix.IdentityReadOnly,
        scene.getTransformMatrix(),
        scene.activeCamera.viewport.toGlobal(
          engine.getRenderWidth(),
          engine.getRenderHeight(),
        ),
      );

      return { x: world.x, y: world.y };
    },
    [scene, engine],
  );

  const canProjectToScreen = useCallback(() => {
    return Boolean(scene && engine && scene.activeCamera);
  }, [scene, engine]);

  // Subscribe to PlayerState "floatingText" event
  useEffect(() => {
    const ps = PlayerState.getInstance();

    const handleFloatingText = (data: FloatingTextData) => {
      if (!canProjectToScreen()) {
        return;
      }

      const xBucket = Math.round(data.x * 2);
      const zBucket = Math.round(data.z * 2);
      const dedupeKey = [
        xBucket,
        zBucket,
        data.damage ?? "",
        data.message ?? "",
        data.icon ?? "",
        data.isCritical ? 1 : 0,
      ].join(":");
      const now = Date.now();
      const lastAt = recentEventRef.current.get(dedupeKey);
      if (lastAt && now - lastAt < 220) {
        return;
      }
      recentEventRef.current.set(dedupeKey, now);
      if (recentEventRef.current.size > 80) {
        recentEventRef.current.forEach((at, key) => {
          if (now - at > 1000) {
            recentEventRef.current.delete(key);
          }
        });
      }

      const id = `ft_${Date.now()}_${Math.random()}`;
      const projected = projectToScreen(data.x, data.y, data.z);

      const activeAtPoint = floatingTextsRef.current.filter(
        (item) =>
          Math.abs(item.screenX - projected.x) < 48 &&
          Math.abs(item.screenY - projected.y) < 48,
      ).length;

      const lifetimeMs = data.isAmbient ? 4000 : 1200;

      const activeText: ActiveFloatingText = {
        ...data,
        id,
        screenX: projected.x,
        screenY: projected.y,
        createdAt: Date.now(),
        worldX: data.x,
        worldY: data.y,
        worldZ: data.z,
        stackOffset: activeAtPoint * 20,
        lifetimeMs,
      };

      setFloatingTexts((prev) => [...prev, activeText]);

      setTimeout(() => {
        setFloatingTexts((prev) => prev.filter((t) => t.id !== id));
      }, lifetimeMs + 120);
    };

    ps.on("floatingText", handleFloatingText);
    return () => {
      ps.off("floatingText", handleFloatingText);
    };
  }, [projectToScreen, canProjectToScreen]);

  useEffect(() => {
    let rafId = 0;
    const update = () => {
      if (
        scene &&
        engine &&
        scene.activeCamera &&
        floatingTextsRef.current.length > 0
      ) {
        setFloatingTexts((prev) =>
          prev.map((t) => {
            const projected = projectToScreen(t.worldX, t.worldY, t.worldZ);
            return {
              ...t,
              screenX: projected.x,
              screenY: projected.y,
            };
          }),
        );
      }
      rafId = window.requestAnimationFrame(update);
    };

    rafId = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(rafId);
  }, [scene, engine, projectToScreen]);

  const getDisplayText = (data: ActiveFloatingText): string => {
    if (data.message) return data.message;
    if (data.damage !== undefined) {
      return `${Math.abs(data.damage)}`;
    }
    return "";
  };

  const getIcon = (data: ActiveFloatingText): string => {
    if (data.icon) return data.icon;
    if (data.damage !== undefined) {
      if (data.damage < 0) return "❤";
      if (data.damage > 0) return "💚";
    }
    return "";
  };

  const getColor = (data: ActiveFloatingText): string => {
    if (data.customColor) return data.customColor;
    if (data.isCritical) return "#FF0000";
    if (data.damage !== undefined) {
      if (data.damage < 0) return "#FF3333";
      if (data.damage > 0) return "#00AA00";
    }
    return "#FFFFFF";
  };

  const getFontSize = (data: ActiveFloatingText): number => {
    if (data.message && data.message.includes("🛡")) return 48;
    if (data.isAmbient) return 10;
    if (data.isCritical) return 64;
    return 48;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9999 }}
    >
      {floatingTexts.map((text) => {
        const displayText = getDisplayText(text);
        const icon = getIcon(text);
        const color = getColor(text);
        const fontSize = getFontSize(text);

        return (
          /* Outer div: handles position, floatFade (opacity + translateY), fill-mode: forwards */
          <div
            key={text.id}
            style={{
              position: "absolute",
              left: `${text.screenX}px`,
              top: `${text.screenY - text.stackOffset}px`,
              pointerEvents: "none",
              userSelect: "none",
              animation: text.isCritical
                ? `ftFloatFade ${text.lifetimeMs}ms cubic-bezier(0.22, 1, 0.36, 1) forwards, ftCriticalPulse 200ms ease-in-out 2`
                : `ftFloatFade ${text.lifetimeMs}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
            }}
          >
            {/* Inner div: handles scale pop-in only, no transform conflict */}
            <div
              style={{
                fontFamily: "Arial",
                fontWeight: "bold",
                color: color,
                fontSize: `${fontSize}px`,
                textShadow: "1px 1px 2px #000000",
                whiteSpace: "nowrap",
                animation: `ftPopIn 260ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
                display: "flex",
                alignItems: "center",
              }}
            >
              {icon && <span style={{ marginRight: "4px" }}>{icon}</span>}
              {displayText}
            </div>
          </div>
        );
      })}
    </div>
  );
};
