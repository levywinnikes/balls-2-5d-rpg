import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import {
  PlayerState,
  GroundDragData,
} from "../game/entities/Player/PlayerState";
import { translations, Language, setGlobalLanguage } from "../game/i18n/translations";
import { formatItemTooltip } from "../game/utils/TooltipUtils";
import { useLanguage } from "./LanguageContext";

export interface TooltipData {
  text: string;
  subtext?: string | React.ReactNode;
  x: number;
  y: number;
  item?: any; // WeaponDefinition actually, but loose typing avoids circular deps
}

export interface WindowState {
  inventory: boolean;
  character: boolean;
  settings: boolean;
  statusHud: boolean;
  minimap: boolean;
  questLog: boolean;
  expandedMap: boolean;
  systemMenu: boolean;
  grimorio: boolean;
  heroMenu: boolean;
  cheats: boolean;
}

export interface WindowPositions {
  [key: string]: { x: number; y: number };
}

interface UIContextType {
  scale: number;
  setScale: (scale: number) => void;
  s: (pixels: number) => number;

  tooltip: TooltipData | null;
  showTooltip: (data: TooltipData) => void;
  hideTooltip: () => void;

  draggedItem: any | null;
  setDraggedItem: (item: any | null) => void;

  windows: WindowState;
  toggleWindow: (key: keyof WindowState) => void;
  setAllWindows: (windows: WindowState) => void;

  windowPositions: WindowPositions;
  updateWindowPosition: (key: string, x: number, y: number) => void;
  setAllWindowPositions: (positions: WindowPositions) => void;

  // Split Stack Logic
  openSplitStack: (item: any, max: number, onConfirm: (count: number) => void) => void;
  splitStackState: { item: any, max: number, onConfirm: (count: number) => void } | null;
  closeSplitStack: () => void;

  groundDrag: GroundDragData | null;
  
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations.en) => string;

  windowZIndices: Record<string, number>;
  bringToFront: (key: string) => void;

  debugCollision: boolean;
  toggleDebugCollision: () => void;

  // Settings
  bloodEnabled: boolean;
  toggleBlood: () => void;

  cloudShadowsEnabled: boolean;
  toggleCloudShadows: () => void;
  graphicsQuality: "low" | "mid" | "high";
  setGraphicsQuality: (q: "low" | "mid" | "high") => void;
  showFPS: boolean;
  toggleFPS: () => void;
  
  // Editor
  isEditorMode: boolean;
  toggleEditorMode: (enabled: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Use Global Language Context
  const { language, setLanguage, t } = useLanguage();

  const [scale, setScaleState] = useState(1);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [draggedItem, setDraggedItem] = useState<any | null>(null);
  const [groundDrag, setGroundDrag] = useState<GroundDragData | null>(null);
  // Cloud Shadows
  const [cloudShadowsEnabled, setCloudShadowsEnabled] = useState(() => {
     const saved = localStorage.getItem("tgs_settings_clouds");
     const val = saved !== "false"; // Default TRUE
     PlayerState.getInstance().setCloudShadowsEnabled(val);
     return val;
  });

  // Quality Settings
  const [graphicsQuality, setGraphicsQualityState] = useState<"low" | "mid" | "high">(() => {
      const saved = localStorage.getItem("tgs_settings_quality") as "low" | "mid" | "high";
      return saved || "high";
  });

  const setGraphicsQuality = (q: "low" | "mid" | "high") => {
      setGraphicsQualityState(q);
      localStorage.setItem("tgs_settings_quality", q);
      setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
  };

  // FPS Counter
  const [showFPS, setShowFPS] = useState(() => {
      return localStorage.getItem("tgs_settings_fps") === "true";
  });

  const [bloodEnabled, setBloodEnabled] = useState(() => {
     const saved = localStorage.getItem("tgs_settings_blood");
     return saved === "true"; 
  });
  
  // Split Stack State
  const [splitStackState, setSplitStackState] = useState<{ item: any, max: number, onConfirm: (count: number) => void } | null>(null);

  const openSplitStack = (item: any, max: number, onConfirm: (count: number) => void) => {
      setSplitStackState({ item, max, onConfirm });
  };
  const closeSplitStack = () => {
      setSplitStackState(null);
  };
  
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const mousePosRef = React.useRef({ x: 0, y: 0 });
  const [debugCollision, setDebugCollision] = useState(PlayerState.getInstance().isDebugCollisionEnabled());

  useEffect(() => {
      setGlobalLanguage(language);
  }, [language]);

  const toggleBlood = () => {
    setBloodEnabled(prev => {
        const newVal = !prev;
        localStorage.setItem("tgs_settings_blood", String(newVal));
        return newVal;
    });
  };

  const toggleCloudShadows = () => {
      setCloudShadowsEnabled(prev => {
          const newVal = !prev;
          PlayerState.getInstance().setCloudShadowsEnabled(newVal);
          localStorage.setItem("tgs_settings_clouds", String(newVal));
          return newVal;
      });
  };

  const [windows, setWindows] = useState<WindowState>({
    inventory: false,
    character: false,
    settings: false,
    statusHud: true,
    minimap: true,
    questLog: false,
    expandedMap: false,
    systemMenu: false,
    grimorio: true,
    heroMenu: false,
    cheats: false,
  });

  const [windowPositions, setWindowPositions] = useState<WindowPositions>({});
  const [windowZIndices, setWindowIndices] = useState<Record<string, number>>({});
  const nextZIndexRef = React.useRef(100);

  // Auto-Scale Logic
  useEffect(() => {
    const handleResize = () => {
        const baseHeight = 1080; // Reference 1080p
        const h = window.innerHeight;
        const newScale = h / baseHeight;
        setScaleState(newScale);
    };
    
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const s = (pixels: number) => pixels; // Identity
  const setScale = (val: number) => { console.warn("Manual setScale ignored"); };

  const setAllWindows = (newWindows: WindowState) => {
    setWindows(newWindows);
  };

  const updateWindowPosition = (key: string, x: number, y: number) => {
    setWindowPositions((prev) => ({ ...prev, [key]: { x, y } }));
  };
  
  const setAllWindowPositions = (positions: WindowPositions) => {
    setWindowPositions(positions);
  };

  const bringToFront = useCallback((key: string) => {
      const nextZ = nextZIndexRef.current;
      nextZIndexRef.current += 1;
      setWindowIndices(prev => {
        return { ...prev, [key]: nextZ };
      });
  }, []);

  const toggleWindow = useCallback((key: keyof WindowState) => {
    setWindows((prev) => {
        const isOpen = !prev[key];
        if(isOpen) bringToFront(key); 
        return { ...prev, [key]: isOpen };
    });
  }, [bringToFront]);

  const toggleFPS = () => {
      setShowFPS(prev => {
          const newVal = !prev;
          localStorage.setItem("tgs_settings_fps", String(newVal));
          return newVal;
      });
  };

  // Editor Mode
  const [isEditorMode, setIsEditorMode] = useState(false);
  const toggleEditorMode = useCallback((enabled: boolean) => {
      setIsEditorMode(enabled);
  }, []);

  // PlayerState Events
  useEffect(() => {
    const ps = PlayerState.getInstance();

    const handleStartDrag = (data: GroundDragData) => {
        setGroundDrag(data);
        setTooltip(null);
    };
    const handleEndDrag = () => setGroundDrag(null);

    ps.on("startGroundDrag", handleStartDrag);
    ps.on("endGroundDrag", handleEndDrag);

    const handleRequestItemTooltip = (itemData: any) => {
        const { name, subtext: formattedSubtext } = formatItemTooltip((itemData as any).def, itemData);
        setTooltip({
            text: name,
            subtext: formattedSubtext,
            x: mousePosRef.current.x,
            y: mousePosRef.current.y,
            item: (itemData as any).def
        });
    };

    const handleClearItemTooltip = () => {
        setTooltip(null);
    };

    ps.on("requestItemTooltip", handleRequestItemTooltip);
    ps.on("clearItemTooltip", handleClearItemTooltip);

    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      if (groundDrag) {
        setMousePos({ x: e.clientX, y: e.clientY });
      }
    };

    const handleGlobalMouseUp = () => {
      setTimeout(() => {
        const currentDrag = PlayerState.getInstance()["groundDragData"];
        if (currentDrag) {
          PlayerState.getInstance().endGroundDrag(false);
        }
      }, 50);
    };

    const handleDebugCollisionChanged = (enabled: boolean) => {
        setDebugCollision(enabled);
    };
    ps.on("debugCollisionChanged", handleDebugCollisionChanged);

    const handleGlobalMouseDown = () => {
        if (tooltip) setTooltip(null); 
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("mousedown", handleGlobalMouseDown);

    return () => {
      ps.off("startGroundDrag", handleStartDrag);
      ps.off("endGroundDrag", handleEndDrag);
      ps.off("requestItemTooltip", handleRequestItemTooltip);
      ps.off("clearItemTooltip", handleClearItemTooltip);
      ps.off("debugCollisionChanged", handleDebugCollisionChanged);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("mousedown", handleGlobalMouseDown);
    };
  }, [groundDrag, tooltip]);

  const isRightSide = tooltip ? tooltip.x > window.innerWidth / 2 : false;
  const isBottomSide = tooltip ? tooltip.y > window.innerHeight / 2 : false;

  return (
    <UIContext.Provider
      value={{
        scale,
        setScale,
        s,
        tooltip,
        showTooltip: setTooltip,
        hideTooltip: () => setTooltip(null),
        draggedItem,
        setDraggedItem: (item) => {
             setDraggedItem(item);
             if (item) setTooltip(null);
        },
        windows,
        toggleWindow,
        setAllWindows,
        windowPositions,
        updateWindowPosition,
        setAllWindowPositions,
        bloodEnabled,
        toggleBlood,
        cloudShadowsEnabled,
        toggleCloudShadows,
        groundDrag,
        openSplitStack,
        closeSplitStack,
        splitStackState,
        language,
        setLanguage,
        t,
        windowZIndices,
        bringToFront,
        debugCollision,
        toggleDebugCollision: () => PlayerState.getInstance().toggleDebugCollision(),
        graphicsQuality,
        setGraphicsQuality,
        showFPS,
        toggleFPS,
        isEditorMode,
        toggleEditorMode,
      }}
    >

      {children}

      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: isRightSide ? undefined : tooltip.x + 15,
            right: isRightSide ? window.innerWidth - tooltip.x + 15 : undefined,
            top: isBottomSide ? undefined : tooltip.y + 15,
            bottom: isBottomSide ? window.innerHeight - tooltip.y + 15 : undefined,
            
            backgroundColor: "rgba(10, 10, 10, 0.95)",
            border: "1px solid #777",
            borderRadius: "6px",
            zIndex: 99999,
            pointerEvents: "none",
            color: "white",
            fontSize: `${s(12)}px`,
            maxWidth: "380px", 
            boxShadow: "0 8px 16px rgba(0,0,0,0.6)",
            display: "flex",
            flexDirection: "row", 
            overflow: "hidden"
          }}
        >
          {/* LEFT COLUMN: Huge Icon */}
          {tooltip.item?.id && (
             <div style={{
                 backgroundColor: "#050505",
                 width: `${s(140)}px`,
                 minHeight: `${s(140)}px`,
                 display: "flex",
                 alignItems: "center",
                 justifyContent: "center",
                 borderRight: "1px solid #333",
                 padding: "10px"
             }}>
                 {tooltip.item.id === "light_torch" ? (
                      <div
                        style={{
                            width: "128px",
                            height: "128px",
                            imageRendering: "pixelated",
                            backgroundPosition: "center",
                            backgroundRepeat: "no-repeat",
                            backgroundSize: "100% 100%",
                            animation: "play-torch-files 0.8s steps(1) infinite",
                            filter: "drop-shadow(0 0 10px rgba(0,0,0,0.5))"
                        }}
                      />
                 ) : (
                     <img 
                         src={`assets/items/${tooltip.item.id}.png`} 
                         style={{ 
                             width: "128px", 
                             height: "128px", 
                             objectFit: "contain", 
                             imageRendering: "pixelated",
                             filter: "drop-shadow(0 0 10px rgba(0,0,0,0.5))"
                         }}
                         alt={tooltip.text}
                     />
                 )}
             </div>
          )}

          {/* RIGHT COLUMN: Content */}
          <div style={{ 
              flex: 1, 
              display: "flex", 
              flexDirection: "column", 
              padding: "12px",
              minWidth: "180px"
          }}>
              {/* Header */}
              <div style={{ fontWeight: "bold", color: "#fbbf24", fontSize: "1.2em", marginBottom: "8px", borderBottom: "1px solid #333", paddingBottom: "4px" }}>
                {tooltip.text}
              </div>

              {/* Stats */}
              {tooltip.subtext && (
                <div
                  style={{
                    color: "#ddd",
                    fontSize: "0.95em",
                    whiteSpace: "pre-wrap", 
                    lineHeight: "1.5",
                    marginBottom: "8px"
                  }}
                >
                  {tooltip.subtext}
                </div>
              )}

              {/* Description */}
              {tooltip.item?.description && (
                 <div style={{ 
                     marginTop: "auto",
                     paddingTop: "8px",
                     borderTop: "1px solid #333",
                     fontStyle: "italic", 
                     color: "#aaa",
                     fontSize: "0.9em"
                 }}>
                     {(() => {
                        const val = t(tooltip.item.description as any);
                        return val;
                     })()}
                 </div>
              )}
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used within a UIProvider");
  return context;
};
