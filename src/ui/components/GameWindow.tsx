import React, { useState } from "react";
import { Rnd } from "react-rnd";
import { X, Minus, Lock, Unlock } from "lucide-react";
import { useUI } from "../../context/UIContext";

interface GameWindowProps {
  title: React.ReactNode | string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  zIndex?: number;
  icon?: React.ReactNode; // Added Icon support
  onFocus?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onMouseUpCapture?: (e: React.MouseEvent) => void;
}

export const GameWindowBase: React.FC<GameWindowProps & { position?: { x: number; y: number }, onMove?: (x: number, y: number) => void }> = ({
  title,
  isOpen,
  onClose,
  children,
  defaultPosition = { x: 100, y: 100 },
  defaultSize = { width: 250, height: 350 },
  position: externalPosition,
  onMove,
  zIndex = 50,
  onFocus,
  onDrop,
  onDragOver,
  onMouseUpCapture,
  icon // Added to destructuring
}) => {
  const { scale, s } = useUI();
  // ... (State logic unchanged) ...
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  
  const getCenterPosition = () => {
      const winW = defaultSize.width * scale;
      const winH = defaultSize.height * scale;
      return {
          x: (window.innerWidth - winW) / 2,
          y: (window.innerHeight - winH) / 2
      };
  };

  const initialPos = externalPosition || (
      (defaultPosition.x === 100 && defaultPosition.y === 100) 
      ? getCenterPosition() 
      : defaultPosition
  );

  const [currentPos, setCurrentPos] = useState(initialPos);
  const [currentSize, setCurrentSize] = useState(defaultSize);

  const rndRef = React.useRef<Rnd>(null);

  React.useEffect(() => {
    if (externalPosition && rndRef.current) {
        rndRef.current.updatePosition(externalPosition);
        setCurrentPos(externalPosition);
    }
  }, [externalPosition?.x, externalPosition?.y]);
  
  const handleInteraction = () => {
      onFocus?.();
  };

  if (!isOpen) return null;

  const btnStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "2px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
  };

  const headerHeight = 32;

  return (
    <Rnd
      ref={rndRef}
      defaultPosition={initialPos}
      size={{
        width: currentSize.width * scale,
        height: (isMinimized ? headerHeight : currentSize.height) * scale,
      }}
      minWidth={150 * scale}
      minHeight={headerHeight * scale}
      dragHandleClassName="window-header"
      enableResizing={!isMinimized}
      disableDragging={isPinned}
      onDragStart={handleInteraction}
      onMouseDown={handleInteraction}
      onDragStop={(e, d) => {
        setCurrentPos({ x: d.x, y: d.y });
        onMove?.(d.x, d.y);
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
          setCurrentSize({
              width: ref.offsetWidth / scale,
              height: ref.offsetHeight / scale
          });
          setCurrentPos({ x: position.x, y: position.y });
          onMove?.(position.x, position.y);
      }}
      // DRAG & DROP HANDLERS
      onDrop={onDrop}
      onDragOver={onDragOver}
      onMouseUpCapture={onMouseUpCapture}
      
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-glass)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md, 8px)",
        boxShadow: "var(--shadow-window, 0 10px 25px rgba(0,0,0,0.5))",
        backdropFilter: "blur(12px)",
        zIndex: zIndex,
        pointerEvents: "auto",
        overflow: "hidden",
        fontFamily: "var(--font-rpg, sans-serif)",
        fontSize: `${14 * scale}px`,
        color: "var(--text-primary)",
      }}
    >
      {/* HEADER DA JANELA */}
      <div
        className="window-header"
        style={{
          height: `${headerHeight * scale}px`,
          backgroundColor: "var(--bg-header)",
          borderBottom: isMinimized ? "none" : "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `0 ${s(8)}px`,
          cursor: isPinned ? "default" : "move",
          userSelect: "none",
          flexShrink: 0,
        }}
        onDoubleClick={() => setIsMinimized(!isMinimized)}
      >
        <span
          style={{
            fontWeight: "bold",
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginRight: "8px",
          }}
        >
          {icon && <span style={{ marginRight: "8px", display: "flex", alignItems: "center" }}>{icon}</span>}
          {title}
        </span>

        <div style={{ display: "flex", gap: "4px" }}>
          <button
            onClick={() => setIsPinned(!isPinned)}
            style={{ ...btnStyle, color: isPinned ? "#fbbf24" : "#9ca3af" }}
            title={isPinned ? "Desafixar" : "Unpin (Enable Drag)"}
          >
            {isPinned ? (
              <Lock size={12 * scale} />
            ) : (
              <Unlock size={12 * scale} />
            )}
          </button>

          <button
            onClick={() => setIsMinimized(!isMinimized)}
            style={{ ...btnStyle, color: "#d1d5db" }}
            title="Minimizar"
          >
            <Minus size={14 * scale} />
          </button>

          <button
            onClick={onClose}
            style={{ ...btnStyle, color: "#f87171" }}
            title="Fechar"
          >
            <X size={14 * scale} />
          </button>
        </div>
      </div>

      {/* CONTEÚDO */}
      {!isMinimized && (
        <div
          className="custom-scrollbar"
          style={{
            flex: 1,
            overflow: "auto",
            backgroundColor: "transparent",
            padding: `${s(8)}px`,
            position: "relative",
          }}
        >
          {children}
        </div>
      )}
    </Rnd>
  );
};

export const GameWindow = React.memo(GameWindowBase);
