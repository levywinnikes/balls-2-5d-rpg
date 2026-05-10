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
import {
  MAP_UI_BUFFER_TILE_SIZE,
  bmsGridXToVisualGridX,
  clampToMapBounds,
  worldToGridPoint,
} from "../utils/MapCoordinateUtils";
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
      // PLAYER-CENTERED MODEL with X mirror (see MapCoordinateUtils):
      // - Player marker fixed at canvas center.
      // - World buffer drawn shifted so the player's VISUAL grid X lands at
      //   centerX (BMS X is mirrored to match what the player sees in 3D).
      // - 1 grid tile = MAP_UI_BUFFER_TILE_SIZE * zoom pixels in the canvas.
      const tilePx = MAP_UI_BUFFER_TILE_SIZE * zoom;
      const mapW = mapData.width;

      const pGrid = worldToGridPoint(pPos.x, pPos.y, tileSizeGame);
      const pVisualX = bmsGridXToVisualGridX(pGrid.x, mapW);
      const pGridY = pGrid.y;
      const centerX = width / 2;
      const centerY = height / 2;

      if (buffer) {
        // Compute the buffer placement so that the player's VISUAL X
        // lands at centerX. After translate+scale(-1,1), drawing the
        // buffer at x=0 places its right edge at "0" (mirrored).
        const dX = centerX - pVisualX * tilePx;
        const dY = centerY - pGridY * tilePx;
        const dW = buffer.width * tilePx;
        const dH = buffer.height * tilePx;

        ctx.imageSmoothingEnabled = false;
        // Mirror the buffer in X so what's drawn matches what the
        // 3D camera shows (Babylon LH renders +X world to screen-left).
        ctx.save();
        ctx.translate(dX + dW, dY);
        ctx.scale(-1, 1);
        ctx.drawImage(buffer, 0, 0, dW, dH);
        ctx.restore();

        if (explored) {
          // Iterate fog using BMS coords; transform to visual canvas X.
          const startX = Math.max(0, Math.floor(pGrid.x - VIEW_RANGE / zoom));
          const endX = Math.min(
            mapW,
            Math.ceil(pGrid.x + VIEW_RANGE / zoom),
          );
          const startY = Math.max(0, Math.floor(pGridY - VIEW_RANGE / zoom));
          const endY = Math.min(
            mapData.height,
            Math.ceil(pGridY + VIEW_RANGE / zoom),
          );

          ctx.fillStyle = "#000000";
          for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
              if (!explored[y] || !explored[y][x]) {
                // Mirror this tile's X to visual coords.
                const visualX = bmsGridXToVisualGridX(x + 1, mapW); // +1 because tile occupies [x, x+1)
                const drawX = centerX + (visualX - pVisualX) * tilePx;
                const drawY = dY + y * tilePx;
                ctx.fillRect(drawX, drawY, tilePx + 0.5, tilePx + 0.5);
              }
            }
          }
        }

        // Player marker — fixed at canvas center.
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
            const markerGrid = worldToGridPoint(m.x, m.y, tileSizeGame);
            const visualMX = bmsGridXToVisualGridX(markerGrid.x, mapW);
            const mx = centerX + (visualMX - pVisualX) * tilePx;
            const my = dY + markerGrid.y * tilePx;

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

          // Player-centered model with X mirror: invert canvas → BMS.
          // canvasX = centerX + (visualGridX - playerVisualX) * tilePx
          // → visualGridX = playerVisualX + (canvasX - centerX) / tilePx
          // → bmsGridX   = mapWidth - visualGridX
          const tileSizeGame = mapData.tileSize || 32;
          const tilePx = MAP_UI_BUFFER_TILE_SIZE * zoom;
          const pPos = playerState.getPosition();
          const pGrid = worldToGridPoint(pPos.x, pPos.y, tileSizeGame);
          const mapW = mapData.width || 1;
          const playerVisualX = bmsGridXToVisualGridX(pGrid.x, mapW);
          const centerX = 200 / 2;
          const centerY = 200 / 2;

          const visualGridX = playerVisualX + (mouseX - centerX) / tilePx;
          const targetGridX = clampToMapBounds(
            Math.floor(bmsGridXToVisualGridX(visualGridX, mapW)),
            mapW,
          );
          const targetGridY = clampToMapBounds(
            Math.floor(pGrid.y + (mouseY - centerY) / tilePx),
            mapData.height || 1,
          );

          const targetWorldX = targetGridX * tileSizeGame;
          const targetWorldY = targetGridY * tileSizeGame;

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
