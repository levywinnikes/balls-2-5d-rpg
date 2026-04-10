import React, { useRef, useEffect, useState, useCallback } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { usePlayerState } from "../../hooks/usePlayerState";
import { useUI } from "../../context/UIContext";
import { ChevronUp, ChevronDown, Plus, Minus, Crosshair } from "lucide-react";

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
    fetch("newmap.json")
      .then((res) => res.json())
      .then((data) => {
        setMapData(data);
        setViewLevel(playerState.getCurrentLevel());
      });
  }, []);

  const colorCache = useRef<Record<string, string>>({});
  const getTileColor = useCallback((tileId: string, defs: any): string => {
    if (colorCache.current[tileId]) return colorCache.current[tileId];
    const def = defs[tileId];
    if (!def) return "#000";
    if (def.color) {
      colorCache.current[tileId] = def.color;
      return def.color;
    }
    if (def.under) {
      const c = getTileColor(def.under, defs);
      colorCache.current[tileId] = c;
      return c;
    }
    return "#222";
  }, []);

  const handleLevelUp = () =>
    mapData?.levels[(parseInt(viewLevel) + 1).toString()] &&
    setViewLevel((parseInt(viewLevel) + 1).toString());
  const handleLevelDown = () =>
    mapData?.levels[(parseInt(viewLevel) - 1).toString()] &&
    setViewLevel((parseInt(viewLevel) - 1).toString());
  const handleCenter = () => {
    setViewLevel(playerState.getCurrentLevel());
  };

  useEffect(() => {
    if (!mapData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const BASE_PIXEL_SIZE = 4;
    const definitions = { ...mapData.tiles, ...mapData.entities };
    let animationId: number;

    const render = () => {
      const levelData = mapData.levels[viewLevel];
      // const explored = playerState.getExploredArea(viewLevel); // Removed unused
      const PIXEL_SIZE = BASE_PIXEL_SIZE * zoom;

      if (!levelData) {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const mapGrid = levelData.map;
      const rows = mapGrid.length;
      const cols = mapGrid[0].length;

      if (
        canvas.width !== cols * PIXEL_SIZE ||
        canvas.height !== rows * PIXEL_SIZE
      ) {
        canvas.width = cols * PIXEL_SIZE;
        canvas.height = rows * PIXEL_SIZE;
      }

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          // if (explored && !explored[y][x]) continue; // Disable Fog of War (Global Reveal)
          const color = getTileColor(mapGrid[y][x], definitions);
          ctx.fillStyle = color;
          ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
        }
      }

      const pPos = playerState.getPosition();

      // Desenha Player se estivermos no mesmo nível
      if (pPos.level === viewLevel) {
        const tileSize = mapData.tileSize || 32;
        const pGridX = pPos.x / tileSize;
        const pGridY = pPos.y / tileSize;

        const drawX = pGridX * PIXEL_SIZE;
        const drawY = pGridY * PIXEL_SIZE;

        ctx.fillStyle = "#FFF";
        ctx.fillRect(drawX - 2 * zoom, drawY - 4 * zoom, 4 * zoom, 12 * zoom);
        ctx.fillRect(drawX - 6 * zoom, drawY - 2 * zoom, 12 * zoom, 4 * zoom);
        ctx.fillStyle = "#F00";
        ctx.fillRect(drawX - zoom, drawY - zoom, 2 * zoom, 2 * zoom);
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [mapData, viewLevel, zoom, playerState, getTileColor]);

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
          <canvas ref={canvasRef} />
        </div>
      </div>
  );
};
