import React, { useRef, useEffect, useState, useCallback } from "react";
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

  const handleLevelUp = () =>
    mapData?.levels[(parseInt(viewLevel) + 1).toString()] &&
    setViewLevel((parseInt(viewLevel) + 1).toString());
  const handleLevelDown = () =>
    mapData?.levels[(parseInt(viewLevel) - 1).toString()] &&
    setViewLevel((parseInt(viewLevel) - 1).toString());

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

  // Render Loop (Consumes cached buffer + dynamic player)
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      const buffer = WorldMapService.getBuffer(viewLevel);
      
      if (buffer) {
        if (canvas.width !== buffer.width) canvas.width = buffer.width;
        if (canvas.height !== buffer.height) canvas.height = buffer.height;
        ctx.drawImage(buffer, 0, 0);
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
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

    render();
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
          style={{
            flex: 1,
            overflow: "auto",
            backgroundColor: "#000",
            position: "relative",
            cursor: "grab",
          }}
        >
          <canvas 
            ref={canvasRef} 
            style={{
                width: mapData ? mapData.levels[viewLevel]?.map[0].length * 4 * zoom : 0,
                height: mapData ? mapData.levels[viewLevel]?.map.length * 4 * zoom : 0,
                imageRendering: "pixelated",
                display: "block"
            }}
          />
        </div>
      </div>
  );
};
