import React, { useRef, useEffect, useState } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { usePlayerState } from "../../hooks/usePlayerState";
import { TERRAIN_COLORS } from "../../constants/TerrainColors";

// Configurações visuais
const TILE_SIZE_MINIMAP = 4; // Tamanho do pixel no radar
const VIEW_RANGE = 20; // Quantos tiles para cada lado desenhar

export const SidebarMinimap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerState = PlayerState.getInstance();

  // Estado para armazenar o JSON carregado
  const [mapData, setMapData] = useState<any>(null);

  // Hook para forçar re-render quando o mapa atualizar (Fog of War / Mudança de Andar)
  // O valor retornado não importa, só o gatilho do evento.
  usePlayerState("minimapUpdated", () => playerState.getCurrentLevel(), "0");

  // 1. Carregar o JSON da pasta PUBLIC ao iniciar
  useEffect(() => {
    // IMPORTANTE: O nome do arquivo aqui deve ser EXATAMENTE como está na pasta public
    const mapUrl = `${window.location.origin}/newmap.json?v=${Date.now()}`;
    fetch(mapUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao carregar mapa");
        return res.json();
      })
      .then((data) => setMapData(data))
      .catch((err) => console.error("Erro no Minimapa:", err));
  }, []);

  // Cache de cores para não recalcular a cada frame
  const colorCache = useRef<Record<string, string>>({});

  // Função para descobrir a cor do tile (Recursiva para 'under')
  const getTileColor = (tileId: string, tilesDef: any): string => {
    if (colorCache.current[tileId]) return colorCache.current[tileId];

    const tileDef = tilesDef[tileId];
    if (!tileDef || tileId === "...") return "#000000";

    // 1. Check JSON for overrides
    if (tileDef.color) {
      colorCache.current[tileId] = tileDef.color;
      return tileDef.color;
    }

    // 2. Fallback to Centralized Registry
    if (TERRAIN_COLORS[tileDef.id]) {
        colorCache.current[tileId] = TERRAIN_COLORS[tileDef.id];
        return TERRAIN_COLORS[tileDef.id];
    }

    // Pattern matching for transitions (e.g., grs_wat_n -> grass)
    if (tileDef.id && tileDef.id.startsWith("grs_")) return TERRAIN_COLORS.grass;
    if (tileDef.id && tileDef.id.startsWith("snd_")) return TERRAIN_COLORS.sand;
    if (tileDef.id && tileDef.id.startsWith("snw_")) return TERRAIN_COLORS.snow;

    // 3. Fallback to 'under'
    if (tileDef.under) {
      const color = getTileColor(tileDef.under, tilesDef);
      colorCache.current[tileId] = color;
      return color;
    }

    return TERRAIN_COLORS.default;
  };

  // Loop de Desenho
  useEffect(() => {
    if (!mapData) return; // Só desenha se o JSON carregou

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      // Pega dados ATUAIS do PlayerState
      const pPos = playerState.getPosition(); // {x, y} em pixels
      const currentLevel = playerState.getCurrentLevel(); // string "0", "1"...

      // Acessa o nível correto no JSON
      const levelData = mapData.levels[currentLevel];

      // Limpa o canvas (fundo preto)
      const width = canvas.width;
      const height = canvas.height;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      // Se o jogador estiver num nível que não existe no JSON, para por aqui
      if (!levelData) return;

      const mapGrid = levelData.map;
      // Pega a matriz de exploração (Fog of War)
      const explored = playerState.getExploredArea(currentLevel);

      // Converte posição do player de Pixels para Grid (Tile X, Tile Y)
      const tileSizeGame = mapData.tileSize || 32;
      const pGridX = Math.floor(pPos.x / tileSizeGame);
      const pGridY = Math.floor(pPos.y / tileSizeGame);

      // Centro do Canvas
      const centerX = width / 2;
      const centerY = height / 2;

      // --- LOOP DE DESENHO DOS TILES ---
      // Varre apenas a área visível no minimapa (otimização)
      for (let y = pGridY - VIEW_RANGE; y <= pGridY + VIEW_RANGE; y++) {
        for (let x = pGridX - VIEW_RANGE; x <= pGridX + VIEW_RANGE; x++) {
          // Verifica limites da matriz do mapa
          if (y < 0 || y >= mapGrid.length || x < 0 || x >= mapGrid[0].length)
            continue;

          // FOG OF WAR: Se a matriz explored existir e o tile for falso/indefinido, pula
          if (explored && !explored[y][x]) continue;

          // Pega o ID do tile (ex: "grs", "wat")
          const tileId = mapGrid[y][x];

          // Busca a cor (usando tiles e entities para garantir)
          const color = getTileColor(tileId, {
            ...mapData.tiles,
            ...mapData.entities,
          });

          // Calcula onde desenhar no canvas (Relativo ao centro)
          const drawX = centerX + (x - pGridX) * TILE_SIZE_MINIMAP;
          const drawY = centerY + (y - pGridY) * TILE_SIZE_MINIMAP;

          ctx.fillStyle = color;
          // Desenha o quadrado (+0.5 evita linhas finas entre pixels em alguns monitores)
          ctx.fillRect(
            drawX,
            drawY,
            TILE_SIZE_MINIMAP + 0.5,
            TILE_SIZE_MINIMAP + 0.5
          );
        }
      }

      // --- DESENHA O JOGADOR (CRUZ BRANCA) ---
      ctx.fillStyle = "#FFFFFF";
      // Vertical da cruz
      ctx.fillRect(centerX - 1, centerY - 4, 2, 8);
      // Horizontal da cruz
      ctx.fillRect(centerX - 4, centerY - 1, 8, 2);
    };

    // Renderiza a 15 FPS (suficiente para minimapa)
    const interval = setInterval(render, 66);
    return () => clearInterval(interval);
  }, [mapData]); // Reinicia o loop se o JSON mudar

  // Exibição enquanto carrega
  if (!mapData) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#666",
          fontSize: "10px",
        }}
      >
        Carregando Mapa...
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#000",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        width={200}
        height={200}
        style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
      />
    </div>
  );
};
