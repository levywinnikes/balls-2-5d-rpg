import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { usePlayerState } from "../../hooks/usePlayerState";
import { useUI } from "../../context/UIContext";
import { ChevronUp, ChevronDown, Plus, Minus, MapPin, Trash2 } from "lucide-react";
import { WorldMapService } from "../../services/WorldMapService";

export const ExpandedMapContent: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const [mapData, setMapData] = useState<any>(WorldMapService.getMapData());
  const playerState = PlayerState.getInstance();
  const { s, scale } = useUI();

  // Estados de Controle
  const [viewLevel, setViewLevel] = useState<string>("0");
  const [zoom, setZoom] = useState<number>(1);
  
  // --- ZOOM ANCHOR FOR ATOMIC SYNC ---
  const zoomAnchorRef = useRef<{ contentX: number, contentY: number, mouseX: number, mouseY: number } | null>(null);
  
  // --- TRANSITION STATE ---
  const [fadeProgress, setFadeProgress] = useState<number>(1);
  const prevLevelRef = useRef<string | null>(null);
  const fadeStartRef = useRef<number>(0);

  // --- CONTEXT MENU STATE ---
  const [menu, setMenu] = useState<{ x: number, y: number, gridX: number, gridY: number } | null>(null);

  // --- AUTO-FOLLOW DE ANDAR ---
  const currentPlayerLevel = usePlayerState(
    "minimapUpdated",
    () => playerState.getCurrentLevel(),
    "0"
  );

  useEffect(() => {
    setViewLevel(currentPlayerLevel);
  }, [currentPlayerLevel]);

  // Carrega mapa (Only if not already in service)
  useEffect(() => {
    if (WorldMapService.getMapData()) {
        setMapData(WorldMapService.getMapData());
        return;
    }

    fetch("newmap.json?v=" + Date.now())
      .then((res) => res.json())
      .then((data) => {
        WorldMapService.setMapData(data);
        setMapData(data);
        setViewLevel(playerState.getCurrentLevel());
      });
  }, [playerState]);


  const handleLevelChange = (newLevel: string) => {
    if (newLevel === viewLevel) return;
    prevLevelRef.current = viewLevel;
    fadeStartRef.current = performance.now();
    setFadeProgress(0);
    setViewLevel(newLevel);
  };

  const handleLevelUp = () => {
    const next = (parseInt(viewLevel) + 1).toString();
    if (mapData?.levels[next]) handleLevelChange(next);
  };
    
  const handleLevelDown = () => {
    const prev = (parseInt(viewLevel) - 1).toString();
    if (mapData?.levels[prev]) handleLevelChange(prev);
  };

  const handleCenter = useCallback(() => {
    if (!containerRef.current || !mapData) return;
    const pPos = playerState.getPosition();
    if (pPos.level !== viewLevel) {
      setViewLevel(pPos.level);
    }
    
    // Calculate scroll target based on 1:1 map scaled by zoom
    const tileSize = mapData.tileSize || 32;
    const PIXEL_SCALE = 4 * zoom; 
    const drawX = (pPos.x / tileSize) * PIXEL_SCALE;
    const drawY = (pPos.y / tileSize) * PIXEL_SCALE;
    
    const container = containerRef.current;
    container.scrollTo({
      left: drawX - container.clientWidth / 2,
      top: drawY - container.clientHeight / 2,
      behavior: "smooth"
    });
  }, [mapData, viewLevel, zoom, playerState]);

  // --- AUTO-CENTER ON OPEN ---
  useEffect(() => {
    // Only auto-center once when the map is first opened to avoid fighting with zoom/panning
    const timer = setTimeout(() => {
        handleCenter();
    }, 100);
    return () => clearTimeout(timer);
  }, []); // Run only on initial mount

  // --- MOUSE PANNING (DRAG TO SCROLL) ---
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, sL: 0, sT: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    // Normalize mouse start position by UI scale
    const x = (e.pageX - containerRef.current.offsetLeft) / scale;
    const y = (e.pageY - containerRef.current.offsetTop) / scale;
    setDragStart({ x, y, sL: containerRef.current.scrollLeft, sT: containerRef.current.scrollTop });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    
    // Normalize current mouse position by UI scale
    const x = (e.pageX - containerRef.current.offsetLeft) / scale;
    const y = (e.pageY - containerRef.current.offsetTop) / scale;
    
    // The difference (walk) is now in "internal pixels"
    const walkX = (x - dragStart.x) * 1.5;
    const walkY = (y - dragStart.y) * 1.5;
    
    containerRef.current.scrollLeft = dragStart.sL - walkX;
    containerRef.current.scrollTop = dragStart.sT - walkY;
  };

    const handleMouseUp = () => setIsDragging(false);

    // --- CONTEXT MENU (RIGHT CLICK) ---
    const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!containerRef.current || !windowRef.current) return;

        const container = containerRef.current;
        const windowRect = windowRef.current.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // --- UI SCALE NORMALIZATION ---
        const localX = (e.clientX - containerRect.left) / scale;
        const localY = (e.clientY - containerRect.top) / scale;
        
        const menuX = (e.clientX - windowRect.left) / scale;
        const menuY = (e.clientY - windowRect.top) / scale;

        // Exact pixel on the potentially zoomed map
        const worldX = (container.scrollLeft + localX) / zoom;
        const worldY = (container.scrollTop + localY) / zoom;
        
        const gridX = Math.floor(worldX / 4);
        const gridY = Math.floor(worldY / 4);

        console.log(`[Map Sync] Mouse:(${e.clientX},${e.clientY}) Scale:${scale.toFixed(2)} -> Grid:(${gridX},${gridY})`);

        // Find if we clicked on a marker - pick radius 2.5
        const marker = playerState.getMarkers().find(m => {
            const mx = Math.floor(m.x / 32);
            const my = Math.floor(m.y / 32);
            return m.level === viewLevel && Math.abs(mx - gridX) <= 2 && Math.abs(my - gridY) <= 2;
        });

        setSelectedMarkerId(marker ? marker.id : null);
        setMenu({ x: menuX, y: menuY, gridX, gridY });
    };

    const handleAddMarker = () => {
        if (!menu) return;
        const id = `marker_${Date.now()}`;
        playerState.addMarker({
            id,
            x: menu.gridX * (mapData?.tileSize || 32),
            y: menu.gridY * (mapData?.tileSize || 32),
            level: viewLevel,
            label: `Marker ${playerState.getMarkers().length + 1}`,
            color: "#ff0000"
        });
        setMenu(null);
    };

    const handleRenameMarker = () => {
        if (!selectedMarkerId) return;
        const marker = playerState.getMarkers().find(m => m.id === selectedMarkerId);
        if (!marker) return;

        const newName = window.prompt("Enter new marker name:", marker.label);
        if (newName !== null && newName.trim() !== "") {
            playerState.updateMarkerLabel(selectedMarkerId, newName);
        }
        setMenu(null);
    };

    const handleClearMarkers = () => {
        if (window.confirm("Remove all markers from this level?")) {
            const levelMarkers = playerState.getMarkers().filter(m => m.level === viewLevel);
            levelMarkers.forEach(m => playerState.removeMarker(m.id));
        }
    };

    const handleRemoveMarker = (id: string) => {
        playerState.removeMarker(id);
        setMenu(null);
    };

    // --- MOUSE WHEEL ZOOM ---
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const container = containerRef.current;
            if (!container) return;

            const rect = container.getBoundingClientRect();
            // --- UI SCALE NORMALIZATION ---
            const mouseX = (e.clientX - rect.left) / scale;
            const mouseY = (e.clientY - rect.top) / scale;

            // Calculate the map coordinate (world position) currently under the mouse
            const contentX = (container.scrollLeft + mouseX) / zoom;
            const contentY = (container.scrollTop + mouseY) / zoom;

            const zoomDelta = e.deltaY < 0 ? 0.2 : -0.2; // Decreased sensitivity
            const nextZoom = Math.min(Math.max(zoom + zoomDelta, 0.5), 4);

        if (nextZoom !== zoom) {
            // CAPTURE ANCHOR: Store world-coord under mouse and mouse position
            zoomAnchorRef.current = { contentX, contentY, mouseX, mouseY };
            
            // Trigger zoom change
            setZoom(nextZoom);
        }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [zoom, scale]); 

  // --- ATOMIC ZOOM SYNC ---
  useLayoutEffect(() => {
    if (!zoomAnchorRef.current || !containerRef.current) return;
    const { contentX, contentY, mouseX, mouseY } = zoomAnchorRef.current;
    
    // Apply new scroll position synchronously before the browser paints
    containerRef.current.scrollLeft = (contentX * zoom) - mouseX;
    containerRef.current.scrollTop = (contentY * zoom) - mouseY;
    zoomAnchorRef.current = null;
  }, [zoom]);

  // Render Loop (Consumes cached buffer + dynamic player)
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const render = (time: number) => {
      const currentBuffer = WorldMapService.getBuffer(viewLevel);
      const prevBuffer = prevLevelRef.current ? WorldMapService.getBuffer(prevLevelRef.current) : null;
      
      const fadeDuration = 300; // ms
      let alpha = 1;
      
      if (fadeStartRef.current > 0) {
          const elapsed = time - fadeStartRef.current;
          alpha = Math.min(elapsed / fadeDuration, 1);
          if (alpha >= 1) {
              prevLevelRef.current = null;
              fadeStartRef.current = 0;
          }
      }

      // Base drawing logic
      if (currentBuffer) {
        if (canvas.width !== currentBuffer.width) canvas.width = currentBuffer.width;
        if (canvas.height !== currentBuffer.height) canvas.height = currentBuffer.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (prevBuffer && alpha < 1) {
            ctx.globalAlpha = 1 - alpha;
            ctx.drawImage(prevBuffer, 0, 0, canvas.width, canvas.height);
        }

        ctx.globalAlpha = alpha;
        ctx.drawImage(currentBuffer, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
      }

      const pPos = playerState.getPosition();

      if (pPos.level === viewLevel) {
        const tileSize = mapData?.tileSize || 32;
        const drawX = Math.floor(pPos.x / tileSize);
        const drawY = Math.floor(pPos.y / tileSize);

        ctx.fillStyle = "#FFF";
        ctx.fillRect(drawX - 1, drawY, 3, 1);
        ctx.fillRect(drawX, drawY - 1, 1, 3);
        
        ctx.fillStyle = "#F00";
        ctx.fillRect(drawX, drawY, 1, 1);
      }

      // --- DRAW MARKERS ---
      playerState.getMarkers().forEach(m => {
          if (m.level === viewLevel) {
              const mx = Math.floor(m.x / 32);
              const my = Math.floor(m.y / 32);
              const pulse = Math.sin(time / 200) * 0.5 + 0.5;
              ctx.fillStyle = m.color || "#ff0000";
              ctx.beginPath();
              ctx.arc(mx + 0.5, my + 0.5, 1.5 + pulse, 0, Math.PI * 2);
              ctx.fill();
              
              ctx.strokeStyle = "white";
              ctx.lineWidth = 0.5;
              ctx.stroke();

              ctx.fillStyle = "white";
              ctx.font = "bold 8px Inter, sans-serif";
              ctx.textAlign = "left";
              ctx.shadowColor = "rgba(0,0,0,0.8)";
              ctx.shadowBlur = 2;
              ctx.fillText(m.label, mx + 4, my + 1);
              ctx.shadowBlur = 0; 
          }
      });

      // --- DRAW GPS ROUTE ---
      const route = playerState.getActiveRoute();
      if (route && route.length > 0) {
          // Diagnostic log every second
          if (animationId % 60 === 0) console.log(`[MapRender] Path visibility check: ${route.length} points.`);
          
          ctx.beginPath();
          ctx.strokeStyle = "#ff0000"; // Solid Bright Red
          ctx.lineWidth = 3; 
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          
          let first = true;
          route.forEach((p: any) => {
              if (String(p.level) === String(viewLevel)) {
                  const dx = (Number(p.x) * 4) + 2; 
                  const dy = (Number(p.y) * 4) + 2;

                  if (first) {
                      ctx.moveTo(dx, dy);
                      first = false;
                  } else {
                      ctx.lineTo(dx, dy);
                  }
              } else {
                  first = true;
              }
          });
          ctx.stroke();
      }

      // --- DRAW CLICK TARGET (CROSSHAIR FOR DEBUG) ---
      if (menu) {
          const cx = menu.gridX * 4 + 2;
          const cy = menu.gridY * 4 + 2;
          ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
          ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
          ctx.stroke();
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [viewLevel, playerState, mapData]);

  const btnStyle = {
    padding: `${s(4)}px ${s(8)}px`,
    background: "#333",
    border: "1px solid #555",
    color: "#ddd",
    borderRadius: "4px",
    cursor: "pointer",
    display: "flex",
    gap: "4px",
    alignItems: "center",
  };
  
  return (
      <div ref={windowRef} style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
        <div
          style={{
            display: "flex",
            gap: "8px",
            padding: "8px",
            background: "var(--bg-glass-heavy)",
            borderBottom: "1px solid var(--border-subtle)",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: "2px" }}>
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.5, 4))}
              style={btnStyle}
              title="Zoom In"
            >
              <Plus size={14 * scale} />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.5, 0.5))}
              style={btnStyle}
              title="Zoom Out"
            >
              <Minus size={14 * scale} />
            </button>
          </div>
          <div
            style={{
              width: "1px",
              height: "20px",
              background: "#444",
              margin: "0 4px",
            }}
          />
          <div style={{ display: "flex", gap: "2px" }}>
            <button onClick={handleLevelUp} style={btnStyle} title="Floor Up">
              <ChevronUp size={14 * scale} />
            </button>
            <button
              onClick={handleLevelDown}
              style={btnStyle}
              title="Floor Down"
            >
              <ChevronDown size={14 * scale} />
            </button>
          </div>
          <div style={{ flex: 1 }} />
        </div>
        <div
          ref={containerRef}
          className="custom-scrollbar"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={handleContextMenu}
          onClick={() => setMenu(null)}
          style={{
            flex: 1,
            overflow: "hidden", 
            backgroundColor: "#000",
            position: "relative",
            cursor: isDragging ? "grabbing" : "grab",
            userSelect: "none"
          }}
        >
          <div style={{
              width: mapData ? mapData.levels[viewLevel]?.map[0].length * 4 * zoom : 0,
              height: mapData ? mapData.levels[viewLevel]?.map.length * 4 * zoom : 0,
              position: "relative",
              pointerEvents: "none"
          }}>
            <canvas 
              ref={canvasRef} 
              style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: mapData ? mapData.levels[viewLevel]?.map[0].length * 4 : 0,
                  height: mapData ? mapData.levels[viewLevel]?.map.length * 4 : 0,
                  transform: `scale(${zoom})`,
                  transformOrigin: "0 0",
                  imageRendering: "pixelated",
                  display: "block",
                  pointerEvents: "none"
              }}
            />
          </div>
        </div>
        
        {/* --- CONTEXT MENU UI --- */}
        {menu && (
            <div 
                style={{
                    position: "absolute",
                    top: menu!.y,
                    left: menu!.x,
                    background: "rgba(30,30,30,0.95)",
                    border: "1px solid #555",
                    borderRadius: "6px",
                    padding: "4px",
                    zIndex: 10000,
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)",
                    minWidth: "150px"
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div 
                    onClick={handleAddMarker}
                    style={{ padding: "8px 12px", cursor: "pointer", color: "#ddd", display: "flex", alignItems: "center", gap: "8px" }}
                    className="map-menu-item"
                >
                    <Plus size={14} /> Add Marker
                </div>
                {selectedMarkerId && (
                    <>
                        <div 
                            onClick={handleRenameMarker}
                            style={{ padding: "8px 12px", cursor: "pointer", color: "#fbbf24", display: "flex", alignItems: "center", gap: "8px", borderTop: "1px solid #444" }}
                        >
                            <MapPin size={14} /> Rename Marker
                        </div>
                        <div 
                            onClick={() => handleRemoveMarker(selectedMarkerId as string)}
                            style={{ padding: "8px 12px", cursor: "pointer", color: "#f87171", display: "flex", alignItems: "center", gap: "8px", borderTop: "1px solid #444" }}
                        >
                            <Trash2 size={14} /> Remove Marker
                        </div>
                    </>
                )}
            </div>
        )}

      </div>
  );
};
