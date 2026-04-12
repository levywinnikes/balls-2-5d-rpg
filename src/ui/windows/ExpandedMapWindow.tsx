import React, { useRef, useEffect, useState, useCallback } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { usePlayerState } from "../../hooks/usePlayerState";
import { useUI } from "../../context/UIContext";
import { ChevronUp, ChevronDown, Plus, Minus, Crosshair } from "lucide-react";
import { TERRAIN_COLORS } from "../../constants/TerrainColors";

export const ExpandedMapContent: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapData, setMapData] = useState<any>(null);
  const playerState = PlayerState.getInstance();
  const { s, scale } = useUI();

  // Estados de Controle
  const [viewLevel, setViewLevel] = useState<string>("0");
  const [zoom, setZoom] = useState<number>(1);

  // --- NOVO: AUTO-FOLLOW DE ANDAR ---
  // Escuta a mudança de nível do jogador em tempo real
  const currentPlayerLevel = usePlayerState(
    "minimapUpdated",
    () => playerState.getCurrentLevel(),
    "0"
  );

  // Quando o jogador muda de andar (sobe/desce escada), o mapa muda junto
  useEffect(() => {
    setViewLevel(currentPlayerLevel);
  }, [currentPlayerLevel]);
  // ----------------------------------

  // Carrega mapa
  useEffect(() => {
    fetch("newmap.json?v=" + Date.now())
      .then((res) => res.json())
      .then((data) => {
        setMapData(data);
        setViewLevel(playerState.getCurrentLevel());
      });
  }, [playerState]);

  const colorCache = useRef<Record<string, string>>({});
  const getTileColor = useCallback((tileId: string, defs: any): string => {
    if (colorCache.current[tileId]) return colorCache.current[tileId];
    const def = defs[tileId];
    if (!def) return "#000";

    // 1. Check if color is explicitly in the JSON
    if (def.color) {
      colorCache.current[tileId] = def.color;
      return def.color;
    }

    // 2. Check if the tile ID has a defined color in our centralized registry
    if (TERRAIN_COLORS[def.id]) {
      colorCache.current[tileId] = TERRAIN_COLORS[def.id];
      return TERRAIN_COLORS[def.id];
    }

    // 3. Fallback to 'under' tile color recursively
    if (def.under) {
      const c = getTileColor(def.under, defs);
      colorCache.current[tileId] = c;
      return c;
    }

    return TERRAIN_COLORS.default;
  }, []);

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
    const PIXEL_SCALE = 4 * zoom; // This matches the visual scale we apply via CSS
    const drawX = (pPos.x / tileSize) * PIXEL_SCALE;
    const drawY = (pPos.y / tileSize) * PIXEL_SCALE;
    
    const container = containerRef.current;
    container.scrollTo({
      left: drawX - container.clientWidth / 2,
      top: drawY - container.clientHeight / 2,
      behavior: "smooth"
    });
  }, [mapData, viewLevel, zoom, playerState]);

  // --- BUFFERED RENDERING ---
  const bufferRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Render static map background to buffer (ONLY ON LEVEL CHANGE)
  useEffect(() => {
    if (!mapData || !mapData.levels[viewLevel]) return;

    const levelData = mapData.levels[viewLevel];
    const mapGrid = levelData.map;
    const rows = mapGrid.length;
    const cols = mapGrid[0].length;
    const definitions = { ...mapData.tiles, ...mapData.entities };

    // Buffer is ALWAYS 1px per tile for maximum efficiency
    if (!bufferRef.current) {
      bufferRef.current = document.createElement("canvas");
    }
    const buffer = bufferRef.current;
    buffer.width = cols;
    buffer.height = rows;

    const bCtx = buffer.getContext("2d");
    if (!bCtx) return;

    bCtx.fillStyle = "#111";
    bCtx.fillRect(0, 0, buffer.width, buffer.height);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const tile = mapGrid[y][x];
        if (tile === "...") continue;
        const color = getTileColor(tile, definitions);
        bCtx.fillStyle = color;
        bCtx.fillRect(x, y, 1, 1);
      }
    }
  }, [mapData, viewLevel, getTileColor]); // REMOVED ZOOM DEP

  // 2. Render Loop (Draws buffer + dynamic player at 1:1 scale)
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      // Set canvas size to match 1:1 map data
      if (bufferRef.current) {
        if (canvas.width !== bufferRef.current.width) canvas.width = bufferRef.current.width;
        if (canvas.height !== bufferRef.current.height) canvas.height = bufferRef.current.height;

        // Draw cached background (FAST 512x512 draw)
        ctx.drawImage(bufferRef.current, 0, 0);
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const pPos = playerState.getPosition();

      // Draw Player if on this level (Draw at 1px scale, CSS will zoom it)
      if (pPos.level === viewLevel) {
        const tileSize = mapData?.tileSize || 32;
        const drawX = Math.floor(pPos.x / tileSize);
        const drawY = Math.floor(pPos.y / tileSize);

        // Bright dot for the player
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
  }, [viewLevel, playerState, mapData?.tileSize]); // REMOVED ZOOM DEP

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
