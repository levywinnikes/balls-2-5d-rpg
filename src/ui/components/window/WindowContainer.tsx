import React, { useEffect, useRef, useState } from "react";
import { X, Minus, Lock, Unlock } from "lucide-react";
import { useWindowSystem, WindowInstance } from "./WindowContext";
import { WindowRegistry } from "./WindowRegistry";
import { ContentFreezer } from "./ContentFreezer";
import { useUI } from "../../../context/UIContext";

interface WindowContainerProps {
  instance: WindowInstance;
}

export const WindowContainer: React.FC<WindowContainerProps> = ({
  instance,
}) => {
  const { updateWindow, closeWindow, focusWindow } = useWindowSystem();
  const { scale, s } = useUI();
  const registry = WindowRegistry.get(instance.id);

  // Refs for GPU Drag
  const windowRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Refs for Resize
  const isResizing = useRef(false);
  const resizeStart = useRef({ w: 0, h: 0, x: 0, y: 0 }); // Size and Mouse Pos at start

  // Local State for Interaction (Visual Freeze)
  const [isInteracting, setIsInteracting] = useState(false);

  // Initial / Current State
  // We maintain 'currentPos' in ref to update DOM without render,
  // but we check prop 'instance.position' for initial load.
  const currentPos = useRef(instance.position || { x: 100, y: 100 });
  const currentSize = useRef(
    instance.size || {
      width: registry?.defaultWidth || 300,
      height: registry?.defaultHeight || 400,
    },
  );

  // --- DRAG HANDLERS ---
  const handleMouseDownHeader = (e: React.MouseEvent) => {
    if (instance.pinned) return;
    if (e.button !== 0) return; // Only Left Click

    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - currentPos.current.x,
      y: e.clientY - currentPos.current.y,
    };

    setIsInteracting(true);
    focusWindow(instance.id);

    // Global Listeners for Drag
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // --- RESIZE HANDLERS ---
  const handleMouseDownResize = (e: React.MouseEvent) => {
    if (instance.minimized) return;
    e.stopPropagation();

    isResizing.current = true;
    resizeStart.current = {
      w: currentSize.current.width,
      h: currentSize.current.height,
      x: e.clientX,
      y: e.clientY,
    };

    setIsInteracting(true);
    focusWindow(instance.id);

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!windowRef.current) return;

    if (isDragging.current) {
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;
      currentPos.current = { x: newX, y: newY };

      // Direct DOM Transform (Zero React Render)
      windowRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
    }

    if (isResizing.current) {
      const dx = (e.clientX - resizeStart.current.x) / scale; // Adjust for UI Scale
      const dy = (e.clientY - resizeStart.current.y) / scale;

      const newW = Math.max(150, resizeStart.current.w + dx);
      const newH = Math.max(100, resizeStart.current.h + dy);

      currentSize.current = { width: newW, height: newH };

      // Update Width/Height directly
      windowRef.current.style.width = `${newW * scale}px`;
      windowRef.current.style.height = `${newH * scale}px`;
    }
  };

  const onMouseUp = () => {
    if (isDragging.current || isResizing.current) {
      isDragging.current = false;
      isResizing.current = false;
      setIsInteracting(false);

      // Sync to Context (Persist Position/Size)
      updateWindow(instance.id, {
        position: currentPos.current,
        size: currentSize.current,
      });

      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
  };

  // --- INITIAL RENDER EFFECT ---
  useEffect(() => {
    // Apply initial Position/Size from ref to DOM
    if (windowRef.current) {
      windowRef.current.style.transform = `translate(${currentPos.current.x}px, ${currentPos.current.y}px)`;
      windowRef.current.style.width = `${currentSize.current.width * scale}px`;

      if (instance.minimized) {
        // Determine header height logic via CSS or hardcode
        windowRef.current.style.height = `auto`; // Let Content logic handle min
      } else {
        windowRef.current.style.height = `${currentSize.current.height * scale}px`;
      }
    }
  }, [scale, instance.minimized]);

  // Content Component
  const Content = registry?.component;

  // Header Height constraint for minimized
  const headerHeight = 32 * scale;

  return (
    <div
      ref={windowRef}
      className="window-container"
      onMouseDown={() => focusWindow(instance.id)}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        // W/H set via Effect/Ref
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-glass)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md, 8px)",
        boxShadow: "var(--shadow-window, 0 10px 25px rgba(0,0,0,0.5))",
        backdropFilter: "blur(12px)",
        zIndex: instance.zIndex,
        pointerEvents: "auto", // Essential reset
        overflow: "hidden",
        color: "var(--text-primary)",
        fontFamily: "var(--font-rpg, sans-serif)",
        fontSize: `${14 * scale}px`,
        // Initial inline styles for strict hydration matched with Refs
        transform: `translate(${currentPos.current.x}px, ${currentPos.current.y}px)`,
        width: `${currentSize.current.width * scale}px`,
        height: instance.minimized
          ? `${headerHeight}px`
          : `${currentSize.current.height * scale}px`,
      }}
    >
      {/* --- HEADER --- */}
      <div
        className="window-header"
        onMouseDown={handleMouseDownHeader}
        onDoubleClick={() =>
          updateWindow(instance.id, { minimized: !instance.minimized })
        }
        style={{
          height: `${headerHeight}px`,
          backgroundColor: "var(--bg-header)",
          borderBottom: instance.minimized
            ? "none"
            : "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `0 ${s(8)}px`,
          cursor: instance.pinned ? "default" : "move",
          userSelect: "none",
          flexShrink: 0,
        }}
      >
        {/* Title */}
        <span
          style={{
            fontWeight: "bold",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {registry?.defaultTitle || instance.id}
        </span>

        {/* Controls */}
        <div className="flex gap-1 items-center">
          <button
            className="hover:text-[var(--text-highlight)] transition-colors p-[2px]"
            onClick={() =>
              updateWindow(instance.id, { pinned: !instance.pinned })
            }
            title={instance.pinned ? "Unpin" : "Pin"}
          >
            {instance.pinned ? (
              <Lock size={12 * scale} color="#fbbf24" />
            ) : (
              <Unlock size={12 * scale} color="#9ca3af" />
            )}
          </button>
          <button
            className="hover:text-[var(--text-highlight)] transition-colors p-[2px]"
            onClick={() =>
              updateWindow(instance.id, { minimized: !instance.minimized })
            }
          >
            <Minus size={14 * scale} color="#d1d5db" />
          </button>
          <button
            className="hover:text-red-400 transition-colors p-[2px]"
            onClick={() => closeWindow(instance.id)}
          >
            <X size={14 * scale} color="#f87171" />
          </button>
        </div>
      </div>

      {/* --- CONTENT (FROZEN) --- */}
      {!instance.minimized && (
        <div
          style={{
            flex: 1,
            overflow: "hidden", // Let child handle scroll if needed, or set to auto
            position: "relative",
            padding: `${s(8)}px`,
            // If interacting, disable pointer events
            pointerEvents: isInteracting ? "none" : "auto",
          }}
        >
          <ContentFreezer frozen={isInteracting}>
            {Content ? (
              <Content windowId={instance.id} />
            ) : (
              <div>Content Not Found</div>
            )}
          </ContentFreezer>
        </div>
      )}

      {/* --- RESIZE HANDLE --- */}
      {!instance.minimized && !instance.pinned && (
        <div
          onMouseDown={handleMouseDownResize}
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: "16px",
            height: "16px",
            cursor: "se-resize",
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
};
