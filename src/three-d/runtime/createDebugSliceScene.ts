import {
  ArcRotateCamera,
  Color3,
  DynamicTexture,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointerEventTypes,
  Scene,
  StandardMaterial,
  TransformNode,
  UniversalCamera,
  Vector3,
  VertexData,
} from "@babylonjs/core";
import {
  DroppedItemData,
  PlayerState,
} from "../../game/entities/Player/PlayerState";
import { t_game } from "../../game/i18n/translations";
import { ItemType } from "../../config/ItemConstants";
import { ItemRegistry } from "../../game/entities/items/ItemRegistry";
import { AudioManager } from "../../game/systems/AudioManager";
import { WeaponRegistry } from "../../game/entities/weapons/WeaponRegistry";
import {
  EnemyRegistry,
  EnemyDefinition,
} from "../../game/entities/EnemyRegistry";
import {
  EnemyMagicRegistry,
  registerDefaultMagics,
} from "../../game/entities/EnemyMagicRegistry";
import { PathfindingManager } from "../../game/systems/PathfindingManager";
import { WorldMapService } from "../../services/WorldMapService";
import { createEnemyVisual } from "./ThreeDEnemyVisualRegistry";

type SliceRuntime = {
  engine: Engine;
  scene: Scene;
  dispose: () => void;
};

function createMaterial(
  scene: Scene,
  name: string,
  diffuseColor: Color3,
): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = diffuseColor;
  material.specularColor = new Color3(0.08, 0.08, 0.08);
  return material;
}

function worldToSliceCoord(value: number): number {
  return value / 32;
}

type MapEntity = {
  x: number;
  y: number;
  symbol: string;
  uuid?: string;
  contents?: Array<{ id: string; count: number }>;
};

type SliceTileDefinition = {
  id?: string;
  color?: string;
  block?: boolean;
  height?: number;
  renderAs?: "floor" | "block";
};

type SliceLevelData = {
  binFile?: string;
  entities?: MapEntity[];
  playerPos?: { x: number; y: number };
};

type SliceMapData = {
  width?: number;
  height?: number;
  tileSize?: number;
  tileAtlas?: string[];
  tileDefinitions?: Record<string, SliceTileDefinition>;
  entityTemplates?: Record<string, any>;
  levels?: Record<string, SliceLevelData>;
};

type EnemySpawnData = {
  enemyType: string;
  x: number;
  y: number;
};

type SliceEnemy = {
  uid: string;
  spawnKey: string;  // deterministic key for persistence (level_type_index)
  enemyType: string;
  definition: EnemyDefinition;
  meshRoot: TransformNode;
  health: number;
  maxHealth: number;
  worldPos: Vector3;
  spawnPos: Vector3;
  lastAttackAt: number;
  lastPathAt: number;
  currentPath: Array<{ x: number; y: number }>;
  currentPathIndex: number;
  magicCooldowns: Map<string, number>;
  isDead: boolean;
  isProvoked: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function worldToGrid(value: number, gridOrigin: number): number {
  return Math.floor(value + gridOrigin);
}

function gridToWorld(tile: number, gridOrigin: number): number {
  return tile - gridOrigin + 0.5;
}

export function createDebugSliceScene(canvas: HTMLCanvasElement): SliceRuntime {
  registerDefaultMagics();

  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  });
  const scene = new Scene(engine);
  scene.clearColor.set(0.67, 0.8, 0.96, 1);
  const playerState = PlayerState.getInstance();
  playerState.setPerspectiveMode("3D");
  const audioManager = AudioManager.getInstance();
  const startingPosition = playerState.getPosition();
  const searchParams = new URLSearchParams(window.location.search);
  const sliceMapName =
    searchParams.get("map") ||
    searchParams.get("mapName") ||
    "perspective_debug";
  const LEVEL_HEIGHT_UNITS = 3.2;
  const PLAYER_GROUND_OFFSET = 0.8;
  const parseLevelNumber = (level: string) => Number.parseInt(level, 10) || 0;
  const levelToWorldY = (level: string | number) => {
    const levelNumber =
      typeof level === "number" ? level : parseLevelNumber(level);
    return levelNumber * LEVEL_HEIGHT_UNITS;
  };
  let activeLevel = playerState.getCurrentLevel();
  let activeLevelNumber = parseLevelNumber(activeLevel);

  const camera = new ArcRotateCamera(
    "slice-camera",
    -Math.PI / 4,
    1.08,
    18,
    new Vector3(0, 1.5, 0),
    scene,
  );
  camera.lowerRadiusLimit = 18;
  camera.upperRadiusLimit = 18;
  camera.lowerBetaLimit = 1.08;
  camera.upperBetaLimit = 1.08;
  camera.lowerAlphaLimit = -Math.PI / 4;
  camera.upperAlphaLimit = -Math.PI / 4;
  camera.wheelPrecision = 1000000;
  camera.panningSensibility = 0;
  camera.attachControl(canvas, true);

  const firstPersonCamera = new UniversalCamera(
    "slice-fp-camera",
    new Vector3(6, 1.55, 6),
    scene,
  );
  firstPersonCamera.minZ = 0.05;
  firstPersonCamera.inertia = 0.05;
  firstPersonCamera.angularSensibility = 800; // ~CS:GO/Valorant default feel
  firstPersonCamera.speed = 0;

  const hemiLight = new HemisphericLight(
    "slice-hemi-light",
    new Vector3(0.25, 1, -0.25),
    scene,
  );
  hemiLight.intensity = 1.0;
  hemiLight.groundColor = new Color3(0.28, 0.26, 0.24);

  const playerMaterial = createMaterial(
    scene,
    "slice-player",
    Color3.FromHexString("#f2d53c"),
  );
  const player = MeshBuilder.CreateCapsule(
    "slice-player",
    { radius: 0.42, height: 1.6, tessellation: 8 },
    scene,
  );
  player.position = new Vector3(
    startingPosition.x !== 0 ? worldToSliceCoord(startingPosition.x) : 6,
    levelToWorldY(activeLevelNumber) + PLAYER_GROUND_OFFSET,
    startingPosition.y !== 0 ? worldToSliceCoord(startingPosition.y) : 6,
  );
  player.material = playerMaterial;

  // Fallback pickup kept only for empty-state debugging while 3D begins consuming
  // the real persistent dropped-item list from PlayerState.
  const pickupMaterial = createMaterial(
    scene,
    "slice-pickup",
    Color3.FromHexString("#ffd166"),
  );
  const pickupOrb = MeshBuilder.CreateSphere(
    "slice-pickup-orb",
    { diameter: 0.6, segments: 12 },
    scene,
  );
  pickupOrb.position = new Vector3(4.5, 0.45, 4);
  pickupOrb.material = pickupMaterial;
  let fallbackPickupConsumed = false;

  const droppedItemMaterial = createMaterial(
    scene,
    "slice-dropped-item",
    Color3.FromHexString("#ffd166"),
  );
  const droppedItemMeshes = new Map<string, Mesh>();
  const enemies = new Map<string, SliceEnemy>();
  let selectedEnemyUid: string | null = null;
  let lastPlayerAttackAt = 0;
  const seededEnemyLevels = new Set<string>();
  let mapDataCache: SliceMapData | null = null;
  let worldMapReady = false;
  const recentPlayerDamagePopups = new Map<
    string,
    { at: number; value: number }
  >();

  // S7-FP4: emissive pulse on selected enemy mesh (replaces torus ring)
  // selectedEnemyMarker removed — highlight is applied directly to enemy meshes
  let enemyHighlightPulseT = 0; // accumulator for sine pulse (seconds)

  const mapRoot = new TransformNode("slice-map-root", scene);
  // Chunk streaming constants
  const CHUNK_SIZE = 16; // tiles per chunk side
  const DRAW_RADIUS_CHUNKS = 5; // chunks kept loaded around player
  const CHUNK_BUILD_BUDGET_PER_TICK = 10;   // max new chunks to build each update tick
  const CHUNK_UNLOAD_BUDGET_PER_TICK = 8;   // max chunks to unload each update tick
  const chunkMeshes = new Map<string, Mesh[]>();
  const chunkLoading = new Set<string>();
  const tileMaterials = new Map<string, StandardMaterial>();
  const levelBinaryCache = new Map<string, Uint8Array>();

  let mapMinX = 0;
  let mapMaxX = 24;
  let mapMinZ = 0;
  let mapMaxZ = 24;
  let currentMapWidth = 24;
  let currentMapHeight = 24;

  let navigationGridSize = 48;
  let navigationGridOrigin = 0;
  const pathfindingManager = PathfindingManager.getInstance();

  let navigationGrid: number[][] = Array.from(
    { length: navigationGridSize },
    () => Array(navigationGridSize).fill(0),
  );

  const hasLineOfSight = (from: Vector3, to: Vector3): boolean => {
    const x0 = worldToGrid(from.x, navigationGridOrigin);
    const y0 = worldToGrid(from.z, navigationGridOrigin);
    const x1 = worldToGrid(to.x, navigationGridOrigin);
    const y1 = worldToGrid(to.z, navigationGridOrigin);

    if (
      x0 < 0 ||
      y0 < 0 ||
      x1 < 0 ||
      y1 < 0 ||
      x0 >= navigationGridSize ||
      y0 >= navigationGridSize ||
      x1 >= navigationGridSize ||
      y1 >= navigationGridSize
    ) {
      return true;
    }

    let currentX = x0;
    let currentY = y0;
    const deltaX = Math.abs(x1 - x0);
    const deltaY = Math.abs(y1 - y0);
    const stepX = x0 < x1 ? 1 : -1;
    const stepY = y0 < y1 ? 1 : -1;
    let error = deltaX - deltaY;

    while (currentX !== x1 || currentY !== y1) {
      if (
        !(currentX === x0 && currentY === y0) &&
        navigationGrid[currentY]?.[currentX] === 1
      ) {
        return false;
      }

      const doubledError = error * 2;
      if (doubledError > -deltaY) {
        error -= deltaY;
        currentX += stepX;
      }
      if (doubledError < deltaX) {
        error += deltaX;
        currentY += stepY;
      }
    }

    return true;
  };

  const safeTileColor = (hexColor: string | undefined, fallback: string) => {
    const color = (hexColor || fallback).trim();
    try {
      return Color3.FromHexString(color);
    } catch {
      return Color3.FromHexString(fallback);
    }
  };

  const normalizeTileHexColor = (
    colorValue: string | number | undefined,
    fallback: string,
  ) => {
    if (typeof colorValue === "number" && Number.isFinite(colorValue)) {
      return `#${(colorValue >>> 0)
        .toString(16)
        .padStart(6, "0")
        .slice(-6)}`.toLowerCase();
    }

    if (typeof colorValue === "string") {
      const trimmed = colorValue.trim();
      if (!trimmed) {
        return fallback.toLowerCase();
      }

      if (trimmed.startsWith("#")) {
        return trimmed.toLowerCase();
      }

      if (/^0x[0-9a-f]{6}$/i.test(trimmed)) {
        return `#${trimmed.slice(2)}`.toLowerCase();
      }

      if (/^[0-9a-f]{6}$/i.test(trimmed)) {
        return `#${trimmed}`.toLowerCase();
      }

      return trimmed.toLowerCase();
    }

    return fallback.toLowerCase();
  };

  const color3ToCss = (color: Color3) => {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const shadeColor = (color: Color3, factor: number) => {
    const next = new Color3(
      Math.max(0, Math.min(1, color.r * factor)),
      Math.max(0, Math.min(1, color.g * factor)),
      Math.max(0, Math.min(1, color.b * factor)),
    );
    return color3ToCss(next);
  };

  const inferTileMaterialKind = (
    symbol: string | null,
    tileDef?: SliceTileDefinition,
  ) => {
    const tileId = (tileDef?.id || symbol || "").toLowerCase();
    if (tileId.includes("roof")) return "roof";
    if (tileId.includes("sewer")) return "sewer";
    if (tileId.includes("wood") || tileId.includes("floor")) return "wood";
    if (
      tileId.includes("cob") ||
      tileId.includes("stone") ||
      tileId.includes("pave") ||
      tileId.includes("plaza")
    ) {
      return "cobblestone";
    }
    if (tileId.includes("grass") || tileId.includes("park")) return "grass";
    if (tileDef?.renderAs === "block" || tileDef?.block) return "wall";
    return "plain";
  };

  const drawProceduralTileTexture = (
    texture: DynamicTexture,
    kind: string,
    baseColor: Color3,
  ) => {
    const size = 64;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = color3ToCss(baseColor);
    ctx.fillRect(0, 0, size, size);

    if (kind === "grass") {
      ctx.fillStyle = shadeColor(baseColor, 0.8);
      for (let index = 0; index < 24; index += 1) {
        const x = (index * 13) % size;
        const y = (index * 29) % size;
        ctx.beginPath();
        ctx.arc(x + 4, y + 4, 3 + (index % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = shadeColor(baseColor, 1.15);
      for (let index = 0; index < 18; index += 1) {
        const x = (index * 19 + 7) % size;
        const y = (index * 11 + 5) % size;
        ctx.fillRect(x, y, 3, 2);
      }
    } else if (kind === "cobblestone") {
      const stones = [
        [4, 4, 22, 18, 1.18],
        [30, 6, 24, 16, 0.72],
        [6, 30, 18, 24, 0.78],
        [30, 32, 26, 20, 1.16],
      ];
      stones.forEach(([x, y, width, height, tone]) => {
        ctx.fillStyle = shadeColor(baseColor, tone as number);
        ctx.fillRect(x as number, y as number, width as number, height as number);
        ctx.strokeStyle = shadeColor(baseColor, 0.45);
        ctx.lineWidth = 2;
        ctx.strokeRect(x as number, y as number, width as number, height as number);
      });
    } else if (kind === "roof") {
      ctx.fillStyle = shadeColor(baseColor, 0.82);
      ctx.fillRect(0, 0, size, 12);
      ctx.fillStyle = shadeColor(baseColor, 1.15);
      ctx.fillRect(0, size - 12, size, 12);
      ctx.strokeStyle = shadeColor(baseColor, 0.62);
      ctx.lineWidth = 2;
      for (let y = 0; y <= size; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
      for (let x = 8; x < size; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size / 2);
        ctx.stroke();
      }
      for (let x = 0; x < size; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, size / 2);
        ctx.lineTo(x, size);
        ctx.stroke();
      }
    } else if (kind === "wood") {
      ctx.strokeStyle = shadeColor(baseColor, 0.55);
      ctx.lineWidth = 2;
      for (let x = 0; x <= size; x += 10) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size);
        ctx.stroke();
      }
      ctx.strokeStyle = shadeColor(baseColor, 1.12);
      ctx.lineWidth = 1;
      for (let row = 0; row < size; row += 8) {
        const knotX = (row * 7) % (size - 8);
        ctx.beginPath();
        ctx.moveTo(0, row + 1);
        ctx.lineTo(size, row + 1);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(knotX + 4, row + 4, 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (kind === "sewer") {
      ctx.strokeStyle = shadeColor(baseColor, 0.52);
      ctx.lineWidth = 1.5;
      for (let y = 0; y <= size; y += 12) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
        const offset = y % 24 === 0 ? 0 : 6;
        for (let x = offset; x <= size; x += 12) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 12);
          ctx.stroke();
        }
      }
      ctx.fillStyle = shadeColor(baseColor, 1.18);
      ctx.fillRect(6, 6, 8, 2);
      ctx.fillRect(34, 20, 7, 2);
      ctx.fillRect(20, 44, 10, 2);
    } else if (kind === "wall") {
      ctx.strokeStyle = shadeColor(baseColor, 0.48);
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, size, size);
      ctx.lineWidth = 1.5;
      for (let y = 0; y <= size; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
        const offset = y % 32 === 0 ? 0 : 8;
        for (let x = offset; x <= size; x += 16) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 16);
          ctx.stroke();
        }
      }
      ctx.fillStyle = shadeColor(baseColor, 1.08);
      for (let index = 0; index < 10; index += 1) {
        const x = (index * 17 + 9) % (size - 6);
        const y = (index * 13 + 5) % (size - 6);
        ctx.fillRect(x, y, 3, 3);
      }
    } else {
      ctx.fillStyle = shadeColor(baseColor, 0.96);
      for (let index = 0; index < 16; index += 1) {
        const x = (index * 9) % size;
        const y = (index * 21) % size;
        ctx.fillRect(x, y, 4, 4);
      }
    }

    texture.update(false);
  };

  const createProceduralTileMaterial = (
    materialKey: string,
    kind: string,
    baseColor: Color3,
  ) => {
    const material = new StandardMaterial(materialKey, scene);
    const texture = new DynamicTexture(
      `${materialKey}-texture`,
      { width: 64, height: 64 },
      scene,
      false,
    );
    drawProceduralTileTexture(texture, kind, baseColor);
    texture.wrapU = 1;
    texture.wrapV = 1;
    material.diffuseTexture = texture;
    material.diffuseColor = Color3.White();
    material.specularColor = new Color3(0.06, 0.06, 0.06);
    material.ambientColor = baseColor.scale(0.35);
    return material;
  };

  const getTileMaterial = (
    symbol: string | null,
    tileDef?: SliceTileDefinition,
    fallbackHexColor = "#6a9f36",
  ) => {
    const baseHex = normalizeTileHexColor(
      tileDef?.color as string | number | undefined,
      fallbackHexColor,
    );
    const kind = inferTileMaterialKind(symbol, tileDef);
    const materialKey = `${kind}:${baseHex}`;
    const existing = tileMaterials.get(materialKey);
    if (existing) {
      return existing;
    }

    const material = createProceduralTileMaterial(
      `slice-tile-${materialKey.replace(/[^a-z0-9:]/gi, "-")}`,
      kind,
      safeTileColor(baseHex, fallbackHexColor),
    );
    tileMaterials.set(materialKey, material);
    return material;
  };

  const loadLevelBinary = async (
    level: string,
    mapData: SliceMapData,
  ): Promise<Uint8Array | null> => {
    const cached = levelBinaryCache.get(level);
    if (cached) {
      return cached;
    }

    const binFile = mapData.levels?.[level]?.binFile;
    if (!binFile) {
      return null;
    }

    try {
      const response = await fetch(`/maps/${binFile}`);
      if (!response.ok) {
        return null;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      levelBinaryCache.set(level, bytes);
      return bytes;
    } catch {
      return null;
    }
  };

  const getMapTileAt = (
    level: string,
    tileX: number,
    tileY: number,
  ): string | null => {
    const mapData = mapDataCache;
    if (!mapData || !mapData.width || !mapData.height || !mapData.tileAtlas) {
      return null;
    }

    if (
      tileX < 0 ||
      tileY < 0 ||
      tileX >= mapData.width ||
      tileY >= mapData.height
    ) {
      return null;
    }

    const binData = levelBinaryCache.get(level);
    if (!binData) {
      return null;
    }

    const index = tileY * mapData.width + tileX;
    const atlasIndex = binData[index];
    return mapData.tileAtlas[atlasIndex] || null;
  };

  const isBlockingTile = (
    symbol: string | null,
    tileDef?: SliceTileDefinition,
  ) => {
    if (!symbol || symbol === "...") {
      return false;
    }

    const tileId = (tileDef?.id || symbol).toLowerCase();
    if (tileId.includes("roof")) {
      return false;
    }

    if (tileDef?.renderAs === "floor") {
      return false;
    }

    if (tileDef?.renderAs === "block") {
      return true;
    }

    return Boolean(tileDef?.block);
  };

  const isWorldPositionBlocked = (
    worldX: number,
    worldZ: number,
    radius = 0.32,
  ) => {
    const mapData = mapDataCache;
    if (!mapData || !mapData.width || !mapData.height) {
      return false;
    }

    const samplePoints: Array<[number, number]> = [
      [worldX, worldZ],
      [worldX - radius, worldZ],
      [worldX + radius, worldZ],
      [worldX, worldZ - radius],
      [worldX, worldZ + radius],
    ];

    for (const [sx, sz] of samplePoints) {
      if (sx < 0 || sz < 0 || sx >= mapData.width || sz >= mapData.height) {
        return true;
      }

      const tileX = Math.floor(sx);
      const tileY = Math.floor(sz);
      const symbol = getMapTileAt(activeLevel, tileX, tileY);
      const tileDef = symbol ? mapData.tileDefinitions?.[symbol] : undefined;
      if (isBlockingTile(symbol, tileDef)) {
        return true;
      }
    }

    return false;
  };

  const clearChunk = (key: string) => {
    const meshes = chunkMeshes.get(key);
    if (meshes) {
      meshes.forEach((m) => m.dispose());
      chunkMeshes.delete(key);
    }
  };

  const clearAllChunks = () => {
    chunkMeshes.forEach((meshes) => meshes.forEach((m) => m.dispose()));
    chunkMeshes.clear();
    chunkLoading.clear();
  };

  const rebuildNavigationGrid = (level: string) => {
    const mapData = mapDataCache;
    if (!mapData || !mapData.width || !mapData.height) {
      return;
    }

    navigationGridSize = Math.max(mapData.width, mapData.height);
    navigationGridOrigin = 0;
    navigationGrid = Array.from({ length: navigationGridSize }, () =>
      Array(navigationGridSize).fill(0),
    );

    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const symbol = getMapTileAt(level, x, y);
        const tileDef = symbol ? mapData.tileDefinitions?.[symbol] : undefined;
        if (isBlockingTile(symbol, tileDef)) {
          navigationGrid[y][x] = 1;
        }
      }
    }

    pathfindingManager.updateGrid(navigationGrid);
  };

  const renderMapLevel = async (level: string) => {
    const mapData = mapDataCache;
    if (!mapData || !mapData.width || !mapData.height) {
      return;
    }

    const binData = await loadLevelBinary(level, mapData);
    if (!binData) {
      return;
    }

    clearAllChunks();

    currentMapWidth = mapData.width;
    currentMapHeight = mapData.height;
    mapMinX = 0;
    mapMinZ = 0;
    mapMaxX = Math.max(0.5, currentMapWidth - 0.5);
    mapMaxZ = Math.max(0.5, currentMapHeight - 0.5);

    rebuildNavigationGrid(level);

    // Tiles are rendered lazily via chunk streaming (updateChunks in the render loop)
    // Trigger an immediate first chunk load so the player doesn't see empty map on spawn
    updateChunks();
  };

  // ---------------------------------------------------------------------------
  // Chunk streaming helpers
  // ---------------------------------------------------------------------------

  // Build a simple pyramid roof mesh for a single 1×1-tile footprint.
  // The roof base sits at `baseY` (world Y = top of the wall below it).
  // Uses 4 triangular faces meeting at the center peak.
  const buildRoofMesh = (
    name: string,
    tx: number,
    tz: number,
    baseY: number,
    ridgeH: number,
  ): Mesh => {
    const group = new TransformNode(name, scene);

    const x0 = tx, x1 = tx + 1;
    const z0 = tz, z1 = tz + 1;
    const xM = tx + 0.5, zM = tz + 0.5;
    const yBase = baseY, yRidge = baseY + ridgeH;

    const vd = new VertexData();

    const positions = [
      x0, yBase, z0,    // 0 front-left
      x1, yBase, z0,    // 1 front-right
      x1, yBase, z1,    // 2 back-right
      x0, yBase, z1,    // 3 back-left
      xM, yRidge, zM,   // 4 peak
    ];

    const indices = [
      0, 4, 1,  // front
      1, 4, 2,  // right
      2, 4, 3,  // back
      3, 4, 0,  // left
    ];

    const normals: number[] = new Array(positions.length).fill(0);
    VertexData.ComputeNormals(positions, indices, normals);

    vd.positions = positions;
    vd.indices = indices;
    vd.normals = normals;
    vd.applyToMesh(group as any as Mesh);

    return group as any as Mesh;
  };

  // Build (or skip) one 16×16-tile chunk at chunk-grid position (cx, cy).
  // lod 0 = full detail, 1 = walls-only, 2 = ground-only
  const buildChunk = (cx: number, cy: number, lod: 0 | 1 | 2) => {
    const key = `${cx}_${cy}`;
    if (chunkMeshes.has(key) || chunkLoading.has(key)) {
      return;
    }

    const mapData = mapDataCache;
    if (!mapData || !mapData.width || !mapData.height) {
      return;
    }

    // Binary data must already be cached (loaded by renderMapLevel)
    if (!levelBinaryCache.has(activeLevel)) {
      return;
    }

    chunkLoading.add(key);

    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;
    const endX = Math.min(startX + CHUNK_SIZE, mapData.width);
    const endY = Math.min(startY + CHUNK_SIZE, mapData.height);

    if (startX >= mapData.width || startY >= mapData.height) {
      chunkLoading.delete(key);
      return;
    }

    const levelOffsetY = levelToWorldY(activeLevel);
    const groundW = endX - startX;
    const groundH = endY - startY;
    const meshes: Mesh[] = [];

    // Ground plane for this chunk
    const ground = MeshBuilder.CreateGround(
      `chunk-gnd-${key}`,
      { width: groundW, height: groundH, subdivisions: 1 },
      scene,
    );
    ground.position.set(startX + groundW / 2, levelOffsetY, startY + groundH / 2);
    ground.material = getTileMaterial(null, { id: "grass", color: "#6a9f36" });
    ground.parent = mapRoot;
    meshes.push(ground);

    // Wall / floor tiles (skipped in lod 2 = ground-only)
    if (lod < 2) {
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const symbol = getMapTileAt(activeLevel, x, y);
          if (!symbol || symbol === "...") {
            continue;
          }

          const tileDef = mapData.tileDefinitions?.[symbol];
          const blocking = isBlockingTile(symbol, tileDef);

          // lod 1 = mid-distance: only render blocking (wall) tiles
          if (!blocking && lod === 1) {
            continue;
          }

          const tileId = (tileDef?.id || symbol || "").toLowerCase();
          const isRoofTile = tileId.includes("roof");

          if (isRoofTile) {
            // Pitched gable roof sitting on top of standard walls
            const wallBaseH = Math.max(0.4, tileDef?.height ?? 2.2);
            const ridgeH = 0.65;
            const roofMesh = buildRoofMesh(
              `ct-${key}-${x}-${y}`,
              x,
              y,
              levelOffsetY + wallBaseH,
              ridgeH,
            );
            roofMesh.material = getTileMaterial(symbol, tileDef, "#8b3a2a");
            roofMesh.parent = mapRoot;
            meshes.push(roofMesh);
          } else {
            const tileHeight = blocking
              ? Math.max(0.4, tileDef?.height ?? 2.2)
              : Math.max(0.03, tileDef?.height ?? 0.08);

            const mesh = MeshBuilder.CreateBox(
              `ct-${key}-${x}-${y}`,
              { width: 1, depth: 1, height: tileHeight },
              scene,
            );
            mesh.position.set(x + 0.5, levelOffsetY + tileHeight / 2, y + 0.5);
            mesh.material = getTileMaterial(symbol, tileDef, "#6a9f36");
            mesh.parent = mapRoot;
            meshes.push(mesh);
          }
        }
      }
    }

    chunkMeshes.set(key, meshes);
    chunkLoading.delete(key);
  };

  // Determine which chunks should be active around the player, load new ones,
  // unload distant ones. Called every CHUNK_UPDATE_INTERVAL seconds.
  const updateChunks = () => {
    if (!mapDataCache || !mapDataCache.width || !mapDataCache.height) {
      return;
    }

    const playerCX = Math.floor(player.position.x / CHUNK_SIZE);
    const playerCY = Math.floor(player.position.z / CHUNK_SIZE);
    const maxCX = Math.ceil(mapDataCache.width / CHUNK_SIZE);
    const maxCY = Math.ceil(mapDataCache.height / CHUNK_SIZE);

    // Collect chunks to unload (outside draw radius) — budget-limited, farthest first
    const toUnload: Array<{ key: string; dist: number }> = [];
    chunkMeshes.forEach((_, key) => {
      const parts = key.split("_");
      const cx = Number(parts[0]);
      const cy = Number(parts[1]);
      const dist = Math.max(Math.abs(cx - playerCX), Math.abs(cy - playerCY));
      if (dist > DRAW_RADIUS_CHUNKS + 1) {
        toUnload.push({ key, dist });
      }
    });
    const unloadBatch = toUnload
      .sort((a, b) => b.dist - a.dist)
      .slice(0, CHUNK_UNLOAD_BUDGET_PER_TICK);
    unloadBatch.forEach((entry) => clearChunk(entry.key));
    const unloadedThisTick = unloadBatch.length;
    const pendingUnloads = Math.max(0, toUnload.length - unloadedThisTick);

    // Queue load for nearby chunks (near-first, budget-limited)
    const chunkCandidates: Array<{ cx: number; cy: number; dist: number }> = [];
    for (let dy = -DRAW_RADIUS_CHUNKS; dy <= DRAW_RADIUS_CHUNKS; dy++) {
      for (let dx = -DRAW_RADIUS_CHUNKS; dx <= DRAW_RADIUS_CHUNKS; dx++) {
        const cx = playerCX + dx;
        const cy = playerCY + dy;
        if (cx < 0 || cy < 0 || cx >= maxCX || cy >= maxCY) {
          continue;
        }

        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const key = `${cx}_${cy}`;
        if (!chunkMeshes.has(key) && !chunkLoading.has(key)) {
          chunkCandidates.push({ cx, cy, dist });
        }
      }
    }

    chunkCandidates.sort((a, b) => a.dist - b.dist);

    let builtThisTick = 0;
    for (const candidate of chunkCandidates) {
      if (builtThisTick >= CHUNK_BUILD_BUDGET_PER_TICK) {
        break;
      }

      const lod: 0 | 1 | 2 =
        candidate.dist <= 2 ? 0 : candidate.dist <= 4 ? 1 : 2;
      buildChunk(candidate.cx, candidate.cy, lod);
      builtThisTick += 1;
    }

    // Lightweight runtime metrics for Sprint 1 tuning.
    (window as any).__slice3dChunkStreaming = {
      playerChunk: { x: playerCX, y: playerCY },
      loadedChunks: chunkMeshes.size,
      loadingChunks: chunkLoading.size,
      builtThisTick,
      pendingCandidates: Math.max(0, chunkCandidates.length - builtThisTick),
      unloadedThisTick,
      pendingUnloads,
      ts: Date.now(),
    };
  };
  const seededLevels = new Set<string>();
  const seedingLevels = new Set<string>();
  let hasRealDroppedItems = false;
  let isAudioReady = false;

  const ensureAudioReady = async () => {
    if (isAudioReady) return;
    try {
      await audioManager.init();
      isAudioReady = true;
    } catch (error) {
      console.warn("[3D Slice] Audio init failed:", error);
    }
  };

  const ensureLevelItemsSeeded = async (level: string) => {
    if (seededLevels.has(level) || seedingLevels.has(level)) return;

    if (playerState.hasVisitedLevel(level)) {
      seededLevels.add(level);
      return;
    }

    seedingLevels.add(level);

    try {
      const mapData = await loadMapData();
      if (!mapData) {
        throw new Error("Map metadata missing");
      }

      const tileSize = mapData.tileSize || 32;
      const levelData = mapData.levels?.[level];
      const entityTemplates = mapData.entityTemplates || {};

      if (levelData?.entities && Array.isArray(levelData.entities)) {
        levelData.entities.forEach((entity) => {
          const entityDef = entityTemplates[entity.symbol];
          if (!entityDef || entityDef.type !== "item") return;

          const worldX = entity.x * tileSize + tileSize / 2;
          const worldY = entity.y * tileSize + tileSize / 2;
          const rawItemUid = entity.uuid || entityDef.uuid;
          const uniqueId = rawItemUid || `map_${level}_${entity.x}_${entity.y}`;

          playerState.addPersistentDroppedItem(level, {
            itemId: uniqueId,
            weaponId: entityDef.id,
            x: worldX,
            y: worldY,
          });

          const contents = entity.contents || entityDef.contents;
          if (!contents || !Array.isArray(contents)) return;

          contents.forEach((content: { id: string; count: number }) => {
            const def =
              WeaponRegistry.getWeaponDefinition(content.id) ||
              ItemRegistry.getItem(content.id);
            const isStackable = !!def?.stackable;

            if (isStackable) {
              playerState.addItemToContainer(
                uniqueId,
                content.id,
                content.count,
              );
              return;
            }

            for (let i = 0; i < content.count; i++) {
              playerState.addItemToContainer(uniqueId, content.id, 1);
            }
          });
        });
      }

      playerState.markLevelVisited(level);
      seededLevels.add(level);
    } catch (error) {
      console.warn(
        `[3D Slice] Failed to seed map items for ${sliceMapName}/${level}`,
        error,
      );
    } finally {
      seedingLevels.delete(level);
    }
  };

  const loadMapData = async (): Promise<SliceMapData | null> => {
    if (mapDataCache) {
      return mapDataCache;
    }

    try {
      const response = await fetch(`/maps/${sliceMapName}.json`);
      if (!response.ok) {
        throw new Error(`Map metadata missing (${response.status})`);
      }
      mapDataCache = (await response.json()) as SliceMapData;
      return mapDataCache;
    } catch (error) {
      console.warn(
        `[3D Slice] Failed to read map metadata for ${sliceMapName}`,
        error,
      );
      return null;
    }
  };

  const ensureWorldMapReady = async (mapData: SliceMapData) => {
    if (worldMapReady || !mapData.levels) {
      return;
    }

    const binaryLevels = new Map<string, Uint8Array>();
    const levelKeys = Object.keys(mapData.levels);

    await Promise.all(
      levelKeys.map(async (levelKey) => {
        const binData = await loadLevelBinary(levelKey, mapData);
        if (binData) {
          binaryLevels.set(levelKey, binData);
        }
      }),
    );

    WorldMapService.preRenderAll(mapData, binaryLevels);
    worldMapReady = true;
  };

  const ensureMapLevelReady = async (requestedLevel: string) => {
    const mapData = await loadMapData();
    if (!mapData || !mapData.levels) {
      return null;
    }

    const availableLevels = Object.keys(mapData.levels);
    if (availableLevels.length === 0) {
      return null;
    }

    const resolvedLevel = mapData.levels[requestedLevel]
      ? requestedLevel
      : availableLevels[0];

    await ensureWorldMapReady(mapData);

    if (resolvedLevel !== activeLevel) {
      activeLevel = resolvedLevel;
      activeLevelNumber = parseLevelNumber(resolvedLevel);
      playerState.setCurrentLevel(resolvedLevel);
    }

    await renderMapLevel(resolvedLevel);

    const initialSpawn = mapData.levels[resolvedLevel]?.playerPos;
    if (
      initialSpawn &&
      startingPosition.x === 0 &&
      startingPosition.y === 0 &&
      player.position.x === 6 &&
      player.position.z === 6
    ) {
      player.position.x = worldToSliceCoord(initialSpawn.x);
      player.position.z = worldToSliceCoord(initialSpawn.y);
    }

    playerState.exploreArea(
      resolvedLevel,
      Math.floor(player.position.x),
      Math.floor(player.position.z),
      8,
      currentMapWidth,
      currentMapHeight,
    );

    return resolvedLevel;
  };

  const getEnemySpawnsForLevel = async (
    level: string,
  ): Promise<EnemySpawnData[]> => {
    const mapData = await loadMapData();
    if (!mapData) {
      return [];
    }

    const tileSize = mapData.tileSize || 32;
    const levelData = mapData.levels?.[level];
    const templates = mapData.entityTemplates || {};
    if (!levelData?.entities) {
      return [];
    }

    const spawns: EnemySpawnData[] = [];
    for (const entity of levelData.entities) {
      const template = templates[entity.symbol];
      if (!template || template.type !== "enemy" || !template.id) {
        continue;
      }

      const def = EnemyRegistry.getEnemyDefinition(template.id);
      if (!def) {
        continue;
      }

      spawns.push({
        enemyType: template.id,
        x: entity.x * tileSize + tileSize / 2,
        y: entity.y * tileSize + tileSize / 2,
      });
    }

    return spawns;
  };

  const clearEnemies = () => {
    enemies.forEach((enemy) => enemy.meshRoot.dispose());
    enemies.clear();
    selectedEnemyUid = null;
    // S7-FP4: clear emissive on all enemies when deselecting all
    enemies.forEach((e) => {
      e.meshRoot.getChildMeshes().forEach((m) => {
        const mat = m.material as import("@babylonjs/core").StandardMaterial | null;
        if (mat) mat.emissiveColor = new Color3(0, 0, 0);
      });
    });
  };

  const setSelectedEnemy = (enemyUid: string | null) => {
    // S7-FP4: clear emissive on previously selected enemy
    if (selectedEnemyUid && selectedEnemyUid !== enemyUid) {
      const prev = enemies.get(selectedEnemyUid);
      if (prev) {
        prev.meshRoot.getChildMeshes().forEach((m) => {
          const mat = m.material as import("@babylonjs/core").StandardMaterial | null;
          if (mat) mat.emissiveColor = new Color3(0, 0, 0);
        });
      }
    }
    selectedEnemyUid = enemyUid;
    if (!enemyUid) return;

    const enemy = enemies.get(enemyUid);
    if (!enemy || enemy.isDead) {
      selectedEnemyUid = null;
      return;
    }
  };

  const spawnEnemy = (spawn: EnemySpawnData, index: number, spawnKey: string) => {
    const definition = EnemyRegistry.getEnemyDefinition(spawn.enemyType);
    if (!definition) {
      return;
    }

    // Skip enemies already killed in a previous visit to this level
    if (playerState.isEnemy3dDead(activeLevel, spawnKey)) {
      return;
    }

    const uid = `${activeLevel}_${spawn.enemyType}_${index}_${Date.now().toString(36)}`;
    const meshRoot = createEnemyVisual(
      scene,
      spawn.enemyType,
      `slice-enemy-${uid}`,
    );
    const spawnLevelY = levelToWorldY(activeLevel);
    const worldPos = new Vector3(
      worldToSliceCoord(spawn.x),
      spawnLevelY,
      worldToSliceCoord(spawn.y),
    );
    meshRoot.position = worldPos.clone();
    meshRoot.metadata = { sliceEnemyUid: uid };

    const instance: SliceEnemy = {
      uid,
      spawnKey,
      enemyType: spawn.enemyType,
      definition,
      meshRoot,
      health: definition.health,
      maxHealth: definition.health,
      worldPos: worldPos.clone(),
      spawnPos: worldPos.clone(),
      lastAttackAt: 0,
      lastPathAt: 0,
      currentPath: [],
      currentPathIndex: 0,
      magicCooldowns: new Map<string, number>(),
      isDead: false,
      isProvoked: false,
    };

    enemies.set(uid, instance);
  };

  const ensureLevelEnemiesSeeded = async (level: string) => {
    if (seededEnemyLevels.has(level)) {
      return;
    }

    const spawns = await getEnemySpawnsForLevel(level);
    spawns.forEach((spawn, index) => {
      const spawnKey = `${level}_${spawn.enemyType}_${index}`;
      spawnEnemy(spawn, index, spawnKey);
    });
    seededEnemyLevels.add(level);
  };

  const grantEnemyLoot = (enemy: SliceEnemy) => {
    const loot = EnemyRegistry.generateLoot(enemy.enemyType);
    loot.forEach((drop) => {
      playerState.addPersistentDroppedItem(activeLevel, {
        itemId: playerState.generateUID(),
        weaponId: drop.itemId,
        x: enemy.worldPos.x * 32,
        y: enemy.worldPos.z * 32,
        createdAt: Date.now(),
        count: drop.count || 1,
        stars: drop.stars || 0,
        attributes: [...(drop.attributes || [])],
      });
    });
  };

  const destroyEnemy = (enemy: SliceEnemy) => {
    if (enemy.isDead) {
      return;
    }

    enemy.isDead = true;
    enemy.meshRoot.dispose();
    enemies.delete(enemy.uid);

    // Persist this kill so the enemy won't respawn on re-entry
    playerState.markEnemy3dDead(activeLevel, enemy.spawnKey);

    if (selectedEnemyUid === enemy.uid) {
      setSelectedEnemy(null);
    }

    grantEnemyLoot(enemy);
    playerState.gainExperience(enemy.definition.exp);

    playerState.emit("floatingText", {
      x: enemy.worldPos.x,
      y: enemy.worldPos.y,
      z: enemy.worldPos.z,
      message: enemy.definition.exp.toString(),
      icon: "★",
      customColor: "#F6E05E",
      isAmbient: true,
    });

    playerState.log("combat_killed", { target: enemy.enemyType }, "#ffaa00");
    playerState.log(
      "combat_gained_xp",
      { xp: enemy.definition.exp },
      "#ffff00",
    );
    audioManager.playEnemyDeath(enemy.enemyType);
  };

  const emitPlayerDamagePopup = (
    sourceKey: string,
    rawDamage: number,
    icon?: string,
    customColor?: string,
  ) => {
    const damage = Math.max(1, Math.floor(rawDamage));
    const now = Date.now();
    const dedupeKey = `${sourceKey}:${icon || "❤"}`;
    const previous = recentPlayerDamagePopups.get(dedupeKey);

    if (previous && previous.value === damage && now - previous.at < 280) {
      return;
    }

    recentPlayerDamagePopups.set(dedupeKey, { at: now, value: damage });

    if (recentPlayerDamagePopups.size > 64) {
      recentPlayerDamagePopups.forEach((entry, key) => {
        if (now - entry.at > 1500) {
          recentPlayerDamagePopups.delete(key);
        }
      });
    }

    playerState.emit("floatingText", {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      damage: -damage,
      isCritical: false,
      icon,
      customColor,
    });
  };

  const applyPlayerAttackToEnemy = (enemy: SliceEnemy) => {
    const equippedWeapon = playerState.getEquippedWeapon();
    const isFireAttack = equippedWeapon?.element === "fire";
    const maxAttack = Math.max(1, Math.floor(playerState.getTotalAttack()));
    const attackRoll = randomInt(1, maxAttack);
    const enemyDefense = Math.max(1, enemy.definition.defense || 1);
    const defenseRoll = randomInt(1, enemyDefense);

    if (attackRoll <= defenseRoll && !isFireAttack) {
      playerState.emit("floatingText", {
        x: enemy.worldPos.x,
        y: enemy.worldPos.y,
        z: enemy.worldPos.z,
        message: "🛡️",
        customColor: "#00FFFF",
      });
      playerState.log(
        "combat_blocked_enemy",
        { target: enemy.enemyType },
        "#aaaaaa",
      );
      audioManager.playBlock();
      return;
    }

    const initialDamage = attackRoll - defenseRoll / 2;
    const armor = Math.max(0, enemy.definition.armor || 0);
    const minReduction = armor > 0 ? Math.max(1, Math.ceil(armor * 0.1)) : 0;
    const armorReduction =
      armor > 0 ? randomInt(minReduction, Math.max(minReduction, armor)) : 0;

    let damage = Math.max(0, Math.floor(initialDamage - armorReduction));

    if (damage <= 0) {
      playerState.emit("floatingText", {
        x: enemy.worldPos.x,
        y: enemy.worldPos.y,
        z: enemy.worldPos.z,
        message: "🛡️",
        customColor: "#C0C0C0",
      });
      playerState.log(
        "combat_blocked_armor_enemy",
        { target: enemy.enemyType },
        "#aaaaaa",
      );
      audioManager.playBlock();
      return;
    }

    const critChance = playerState.getCriticalChance();
    const isCritical = Math.random() * 100 <= critChance;
    if (isCritical) {
      const critMultiplier =
        1 + Math.max(0, playerState.getCriticalDamageMultiplier());
      damage = Math.max(1, Math.round(damage * critMultiplier));
      playerState.gainStrengthExperience(100);
      playerState.gainDexterityExperience(100);
      audioManager.playCritical();
      playerState.log("combat_critical_hit", { damage }, "#ff00ff");
    } else {
      audioManager.playAttack();
    }

    enemy.health = Math.max(0, enemy.health - damage);
    enemy.isProvoked = true;

    // Emit damage popup
    playerState.emit("floatingText", {
      x: enemy.worldPos.x,
      y: enemy.worldPos.y,
      z: enemy.worldPos.z,
      damage: -damage,
      isCritical: isCritical,
    });

    playerState.log(
      "combat_damage_dealt",
      { damage, target: enemy.enemyType },
      "#ffffff",
    );

    if (enemy.health <= 0) {
      destroyEnemy(enemy);
      return;
    }

    const weaponBaseXp = Math.max(0, equippedWeapon?.exp_skill || 100);
    const flatBonusXp = Math.max(0, playerState.getExpPerHit());
    const damagePercent = Math.max(0, playerState.getExpDamagePercent());
    const totalCombatXp = Math.floor(
      weaponBaseXp + flatBonusXp + damage * (1 + damagePercent / 100),
    );

    if (totalCombatXp > 0) {
      if (isFireAttack) {
        playerState.gainIntelligenceExperience(totalCombatXp);
        playerState.log(
          "combat_gained_skill_xp",
          { skill: "Intelligence", amount: totalCombatXp },
          "#34d399",
        );
      } else if (
        !equippedWeapon ||
        equippedWeapon.type === ItemType.SWORD ||
        equippedWeapon.type === ItemType.AXE ||
        equippedWeapon.type === ItemType.CLUB
      ) {
        playerState.gainStrengthExperience(totalCombatXp);
        playerState.log(
          "combat_gained_skill_xp",
          { skill: "Strength", amount: totalCombatXp },
          "#34d399",
        );
      } else if (equippedWeapon.type === ItemType.DISTANCE) {
        playerState.gainDexterityExperience(totalCombatXp);
        playerState.log(
          "combat_gained_skill_xp",
          { skill: "Dexterity", amount: totalCombatXp },
          "#34d399",
        );
      } else {
        playerState.gainStrengthExperience(totalCombatXp);
        playerState.log(
          "combat_gained_skill_xp",
          { skill: "Strength", amount: totalCombatXp },
          "#34d399",
        );
      }
    }
  };

  const applyEnemyAttackToPlayer = (enemy: SliceEnemy, now: number) => {
    const cooldown = Math.max(0, enemy.definition.cooldown || 1000);
    if (now - enemy.lastAttackAt < cooldown) {
      return;
    }

    enemy.lastAttackAt = now;

    const isFireAttack =
      enemy.enemyType === "dragon" ||
      Boolean(
        enemy.definition.magicAttacks?.some((magicId) =>
          magicId.toLowerCase().includes("fire"),
        ),
      );
    const shieldDefense = Math.max(
      0,
      playerState.getEquippedShield()?.defense || 0,
    );
    const defenseRollMax = Math.max(
      1,
      Math.floor(shieldDefense + playerState.getDexterityLevel() * 0.3),
    );
    const attackDamage = Math.max(1, enemy.definition.damage);
    const attackRoll = randomInt(1, attackDamage);
    const defenseRoll = randomInt(1, defenseRollMax);
    let damageMitigation = 0;

    if (defenseRoll >= attackRoll) {
      if (isFireAttack) {
        damageMitigation =
          playerState.getEquippedShield()?.defenseResistances?.fire || 0;
        playerState.emit("floatingText", {
          x: player.position.x,
          y: player.position.y,
          z: player.position.z,
          message: "🛡️",
          customColor: "#00FFFF",
        });
        if (damageMitigation >= 1) {
          playerState.log(
            "combat_blocked_player",
            { target: enemy.enemyType },
            "#aaaaff",
          );
          audioManager.playBlock();
          return;
        }
      } else {
        playerState.emit("floatingText", {
          x: player.position.x,
          y: player.position.y,
          z: player.position.z,
          message: "🛡️",
          customColor: "#00FFFF",
        });
        playerState.log(
          "combat_blocked_player",
          { target: enemy.enemyType },
          "#aaaaff",
        );
        audioManager.playBlock();
        return;
      }
    }

    // Keep 2D parity: physical attack is always a roll in [1..maxAttack].
    let finalDamage = Math.max(1, attackRoll - Math.floor(defenseRoll / 2));
    if (damageMitigation > 0) {
      finalDamage = Math.max(
        1,
        Math.round(finalDamage * (1 - damageMitigation)),
      );
    }

    const armor = Math.max(0, playerState.getTotalArmor());
    const minReduction = armor > 0 ? Math.max(1, Math.ceil(armor * 0.1)) : 0;
    const armorReduction =
      armor > 0 ? randomInt(minReduction, Math.max(minReduction, armor)) : 0;
    finalDamage = Math.max(0, finalDamage - armorReduction);

    if (finalDamage <= 0) {
      playerState.emit("floatingText", {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        message: "🛡️",
        customColor: "#C0C0C0",
      });
      playerState.log(
        "combat_blocked_armor_player",
        { target: enemy.enemyType },
        "#aaaaaa",
      );
      audioManager.playBlock();
      return;
    }

    const playerDied = playerState.takeDamage(finalDamage);

    emitPlayerDamagePopup(`${enemy.uid}:melee`, finalDamage);

    playerState.log(
      "combat_damage_taken",
      { damage: finalDamage, target: enemy.enemyType },
      "#ff4444",
    );
    audioManager.playAttack();

    if (playerDied) {
      playerState.log("msg_willpower_lost", {}, "#ef4444");
    }
  };

  const tryEnemyMagicAttack = (enemy: SliceEnemy, now: number): boolean => {
    const magicIds = enemy.definition.magicAttacks || [];
    if (!magicIds.length) {
      return false;
    }

    const hpRatio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 1;
    const distanceToPlayerPx =
      Vector3.Distance(enemy.worldPos, player.position) * 32;

    for (const magicId of magicIds) {
      const magicDef = EnemyMagicRegistry.getMagic(magicId);
      if (!magicDef) {
        continue;
      }

      const lastCastAt = enemy.magicCooldowns.get(magicId) || 0;
      if (now - lastCastAt < magicDef.cooldown) {
        continue;
      }

      if (
        magicDef.minHpPercentage !== undefined &&
        hpRatio < magicDef.minHpPercentage
      ) {
        continue;
      }

      if (
        magicDef.maxHpPercentage !== undefined &&
        hpRatio > magicDef.maxHpPercentage
      ) {
        continue;
      }

      if (distanceToPlayerPx > magicDef.range) {
        continue;
      }

      if (!hasLineOfSight(enemy.worldPos, player.position)) {
        continue;
      }

      if (Math.random() > magicDef.chance) {
        continue;
      }

      enemy.magicCooldowns.set(magicId, now);
      enemy.lastAttackAt = now;

      const spellDamage = randomInt(magicDef.minDamage, magicDef.maxDamage);
      const playerDied = playerState.takeDamage(spellDamage);

      playerState.emit("floatingText", {
        x: enemy.worldPos.x,
        y: enemy.worldPos.y,
        z: enemy.worldPos.z,
        message: "🔥",
        customColor: "#FF4500",
        isAmbient: true,
      });

      emitPlayerDamagePopup(
        `${enemy.uid}:magic:${magicId}`,
        spellDamage,
        "🔥",
        "#FF4500",
      );

      playerState.log(
        "combat_damage_taken",
        { damage: spellDamage, target: enemy.enemyType },
        "#ff4444",
      );
      audioManager.playFireHit();

      if (playerDied) {
        playerState.log("msg_willpower_lost", {}, "#ef4444");
      }

      return true;
    }

    return false;
  };

  const getPlayerAttackRangeUnits = () => {
    const equippedWeapon = playerState.getEquippedWeapon();
    const weaponRange = equippedWeapon?.range || 50;
    return Math.max(1, weaponRange / 32);
  };

  const getPlayerAttackCooldownMs = () => {
    const equippedWeapon = playerState.getEquippedWeapon();
    return Math.max(0, equippedWeapon?.cooldown ?? 1000);
  };

  const tryAutoPlayerAttack = (now: number) => {
    if (!selectedEnemyUid) {
      return;
    }

    const enemy = enemies.get(selectedEnemyUid);
    if (!enemy || enemy.isDead) {
      setSelectedEnemy(null);
      return;
    }

    const cooldownMs = getPlayerAttackCooldownMs();
    if (now - lastPlayerAttackAt < cooldownMs) {
      return;
    }

    const attackRangeUnits = getPlayerAttackRangeUnits();
    const distance = Vector3.Distance(player.position, enemy.worldPos);
    if (distance > attackRangeUnits) {
      return;
    }

    if (!hasLineOfSight(player.position, enemy.worldPos)) {
      return;
    }

    lastPlayerAttackAt = now;
    applyPlayerAttackToEnemy(enemy);
  };

  const requestEnemyPath = async (
    enemy: SliceEnemy,
    targetPosition: Vector3,
  ) => {
    const startX = worldToGrid(enemy.worldPos.x, navigationGridOrigin);
    const startY = worldToGrid(enemy.worldPos.z, navigationGridOrigin);
    const endX = worldToGrid(targetPosition.x, navigationGridOrigin);
    const endY = worldToGrid(targetPosition.z, navigationGridOrigin);

    if (
      startX < 0 ||
      startY < 0 ||
      endX < 0 ||
      endY < 0 ||
      startX >= navigationGridSize ||
      startY >= navigationGridSize ||
      endX >= navigationGridSize ||
      endY >= navigationGridSize
    ) {
      return;
    }

    const path = await pathfindingManager.requestPath(
      startX,
      startY,
      endX,
      endY,
    );
    if (!path || path.length === 0 || enemy.isDead) {
      return;
    }

    enemy.currentPath = path;
    enemy.currentPathIndex = 0;
  };

  const advanceEnemyPath = (enemy: SliceEnemy, deltaSeconds: number) => {
    if (
      !enemy.currentPath.length ||
      enemy.currentPathIndex >= enemy.currentPath.length
    ) {
      return;
    }

    const waypoint = enemy.currentPath[enemy.currentPathIndex];
    const target = new Vector3(
      gridToWorld(waypoint.x, navigationGridOrigin),
      0,
      gridToWorld(waypoint.y, navigationGridOrigin),
    );

    const toTarget = target.subtract(enemy.worldPos);
    const distance = toTarget.length();
    if (distance < 0.1) {
      enemy.currentPathIndex += 1;
      return;
    }

    const direction = toTarget.normalize();
    const speedUnits = Math.max(1, enemy.definition.speed / 32) * 0.35;
    const step = speedUnits * deltaSeconds;
    const movement = direction.scale(Math.min(step, distance));

    enemy.worldPos.addInPlace(movement);
    enemy.worldPos.x = clamp(enemy.worldPos.x, mapMinX + 0.5, mapMaxX);
    enemy.worldPos.z = clamp(enemy.worldPos.z, mapMinZ + 0.5, mapMaxZ);
    enemy.meshRoot.position = enemy.worldPos;
    enemy.meshRoot.lookAt(
      new Vector3(player.position.x, enemy.worldPos.y, player.position.z),
    );
  };

  const updateEnemyAI = (deltaSeconds: number) => {
    const now = Date.now();

    enemies.forEach((enemy) => {
      if (enemy.isDead) {
        return;
      }

      const distanceToPlayer = Vector3.Distance(
        enemy.worldPos,
        player.position,
      );
      const attackRangeUnits = Math.max(1, enemy.definition.attackRange / 32);
      const aggroRangeUnits = Math.max(2, enemy.definition.aggroRange);
      const chaseRangeUnits = Math.max(4, enemy.definition.chaseRange);
      const effectiveChaseRange = enemy.isProvoked
        ? chaseRangeUnits * 1.5
        : chaseRangeUnits;
      const playerInAggro = distanceToPlayer <= aggroRangeUnits;
      const shouldChasePlayer = playerInAggro || enemy.isProvoked;

      if (shouldChasePlayer && distanceToPlayer > effectiveChaseRange) {
        enemy.isProvoked = false;
        enemy.currentPath = [];
      }

      const currentlyChasing = playerInAggro || enemy.isProvoked;
      const didCastMagic = currentlyChasing
        ? tryEnemyMagicAttack(enemy, now)
        : false;

      if (didCastMagic) {
        enemy.currentPath = [];
        return;
      }

      if (
        currentlyChasing &&
        distanceToPlayer <= attackRangeUnits &&
        hasLineOfSight(enemy.worldPos, player.position)
      ) {
        enemy.currentPath = [];
        applyEnemyAttackToPlayer(enemy, now);
        return;
      }

      const targetPos = currentlyChasing ? player.position : enemy.spawnPos;

      if (now - enemy.lastPathAt > 1000) {
        enemy.lastPathAt = now;
        void requestEnemyPath(enemy, targetPos);
      }

      advanceEnemyPath(enemy, deltaSeconds);

      if (
        !currentlyChasing &&
        Vector3.Distance(enemy.worldPos, enemy.spawnPos) < 0.4
      ) {
        enemy.currentPath = [];
      }
    });
  };

  const syncDroppedItems = () => {
    const currentLevel = playerState.getCurrentLevel();
    if (currentLevel !== activeLevel) {
      droppedItemMeshes.forEach((mesh) => mesh.dispose());
      droppedItemMeshes.clear();
      clearEnemies();
      activeLevel = currentLevel;
      void ensureMapLevelReady(currentLevel);
      void ensureLevelItemsSeeded(currentLevel);
      void ensureLevelEnemiesSeeded(currentLevel);
      setSelectedEnemy(null);
    }

    const persistentItems = playerState.getPersistentDroppedItems(currentLevel);
    const nextIds = new Set(persistentItems.map((item) => item.itemId));

    droppedItemMeshes.forEach((mesh, itemId) => {
      if (!nextIds.has(itemId)) {
        mesh.dispose();
        droppedItemMeshes.delete(itemId);
      }
    });

    persistentItems.forEach((item) => {
      let mesh = droppedItemMeshes.get(item.itemId);
      if (!mesh) {
        mesh = MeshBuilder.CreateSphere(
          `slice-dropped-${item.itemId}`,
          { diameter: 0.5, segments: 10 },
          scene,
        );
        mesh.material = droppedItemMaterial;
        droppedItemMeshes.set(item.itemId, mesh);
      }

      const levelWorldY = levelToWorldY(currentLevel);
      mesh.position.set(
        worldToSliceCoord(item.x),
        levelWorldY + 0.4,
        worldToSliceCoord(item.y),
      );
      mesh.metadata = item;
    });

    hasRealDroppedItems = persistentItems.length > 0;
    pickupOrb.setEnabled(!hasRealDroppedItems && !fallbackPickupConsumed);
  };

  const tryPickupPersistentItem = (
    item: DroppedItemData,
    requestedCount?: number,
  ): boolean => {
    const availableCount = item.count || 1;
    const pickupCount = Math.max(
      1,
      Math.min(requestedCount || availableCount, availableCount),
    );
    const added = playerState.addItem(
      item.weaponId,
      pickupCount,
      item.itemId,
      item.stars || 0,
      [...(item.attributes || [])],
    );

    if (!added) {
      return false;
    }

    if (availableCount > pickupCount) {
      const persistent = playerState.getPersistentDroppedItems(activeLevel);
      const target = persistent.find((entry) => entry.itemId === item.itemId);
      if (target) {
        target.count = availableCount - pickupCount;
      }
    } else {
      playerState.removePersistentDroppedItem(activeLevel, item.itemId);
    }

    const def = WeaponRegistry.getWeaponDefinition(item.weaponId);
    const itemName = def ? t_game(`item_${def.id}` as any) : item.weaponId;
    playerState.emit("uiNotification", {
      type: "pickup",
      message: t_game("notif_item_get")
        .replace("{amount}", pickupCount.toString())
        .replace("{item}", itemName),
    });
    audioManager.playPickup();
    playerState.log("action_pickup");
    return true;
  };

  const tryPickupNearestItem = (): boolean => {
    const pickupRange = playerState.pickupRange / 32;
    let nearestItem: DroppedItemData | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    droppedItemMeshes.forEach((mesh) => {
      const item = mesh.metadata as DroppedItemData | undefined;
      if (!item) return;

      const distance = Vector3.Distance(player.position, mesh.position);
      if (distance <= pickupRange && distance < nearestDistance) {
        nearestItem = item;
        nearestDistance = distance;
      }
    });

    if (nearestItem) {
      return tryPickupPersistentItem(nearestItem);
    }

    return false;
  };

  const addDroppedItemFromEvent = (data: {
    itemId?: string;
    weaponId?: string;
    count?: number;
    x?: number;
    y?: number;
    stars?: number;
    attributes?: any[];
  }) => {
    const weaponId = data.weaponId || data.itemId;
    if (!weaponId) return;

    const fallbackX = player.position.x * 32;
    const fallbackY = player.position.z * 32;
    const uid = data.itemId || playerState.generateUID();

    playerState.addPersistentDroppedItem(activeLevel, {
      itemId: uid,
      weaponId,
      x: data.x ?? fallbackX,
      y: data.y ?? fallbackY,
      createdAt: Date.now(),
      count: data.count || 1,
      stars: data.stars || 0,
      attributes: [...(data.attributes || [])],
    });
  };

  const handleDropItem = (
    itemId: string,
    count?: number,
    worldX?: number,
    worldY?: number,
  ) => {
    let inventoryItem = playerState.getInventoryItem(itemId);

    if (!inventoryItem) {
      inventoryItem = playerState
        .getInventory()
        .find((entry) => entry.itemId === itemId);
    }

    if (!inventoryItem) return;

    const availableCount = inventoryItem.count;
    const dropCount = Math.max(
      1,
      Math.min(count || availableCount, availableCount),
    );
    const droppingAll = dropCount >= availableCount;

    if (droppingAll) {
      playerState.removeInventoryItem(inventoryItem.uid);
    } else {
      inventoryItem.count = availableCount - dropCount;
      playerState.emit("inventoryUpdated");
    }

    const dropUid = droppingAll ? inventoryItem.uid : playerState.generateUID();

    addDroppedItemFromEvent({
      itemId: dropUid,
      weaponId: inventoryItem.itemId,
      count: dropCount,
      x: worldX,
      y: worldY,
      stars: inventoryItem.stars,
      attributes: inventoryItem.attributes,
    });
  };

  const handleRequestPickup = (payload: { uid: string; count?: number }) => {
    const persistent = playerState.getPersistentDroppedItems(activeLevel);
    const item = persistent.find((entry) => entry.itemId === payload.uid);
    if (!item) return;
    tryPickupPersistentItem(item, payload.count);
  };

  void ensureMapLevelReady(activeLevel);
  void ensureLevelItemsSeeded(activeLevel);
  void ensureLevelEnemiesSeeded(activeLevel);
  syncDroppedItems();

  const pressedKeys = new Set<string>();

  let isFirstPerson = false;
  let verticalVelocity = 0;
  const gravity = -18;
  const jumpImpulse = 7.2;
  const playerGroundY = 0.8;
  let isGrounded = true;
  let chunkUpdateTimer = 0;
  let stairCooldown = 0;          // seconds until next level transition is allowed
  let stairAnimTimer = 0;          // seconds elapsed during stair animation
  let stairAnimDuration = 2.0;     // total time to climb/descend stairs
  let stairAnimStartY = 0;
  let stairAnimTargetY = 0;
    const CHUNK_UPDATE_INTERVAL = 0.2;
  let stairAnimTargetLevel = "0";  // target level to switch to after animation
  let isStairAnimActive = false;   // true only while a stair transition is playing

  const requestPointerLockIfPossible = () => {
    if (!isFirstPerson || document.pointerLockElement === canvas) {
      return;
    }

    try {
      canvas.requestPointerLock?.();
    } catch {
      // Browser blocks pointer lock outside user gesture; ignore and retry on click/key toggle.
    }
  };

  const setCameraMode = (
    firstPerson: boolean,
    shouldRequestPointerLock = false,
  ) => {
    isFirstPerson = firstPerson;
    // S7-FP1: notify React overlay (crosshair) of camera mode change
    document.dispatchEvent(new CustomEvent("slice3d:cameraModeChanged", { detail: { firstPerson } }));

    if (isFirstPerson) {
      camera.detachControl();
      firstPersonCamera.position.set(
        player.position.x,
        // S7-FP5: eye height at 0.55 — lower than crown (0.72) for better depth
        // perception. Reference: Morrowind ~0.55, Daggerfall ~0.50.
        player.position.y + 0.55,
        player.position.z,
      );
      scene.activeCamera = firstPersonCamera;
      firstPersonCamera.attachControl(canvas, true);
      if (shouldRequestPointerLock) {
        requestPointerLockIfPossible();
      }
      return;
    }

    firstPersonCamera.detachControl();
    document.exitPointerLock?.();
    scene.activeCamera = camera;
    camera.attachControl(canvas, true);
  };

  // Activate first-person mode if URL contains ?fp=1
  if (searchParams.get("fp") === "1") {
    setCameraMode(true, false);
  }

  const onKeyDown = (event: KeyboardEvent) => {
    void ensureAudioReady();

    const key = event.key.toLowerCase();
    pressedKeys.add(key);

    if (event.code === "Space") {
      if (isGrounded) {
        verticalVelocity = jumpImpulse;
        isGrounded = false;
        audioManager.playJump();
      }
      event.preventDefault();
    }

    if (key === "v" && !event.repeat) {
      setCameraMode(!isFirstPerson, !isFirstPerson);
    }

    if (key === "e" && !event.repeat) {
      const pickedRealItem = tryPickupNearestItem();
      if (pickedRealItem) {
        syncDroppedItems();
        return;
      }

      if (!hasRealDroppedItems) {
        const dist = Vector3.Distance(player.position, pickupOrb.position);
        if (dist <= 1.25) {
          const added = playerState.addItem("torch", 1);
          if (added) {
            fallbackPickupConsumed = true;
            pickupOrb.setEnabled(false);
            audioManager.playPickup();
            playerState.log("action_pickup");
          }
        }
      }
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    pressedKeys.delete(event.key.toLowerCase());
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  playerState.on("dropItem", handleDropItem);
  playerState.on("requestPickup", handleRequestPickup);
  playerState.on("spawnDroppedItem", addDroppedItemFromEvent);

  const onCanvasContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };
  canvas.addEventListener("contextmenu", onCanvasContextMenu);

  const onCanvasPointerDown = () => {
    requestPointerLockIfPossible();
  };
  canvas.addEventListener("pointerdown", onCanvasPointerDown);

  const pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) {
      return;
    }

    if (pointerInfo.event.button !== 2) {
      return;
    }

    const pickResult = scene.pick(scene.pointerX, scene.pointerY);
    let enemyUid: string | undefined;
    let currentMesh: any = pickResult?.pickedMesh;
    while (currentMesh) {
      const metadata = currentMesh.metadata as
        | { sliceEnemyUid?: string }
        | undefined;
      if (metadata?.sliceEnemyUid) {
        enemyUid = metadata.sliceEnemyUid;
        break;
      }
      currentMesh = currentMesh.parent;
    }

    if (enemyUid && enemies.has(enemyUid)) {
      setSelectedEnemy(enemyUid);
      return;
    }

    setSelectedEnemy(null);
  });

  scene.onBeforeRenderObservable.add(() => {
    syncDroppedItems();

    const deltaSeconds = engine.getDeltaTime() / 1000;

    // Chunk streaming: update at most every CHUNK_UPDATE_INTERVAL seconds
    chunkUpdateTimer += deltaSeconds;
    if (chunkUpdateTimer >= CHUNK_UPDATE_INTERVAL) {
      chunkUpdateTimer = 0;
      updateChunks();
    }
    const speed = 4.5;
    let moveForward = 0;
    let moveRight = 0;

    if (pressedKeys.has("w") || pressedKeys.has("arrowup")) moveForward += 1;
    if (pressedKeys.has("s") || pressedKeys.has("arrowdown")) moveForward -= 1;
    if (pressedKeys.has("a") || pressedKeys.has("arrowleft")) moveRight -= 1;
    if (pressedKeys.has("d") || pressedKeys.has("arrowright")) moveRight += 1;

    if (moveForward !== 0 || moveRight !== 0) {
      // Block horizontal movement while a stair transition is in progress (S3-T4)
      if (!isStairAnimActive) {
        let movement = Vector3.Zero();

        if (isFirstPerson) {
          const yaw = firstPersonCamera.rotation.y;
          const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
          const right = new Vector3(forward.z, 0, -forward.x);
          movement = forward.scale(moveForward).add(right.scale(moveRight));
        } else {
          movement = new Vector3(moveRight, 0, moveForward);
        }

        movement.normalize().scaleInPlace(speed * deltaSeconds);
        const nextX = player.position.x + movement.x;
        const nextZ = player.position.z + movement.z;

        if (!isWorldPositionBlocked(nextX, player.position.z)) {
          player.position.x = nextX;
        }

        if (!isWorldPositionBlocked(player.position.x, nextZ)) {
          player.position.z = nextZ;
        }

        player.position.x = Math.min(
          mapMaxX,
          Math.max(mapMinX + 0.5, player.position.x),
        );
        player.position.z = Math.min(
          mapMaxZ,
          Math.max(mapMinZ + 0.5, player.position.z),
        );
        audioManager.playFootstep("floor");
      } // end !isStairAnimActive
    }

    // ── Stair / level transition check ──────────────────────────────────────
    if (stairCooldown > 0) {
      stairCooldown -= deltaSeconds;
    } else {
      const tileX = Math.floor(player.position.x);
      const tileZ = Math.floor(player.position.z);
      const underSym = getMapTileAt(activeLevel, tileX, tileZ);
      const underDef = underSym ? mapDataCache?.tileDefinitions?.[underSym] : undefined;
      const stairDir = (underDef as any)?.stairDir as string | undefined;

      if (stairDir && !isStairAnimActive) {
        const currentNum = parseLevelNumber(activeLevel);
        const targetNum  = stairDir === "up" ? currentNum + 1 : currentNum - 1;
        const targetKey  = String(targetNum);

        if (mapDataCache?.levels?.[targetKey]) {
          stairCooldown = stairAnimDuration + 0.5;
          stairAnimTimer = 0;
          stairAnimStartY = player.position.y;
          stairAnimTargetLevel = targetKey;
          stairAnimTargetY = levelToWorldY(targetKey) + PLAYER_GROUND_OFFSET;
          isStairAnimActive = true;
        }
      }
    }

    // Smooth stair animation (only when isStairAnimActive)
    if (isStairAnimActive) {
      stairAnimTimer += deltaSeconds;
      const progress = Math.min(1, stairAnimTimer / stairAnimDuration);
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      player.position.y = stairAnimStartY + (stairAnimTargetY - stairAnimStartY) * easeProgress;

      // At midpoint: load target level geometry
      if (progress >= 0.45 && progress < 0.55 && activeLevel !== stairAnimTargetLevel) {
        void ensureMapLevelReady(stairAnimTargetLevel);
      }

      // Animation complete
      if (stairAnimTimer >= stairAnimDuration) {
        player.position.y = stairAnimTargetY;
        verticalVelocity = 0;
        isGrounded = true;
        isStairAnimActive = false;
        if (activeLevel !== stairAnimTargetLevel) {
          void ensureMapLevelReady(stairAnimTargetLevel);
        }
        void ensureLevelEnemiesSeeded(stairAnimTargetLevel);
        void ensureLevelItemsSeeded(stairAnimTargetLevel);
      }
    }

    // (legacy timer-based completion removed — handled inside isStairAnimActive block)

    updateEnemyAI(deltaSeconds);
    tryAutoPlayerAttack(Date.now());

    // S7-FP4: emissive pulse on selected enemy — soft red flicker
    enemyHighlightPulseT += deltaSeconds;
    if (selectedEnemyUid) {
      const selectedEnemy = enemies.get(selectedEnemyUid);
      if (!selectedEnemy || selectedEnemy.isDead) {
        setSelectedEnemy(null);
      } else {
        // sine wave: oscillates between 0 and 0.45 at ~1.8 Hz
        const pulse = (Math.sin(enemyHighlightPulseT * Math.PI * 1.8) * 0.5 + 0.5) * 0.45;
        selectedEnemy.meshRoot.getChildMeshes().forEach((m) => {
          const mat = m.material as import("@babylonjs/core").StandardMaterial | null;
          if (mat) mat.emissiveColor = new Color3(pulse, 0, 0);
        });
      }
    }

    // Gravity and ground clamp — bypassed while stair animation is playing
    if (!isStairAnimActive) {
      verticalVelocity += gravity * deltaSeconds;
      player.position.y += verticalVelocity * deltaSeconds;
      const levelGroundY = levelToWorldY(activeLevelNumber) + PLAYER_GROUND_OFFSET;
      if (player.position.y <= levelGroundY) {
        player.position.y = levelGroundY;
        verticalVelocity = 0;
        isGrounded = true;
      }
    }

    if (isFirstPerson) {
      firstPersonCamera.position.set(
        player.position.x,
        player.position.y + 0.55, // S7-FP5: eye height (see setCameraMode comment)
        player.position.z,
      );
      playerState.exploreArea(
        activeLevel,
        Math.floor(player.position.x),
        Math.floor(player.position.z),
        8,
        currentMapWidth,
        currentMapHeight,
      );
      playerState.recordPlayerPosition(
        activeLevel,
        player.position.x * 32,
        player.position.z * 32,
      );
      return;
    }

    const currentTarget = camera.target;
    camera.setTarget(
      Vector3.Lerp(
        currentTarget,
        new Vector3(player.position.x, 1.4, player.position.z),
        0.12,
      ),
    );

    playerState.exploreArea(
      activeLevel,
      Math.floor(player.position.x),
      Math.floor(player.position.z),
      8,
      currentMapWidth,
      currentMapHeight,
    );

    playerState.recordPlayerPosition(
      activeLevel,
      player.position.x * 32,
      player.position.z * 32,
    );
  });

  engine.runRenderLoop(() => {
    scene.render();
  });

  return {
    engine,
    scene,
    dispose: () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      playerState.off("dropItem", handleDropItem);
      playerState.off("requestPickup", handleRequestPickup);
      playerState.off("spawnDroppedItem", addDroppedItemFromEvent);
      canvas.removeEventListener("contextmenu", onCanvasContextMenu);
      canvas.removeEventListener("pointerdown", onCanvasPointerDown);
      scene.onPointerObservable.remove(pointerObserver);
      document.exitPointerLock?.();
      clearAllChunks();
      mapRoot.dispose();
      tileMaterials.forEach((material) => material.dispose());
      clearEnemies();
      // S7-FP4: torus marker removed — no dispose needed
      scene.dispose();
      engine.dispose();
    },
  };
}
