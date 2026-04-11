import React, { useRef, useEffect, useState } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { usePlayerState } from "../../hooks/usePlayerState";
import { useUI } from "../../context/UIContext";
import { TERRAIN_COLORS } from "../../constants/TerrainColors";
import {
  ChevronUp,
  ChevronDown,
  Map as MapIcon,
  Crosshair,
  Plus,
  Minus,
} from "lucide-react";

const BASE_TILE_SIZE = 4;
const VIEW_RANGE = 20;

export const SidebarMinimap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerState = PlayerState.getInstance();
  const { toggleWindow } = useUI();

  const [mapData, setMapData] = useState<any>(null);
  const [viewLevel, setViewLevel] = useState<string>("0");
  const [zoom, setZoom] = useState<number>(1);

  // Auto-follow: Escuta mudança de nível do jogador
  const playerLevel = usePlayerState(
    "minimapUpdated",
    () => playerState.getCurrentLevel(),
    "0"
  );

  useEffect(() => {
    setViewLevel(playerLevel);
  }, [playerLevel]);

  useEffect(() => {
    const mapUrl = `${window.location.origin}/newmap.json`;
    fetch(mapUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load map");
        return res.json();
      })
      .then((data) => setMapData(data))
      .catch(err => console.error("Minimap load error:", err));
  }, []);

  const colorCache = useRef<Record<string, string>>({});
  
  const getTileColor = (symbol: string, mapData: any): string => {
    if (colorCache.current[symbol]) return colorCache.current[symbol];

    const definitions = { ...mapData.tiles, ...mapData.entities };
    const tileDef = definitions[symbol];

    if (!tileDef || symbol === "...") return "transparent";

    // 1. Try TerrainColors by ID or Pattern
    if (TERRAIN_COLORS[tileDef.id]) {
        const c = TERRAIN_COLORS[tileDef.id];
        colorCache.current[symbol] = c;
        return c;
    }

    // Pattern matching for transitions (e.g., grs_wat_n -> grass)
    if (tileDef.id && tileDef.id.startsWith("grs_")) return TERRAIN_COLORS.grass;
    if (tileDef.id && tileDef.id.startsWith("snd_")) return TERRAIN_COLORS.sand;
    if (tileDef.id && tileDef.id.startsWith("snw_")) return TERRAIN_COLORS.snow;

    // 2. Try explicit color in tile mapping
    if (tileDef.color) {
      colorCache.current[symbol] = tileDef.color;
      return tileDef.color;
    }

    // 3. Try fallback to category
    if (tileDef.category && TERRAIN_COLORS[tileDef.category]) {
        const c = TERRAIN_COLORS[tileDef.category];
        colorCache.current[symbol] = c;
        return c;
    }

    // 4. Try recursively looking under
    if (tileDef.under) {
      const c = getTileColor(tileDef.under, mapData);
      colorCache.current[symbol] = c;
      return c;
    }

    return TERRAIN_COLORS.default || "#222";
  };

  const handleLevelUp = () =>
    mapData?.levels[(parseInt(viewLevel) + 1).toString()] &&
    setViewLevel((parseInt(viewLevel) + 1).toString());
  const handleLevelDown = () =>
    mapData?.levels[(parseInt(viewLevel) - 1).toString()] &&
    setViewLevel((parseInt(viewLevel) - 1).toString());
  const handleCenterPlayer = () => setViewLevel(playerLevel);
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.5, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.5, 0.5));

  useEffect(() => {
    if (!mapData) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const pPos = playerState.getPosition(); // { x, y, level }
      const levelData = mapData.levels[viewLevel];
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      if (!levelData) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const mapGrid = levelData.map;
      const explored = playerState.getExploredArea(viewLevel);
      const tileSizeGame = mapData.tileSize || 32;
      const currentTileSize = BASE_TILE_SIZE * zoom;

      const pGridX = pPos.x / tileSizeGame;
      const pGridY = pPos.y / tileSizeGame;
      const centerX = width / 2;
      const centerY = height / 2;

      const visibleRange = VIEW_RANGE / zoom;
      const startY = Math.floor(pGridY - visibleRange);
      const endY = Math.ceil(pGridY + visibleRange);
      const startX = Math.floor(pGridX - visibleRange);
      const endX = Math.ceil(pGridX + visibleRange);

      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          if (y < 0 || y >= mapGrid.length || x < 0 || x >= mapGrid[0].length)
            continue;
          
          // KEEP FOG OF WAR: Skip rendering if not explored
          if (explored && !explored[y][x]) continue;

          const symbol = mapGrid[y][x];
          if (symbol === "...") continue;

          const color = getTileColor(symbol, mapData);

          const drawX = centerX + (x - pGridX) * currentTileSize;
          const drawY = centerY + (y - pGridY) * currentTileSize;

          ctx.fillStyle = color;
          ctx.fillRect(
            drawX,
            drawY,
            currentTileSize + 0.6,
            currentTileSize + 0.6
          );
        }
      }

      // Cruz do Jogador (Só se o andar bater)
      if (pPos.level === viewLevel) {
        ctx.fillStyle = "#FFFFFF";
        const crossSize = 2 * zoom;
        const length = 8 * zoom;
        ctx.fillRect(
          centerX - crossSize / 2,
          centerY - length / 2,
          crossSize,
          length
        );
        ctx.fillRect(
          centerX - length / 2,
          centerY - crossSize / 2,
          length,
          crossSize
        );
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [mapData, viewLevel, zoom]);

  const btnClass =
    "w-5 h-5 bg-[#222] border border-[#444] text-gray-300 flex items-center justify-center hover:bg-[#444] cursor-pointer rounded shadow-md active:bg-[#111]";

  if (!mapData)
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-xs text-center px-4">
        Loading Map...
      </div>
    );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#000",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        width={200}
        height={200}
        style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
      />

      <div className="absolute top-1 right-1 flex flex-col gap-1 z-10">
        <button onClick={handleLevelUp} className={btnClass} title="Floor Up">
          <ChevronUp size={14} />
        </button>
        <button
          onClick={handleCenterPlayer}
          className={btnClass}
          title="Center Player"
        >
          <Crosshair size={12} />
        </button>
        <button
          onClick={handleLevelDown}
          className={btnClass}
          title="Floor Down"
        >
          <ChevronDown size={14} />
        </button>
        <div className="h-1" />
        <button onClick={handleZoomIn} className={btnClass} title="Zoom In">
          <Plus size={12} />
        </button>
        <button onClick={handleZoomOut} className={btnClass} title="Zoom Out">
          <Minus size={12} />
        </button>
        <div className="h-1" />
        <button
          onClick={() => toggleWindow("expandedMap")}
          className={btnClass}
          title="Open Large Map"
        >
          <MapIcon size={12} />
        </button>
      </div>

      <div className="absolute bottom-1 right-1 text-[9px] text-gray-500 bg-black/50 px-1 rounded pointer-events-none">
        Z: {viewLevel} | {zoom}x
      </div>
    </div>
  );
};
