/**
 * REGRAS DE OURO (GOLDEN RULES):
 * 1. O jogo deve suportar tanto BROWSER quanto EXECUTÁVEL (Desktop).
 * 2. O EXECUTÁVEL é a prioridade; evite o uso de window.prompt, window.alert ou qualquer API síncrona de bloqueio que possa falhar em wrappers desktop.
 */
import React, { useRef, useEffect, useState } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { usePlayerState } from "../../hooks/usePlayerState";
import { useUI } from "../../context/UIContext";
import {
  ChevronUp,
  ChevronDown,
  Map as MapIcon,
  Crosshair,
  Plus,
  Minus,
} from "lucide-react";

import { WorldMapService } from "../../services/WorldMapService";

const BASE_TILE_SIZE = 4;
const VIEW_RANGE = 25;

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
    "0",
  );

  useEffect(() => {
    setViewLevel(playerLevel);
  }, [playerLevel]);

  useEffect(() => {
    // 1. Initial Load from Cache
    const cachedData = WorldMapService.getMapData();
    if (cachedData) setMapData(cachedData);

    // 2. Listen for Updates
    const onData = (data: any) => setMapData(data);
    const onBuffers = () => {
      // Force a re-render and ensure mapData is fresh
      const freshData = WorldMapService.getMapData();
      if (freshData) setMapData({ ...freshData });
    };

    WorldMapService.emitter.on("mapDataUpdated", onData);
    WorldMapService.emitter.on("buffersReady", onBuffers);

    return () => {
      WorldMapService.emitter.off("mapDataUpdated", onData);
      WorldMapService.emitter.off("buffersReady", onBuffers);
    };
  }, []);

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

      const buffer = WorldMapService.getBuffer(viewLevel);
      const explored = playerState.getExploredArea(viewLevel);
      const tileSizeGame = mapData.tileSize || 32;
      const currentTileSize = BASE_TILE_SIZE * zoom;

      const pGridX = pPos.x / tileSizeGame;
      const pGridY = pPos.y / tileSizeGame;
      const centerX = width / 2;
      const centerY = height / 2;
      if (buffer) {
        const visibleRange = VIEW_RANGE / zoom;
        // Player-centered minimap (radar): player fixed at center, world moves around.
        const sX = pGridX - visibleRange;
        const sY = pGridY - visibleRange;
        const sW = visibleRange * 2;
        const sH = visibleRange * 2;

        const currentTileSize = BASE_TILE_SIZE * zoom;
        const dW = sW * currentTileSize;
        const dH = sH * currentTileSize;
        const dX = centerX - dW / 2;
        const dY = centerY - dH / 2;

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buffer, sX, sY, sW, sH, dX, dY, dW, dH);

        if (explored) {
          const startX = Math.floor(sX);
          const endX = Math.ceil(sX + sW);
          const startY = Math.floor(sY);
          const endY = Math.ceil(sY + sH);

          ctx.fillStyle = "#000000";
          for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
              if (y < 0 || y >= mapData.height || x < 0 || x >= mapData.width)
                continue;
              if (!explored[y] || !explored[y][x]) {
                const drawX = centerX + (x - pGridX) * currentTileSize;
                const drawY = centerY + (y - pGridY) * currentTileSize;
                ctx.fillRect(
                  drawX,
                  drawY,
                  currentTileSize + 0.5,
                  currentTileSize + 0.5,
                );
              }
            }
          }
        }

        if (pPos.level === viewLevel) {
          ctx.fillStyle = "#FFFFFF";
          const crossSize = 2 * zoom;
          const length = 8 * zoom;
          ctx.fillRect(
            centerX - crossSize / 2,
            centerY - length / 2,
            crossSize,
            length,
          );
          ctx.fillRect(
            centerX - length / 2,
            centerY - crossSize / 2,
            length,
            crossSize,
          );
        }

        const markers = playerState.getMarkers();
        markers.forEach((m) => {
          if (String(m.level) === String(viewLevel)) {
            const mx =
              centerX + ((m.x - pPos.x) / tileSizeGame) * currentTileSize;
            const my =
              centerY + ((m.y - pPos.y) / tileSizeGame) * currentTileSize;

            const dotSize = 4 * zoom;
            ctx.fillStyle = m.color || "#ff0000";
            ctx.fillRect(mx - dotSize / 2, my - dotSize / 2, dotSize, dotSize);

            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 0.5 * zoom;
            ctx.strokeRect(mx - dotSize / 2, my - dotSize / 2, dotSize, dotSize);
          }
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [mapData, viewLevel, zoom, playerState]);

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
        onContextMenu={(e) => {
          e.preventDefault();
          if (!mapData) return;
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;

          // Mouse Position in Canvas Coords (0-200)
          const scaleX = 200 / rect.width;
          const scaleY = 200 / rect.height;
          const mouseX = (e.clientX - rect.left) * scaleX;
          const mouseY = (e.clientY - rect.top) * scaleY;

          // Game Data
          const tileSizeGame = mapData.tileSize || 32;
          const pPos = playerState.getPosition();
          const pGridX = pPos.x / tileSizeGame;
          const pGridY = pPos.y / tileSizeGame;
          const currentTileSize = BASE_TILE_SIZE * zoom;

          const gridOffsetX = (mouseX - 100) / currentTileSize;
          const gridOffsetY = (mouseY - 100) / currentTileSize;

          const targetGridX = pGridX + gridOffsetX;
          const targetGridY = pGridY + gridOffsetY;

          const clampedGridX = Math.max(0, Math.min((mapData.width || 1) - 1, targetGridX));
          const clampedGridY = Math.max(0, Math.min((mapData.height || 1) - 1, targetGridY));

          const targetWorldX = clampedGridX * tileSizeGame;
          const targetWorldY = clampedGridY * tileSizeGame;

          // EXEC COMPATIBILITY: Avoid window.prompt for executable support.
          // Using a default name for now; the user can rename it in the Expanded Map.
          const label = `Mark ${playerState.getMarkers().length + 1}`;

          playerState.addMarker({
            id: `mm_${Date.now()}`,
            x: targetWorldX,
            y: targetWorldY,
            level: viewLevel,
            label: label,
            color: "#ff0000",
          });
        }}
        style={{
          width: "100%",
          height: "100%",
          imageRendering: "pixelated",
          cursor: "crosshair",
        }}
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
