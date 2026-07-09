import {
  ArcRotateCamera,
  Color3,
  DynamicTexture,
  Engine,
  HemisphericLight,
  Matrix,
  Mesh,
  MeshBuilder,
  PointerEventTypes,
  Scene,
  StandardMaterial,
  TransformNode,
  UniversalCamera,
  Vector2,
  Vector3,
  VertexData,
  Texture,
  SceneInstrumentation,
} from "@babylonjs/core";
import {
  DroppedItemData,
  PlayerState,
} from "../../game/entities/Player/PlayerState";
import { t_game } from "../../game/i18n/translations";
import { AudioManager } from "../../game/systems/AudioManager";
import { PathfindingManager } from "../../game/systems/PathfindingManager";
import { WorldMapService } from "../../services/WorldMapService";
import { registerDefaultMagics } from "../../game/entities/EnemyMagicRegistry";
import { ItemRegistry } from "../../core/registries/ItemRegistry";
import { WeaponRegistry } from "../../core/registries/WeaponRegistry";
import { ContainerRegistry } from "../../core/registries/ContainerRegistry";
import {
  EnemyRegistry,
  EnemyDefinition,
} from "../../core/registries/EnemyRegistry";
import {
  applyEnemyTargetVisual,
  applyEnemyAnimLod,
  createEnemyVisual,
  restoreEnemyTargetVisual,
  setEnemyVisualAnimState,
  setEnemyVisualDirection,
  type EnemyVisualAnimState,
  type EnemyVisualRoot,
} from "./ThreeDEnemyVisualRegistry";
import {
  Projectile3DSystem,
  type Projectile3DGridContext,
} from "./Projectile3DSystem";
import {
  resolveBmsDirectionFromWorldDelta,
  bmsDirectionToFirstPersonYaw,
  firstPersonYawToBmsDirection,
} from "./BmsDirectionResolver";
import {
  createHeroModularSpriteMaterial,
  resolveHeroBmsDirection,
  HERO_BILLBOARD_LAYOUT,
  getHeroFirstPersonEyeHeight,
  HERO_COLLISION_HEIGHT,
  getGeneratedDeathDurationMs,
  type HeroAnimState,
  type HeroBmsDirection,
  type HeroSpriteMaterial,
} from "./TwoDParitySpriteFactory";
import {
  sampleAquaticAtWorldFootprint,
} from "./WaterQuery3D";
import { isWaterTileId, sampleAquaticFromTile, type AquaticSample } from "./WaterProfile";
import { attachAquaticShaderTint } from "./AquaticSpriteShader";
import { configureBillboardSpriteMesh } from "./BillboardDepthConfig";
import { SliceInputManager } from "./SliceInputManager";
import type { SliceSceneContext } from "./SliceSceneContext";
import { SliceEnemySystem } from "./SliceEnemySystem";
import { SliceCombatSystem } from "./SliceCombatSystem";
import {
  createFirstPersonCombatCameraState,
  FP_CAMERA_FOV,
  getFirstPersonEnemyProximityScale,
  updateFirstPersonCombatCamera,
} from "./FirstPersonCombatPresentation";
import { computeFallDamageMultiplier, getAquaticVisualPreset } from "./AquaticVisualConfig";
import {
  collectWaterEffectTiles,
  WaterEffectSystem,
} from "./WaterEffectSystem";
import {
  InteractableWallRevealSystem,
  type InteractableRevealTarget,
} from "./InteractableWallRevealSystem";
import {
  computeWaterPitWallMask,
  WATER_HOLE_RIM_OFFSET,
  waterHoleDepthForTileId,
} from "./WaterHoleConfig";
import {
  FEET_CLEARANCE,
} from "./GroundHeightQuery3D";
import { CollisionWorld, isGradedWalkTile } from "./CollisionWorld";
import {
  type PlayerContext,
  type PhysicsInput,
  createPlayerContext,
} from "./PlayerContext";
import {
  tickPhysics,
  type PhysicsWorldQueries,
  type PhysicsEvents,
} from "./PlayerPhysicsSystem";
import { LEVEL_HEIGHT, WALL_HEIGHT, WALK_SURFACE } from "../../constants/World";
import { inferLevelFromFootY } from "./NaturalFloorLevel3D";
import {
   isFloorLevelRamp,
   resolveTileHeight,
} from "./TileWorldY";
import {
  DEFAULT_OCCLUSION_SCAN_RADIUS,
  resolveVerticalVisibleLevels,
} from "./VerticalLevelVisibility3D";
import { findFirstBlockingTileOnWorldLine } from "./WallRevealLos";
import {
  probeHoleLevelTransition,
  STAIR_LANDING_LOCAL_Z,
} from "./StairConfig3D";
import { playRespawnGlowAt, preloadRespawnGlowTextures } from "./VfxBillboardFactory";
import {
  createPropBillboard,
  isKnownPropId,
} from "./PropBillboardFactory";
import {
  computeStreamRadiiUnits,
  resolveQualityStreamConfig,
} from "./SliceQualityRuntime";
import { disposeAllPooledSpriteTexturesForScene } from "./SpriteTexturePool";
import type { SliceTileDefinition, MapEntity, SliceLevelData, SliceMapData } from "./SliceTileTypes";
import { resolveCharacterVisualProfile } from "./CharacterVisualProfile";
import { SaveSystem } from "../../core/systems/SaveSystem";
import { PropStreamSystem } from "./PropStreamSystem";
import { EnemyStreamSystem, type SliceEnemy, type EnemySpawnData } from "./EnemyStreamSystem";
import { DropStreamSystem, type SliceDroppedItem } from "./DropStreamSystem";
import { StreamOrchestrator } from "./StreamOrchestrator";
import { DoorSystem } from "./DoorSystem";
import { ChunkStreamSystem } from "./ChunkStreamSystem";
import { NavigationSystem } from "./NavigationSystem";
import type {
  GeometryWorkerRequest,
  GeometryWorkerResponse,
  GeometryGroupBuffer,
} from "../../workers/geometry.worker";

type SliceRuntime = {
  engine: Engine;
  scene: Scene;
  save: () => Promise<boolean>;
  whenWorldReady: () => Promise<void>;
  dispose: () => void;
};

type Slice3DLogSample = {
  ts: number;
  elapsedSec: number;
  currentLevel: string;
  player: {
    x: number;
    y: number;
    z: number;
    tileX: number;
    tileZ: number;
    chunkX: number;
    chunkZ: number;
  };
  perf: {
    fps: number;
    frameMs: number;
    drawCalls: number;
    activeMeshes: number;
    totalMeshes: number;
    totalTextures: number;
    totalVertices: number;
    jsHeapUsedMb?: number;
    jsHeapTotalMb?: number;
    heapDeltaMb?: number;
  };
  chunks: {
    loaded: number;
    loading: number;
    pendingCandidates: number;
    pendingUnloads: number;
    builtThisTick: number;
    unloadedThisTick: number;
  };
  enemies: {
    activeOnLevel: number;
    visibleOnLevel: number;
    aiActiveOnLevel: number;
    selectedEnemyUid: string | null;
  };
  items: {
    streamedDroppedItems: number;
    hasRealDroppedItems: boolean;
  };
  pathfinding: {
    requests: number;
    success: number;
    failed: number;
    errors: number;
    inFlight: number;
    avgMs: number;
    maxMs: number;
    lastMs: number;
    lastPathLen: number;
  };
};

type Slice3DLogEvent = {
  ts: number;
  elapsedSec: number;
  type: string;
  payload?: Record<string, unknown>;
};

type Slice3DSessionLog = {
  version: 1;
  mapName: string;
  startedAt: string;
  sessionId: string;
  samples: Slice3DLogSample[];
  events: Slice3DLogEvent[];
  counters: {
    samplesDropped: number;
    eventsDropped: number;
    exportCount: number;
  };
};

type Slice3DHotspot = {
  key: string;
  level: string;
  chunkX: number;
  chunkZ: number;
  samples: number;
  avgFrameMs: number;
  avgDrawCalls: number;
  avgActiveMeshes: number;
  avgVertices: number;
  maxHeapUsedMb: number;
  maxPathMs: number;
  score: number;
};

type Slice3DSummary = {
  sampleCount: number;
  eventCount: number;
  uptimeSec: number;
  frameMs: {
    p50: number;
    p95: number;
    p99: number;
  };
  pathMs: {
    p50: number;
    p95: number;
    p99: number;
  };
  heap: {
    currentMb?: number;
    slopeMbPerSec?: number;
    unloadRecoveryFailures: number;
  };
  chunk: {
    avgPendingCandidates: number;
    avgPendingUnloads: number;
  };
  leakRisk: {
    level: "low" | "medium" | "high";
    reasons: string[];
  };
  sessionHealthScore: number;
};

declare global {
  interface Window {
    __slice3dLogs?: {
      get: () => unknown;
      getSummary: () => unknown;
      getHotspots: (limit: number) => unknown;
      download: () => void;
      clear: () => void;
      mark: (label: string, extra?: Record<string, unknown>) => void;
      setEnabled: (value: boolean) => void;
      isEnabled: () => boolean;
      getLastFilePath: () => string | null;
      flushToFile: () => Promise<void>;
      storageKey: string;
    };
    __slice3dVerticalVisibility?: {
      currentLevel: string;
      visibleLevels: string[];
      occludedFromLevel: number | null;
      occlusionScanRadius: number;
      verticalStackRadiusTiles: number;
      firstPersonCeilingLevel: string | null;
      totalLevels: number;
      columnRadius: number;
      playerTile: { x: number; y: number };
      ts: number;
    };
    __slice3dChunkStreaming?: {
      playerChunk?: { x: number; y: number };
      loadedChunks?: number;
      loadingChunks?: number;
      builtThisTick?: number;
      drawRadiusChunks?: number;
      chunkBuildBudgetPerTick?: number;
      firstPersonLod?: boolean;
      pendingCandidates?: number;
      unloadedThisTick?: number;
      pendingUnloads?: number;
      visibleLevels?: string[];
      ts?: number;
    };
    __slice3dPerfDiagnostics?: Record<string, unknown>;
    __slice3dPerf?: Record<string, unknown>;
    __slice3dLogsData?: { latestSample: unknown; totalSamples: number; totalEvents: number; counters: unknown; summary: unknown; topHotspots: unknown };
  }
  interface Performance {
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    };
  }
}

type TopDownCameraPreset = "safe" | "cinematic";

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































function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
  const sceneInstrumentation = new SceneInstrumentation(scene);
  (sceneInstrumentation as unknown as { captureDrawCalls: boolean }).captureDrawCalls = true;
  scene.clearColor.set(0.67, 0.8, 0.96, 1);
  preloadRespawnGlowTextures(scene);
  const playerState = PlayerState.getInstance();
  playerState.setPerspectiveMode("3D");
  const audioManager = AudioManager.getInstance();
  const startingPosition = playerState.getPosition();
  const searchParams = new URLSearchParams(window.location.search);
  const sliceMapName =
    searchParams.get("map") ||
    searchParams.get("mapName") ||
    "debug_sandbox";
  /** Props / dropped loot sit on walkable surface (not actor foot clearance). */
  const WORLD_ANCHOR_REST_OFFSET = 0.012;
  // Eye line ~58% of hero body height — chest-level FP view (see HERO_FIRST_PERSON_EYE_BODY_RATIO).
  const FIRST_PERSON_EYE_ABOVE_FEET = getHeroFirstPersonEyeHeight();
  const HERO_BODY_HEIGHT = HERO_COLLISION_HEIGHT;
  // ── S12-T1/T4: Layer Semantics & Ownership (canonical, top-down is the product mode) ───────────
  // Layer conventions:
  //   -1 = underground / sewers (esgoto)
  //    0 = ground floor (main streets, dungeon floor)
  //   +1 = first upper floor / floating islands (cidade suspensa)
  //   +2 = rooftops / open sky structures
  // Ownership rules:
  //   - LevelRenderer (buildChunk) owns all 3D tile geometry for visible levels around currentLevel.
  //   - Chunks are rebuilt on level change to keep visual stack and currentLevel state synchronized.
  //   - Upper-level structures are faded by level-occlusion when the player is under them.
  //   - All map/tile decisions use top-down perspective as the canonical product view.
  // ────────────────────────────────────────────────────────────────────────────────────────────────
  const parseLevelNumber = (level: string) => Number.parseInt(level, 10) || 0;
  const levelToWorldY = (level: string | number) => {
    const levelNumber =
      typeof level === "number" ? level : parseLevelNumber(level);
    return levelNumber * LEVEL_HEIGHT;
  };
  let lastSideEffectLevel: string | null = null;
  const getCurrentLevel = (): string => {
    if (!mapDataCache?.levels) return playerState.getCurrentLevel();
    return inferLevelFromFootY(player.position.y, Object.keys(mapDataCache.levels), {
      levelToWorldY,
      parseLevelNumber,
      levelHeightUnits: LEVEL_HEIGHT,
      floorSurfaceY: WALK_SURFACE,
    });
  };

  /** Derive level from player Y for rendering/presentation — same as getCurrentLevel. */
  const getRenderLevel = (): string => getCurrentLevel();
  let activeTopDownCameraPreset: TopDownCameraPreset = "safe";

  const camera = new ArcRotateCamera(
    "slice-camera",
    Math.PI / 2, // top-down: alpha = +90° (north-facing, looking south) so +Z = screen-down = minimap south
    0.72,
    9,
    new Vector3(0, 1.5, 0),
    scene,
  );
  const applyTopDownCameraPreset = (preset: TopDownCameraPreset) => {
    activeTopDownCameraPreset = preset;
    if (preset === "safe") {
      // Safe preset: higher readability for combat/navigation.
      camera.beta = 0.72; // ~49° from ground
      camera.radius = 9;
      camera.fov = 0.92;
      camera.maxZ = 52;
      camera.lowerRadiusLimit = 9;
      camera.upperRadiusLimit = 9;
      camera.lowerBetaLimit = 0.72;
      camera.upperBetaLimit = 0.72;
    } else {
      // Cinematic preset: slightly steeper depth feel.
      camera.beta = 0.56; // ~58° from ground
      camera.radius = 11;
      camera.fov = 1.05;
      camera.maxZ = 58;
      camera.lowerRadiusLimit = 11;
      camera.upperRadiusLimit = 11;
      camera.lowerBetaLimit = 0.56;
      camera.upperBetaLimit = 0.56;
    }

    camera.lowerAlphaLimit = Math.PI / 2;
    camera.upperAlphaLimit = Math.PI / 2;
  };
  applyTopDownCameraPreset(activeTopDownCameraPreset);
  camera.wheelPrecision = 1000000;
  camera.panningSensibility = 0;
  camera.attachControl(canvas, true);

  const firstPersonCamera = new UniversalCamera(
    "slice-fp-camera",
    new Vector3(6, 1.55, 6),
    scene,
  );
  firstPersonCamera.minZ = 0.05;
  firstPersonCamera.maxZ = 120;
  firstPersonCamera.fov = FP_CAMERA_FOV;
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
    // Height ~= 2*radius keeps the capsule visually close to a sphere (yellow ball look).
    { radius: 0.42, height: 0.84, tessellation: 12 },
    scene,
  );
  const initLevelNumber = parseLevelNumber(playerState.getCurrentLevel());
  const savedPlayerY = searchParams.get("playerY");
  const initY = savedPlayerY !== null
    ? parseFloat(savedPlayerY)
    : levelToWorldY(initLevelNumber) + WALK_SURFACE;
  player.position = new Vector3(
    startingPosition.x !== 0 ? worldToSliceCoord(startingPosition.x) : 6,
    initY,
    startingPosition.y !== 0 ? worldToSliceCoord(startingPosition.y) : 6,
  );
  player.material = playerMaterial;

  // Hero billboard: visual profile (alpha = hero_default body + hair overlay).
  const heroSpriteMat = createHeroModularSpriteMaterial(
    scene,
    "slice-player",
    resolveCharacterVisualProfile(playerState),
  );

  const syncHeroVisualProfile = () => {
    const setter = (heroSpriteMat as HeroSpriteMaterial)._setVisualProfile;
    if (typeof setter === "function") {
      setter(resolveCharacterVisualProfile(playerState));
    }
  };

  playerState.on("equipmentChanged", syncHeroVisualProfile);
  playerState.on("heroSkinChanged", syncHeroVisualProfile);
  playerState.on("heroSkinUnlocked", syncHeroVisualProfile);
  let heroAnimState: HeroAnimState = "idle";
  let heroDirection: HeroBmsDirection = "south";
  let heroAnimLockedUntil = 0;
  const PLAYER_DEATH_SEQUENCE_MS = 2000;

  const setHeroAnimState = (state: HeroAnimState, lockMs = 0) => {
    heroAnimState = state;
    const setter = (heroSpriteMat as HeroSpriteMaterial)._setAnimState;
    if (typeof setter === "function") {
      setter(state);
    }
    if (lockMs > 0) {
      heroAnimLockedUntil = Date.now() + lockMs;
    }
  };

  const setHeroDirection = (direction: HeroBmsDirection) => {
    heroDirection = direction;
    const setter = (heroSpriteMat as HeroSpriteMaterial)._setDirection;
    if (typeof setter === "function") {
      setter(direction);
    }
  };

  const heroBillboard = MeshBuilder.CreatePlane(
    "slice-player-sprite",
    {
      width: HERO_BILLBOARD_LAYOUT.width,
      height: HERO_BILLBOARD_LAYOUT.height,
    },
    scene,
  );
  heroBillboard.material = heroSpriteMat;
  heroBillboard.parent = player;
  // Anchor feet to ground using measured feet row in generated PNGs.
  heroBillboard.position = new Vector3(0, HERO_BILLBOARD_LAYOUT.anchorY, 0);
  heroBillboard.billboardMode = Mesh.BILLBOARDMODE_Y;
  configureBillboardSpriteMesh(heroBillboard);
  heroBillboard.setEnabled(true);

  const heroAquaticTint = attachAquaticShaderTint(heroSpriteMat);
  let lastPlayerAquaticMode: AquaticSample["mode"] = "dry";

  const heroShadowMat = new StandardMaterial("slice-player-shadow-mat", scene);
  heroShadowMat.diffuseColor = Color3.Black();
  heroShadowMat.specularColor = Color3.Black();
  heroShadowMat.alpha = 0.32;
  heroShadowMat.disableLighting = true;

  const heroShadow = MeshBuilder.CreateDisc(
    "slice-player-shadow",
    { radius: 0.34, tessellation: 24 },
    scene,
  );
  heroShadow.material = heroShadowMat;
  heroShadow.position = new Vector3(
    player.position.x,
    levelToWorldY(initLevelNumber) + WALK_SURFACE + 0.01,
    player.position.z,
  );
  heroShadow.rotation.x = Math.PI / 2;
  heroShadow.isPickable = false;

  // Keep physics body hidden when sprite billboard is active.
  // Use 0 (not 0.01) to avoid alpha-sorting glitches; visibility is
  // toggled back if the sprite billboard ever fails to render.
  player.visibility = 0;
  player.isPickable = false;

  // Fallback yellow ball ("balls" theme) — guarantees the hero is always
  // visible even if the procedural sprite material fails to draw on this
  // hardware. Sits inside the capsule, slightly smaller, fully opaque.
  const heroBallMat = createMaterial(
    scene,
    "slice-player-ball",
    Color3.FromHexString("#f2d53c"),
  );
  const heroBall = MeshBuilder.CreateSphere(
    "slice-player-ball",
    { diameter: 0.62, segments: 14 },
    scene,
  );
  heroBall.material = heroBallMat;
  heroBall.parent = player;
  heroBall.position = new Vector3(0, 0, 0);
  heroBall.isPickable = false;
  heroBall.setEnabled(false);

  /** Hidden until map binary + spawn chunk + foot snap are ready (avoids limbo fall). */
  let worldBootstrapReady = false;
  let resolveWorldReady: (() => void) | null = null;
  const worldReadyPromise = new Promise<void>((resolve) => {
    resolveWorldReady = resolve;
  });

  const setPlayerAvatarVisible = (visible: boolean) => {
    player.setEnabled(visible);
    heroShadow.setEnabled(visible);
    if (!visible) {
      heroBillboard.setEnabled(false);
      heroBall.setEnabled(false);
      return;
    }
    heroBillboard.setEnabled(!isFirstPerson);
  };
  setPlayerAvatarVisible(false);
  (heroSpriteMat as HeroSpriteMaterial)._onReady = () => {
    if (worldBootstrapReady) {
      heroBall.setEnabled(false);
    }
  };

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

  const getDeterministicRotation = (id: string): number => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (Math.abs(hash) % 360) * (Math.PI / 180);
  };

  type ActiveSlash = {
    mesh: Mesh;
    material: StandardMaterial;
    texture: DynamicTexture;
    elapsed: number;
    duration: number;
    startScale: number;
    endScale: number;
  };
  const activeSlashtrails: ActiveSlash[] = [];

  const getWeaponSlashColor = (weaponId: string | null): Color3 => {
    if (!weaponId) return Color3.FromHexString("#ffffff");
    const wId = weaponId.toLowerCase();
    if (wId.includes("dragon") || wId.includes("fire") || wId.includes("light_torch")) {
      return Color3.FromHexString("#ff6b35");
    }
    if (wId.includes("poison") || wId.includes("venom") || wId.includes("decay")) {
      return Color3.FromHexString("#06d6a0");
    }
    if (wId.includes("magic") || wId.includes("rune") || wId.includes("energy")) {
      return Color3.FromHexString("#118ab2");
    }
    return Color3.FromHexString("#ffffff");
  };

  const triggerPlayerAttackSlashEffect = (enemy: SliceEnemy) => {
    const delta = enemy.worldPos.subtract(player.position);
    delta.y = 0;
    if (delta.lengthSquared() < 0.001) {
      return;
    }
    const dir = delta.normalize();

    const slashPos = player.position.clone();
    slashPos.y = player.position.y + 0.05;
    slashPos.addInPlace(dir.scale(0.5));

    const slashMesh = MeshBuilder.CreatePlane(
      `player-slash-trail-${performance.now()}`,
      { width: 0.8, height: 0.4 },
      scene,
    );
    slashMesh.position.copyFrom(slashPos);
    slashMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;

    const angle = Math.atan2(dir.x, dir.z);
    slashMesh.rotation.z = -angle - Math.PI / 2;

    const canvasWidth = 128;
    const canvasHeight = 64;
    const dynTex = new DynamicTexture(
      `slash-trail-tex-${performance.now()}`,
      { width: canvasWidth, height: canvasHeight },
      scene,
      false
    );
    const ctx = dynTex.getContext();
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const weaponId = playerState.equippedWeaponId;
    const slashColor = getWeaponSlashColor(weaponId);

    const grad = ctx.createLinearGradient(0, 0, canvasWidth, 0);
    grad.addColorStop(0, "rgba(255, 255, 255, 0)");
    
    const r = Math.round(slashColor.r * 255);
    const g = Math.round(slashColor.g * 255);
    const b = Math.round(slashColor.b * 255);
    grad.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.8)`);
    grad.addColorStop(0.5, "rgba(255, 255, 255, 1.0)");
    grad.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.8)`);
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(10, canvasHeight - 10);
    ctx.quadraticCurveTo(canvasWidth / 2, 8, canvasWidth - 10, canvasHeight - 10);
    ctx.quadraticCurveTo(canvasWidth / 2, 22, 10, canvasHeight - 10);
    ctx.closePath();
    ctx.fill();
    dynTex.update();

    const slashMat = new StandardMaterial(`slash-trail-mat-${performance.now()}`, scene);
    slashMat.diffuseTexture = dynTex;
    slashMat.opacityTexture = dynTex;
    slashMat.useAlphaFromDiffuseTexture = true;
    slashMat.backFaceCulling = false;
    slashMat.disableLighting = true;
    slashMat.emissiveColor = Color3.White();

    slashMesh.material = slashMat;
    slashMesh.isPickable = false;

    activeSlashtrails.push({
      mesh: slashMesh,
      material: slashMat,
      texture: dynTex,
      elapsed: 0,
      duration: 250,
      startScale: 0.8,
      endScale: 1.1,
    });
  };
  let selectedEnemyUid: string | null = null;
  let lastFocusedCombatHealthSyncAt = 0;
  let activeRuneSlotIndex = 0;
  // S11-T1: rune targeting mode (Opção A parity)
  let runeTargetingMode = false;
  let targetingRuneId: string | null = null;
  let mapDataCache: SliceMapData | null = null;
  let worldMapReady = false;
  const recentPlayerDamagePopups = new Map<
    string,
    { at: number; value: number }
  >();

  let enemyHighlightPulseT = 0; // accumulator for sine pulse (seconds)

  const mapRoot = new TransformNode("slice-map-root", scene);
  const waterEffectSystem = new WaterEffectSystem(scene, mapRoot, WALK_SURFACE);
  const wallRevealSystem = new InteractableWallRevealSystem(scene, mapRoot, {
    revealRadiusTiles: 20,
  });
  const propSystem = new PropStreamSystem({
    scene,
    mapRoot,
    getPlayerPosition: () => player.position,
    getCurrentLevel: () => getCurrentLevel(),
    isFirstPerson: () => isFirstPerson,
    levelToWorldY: (level: string | number) => levelToWorldY(level),
    resolveWorldAnchorY: (worldX: number, worldZ: number, level: string, restOffset?: number) =>
      resolveWorldAnchorY(worldX, worldZ, level, restOffset),
    loadMapDataAsync: () => loadMapData(),
    onNavigationRebuild: (level: string) => navigationSystem.rebuildWindow(level),
  });
  // Chunk streaming constants (visual profile depends on camera mode; gameplay state remains global)
  const CHUNK_SIZE = 16; // tiles per chunk side
  const CHUNK_UNLOAD_BUDGET_PER_TICK = 8; // max chunks to unload each update tick
  const NAV_WINDOW_RADIUS = 40;
  const ENEMY_VISIBILITY_RADIUS_UNITS = 26;
  const ENEMY_AI_RADIUS_UNITS = 18;
  const WALL_REVEAL_TARGET_RADIUS_UNITS = 22;
  let qualityStreamConfig = resolveQualityStreamConfig(
    playerState.getDisplaySettings().qualityPreset,
  );
  let streamRadiiUnits = computeStreamRadiiUnits(CHUNK_SIZE, qualityStreamConfig);
  let topDownDrawRadiusChunks = qualityStreamConfig.topDownDrawRadiusChunks;
  let firstPersonDrawRadiusChunks =
    qualityStreamConfig.firstPersonDrawRadiusChunks;
  let topDownChunkBuildBudgetPerTick =
    qualityStreamConfig.topDownChunkBuildBudgetPerTick;
  let firstPersonChunkBuildBudgetPerTick =
    qualityStreamConfig.firstPersonChunkBuildBudgetPerTick;
  propSystem.propStreamRadiusUnits = streamRadiiUnits.propStreamRadiusUnits;
  propSystem.propStreamRadiusUnitsFirstPerson = streamRadiiUnits.propStreamRadiusUnitsFirstPerson;
  propSystem.propDespawnRadiusUnits = streamRadiiUnits.propDespawnRadiusUnits;
  const enemySystem = new EnemyStreamSystem({
    scene,
    mapRoot,
    getPlayerPosition: () => player.position,
    getCurrentLevel: () => getCurrentLevel(),
    levelToWorldY: (level: string | number) => levelToWorldY(level),
    worldToSliceCoord: (value: number) => worldToSliceCoord(value),
    applyActorAquaticY: (worldPos: Vector3, level: string) => applyActorAquaticY(worldPos, level),
    loadMapDataAsync: () => loadMapData(),
    onSelectedEnemyChanged: (uid: string | null) => {
      if (uid === null && selectedEnemyUid !== null) {
        const prev = enemies.get(selectedEnemyUid);
        if (prev) {
          restoreEnemyTargetVisual(prev.meshRoot);
        }
        playerState.emit("combatFocusChanged", { uid: null });
      }
    },
    onEnemyDeadPersistenceClear: (level: string, spawnKey: string) => {
      const unmark = playerState.unmarkEnemy3dDead;
      if (typeof unmark === "function") {
        unmark.call(playerState, level, spawnKey);
        return;
      }
      if (!playerState.isEnemy3dDead(level, spawnKey)) {
        return;
      }
      const snapshot = playerState.getDeadEnemies3dSnapshot();
      const remaining = snapshot[level]?.filter((key: string) => key !== spawnKey) ?? [];
      if (remaining.length > 0) {
        snapshot[level] = remaining;
      } else {
        delete snapshot[level];
      }
      playerState.loadDeadEnemies3d(snapshot);
    },
    isEnemy3dDead: (level: string, spawnKey: string) =>
      playerState.isEnemy3dDead(level, spawnKey),
    getSelectedEnemyUid: () => selectedEnemyUid,
    setSelectedEnemyUid: (uid: string | null) => { selectedEnemyUid = uid; },
  });
  const enemies = enemySystem.enemies;
  const ENEMY_RESPAWN_MS = enemySystem.ENEMY_RESPAWN_MS;
  const pendingEnemyRespawns = enemySystem.pendingEnemyRespawns;
  const enemySpawnCatalog = enemySystem.spawnCatalog;
  enemySystem.enemyStreamRadiusUnits = streamRadiiUnits.enemyStreamRadiusUnits;
  enemySystem.enemyDespawnRadiusUnits = streamRadiiUnits.enemyDespawnRadiusUnits;
  const seededLevels = new Set<string>();
  const dropSystem = new DropStreamSystem({
    scene,
    mapRoot,
    getPlayerPosition: () => ({ x: player.position.x, z: player.position.z }),
    getCurrentLevel: () => getCurrentLevel(),
    levelToWorldY: (level: string | number) => levelToWorldY(level),
    worldToSliceCoord: (value: number) => worldToSliceCoord(value),
    resolveWorldAnchorY: (ix: number, iz: number, level: string, restOffset: number) => resolveWorldAnchorY(ix, iz, level, restOffset),
    getDeterministicRotation: (id: string) => getDeterministicRotation(id),
    loadMapDataAsync: () => loadMapData(),
    getPersistentDroppedItems: (level: string) => playerState.getPersistentDroppedItems(level),
    addPersistentDroppedItem: (level: string, item: any) => playerState.addPersistentDroppedItem(level, item),
    removePersistentDroppedItem: (level: string, uid: string) => playerState.removePersistentDroppedItem(level, uid),
    hasVisitedLevel: (level: string) => playerState.hasVisitedLevel(level),
    markLevelVisited: (level: string) => playerState.markLevelVisited(level),
    seededLevels,
    addItemToContainer: (containerUid: string, itemId: string, count: number) =>
      playerState.addItemToContainer(containerUid, itemId, count),
    logWarn: (msg: string) => console.warn(msg),
  });
  dropSystem.droppedItemStreamRadiusUnits = streamRadiiUnits.droppedItemStreamRadiusUnits;
  const doorSystem = new DoorSystem({
    scene,
    getCurrentLevel: () => getCurrentLevel(),
    levelToWorldY: (level: string | number) => levelToWorldY(level),
    parseLevelNumber: (level: string) => parseLevelNumber(level),
    getMapTileAt: (level: string, tx: number, tz: number) => getMapTileAt(level, tx, tz),
    isStaticTileBlocking: (symbol: string | null, tileDef?: any) => isStaticTileBlocking(symbol, tileDef),
    loadMapDataAsync: () => loadMapData(),
    safeTileColor: (hex: string | undefined, fallback: string) => safeTileColor(hex, fallback),
    rebuildNavigationGrid: (level: string) => navigationSystem.rebuildGrid(level),
    resetLevelEnemyPaths: (level: string) => {
      enemies.forEach((enemy: any) => {
        if (enemy.level !== level) return;
        enemy.currentPath = [];
        enemy.currentPathIndex = 0;
        enemy.lastPathAt = 0;
      });
    },
    getDoorState: (uuid: string) => playerState.getDoorState(uuid),
    setDoorOpen: (uuid: string, open: boolean) => playerState.setDoorOpen(uuid, open),
    seedDoorState: (uuid: string, state: any) => playerState.seedDoorState(uuid, state),
    emitMessage: (msg: string) => playerState.emit("message", msg),
    emitUiNotification: (notification: { type: string; message: string }) => playerState.emit("uiNotification", notification),
    getPlayerPosition: () => ({ x: player.position.x, z: player.position.z }),
  });
  const orchestrator = new StreamOrchestrator(
    propSystem,
    enemySystem,
    dropSystem,
    {
      getCurrentLevel: () => getCurrentLevel(),
      getLevelKeys: () => Object.keys((mapDataCache as SliceMapData | null)?.levels ?? {}),
      applyActiveLevelChange: (level: string, transition?: any, options?: { natural?: boolean }) =>
        applyActiveLevelChange(level, transition, options),
      ensureMapLevelReady: (level: string) => ensureMapLevelReady(level),
      ensureLevelDoorsSeeded: (level: string) => doorSystem.ensureLevelSeeded(level),
      setSelectedEnemy: (uid: string | null) => setSelectedEnemy(uid),
      pushLogEvent: (event: string, data: any) => pushLogEvent(event, data),
    },
  );

  const applyQualityStreamConfig = (
    preset: ReturnType<typeof playerState.getDisplaySettings>["qualityPreset"],
  ) => {
    qualityStreamConfig = resolveQualityStreamConfig(preset);
    streamRadiiUnits = computeStreamRadiiUnits(CHUNK_SIZE, qualityStreamConfig);
    topDownDrawRadiusChunks = qualityStreamConfig.topDownDrawRadiusChunks;
    firstPersonDrawRadiusChunks =
      qualityStreamConfig.firstPersonDrawRadiusChunks;
    topDownChunkBuildBudgetPerTick =
      qualityStreamConfig.topDownChunkBuildBudgetPerTick;
    firstPersonChunkBuildBudgetPerTick =
      qualityStreamConfig.firstPersonChunkBuildBudgetPerTick;
    orchestrator.setStreamRadii(streamRadiiUnits);
  };
  let isFirstPerson = false;
  let fpCombatCameraState = createFirstPersonCombatCameraState();
  let gameplayPaused = playerState.isGameplayPaused();
  let fpCaptureSuspendedForMenu = false;
  let topDownCaptureSuspendedForMenu = false;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const geometryWorker: Worker = new Worker(
    new URL("../../workers/geometry.worker.ts", import.meta.url),
  );

  // Tile material cache — distinct materials are bounded by `kind × baseHex`,
  // which for the current tile atlas resolves to at most ~30 entries. We keep
  // an LRU array for ordering (used by clear-on-map-change) but DO NOT evict
  // while the runtime is alive: evicting would dispose() a material that may
  // still be assigned to chunk meshes built earlier, leaving those meshes
  // rendered with an invalid/black material until the chunk is unloaded.
  const TILE_MATERIAL_CACHE_LIMIT = 256;
  const tileMaterials = new Map<string, StandardMaterial>();
  const tileMaterialLRU: string[] = []; // insertion-order keys (legacy; not evicted)
  const levelBinaryCache = new Map<string, Uint8Array>();
  const meshLevelByMesh = new Map<Mesh, string>();
  const levelMeshes = new Map<string, Set<Mesh>>();

  // Wall tile index: "${levelKey}::${tx}_${tz}" → Mesh (for per-tile wall occlusion)
  const wallTileIndex = new Map<string, Mesh>();
  // Previously hidden wall meshes — must be restored before next frame's check
  const hiddenWallMeshes = new Set<Mesh>();
  // Cached occlusion result from findUpperOcclusionLevel (set in syncVerticalLevelVisibility)
  let occlusionStartLevel: number | null = null;

  const LOG_SAMPLE_INTERVAL = 1.0;
  const LOG_PERSIST_INTERVAL = 5.0;
  const LOG_MAX_SAMPLES = 7200;
  const LOG_MAX_EVENTS = 3000;
  const LOG_SLOW_PATH_MS = 100;
  const LOG_STORAGE_KEY = "slice3d.runtime.logs.latest";
  const LOG_FRAME_WINDOW_MAX = 600;
  const LOG_PATH_WINDOW_MAX = 600;
  const LOG_HEAP_WINDOW_SECONDS = 300;
  const LOG_UNLOAD_RECOVERY_GRACE_SECONDS = 25;
  const LOG_FILE_FLUSH_INTERVAL = 10;
  let telemetryLogTimer = 0;
  let telemetryPersistTimer = 0;
  let telemetryFileFlushTimer = 0;
  let telemetryEnabled = true;
  let telemetryFileFlushInFlight = false;
  let lastRuntimeLogFilePath: string | null = null;
  let previousHeapUsedMb: number | undefined;
  // drawCalls is cumulative in Babylon.js — track delta to get per-frame count.
  let prevDrawCallsTotal = 0;
  const runtimeStartedAt = Date.now();
  const frameMsWindow: number[] = [];
  const pathMsWindow: number[] = [];
  const heapHistory: Array<{ elapsedSec: number; usedMb: number }> = [];
  const chunkHotspots = new Map<
    string,
    {
      level: string;
      chunkX: number;
      chunkZ: number;
      samples: number;
      frameMsAcc: number;
      drawCallsAcc: number;
      activeMeshesAcc: number;
      verticesAcc: number;
      maxHeapUsedMb: number;
      maxPathMs: number;
    }
  >();
  const unloadCheckpoints: Array<{
    atSec: number;
    heapMb: number;
    resolved: boolean;
    succeeded: boolean;
  }> = [];
  let chunkUnloadRecoveryFailures = 0;
  const pathMetrics = {
    requests: 0,
    success: 0,
    failed: 0,
    errors: 0,
    totalMs: 0,
    maxMs: 0,
    lastMs: 0,
    lastPathLen: 0,
    inFlight: 0,
  };

  const runtimeLog: Slice3DSessionLog = {
    version: 1,
    mapName: sliceMapName,
    startedAt: new Date(runtimeStartedAt).toISOString(),
    sessionId: `${runtimeStartedAt}-${Math.random().toString(36).slice(2, 8)}`,
    samples: [],
    events: [],
    counters: {
      samplesDropped: 0,
      eventsDropped: 0,
      exportCount: 0,
    },
  };

  const getElapsedSec = () =>
    Math.round(((Date.now() - runtimeStartedAt) / 1000) * 100) / 100;

  const pushBounded = (arr: number[], value: number, maxSize: number) => {
    arr.push(value);
    if (arr.length > maxSize) {
      arr.shift();
    }
  };

  const getPercentile = (arr: number[], percentile: number): number => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const rank = (percentile / 100) * (sorted.length - 1);
    const low = Math.floor(rank);
    const high = Math.ceil(rank);
    if (low === high) {
      return sorted[low];
    }
    const weight = rank - low;
    return sorted[low] * (1 - weight) + sorted[high] * weight;
  };

  const clampScore = (value: number, min = 0, max = 100) =>
    Math.max(min, Math.min(max, value));

  const getHeapSlopeMbPerSec = () => {
    if (heapHistory.length < 6) {
      return undefined;
    }

    const points = heapHistory;
    const n = points.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    points.forEach((point) => {
      const x = point.elapsedSec;
      const y = point.usedMb;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const denominator = n * sumX2 - sumX * sumX;
    if (Math.abs(denominator) < 1e-6) {
      return undefined;
    }

    return (n * sumXY - sumX * sumY) / denominator;
  };

  const buildHotspots = (limit = 10): Slice3DHotspot[] => {
    const list: Slice3DHotspot[] = [];

    chunkHotspots.forEach((entry, key) => {
      if (entry.samples <= 0) {
        return;
      }

      const avgFrameMs = entry.frameMsAcc / entry.samples;
      const avgDrawCalls = entry.drawCallsAcc / entry.samples;
      const avgActiveMeshes = entry.activeMeshesAcc / entry.samples;
      const avgVertices = entry.verticesAcc / entry.samples;
      const score =
        avgFrameMs * 2.3 +
        avgDrawCalls * 0.08 +
        avgActiveMeshes * 0.06 +
        avgVertices / 50000 +
        entry.maxHeapUsedMb * 0.12 +
        entry.maxPathMs * 0.25;

      list.push({
        key,
        level: entry.level,
        chunkX: entry.chunkX,
        chunkZ: entry.chunkZ,
        samples: entry.samples,
        avgFrameMs: Math.round(avgFrameMs * 100) / 100,
        avgDrawCalls: Math.round(avgDrawCalls * 100) / 100,
        avgActiveMeshes: Math.round(avgActiveMeshes * 100) / 100,
        avgVertices: Math.round(avgVertices * 100) / 100,
        maxHeapUsedMb: Math.round(entry.maxHeapUsedMb * 100) / 100,
        maxPathMs: Math.round(entry.maxPathMs * 100) / 100,
        score: Math.round(score * 100) / 100,
      });
    });

    return list.sort((a, b) => b.score - a.score).slice(0, limit);
  };

  const buildSummary = (): Slice3DSummary => {
    const frameP50 = getPercentile(frameMsWindow, 50);
    const frameP95 = getPercentile(frameMsWindow, 95);
    const frameP99 = getPercentile(frameMsWindow, 99);
    const pathP50 = getPercentile(pathMsWindow, 50);
    const pathP95 = getPercentile(pathMsWindow, 95);
    const pathP99 = getPercentile(pathMsWindow, 99);
    const heapSlope = getHeapSlopeMbPerSec();
    const currentHeap = heapHistory.length
      ? heapHistory[heapHistory.length - 1].usedMb
      : undefined;

    const recentSamples = runtimeLog.samples.slice(-60);
    const avgPendingCandidates = recentSamples.length
      ? recentSamples.reduce((acc, s) => acc + s.chunks.pendingCandidates, 0) /
        recentSamples.length
      : 0;
    const avgPendingUnloads = recentSamples.length
      ? recentSamples.reduce((acc, s) => acc + s.chunks.pendingUnloads, 0) /
        recentSamples.length
      : 0;

    const leakReasons: string[] = [];
    if (heapSlope !== undefined && heapSlope > 0.03) {
      leakReasons.push(`heap slope positive (${heapSlope.toFixed(3)} MB/s)`);
    }
    if (chunkUnloadRecoveryFailures >= 2) {
      leakReasons.push(
        `chunk unload recovery failed ${chunkUnloadRecoveryFailures}x`,
      );
    }

    let leakRisk: "low" | "medium" | "high" = "low";
    if (leakReasons.length >= 2) {
      leakRisk = "high";
    } else if (leakReasons.length === 1) {
      leakRisk = "medium";
    }

    const frameScore = clampScore(100 - (frameP95 - 16.7) * 3.2);
    const stabilityScore = clampScore(
      100 - Math.max(0, frameP99 - frameP50) * 2.1,
    );
    const pathScore = clampScore(100 - Math.max(0, pathP95 - 25) * 1.8);
    const backlogScore = clampScore(
      100 - avgPendingCandidates * 2.2 - avgPendingUnloads * 1.2,
    );
    const leakPenalty =
      leakRisk === "high" ? 30 : leakRisk === "medium" ? 15 : 0;

    const sessionHealthScore = clampScore(
      frameScore * 0.35 +
        stabilityScore * 0.2 +
        pathScore * 0.25 +
        backlogScore * 0.2 -
        leakPenalty,
    );

    return {
      sampleCount: runtimeLog.samples.length,
      eventCount: runtimeLog.events.length,
      uptimeSec: Math.round(getElapsedSec() * 100) / 100,
      frameMs: {
        p50: Math.round(frameP50 * 100) / 100,
        p95: Math.round(frameP95 * 100) / 100,
        p99: Math.round(frameP99 * 100) / 100,
      },
      pathMs: {
        p50: Math.round(pathP50 * 100) / 100,
        p95: Math.round(pathP95 * 100) / 100,
        p99: Math.round(pathP99 * 100) / 100,
      },
      heap: {
        currentMb: currentHeap,
        slopeMbPerSec:
          heapSlope !== undefined
            ? Math.round(heapSlope * 10000) / 10000
            : undefined,
        unloadRecoveryFailures: chunkUnloadRecoveryFailures,
      },
      chunk: {
        avgPendingCandidates: Math.round(avgPendingCandidates * 100) / 100,
        avgPendingUnloads: Math.round(avgPendingUnloads * 100) / 100,
      },
      leakRisk: {
        level: leakRisk,
        reasons: leakReasons,
      },
      sessionHealthScore: Math.round(sessionHealthScore * 100) / 100,
    };
  };

  const pushLogEvent = (type: string, payload?: Record<string, unknown>) => {
    if (!telemetryEnabled) return;
    if (runtimeLog.events.length >= LOG_MAX_EVENTS) {
      runtimeLog.events.shift();
      runtimeLog.counters.eventsDropped += 1;
    }
    runtimeLog.events.push({
      ts: Date.now(),
      elapsedSec: getElapsedSec(),
      type,
      payload,
    });
  };

  const persistRuntimeLogs = () => {
    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(runtimeLog));
    } catch {
      // Ignore storage errors (quota/private mode); in-memory logs remain available.
    }
  };

  const exportRuntimeLogs = () => {
    runtimeLog.counters.exportCount += 1;
    const summary = buildSummary();
    const hotspots = buildHotspots(20);
    return {
      ...runtimeLog,
      exportedAt: new Date().toISOString(),
      runtime: {
        currentLevel: getCurrentLevel(),
        isFirstPerson,
      },
      summary,
      hotspots,
    };
  };

  const flushRuntimeLogsToFile = async (force = false) => {
    const electronAPI = window.electronAPI;
    if (!electronAPI?.writeRuntimeLog) {
      return;
    }
    if (!force && telemetryFileFlushInFlight) {
      return;
    }

    telemetryFileFlushInFlight = true;
    try {
      const result = await electronAPI.writeRuntimeLog(exportRuntimeLogs());
      if (result?.success && result.path) {
        if (lastRuntimeLogFilePath !== result.path) {
          pushLogEvent("log.file-path", { path: result.path });
        }
        lastRuntimeLogFilePath = result.path;
      } else if (result?.error) {
        pushLogEvent("log.file-write-error", { error: result.error });
      }
    } catch (error) {
      pushLogEvent("log.file-write-error", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      telemetryFileFlushInFlight = false;
    }
  };

  const downloadRuntimeLogs = () => {
    const payload = JSON.stringify(exportRuntimeLogs(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `slice3d-runtime-log-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    pushLogEvent("log.download");
  };

  window.__slice3dLogs = {
    get: () => exportRuntimeLogs(),
    getSummary: () => buildSummary(),
    getHotspots: (limit = 10) =>
      buildHotspots(Math.max(1, Number(limit) || 10)),
    download: () => downloadRuntimeLogs(),
    clear: () => {
      runtimeLog.samples = [];
      runtimeLog.events = [];
      runtimeLog.counters.samplesDropped = 0;
      runtimeLog.counters.eventsDropped = 0;
      previousHeapUsedMb = undefined;
      frameMsWindow.length = 0;
      pathMsWindow.length = 0;
      heapHistory.length = 0;
      chunkHotspots.clear();
      unloadCheckpoints.length = 0;
      chunkUnloadRecoveryFailures = 0;
      pushLogEvent("log.clear");
      persistRuntimeLogs();
    },
    mark: (label: string, extra?: Record<string, unknown>) => {
      pushLogEvent("user.mark", {
        label,
        ...(extra || {}),
      });
    },
    setEnabled: (value: boolean) => {
      telemetryEnabled = !!value;
      pushLogEvent("log.enabled", { value: telemetryEnabled });
    },
    isEnabled: () => telemetryEnabled,
    getLastFilePath: () => lastRuntimeLogFilePath,
    flushToFile: () => flushRuntimeLogsToFile(true),
    storageKey: LOG_STORAGE_KEY,
  };

  pushLogEvent("session.start", {
    map: sliceMapName,
    level: getCurrentLevel(),
  });

  let mapMinX = 0;
  let mapMaxX = 24;
  let mapMinZ = 0;
  let mapMaxZ = 24;
  let currentMapWidth = 24;
  let currentMapHeight = 24;

  const pathfindingManager = PathfindingManager.getInstance();
  const navigationSystem = new NavigationSystem({
    getCurrentLevel,
    getPlayerPosition: () => ({ x: player.position.x, z: player.position.z }),
    getMapData: () => mapDataCache,
    isTileBlocked: (tx, ty) => isTileBlockedForGameplay(tx, ty),
    onGridUpdate: (grid, size, origin) => {
      pathfindingManager.updateGrid(grid);
      projectileGridContext.grid = grid;
      projectileGridContext.gridSize = size;
      projectileGridContext.gridOrigin = origin;
    },
    NAV_WINDOW_RADIUS,
  });

  const projectileGridContext: Projectile3DGridContext = {
    grid: navigationSystem.grid,
    gridSize: navigationSystem.gridSize,
    gridOrigin: navigationSystem.gridOrigin,
    worldToGrid,
  };
  const projectileSystem = new Projectile3DSystem(scene, projectileGridContext);

  const isTileBlockedForGameplay = (tileX: number, tileY: number): boolean => {
    const mapData = mapDataCache;
    if (!mapData?.width || !mapData?.height) {
      return false;
    }
    if (
      tileX < 0 ||
      tileY < 0 ||
      tileX >= mapData.width ||
      tileY >= mapData.height
    ) {
      return true;
    }

    const symbol = getMapTileAt(getCurrentLevel(), tileX, tileY);
    const tileDef = symbol ? mapData.tileDefinitions?.[symbol] : undefined;
    if (
      isBlockingTile(symbol, tileDef, {
        level: getCurrentLevel(),
        tileX,
        tileY,
      })
    ) {
      return true;
    }
    return propSystem.isCollidableTile(getCurrentLevel(), tileX, tileY);
  };

  projectileGridContext.isTileBlocked = (tileX, tileY) =>
    isTileBlockedForGameplay(tileX, tileY);

  const hasLineOfSight = (from: Vector3, to: Vector3): boolean => {
    return (
      findFirstBlockingTileOnWorldLine(
        from.x,
        from.z,
        to.x,
        to.z,
        isTileBlockedForGameplay,
        { skipStart: true },
      ) === null
    );
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
    if (tileId.includes("sewer")) return "sewer";
    if (tileId.includes("roof")) return "roof";
    // Specific stone/cave/dungeon ids must be checked BEFORE the generic
    // "floor" pattern, otherwise "dungeon-floor" / "cave-floor" /
    // "stone-floor" all collapse into the wood material.
    if (
      tileId.includes("cob") ||
      tileId.includes("stone") ||
      tileId.includes("pave") ||
      tileId.includes("plaza") ||
      tileId.includes("dungeon") ||
      tileId.includes("cave")
    ) {
      return "cobblestone";
    }
    if (tileId.includes("grass") || tileId.includes("park")) return "grass";
    if (tileId.includes("water")) return "water";
    if (tileId.includes("wood") || tileId.includes("floor")) return "wood";
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
      stones.forEach(([sx, sy, width, height, tone]) => {
        ctx.fillStyle = shadeColor(baseColor, tone as number);
        ctx.fillRect(
          sx as number,
          sy as number,
          width as number,
          height as number,
        );
        ctx.strokeStyle = shadeColor(baseColor, 0.45);
        ctx.lineWidth = 2;
        ctx.strokeRect(
          sx as number,
          sy as number,
          width as number,
          height as number,
        );
      });
    } else if (kind === "wet-cobble") {
      const stones = [
        [4, 4, 22, 18, 0.62],
        [30, 6, 24, 16, 0.48],
        [6, 30, 18, 24, 0.52],
        [30, 32, 26, 20, 0.58],
      ];
      stones.forEach(([sx, sy, width, height, tone]) => {
        ctx.fillStyle = shadeColor(baseColor, tone as number);
        ctx.fillRect(
          sx as number,
          sy as number,
          width as number,
          height as number,
        );
      });
      ctx.fillStyle = "rgba(120,180,220,0.22)";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(10, 8, 20, 3);
      ctx.fillRect(36, 28, 14, 2);
    } else if (kind === "roof") {
      // Draw overlapping roof-tile rows (like terracotta/ceramic tiles).
      // Each "row" is a horizontal band; within each row, tiles are staggered.
      const tileW = 20;
      const tileH = 14;
      const overlap = 4; // how many px each tile overlaps the row below
      for (let row = 0; row * (tileH - overlap) < size + tileH; row++) {
        const rowY = row * (tileH - overlap);
        const offsetX = (row % 2) * (tileW / 2); // stagger every other row
        for (let col = -1; col * tileW < size + tileW; col++) {
          const tx = col * tileW + offsetX;
          // tile body — slightly lighter than base
          ctx.fillStyle = shadeColor(baseColor, 0.9 + ((row + col) % 3) * 0.07);
          ctx.fillRect(tx + 1, rowY + 1, tileW - 2, tileH - 1);
          // bottom-lip highlight (shadow line at bottom edge of tile)
          ctx.fillStyle = shadeColor(baseColor, 0.55);
          ctx.fillRect(tx + 1, rowY + tileH - 2, tileW - 2, 2);
          // top-edge subtle highlight
          ctx.fillStyle = shadeColor(baseColor, 1.18);
          ctx.fillRect(tx + 1, rowY + 1, tileW - 2, 2);
          // grout lines between tiles
          ctx.fillStyle = shadeColor(baseColor, 0.48);
          ctx.fillRect(tx, rowY, 1, tileH);
        }
      }
      // Overall border darkening to suggest the slab edge
      ctx.fillStyle = shadeColor(baseColor, 0.55);
      ctx.fillRect(0, 0, size, 2);
      ctx.fillRect(0, size - 2, size, 2);
      ctx.fillRect(0, 0, 2, size);
      ctx.fillRect(size - 2, 0, 2, size);
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
    } else if (kind === "water") {
      ctx.fillStyle = shadeColor(baseColor, 0.88);
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1.5;
      for (let wave = 0; wave < 3; wave += 1) {
        const y = 12 + wave * 16;
        ctx.beginPath();
        ctx.moveTo(4, y);
        ctx.quadraticCurveTo(16, y + 3, 28, y);
        ctx.quadraticCurveTo(40, y - 3, 60, y);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(8, 6, 14, 4);
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
    material.backFaceCulling = false;
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
      // Bump to most-recently-used position
      const idx = tileMaterialLRU.indexOf(materialKey);
      if (idx !== -1) tileMaterialLRU.splice(idx, 1);
      tileMaterialLRU.push(materialKey);
      return existing;
    }

    // Evict oldest entry only if we somehow blow past the (generous) limit.
    // We do NOT dispose() the material here — chunk meshes built in earlier
    // frames still reference it, and disposing causes them to render with an
    // invalid/black material. Remove from the cache map only; GC reclaims it
    // once all referencing meshes are disposed by clearChunk().
    if (tileMaterials.size >= TILE_MATERIAL_CACHE_LIMIT) {
      const oldest = tileMaterialLRU.shift();
      if (oldest) {
        tileMaterials.delete(oldest);
      }
    }

    const material = createProceduralTileMaterial(
      `slice-tile-${materialKey.replace(/[^a-z0-9:]/gi, "-")}`,
      kind,
      safeTileColor(baseHex, fallbackHexColor),
    );
    tileMaterials.set(materialKey, material);
    tileMaterialLRU.push(materialKey);
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
        console.warn(`[3D Slice] Level binary fetch failed for ${level} (${response.status})`);
        return null;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      levelBinaryCache.set(level, bytes);
      return bytes;
    } catch (error) {
      console.warn(`[3D Slice] Level binary fetch error for ${level}`, error);
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

  const getAquaticSampleAt = (
    worldX: number,
    worldZ: number,
    level: string,
  ): AquaticSample =>
    sampleAquaticAtWorldFootprint(
      worldX,
      worldZ,
      level,
      getMapTileAt,
      (symbol) =>
        symbol ? mapDataCache?.tileDefinitions?.[symbol] : undefined,
    );

  const collisionWorld = new CollisionWorld(
    levelToWorldY,
    getMapTileAt,
    (symbol) => symbol ? mapDataCache?.tileDefinitions?.[symbol] : undefined,
    parseLevelNumber,
    { levelHeight: LEVEL_HEIGHT, floorSurfaceY: WALK_SURFACE, feetClearance: FEET_CLEARANCE },
  );

  const getGroundFootY = (worldX: number, worldZ: number, level: string) => {
    const floor = collisionWorld.queryFloor(
      worldX,
      worldZ,
      levelToWorldY(level),
      levelToWorldY(level) + LEVEL_HEIGHT,
      [level],
    );
    return floor ? floor.footY : levelToWorldY(level) + WALK_SURFACE + FEET_CLEARANCE;
  };

  const getHighestGroundBelow = (worldX: number, worldZ: number, currentY: number) => {
    const mapData = mapDataCache;
    const levelKeys = mapData?.levels ? Object.keys(mapData.levels) : [getCurrentLevel()];
    const floor = collisionWorld.queryFloor(
      worldX,
      worldZ,
      -999,
      currentY + HERO_BODY_HEIGHT,
      levelKeys,
    );
    if (floor) {
      return {
        level: floor.level,
        footY: floor.footY,
        kind: floor.isGraded ? "ramp" as const : "floor" as const,
        geometryProfile: null,
      };
    }
    return {
      level: levelKeys.includes("0") ? "0" : levelKeys[0],
      footY: levelToWorldY(levelKeys.includes("0") ? "0" : levelKeys[0]) + WALK_SURFACE + FEET_CLEARANCE,
      kind: "void" as const,
      geometryProfile: null,
    };
  };

  const getGroundSurfaceY = (worldX: number, worldZ: number, level: string) => {
    const floor = collisionWorld.queryFloor(
      worldX,
      worldZ,
      -9999,
      9999,
      [level],
    );
    return floor ? floor.surfaceY : levelToWorldY(level) + WALK_SURFACE;
  };

  /** Surface Y for billboards / loot (feet row at root origin). Includes water sink. */
  const resolveWorldAnchorY = (
    worldX: number,
    worldZ: number,
    level: string,
    restOffset = WORLD_ANCHOR_REST_OFFSET,
  ) => {
    const surfaceY = getGroundSurfaceY(worldX, worldZ, level);
    const aquatic = getAquaticSampleAt(worldX, worldZ, level);
    const sink = aquatic.mode === "dry" ? 0 : aquatic.sinkOffset;
    return surfaceY + sink + restOffset;
  };

  const applyActorAquaticY = (worldPos: Vector3, level: string) => {
    const sample = getAquaticSampleAt(worldPos.x, worldPos.z, level);
    const surfaceY = getGroundSurfaceY(worldPos.x, worldPos.z, level);
    const footY = surfaceY + FEET_CLEARANCE;
    worldPos.y = footY + sample.sinkOffset;
  };

  const applyActiveLevelChange = (
    newLevel: string,
    transition?: {
      tileX: number;
      tileZ: number;
      landingLocalZ: number;
      guardMs?: number;
    },
    options?: { natural?: boolean },
  ) => {
    if (newLevel === lastSideEffectLevel) {
      return;
    }
    const previousLevel = lastSideEffectLevel ?? newLevel;
    lastSideEffectLevel = newLevel;
    const natural = options?.natural === true;
    playerState.setCurrentLevel(newLevel);
    WorldMapService.ensureLevelBuffer(newLevel);

    if (transition) {
      console.log("[WARP] applyActiveLevelChange with transition", { from: previousLevel, to: newLevel, tileX: transition.tileX, tileZ: transition.tileZ, landingLocalZ: transition.landingLocalZ });
      player.position.z = transition.tileZ + transition.landingLocalZ;
      player.position.x = Math.min(
        mapMaxX,
        Math.max(mapMinX + 0.5, transition.tileX + 0.5),
      );
      verticalTransitionGuard = {
        untilMs: performance.now() + (transition.guardMs ?? 2800),
        tileX: transition.tileX,
        tileZ: transition.tileZ,
        fromLevel: previousLevel,
        toLevel: newLevel,
      };
    }

    if (natural) {
      invalidateVerticalVisibilityCache();
      chunkSystem.tick(CHUNK_UPDATE_INTERVAL);
    } else {
      chunkSystem.clearAll();
      invalidateVerticalVisibilityCache();
      snapPlayerFootToActiveLevel();
    }
    const mapData = mapDataCache;
    if (mapData) {
      void loadLevelBinary(newLevel, mapData).then(() => {
        if (!natural) {
          snapPlayerFootToActiveLevel();
        }
        reanchorWorldContentOnLevel(newLevel);
        chunkSystem.tick(CHUNK_UPDATE_INTERVAL);
      });
    }
    // Escada/rampa natural: andares ±1 já estão nos chunks (vertical stack).
    // ensureMapLevelReady → renderMapLevel apagava tudo e reconstruía do zero.
    if (!natural) {
      void ensureMapLevelReady(newLevel);
    } else {
      navigationSystem.rebuildWindow(newLevel);
    }
    void doorSystem.ensureLevelSeeded(newLevel);
    orchestrator.seedLevel(newLevel);
    orchestrator.seedAdjacentLevels(newLevel);
    enemySystem.syncStream(true);
    propSystem.syncStream(true);
    pushLogEvent("level.change", {
      from: previousLevel,
      to: newLevel,
      playerX: Math.round(player.position.x * 100) / 100,
      playerZ: Math.round(player.position.z * 100) / 100,
    });
  };

  /**
   * Trigger side effects when Y-derived level changes (no cache, no hysteresis).
   * Replaces the old syncVerticalLevelFromMovement pattern.
   */
  const syncLevelSideEffects = () => {
    if (!worldBootstrapReady) return;
    const mapData = mapDataCache;
    if (!mapData?.levels) return;
    if (holeFallLandingLevel || isPlayerOverVoidAtLevel(getCurrentLevel())) return;
    if (levelTransitionCooldown > 0) return;

    const currentLevel = getCurrentLevel();
    if (currentLevel !== lastSideEffectLevel) {
      levelTransitionCooldown = 0.35;
      applyActiveLevelChange(currentLevel, undefined, { natural: true });
      snapFootToGradedSurface();
    }
  };

  const snapPlayerFootToActiveLevel = () => {
    const currentLevel = getCurrentLevel();
    const footY = levelBinaryCache.has(currentLevel)
      ? getGroundFootY(
          player.position.x,
          player.position.z,
          currentLevel,
        )
      : levelToWorldY(currentLevel) +
        WALK_SURFACE +
        FEET_CLEARANCE;
    player.position.y = footY;
    verticalVelocity = 0;
    isGrounded = true;
    lastGroundedFootY = footY;
  };

  const isVoidSymbol = (symbol: string | null) => !symbol || symbol === "...";

  /** True void = no physical surface at this tile on the given level.
   * A void tile directly above a floor-level ramp on the level below is NOT
   * a true void — the ramp geometry fills that space. */
  const isPlayerOverVoidAtLevel = (level: string) => {
    const groundBelow = getHighestGroundBelow(player.position.x, player.position.z, player.position.y);
    return !groundBelow || groundBelow.kind === "void";
  };

  const isDownHoleTile = (tileDef?: SliceTileDefinition | null) => {
    if (!tileDef) {
      return false;
    }
    const legacy = tileDef as SliceTileDefinition & {
      transition?: "up" | "down" | "dwn";
    };
    return (
      legacy.transition === "down" ||
      legacy.transition === "dwn" ||
      tileDef.id === "hole"
    );
  };

  const getTileDefAt = (level: string, tileX: number, tileZ: number) => {
    const symbol = getMapTileAt(level, tileX, tileZ);
    return symbol ? mapDataCache?.tileDefinitions?.[symbol] : undefined;
  };

  const isGradedWalkAt = (worldX: number, worldZ: number, level: string) =>
    isGradedWalkTile(
      getTileDefAt(level, Math.floor(worldX), Math.floor(worldZ)),
      LEVEL_HEIGHT,
    );

  const snapFootToGradedSurface = () => {
    const mapData = mapDataCache;
    if (!mapData?.levels) { isGrounded = false; return; }
    const floor = collisionWorld.queryFloor(
      player.position.x,
      player.position.z,
      player.position.y - 0.45,
      player.position.y + HERO_BODY_HEIGHT,
      Object.keys(mapData.levels),
      player.position.y + 0.45,
    );
    if (!floor) {
      isGrounded = false;
      return;
    }
    // Prevent snapping to a surface too far above the player's current foot
    // (preserves the step-up constraint from the old getHighestGroundWithinStepLimit).
    if (floor.footY > player.position.y + 0.45) {
      isGrounded = false;
      return;
    }
    const aquatic = getAquaticSampleAt(player.position.x, player.position.z, floor.level);
    if (aquatic.mode === "dry") {
      player.position.y = floor.footY;
    } else {
      player.position.y = floor.footY + aquatic.sinkOffset;
    }
    if (floor.level !== getCurrentLevel()) {
      applyActiveLevelChange(floor.level, undefined, { natural: true });
    }
  };

  const isStaticTileBlocking = (
    symbol: string | null,
    tileDef?: SliceTileDefinition,
  ) => {
    if (isVoidSymbol(symbol)) {
      return false;
    }

    const resolvedTileId = tileDef?.id ?? symbol;
    if (!resolvedTileId) {
      return false;
    }

    if (isWaterTileId(resolvedTileId)) {
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

  const isBlockingTile = (
    symbol: string | null,
    tileDef?: SliceTileDefinition,
    options?: { level?: string; tileX?: number; tileY?: number },
  ) => {
    if (
      options?.level !== undefined &&
      options.tileX !== undefined &&
      options.tileY !== undefined
    ) {
      const door = doorSystem.getDoorAtTile(options.level, options.tileX, options.tileY);
      if (door) {
        return !doorSystem.isDoorOpenAtTile(options.level, options.tileX, options.tileY);
      }

      if (
        propSystem.isCollidableTile(options.level, options.tileX, options.tileY)
      ) {
        return true;
      }
    }

    return isStaticTileBlocking(symbol, tileDef);
  };

  let lastChunkRenderLevel: string | null = null;

  const renderMapLevel = async (level: string) => {
    const mapData = mapDataCache;
    if (!mapData || !mapData.width || !mapData.height) {
      return;
    }

    const binData = await loadLevelBinary(level, mapData);
    if (!binData) {
      return;
    }

    currentMapWidth = mapData.width;
    currentMapHeight = mapData.height;
    mapMinX = 0;
    mapMinZ = 0;
    mapMaxX = Math.max(0.5, currentMapWidth - 0.5);
    mapMaxZ = Math.max(0.5, currentMapHeight - 0.5);

    navigationSystem.rebuildGrid(level);
    if (lastChunkRenderLevel === null) {
      chunkSystem.clearAll();
    }
    lastChunkRenderLevel = level;

    chunkSystem.tick(CHUNK_UPDATE_INTERVAL);
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
    // S12-BUG2: must be Mesh (not TransformNode) so vd.applyToMesh works
    const group = new Mesh(name, scene);

    const x0 = tx,
      x1 = tx + 1;
    const z0 = tz,
      z1 = tz + 1;
    const xM = tx + 0.5,
      zM = tz + 0.5;
    const yBase = baseY,
      yRidge = baseY + ridgeH;

    const vd = new VertexData();

    const positions = [
      x0,
      yBase,
      z0, // 0 front-left
      x1,
      yBase,
      z0, // 1 front-right
      x1,
      yBase,
      z1, // 2 back-right
      x0,
      yBase,
      z1, // 3 back-left
      xM,
      yRidge,
      zM, // 4 peak
    ];

    const indices = [
      0,
      4,
      1, // front
      1,
      4,
      2, // right
      2,
      4,
      3, // back
      3,
      4,
      0, // left
    ];

    const normals: number[] = new Array(positions.length).fill(0);
    VertexData.ComputeNormals(positions, indices, normals);

    vd.positions = positions;
    vd.indices = indices;
    vd.normals = normals;
    vd.applyToMesh(group);

    return group;
  };

  // Build an 8-step staircase mesh for a single 1×1-tile footprint (fallback path).
  // South (+Z) = entry, north (−Z) = exit. Keep in sync with geometry.worker.ts.
  const buildStairMesh = (
    name: string,
    tx: number,
    tz: number,
    baseY: number,
  ): Mesh => {
    const mesh = new Mesh(name, scene);
    const STEP_COUNT = 8;
    const stepDepth = 1.0 / STEP_COUNT;
    const stepRise = LEVEL_HEIGHT / STEP_COUNT;

    const allPositions: number[] = [];
    const allIndices: number[] = [];

    for (let i = 0; i < STEP_COUNT; i++) {
      const x0 = tx;
      const x1 = tx + 1;
      const z0 = tz + (STEP_COUNT - 1 - i) * stepDepth;
      const z1 = tz + (STEP_COUNT - i) * stepDepth;
      const y1 = baseY + WALK_SURFACE + (i + 1) * stepRise;
      const y0 = y1 - stepRise;

      const base = allPositions.length / 3;
      // 8 vertices — shared per step (ComputeNormals averages them; fine for steps)
      allPositions.push(
        x0,
        y0,
        z1,
        x1,
        y0,
        z1,
        x1,
        y0,
        z0,
        x0,
        y0,
        z0, // bottom
        x0,
        y1,
        z1,
        x1,
        y1,
        z1,
        x1,
        y1,
        z0,
        x0,
        y1,
        z0, // top
      );
      allIndices.push(
        base + 4,
        base + 7,
        base + 6,
        base + 4,
        base + 6,
        base + 5, // top face (visible)
        base + 0,
        base + 1,
        base + 2,
        base + 0,
        base + 2,
        base + 3, // bottom (hidden)
        base + 0,
        base + 4,
        base + 5,
        base + 0,
        base + 5,
        base + 1, // south riser (+Z)
        base + 3,
        base + 2,
        base + 6,
        base + 3,
        base + 6,
        base + 7, // north face
        base + 1,
        base + 5,
        base + 6,
        base + 1,
        base + 6,
        base + 2, // east side
        base + 0,
        base + 3,
        base + 7,
        base + 0,
        base + 7,
        base + 4, // west side
      );
    }

    const normals: number[] = new Array(allPositions.length).fill(0);
    VertexData.ComputeNormals(allPositions, allIndices, normals);
    const vd2 = new VertexData();
    vd2.positions = allPositions;
    vd2.indices = allIndices;
    vd2.normals = normals;
    vd2.applyToMesh(mesh);
    return mesh;
  };

  // Build (or skip) one 16×16-tile chunk at chunk-grid position (cx, cy).
  // lod 0 = full detail, 1 = walls-only, 2 = ground-only
  // Caching variables for visible levels and occlusion checks
  let cachedRenderableLevels: string[] = [];
  let lastCachedTileX = -9999;
  let lastCachedTileZ = -9999;
  let lastCachedActiveLevel = "";
  let lastCachedIsFirstPerson = false;
  let lastCachedVerticalStackRadius = -1;

  const invalidateVerticalVisibilityCache = () => {
    lastCachedTileX = -9999;
    lastCachedTileZ = -9999;
    lastCachedActiveLevel = "";
    lastCachedVerticalStackRadius = -1;
    cachedRenderableLevels = [];
  };

  const resolveVerticalStackRadiusTiles = () => {
    return chunkSystem.resolveVerticalStackRadiusTiles();
  };

  const getRenderableLevels = (): string[] => {
    const tileX = Math.floor(player.position.x);
    const tileZ = Math.floor(player.position.z);
    const verticalStackRadius = resolveVerticalStackRadiusTiles();
    const renderLevel = getRenderLevel();

    if (
      tileX === lastCachedTileX &&
      tileZ === lastCachedTileZ &&
      renderLevel === lastCachedActiveLevel &&
      isFirstPerson === lastCachedIsFirstPerson &&
      verticalStackRadius === lastCachedVerticalStackRadius &&
      cachedRenderableLevels.length > 0
    ) {
      return cachedRenderableLevels;
    }

    lastCachedTileX = tileX;
    lastCachedTileZ = tileZ;
    lastCachedActiveLevel = renderLevel;
    lastCachedIsFirstPerson = isFirstPerson;
    lastCachedVerticalStackRadius = verticalStackRadius;

    const mapData = mapDataCache;
    if (!mapData?.levels) {
      cachedRenderableLevels = [renderLevel];
      return cachedRenderableLevels;
    }

    const stack = resolveVerticalVisibleLevels(
      renderLevel,
      tileX,
      tileZ,
      Object.keys(mapData.levels),
      getMapTileAt,
      (symbol) =>
        symbol ? mapData.tileDefinitions?.[symbol] : undefined,
      { parseLevelNumber, columnRadius: verticalStackRadius },
    );
    const merged = new Set<string>(stack);
    merged.add(renderLevel);
    const n = parseLevelNumber(renderLevel);
    const below = String(n - 1);
    const above = String(n + 1);
    if (mapData.levels[below]) {
      merged.add(below);
    }
    if (mapData.levels[above]) {
      merged.add(above);
    }
    cachedRenderableLevels = Object.keys(mapData.levels)
      .filter((key) => merged.has(key))
      .sort((a, b) => parseLevelNumber(a) - parseLevelNumber(b));
    return cachedRenderableLevels;
  };

  const syncVerticalLevelVisibility = (deltaSeconds: number) => {
    const mapData = mapDataCache;
    const verticallyVisible = new Set(getRenderableLevels());
    occlusionStartLevel = findUpperOcclusionLevel();
    const lerpFactor = Math.min(1, deltaSeconds * 8);

    if (isFirstPerson && levelMeshes.size > 0) {
      const showLevels = mapData?.levels
        ? new Set(Object.keys(mapData.levels))
        : new Set([getCurrentLevel()]);
      if (holeFallLandingLevel) {
        showLevels.add(holeFallLandingLevel);
      }

      levelMeshes.forEach((meshes, levelKey) => {
        const showLevel = showLevels.has(levelKey);
        meshes.forEach((mesh) => {
          if (!mesh || mesh.isDisposed()) {
            return;
          }
          if (!showLevel) {
            if (mesh.visibility !== 0) {
              mesh.visibility = 0;
            }
            if (mesh.isEnabled()) {
              mesh.setEnabled(false);
            }
            return;
          }
          if (mesh.visibility !== 1) {
            mesh.visibility = 1;
          }
          if (!mesh.isEnabled()) {
            mesh.setEnabled(true);
          }
        });
      });
    } else if (!isFirstPerson && levelMeshes.size > 0) {
      levelMeshes.forEach((meshes, levelKey) => {
        const levelNum = parseLevelNumber(levelKey);
        const inVerticalColumn = verticallyVisible.has(levelKey);

        meshes.forEach((mesh) => {
          if (!mesh || mesh.isDisposed()) {
            return;
          }

          if (!inVerticalColumn) {
            if (mesh.visibility !== 0) {
              mesh.visibility = 0;
            }
            if (mesh.isEnabled()) {
              mesh.setEnabled(false);
            }
            return;
          }

          // R1: hide entire occluded levels (all chunks) — partial occlusion
          // produces a "bitten" look where only the hero's chunk disappears.
          const occluded =
            occlusionStartLevel !== null &&
            levelNum >= occlusionStartLevel;

          if (occluded) {
            if (mesh.visibility !== 0) {
              mesh.visibility = 0;
            }
            if (mesh.isEnabled()) {
              mesh.setEnabled(false);
            }
            return;
          }

          if (mesh.visibility !== 1) {
            const next = mesh.visibility + (1 - mesh.visibility) * lerpFactor;
            const targetVisibility = next >= 0.99 ? 1 : next;
            if (mesh.visibility !== targetVisibility) {
              mesh.visibility = targetVisibility;
            }
            if (!mesh.isEnabled() && targetVisibility > 0.01) {
              mesh.setEnabled(true);
            }
            return;
          }

          if (!mesh.isEnabled()) {
            mesh.setEnabled(true);
          }
        });
      });
    }

    waterEffectSystem.updateOcclusion(occlusionStartLevel, deltaSeconds);

    window.__slice3dVerticalVisibility = {
      currentLevel: getCurrentLevel(),
      visibleLevels: Array.from(verticallyVisible),
      occludedFromLevel: occlusionStartLevel,
      occlusionScanRadius: DEFAULT_OCCLUSION_SCAN_RADIUS,
      verticalStackRadiusTiles: resolveVerticalStackRadiusTiles(),
      firstPersonCeilingLevel: null,
      totalLevels: mapData?.levels ? Object.keys(mapData.levels).length : 1,
      columnRadius: resolveVerticalStackRadiusTiles(),
      playerTile: {
        x: Math.floor(player.position.x),
        y: Math.floor(player.position.z),
      },
      ts: Date.now(),
    };
  };

  const registerMeshForLevel = (levelKey: string, mesh: Mesh) => {
    let set = levelMeshes.get(levelKey);
    if (!set) {
      set = new Set<Mesh>();
      levelMeshes.set(levelKey, set);
    }
    set.add(mesh);
    meshLevelByMesh.set(mesh, levelKey);
  };

  // ── 2D Digital Differential Analyzer ──
  // Walk integer grid tiles along a ray segment from (x0,z0) to (x1,z1) in world space,
  // invoking callback for each tile the line passes through.
  const ddaWalk = (
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    callback: (tx: number, tz: number) => void,
  ): void => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const absDx = Math.abs(dx);
    const absDz = Math.abs(dz);
    const stepX = dx >= 0 ? 1 : -1;
    const stepZ = dz >= 0 ? 1 : -1;

    let tx = Math.floor(x0);
    let tz = Math.floor(z0);
    const endTx = Math.floor(x1);
    const endTz = Math.floor(z1);

    callback(tx, tz);
    if (tx === endTx && tz === endTz) return;
    if (absDx < 0.001 && absDz < 0.001) return;

    const tMaxStepX = absDx > 0.001 ? 1.0 / absDx : 1e9;
    const tMaxStepZ = absDz > 0.001 ? 1.0 / absDz : 1e9;

    const nextBoundaryX = stepX > 0 ? Math.floor(x0) + 1 : Math.floor(x0);
    const nextBoundaryZ = stepZ > 0 ? Math.floor(z0) + 1 : Math.floor(z0);
    let tMaxX = absDx > 0.001 ? Math.abs((nextBoundaryX - x0) / dx) : 1e9;
    let tMaxZ = absDz > 0.001 ? Math.abs((nextBoundaryZ - z0) / dz) : 1e9;

    while (tx !== endTx || tz !== endTz) {
      if (tMaxX < tMaxZ) {
        tMaxX += tMaxStepX;
        tx += stepX;
      } else {
        tMaxZ += tMaxStepZ;
        tz += stepZ;
      }
      callback(tx, tz);
    }
  };

  // ── Wall occlusion on camera-to-hero ray ──
  // For each visible upper level below the occlusion start, walk tiles along the
  // camera→hero ray and hide wall meshes that intersect the line of sight.
  const hideWallsOnRay = (): void => {
    if (isFirstPerson) return;
    if (occlusionStartLevel === null) return;

    const mapData = mapDataCache;
    if (!mapData?.levels) return;

    const camPos = camera.position;
    const heroPos = player.position;
    const dy = heroPos.y - camPos.y;
    if (Math.abs(dy) < 0.001) return;

    const currentNum = parseLevelNumber(getRenderLevel());
    const dir = heroPos.subtract(camPos);
    const toHide = new Set<Mesh>();

    for (const levelKey of Object.keys(mapData.levels)) {
      const levelNum = parseLevelNumber(levelKey);
      if (levelNum <= currentNum) continue;
      if (occlusionStartLevel !== null && levelNum >= occlusionStartLevel) continue;

      const floorY = levelToWorldY(levelNum) + WALK_SURFACE;
      const ceilingY = levelToWorldY(levelNum) + LEVEL_HEIGHT;

      const tFloor = (floorY - camPos.y) / dy;
      const tCeil = (ceilingY - camPos.y) / dy;
      const t0 = Math.max(0, Math.min(tFloor, tCeil));
      const t1 = Math.min(1, Math.max(tFloor, tCeil));
      if (t0 >= t1) continue;

      const x0 = camPos.x + t0 * dir.x;
      const z0 = camPos.z + t0 * dir.z;
      const x1 = camPos.x + t1 * dir.x;
      const z1 = camPos.z + t1 * dir.z;

      ddaWalk(x0, z0, x1, z1, (tx, tz) => {
        const sym = getMapTileAt(levelKey, tx, tz);
        if (!sym || sym === "..." || !isStaticTileBlocking(sym, mapData.tileDefinitions?.[sym])) return;

        const idxKey = `${levelKey}::${tx}_${tz}`;
        const mesh = wallTileIndex.get(idxKey);
        if (mesh && !mesh.isDisposed()) {
          toHide.add(mesh);
        }
      });
    }

    // Restore previously hidden meshes that are no longer on the ray,
    // but NOT if the mesh's level is now fully occluded (syncVerticalLevelVisibility handles it).
    hiddenWallMeshes.forEach((mesh) => {
      if (!toHide.has(mesh) && !mesh.isDisposed()) {
        const lk = meshLevelByMesh.get(mesh);
        if (lk) {
          const ln = parseLevelNumber(lk);
          if (occlusionStartLevel !== null && ln >= occlusionStartLevel) return;
        }
        mesh.visibility = 1;
        mesh.setEnabled(true);
      }
    });

    // Hide wall meshes currently on the ray
    toHide.forEach((mesh) => {
      if (!mesh.isDisposed()) {
        mesh.visibility = 0;
        mesh.setEnabled(false);
      }
    });

    hiddenWallMeshes.clear();
    toHide.forEach((mesh) => {
      hiddenWallMeshes.add(mesh);
    });
  };

  const findUpperOcclusionLevel = (): number | null => {
    const mapData = mapDataCache;
    if (!mapData?.levels) return null;

    const footLevel = getRenderLevel();
    if (isGradedWalkAt(player.position.x, player.position.z, footLevel)) {
      return null;
    }

    const camPos = camera.position;
    const heroPos = player.position;
    const dir = heroPos.subtract(camPos);
    const currentNum = parseLevelNumber(footLevel);

    const upperLevels = Object.keys(mapData.levels)
      .filter((key) => parseLevelNumber(key) > currentNum)
      .sort((a, b) => parseLevelNumber(a) - parseLevelNumber(b));

    for (const levelKey of upperLevels) {
      const levelNum = parseLevelNumber(levelKey);
      const floorY = levelToWorldY(levelNum) + WALK_SURFACE;

      // t along ray from camera (0) to hero (1) where Y = floorY
      const t = (floorY - camPos.y) / (heroPos.y - camPos.y);
      if (t < 0 || t >= 1) continue;

      const tileX = Math.floor(camPos.x + t * dir.x);
      const tileZ = Math.floor(camPos.z + t * dir.z);

      const sym = getMapTileAt(levelKey, tileX, tileZ);
      if (sym && sym !== "...") {
        const upperFloorY = levelToWorldY(levelNum) + WALK_SURFACE;
        const headY = heroPos.y + HERO_BODY_HEIGHT * 0.92;
        if (headY >= upperFloorY - 0.15) return null;
        return levelNum;
      }
    }

    return null;
  };

  /** @deprecated Use syncVerticalLevelVisibility — kept as alias for chunk register. */
  const updateUpperLevelVisibility = (deltaSeconds: number) => {
    syncVerticalLevelVisibility(deltaSeconds);
  };

  const resolvePoolFloorMaterial = (
    level: string,
    tileX: number,
    tileY: number,
  ) => {
    const mapData = mapDataCache;
    const maxRadius = 20;
    for (let radius = 1; radius <= maxRadius; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
            continue;
          }
          const symbol = getMapTileAt(level, tileX + dx, tileY + dy);
          if (!symbol || symbol === "...") {
            continue;
          }
          const tileDef = mapData?.tileDefinitions?.[symbol];
          const neighborId = (tileDef?.id || symbol || "").toLowerCase();
          if (isWaterTileId(neighborId)) {
            continue;
          }
          return getTileMaterial(symbol, tileDef, "#9ca3af");
        }
      }
    }

    const cobDef = mapData?.tileDefinitions?.cob;
    return getTileMaterial("cob", cobDef, "#9ca3af");
  };


  const chunkSystem = new ChunkStreamSystem({
    scene,
    mapRoot,
    geometryWorker,
    waterEffectSystem,
    StandardMaterial: StandardMaterial as typeof StandardMaterial,
    CHUNK_SIZE,
    LEVEL_HEIGHT,
    WALL_HEIGHT,
    WALK_SURFACE,
    levelMeshes,
    meshLevelByMesh,
    wallTileIndex,
    levelBinaryCache,
    tileMaterials,
    tileMaterialLRU,
    getMapData: () => mapDataCache,
    getMapTileAt,
    getTileDef: (symbol) => symbol ? mapDataCache?.tileDefinitions?.[symbol] ?? null : null,
    getTileMaterial,
    resolvePoolFloorMaterial,
    isBlockingTile,
    isDownHoleTile: (symbol, tileDef) => isDownHoleTile(tileDef ?? null),
    getRenderableLevels,
    registerMeshForLevel,
    parseLevelNumber: (level) => parseLevelNumber(level),
    levelToWorldY,
    isFirstPerson: () => isFirstPerson,
    getPlayerPosition: () => ({ x: player.position.x, z: player.position.z }),
    getTopDownDrawRadiusChunks: () => topDownDrawRadiusChunks,
    getFirstPersonDrawRadiusChunks: () => firstPersonDrawRadiusChunks,
    getTopDownChunkBuildBudgetPerTick: () => topDownChunkBuildBudgetPerTick,
    getFirstPersonChunkBuildBudgetPerTick: () => firstPersonChunkBuildBudgetPerTick,
    findUpperOcclusionLevel: () => findUpperOcclusionLevel(),
    onDiagnostics: (stats) => {
      window.__slice3dChunkStreaming = stats as typeof window.__slice3dChunkStreaming;
    },
  });
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

  const ensureDebugSandboxStarterLoadout = (mapData: SliceMapData) => {
    if (!mapData.config?.debugSandbox) {
      return;
    }

    let grantedSomething = false;

    const fireBurstCharges =
      playerState
        .getEnchantedRunes()
        .find((rune) => rune.runeId === "fire_burst_rune")?.count || 0;
    if (fireBurstCharges < 10) {
      playerState.addEnchantedRune("fire_burst_rune", 10 - fireBurstCharges, 2);
      grantedSomething = true;
    }

    const equippedRuneSlots = playerState.getEquippedRuneSlots();
    if (!equippedRuneSlots.includes("fire_burst_rune")) {
      playerState.setEquippedRuneSlot(0, "fire_burst_rune");
      grantedSomething = true;
    }

    const magicRuneCount = playerState
      .getInventory()
      .filter((item) => item.itemId === "magic_rune")
      .reduce((total, item) => total + (item.count || 0), 0);
    if (magicRuneCount < 5) {
      playerState.addItem("magic_rune", 5 - magicRuneCount);
      grantedSomething = true;
    }

    if (grantedSomething) {
      playerState.emit("uiNotification", {
        type: "info",
        message: "Debug sandbox: runas e cargas liberadas para teste.",
      });
    }
  };

  const extractEnemyUidFromMeshChain = (mesh: any): string | undefined => {
    let currentMesh = mesh;
    while (currentMesh) {
      const metadata = currentMesh.metadata as { sliceEnemyUid?: string } | undefined;
      if (metadata?.sliceEnemyUid) {
        return metadata.sliceEnemyUid;
      }
      currentMesh = currentMesh.parent;
    }
    return undefined;
  };

  const projectPointerToGroundXZ = (pointerX: number, pointerY: number) => {
    const activeCamera = scene.activeCamera;
    if (!activeCamera) {
      return null;
    }
    const ray = scene.createPickingRay(
      pointerX,
      pointerY,
      Matrix.Identity(),
      activeCamera,
    );
    const planeY = levelToWorldY(getRenderLevel()) + WALK_SURFACE;
    if (Math.abs(ray.direction.y) < 1e-5) {
      return null;
    }
    const t = (planeY - ray.origin.y) / ray.direction.y;
    if (t < 0) {
      return null;
    }
    return {
      x: ray.origin.x + ray.direction.x * t,
      z: ray.origin.z + ray.direction.z * t,
    };
  };

  /** multiPick + ground fallback for occluded reveal proxies behind walls. */
  const resolveEnemyUidFromPointer = (
    pointerX: number,
    pointerY: number,
  ): string | undefined => {
    const multiHits = scene.multiPick(pointerX, pointerY);
    if (multiHits) {
      for (const hit of multiHits) {
        const uid = extractEnemyUidFromMeshChain(hit.pickedMesh);
        if (uid && enemies.has(uid)) {
          return uid;
        }
      }
    }

    const singlePick = scene.pick(pointerX, pointerY);
    const fromSingle = extractEnemyUidFromMeshChain(singlePick?.pickedMesh);
    if (fromSingle && enemies.has(fromSingle)) {
      return fromSingle;
    }

    if (!isFirstPerson) {
      const ground = projectPointerToGroundXZ(pointerX, pointerY);
      if (ground) {
        const occluded = wallRevealSystem.findOccludedTargetNear(
          ground.x,
          ground.z,
          0.95,
        );
        const uid = occluded?.pickMetadata.sliceEnemyUid;
        if (uid && enemies.has(uid)) {
          return uid;
        }
      }
    }

    return undefined;
  };

  const resolveDoorUuidFromPointer = (
    pointerX: number,
    pointerY: number,
  ): string | null => {
    const multiHits = scene.multiPick(pointerX, pointerY);
    if (multiHits) {
      for (const hit of multiHits) {
        const uuid = doorSystem.findDoorUuidFromPick(hit);
        if (uuid) {
          return uuid;
        }
      }
    }

    const singlePick = scene.pick(pointerX, pointerY);
    const fromSingle = doorSystem.findDoorUuidFromPick(singlePick);
    if (fromSingle) {
      return fromSingle;
    }

    if (!isFirstPerson) {
      const ground = projectPointerToGroundXZ(pointerX, pointerY);
      if (ground) {
        const occluded = wallRevealSystem.findOccludedTargetNear(
          ground.x,
          ground.z,
          0.95,
        );
        const uuid = occluded?.pickMetadata.sliceDoorUuid;
        if (uuid && doorSystem.doors.has(uuid)) {
          return uuid;
        }
      }
    }

    return null;
  };

  const getNearestPickupItemDistance = (): number => {
    const pickupRange = playerState.pickupRange / 32;
    let nearestDistance = Number.POSITIVE_INFINITY;

    dropSystem.droppedItemMeshes.forEach((mesh) => {
      if (!mesh.isEnabled()) {
        return;
      }
      const item = mesh.metadata as SliceDroppedItem | undefined;
      if (!item) {
        return;
      }
      const distance = Vector3.Distance(player.position, mesh.position);
      if (distance <= pickupRange && distance < nearestDistance) {
        nearestDistance = distance;
      }
    });

    return nearestDistance;
  };

  let debugCollidersVisible = false;
  let debugColliderParent: TransformNode | null = null;
  let playerDebugMesh: Mesh | null = null;

  const createWedgeMesh = (v: any, parent: TransformNode) => {
    const mesh = new Mesh("wedge_" + v.level, scene);
    mesh.parent = parent;

    const x1 = v.x1, x2 = v.x2;
    const z1 = v.z1, z2 = v.z2;
    const baseY = v.baseY, highY = v.highY;

    let y_nw = baseY, y_ne = baseY, y_sw = baseY, y_se = baseY;
    if (v.direction === "n") {
      y_nw = highY; y_ne = highY;
    } else if (v.direction === "s") {
      y_sw = highY; y_se = highY;
    } else if (v.direction === "e") {
      y_ne = highY; y_se = highY;
    } else if (v.direction === "w") {
      y_nw = highY; y_sw = highY;
    }

    const positions = [
      x1, baseY, z1,
      x2, baseY, z1,
      x2, baseY, z2,
      x1, baseY, z2,
      x1, y_sw, z1,
      x2, y_se, z1,
      x2, y_ne, z2,
      x1, y_nw, z2,
    ];

    const indices = [
      0, 2, 1,  0, 3, 2,
      4, 5, 6,  4, 6, 7,
      0, 1, 5,  0, 5, 4,
      1, 2, 6,  1, 6, 5,
      2, 3, 7,  2, 7, 6,
      3, 0, 4,  3, 4, 7
    ];

    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.applyToMesh(mesh);

    return mesh;
  };

  const rebuildDebugColliderMeshes = () => {
    if (debugColliderParent) {
      debugColliderParent.dispose();
      debugColliderParent = null;
    }
    if (playerDebugMesh) {
      playerDebugMesh.dispose();
      playerDebugMesh = null;
    }
    if (!debugCollidersVisible) return;

    debugColliderParent = new TransformNode("debugCollidersParent", scene);

    const matWalkable = new StandardMaterial("matWalkable", scene);
    matWalkable.diffuseColor = new Color3(0, 1, 0);
    matWalkable.alpha = 0.3;
    matWalkable.backFaceCulling = false;

    const matSolid = new StandardMaterial("matSolid", scene);
    matSolid.diffuseColor = new Color3(1, 0, 0);
    matSolid.alpha = 0.3;
    matSolid.backFaceCulling = false;

    for (const v of collisionWorld.volumes) {
      let mesh: Mesh;
      if (v.kind === "aabb") {
        mesh = MeshBuilder.CreateBox("aabb_" + v.level, {
          width: v.x2 - v.x1,
          height: v.y2 - v.y1,
          depth: v.z2 - v.z1,
        }, scene);
        mesh.parent = debugColliderParent;
        mesh.position.set(
          (v.x1 + v.x2) / 2,
          (v.y1 + v.y2) / 2,
          (v.z1 + v.z2) / 2,
        );
      } else {
        mesh = createWedgeMesh(v, debugColliderParent);
      }
      mesh.material = v.isWalkable ? matWalkable : matSolid;
    }
  };

  const updatePlayerDebugMesh = () => {
    if (!debugCollidersVisible) {
      if (playerDebugMesh) {
        playerDebugMesh.dispose();
        playerDebugMesh = null;
      }
      return;
    }

    if (!playerDebugMesh) {
      playerDebugMesh = MeshBuilder.CreateCylinder("playerDebug", {
        diameter: 0.64,
        height: HERO_BODY_HEIGHT,
      }, scene);
      const mat = new StandardMaterial("playerDebugMat", scene);
      mat.diffuseColor = new Color3(0, 0, 1);
      mat.alpha = 0.4;
      playerDebugMesh.material = mat;
    }

    playerDebugMesh.position.x = player.position.x;
    playerDebugMesh.position.y = player.position.y + HERO_BODY_HEIGHT / 2;
    playerDebugMesh.position.z = player.position.z;
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
      if (mapDataCache && mapDataCache.width && mapDataCache.height) {
        collisionWorld.rebuild(
          Object.keys(mapDataCache.levels || {}),
          mapDataCache.width,
          mapDataCache.height,
        );
        rebuildDebugColliderMeshes();
      }
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

    WorldMapService.bootstrapMinimap(mapData, binaryLevels, getCurrentLevel());
    collisionWorld.rebuild(
      levelKeys,
      mapData.width ?? 0,
      mapData.height ?? 0,
    );
    rebuildDebugColliderMeshes();
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
    ensureDebugSandboxStarterLoadout(mapData);
    await doorSystem.ensureLevelSeeded(resolvedLevel);

    if (resolvedLevel !== getCurrentLevel()) {
      applyActiveLevelChange(resolvedLevel, undefined, { natural: true });
    }

    await renderMapLevel(resolvedLevel);
    await propSystem.ensureLevelSeeded(resolvedLevel);

    const mapWidth = mapData.width ?? 0;
    const mapHeight = mapData.height ?? 0;
    const initialSpawn = mapData.levels[resolvedLevel]?.playerPos;
    const isWithinBounds =
      player.position.x >= 0 &&
      player.position.z >= 0 &&
      player.position.x < mapWidth &&
      player.position.z < mapHeight;
    const currentTileSymbol = isWithinBounds
      ? getMapTileAt(
          resolvedLevel,
          Math.floor(player.position.x),
          Math.floor(player.position.z),
        )
      : null;
    const currentTileDef = currentTileSymbol
      ? mapData.tileDefinitions?.[currentTileSymbol]
      : undefined;
    const currentTileBlocked = isBlockingTile(
      currentTileSymbol,
      currentTileDef,
    );
    const hasInvalidSpawn =
      !isWithinBounds || isVoidSymbol(currentTileSymbol) || currentTileBlocked;

    if (hasInvalidSpawn) {
      const findNearestWalkable = (originX: number, originZ: number) => {
        const maxRadius = 12;
        const baseX = Math.floor(originX);
        const baseZ = Math.floor(originZ);

        for (let radius = 0; radius <= maxRadius; radius++) {
          for (let dz = -radius; dz <= radius; dz++) {
            for (let dx = -radius; dx <= radius; dx++) {
              if (
                radius > 0 &&
                Math.abs(dx) !== radius &&
                Math.abs(dz) !== radius
              ) {
                continue;
              }

              const tx = baseX + dx;
              const tz = baseZ + dz;
              if (tx < 0 || tz < 0 || tx >= mapWidth || tz >= mapHeight) {
                continue;
              }

              const symbol = getMapTileAt(resolvedLevel, tx, tz);
              if (isVoidSymbol(symbol)) {
                continue;
              }

              const tileDef = symbol
                ? mapData.tileDefinitions?.[symbol]
                : undefined;
              if (isBlockingTile(symbol, tileDef)) {
                continue;
              }

              return { x: tx + 0.5, z: tz + 0.5 };
            }
          }
        }

        return null;
      };

      if (initialSpawn) {
        const targetX = worldToSliceCoord(initialSpawn.x);
        const targetZ = worldToSliceCoord(initialSpawn.y);
        const walkable = findNearestWalkable(targetX, targetZ);
        if (walkable) {
          player.position.x = walkable.x;
          player.position.z = walkable.z;
        } else {
          player.position.x = Math.min(mapWidth - 0.5, Math.max(0.5, targetX));
          player.position.z = Math.min(mapHeight - 0.5, Math.max(0.5, targetZ));
        }
      } else {
        const walkable = findNearestWalkable(
          player.position.x,
          player.position.z,
        );
        if (walkable) {
          player.position.x = walkable.x;
          player.position.z = walkable.z;
        } else {
          player.position.x = Math.min(
            mapWidth - 0.5,
            Math.max(0.5, player.position.x),
          );
          player.position.z = Math.min(
            mapHeight - 0.5,
            Math.max(0.5, player.position.z),
          );
        }
      }
    }

    playerState.exploreArea(
      resolvedLevel,
      Math.floor(player.position.x),
      Math.floor(player.position.z),
      8,
      currentMapWidth,
      currentMapHeight,
    );

    snapPlayerFootToActiveLevel();

    return resolvedLevel;
  };

  const setSelectedEnemy = (enemyUid: string | null) => {
    if (selectedEnemyUid && selectedEnemyUid !== enemyUid) {
      const prev = enemies.get(selectedEnemyUid);
      if (prev) {
        restoreEnemyTargetVisual(prev.meshRoot);
      }
    }
    selectedEnemyUid = enemyUid;
    if (!enemyUid) {
      playerState.emit("combatFocusChanged", { uid: null });
      return;
    }

    const enemy = enemies.get(enemyUid);
    if (!enemy || enemy.isDead) {
      selectedEnemyUid = null;
      playerState.emit("combatFocusChanged", { uid: null });
      return;
    }

    playerState.emit("combatFocusChanged", {
      uid: enemy.uid,
      enemyType: enemy.enemyType,
      health: enemy.health,
      maxHealth: enemy.maxHealth,
    });
  };

  const grantEnemyLoot = (enemy: SliceEnemy) => {
    const loot = EnemyRegistry.generateLoot(enemy.enemyType);
    loot.forEach((drop) => {
      playerState.addPersistentDroppedItem(getCurrentLevel(), {
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

  const emitBloodBurst = (
    origin: Vector3,
    colorHex: string,
    particleCount: number,
    spread: number,
    lifetimeSec: number,
  ) => {
    const particles: Mesh[] = [];
    const velocities: Vector3[] = [];
    const bloodMat = new StandardMaterial(
      `slice_blood_mat_${Date.now()}`,
      scene,
    );
    bloodMat.diffuseColor = Color3.FromHexString(colorHex);
    bloodMat.emissiveColor = Color3.FromHexString(colorHex).scale(0.15);
    bloodMat.specularColor = Color3.Black();

    for (let i = 0; i < particleCount; i += 1) {
      const p = MeshBuilder.CreateSphere(
        `slice_blood_${Date.now()}_${i}`,
        { diameter: 0.05 + Math.random() * 0.08, segments: 3 },
        scene,
      );
      p.material = bloodMat;
      p.position = origin.add(
        new Vector3(
          (Math.random() - 0.5) * spread,
          Math.random() * 0.25,
          (Math.random() - 0.5) * spread,
        ),
      );
      particles.push(p);
      velocities.push(
        new Vector3(
          (Math.random() - 0.5) * 2.5,
          1.2 + Math.random() * 1.1,
          (Math.random() - 0.5) * 2.5,
        ),
      );
    }

    let age = 0;
    const obs = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      age += dt;
      const t = Math.min(1, age / lifetimeSec);

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];
        const vel = velocities[i];
        vel.y -= 5.5 * dt;
        particle.position.addInPlace(vel.scale(dt));
        particle.scaling.setAll(Math.max(0.01, 1 - t * 0.85));
      }

      if (age >= lifetimeSec) {
        particles.forEach((p) => p.dispose());
        bloodMat.dispose();
        scene.onBeforeRenderObservable.remove(obs);
      }
    });
  };

  const destroyEnemy = (
    enemy: SliceEnemy,
    context?: { finishingDamage?: number; isFireKill?: boolean },
  ) => {
    if (enemy.isDead) {
      return;
    }

    const bloodEnabled = localStorage.getItem("tgs_settings_blood") !== "false";
    const maxHp = Math.max(1, enemy.definition.health || 100);
    const finishingDamage = Math.max(0, context?.finishingDamage || 0);
    const overkill = finishingDamage > maxHp * 0.5;
    const isFireKill = !!context?.isFireKill;

    if (bloodEnabled) {
      if (overkill) {
        emitBloodBurst(
          enemy.worldPos.clone().add(new Vector3(0, 0.35, 0)),
          isFireKill ? "#ff7a33" : "#aa1e1e",
          22,
          1.6,
          1.2,
        );
        audioManager.playSplash();
      } else if (!isFireKill) {
        emitBloodBurst(
          enemy.worldPos.clone().add(new Vector3(0, 0.25, 0)),
          "#7a1010",
          8,
          0.45,
          0.8,
        );
      }
    }

    enemy.isDead = true;
    setEnemyAnimState(enemy, "death", 60_000);

    const deathMs = getGeneratedDeathDurationMs(enemy.enemyType);
    window.setTimeout(() => {
      if (enemy.meshRoot.isDisposed()) {
        return;
      }
      enemy.meshRoot.dispose();
      enemies.delete(enemy.uid);
    }, deathMs);

    const catalogEntry = enemySpawnCatalog.get(enemy.spawnKey);
    if (catalogEntry) {
      pendingEnemyRespawns.set(enemy.spawnKey, {
        level: catalogEntry.level,
        spawn: catalogEntry.spawn,
        index: catalogEntry.index,
        elapsedMs: 0,
        respawnTimeMs: ENEMY_RESPAWN_MS,
      });
    }
    playerState.markEnemy3dDead(enemy.level, enemy.spawnKey);

    if (selectedEnemyUid === enemy.uid) {
      setSelectedEnemy(null);
    }

    playerState.emit("combatEnemyRemoved", { uid: enemy.uid });

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

    // S9-T1: notify React HUD of player taking damage (vignette + heart flash)
    document.dispatchEvent(
      new CustomEvent("slice3d:playerHit", { detail: { damage } }),
    );

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









  const setEnemyAnimState = (
    enemy: SliceEnemy,
    nextState: EnemyVisualAnimState,
    lockMs = 0,
  ) => {
    const now = Date.now();
    if (now < enemy.animLockedUntil && nextState !== "death") {
      return;
    }

    const restart = nextState === "attack";
    if (enemy.animState !== nextState || restart) {
      enemy.animState = nextState;
      setEnemyVisualAnimState(enemy.meshRoot, nextState, restart);
    }

    if (lockMs > 0) {
      enemy.animLockedUntil = now + lockMs;
    }
  };

  const requestEnemyPath = async (
    enemy: SliceEnemy,
    targetPosition: Vector3,
  ) => {
    const pathRequestStartedAt = performance.now();
    pathMetrics.requests += 1;
    pathMetrics.inFlight += 1;
    navigationSystem.rebuildWindow(enemy.level);
    const startX = navigationSystem.worldToGridX(enemy.worldPos.x);
    const startY = navigationSystem.worldToGridZ(enemy.worldPos.z);
    const endX = navigationSystem.worldToGridX(targetPosition.x);
    const endY = navigationSystem.worldToGridZ(targetPosition.z);

    if (
      startX < 0 ||
      startY < 0 ||
      endX < 0 ||
      endY < 0 ||
      startX >= navigationSystem.gridSize ||
      startY >= navigationSystem.gridSize ||
      endX >= navigationSystem.gridSize ||
      endY >= navigationSystem.gridSize
    ) {
      pathMetrics.failed += 1;
      pathMetrics.inFlight = Math.max(0, pathMetrics.inFlight - 1);
      return;
    }

    try {
      const path = await pathfindingManager.requestPath(
        startX,
        startY,
        endX,
        endY,
      );
      const tookMs = performance.now() - pathRequestStartedAt;
      pathMetrics.lastMs = Math.round(tookMs * 100) / 100;
      pathMetrics.maxMs = Math.max(pathMetrics.maxMs, pathMetrics.lastMs);
      pathMetrics.totalMs += tookMs;

      if (!path || path.length === 0 || enemy.isDead) {
        pathMetrics.failed += 1;
        if (tookMs >= LOG_SLOW_PATH_MS) {
          pushLogEvent("pathfinding.slow-empty", {
            enemyUid: enemy.uid,
            tookMs: pathMetrics.lastMs,
            startX,
            startY,
            endX,
            endY,
          });
        }
        return;
      }

      pathMetrics.success += 1;
      pathMetrics.lastPathLen = path.length;

      if (tookMs >= LOG_SLOW_PATH_MS) {
        pushLogEvent("pathfinding.slow", {
          enemyUid: enemy.uid,
          tookMs: pathMetrics.lastMs,
          pathLength: path.length,
          startX,
          startY,
          endX,
          endY,
        });
      }

      enemy.currentPath = path;
      enemy.currentPathIndex = 0;
    } catch (error) {
      pathMetrics.errors += 1;
      pushLogEvent("pathfinding.error", {
        enemyUid: enemy.uid,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      pathMetrics.inFlight = Math.max(0, pathMetrics.inFlight - 1);
    }
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
      navigationSystem.gridToWorldX(waypoint.x),
      enemy.worldPos.y,
      navigationSystem.gridToWorldZ(waypoint.y),
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
    applyActorAquaticY(enemy.worldPos, enemy.level);
    enemy.meshRoot.position = enemy.worldPos;
  };



































  const updateEnemyAI = (deltaSeconds: number) => {
    sliceEnemySystem.update(deltaSeconds);
  };

  const checkLevelDrift = () => {
    orchestrator.checkLevelDrift(playerState.getCurrentLevel());
  };

  /** Re-snap props/loot after floor slab height or tile binary becomes available. */
  const reanchorWorldContentOnLevel = (level: string) => {
    orchestrator.reanchorLevel(level);
  };

  const collectInteractableRevealTargets = (): InteractableRevealTarget[] => {
    const targets: InteractableRevealTarget[] = [];

    enemies.forEach((enemy) => {
      if (enemy.isDead || Math.abs(levelToWorldY(enemy.level) - levelToWorldY(getCurrentLevel())) > LEVEL_HEIGHT) {
        return;
      }

      const dx = enemy.worldPos.x - player.position.x;
      const dz = enemy.worldPos.z - player.position.z;
      if (dx * dx + dz * dz > WALL_REVEAL_TARGET_RADIUS_UNITS ** 2) {
        return;
      }

      const pickProxy = enemy.meshRoot
        .getChildMeshes()
        .find((mesh) => mesh.name.endsWith("-pick-proxy")) as Mesh | undefined;
      const pickWidth = pickProxy?.getBoundingInfo().boundingBox.extendSize.x
        ? pickProxy.getBoundingInfo().boundingBox.extendSize.x * 2
        : 1.2;
      const pickHeight = pickProxy?.getBoundingInfo().boundingBox.extendSize.y
        ? pickProxy.getBoundingInfo().boundingBox.extendSize.y * 2
        : 1.15;
      const pickCenterY = pickProxy?.position.y ?? 0.55;

      targets.push({
        id: enemy.uid,
        kind: "enemy",
        level: enemy.level,
        position: enemy.worldPos.clone(),
        pickWidth,
        pickHeight,
        pickCenterY,
        pickMetadata: { sliceEnemyUid: enemy.uid },
      });
    });

    doorSystem.doors.forEach((door) => {
      if (Math.abs(levelToWorldY(door.level) - levelToWorldY(getCurrentLevel())) > LEVEL_HEIGHT) {
        return;
      }

      const feetY = levelToWorldY(door.level);
      const doorHeight = doorSystem.DOOR_PANEL_HEIGHT;
      targets.push({
        id: door.uuid,
        kind: "door",
        level: door.level,
        position: new Vector3(
          door.tileX + 0.5,
          feetY,
          door.tileY + 0.5,
        ),
        pickWidth: door.hingeOnX ? 0.92 : 0.22,
        pickHeight: doorHeight,
        pickCenterY: WALK_SURFACE + doorHeight / 2,
        pickMetadata: { sliceDoorUuid: door.uuid },
      });
    });

    return targets;
  };

  const tryPickupPersistentItem = (
    item: DroppedItemData,
    requestedCount?: number,
  ): boolean => {
    const potentialContainerDef = WeaponRegistry.getWeaponDefinition(
      item.weaponId,
    );
    if (
      potentialContainerDef &&
      (potentialContainerDef.type === "container" ||
        ContainerRegistry.getContainer(potentialContainerDef.id))
    ) {
      const containerDef = ContainerRegistry.getContainer(
        potentialContainerDef.id,
      );
      if (containerDef) {
        playerState.openContainer(
          item.itemId,
          containerDef.id,
          t_game(containerDef.name as Parameters<typeof t_game>[0]),
          { x: item.x, y: item.y, level: getCurrentLevel() },
        );
        return true;
      }
    }

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
      const persistent = playerState.getPersistentDroppedItems(getCurrentLevel());
      const target = persistent.find((entry) => entry.itemId === item.itemId);
      if (target) {
        target.count = availableCount - pickupCount;
      }
    } else {
      playerState.removePersistentDroppedItem(getCurrentLevel(), item.itemId);
    }

    const def = WeaponRegistry.getWeaponDefinition(item.weaponId);
    const itemName = def ? t_game(`item_${def.id}` as Parameters<typeof t_game>[0]) : item.weaponId;
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

    dropSystem.droppedItemMeshes.forEach((mesh) => {
      if (!mesh.isEnabled()) return;

      const item = mesh.metadata as SliceDroppedItem | undefined;
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

    playerState.addPersistentDroppedItem(getCurrentLevel(), {
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
    const persistent = playerState.getPersistentDroppedItems(getCurrentLevel());
    const item = persistent.find((entry) => entry.itemId === payload.uid);
    if (!item) return;
    tryPickupPersistentItem(item, payload.count);
  };

  const waitForSpawnChunkReady = (timeoutMs = 12000): Promise<boolean> =>
    chunkSystem.waitForSpawnChunkReady(timeoutMs);

  const bootstrapWorldSession = async (retries = 3, baseDelayMs = 2000) => {
    pushLogEvent("world.bootstrap.start", { map: sliceMapName, level: getCurrentLevel() });
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          console.warn(`[3D Slice] Bootstrap attempt ${attempt + 1}/${retries + 1} after ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
        }

        await ensureMapLevelReady(getCurrentLevel());
        snapPlayerFootToActiveLevel();
        await waitForSpawnChunkReady();
        snapPlayerFootToActiveLevel();

        const tileX = Math.floor(player.position.x);
        const tileZ = Math.floor(player.position.z);
        const supportSymbol = getMapTileAt(getCurrentLevel(), tileX, tileZ);
        if (isVoidSymbol(supportSymbol)) {
          throw new Error(
            `[3D Slice] Invalid spawn tile (${tileX},${tileZ}) on level ${getCurrentLevel()}`,
          );
        }

        lastGroundedFootY = player.position.y;
        fallOriginFootY = player.position.y;
        isGrounded = true;
        holeFallLandingLevel = null;
        holeFallFloorCount = 0;
        verticalVelocity = 0;

        reanchorWorldContentOnLevel(getRenderLevel());
        propSystem.syncStream(true);

        worldBootstrapReady = true;
        setPlayerAvatarVisible(true);
        camera.setTarget(
          new Vector3(player.position.x, player.position.y, player.position.z),
        );

        resolveWorldReady?.();
        document.dispatchEvent(
          new CustomEvent("slice3d:worldBootstrap", {
            detail: { ready: true, map: sliceMapName, level: getCurrentLevel() },
          }),
        );
        pushLogEvent("world.bootstrap.ready", {
          x: Math.round(player.position.x * 100) / 100,
          y: Math.round(player.position.y * 100) / 100,
          z: Math.round(player.position.z * 100) / 100,
        });
        return;
      } catch (error) {
        console.error(`[3D Slice] World bootstrap failed (attempt ${attempt + 1})`, error);
        if (attempt >= retries) {
          document.dispatchEvent(
            new CustomEvent("slice3d:worldBootstrap", {
              detail: { ready: false, map: sliceMapName, error: String(error) },
            }),
          );
          pushLogEvent("world.bootstrap.failed", { error: String(error), attempts: attempt + 1 });
          return;
        }
      }
    }
  };

  void bootstrapWorldSession();
  // Seed all levels at bootstrap so content is available when Y-position changes levels.
  const seedLevelKeys = Object.keys((mapDataCache as SliceMapData | null)?.levels ?? {});
  void orchestrator.seedAllLevels(seedLevelKeys);
  orchestrator.dropSystem.syncStream(true);

  let inputManager: SliceInputManager;
  let ctx: SliceSceneContext;
  let sliceEnemySystem: SliceEnemySystem;
  let sliceCombatSystem: SliceCombatSystem;

  // Physics state — PlayerContext is the single source of truth
  const playerCtx = createPlayerContext(player.position.x, player.position.y, player.position.z);

  const FALL_DAMAGE_MIN_IMPACT_SPEED = 9.5;

  // Mirrors of playerCtx for backward compat with non-physics code
  let verticalVelocity = playerCtx.verticalVelocity;
  let isGrounded = playerCtx.isGrounded;
  let holeFallLandingLevel = playerCtx.holeFallLandingLevel;
  let holeFallFloorCount = playerCtx.holeFallFloorCount;
  let fallOriginFootY = playerCtx.fallOriginFootY;
  let wasOnVoidWithSafety = playerCtx.wasOnVoidWithSafety;
  let lastSafePlayerX = playerCtx.lastSafePositionX;
  let lastSafePlayerZ = playerCtx.lastSafePositionZ;
  let lastGroundedFootY = playerCtx.lastGroundedFootY;
  let levelTransitionCooldown = playerCtx.levelTransitionCooldown;
  let isPlayerDeathSequenceActive = false;
  let playerDeathTimeoutId: number | null = null;
  let verticalTransitionGuard: {
    untilMs: number;
    tileX: number;
    tileZ: number;
    fromLevel: string;
    toLevel: string;
  } | null = null;
  const CHUNK_UPDATE_INTERVAL = 0.2;
  const PERF_PUBLISH_INTERVAL = 0.25;
  // navigation timer managed internally by NavigationSystem
  let perfPublishTimer = 0;













  const setCameraMode = (
    firstPerson: boolean,
    shouldRequestPointerLock = false,
  ) => {
    isFirstPerson = firstPerson;
    projectileSystem.setFirstPersonMode(firstPerson);
    if (!firstPerson) {
      fpCombatCameraState = createFirstPersonCombatCameraState();
      firstPersonCamera.fov = FP_CAMERA_FOV;
      enemies.forEach((enemy) => {
        enemy.meshRoot.scaling.set(1, 1, 1);
      });
    }

    if (parseLevelNumber(getCurrentLevel()) < 0) {
      chunkSystem.clearAll();
      invalidateVerticalVisibilityCache();
      chunkSystem.tick(CHUNK_UPDATE_INTERVAL);
    }
    // S7-FP1: notify React overlay (crosshair) of camera mode change
    document.dispatchEvent(
      new CustomEvent("slice3d:cameraModeChanged", { detail: { firstPerson } }),
    );

    if (isFirstPerson) {
      heroBillboard.setEnabled(false);
      camera.detachControl();
      firstPersonCamera.position.set(
        player.position.x,
        player.position.y + FIRST_PERSON_EYE_ABOVE_FEET,
        player.position.z,
      );
      firstPersonCamera.rotation.y = bmsDirectionToFirstPersonYaw(heroDirection);
      scene.activeCamera = firstPersonCamera;
      topDownCaptureSuspendedForMenu = false;
      if (gameplayPaused) {
        fpCaptureSuspendedForMenu = true;
      } else {
        fpCaptureSuspendedForMenu = false;
        firstPersonCamera.attachControl(canvas, true);
        if (shouldRequestPointerLock) {
          inputManager.requestPointerLockIfPossible();
        }
      }
      return;
    }

    firstPersonCamera.detachControl();
    document.exitPointerLock?.();
    heroBillboard.setEnabled(true);
    setHeroDirection(
      firstPersonYawToBmsDirection(
        firstPersonCamera.rotation.y,
        heroDirection,
      ),
    );
    scene.activeCamera = camera;
    fpCaptureSuspendedForMenu = false;
    if (gameplayPaused) {
      topDownCaptureSuspendedForMenu = true;
    } else {
      topDownCaptureSuspendedForMenu = false;
      camera.attachControl(canvas, true);
    }
  };

  const setCanvasGameplayInputEnabled = (enabled: boolean) => {
    canvas.style.pointerEvents = enabled ? "auto" : "none";
    if (!enabled) {
      canvas.blur();
    }
  };

  const suspendCameraCaptureForMenu = () => {
    setCanvasGameplayInputEnabled(false);
    if (isFirstPerson) {
      document.exitPointerLock?.();
      firstPersonCamera.detachControl();
      fpCaptureSuspendedForMenu = true;
      topDownCaptureSuspendedForMenu = false;
      return;
    }
    camera.detachControl();
    topDownCaptureSuspendedForMenu = true;
    fpCaptureSuspendedForMenu = false;
  };

  const resumeCameraCaptureAfterMenu = () => {
    setCanvasGameplayInputEnabled(true);
    if (isFirstPerson && fpCaptureSuspendedForMenu) {
      fpCaptureSuspendedForMenu = false;
      scene.activeCamera = firstPersonCamera;
      firstPersonCamera.attachControl(canvas, true);
      return;
    }
    if (!isFirstPerson && topDownCaptureSuspendedForMenu) {
      topDownCaptureSuspendedForMenu = false;
      scene.activeCamera = camera;
      camera.attachControl(canvas, true);
    }
  };

  const handleGameplayPauseChanged = (paused: boolean) => {
    gameplayPaused = paused;
    inputManager?.clearPressedKeys();
    if (paused) {
      suspendCameraCaptureForMenu();
      return;
    }
    resumeCameraCaptureAfterMenu();
  };

  playerState.on("gameplayPauseChanged", handleGameplayPauseChanged);
  if (gameplayPaused) {
    handleGameplayPauseChanged(true);
  }

  const findVoidFallLanding = (
    startLevel: string,
    tileX: number,
    tileZ: number,
  ): { landingLevel: string; floors: number } | null => {
    const mapData = mapDataCache;
    if (!mapData?.levels) {
      return null;
    }

    const levelNumbers = Object.keys(mapData.levels)
      .map((levelKey) => parseLevelNumber(levelKey))
      .sort((a, b) => b - a);

    const startNumber = parseLevelNumber(startLevel);
    let floors = 0;

    for (const levelNumber of levelNumbers) {
      if (levelNumber >= startNumber) {
        continue;
      }

      floors += 1;
      const candidateLevel = String(levelNumber);
      const symbol = getMapTileAt(candidateLevel, tileX, tileZ);

      if (!isVoidSymbol(symbol)) {
        return { landingLevel: candidateLevel, floors };
      }
    }

    return null;
  };

  const calculateFallDamagePercent = (
    floors: number,
    impactSpeed: number,
  ): number => {
    const perFloor = Math.min(0.72, floors * 0.16);
    const speedBonus = Math.min(
      0.18,
      Math.max(0, Math.abs(impactSpeed) - 9) * 0.012,
    );
    return Math.min(0.9, perFloor + speedBonus);
  };

  const applyFallImpactDamage = (
    impactSpeed: number,
    floors: number,
    landingLevel: string,
  ) => {
    if (floors <= 0 && impactSpeed < FALL_DAMAGE_MIN_IMPACT_SPEED) {
      return;
    }

    const maxHealth = Math.max(1, playerState.getMaxHealth());
    let damagePercent = calculateFallDamagePercent(floors, impactSpeed);
    const landingAquatic = getAquaticSampleAt(
      player.position.x,
      player.position.z,
      landingLevel,
    );
    damagePercent *= computeFallDamageMultiplier(landingAquatic);
    const damage = Math.max(
      landingAquatic.mode === "swimming" ? 0 : 1,
      Math.floor(maxHealth * damagePercent),
    );

    const playerDied = playerState.takeDamage(damage);
    emitPlayerDamagePopup(
      `fall:${landingLevel}:${floors}`,
      damage,
      "⚠",
      "#ff5d5d",
    );

    const percentText = Math.round(damagePercent * 100).toString();
    playerState.log(
      "msg_fall_impact",
      {
        floors,
        damage,
        percent: percentText,
      },
      "#ff5d5d",
    );
    playerState.emit("uiNotification", {
      type: "danger",
      message: t_game("msg_fall_impact")
        .replace("{floors}", floors.toString())
        .replace("{damage}", damage.toString())
        .replace("{percent}", percentText),
    });

    if (playerDied) {
      triggerPlayerDeathSequence();
    }
  };

  const finishAirborneLanding = (
    landingLevel: string,
    landingFootY: number,
    impactSpeed: number,
    explicitFloors = 0,
  ) => {
    const dropDistance = Math.max(0, fallOriginFootY - landingFootY);
    const floorsFromDrop = Math.floor(
      dropDistance / LEVEL_HEIGHT + 0.12,
    );
    const floors = Math.max(explicitFloors, floorsFromDrop);
    if (
      floors <= 0 &&
      impactSpeed < FALL_DAMAGE_MIN_IMPACT_SPEED &&
      dropDistance < 0.55
    ) {
      fallOriginFootY = landingFootY;
      return;
    }
    applyFallImpactDamage(impactSpeed, floors, landingLevel);
    fallOriginFootY = landingFootY;
  };

  const resolveRespawnSpawn = (): { level: string; x: number; z: number } => {
    const mapData = mapDataCache;
    const fallback = { level: "0", x: 6.5, z: 6.5 };
    if (!mapData?.levels) {
      return fallback;
    }

    const levels = mapData.levels;
    const preferredLevel =
      mapData.config?.startLevel && levels[mapData.config.startLevel]
        ? mapData.config.startLevel
        : levels["0"]
          ? "0"
          :           Object.keys(levels).find((level) => levels[level]?.playerPos) ??
            getCurrentLevel();

    const playerPos = levels[preferredLevel]?.playerPos;
    if (!playerPos) {
      return fallback;
    }

    return {
      level: preferredLevel,
      x: worldToSliceCoord(playerPos.x),
      z: worldToSliceCoord(playerPos.y),
    };
  };

  const completePlayerRespawn = async () => {
    const respawn = resolveRespawnSpawn();

    playerState.respawn();
    inputManager.clearPressedKeys();
    setSelectedEnemy(null);
    projectileSystem.disposeAll();
    holeFallLandingLevel = null;
    holeFallFloorCount = 0;
    verticalVelocity = 0;
    isGrounded = true;
    levelTransitionCooldown = 0;
    verticalTransitionGuard = null;

    if (respawn.level !== getCurrentLevel()) {
      applyActiveLevelChange(respawn.level, {
        tileX: Math.floor(respawn.x),
        tileZ: Math.floor(respawn.z),
        landingLocalZ: respawn.z - Math.floor(respawn.z),
        guardMs: 0,
      });
      await ensureMapLevelReady(respawn.level);
    }

    playerState.setCurrentLevel(respawn.level);
    WorldMapService.ensureLevelBuffer(respawn.level);
    player.position.x = respawn.x;
    player.position.z = respawn.z;
    snapPlayerFootToActiveLevel();
    lastSafePlayerX = player.position.x;
    lastSafePlayerZ = player.position.z;
    lastGroundedFootY = player.position.y;
    playerState.recordPlayerPosition(
      respawn.level,
      player.position.x * 32,
      player.position.z * 32,
    );
    enemySystem.resetLivingForPlayerRespawn();
    setHeroAnimState("idle");
    heroAnimLockedUntil = 0;
    isPlayerDeathSequenceActive = false;
    playerDeathTimeoutId = null;
  };

  const triggerPlayerDeathSequence = () => {
    if (isPlayerDeathSequenceActive) {
      return;
    }

    isPlayerDeathSequenceActive = true;
    inputManager.clearPressedKeys();
    setSelectedEnemy(null);
    if (isFirstPerson) {
      setCameraMode(false, false);
    }
    heroBillboard.setEnabled(true);
    heroShadow.setEnabled(true);
    audioManager.playHeroDeath();
    setHeroAnimState("death", PLAYER_DEATH_SEQUENCE_MS);

    if (playerDeathTimeoutId !== null) {
      window.clearTimeout(playerDeathTimeoutId);
    }
    playerDeathTimeoutId = window.setTimeout(() => {
      void completePlayerRespawn();
    }, PLAYER_DEATH_SEQUENCE_MS);
  };

  // Activate first-person mode if URL contains ?fp=1
  if (searchParams.get("fp") === "1") {
    setCameraMode(true, false);
  }

  // S8-T2: dispatch rune slot state to React HUD
  const dispatchRuneSlotUpdate = () => {
    const slots = playerState.getEquippedRuneSlots();
    document.dispatchEvent(
      new CustomEvent("slice3d:runeSlotChanged", {
        detail: { slots, activeIndex: activeRuneSlotIndex },
      }),
    );
  };

  ctx = {
    get engine() { return engine; },
    get scene() { return scene; },
    get canvas() { return canvas; },
    get player() { return player; },
    get playerCtx() { return playerCtx; },
    get playerState() { return playerState; },
    get camera() { return camera; },
    get firstPersonCamera() { return firstPersonCamera; },
    get audioManager() { return audioManager; },
    get collisionWorld() { return collisionWorld; },
    get enemies() { return enemies; },
    get isFirstPerson() { return isFirstPerson; },
    set isFirstPerson(v) { isFirstPerson = v; },
    get gameplayPaused() { return gameplayPaused; },
    set gameplayPaused(v) { gameplayPaused = v; },
    get debugCollidersVisible() { return debugCollidersVisible; },
    set debugCollidersVisible(v) { debugCollidersVisible = v; },
    get mapDataCache() { return mapDataCache; },
    set mapDataCache(v) { mapDataCache = v; },
    get currentMapWidth() { return currentMapWidth; },
    set currentMapWidth(v) { currentMapWidth = v; },
    get currentMapHeight() { return currentMapHeight; },
    set currentMapHeight(v) { currentMapHeight = v; },
    get selectedEnemyUid() { return selectedEnemyUid; },
    set selectedEnemyUid(v) { selectedEnemyUid = v; },
    setSelectedEnemy(v) { setSelectedEnemy(v); },
    get activeRuneSlotIndex() { return activeRuneSlotIndex; },
    set activeRuneSlotIndex(v) { activeRuneSlotIndex = v; },
    get runeTargetingMode() { return runeTargetingMode; },
    set runeTargetingMode(v) { runeTargetingMode = v; },
    get targetingRuneId() { return targetingRuneId; },
    set targetingRuneId(v) { targetingRuneId = v; },
  };

  sliceCombatSystem = new SliceCombatSystem({
    ctx,
    projectileSystem,
    destroyEnemy,
    emitBloodBurst,
    emitPlayerDamagePopup,
    triggerPlayerDeathSequence,
    hasLineOfSight,
    onPlayerAttackStarted: (enemy, isRanged) => {
      setHeroAnimState("attack", 320);
      if (!isRanged) {
        triggerPlayerAttackSlashEffect(enemy);
      }
    },
  });

  sliceEnemySystem = new SliceEnemySystem({
    ctx,
    applyEnemyAttackToPlayer: (enemy, now) =>
      sliceCombatSystem.applyEnemyAttackToPlayer(enemy, now),
    tryEnemyMagicAttack: (enemy, now) =>
      sliceCombatSystem.tryEnemyMagicAttack(enemy, now),
    requestEnemyPath: (enemy, targetPos) => requestEnemyPath(enemy, targetPos),
    advanceEnemyPath: (enemy, deltaSeconds) => advanceEnemyPath(enemy, deltaSeconds),
    applyActorAquaticY: (worldPos, level) => applyActorAquaticY(worldPos, level),
    getAquaticSampleAt: (x, z, level) => getAquaticSampleAt(x, z, level),
    levelToWorldY: (level) => levelToWorldY(level),
    getCurrentLevel: () => getCurrentLevel(),
    hasLineOfSight: (origin, target) => hasLineOfSight(origin, target),
    setSelectedEnemy: (uid) => setSelectedEnemy(uid),
    getSelectedEnemy: () => selectedEnemyUid,
  });

  inputManager = new SliceInputManager({
    canvas,
    isPaused: () => gameplayPaused,
    isPlayerDeathSequenceActive: () => isPlayerDeathSequenceActive,
    isFirstPerson: () => isFirstPerson,
    ensureAudioReady: () => ensureAudioReady(),
    onCastRune: () => sliceCombatSystem.castRune3d(),
    onCycleRuneSlot: () => {
      activeRuneSlotIndex = (activeRuneSlotIndex + 1) % 3;
      dispatchRuneSlotUpdate();
    },
    onToggleDebugColliders: () => {
      debugCollidersVisible = !debugCollidersVisible;
      rebuildDebugColliderMeshes();
      // eslint-disable-next-line no-console
      console.warn(`[DEBUG] Collision visualization: ${debugCollidersVisible ? "ON" : "OFF"}`);
    },
    onToggleCameraMode: (newFP: boolean) => {
      if (newFP) {
        // eslint-disable-next-line no-console
        console.warn(
          "[DEBUG] Entering first-person mode — debug-only camera. Top-down is the product view.",
        );
      }
      setCameraMode(newFP, newFP);
    },
    onCycleCameraPreset: () => {
      const nextPreset: TopDownCameraPreset =
        activeTopDownCameraPreset === "safe" ? "cinematic" : "safe";
      applyTopDownCameraPreset(nextPreset);
    },
    onToggleFallSafety: () => {
      const safetyEnabled = playerState.toggleFallSafety();
      playerState.emit("uiNotification", {
        type: safetyEnabled ? "info" : "warning",
        message: t_game(safetyEnabled ? "fall_safety_on" : "fall_safety_off"),
      });
    },
    onInteract: () => {
      const pickedRealItem = tryPickupNearestItem();
      if (pickedRealItem) {
        orchestrator.dropSystem.syncStream(true);
        return;
      }

      if (doorSystem.tryInteractNearbyDoorRespectingPickup(playerState.pickupRange / 32, getNearestPickupItemDistance())) {
        return;
      }

      if (!dropSystem.hasRealDroppedItems) {
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
  });







  playerState.on("dropItem", handleDropItem);
  playerState.on("requestPickup", handleRequestPickup);
  playerState.on("spawnDroppedItem", addDroppedItemFromEvent);
  // S11-T1: listen for rune targeting from menu
  playerState.on("prepareRuneCast", (runeId: string) => {
    runeTargetingMode = true;
    targetingRuneId = runeId;
    playerState.emit("uiNotification", {
      type: "info",
      message: t_game("msg_select_target"),
    });
  });
  playerState.on("cancelRuneCast", () => {
    runeTargetingMode = false;
    targetingRuneId = null;
  });
  // S8-T2: emit initial rune slot state so React HUD can show slots on load
  dispatchRuneSlotUpdate();














  const pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
    if (gameplayPaused || isPlayerDeathSequenceActive) {
      return;
    }
    if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) {
      return;
    }

    const isRightClick = pointerInfo.event.button === 2;
    const isLeftClick = pointerInfo.event.button === 0;

    // S11-T1: Handle rune targeting mode (Opção A parity)
    if (runeTargetingMode && targetingRuneId && isLeftClick) {
      const pointerX = isFirstPerson
        ? engine.getRenderWidth() / 2
        : scene.pointerX;
      const pointerY = isFirstPerson
        ? engine.getRenderHeight() / 2
        : scene.pointerY;

      const enemyUid = resolveEnemyUidFromPointer(pointerX, pointerY);
      if (enemyUid) {
        const targetEnemy = enemies.get(enemyUid);
        if (targetEnemy && !targetEnemy.isDead) {
          sliceCombatSystem.castRuneAtTarget(targetEnemy.uid);
          return;
        }
      }

      playerState.emit("message", t_game("msg_target_obstructed"));
      return;
    }

    // S9-T3: in FP mode both left and right click pick from screen center (crosshair aim)
    const pointerX = isFirstPerson
      ? engine.getRenderWidth() / 2
      : scene.pointerX;
    const pointerY = isFirstPerson
      ? engine.getRenderHeight() / 2
      : scene.pointerY;

    if (isFirstPerson && !isLeftClick && !isRightClick) {
      return;
    }
    if (!isFirstPerson && !isRightClick) {
      return;
    }

    const enemyUid = resolveEnemyUidFromPointer(pointerX, pointerY);

    if (enemyUid && enemies.has(enemyUid)) {
      setSelectedEnemy(enemyUid);
      return;
    }

    const pickedDoorUuid = resolveDoorUuidFromPointer(pointerX, pointerY);
    if (
      pickedDoorUuid &&
      isRightClick &&
      doorSystem.tryInteractPickedDoor(pickedDoorUuid)
    ) {
      return;
    }

    if (isRightClick) {
      doorSystem.tryInteractNearbyDoorRespectingPickup(playerState.pickupRange / 32, getNearestPickupItemDistance());
      return;
    }

    setSelectedEnemy(null);
  });

  scene.onBeforeRenderObservable.add(() => {
    if (gameplayPaused) {
      return;
    }
    if (isPlayerDeathSequenceActive) {
      return;
    }

    const deltaSeconds = engine.getDeltaTime() / 1000;

    if (!worldBootstrapReady) {
      chunkSystem.tick(deltaSeconds);
      return;
    }

    const tFrameStart = performance.now();
    let mapTimeAccum = 0;
    let enemyTimeAccum = 0;
    let physicsTimeAccum = 0;

    let tStart = tFrameStart;

    checkLevelDrift();
    tStart = performance.now();
    orchestrator.tick(deltaSeconds);

    navigationSystem.tick(deltaSeconds);
    mapTimeAccum += performance.now() - tStart;

    // Animate active slash trails
    const deltaMs = engine.getDeltaTime();
    for (let i = activeSlashtrails.length - 1; i >= 0; i--) {
      const slash = activeSlashtrails[i];
      slash.elapsed += deltaMs;
      const ratio = slash.elapsed / slash.duration;
      if (ratio >= 1) {
        slash.mesh.dispose();
        slash.material.dispose();
        slash.texture.dispose();
        activeSlashtrails.splice(i, 1);
      } else {
        const currentScale = slash.startScale + (slash.endScale - slash.startScale) * ratio;
        slash.mesh.scaling.set(currentScale, currentScale, currentScale);
        slash.mesh.visibility = 1.0 - ratio;
      }
    }

    // S10-T1: Parity with 2D — tick PlayerState for hunger decay, HP regen and buff timers.
    playerState.update(performance.now(), engine.getDeltaTime());

    // Chunk streaming: update at most every CHUNK_UPDATE_INTERVAL seconds
    chunkSystem.tick(deltaSeconds);

    const chunkStats = window.__slice3dChunkStreaming || {};
    const unloadedThisTick = chunkStats.unloadedThisTick || 0;
    if (unloadedThisTick > 0 && previousHeapUsedMb !== undefined) {
      unloadCheckpoints.push({
        atSec: getElapsedSec(),
        heapMb: previousHeapUsedMb,
        resolved: false,
        succeeded: false,
      });
      if (unloadCheckpoints.length > 100) {
        unloadCheckpoints.shift();
      }
    }

    const movementInput = inputManager.getMovementInput();
    let moveForward = movementInput.moveForward;
    let moveRight = movementInput.moveRight;
    mapTimeAccum += performance.now() - tStart;

    tStart = performance.now();
    const aquaticSample = getAquaticSampleAt(
      player.position.x,
      player.position.z,
      getCurrentLevel(),
    );
    const speed = 4.5 * aquaticSample.speedMultiplier;








    const isMoving = moveForward !== 0 || moveRight !== 0;
    const movementStartX = player.position.x;
    const movementStartZ = player.position.z;
    const nowMs = Date.now();
    if (nowMs >= heroAnimLockedUntil) {
      if (isMoving) {
        setHeroDirection(
          resolveHeroBmsDirection(moveForward, moveRight, heroDirection),
        );
        setHeroAnimState("walk");
      } else {
        setHeroAnimState("idle");
      }
    }

    // ── Physics tick ───────────────────────────────────────────────────────
    {
      // Compute world-space movement direction from camera-relative input
      let worldDx = 0;
      let worldDz = 0;
      if (isMoving) {
        let movement = Vector3.Zero();
        if (isFirstPerson) {
          const yaw = firstPersonCamera.rotation.y;
          const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
          const right = new Vector3(forward.z, 0, -forward.x);
          movement = forward.scale(moveForward).add(right.scale(moveRight));
        } else {
          const engineRef = scene.getEngine();
          const viewport = camera.viewport.toGlobal(
            engineRef.getRenderWidth(),
            engineRef.getRenderHeight(),
          );
          const origin = player.position.clone();
          const screenOrigin = Vector3.Project(origin, Matrix.Identity(), scene.getTransformMatrix(), viewport);
          const screenX = Vector3.Project(origin.add(new Vector3(1, 0, 0)), Matrix.Identity(), scene.getTransformMatrix(), viewport);
          const screenZ = Vector3.Project(origin.add(new Vector3(0, 0, 1)), Matrix.Identity(), scene.getTransformMatrix(), viewport);
          const basisX = new Vector2(screenX.x - screenOrigin.x, screenX.y - screenOrigin.y);
          const basisZ = new Vector2(screenZ.x - screenOrigin.x, screenZ.y - screenOrigin.y);
          const desired = new Vector2(moveRight, -moveForward);
          const det = basisX.x * basisZ.y - basisX.y * basisZ.x;
          if (Math.abs(det) > 1e-6) {
            const wdx = (desired.x * basisZ.y - desired.y * basisZ.x) / det;
            const wdz = (basisX.x * desired.y - basisX.y * desired.x) / det;
            movement = new Vector3(wdx, 0, wdz);
          } else {
            const cameraForward = camera.target.subtract(camera.position);
            cameraForward.y = 0;
            if (cameraForward.lengthSquared() > 1e-6) {
              cameraForward.normalize();
              const cameraRight = new Vector3(cameraForward.z, 0, -cameraForward.x);
              movement = cameraForward.scale(moveForward).add(cameraRight.scale(moveRight));
            }
          }
        }
        const len = movement.length();
        if (len > 0.001) {
          worldDx = movement.x / len;
          worldDz = movement.z / len;
        }
      }

      // Sync fall-safety from PlayerState to physics context
      playerCtx.isFallSafetyEnabled = playerState.isFallSafetyEnabled();

      const physicsInput: PhysicsInput = {
        moveX: worldDx,
        moveZ: worldDz,
        deltaSeconds,
        jumpPressed: inputManager.consumeJumpRequested(),
        sprintHeld: inputManager.isKeyPressed("shift"),
        speedMultiplier: aquaticSample.speedMultiplier,
      };


      tickPhysics(playerCtx, physicsInput, collisionWorld, {
        getMapTileAt,
        getTileDef: (symbol: string | null) =>
          symbol ? mapDataCache?.tileDefinitions?.[symbol] : undefined,
        hasLevel: (level: string) => Boolean(mapDataCache?.levels?.[level]),
        allLevels: () => Object.keys(mapDataCache?.levels ?? {}),
        getMapWidth: () => currentMapWidth,
        getMapHeight: () => currentMapHeight,
        parseLevelNumber,
      }, {
        onFallSafetyActive: (_ctx) => {
          playerState.emit("uiNotification", {
            type: "warning",
            message: t_game("fall_safety_active"),
          });
        },
        onHoleTransition: (_fromLevel, toLevel, transition) => {
          applyActiveLevelChange(toLevel, transition);
        },
        onNaturalLevelTransition: (toLevel) => {
          applyActiveLevelChange(toLevel, undefined, { natural: true });
        },
        onGrounded: (_ctx, impactSpeed) => {
          finishAirborneLanding(
            getCurrentLevel(),
            playerCtx.position.y,
            impactSpeed,
            playerCtx.holeFallFloorCount,
          );
        },
        onJump: () => {
          audioManager.playJump();
        },
      });

      // Sync player mesh position
      player.position.x = playerCtx.position.x;
      player.position.y = playerCtx.position.y;
      player.position.z = playerCtx.position.z;

      // Sync local mirrors for non-physics code
      verticalVelocity = playerCtx.verticalVelocity;
      isGrounded = playerCtx.isGrounded;
      holeFallLandingLevel = playerCtx.holeFallLandingLevel;
      holeFallFloorCount = playerCtx.holeFallFloorCount;
      fallOriginFootY = playerCtx.fallOriginFootY;
      wasOnVoidWithSafety = playerCtx.wasOnVoidWithSafety;
      lastSafePlayerX = playerCtx.lastSafePositionX;
      lastSafePlayerZ = playerCtx.lastSafePositionZ;
      lastGroundedFootY = playerCtx.lastGroundedFootY;
      levelTransitionCooldown = playerCtx.levelTransitionCooldown;
    }
    physicsTimeAccum += performance.now() - tStart;

    const consumeFootstep = (heroSpriteMat as HeroSpriteMaterial)._consumeFootstepTick;
    if (typeof consumeFootstep === "function" && consumeFootstep()) {
      audioManager.playFootstep("floor", true);
    }

    physicsTimeAccum += performance.now() - tStart;

    tStart = performance.now();
    updateEnemyAI(deltaSeconds);
    enemyTimeAccum += performance.now() - tStart;

    tStart = performance.now();
    if (!gameplayPaused) {
      projectileSystem.update(deltaSeconds);
    }
    sliceCombatSystem.tryAutoPlayerAttack(Date.now());
    physicsTimeAccum += performance.now() - tStart;

    perfPublishTimer += deltaSeconds;
    if (perfPublishTimer >= PERF_PUBLISH_INTERVAL) {
      perfPublishTimer = 0;

      const drawCalls = sceneInstrumentation.drawCallsCounter.current;
      const activeMeshes = scene.getActiveMeshes().length;
      const totalMeshes = scene.meshes.length;
      const totalMaterials = scene.materials.length;
      const totalTextures = scene.textures.length;
      const totalVertices = scene.getTotalVertices();

      const perfMem = performance.memory;
      const usedHeapMb = perfMem
        ? Math.round((perfMem.usedJSHeapSize / (1024 * 1024)) * 10) / 10
        : undefined;
      const totalHeapMb = perfMem
        ? Math.round((perfMem.totalJSHeapSize / (1024 * 1024)) * 10) / 10
        : undefined;

      const chunkStats = window.__slice3dChunkStreaming || {};

      playerState.updatePerfMetrics({
        fps: Math.round(engine.getFps()),
        totalUpdateTime: Math.round((mapTimeAccum + enemyTimeAccum + physicsTimeAccum) * 10) / 10,
        mapTime: Math.round(mapTimeAccum * 10) / 10,
        enemyTime: Math.round(enemyTimeAccum * 10) / 10,
        physicsTime: Math.round(physicsTimeAccum * 10) / 10,
        activeEnemies: Array.from(enemies.values()).filter(
          (e) => !e.isDead && Math.abs(levelToWorldY(e.level) - levelToWorldY(getCurrentLevel())) <= LEVEL_HEIGHT && Vector3.Distance(e.worldPos, player.position) <= ENEMY_AI_RADIUS_UNITS,
        ).length,
        renderedTiles: chunkSystem.loadedChunks.size * CHUNK_SIZE * CHUNK_SIZE,
        totalObjects: activeMeshes,
        poolSize: chunkSystem.loadedChunks.size,
        drawCalls,
        activeMeshes,
        totalMeshes,
        totalMaterials,
        totalTextures,
        totalVertices,
        jsHeapUsedMb: usedHeapMb,
        jsHeapTotalMb: totalHeapMb,
        chunkLoaded: chunkStats.loadedChunks || chunkSystem.loadedChunks.size,
        chunkLoading: chunkStats.loadingChunks || chunkSystem.loadingChunks.size,
      });

      window.__slice3dPerfDiagnostics = {
        fps: Math.round(engine.getFps()),
        frameMs: Math.round(engine.getDeltaTime() * 10) / 10,
        drawCalls,
        activeMeshes,
        totalMeshes,
        totalMaterials,
        totalTextures,
        totalVertices,
        jsHeapUsedMb: usedHeapMb,
        jsHeapTotalMb: totalHeapMb,
        chunkLoaded: chunkStats.loadedChunks || chunkSystem.loadedChunks.size,
        chunkLoading: chunkStats.loadingChunks || chunkSystem.loadingChunks.size,
        pendingChunkCandidates: chunkStats.pendingCandidates || 0,
        pendingChunkUnloads: chunkStats.pendingUnloads || 0,
        streamedDroppedItems: dropSystem.droppedItemMeshes.size,
        streamedEnemies: enemies.size,
        catalogedEnemies: enemySpawnCatalog.size,
        streamedProps: propSystem.getProps().size,
        catalogedProps: propSystem.getDebugInfo().cataloged,
        navWindowTiles: navigationSystem.gridSize,
        currentLevel: getCurrentLevel(),
        qualityPreset: playerState.getDisplaySettings().qualityPreset,
        topDownDrawRadiusChunks,
        enemyStreamRadiusUnits: enemySystem.enemyStreamRadiusUnits,
        propStreamRadiusUnits: propSystem.propStreamRadiusUnits,
        ts: Date.now(),
      };
      window.__slice3dPerf = window.__slice3dPerfDiagnostics;
    }

    telemetryLogTimer += deltaSeconds;
    telemetryPersistTimer += deltaSeconds;
    if (telemetryEnabled && telemetryLogTimer >= LOG_SAMPLE_INTERVAL) {
      telemetryLogTimer = 0;

      const chunkStats = window.__slice3dChunkStreaming || {};
      const perfMem = performance.memory;
      const usedHeapMb = perfMem
        ? Math.round((perfMem.usedJSHeapSize / (1024 * 1024)) * 10) / 10
        : undefined;
      const totalHeapMb = perfMem
        ? Math.round((perfMem.totalJSHeapSize / (1024 * 1024)) * 10) / 10
        : undefined;
      const heapDeltaMb =
        usedHeapMb !== undefined && previousHeapUsedMb !== undefined
          ? Math.round((usedHeapMb - previousHeapUsedMb) * 10) / 10
          : undefined;
      previousHeapUsedMb = usedHeapMb;

      const drawCalls = sceneInstrumentation.drawCallsCounter.current;

      let activeEnemies = 0;
      let visibleEnemies = 0;
      let aiActiveEnemies = 0;
      enemies.forEach((enemy) => {
        if (enemy.isDead || Math.abs(levelToWorldY(enemy.level) - levelToWorldY(getCurrentLevel())) > LEVEL_HEIGHT) return;
        const distance = Vector3.Distance(enemy.worldPos, player.position);
        if (distance <= ENEMY_AI_RADIUS_UNITS) {
          activeEnemies += 1;
        }
        if (distance <= ENEMY_VISIBILITY_RADIUS_UNITS) {
          visibleEnemies += 1;
        }
        if (distance <= ENEMY_AI_RADIUS_UNITS) {
          aiActiveEnemies += 1;
        }
      });

      const sample: Slice3DLogSample = {
        ts: Date.now(),
        elapsedSec: getElapsedSec(),
        currentLevel: getCurrentLevel(),
        player: {
          x: Math.round(player.position.x * 100) / 100,
          y: Math.round(player.position.y * 100) / 100,
          z: Math.round(player.position.z * 100) / 100,
          tileX: Math.floor(player.position.x),
          tileZ: Math.floor(player.position.z),
          chunkX: Math.floor(player.position.x / CHUNK_SIZE),
          chunkZ: Math.floor(player.position.z / CHUNK_SIZE),
        },
        perf: {
          fps: Math.round(engine.getFps()),
          frameMs: Math.round(engine.getDeltaTime() * 10) / 10,
          drawCalls,
          activeMeshes: scene.getActiveMeshes().length,
          totalMeshes: scene.meshes.length,
          totalTextures: scene.textures.length,
          totalVertices: scene.getTotalVertices(),
          jsHeapUsedMb: usedHeapMb,
          jsHeapTotalMb: totalHeapMb,
          heapDeltaMb,
        },
        chunks: {
          loaded: chunkStats.loadedChunks || chunkSystem.loadedChunks.size,
          loading: chunkStats.loadingChunks || chunkSystem.loadingChunks.size,
          pendingCandidates: chunkStats.pendingCandidates || 0,
          pendingUnloads: chunkStats.pendingUnloads || 0,
          builtThisTick: chunkStats.builtThisTick || 0,
          unloadedThisTick: chunkStats.unloadedThisTick || 0,
        },
        enemies: {
          activeOnLevel: activeEnemies,
          visibleOnLevel: visibleEnemies,
          aiActiveOnLevel: aiActiveEnemies,
          selectedEnemyUid,
        },
        items: {
          streamedDroppedItems: dropSystem.droppedItemMeshes.size,
          hasRealDroppedItems: dropSystem.hasRealDroppedItems,
        },
        pathfinding: {
          requests: pathMetrics.requests,
          success: pathMetrics.success,
          failed: pathMetrics.failed,
          errors: pathMetrics.errors,
          inFlight: pathMetrics.inFlight,
          avgMs:
            pathMetrics.requests > 0
              ? Math.round((pathMetrics.totalMs / pathMetrics.requests) * 100) /
                100
              : 0,
          maxMs: Math.round(pathMetrics.maxMs * 100) / 100,
          lastMs: pathMetrics.lastMs,
          lastPathLen: pathMetrics.lastPathLen,
        },
      };

      if (runtimeLog.samples.length >= LOG_MAX_SAMPLES) {
        runtimeLog.samples.shift();
        runtimeLog.counters.samplesDropped += 1;
      }
      runtimeLog.samples.push(sample);

      pushBounded(frameMsWindow, sample.perf.frameMs, LOG_FRAME_WINDOW_MAX);
      if (sample.pathfinding.lastMs > 0) {
        pushBounded(
          pathMsWindow,
          sample.pathfinding.lastMs,
          LOG_PATH_WINDOW_MAX,
        );
      }

      if (sample.perf.jsHeapUsedMb !== undefined) {
        heapHistory.push({
          elapsedSec: sample.elapsedSec,
          usedMb: sample.perf.jsHeapUsedMb,
        });
        const cutoff = sample.elapsedSec - LOG_HEAP_WINDOW_SECONDS;
        while (heapHistory.length && heapHistory[0].elapsedSec < cutoff) {
          heapHistory.shift();
        }

        unloadCheckpoints.forEach((checkpoint) => {
          if (checkpoint.resolved) {
            return;
          }

          const elapsedSinceUnload = sample.elapsedSec - checkpoint.atSec;
          const droppedEnough =
            sample.perf.jsHeapUsedMb! <= checkpoint.heapMb - 1;
          if (droppedEnough) {
            checkpoint.resolved = true;
            checkpoint.succeeded = true;
            return;
          }

          if (elapsedSinceUnload >= LOG_UNLOAD_RECOVERY_GRACE_SECONDS) {
            checkpoint.resolved = true;
            checkpoint.succeeded = false;
            chunkUnloadRecoveryFailures += 1;
            pushLogEvent("memory.unload-recovery-failed", {
              atSec: checkpoint.atSec,
              baselineHeapMb: checkpoint.heapMb,
              currentHeapMb: sample.perf.jsHeapUsedMb,
              elapsedSec: Math.round(elapsedSinceUnload * 100) / 100,
            });
          }
        });
      }

      const chunkKey = `${sample.currentLevel}:${sample.player.chunkX}_${sample.player.chunkZ}`;
      const chunkEntry = chunkHotspots.get(chunkKey) || {
        level: sample.currentLevel,
        chunkX: sample.player.chunkX,
        chunkZ: sample.player.chunkZ,
        samples: 0,
        frameMsAcc: 0,
        drawCallsAcc: 0,
        activeMeshesAcc: 0,
        verticesAcc: 0,
        maxHeapUsedMb: 0,
        maxPathMs: 0,
      };
      chunkEntry.samples += 1;
      chunkEntry.frameMsAcc += sample.perf.frameMs;
      chunkEntry.drawCallsAcc += sample.perf.drawCalls;
      chunkEntry.activeMeshesAcc += sample.perf.activeMeshes;
      chunkEntry.verticesAcc += sample.perf.totalVertices;
      chunkEntry.maxHeapUsedMb = Math.max(
        chunkEntry.maxHeapUsedMb,
        sample.perf.jsHeapUsedMb || 0,
      );
      chunkEntry.maxPathMs = Math.max(
        chunkEntry.maxPathMs,
        sample.pathfinding.lastMs,
      );
      chunkHotspots.set(chunkKey, chunkEntry);

      if ((sample.perf.heapDeltaMb || 0) <= -8) {
        pushLogEvent("memory.gc-like-drop", {
          heapDeltaMb: sample.perf.heapDeltaMb,
          usedMb: sample.perf.jsHeapUsedMb,
        });
      }

      if (sample.chunks.pendingCandidates > 16) {
        pushLogEvent("chunk.backlog", {
          pendingCandidates: sample.chunks.pendingCandidates,
          loaded: sample.chunks.loaded,
          loading: sample.chunks.loading,
        });
      }

      window.__slice3dLogsData = {
        latestSample: sample,
        totalSamples: runtimeLog.samples.length,
        totalEvents: runtimeLog.events.length,
        counters: runtimeLog.counters,
        summary: buildSummary(),
        topHotspots: buildHotspots(5),
      };
    }

    if (telemetryEnabled && telemetryPersistTimer >= LOG_PERSIST_INTERVAL) {
      telemetryPersistTimer = 0;
      persistRuntimeLogs();
    }

    if (telemetryEnabled) {
      telemetryFileFlushTimer += deltaSeconds;
      if (telemetryFileFlushTimer >= LOG_FILE_FLUSH_INTERVAL) {
        telemetryFileFlushTimer = 0;
        void flushRuntimeLogsToFile(false);
      }
    }

    // Target highlight: warm sprite + amber floor spot + head chevron.
    enemyHighlightPulseT += deltaSeconds;
    if (selectedEnemyUid) {
      const selectedEnemy = enemies.get(selectedEnemyUid);
      if (!selectedEnemy || selectedEnemy.isDead) {
        setSelectedEnemy(null);
      } else {
        const pulse =
          (Math.sin(enemyHighlightPulseT * Math.PI * 1.8) * 0.5 + 0.5) * 0.22;
        applyEnemyTargetVisual(selectedEnemy.meshRoot, pulse, {
          current: selectedEnemy.health,
          max: selectedEnemy.maxHealth,
        });

        const nowMs = Date.now();
        if (nowMs - lastFocusedCombatHealthSyncAt >= 250) {
          lastFocusedCombatHealthSyncAt = nowMs;
          playerState.emit("combatEnemyHealthChanged", {
            uid: selectedEnemy.uid,
            health: selectedEnemy.health,
            maxHealth: selectedEnemy.maxHealth,
          });
        }
      }
    }

    // Keep-alive: sync side effects to current level (handled by events, but safe backstop)
    if (isGrounded && !holeFallLandingLevel && !isPlayerOverVoidAtLevel(getCurrentLevel())) {
      syncLevelSideEffects();
    }

    const playerAquatic = getAquaticSampleAt(
      player.position.x,
      player.position.z,
      getCurrentLevel(),
    );
    heroAquaticTint.update(playerAquatic);
    if (
      playerAquatic.mode !== "dry" &&
      lastPlayerAquaticMode === "dry"
    ) {
      audioManager.playSplash();
    }
    lastPlayerAquaticMode = playerAquatic.mode;
    const aquaticPreset = getAquaticVisualPreset(playerAquatic.mode);
    heroShadowMat.alpha = aquaticPreset
      ? 0.32 * aquaticPreset.shadowScale
      : 0.32;

    // R1/R2: after movement — hide upper floors covering the hero.
    syncVerticalLevelVisibility(deltaSeconds);
    // Hide wall meshes on visible levels that intersect the camera→hero ray.
    hideWallsOnRay();

    if (isFirstPerson) {
      heroBillboard.setEnabled(false);
      heroShadow.setEnabled(false);

      let combatTargetPos: Vector3 | null = null;
      if (selectedEnemyUid) {
        const focused = enemies.get(selectedEnemyUid);
        if (focused && !focused.isDead) {
          combatTargetPos = focused.worldPos;
        }
      }
      const fpCamera = updateFirstPersonCombatCamera(
        firstPersonCamera.rotation.y,
        player.position,
        FIRST_PERSON_EYE_ABOVE_FEET,
        combatTargetPos,
        deltaSeconds,
        fpCombatCameraState,
      );
      fpCombatCameraState = fpCamera.state;
      firstPersonCamera.position.copyFrom(fpCamera.position);
      firstPersonCamera.fov = fpCamera.fov;

      playerState.exploreArea(
        getRenderLevel(),
        Math.floor(player.position.x),
        Math.floor(player.position.z),
        8,
        currentMapWidth,
        currentMapHeight,
      );
      playerState.recordPlayerPosition(
        getCurrentLevel(),
        player.position.x * 32,
        player.position.z * 32,
      );
      return;
    }

    wallRevealSystem.update(
      true,
      player.position,
      getRenderLevel(),
      collectInteractableRevealTargets(),
      (fromWorldX, fromWorldZ, toWorldX, toWorldZ) =>
        findFirstBlockingTileOnWorldLine(
          fromWorldX,
          fromWorldZ,
          toWorldX,
          toWorldZ,
          isTileBlockedForGameplay,
          { skipStart: true },
        ) === null,
      deltaSeconds,
      WALK_SURFACE + 0.025,
    );

    heroBillboard.setEnabled(true);
    heroShadow.setEnabled(true);
    heroShadow.position.set(
      player.position.x,
      getGroundSurfaceY(player.position.x, player.position.z, getRenderLevel()) +
        0.01,
      player.position.z,
    );

    // Top-down product mode: hero stays screen-centered (Diablo/PoE-style).
    // Lazy lerp made fast movement feel like the character "outruns" the camera.
    camera.setTarget(
      new Vector3(player.position.x, player.position.y, player.position.z),
    );

    const currentLevel = getCurrentLevel();
    playerState.exploreArea(
      currentLevel,
      Math.floor(player.position.x),
      Math.floor(player.position.z),
      8,
      currentMapWidth,
      currentMapHeight,
    );

    playerState.recordPlayerPosition(
      currentLevel,
      player.position.x * 32,
      player.position.z * 32,
    );

    updatePlayerDebugMesh();
  });

  // ── Fase 2 (2.2): SaveSystem instance for 3D save/load ─────────────────────
  const saveSystem = new SaveSystem();
  let autoSaveTimer = 0;
  const AUTO_SAVE_INTERVAL = 60; // seconds

  // Periodic auto-save (2.4)
  scene.onBeforeRenderObservable.add(() => {
    autoSaveTimer += engine.getDeltaTime() / 1000;
    if (autoSaveTimer >= AUTO_SAVE_INTERVAL) {
      autoSaveTimer = 0;
      void saveSystem.saveGameDirect({
        map: sliceMapName,
        currentLevel: getCurrentLevel(),
        playerPos: {
          x: Math.round(player.position.x * 32 * 100) / 100,
          y: Math.round(player.position.z * 32 * 100) / 100,
        },
        playerY: Math.round(player.position.y * 1000) / 1000,
      });
    }
  });

  // ── save() — callable from UI (F5, system menu) ──────────────────────────────
  const save = () =>
    saveSystem.saveGameDirect({
      map: sliceMapName,
      currentLevel: getCurrentLevel(),
      playerPos: {
        x: Math.round(player.position.x * 32 * 100) / 100,
        y: Math.round(player.position.z * 32 * 100) / 100,
      },
      playerY: Math.round(player.position.y * 1000) / 1000,
    });

  let fpsTargetMinFrameMs = 0;
  let lastRenderAt = 0;

  engine.runRenderLoop(() => {
    if (fpsTargetMinFrameMs > 0) {
      const now = performance.now();
      if (now - lastRenderAt < fpsTargetMinFrameMs) {
        return;
      }
      lastRenderAt = now;
    }
    scene.render();
  });

  // ─── Display Settings bridge (PlayerState → Babylon engine) ─────────────
  // Render scale: setHardwareScalingLevel(1/scale) lowers internal resolution
  // without touching camera FOV. Quality preset also tunes chunk/enemy/prop radii.
  const applyDisplaySettings = (
    settings: ReturnType<typeof playerState.getDisplaySettings>,
  ) => {
    try {
      const scale = Math.max(0.5, Math.min(1.0, settings.renderScale || 1));
      // Babylon expects 1/scale (1 = native, 2 = half resolution).
      engine.setHardwareScalingLevel(1 / scale);
    } catch (err) {
      console.warn("[3D] Failed to apply renderScale", err);
    }

    applyQualityStreamConfig(settings.qualityPreset);

    // Quality preset → light + scene tuning + streaming radii (see SliceQualityRuntime).
    switch (settings.qualityPreset) {
      case "low":
        hemiLight.intensity = 0.85;
        scene.particlesEnabled = false;
        scene.postProcessesEnabled = false;
        break;
      case "mid":
        hemiLight.intensity = 0.95;
        scene.particlesEnabled = true;
        scene.postProcessesEnabled = false;
        break;
      case "high":
      default:
        hemiLight.intensity = 1.0;
        scene.particlesEnabled = true;
        scene.postProcessesEnabled = true;
        break;
    }

    fpsTargetMinFrameMs =
      settings.fpsTarget && settings.fpsTarget > 0
        ? 1000 / settings.fpsTarget
        : 0;
  };
  applyDisplaySettings(playerState.getDisplaySettings());
  const handleDisplaySettings = (
    settings: ReturnType<typeof playerState.getDisplaySettings>,
  ) => {
    applyDisplaySettings(settings);
  };
  playerState.on("displaySettingsChanged", handleDisplaySettings);
  const handleDoorStatesChanged = () => {
    doorSystem.handleDoorStatesChanged();
  };
  playerState.on("doorStatesChanged", handleDoorStatesChanged);

  return {
    engine,
    scene,
    save,
    whenWorldReady: () => worldReadyPromise,
    dispose: () => {
      pushLogEvent("session.dispose", {
        currentLevel: getCurrentLevel(),
        samples: runtimeLog.samples.length,
        events: runtimeLog.events.length,
      });
      inputManager.dispose();
      persistRuntimeLogs();
      void flushRuntimeLogsToFile(true);


      playerState.off("dropItem", handleDropItem);
      playerState.off("requestPickup", handleRequestPickup);
      playerState.off("spawnDroppedItem", addDroppedItemFromEvent);
      playerState.off("equipmentChanged", syncHeroVisualProfile);
      playerState.off("displaySettingsChanged", handleDisplaySettings);
      playerState.off("doorStatesChanged", handleDoorStatesChanged);
      playerState.off("gameplayPauseChanged", handleGameplayPauseChanged);
      if (playerDeathTimeoutId !== null) {
        window.clearTimeout(playerDeathTimeoutId);
        playerDeathTimeoutId = null;
      }


      scene.onPointerObservable.remove(pointerObserver);
      document.exitPointerLock?.();
      chunkSystem.clearAll();
      wallRevealSystem.dispose();
      waterEffectSystem.dispose();
      heroAquaticTint.dispose();
      mapRoot.dispose();
      tileMaterials.forEach((material) => material.dispose());
      dropSystem.clear();
      activeSlashtrails.forEach((slash) => {
        slash.mesh.dispose();
        slash.material.dispose();
        slash.texture.dispose();
      });
      activeSlashtrails.length = 0;
      doorSystem.clear();
      propSystem.clear();
      enemySystem.clear();
      projectileSystem.disposeAll();
      disposeAllPooledSpriteTexturesForScene(scene);
      // S7-FP4: torus marker removed — no dispose needed
      delete window.__slice3dLogs;
      delete window.__slice3dLogsData;
      delete window.__slice3dPerf;
      delete window.__slice3dPerfDiagnostics;
      geometryWorker.terminate();
      scene.dispose();
      engine.dispose();
    },
  };
}
