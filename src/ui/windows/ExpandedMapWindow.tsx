import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { usePlayerState } from "../../hooks/usePlayerState";
import { useUI } from "../../context/UIContext";
import { ChevronUp, ChevronDown, Plus, Minus, Crosshair } from "lucide-react";
import { WorldMapService } from "../../services/WorldMapService";

export const ExpandedMapContent: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
    setDragStart({
      x: e.pageX - containerRef.current.offsetLeft,
      y: e.pageY - containerRef.current.offsetTop,
      sL: containerRef.current.scrollLeft,
      sT: containerRef.current.scrollTop
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
        const walkX = (x - dragStart.x) * 1.5;
        const walkY = (y - dragStart.y) * 1.5;
        containerRef.current.scrollLeft = dragStart.sL - walkX;
        containerRef.current.scrollTop = dragStart.sT - walkY;
    };

    const handleMouseUp = () => setIsDragging(false);

    // --- MOUSE WHEEL ZOOM ---
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const container = containerRef.current;
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Calculate the map coordinate (world position) currently under the mouse
            const contentX = (container.scrollLeft + mouseX) / zoom;
            const contentY = (container.scrollTop + mouseY) / zoom;

            const zoomDelta = e.deltaY < 0 ? 0.4 : -0.4;
            const nextZoom = Math.min(Math.max(zoom + zoomDelta, 0.5), 4);

        if (nextZoom !== zoom) {
            // CAPTURE ANCHOR: Store world-coord under mouse and mouse position
            zoomAnchorRef.current = { contentX, contentY, mouseX, mouseY };
            
            // Trigger zoom change
            setZoom(nextZoom);
            
            // We NO LONGER set scrollLeft/Top here. 
            // The useLayoutEffect will handle it synchronously after the DOM updates.
        }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [zoom]); // Re-bind when zoom changes to capture stable closure value

  // --- ATOMIC ZOOM SYNC ---
  useLayoutEffect(() => {
    if (!zoomAnchorRef.current || !containerRef.current) return;
    
    const { contentX, contentY, mouseX, mouseY } = zoomAnchorRef.current;
    
    // Apply new scroll position synchronously before the browser paints
    containerRef.current.scrollLeft = (contentX * zoom) - mouseX;
    containerRef.current.scrollTop = (contentY * zoom) - mouseY;
    
    // Clear the anchor
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
        // Internal canvas size should match the 1:1 map data (plus our internal 4x upscale)
        if (canvas.width !== currentBuffer.width) canvas.width = currentBuffer.width;
        if (canvas.height !== currentBuffer.height) canvas.height = currentBuffer.height;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw Previous Level (Fading Out)
        if (prevBuffer && alpha < 1) {
            ctx.globalAlpha = 1 - alpha;
            ctx.drawImage(prevBuffer, 0, 0);
        }

        // Draw Current Level (Fading In)
        ctx.globalAlpha = alpha;
        ctx.drawImage(currentBuffer, 0, 0);
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
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
          <button
            onClick={handleCenter}
            style={{ ...btnStyle, color: "#fbbf24" }}
            title="Find Me"
          >
            <Crosshair size={14 * scale} /> Center Player
          </button>
        </div>
        <div
          ref={containerRef}
          className="custom-scrollbar"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            flex: 1,
            overflow: "hidden", // Hide actual scrollbars as we pan manually
            backgroundColor: "#000",
            position: "relative",
            cursor: isDragging ? "grabbing" : "grab",
            userSelect: "none"
          }}
        >
          {/* 
              SPACER: This div dictates the scrollable area. 
              Its size is truly [original_size * zoom].
          */}
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
                  // Internal rendering size is stable (no re-allocations)
                  width: mapData ? mapData.levels[viewLevel]?.map[0].length * 4 : 0,
                  height: mapData ? mapData.levels[viewLevel]?.map.length * 4 : 0,
                  // GPU Scaling handles the zoom perfectly smooth
                  transform: `scale(${zoom})`,
                  transformOrigin: "0 0",
                  imageRendering: "pixelated",
                  display: "block",
                  pointerEvents: "none"
              }}
            />
          </div>
        </div>
      </div>
  );
};
