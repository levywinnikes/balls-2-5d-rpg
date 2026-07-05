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
import { ItemType } from "../../config/ItemConstants";
import { AudioManager } from "../../game/systems/AudioManager";
import { PathfindingManager } from "../../game/systems/PathfindingManager";
import { WorldMapService } from "../../services/WorldMapService";
import {
  EnemyMagicRegistry,
  registerDefaultMagics,
} from "../../game/entities/EnemyMagicRegistry";
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
} from "./ThreeDEnemyVisualRegistry";
import {
  Projectile3DSystem,
  resolveProjectile3DProfile,
  type Projectile3DGridContext,
  type ProjectileEnemyTarget,
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
  getGeneratedAttackDurationMs,
  type HeroAnimState,
  type HeroBmsDirection,
} from "./TwoDParitySpriteFactory";
import {
  sampleAquaticAtWorldFootprint,
} from "./WaterQuery3D";
import { isWaterTileId, sampleAquaticFromTile, type AquaticSample } from "./WaterProfile";
import { attachAquaticShaderTint } from "./AquaticSpriteShader";
import { configureBillboardSpriteMesh } from "./BillboardDepthConfig";
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
import {
  isGradedWalkTile,
} from "./TileSurfaceResolver";
import { LEVEL_HEIGHT, WALL_HEIGHT, WALK_SURFACE } from "../../constants/World";
import { inferLevelFromFootY } from "./NaturalFloorLevel3D";
import { CollisionWorld } from "./CollisionWorld";
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
import type { SliceTileDefinition } from "./SliceTileTypes";
import { resolveCharacterVisualProfile } from "./CharacterVisualProfile";
import { RuneRegistry } from "../../core/magic/RuneRegistry";
import { SaveSystem } from "../../core/systems/SaveSystem";
import type {
  GeometryWorkerRequest,
  GeometryWorkerResponse,
  GeometryGroupBuffer,
} from "../../workers/geometry.worker";

type SliceDroppedItem = DroppedItemData & { level: string };

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
  activeLevel: string;
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

type MapEntity = {
  x: number;
  y: number;
  symbol: string;
  uuid?: string;
  contents?: Array<{ id: string; count: number }>;
  locked?: boolean;
  keyId?: string | null;
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
  config?: {
    debugSandbox?: boolean;
    startLevel?: string;
  };
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

type PropSpawnData = {
  propId: string;
  tileX: number;
  tileY: number;
  isCollidable: boolean;
};

type SliceEnemy = {
  uid: string;
  spawnKey: string; // deterministic key for persistence (level_type_index)
  level: string;
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
  animState: EnemyVisualAnimState;
  animDirection: HeroBmsDirection;
  animLockedUntil: number;
};

type SliceProp = {
  uid: string;
  level: string;
  propId: string;
  tileX: number;
  tileY: number;
  meshRoot: TransformNode;
};

type SliceDoor = {
  uuid: string;
  level: string;
  tileX: number;
  tileY: number;
  doorId: string;
  locked: boolean;
  keyId?: string | null;
  mesh: Mesh;
  hingeOnX: boolean;
  hingeSide: number;
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
  const sceneInstrumentation = new SceneInstrumentation(scene);
  (sceneInstrumentation as any).captureDrawCalls = true;
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
  /** Door panel fits inside standard wall extrusion (level 0 → wall top). */
  const DOOR_PANEL_HEIGHT = Math.max(
    1.35,
    LEVEL_HEIGHT - WALK_SURFACE - 0.08,
  );
  /** Props / dropped loot sit on walkable surface (not actor foot clearance). */
  const WORLD_ANCHOR_REST_OFFSET = 0.012;
  const DROPPED_ITEM_REST_OFFSET = 0.02;
  // Eye line ~58% of hero body height — chest-level FP view (see HERO_FIRST_PERSON_EYE_BODY_RATIO).
  const FIRST_PERSON_EYE_ABOVE_FEET = getHeroFirstPersonEyeHeight();
  const HERO_BODY_HEIGHT = HERO_COLLISION_HEIGHT;
  const CEILING_BODY_CLEARANCE = 0.14;
  /** Headroom (world units) for a full jump when under a solid ceiling tile. */
  const JUMP_FULL_HEADROOM = 0.85;

  // ── S12-T1/T4: Layer Semantics & Ownership (canonical, top-down is the product mode) ───────────
  // Layer conventions:
  //   -1 = underground / sewers (esgoto)
  //    0 = ground floor (main streets, dungeon floor)
  //   +1 = first upper floor / floating islands (cidade suspensa)
  //   +2 = rooftops / open sky structures
  // Ownership rules:
  //   - LevelRenderer (buildChunk) owns all 3D tile geometry for visible levels around activeLevel.
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
  let activeLevel = playerState.getCurrentLevel();
  let activeLevelNumber = parseLevelNumber(activeLevel);
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
  player.position = new Vector3(
    startingPosition.x !== 0 ? worldToSliceCoord(startingPosition.x) : 6,
    levelToWorldY(activeLevelNumber) + WALK_SURFACE,
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
    const setter = (heroSpriteMat as any)._setVisualProfile;
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
    const setter = (heroSpriteMat as any)._setAnimState;
    if (typeof setter === "function") {
      setter(state);
    }
    if (lockMs > 0) {
      heroAnimLockedUntil = Date.now() + lockMs;
    }
  };

  const setHeroDirection = (direction: HeroBmsDirection) => {
    heroDirection = direction;
    const setter = (heroSpriteMat as any)._setDirection;
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
    levelToWorldY(activeLevelNumber) + WALK_SURFACE + 0.01,
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
  (heroSpriteMat as any)._onReady = () => {
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

  const droppedItemIconMaterials = new Map<string, StandardMaterial>();
  const getDroppedItemMaterial = (itemVisualId: string): StandardMaterial => {
    const cached = droppedItemIconMaterials.get(itemVisualId);
    if (cached) {
      return cached;
    }
    const mat = new StandardMaterial(
      `slice-dropped-item-${itemVisualId}`,
      scene,
    );
    mat.backFaceCulling = false;
    mat.specularColor = Color3.Black();
    mat.useAlphaFromDiffuseTexture = true;
    mat.disableLighting = true;
    mat.emissiveColor = Color3.White();
    const texture = new Texture(
      `/assets/items/${itemVisualId}.png`,
      scene,
      false,
      true,
      Texture.NEAREST_NEAREST,
    );
    texture.hasAlpha = true;
    mat.diffuseTexture = texture;
    mat.opacityTexture = texture;
    droppedItemIconMaterials.set(itemVisualId, mat);
    return mat;
  };
  const droppedItemShadowMat = new StandardMaterial("slice-dropped-shadow-mat", scene);
  droppedItemShadowMat.diffuseColor = Color3.Black();
  droppedItemShadowMat.specularColor = Color3.Black();
  droppedItemShadowMat.disableLighting = true;

  const getDeterministicRotation = (id: string): number => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (Math.abs(hash) % 360) * (Math.PI / 180);
  };

  const droppedItemMeshes = new Map<string, TransformNode>();
  const getDroppedItemMeshKey = (level: string, itemId: string) =>
    `${level}::${itemId}`;

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

    const levelWorldY = levelToWorldY(activeLevel);
    const slashPos = player.position.clone();
    slashPos.y = levelWorldY + 0.4;
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
  const enemies = new Map<string, SliceEnemy>();
  const ENEMY_RESPAWN_MS = 60_000;
  const pendingEnemyRespawns = new Map<
    string,
    {
      level: string;
      spawn: EnemySpawnData;
      index: number;
      elapsedMs: number;
      respawnTimeMs: number;
    }
  >();
  const enemySpawnCatalog = new Map<
    string,
    { level: string; spawn: EnemySpawnData; index: number }
  >();
  const doors = new Map<string, SliceDoor>();
  const doorByLevelTile = new Map<string, string>();
  const seededDoorLevels = new Set<string>();
  let selectedEnemyUid: string | null = null;
  let lastFocusedCombatHealthSyncAt = 0;
  let lastPlayerAttackAt = 0;
  let activeRuneSlotIndex = 0;
  let lastRuneCastAt = 0;
  // S11-T1: rune targeting mode (Opção A parity)
  let runeTargetingMode = false;
  let targetingRuneId: string | null = null;
  const seededEnemyLevels = new Set<string>();
  const props = new Map<string, SliceProp>();
  const propSpawnCatalog = new Map<
    string,
    { level: string; spawn: PropSpawnData; index: number }
  >();
  const collidablePropTilesByLevel = new Map<string, Set<string>>();
  const seededPropLevels = new Set<string>();
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
  const waterEffectSystem = new WaterEffectSystem(scene, mapRoot, WALK_SURFACE);
  const wallRevealSystem = new InteractableWallRevealSystem(scene, mapRoot, {
    revealRadiusTiles: 20,
  });
  // Chunk streaming constants (visual profile depends on camera mode; gameplay state remains global)
  const CHUNK_SIZE = 16; // tiles per chunk side
  const CHUNK_UNLOAD_BUDGET_PER_TICK = 8; // max chunks to unload each update tick
  const PROP_STREAM_SYNC_INTERVAL = 0.35;
  const NAV_WINDOW_RADIUS = 40;
  const ENEMY_VISIBILITY_RADIUS_UNITS = 26;
  const ENEMY_AI_RADIUS_UNITS = 18;
  const ENEMY_STREAM_SYNC_INTERVAL = 0.35;
  const WALL_REVEAL_TARGET_RADIUS_UNITS = 22;
  const DROP_SYNC_INTERVAL = 0.2;

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
  let propStreamRadiusUnits = streamRadiiUnits.propStreamRadiusUnits;
  let propStreamRadiusUnitsFirstPerson =
    streamRadiiUnits.propStreamRadiusUnitsFirstPerson;
  let propDespawnRadiusUnits = streamRadiiUnits.propDespawnRadiusUnits;
  let enemyStreamRadiusUnits = streamRadiiUnits.enemyStreamRadiusUnits;
  let enemyDespawnRadiusUnits = streamRadiiUnits.enemyDespawnRadiusUnits;
  let droppedItemStreamRadiusUnits =
    streamRadiiUnits.droppedItemStreamRadiusUnits;

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
    propStreamRadiusUnits = streamRadiiUnits.propStreamRadiusUnits;
    propStreamRadiusUnitsFirstPerson =
      streamRadiiUnits.propStreamRadiusUnitsFirstPerson;
    propDespawnRadiusUnits = streamRadiiUnits.propDespawnRadiusUnits;
    enemyStreamRadiusUnits = streamRadiiUnits.enemyStreamRadiusUnits;
    enemyDespawnRadiusUnits = streamRadiiUnits.enemyDespawnRadiusUnits;
    droppedItemStreamRadiusUnits =
      streamRadiiUnits.droppedItemStreamRadiusUnits;
  };
  let isFirstPerson = false;
  let fpCombatCameraState = createFirstPersonCombatCameraState();
  let gameplayPaused = playerState.isGameplayPaused();
  let fpCaptureSuspendedForMenu = false;
  let topDownCaptureSuspendedForMenu = false;
  const chunkMeshes = new Map<string, Mesh[]>();
  const chunkLodByKey = new Map<string, 0 | 1 | 2>();
  const chunkLoading = new Set<string>();

  // ─── Geometry Worker ────────────────────────────────────────────────────────
  // Chunk geometry is computed off the main thread to eliminate frame stalls.
  // The worker returns transferable Float32Array/Uint32Array buffers; the main
  // thread only creates Mesh objects and uploads to GPU (<1ms per chunk).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const geometryWorker: Worker = new Worker(
    new URL("../../workers/geometry.worker.ts", import.meta.url),
  );
  // Pending requests: requestId → resolve callback
  const pendingChunkRequests = new Map<
    string,
    (response: GeometryWorkerResponse) => void
  >();
  geometryWorker.onmessage = (evt: MessageEvent<GeometryWorkerResponse>) => {
    const { requestId } = evt.data;
    const resolve = pendingChunkRequests.get(requestId);
    if (resolve) {
      pendingChunkRequests.delete(requestId);
      resolve(evt.data);
    }
  };
  geometryWorker.onerror = (e) => {
    console.error("[GeometryWorker] Error:", e);
  };
  // ────────────────────────────────────────────────────────────────────────────

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
        activeLevel,
        isFirstPerson,
      },
      summary,
      hotspots,
    };
  };

  const flushRuntimeLogsToFile = async (force = false) => {
    const electronAPI = (window as any).electronAPI;
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

  (window as any).__slice3dLogs = {
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
    level: activeLevel,
  });

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

  const projectileGridContext: Projectile3DGridContext = {
    grid: navigationGrid,
    gridSize: navigationGridSize,
    gridOrigin: navigationGridOrigin,
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

    const symbol = getMapTileAt(activeLevel, tileX, tileY);
    const tileDef = symbol ? mapData.tileDefinitions?.[symbol] : undefined;
    if (
      isBlockingTile(symbol, tileDef, {
        level: activeLevel,
        tileX,
        tileY,
      })
    ) {
      return true;
    }
    return isCollidablePropAtTile(activeLevel, tileX, tileY);
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
    const levelKeys = mapData?.levels ? Object.keys(mapData.levels) : [activeLevel];
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
    if (newLevel === activeLevel) {
      return;
    }
    const previousLevel = activeLevel;
    const natural = options?.natural === true;
    activeLevel = newLevel;
    activeLevelNumber = parseLevelNumber(newLevel);
    playerState.setCurrentLevel(newLevel);
    WorldMapService.ensureLevelBuffer(newLevel);

    if (transition) {
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
      chunkUpdateTimer = 0;
    } else {
      clearAllChunks();
      invalidateVerticalVisibilityCache();
      chunkUpdateTimer = CHUNK_UPDATE_INTERVAL;
      snapPlayerFootToActiveLevel();
    }
    const mapData = mapDataCache;
    if (mapData) {
      void loadLevelBinary(newLevel, mapData).then(() => {
        if (!natural) {
          snapPlayerFootToActiveLevel();
        }
        reanchorWorldContentOnLevel(newLevel);
        updateChunks();
      });
    }
    // Escada/rampa natural: andares ±1 já estão nos chunks (vertical stack).
    // ensureMapLevelReady → renderMapLevel apagava tudo e reconstruía do zero.
    if (!natural) {
      void ensureMapLevelReady(newLevel);
    } else {
      rebuildNavigationWindow(newLevel);
    }
    void ensureLevelDoorsSeeded(newLevel);
    void ensureLevelEnemiesSeeded(newLevel);
    void ensureLevelItemsSeeded(newLevel);
    void ensureLevelPropsSeeded(newLevel);
    syncEnemyStream(true);
    syncPropStream(true);
    pushLogEvent("level.change", {
      from: previousLevel,
      to: newLevel,
      playerX: Math.round(player.position.x * 100) / 100,
      playerZ: Math.round(player.position.z * 100) / 100,
    });
  };

  /**
   * Map layer follows stair exit + foot height (Quake-style walk, no Z snap).
   *
   * FIX: Added levelTransitionCooldown guard so stair-triggered level changes
   * cannot fire again for 0.35 s, preventing floor-cascade on stacked stair tiles.
   */
  const syncVerticalLevelFromMovement = (didMove: boolean, moveStartX: number, moveStartZ: number) => {
    if (!worldBootstrapReady) {
      return;
    }
    const mapData = mapDataCache;
    if (!mapData?.levels) {
      return;
    }
    if (holeFallLandingLevel || isPlayerOverVoidAtLevel(activeLevel)) {
      return;
    }
    if (levelTransitionCooldown > 0) {
      return;
    }

    const levelKeys = Object.keys(mapData.levels);
    const aquatic = getAquaticSampleAt(player.position.x, player.position.z, activeLevel);
    const unsunkFootY = player.position.y - (aquatic.mode !== "dry" ? aquatic.sinkOffset : 0);
    const inferredLevel = inferLevelFromFootY(unsunkFootY, levelKeys, {
      levelToWorldY,
      parseLevelNumber,
      levelHeightUnits: LEVEL_HEIGHT,
      floorSurfaceY: WALK_SURFACE,
    });

    if (inferredLevel !== activeLevel) {
      levelTransitionCooldown = 0.35;
      applyActiveLevelChange(inferredLevel, undefined, { natural: true });
      snapFootToGradedSurface();
    }
  };

  const snapPlayerFootToActiveLevel = () => {
    const footY = levelBinaryCache.has(activeLevel)
      ? getGroundFootY(
          player.position.x,
          player.position.z,
          activeLevel,
        )
      : levelToWorldY(activeLevel) +
        WALK_SURFACE +
        FEET_CLEARANCE;
    player.position.y = footY;
    verticalVelocity = 0;
    isGrounded = true;
    lastGroundedFootY = footY;
  };

  const getDoorTileKey = (level: string, tileX: number, tileY: number) =>
    `${level}:${tileX}:${tileY}`;

  const getDoorAtTile = (level: string, tileX: number, tileY: number) => {
    const uuid = doorByLevelTile.get(getDoorTileKey(level, tileX, tileY));
    return uuid ? doors.get(uuid) || null : null;
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
  };

  const getPropTileKey = (tileX: number, tileY: number) =>
    `${tileX},${tileY}`;

  const isCollidablePropAtTile = (
    level: string,
    tileX: number,
    tileY: number,
  ) => collidablePropTilesByLevel.get(level)?.has(getPropTileKey(tileX, tileY)) ?? false;

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

  const isDoorOpenAtTile = (level: string, tileX: number, tileY: number) => {
    const door = getDoorAtTile(level, tileX, tileY);
    if (!door) {
      return false;
    }
    return !!playerState.getDoorState(door.uuid)?.open;
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
      const door = getDoorAtTile(options.level, options.tileX, options.tileY);
      if (door) {
        return !isDoorOpenAtTile(options.level, options.tileX, options.tileY);
      }

      if (
        isCollidablePropAtTile(options.level, options.tileX, options.tileY)
      ) {
        return true;
      }
    }

    return isStaticTileBlocking(symbol, tileDef);
  };

  const isWorldPositionBlocked = (
    worldX: number,
    worldZ: number,
    radius = 0.32,
    options?: { blockVoidForPlayer?: boolean; footY?: number },
  ) => {
    const mapData = mapDataCache;
    if (!mapData || !mapData.width || !mapData.height) {
      return false;
    }

    if (worldX < 0 || worldZ < 0 || worldX >= mapData.width || worldZ >= mapData.height) {
      return true;
    }

    const footY = options?.footY ?? player.position.y;
    const headY = footY + HERO_BODY_HEIGHT;
    const levelKeys = Object.keys(mapData.levels || {});

    // Volume overlap check — replaces all old tile-level lookups
    if (collisionWorld.isHorizontalBlocked(worldX, worldZ, footY, headY, radius, levelKeys)) {
      return true;
    }

    // Fall-safety void check (center point only)
    if (Boolean(options?.blockVoidForPlayer) && playerState.isFallSafetyEnabled()) {
      const tx = Math.floor(worldX);
      const tz = Math.floor(worldZ);
      const levelNum = Math.floor(footY / LEVEL_HEIGHT);
      const checkLevel = String(levelNum);
      const symbol = mapData.levels?.[checkLevel]
        ? getMapTileAt(checkLevel, tx, tz)
        : null;
      if (symbol === "..." || !symbol) {
        const belowLevel = String(levelNum - 1);
        const belowSym = mapData.levels?.[belowLevel]
          ? getMapTileAt(belowLevel, tx, tz)
          : null;
        const belowDef = belowSym && belowSym !== "..."
          ? mapData.tileDefinitions?.[belowSym]
          : undefined;
        if (!(belowDef && isGradedWalkTile(belowDef, LEVEL_HEIGHT))) {
          return true;
        }
      }
    }

    return false;
  };

  const clearChunk = (key: string) => {
    waterEffectSystem.clearChunk(key);
    // Cancel any pending worker response for this key so the response
    // handler doesn't recreate the chunk after it was explicitly cleared.
    pendingChunkRequests.delete(key);
    chunkLoading.delete(key);
    chunkLodByKey.delete(key);
    const meshes = chunkMeshes.get(key);
    if (meshes) {
      meshes.forEach((m) => {
        const levelKey = meshLevelByMesh.get(m);
        if (levelKey) {
          const set = levelMeshes.get(levelKey);
          set?.delete(m);
          if (set && set.size === 0) {
            levelMeshes.delete(levelKey);
          }
          meshLevelByMesh.delete(m);
        }
        m.dispose();
      });
      chunkMeshes.delete(key);
    }
  };

  const clearAllChunks = () => {
    pendingChunkRequests.clear();
    chunkMeshes.forEach((meshes) =>
      meshes.forEach((m) => {
        const levelKey = meshLevelByMesh.get(m);
        if (levelKey) {
          const set = levelMeshes.get(levelKey);
          set?.delete(m);
          if (set && set.size === 0) {
            levelMeshes.delete(levelKey);
          }
          meshLevelByMesh.delete(m);
        }
        m.dispose();
      }),
    );
    chunkMeshes.clear();
    chunkLoading.clear();
    chunkLodByKey.clear();
  };

  let navigationGridLevel: string | null = null;
  let lastChunkRenderLevel: string | null = null;
  let navWindowMinTileX = 0;
  let navWindowMinTileY = 0;

  const rebuildNavigationWindow = (level: string, force = false) => {
    const mapData = mapDataCache;
    if (!mapData?.width || !mapData.height) {
      return;
    }

    const centerX = Math.floor(player.position.x);
    const centerZ = Math.floor(player.position.z);
    const winSize = NAV_WINDOW_RADIUS * 2;

    if (
      !force &&
      navigationGridLevel === level &&
      Math.abs(centerX - (navWindowMinTileX + NAV_WINDOW_RADIUS)) < 18 &&
      Math.abs(centerZ - (navWindowMinTileY + NAV_WINDOW_RADIUS)) < 18
    ) {
      return;
    }

    navWindowMinTileX = Math.max(
      0,
      Math.min(centerX - NAV_WINDOW_RADIUS, mapData.width - winSize),
    );
    navWindowMinTileY = Math.max(
      0,
      Math.min(centerZ - NAV_WINDOW_RADIUS, mapData.height - winSize),
    );

    navigationGridLevel = level;
    navigationGridSize = winSize;
    navigationGridOrigin = -navWindowMinTileX;

    navigationGrid = Array.from({ length: winSize }, () =>
      Array(winSize).fill(0),
    );

    for (let ly = 0; ly < winSize; ly += 1) {
      for (let lx = 0; lx < winSize; lx += 1) {
        const tileX = navWindowMinTileX + lx;
        const tileY = navWindowMinTileY + ly;
        if (isTileBlockedForGameplay(tileX, tileY)) {
          navigationGrid[ly][lx] = 1;
        }
      }
    }

    pathfindingManager.updateGrid(navigationGrid);
    projectileGridContext.grid = navigationGrid;
    projectileGridContext.gridSize = navigationGridSize;
    projectileGridContext.gridOrigin = navigationGridOrigin;
  };

  const rebuildNavigationGrid = (level: string) => {
    rebuildNavigationWindow(level, true);
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

    currentMapWidth = mapData.width;
    currentMapHeight = mapData.height;
    mapMinX = 0;
    mapMinZ = 0;
    mapMaxX = Math.max(0.5, currentMapWidth - 0.5);
    mapMaxZ = Math.max(0.5, currentMapHeight - 0.5);

    rebuildNavigationGrid(level);
    // Chunks are multi-level (vertical stack). Only wipe on first map draw.
    if (lastChunkRenderLevel === null) {
      clearAllChunks();
    }
    lastChunkRenderLevel = level;

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
    const drawRadiusChunks = isFirstPerson
      ? firstPersonDrawRadiusChunks
      : topDownDrawRadiusChunks;
    // Align vertical stack with chunk streaming (Chebyshev + unload margin).
    return CHUNK_SIZE * (drawRadiusChunks + 1);
  };

  const getRenderableLevels = (): string[] => {
    const tileX = Math.floor(player.position.x);
    const tileZ = Math.floor(player.position.z);
    const verticalStackRadius = resolveVerticalStackRadiusTiles();

    if (
      tileX === lastCachedTileX &&
      tileZ === lastCachedTileZ &&
      activeLevel === lastCachedActiveLevel &&
      isFirstPerson === lastCachedIsFirstPerson &&
      verticalStackRadius === lastCachedVerticalStackRadius &&
      cachedRenderableLevels.length > 0
    ) {
      return cachedRenderableLevels;
    }

    lastCachedTileX = tileX;
    lastCachedTileZ = tileZ;
    lastCachedActiveLevel = activeLevel;
    lastCachedIsFirstPerson = isFirstPerson;
    lastCachedVerticalStackRadius = verticalStackRadius;

    const mapData = mapDataCache;
    if (!mapData?.levels) {
      cachedRenderableLevels = [activeLevel];
      return cachedRenderableLevels;
    }

    const stack = resolveVerticalVisibleLevels(
      activeLevel,
      tileX,
      tileZ,
      Object.keys(mapData.levels),
      getMapTileAt,
      (symbol) =>
        symbol ? mapData.tileDefinitions?.[symbol] : undefined,
      { parseLevelNumber, columnRadius: verticalStackRadius },
    );
    const merged = new Set<string>(stack);
    merged.add(activeLevel);
    const n = parseLevelNumber(activeLevel);
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
        : new Set([activeLevel]);
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

    (window as any).__slice3dVerticalVisibility = {
      activeLevel,
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

    const currentNum = parseLevelNumber(activeLevel);
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

    if (isGradedWalkAt(player.position.x, player.position.z, activeLevel)) {
      return null;
    }

    const camPos = camera.position;
    const heroPos = player.position;
    const dir = heroPos.subtract(camPos);
    const currentNum = parseLevelNumber(activeLevel);

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

  /**
   * Collect tile descriptors for a chunk and post them to the geometry worker.
   * Returns immediately — the worker applies the geometry asynchronously and
   * the chunk meshes are registered once the response arrives.
   *
   * This replaces the previous synchronous buildChunk which blocked the main
   * thread for up to 1600ms per tick (confirmed by runtime logs 2026-05-01).
   */
  const buildChunk = (cx: number, cy: number, lod: 0 | 1 | 2): void => {
    const key = `${cx}_${cy}`;
    if (chunkMeshes.has(key) || chunkLoading.has(key)) {
      return;
    }

    const mapData = mapDataCache;
    if (!mapData || !mapData.width || !mapData.height) {
      return;
    }

    const renderableLevels = getRenderableLevels().filter((levelKey) =>
      levelBinaryCache.has(levelKey),
    );
    if (renderableLevels.length === 0) {
      return;
    }

    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;

    if (startX >= mapData.width || startY >= mapData.height) {
      return;
    }

    const endX = Math.min(startX + CHUNK_SIZE, mapData.width);
    const endY = Math.min(startY + CHUNK_SIZE, mapData.height);

    chunkLoading.add(key);

    // ── Collect tile descriptors (main thread reads tile data; no Babylon calls) ──
    // We compute materialKey here so the worker doesn't need tile definitions.
    const tiles: GeometryWorkerRequest["tiles"] = [];
    const waterZoneTiles: Array<{
      x: number;
      y: number;
      tileId: string;
      levelOffsetY: number;
      levelKey: string;
    }> = [];

    for (const renderLevel of renderableLevels) {
      if (lod >= 2) continue; // lod 2 = ground-only (skipped entirely for now)

      const levelOffsetY = levelToWorldY(renderLevel);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const symbol = getMapTileAt(renderLevel, x, y);
          if (!symbol || symbol === "...") continue;

          const tileDef = mapData.tileDefinitions?.[symbol];
          const blocking = isBlockingTile(symbol, tileDef);

          if (!blocking && lod === 1) continue; // lod 1: walls only

          const tileId = (tileDef?.id || symbol || "").toLowerCase();

          if (isWaterTileId(tileId)) {
            waterZoneTiles.push({
              x,
              y,
              tileId,
              levelOffsetY,
              levelKey: renderLevel,
            });

            const pitDepth = waterHoleDepthForTileId(tileId);
            const pitWallMask = computeWaterPitWallMask(
              renderLevel,
              x,
              y,
              getMapTileAt,
              (sym) => mapData.tileDefinitions?.[sym ?? ""],
            );
            const floorMat = resolvePoolFloorMaterial(renderLevel, x, y);
            const materialKey = `${renderLevel}::${floorMat.name}`;

            tiles.push({
              x,
              y,
              symbol,
              tileId,
              isBlocking: false,
              geometryProfile: "water-hole",
              isStair: false,
              height: 0,
              levelOffsetY,
              materialKey,
              pitDepth,
              pitWallMask,
            });
            continue;
          }

          if (isDownHoleTile(tileDef)) {
            const pitDepth = Math.max(0.45, LEVEL_HEIGHT * 0.82);
            const pitWallMask = 0x0f;
            const holeMat = getTileMaterial(symbol, tileDef, "#111827");
            const materialKey = `${renderLevel}::${holeMat.name}`;

            tiles.push({
              x,
              y,
              symbol,
              tileId,
              isBlocking: false,
              geometryProfile: "water-hole",
              isStair: false,
              height: 0,
              levelOffsetY,
              materialKey,
              pitDepth,
              pitWallMask,
            });
            continue;
          }

          // Skip floor tiles that sit directly above a ramp on the level below.
          // The ramp geometry already fills that vertical space; a floor mesh at
          // the same XY would block the player's view and cause z-fighting.
          if (
            !blocking &&
            tileDef?.renderAs !== "block" &&
            renderLevel !== undefined
          ) {
            const levelNum = parseLevelNumber(renderLevel);
            const belowLevel = String(levelNum - 1);
            if (mapData.levels?.[belowLevel]) {
              const belowSymbol = getMapTileAt(belowLevel, x, y);
              if (belowSymbol && belowSymbol !== "...") {
                const belowDef = mapData.tileDefinitions?.[belowSymbol];
                if (belowDef?.geometryProfile?.startsWith("ramp-") && isFloorLevelRamp(belowDef, LEVEL_HEIGHT)) {
                  continue;
                }
              }
            }
          }

          const inferredStair = tileDef?.stairDir !== undefined;
          const geometryProfile =
            tileDef?.geometryProfile ?? (inferredStair ? "stair" : "box");

           // CLAMP any explicit tileDef.height to WALL_HEIGHT: map heights
           // were authored for the 2D renderer and can exceed 2.0 (e.g. "wal":4.5),
           // causing level 0 tiles to visually invade level 1 in 3D.
           const DEFAULT_WALL_H = WALL_HEIGHT;
          const tileHeight = blocking
            ? Math.min(
                Math.max(0.4, tileDef?.height ?? DEFAULT_WALL_H),
                DEFAULT_WALL_H,
              )
            : Math.max(
                WALK_SURFACE,
                tileDef?.height ?? WALK_SURFACE,
              );

          // Resolve material key on main thread (getTileMaterial caches anyway)
          const fallbackHex =
            geometryProfile === "stair" ? "#c4a07a" : "#6a9f36";
          const mat = getTileMaterial(symbol, tileDef, fallbackHex);
          const materialKey = `${renderLevel}::${mat.name}`;

          const renderLevelNum = renderLevel !== undefined ? parseLevelNumber(renderLevel) : 0;
          const resolved = resolveTileHeight(renderLevelNum, LEVEL_HEIGHT, WALK_SURFACE, tileDef, tileHeight);
          tiles.push({
            x,
            y,
            symbol,
            tileId,
            isBlocking: blocking,
            geometryProfile,
            isStair: geometryProfile === "stair",
            stairDir: tileDef?.stairDir,
            height: resolved.height,
            levelOffsetY: resolved.levelOffsetY,
            materialKey,
          });
        }
      }
    }

    const syncWaterForChunk = () => {
      const waterTiles = collectWaterEffectTiles(
        waterZoneTiles,
        LEVEL_HEIGHT,
      );
      waterEffectSystem.syncChunk(
        key,
        waterTiles,
        findUpperOcclusionLevel(),
      );
    };

    if (tiles.length === 0) {
      syncWaterForChunk();
      chunkLoading.delete(key);
      chunkLodByKey.set(key, lod);
      chunkMeshes.set(key, []);
      return;
    }

    // ── Build a materialKey → { mat, levelKey } lookup for the response handler ──
    const matByKey = new Map<
      string,
      { mat: StandardMaterial; levelKey: string }
    >();
    for (const t of tiles) {
      if (!matByKey.has(t.materialKey)) {
        const fallbackHex = t.isStair ? "#c4a07a" : "#6a9f36";
        const mat = getTileMaterial(
          t.symbol,
          mapData.tileDefinitions?.[t.symbol],
          fallbackHex,
        );
        // renderLevel is encoded in materialKey as the prefix before "::"
        const levelKey = t.materialKey.split("::")[0];
        matByKey.set(t.materialKey, { mat, levelKey });
      }
    }

    // ── Register pending request and post to worker ──
    pendingChunkRequests.set(key, (response: GeometryWorkerResponse) => {
      // If the chunk was already cleared while the worker was running, discard.
      if (!chunkLoading.has(key)) return;

      const meshes: Mesh[] = [];

      for (const group of response.groups as GeometryGroupBuffer[]) {
        const entry = matByKey.get(group.materialKey);
        if (!entry || group.positions.length === 0) continue;

        const meshName = group.tileKey
          ? `chunk-${key}@@${group.tileKey}-${group.materialKey}`
          : `chunk-${key}-${group.materialKey}`;
        const mesh = new Mesh(meshName, scene);
        mesh.parent = mapRoot;

        const vd = new VertexData();
        vd.positions = group.positions;
        vd.indices = group.indices;
        vd.normals = group.normals;
        vd.uvs = group.uvs;
        vd.applyToMesh(mesh);

        mesh.material = entry.mat;
        mesh.metadata = { chunkCx: cx, chunkCy: cy };
        registerMeshForLevel(entry.levelKey, mesh);

        if (group.tileKey) {
          wallTileIndex.set(`${entry.levelKey}::${group.tileKey}`, mesh);
        }

        meshes.push(mesh);
      }

      chunkMeshes.set(key, meshes);
      chunkLodByKey.set(key, lod);
      chunkLoading.delete(key);

      syncWaterForChunk();
    });

    const request: GeometryWorkerRequest = { requestId: key, tiles };
    geometryWorker.postMessage(request);
  };

  // Determine which chunks should be active around the player, load new ones,
  // unload distant ones. Called every CHUNK_UPDATE_INTERVAL seconds.
  const updateChunks = () => {
    if (!mapDataCache || !mapDataCache.width || !mapDataCache.height) {
      return;
    }

    const drawRadiusChunks = isFirstPerson
      ? firstPersonDrawRadiusChunks
      : topDownDrawRadiusChunks;
    const chunkBuildBudgetPerTick = isFirstPerson
      ? firstPersonChunkBuildBudgetPerTick
      : topDownChunkBuildBudgetPerTick;

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
      if (dist > drawRadiusChunks + 1) {
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
    const chunkCandidates: Array<{
      cx: number;
      cy: number;
      dist: number;
      lod: 0 | 1 | 2;
    }> = [];

    const resolveDesiredChunkLod = (dist: number): 0 | 1 | 2 => {
      if (isFirstPerson) {
        // FP: full detail up close; walls-only silhouette at distance (never lod 2 hole).
        if (dist <= 1) {
          return 0;
        }
        return 1;
      }
      return dist <= 2 ? 0 : dist <= 4 ? 1 : 2;
    };

    for (let dy = -drawRadiusChunks; dy <= drawRadiusChunks; dy++) {
      for (let dx = -drawRadiusChunks; dx <= drawRadiusChunks; dx++) {
        const cx = playerCX + dx;
        const cy = playerCY + dy;
        if (cx < 0 || cy < 0 || cx >= maxCX || cy >= maxCY) {
          continue;
        }

        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const desiredLod = resolveDesiredChunkLod(dist);
        const key = `${cx}_${cy}`;

        // If the chunk is already loaded with a coarser LOD, force rebuild
        // so floor tiles and full materials are restored when the player
        // returns near that area.
        const loadedLod = chunkLodByKey.get(key);
        if (
          loadedLod !== undefined &&
          loadedLod > desiredLod &&
          !chunkLoading.has(key)
        ) {
          clearChunk(key);
        }

        if (!chunkMeshes.has(key) && !chunkLoading.has(key)) {
          chunkCandidates.push({ cx, cy, dist, lod: desiredLod });
        }
      }
    }

    chunkCandidates.sort((a, b) => a.dist - b.dist);

    let builtThisTick = 0;
    for (const candidate of chunkCandidates) {
      if (builtThisTick >= chunkBuildBudgetPerTick) {
        break;
      }

      buildChunk(candidate.cx, candidate.cy, candidate.lod);
      builtThisTick += 1;
    }

    // Lightweight runtime metrics for Sprint 1 tuning.
    (window as any).__slice3dChunkStreaming = {
      playerChunk: { x: playerCX, y: playerCY },
      loadedChunks: chunkMeshes.size,
      loadingChunks: chunkLoading.size,
      builtThisTick,
      drawRadiusChunks,
      chunkBuildBudgetPerTick,
      firstPersonLod: isFirstPerson,
      pendingCandidates: Math.max(0, chunkCandidates.length - builtThisTick),
      unloadedThisTick,
      pendingUnloads,
      visibleLevels: getRenderableLevels(),
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

  const resolveDoorOrientation = (
    level: string,
    tileX: number,
    tileY: number,
    mapData: SliceMapData,
  ) => {
    const wallAt = (x: number, y: number) => {
      const symbol = getMapTileAt(level, x, y);
      const tileDef = symbol ? mapData.tileDefinitions?.[symbol] : undefined;
      return isStaticTileBlocking(symbol, tileDef);
    };

    const northWall = wallAt(tileX, tileY - 1);
    const southWall = wallAt(tileX, tileY + 1);
    const eastWall = wallAt(tileX + 1, tileY);
    const westWall = wallAt(tileX - 1, tileY);

    // Door panel spans the axis where side walls sit (E/W -> panel along X).
    const hingeOnX = eastWall || westWall;
    const hingeOnZ = northWall || southWall;

    if (hingeOnX && !hingeOnZ) {
      return { hingeOnX: true, hingeSide: westWall ? -1 : 1 };
    }
    if (hingeOnZ && !hingeOnX) {
      return { hingeOnX: false, hingeSide: northWall ? -1 : 1 };
    }

    // Fallback for symmetric room entrances: corridor runs N/S in sandbox rooms.
    return { hingeOnX: true, hingeSide: westWall ? -1 : 1 };
  };

  const updateDoorVisual = (door: SliceDoor) => {
    const state = playerState.getDoorState(door.uuid);
    const isOpen = !!state?.open;
    const levelWorldY = levelToWorldY(door.level);
    const floorTop = levelWorldY + WALK_SURFACE;
    const doorHeight = DOOR_PANEL_HEIGHT;
    const centerY = floorTop + doorHeight / 2;
    const tileCenterX = door.tileX + 0.5;
    const tileCenterZ = door.tileY + 0.5;
    const hingeOffset = 0.46 * (door.hingeSide ?? 1);

    door.mesh.rotation.y = 0;
    if (door.hingeOnX) {
      door.mesh.position.set(tileCenterX, centerY, tileCenterZ);
      if (isOpen) {
        door.mesh.rotation.y = (Math.PI / 2) * (door.hingeSide ?? 1);
        door.mesh.position.x = tileCenterX + hingeOffset;
        door.mesh.position.z = tileCenterZ + 0.34 * (door.hingeSide ?? 1);
      }
    } else {
      door.mesh.position.set(tileCenterX, centerY, tileCenterZ);
      if (isOpen) {
        door.mesh.rotation.y = (Math.PI / 2) * (door.hingeSide ?? 1);
        door.mesh.position.z = tileCenterZ + hingeOffset;
        door.mesh.position.x = tileCenterX + 0.34 * (door.hingeSide ?? 1);
      }
    }
    // Show door only when on the same floor as the player (Y-based, not level string)
    door.mesh.setEnabled(
      Math.abs(levelToWorldY(door.level) - levelToWorldY(activeLevel)) < LEVEL_HEIGHT,
    );
  };

  const refreshDoorSystemsForLevel = (level: string) => {
    rebuildNavigationGrid(level);
    enemies.forEach((enemy) => {
      if (enemy.level !== level) {
        return;
      }
      enemy.currentPath = [];
      enemy.currentPathIndex = 0;
      enemy.lastPathAt = 0;
    });
  };

  const DOOR_INTERACT_RADIUS = 1.55;
  /** Direct click on the door mesh — slightly farther than proximity E. */
  const DOOR_PICK_INTERACT_RADIUS = 2.75;

  const getDoorInteractDistance = (door: SliceDoor): number => {
    const px = player.position.x;
    const pz = player.position.z;
    const closestX = Math.max(door.tileX, Math.min(door.tileX + 1, px));
    const closestZ = Math.max(door.tileY, Math.min(door.tileY + 1, pz));
    const dx = px - closestX;
    const dz = pz - closestZ;
    return Math.sqrt(dx * dx + dz * dz);
  };

  const isPlayerOnDoorTile = (door: SliceDoor) => {
    return (
      Math.floor(player.position.x) === door.tileX &&
      Math.floor(player.position.z) === door.tileY
    );
  };

  const canCloseDoor = (door: SliceDoor) => {
    if (!playerState.getDoorState(door.uuid)?.open) {
      return true;
    }
    return !isPlayerOnDoorTile(door);
  };

  const interactDoorByUuid = (uuid: string): boolean => {
    const door = doors.get(uuid);
    if (!door || Math.abs(levelToWorldY(door.level) - player.position.y) >= LEVEL_HEIGHT) {
      return false;
    }

    const state = playerState.getDoorState(uuid);
    if (state?.locked) {
      playerState.emit("message", "Door is locked.");
      return false;
    }

    const isOpen = !!state?.open;
    if (isOpen && !canCloseDoor(door)) {
      playerState.emit("uiNotification", {
        type: "warning",
        message: "Não dá para fechar — você está na passagem.",
      });
      return false;
    }

    playerState.setDoorOpen(uuid, !isOpen);
    updateDoorVisual(door);
    refreshDoorSystemsForLevel(door.level);
    return true;
  };

  const findNearbyDoor = (maxDistanceUnits = DOOR_INTERACT_RADIUS): SliceDoor | null => {
    let nearestDoor: SliceDoor | null = null;
    let nearestDistance = maxDistanceUnits + 1;

    doors.forEach((door) => {
      // Only interact with doors on the same floor (Y-based)
      if (Math.abs(levelToWorldY(door.level) - player.position.y) >= LEVEL_HEIGHT) {
        return;
      }
      const distance = getDoorInteractDistance(door);
      if (distance > maxDistanceUnits || distance >= nearestDistance) {
        return;
      }
      nearestDoor = door;
      nearestDistance = distance;
    });

    return nearestDoor;
  };

  const findDoorUuidFromPick = (pickResult: { pickedMesh?: any } | null | undefined) => {
    let currentMesh = pickResult?.pickedMesh;
    while (currentMesh) {
      const uuid = (currentMesh.metadata as { sliceDoorUuid?: string } | undefined)
        ?.sliceDoorUuid;
      if (uuid) {
        return uuid;
      }
      currentMesh = currentMesh.parent;
    }
    return null;
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
    const planeY = levelToWorldY(activeLevel) + WALK_SURFACE;
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
        const uuid = findDoorUuidFromPick(hit);
        if (uuid) {
          return uuid;
        }
      }
    }

    const singlePick = scene.pick(pointerX, pointerY);
    const fromSingle = findDoorUuidFromPick(singlePick);
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
        if (uuid && doors.has(uuid)) {
          return uuid;
        }
      }
    }

    return null;
  };

  const tryInteractPickedDoor = (doorUuid: string): boolean => {
    const door = doors.get(doorUuid);
    if (!door || Math.abs(levelToWorldY(door.level) - player.position.y) >= LEVEL_HEIGHT) {
      return false;
    }
    if (getDoorInteractDistance(door) > DOOR_PICK_INTERACT_RADIUS) {
      return false;
    }
    return interactDoorByUuid(doorUuid);
  };

  const getNearestPickupItemDistance = (): number => {
    const pickupRange = playerState.pickupRange / 32;
    let nearestDistance = Number.POSITIVE_INFINITY;

    droppedItemMeshes.forEach((mesh) => {
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

  /** E-key door use — skipped when a pickup is closer than the door. */
  const tryInteractNearbyDoorRespectingPickup = (): boolean => {
    const pickupRange = playerState.pickupRange / 32;
    const nearestItemDistance = getNearestPickupItemDistance();
    const nearbyDoor = findNearbyDoor(DOOR_INTERACT_RADIUS);
    if (!nearbyDoor) {
      return false;
    }

    const doorDistance = getDoorInteractDistance(nearbyDoor);
    if (
      nearestItemDistance <= pickupRange &&
      nearestItemDistance + 0.08 < doorDistance
    ) {
      return false;
    }

    return interactDoorByUuid(nearbyDoor.uuid);
  };

  const ensureLevelDoorsSeeded = async (level: string) => {
    if (seededDoorLevels.has(level)) {
      return;
    }

    const mapData = await loadMapData();
    if (!mapData) {
      return;
    }

    const levelData = mapData.levels?.[level];
    const entityTemplates = mapData.entityTemplates || {};
    const wallColor = safeTileColor(
      mapData.tileDefinitions?.wal?.color,
      "#7c5a3b",
    );

    levelData?.entities?.forEach((entity, index) => {
      const entityDef = entityTemplates[entity.symbol];
      if (!entityDef || entityDef.type !== "door") {
        return;
      }

      const uuid =
        entity.uuid ||
        entityDef.uuid ||
        `door_${level}_${entity.x}_${entity.y}_${index}`;
      if (doors.has(uuid)) {
        return;
      }

      playerState.seedDoorState(uuid, {
        open: false,
        locked: entity.locked ?? entityDef.locked ?? false,
        keyId: entity.keyId ?? entityDef.keyId ?? null,
      });

      const orientation = resolveDoorOrientation(
        level,
        entity.x,
        entity.y,
        mapData,
      );
      const doorHeight = DOOR_PANEL_HEIGHT;

      const doorMesh = MeshBuilder.CreateBox(
        `slice-door-${uuid}`,
        {
          width: orientation.hingeOnX ? 0.96 : 0.14,
          height: doorHeight,
          depth: orientation.hingeOnX ? 0.14 : 0.96,
        },
        scene,
      );
      const doorMaterial = new StandardMaterial(`slice-door-mat-${uuid}`, scene);
      doorMaterial.diffuseColor = wallColor.scale(0.9);
      doorMaterial.specularColor = Color3.Black();
      doorMaterial.emissiveColor = wallColor.scale(0.15);
      doorMesh.material = doorMaterial;
      doorMesh.isPickable = true;
      doorMesh.metadata = { sliceDoorUuid: uuid };

      const door: SliceDoor = {
        uuid,
        level,
        tileX: entity.x,
        tileY: entity.y,
        doorId: entityDef.id || "door",
        locked: entity.locked ?? entityDef.locked ?? false,
        keyId: entity.keyId ?? entityDef.keyId ?? null,
        mesh: doorMesh,
        hingeOnX: orientation.hingeOnX,
        hingeSide: orientation.hingeSide,
      };
      doors.set(uuid, door);
      doorByLevelTile.set(getDoorTileKey(level, entity.x, entity.y), uuid);
      updateDoorVisual(door);
    });

    seededDoorLevels.add(level);
    refreshDoorSystemsForLevel(level);
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

    WorldMapService.bootstrapMinimap(mapData, binaryLevels, activeLevel);
    collisionWorld.rebuild(
      levelKeys,
      mapData.width ?? 0,
      mapData.height ?? 0,
    );
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
    await ensureLevelDoorsSeeded(resolvedLevel);

    if (resolvedLevel !== activeLevel) {
      activeLevel = resolvedLevel;
      activeLevelNumber = parseLevelNumber(resolvedLevel);
      playerState.setCurrentLevel(resolvedLevel);
    }

    await renderMapLevel(resolvedLevel);
    await ensureLevelPropsSeeded(resolvedLevel);

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

  const getPropSpawnsForLevel = async (
    level: string,
  ): Promise<PropSpawnData[]> => {
    const mapData = await loadMapData();
    if (!mapData) {
      return [];
    }

    const levelData = mapData.levels?.[level];
    const templates = mapData.entityTemplates || {};
    if (!levelData?.entities) {
      return [];
    }

    const spawns: PropSpawnData[] = [];
    for (const entity of levelData.entities) {
      const template = templates[entity.symbol];
      if (!template || template.type !== "decoration" || !template.id) {
        continue;
      }
      if (!isKnownPropId(template.id)) {
        continue;
      }

      spawns.push({
        propId: template.id,
        tileX: entity.x,
        tileY: entity.y,
        isCollidable: template.isCollidable ?? false,
      });
    }

    return spawns;
  };

  const clearProps = () => {
    props.forEach((prop) => {
      const observer = (prop.meshRoot as any)._propAnimObserver;
      if (observer) {
        scene.onBeforeRenderObservable.remove(observer);
      }
      prop.meshRoot.dispose();
    });
    props.clear();
    propSpawnCatalog.clear();
    collidablePropTilesByLevel.clear();
    seededPropLevels.clear();
  };

  const getPropCatalogKey = (level: string, spawn: PropSpawnData) =>
    `${level}_${spawn.propId}_${spawn.tileX}_${spawn.tileY}`;

  const despawnProp = (uid: string) => {
    const prop = props.get(uid);
    if (!prop) {
      return;
    }
    const observer = (prop.meshRoot as any)._propAnimObserver;
    if (observer) {
      scene.onBeforeRenderObservable.remove(observer);
    }
    prop.meshRoot.dispose();
    props.delete(uid);
  };

  const applyPropAnimLod = (prop: SliceProp, distance: number) => {
    const setter = (prop.meshRoot as any)._setAnimIntervalScale as
      | ((scale: number) => void)
      | undefined;
    if (typeof setter !== "function") {
      return;
    }
    if (distance <= 18) {
      setter(1);
    } else if (distance <= 36) {
      setter(0.55);
    } else {
      setter(0.3);
    }
  };

  const spawnProp = (spawn: PropSpawnData, index: number, level: string) => {
    const meshRoot = createPropBillboard(
      scene,
      spawn.propId,
      `slice-prop-${level}-${spawn.propId}-${index}`,
      spawn.tileX,
      spawn.tileY,
    );
    if (!meshRoot) {
      return;
    }

    const uid = `${level}_${spawn.propId}_${spawn.tileX}_${spawn.tileY}`;
    const worldX = spawn.tileX + 0.5;
    const worldZ = spawn.tileY + 0.5;
    meshRoot.parent = mapRoot;
    meshRoot.position.set(
      worldX,
      resolveWorldAnchorY(worldX, worldZ, level),
      worldZ,
    );
    meshRoot.setEnabled(false);

    props.set(uid, {
      uid,
      level,
      propId: spawn.propId,
      tileX: spawn.tileX,
      tileY: spawn.tileY,
      meshRoot,
    });
  };

  const syncPropStream = (force = false) => {
    if (!force) {
      const now = performance.now();
      const prev = (syncPropStream as any)._lastSyncAt as number | undefined;
      if (prev !== undefined && now - prev < PROP_STREAM_SYNC_INTERVAL * 1000) {
        return;
      }
      (syncPropStream as any)._lastSyncAt = now;
    }

    const px = player.position.x;
    const pz = player.position.z;
    const streamRadius = isFirstPerson
      ? propStreamRadiusUnitsFirstPerson
      : propStreamRadiusUnits;
    const streamRadiusSq = streamRadius * streamRadius;
    const despawnRadiusSq = propDespawnRadiusUnits * propDespawnRadiusUnits;

    const py = player.position.y;

    props.forEach((prop, uid) => {
      // Despawn props that are on a different floor (more than LEVEL_HEIGHT away vertically)
      if (Math.abs(levelToWorldY(prop.level) - py) >= LEVEL_HEIGHT) {
        despawnProp(uid);
        return;
      }
      const dx = prop.meshRoot.position.x - px;
      const dz = prop.meshRoot.position.z - pz;
      const distSq = dx * dx + dz * dz;
      if (distSq <= despawnRadiusSq) {
        if (prop.meshRoot.isEnabled()) {
          prop.meshRoot.position.y = resolveWorldAnchorY(
            prop.meshRoot.position.x,
            prop.meshRoot.position.z,
            prop.level,
          );
          applyPropAnimLod(prop, Math.hypot(dx, dz));
        }
        return;
      }
      despawnProp(uid);
    });

    propSpawnCatalog.forEach((entry, uid) => {
      // Only spawn props on the same floor (within LEVEL_HEIGHT vertically)
      if (Math.abs(levelToWorldY(entry.level) - py) >= LEVEL_HEIGHT || props.has(uid)) {
        return;
      }

      const spawnX = entry.spawn.tileX + 0.5;
      const spawnZ = entry.spawn.tileY + 0.5;
      const dx = spawnX - px;
      const dz = spawnZ - pz;
      if (dx * dx + dz * dz > streamRadiusSq) {
        return;
      }

      spawnProp(entry.spawn, entry.index, entry.level);
      const spawned = props.get(uid);
      if (!spawned) {
        return;
      }
      const dist = Math.hypot(dx, dz);
      spawned.meshRoot.position.y = resolveWorldAnchorY(spawnX, spawnZ, entry.level);
      spawned.meshRoot.setEnabled(true);
      applyPropAnimLod(spawned, dist);
    });
  };

  const ensureLevelPropsSeeded = async (level: string) => {
    if (seededPropLevels.has(level)) {
      syncPropStream(true);
      return;
    }

    const spawns = await getPropSpawnsForLevel(level);
    spawns.forEach((spawn, index) => {
      const key = getPropCatalogKey(level, spawn);
      propSpawnCatalog.set(key, { level, spawn, index });
      if (spawn.isCollidable) {
        const tileSet =
          collidablePropTilesByLevel.get(level) ?? new Set<string>();
        tileSet.add(getPropTileKey(spawn.tileX, spawn.tileY));
        collidablePropTilesByLevel.set(level, tileSet);
      }
    });
    seededPropLevels.add(level);

    if (level === activeLevel) {
      rebuildNavigationWindow(level, true);
    }

    (window as any).__slice3dProps = {
      level,
      streamed: props.size,
      cataloged: propSpawnCatalog.size,
    };
    syncPropStream(true);
  };

  const clearEnemies = () => {
    enemies.forEach((enemy) => enemy.meshRoot.dispose());
    enemies.clear();
    enemySpawnCatalog.clear();
    pendingEnemyRespawns.clear();
    seededEnemyLevels.clear();
    selectedEnemyUid = null;
  };

  /** 2D parity: on player death, living enemies reset to spawn/full HP; killed ones keep respawn timers. */
  const resetLivingEnemiesForPlayerRespawn = () => {
    enemies.forEach((enemy) => {
      if (!enemy.meshRoot.isDisposed()) {
        enemy.meshRoot.dispose();
      }
    });
    enemies.clear();
    setSelectedEnemy(null);
    syncEnemyStream(true);
  };

  const hydratePendingEnemyRespawnsFromPersistedDead = () => {
    enemySpawnCatalog.forEach((entry, spawnKey) => {
      if (!playerState.isEnemy3dDead(entry.level, spawnKey)) {
        return;
      }
      if (pendingEnemyRespawns.has(spawnKey)) {
        return;
      }
      pendingEnemyRespawns.set(spawnKey, {
        level: entry.level,
        spawn: entry.spawn,
        index: entry.index,
        elapsedMs: 0,
        respawnTimeMs: ENEMY_RESPAWN_MS,
      });
    });
  };

  const clearEnemy3dDeadPersistence = (level: string, spawnKey: string) => {
    const unmark = playerState.unmarkEnemy3dDead;
    if (typeof unmark === "function") {
      unmark.call(playerState, level, spawnKey);
      return;
    }
    if (!playerState.isEnemy3dDead(level, spawnKey)) {
      return;
    }
    const snapshot = playerState.getDeadEnemies3dSnapshot();
    const remaining = snapshot[level]?.filter((key) => key !== spawnKey) ?? [];
    if (remaining.length > 0) {
      snapshot[level] = remaining;
    } else {
      delete snapshot[level];
    }
    playerState.loadDeadEnemies3d(snapshot);
  };

  const isSpawnKeyInstantiated = (spawnKey: string) => {
    let found = false;
    enemies.forEach((enemy) => {
      if (enemy.spawnKey === spawnKey) {
        found = true;
      }
    });
    return found;
  };

  const syncEnemyStream = (force = false) => {
    if (!force) {
      const now = performance.now();
      const prev = (syncEnemyStream as any)._lastSyncAt as number | undefined;
      if (prev !== undefined && now - prev < ENEMY_STREAM_SYNC_INTERVAL * 1000) {
        return;
      }
      (syncEnemyStream as any)._lastSyncAt = now;
    }

    const px = player.position.x;
    const pz = player.position.z;
    const streamRadiusSq = enemyStreamRadiusUnits * enemyStreamRadiusUnits;
    const despawnRadiusSq =
      enemyDespawnRadiusUnits * enemyDespawnRadiusUnits;

    const py = player.position.y;

    enemies.forEach((enemy, uid) => {
      // Despawn enemies that are on a different floor (more than LEVEL_HEIGHT away vertically)
      if (Math.abs(levelToWorldY(enemy.level) - py) >= LEVEL_HEIGHT) {
        if (selectedEnemyUid === uid) {
          setSelectedEnemy(null);
        }
        enemy.meshRoot.dispose();
        enemies.delete(uid);
        return;
      }

      const dx = enemy.worldPos.x - px;
      const dz = enemy.worldPos.z - pz;
      if (dx * dx + dz * dz <= despawnRadiusSq) {
        return;
      }
      if (selectedEnemyUid === uid) {
        setSelectedEnemy(null);
      }
      enemy.meshRoot.dispose();
      enemies.delete(uid);
    });

    enemySpawnCatalog.forEach((entry, spawnKey) => {
      // Only spawn enemies on the same floor (within LEVEL_HEIGHT vertically)
      if (Math.abs(levelToWorldY(entry.level) - py) >= LEVEL_HEIGHT) {
        return;
      }
      if (pendingEnemyRespawns.has(spawnKey)) {
        return;
      }
      if (isSpawnKeyInstantiated(spawnKey)) {
        return;
      }

      const spawnX = worldToSliceCoord(entry.spawn.x);
      const spawnZ = worldToSliceCoord(entry.spawn.y);
      const dx = spawnX - px;
      const dz = spawnZ - pz;
      if (dx * dx + dz * dz > streamRadiusSq) {
        return;
      }

      spawnEnemy(entry.spawn, entry.index, spawnKey, entry.level);
    });
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

  const emitCombatEnemyHit = (enemy: SliceEnemy, damage: number) => {
    if (damage <= 0) {
      return;
    }
    playerState.emit("combatEnemyHit", {
      uid: enemy.uid,
      enemyType: enemy.enemyType,
      health: enemy.health,
      maxHealth: enemy.maxHealth,
      damage,
      isFocused: enemy.uid === selectedEnemyUid,
    });
    playerState.emit("combatEnemyHealthChanged", {
      uid: enemy.uid,
      health: enemy.health,
      maxHealth: enemy.maxHealth,
    });
  };

  const spawnEnemy = (
    spawn: EnemySpawnData,
    index: number,
    spawnKey: string,
    level: string,
    options?: { withRespawnVfx?: boolean },
  ) => {
    const definition = EnemyRegistry.getEnemyDefinition(spawn.enemyType);
    if (!definition) {
      return;
    }

    // Skip enemies waiting on respawn timer
    if (pendingEnemyRespawns.has(spawnKey)) {
      return;
    }

    const uid = `${level}_${spawn.enemyType}_${index}_${Date.now().toString(36)}`;
    const meshRoot = createEnemyVisual(
      scene,
      spawn.enemyType,
      `slice-enemy-${uid}`,
    );
    const spawnLevelY = levelToWorldY(level);
    const worldPos = new Vector3(
      worldToSliceCoord(spawn.x),
      spawnLevelY,
      worldToSliceCoord(spawn.y),
    );
    applyActorAquaticY(worldPos, level);
    meshRoot.position = worldPos.clone();
    meshRoot.metadata = { sliceEnemyUid: uid };

    const instance: SliceEnemy = {
      uid,
      spawnKey,
      level,
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
      animState: "idle",
      animDirection: "south",
      animLockedUntil: 0,
    };

    setEnemyAnimState(instance, "idle");

    const showOnActiveLevel = () => {
      meshRoot.setEnabled(level === activeLevel);
    };

    if (options?.withRespawnVfx) {
      meshRoot.setEnabled(false);
      playRespawnGlowAt(scene, worldPos, level, activeLevel, showOnActiveLevel);
    } else {
      showOnActiveLevel();
    }

    enemies.set(uid, instance);
  };

  const ensureLevelEnemiesSeeded = async (level: string) => {
    if (seededEnemyLevels.has(level)) {
      hydratePendingEnemyRespawnsFromPersistedDead();
      syncEnemyStream(true);
      return;
    }

    const spawns = await getEnemySpawnsForLevel(level);
    spawns.forEach((spawn, index) => {
      const spawnKey = `${level}_${spawn.enemyType}_${index}`;
      enemySpawnCatalog.set(spawnKey, { level, spawn, index });
    });
    seededEnemyLevels.add(level);
    hydratePendingEnemyRespawnsFromPersistedDead();
    syncEnemyStream(true);
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

  const applyRuneDamageToEnemy = (
    enemy: SliceEnemy,
    damage: number,
    runeId: string,
  ) => {
    if (enemy.isDead) {
      return;
    }

    const rune = RuneRegistry.getRune(runeId);
    const element = rune?.damage.element;
    const initialHp = enemy.health;

    enemy.health = Math.max(0, enemy.health - damage);
    enemy.isProvoked = true;

    playerState.emit("floatingText", {
      x: enemy.worldPos.x,
      y: enemy.worldPos.y,
      z: enemy.worldPos.z,
      damage: -damage,
      isCritical: false,
    });

    playerState.log(
      "combat_damage_dealt",
      { damage, target: enemy.enemyType },
      "#ffffff",
    );

    emitCombatEnemyHit(enemy, damage);

    // Apply Intelligence XP
    const actualDamageDealt = Math.min(damage, initialHp);
    const xpGain = actualDamageDealt > 0 ? (100 + actualDamageDealt) : 10;
    playerState.gainIntelligenceExperience(xpGain);
    playerState.log(
      "combat_gained_skill_xp",
      { skill: "Intelligence", amount: xpGain },
      "#34d399",
    );

    if (enemy.health <= 0) {
      const isFireKill = element === "fire";
      destroyEnemy(enemy, { finishingDamage: damage, isFireKill });
    }
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

  const setEnemyDirection = (enemy: SliceEnemy, direction: HeroBmsDirection) => {
    if (enemy.animDirection === direction) {
      return;
    }
    enemy.animDirection = direction;
    setEnemyVisualDirection(enemy.meshRoot, direction);
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

  const gainCombatExperience3d = (damageDealt: number = 0): void => {
    const totalXp = damageDealt > 0 ? (100 + damageDealt) : 10;
    const isFireAttack = playerState.getEquippedWeapon()?.element === "fire";
    const equippedWeapon = playerState.getEquippedWeapon();

    if (isFireAttack) {
      playerState.gainIntelligenceExperience(totalXp);
      playerState.log(
        "combat_gained_skill_xp",
        { skill: "Intelligence", amount: totalXp },
        "#34d399",
      );
    } else if (
      !equippedWeapon ||
      equippedWeapon.type === ItemType.SWORD ||
      equippedWeapon.type === ItemType.AXE ||
      equippedWeapon.type === ItemType.CLUB
    ) {
      playerState.gainStrengthExperience(totalXp);
      playerState.log(
        "combat_gained_skill_xp",
        { skill: "Strength", amount: totalXp },
        "#34d399",
      );
    } else if (equippedWeapon.type === ItemType.DISTANCE) {
      playerState.gainDexterityExperience(totalXp);
      playerState.log(
        "combat_gained_skill_xp",
        { skill: "Dexterity", amount: totalXp },
        "#34d399",
      );
    } else {
      playerState.gainStrengthExperience(totalXp);
      playerState.log(
        "combat_gained_skill_xp",
        { skill: "Strength", amount: totalXp },
        "#34d399",
      );
    }
  };

  const applyPlayerAttackToEnemy = (enemy: SliceEnemy) => {
    const equippedWeapon = playerState.getEquippedWeapon();
    const isFireAttack = equippedWeapon?.element === "fire";
    const maxAttack = equippedWeapon
      ? Math.max(1, Math.floor(playerState.getTotalAttack()))
      : 5;
    const attackRoll = randomInt(1, maxAttack);
    const enemyDefense = Math.max(1, enemy.definition.defense || 1);
    const defenseRoll = randomInt(1, enemyDefense);

    let damageMitigation = 0;
    if (attackRoll <= defenseRoll) {
      if (isFireAttack) {
        damageMitigation = 0.5; // partial block
        playerState.emit("floatingText", {
          x: enemy.worldPos.x,
          y: enemy.worldPos.y,
          z: enemy.worldPos.z,
          message: "🛡️",
          customColor: "#00FFFF",
        });
        playerState.log(
          "combat_partially_blocked",
          { target: enemy.enemyType },
          "#aaaaaa",
        );
        if (damageMitigation >= 1) {
          audioManager.playBlock();
          gainCombatExperience3d(0);
          return;
        }
      } else {
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
        gainCombatExperience3d(0);
        return;
      }
    }

    const initialDamage = randomInt(1, maxAttack);
    const armor = Math.max(0, enemy.definition.armor || 0);
    const minReduction = armor > 0 ? Math.max(1, Math.ceil(armor * 0.1)) : 0;
    const armorReduction =
      armor > 0 ? randomInt(minReduction, Math.max(minReduction, armor)) : 0;

    let damage = Math.max(0, Math.floor(initialDamage - armorReduction));
    if (damageMitigation > 0) {
      damage = Math.max(1, Math.round(damage * (1 - damageMitigation)));
    }

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
      gainCombatExperience3d(0);
      return;
    }

    if (isFireAttack) {
      const fireRes = Math.max(
        -0.95,
        Math.min(0.95, enemy.definition.resistances?.fire ?? 0),
      );
      damage = Math.max(1, Math.round(damage * (1 - fireRes)));
    }

    const critChance = playerState.getCriticalChance();
    const isCritical = Math.random() * 100 <= critChance;
    if (isCritical) {
      const critMult = Math.max(0, playerState.getCriticalDamageMultiplier());
      const minCrit = maxAttack;
      const maxCrit = Math.max(minCrit, Math.floor(maxAttack * (1 + critMult)));
      damage = randomInt(minCrit, maxCrit);
      playerState.gainStrengthExperience(100);
      playerState.gainDexterityExperience(100);
      audioManager.playCritical();
      playerState.log("combat_critical_hit", { damage }, "#ff00ff");
    } else {
      audioManager.playAttack();
    }

    const initialEnemyHp = enemy.health;
    enemy.health = Math.max(0, enemy.health - damage);
    enemy.isProvoked = true;

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

    emitCombatEnemyHit(enemy, damage);

    const effectiveDamage = Math.max(0, Math.min(damage, initialEnemyHp));
    gainCombatExperience3d(effectiveDamage);

    if (enemy.health <= 0) {
      destroyEnemy(enemy, {
        finishingDamage: damage,
        isFireKill: isFireAttack,
      });
      return;
    }
  };

  const applyEnemyAttackToPlayer = (enemy: SliceEnemy, now: number) => {
    const cooldown = Math.max(0, enemy.definition.cooldown || 1000);
    if (now - enemy.lastAttackAt < cooldown) {
      return;
    }

    enemy.lastAttackAt = now;
    const attackLockMs = getGeneratedAttackDurationMs(enemy.enemyType);
    setEnemyAnimState(enemy, "attack", attackLockMs);

    const isFireAttack =
      enemy.enemyType === "dragon" ||
      Boolean(
        enemy.definition.magicAttacks?.some((magicId) =>
          magicId.toLowerCase().includes("fire"),
        ),
      );
    // S10-T2: Use full StatManager defense (shield + weapon def + level/reflex bonuses) — 2D parity.
    const defenseRollMax = Math.max(1, playerState.getTotalDefense());
    const attackDamage = Math.max(1, enemy.definition.damage);
    const attackRoll = randomInt(1, attackDamage);
    const defenseRoll = randomInt(1, defenseRollMax);
    let damageMitigation = 0;

    const totalReflexXp = 100 + attackRoll;

    if (defenseRoll >= attackRoll) {
      playerState.gainReflexExperience(totalReflexXp);

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
        playerState.log(
          "combat_blocked_player",
          { target: enemy.enemyType, xp: totalReflexXp },
          "#aaaaff",
        );
        if (damageMitigation >= 1) {
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
          { target: enemy.enemyType, xp: totalReflexXp },
          "#aaaaff",
        );
        audioManager.playBlock();
        return;
      }
    } else {
      playerState.gainReflexExperience(10);
      playerState.log(
        "combat_gained_skill_xp",
        { skill: "Reflex", amount: 10 },
        "#34d399",
      );
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
      triggerPlayerDeathSequence();
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
      setEnemyAnimState(
        enemy,
        "attack",
        getGeneratedAttackDurationMs(enemy.enemyType),
      );

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
        triggerPlayerDeathSequence();
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

  const firePlayerWeaponProjectile = (aimEnemy: SliceEnemy): boolean => {
    const equippedWeapon = playerState.getEquippedWeapon();
    if (!equippedWeapon || equippedWeapon.type !== ItemType.DISTANCE) {
      return false;
    }

    const origin = player.position.clone();
    origin.y += 0.52;

    const targetPos = aimEnemy.worldPos.clone();
    targetPos.y = origin.y;
    const direction = targetPos.subtract(origin);
    if (direction.lengthSquared() < 0.0001) {
      return false;
    }

    const enemyTargets: ProjectileEnemyTarget[] = [];
    enemies.forEach((enemy) => {
      if (enemy.isDead) {
        return;
      }
      enemyTargets.push({
        uid: enemy.uid,
        worldPos: enemy.worldPos.clone(),
        isDead: enemy.isDead,
      });
    });

    audioManager.playRangedWeaponShot(equippedWeapon.id);

    return projectileSystem.fire({
      origin,
      direction,
      maxRange: getPlayerAttackRangeUnits(),
      profile: resolveProjectile3DProfile(equippedWeapon.id),
      enemies: enemyTargets,
      onEnemyHit: (hit) => {
        const enemy = enemies.get(hit.uid);
        if (enemy && !enemy.isDead) {
          applyPlayerAttackToEnemy(enemy);
        }
      },
    });
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
    setHeroAnimState("attack", 320);

    const equippedWeapon = playerState.getEquippedWeapon();
    if (equippedWeapon?.type === ItemType.DISTANCE) {
      firePlayerWeaponProjectile(enemy);
      return;
    }

    triggerPlayerAttackSlashEffect(enemy);
    applyPlayerAttackToEnemy(enemy);
  };

  const requestEnemyPath = async (
    enemy: SliceEnemy,
    targetPosition: Vector3,
  ) => {
    const pathRequestStartedAt = performance.now();
    pathMetrics.requests += 1;
    pathMetrics.inFlight += 1;
    rebuildNavigationWindow(enemy.level);
    const startX = Math.floor(enemy.worldPos.x) - navWindowMinTileX;
    const startY = Math.floor(enemy.worldPos.z) - navWindowMinTileY;
    const endX = Math.floor(targetPosition.x) - navWindowMinTileX;
    const endY = Math.floor(targetPosition.z) - navWindowMinTileY;

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
      waypoint.x + navWindowMinTileX + 0.5,
      enemy.worldPos.y, // preserve enemy's current level Y — fixes floating in underground levels
      waypoint.y + navWindowMinTileY + 0.5,
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

  const resolveEnemyBmsDirection = (
    enemy: SliceEnemy,
    deltaX: number,
    deltaZ: number,
  ): HeroBmsDirection => {
    const activeCamera = scene.activeCamera ?? camera;
    return resolveBmsDirectionFromWorldDelta(
      deltaX,
      deltaZ,
      enemy.animDirection,
      {
        scene,
        camera: activeCamera,
        origin: enemy.worldPos,
      },
    );
  };

  const faceEnemyToward = (
    enemy: SliceEnemy,
    targetX: number,
    targetZ: number,
  ) => {
    if (enemy.isDead) {
      return;
    }
    const dx = targetX - enemy.worldPos.x;
    const dz = targetZ - enemy.worldPos.z;
    if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001) {
      return;
    }
    setEnemyDirection(enemy, resolveEnemyBmsDirection(enemy, dx, dz));
  };

  const updateEnemyAI = (deltaSeconds: number) => {
    const now = Date.now();

    enemies.forEach((enemy) => {
      // Treat enemy as "on active level" when within LEVEL_HEIGHT vertically (Y-based, not string)
      const onActiveLevel = Math.abs(levelToWorldY(enemy.level) - player.position.y) < LEVEL_HEIGHT;
      if (!onActiveLevel) {
        enemy.meshRoot.setEnabled(false);
        if (selectedEnemyUid === enemy.uid) {
          setSelectedEnemy(null);
        }
        return;
      }

      if (enemy.isDead) {
        enemy.meshRoot.setEnabled(true);
        enemy.meshRoot.position = enemy.worldPos;
        return;
      }

      const distanceToPlayer = Vector3.Distance(
        enemy.worldPos,
        player.position,
      );
      const enemyVisible = distanceToPlayer <= ENEMY_VISIBILITY_RADIUS_UNITS;
      enemy.meshRoot.setEnabled(enemyVisible);
      applyEnemyAnimLod(enemy.meshRoot, distanceToPlayer, enemyVisible);

      if (isFirstPerson && enemyVisible) {
        const fpScale = getFirstPersonEnemyProximityScale(distanceToPlayer);
        enemy.meshRoot.scaling.set(fpScale, fpScale, fpScale);
      } else if (enemy.meshRoot.scaling.x !== 1) {
        enemy.meshRoot.scaling.set(1, 1, 1);
      }

      if (!enemyVisible && selectedEnemyUid === enemy.uid) {
        setSelectedEnemy(null);
      }

      if (distanceToPlayer > ENEMY_AI_RADIUS_UNITS) {
        setEnemyAnimState(enemy, "idle");
        enemy.currentPath = [];
        enemy.meshRoot.position = enemy.worldPos; // Ensure base position is applied
        return;
      }

      // Perform resource-heavy operations only when within AI range (active AI)
      applyActorAquaticY(enemy.worldPos, enemy.level);
      enemy.meshRoot.position = enemy.worldPos;
      const enemyAquatic = getAquaticSampleAt(
        enemy.worldPos.x,
        enemy.worldPos.z,
        enemy.level,
      );
      const enemyAquaticTint = (enemy.meshRoot as any)._aquaticTint as
        | { update: (sample: AquaticSample) => void }
        | undefined;
      enemyAquaticTint?.update(enemyAquatic);

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
        faceEnemyToward(
          enemy,
          player.position.x,
          player.position.z,
        );
        applyEnemyAttackToPlayer(enemy, now);
        if (now >= enemy.animLockedUntil && enemy.animState === "attack") {
          setEnemyAnimState(enemy, "idle");
        }
        return;
      }

      const targetPos = currentlyChasing ? player.position : enemy.spawnPos;
      const prevX = enemy.worldPos.x;
      const prevZ = enemy.worldPos.z;

      if (now - enemy.lastPathAt > 1000) {
        // Skip pathfinding when the enemy is already at (or within 0.8 units of)
        // its target — prevents hammering the pathfinder with trivially empty paths.
        const distToTarget = Vector3.Distance(enemy.worldPos, targetPos);
        if (distToTarget >= 0.8) {
          enemy.lastPathAt = now;
          void requestEnemyPath(enemy, targetPos);
        }
      }

      advanceEnemyPath(enemy, deltaSeconds);
      const movedSq =
        (enemy.worldPos.x - prevX) * (enemy.worldPos.x - prevX) +
        (enemy.worldPos.z - prevZ) * (enemy.worldPos.z - prevZ);

      if (currentlyChasing) {
        faceEnemyToward(
          enemy,
          player.position.x,
          player.position.z,
        );
      } else if (movedSq > 0.0001) {
        setEnemyDirection(
          enemy,
          resolveEnemyBmsDirection(
            enemy,
            enemy.worldPos.x - prevX,
            enemy.worldPos.z - prevZ,
          ),
        );
      }

      if (movedSq > 0.0001) {
        setEnemyAnimState(enemy, "walk");
      } else {
        setEnemyAnimState(enemy, "idle");
      }

      if (
        !currentlyChasing &&
        Vector3.Distance(enemy.worldPos, enemy.spawnPos) < 0.4
      ) {
        enemy.currentPath = [];
      }
    });
  };

  const syncDroppedItems = (force = false) => {
    if (!force) {
      const now = performance.now();
      const prev = (syncDroppedItems as any)._lastSyncAt as number | undefined;
      if (prev !== undefined && now - prev < DROP_SYNC_INTERVAL * 1000) {
        return;
      }
      (syncDroppedItems as any)._lastSyncAt = now;
    }

    const currentLevel = playerState.getCurrentLevel();
    if (currentLevel !== activeLevel) {
      const previousLevel = activeLevel;
      activeLevel = currentLevel;
      activeLevelNumber = parseLevelNumber(currentLevel);
      void ensureMapLevelReady(currentLevel);
      void ensureLevelDoorsSeeded(currentLevel);
      void ensureLevelItemsSeeded(currentLevel);
      void ensureLevelEnemiesSeeded(currentLevel);
      void ensureLevelPropsSeeded(currentLevel);
      setSelectedEnemy(null);
      pushLogEvent("level.change", {
        from: previousLevel,
        to: currentLevel,
        playerX: Math.round(player.position.x * 100) / 100,
        playerZ: Math.round(player.position.z * 100) / 100,
      });
    }

    const persistentItems = playerState.getPersistentDroppedItems(currentLevel);
    const playerX = player.position.x;
    const playerZ = player.position.z;
    const maxDistSq =
      droppedItemStreamRadiusUnits * droppedItemStreamRadiusUnits;

    const streamedItems = persistentItems.filter((item) => {
      const ix = worldToSliceCoord(item.x);
      const iz = worldToSliceCoord(item.y);
      const dx = ix - playerX;
      const dz = iz - playerZ;
      return dx * dx + dz * dz <= maxDistSq;
    });

    const nextKeys = new Set(
      streamedItems.map((item) =>
        getDroppedItemMeshKey(currentLevel, item.itemId),
      ),
    );

    droppedItemMeshes.forEach((mesh, meshKey) => {
      const item = mesh.metadata as SliceDroppedItem | undefined;
      const isCurrentLevelMesh = item?.level === currentLevel;

      if (!isCurrentLevelMesh || !nextKeys.has(meshKey)) {
        mesh.dispose();
        droppedItemMeshes.delete(meshKey);
        return;
      }

      mesh.setEnabled(true);
    });

    streamedItems.forEach((item) => {
      const meshKey = getDroppedItemMeshKey(currentLevel, item.itemId);
      let container = droppedItemMeshes.get(meshKey);
      if (!container) {
        container = new TransformNode(`slice-dropped-root-${item.itemId}`, scene);

        const itemPlane = MeshBuilder.CreatePlane(
          `slice-dropped-plane-${item.itemId}`,
          { width: 0.42, height: 0.42 },
          scene,
        );
        itemPlane.material = getDroppedItemMaterial(item.weaponId);
        itemPlane.rotation.x = Math.PI / 2;
        itemPlane.parent = container;
        itemPlane.isPickable = false;

        const shadowDisc = MeshBuilder.CreateDisc(
          `slice-dropped-shadow-${item.itemId}`,
          { radius: 0.2, tessellation: 16 },
          scene,
        );
        shadowDisc.material = droppedItemShadowMat;
        shadowDisc.parent = container;
        shadowDisc.rotation.x = Math.PI / 2;
        shadowDisc.position.y = 0.002;
        shadowDisc.isPickable = false;

        // Apply deterministic rotation around Y axis
        container.rotation.y = getDeterministicRotation(item.itemId);

        (container as any).itemPlane = itemPlane;
        (container as any).shadowDisc = shadowDisc;

        droppedItemMeshes.set(meshKey, container);
      }

      const ix = worldToSliceCoord(item.x);
      const iz = worldToSliceCoord(item.y);
      const anchorY = resolveWorldAnchorY(
        ix,
        iz,
        currentLevel,
        DROPPED_ITEM_REST_OFFSET,
      );
      container.position.set(ix, anchorY, iz);
      container.metadata = {
        ...item,
        level: currentLevel,
      } satisfies SliceDroppedItem;
      container.setEnabled(true);
    });

    hasRealDroppedItems = persistentItems.length > 0;
    const showFallbackPickup = !hasRealDroppedItems && !fallbackPickupConsumed;
    if (showFallbackPickup) {
      pickupOrb.position.y = resolveWorldAnchorY(
        pickupOrb.position.x,
        pickupOrb.position.z,
        currentLevel,
        0.3,
      );
    }
    pickupOrb.setEnabled(showFallbackPickup);
  };

  /** Re-snap props/loot after floor slab height or tile binary becomes available. */
  const reanchorWorldContentOnLevel = (level: string) => {
    props.forEach((prop) => {
      if (prop.level !== level) {
        return;
      }
      const x = prop.meshRoot.position.x;
      const z = prop.meshRoot.position.z;
      prop.meshRoot.position.y = resolveWorldAnchorY(x, z, level);
    });
    syncDroppedItems(true);
  };

  const collectInteractableRevealTargets = (): InteractableRevealTarget[] => {
    const targets: InteractableRevealTarget[] = [];
    const level = activeLevel;

    enemies.forEach((enemy) => {
      if (enemy.isDead || enemy.level !== level) {
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
        level,
        position: enemy.worldPos.clone(),
        pickWidth,
        pickHeight,
        pickCenterY,
        pickMetadata: { sliceEnemyUid: enemy.uid },
      });
    });

    doors.forEach((door) => {
      if (door.level !== level) {
        return;
      }

      const feetY = levelToWorldY(door.level);
      const doorHeight = DOOR_PANEL_HEIGHT;
      targets.push({
        id: door.uuid,
        kind: "door",
        level,
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
          t_game(containerDef.name as any),
          { x: item.x, y: item.y, level: activeLevel },
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

  const waitForSpawnChunkReady = (timeoutMs = 12000): Promise<boolean> =>
    new Promise((resolve) => {
      const cx = Math.floor(player.position.x / CHUNK_SIZE);
      const cy = Math.floor(player.position.z / CHUNK_SIZE);
      const key = `${cx}_${cy}`;
      const deadline = performance.now() + timeoutMs;

      const poll = () => {
        if (chunkMeshes.has(key)) {
          resolve(true);
          return;
        }
        if (performance.now() >= deadline) {
          console.warn("[3D Slice] Spawn chunk timed out", key);
          resolve(false);
          return;
        }
        if (!chunkMeshes.has(key) && !chunkLoading.has(key)) {
          buildChunk(cx, cy, 0);
        }
        requestAnimationFrame(poll);
      };

      updateChunks();
      poll();
    });

  const bootstrapWorldSession = async () => {
    pushLogEvent("world.bootstrap.start", { map: sliceMapName, level: activeLevel });
    try {
      await ensureMapLevelReady(activeLevel);
      snapPlayerFootToActiveLevel();
      await waitForSpawnChunkReady();
      snapPlayerFootToActiveLevel();

      const tileX = Math.floor(player.position.x);
      const tileZ = Math.floor(player.position.z);
      const supportSymbol = getMapTileAt(activeLevel, tileX, tileZ);
      if (isVoidSymbol(supportSymbol)) {
        throw new Error(
          `[3D Slice] Invalid spawn tile (${tileX},${tileZ}) on level ${activeLevel}`,
        );
      }

      lastGroundedFootY = player.position.y;
      fallOriginFootY = player.position.y;
      isGrounded = true;
      holeFallLandingLevel = null;
      holeFallFloorCount = 0;
      verticalVelocity = 0;

      reanchorWorldContentOnLevel(activeLevel);
      syncPropStream(true);

      worldBootstrapReady = true;
      setPlayerAvatarVisible(true);
      camera.setTarget(
        new Vector3(player.position.x, player.position.y, player.position.z),
      );

      resolveWorldReady?.();
      document.dispatchEvent(
        new CustomEvent("slice3d:worldBootstrap", {
          detail: { ready: true, map: sliceMapName, level: activeLevel },
        }),
      );
      pushLogEvent("world.bootstrap.ready", {
        x: Math.round(player.position.x * 100) / 100,
        y: Math.round(player.position.y * 100) / 100,
        z: Math.round(player.position.z * 100) / 100,
      });
    } catch (error) {
      console.error("[3D Slice] World bootstrap failed", error);
      document.dispatchEvent(
        new CustomEvent("slice3d:worldBootstrap", {
          detail: { ready: false, map: sliceMapName, error: String(error) },
        }),
      );
      pushLogEvent("world.bootstrap.failed", { error: String(error) });
    }
  };

  void bootstrapWorldSession();
  void ensureLevelItemsSeeded(activeLevel);
  void ensureLevelEnemiesSeeded(activeLevel);
  void ensureLevelPropsSeeded(activeLevel);
  syncDroppedItems();

  const pressedKeys = new Set<string>();

  let verticalVelocity = 0;
  const gravity = -18;
  const fallGravity = -32;
  const jumpImpulse = 7.2;
  /** Quake-style: normal jump landings stay below this; hard falls exceed it. */
  const FALL_DAMAGE_MIN_IMPACT_SPEED = 9.5;
  let isGrounded = true;
  /** Set when stepping into a void tile; gravity runs until landing level ground. */
  let holeFallLandingLevel: string | null = null;
  let holeFallFloorCount = 0;
  let fallOriginFootY = player.position.y;
  let wasOnVoidWithSafety = false;
  let lastSafePlayerX = player.position.x;
  let lastSafePlayerZ = player.position.z;
  let lastGroundedFootY = player.position.y;
  let chunkUpdateTimer = 0;
  let levelTransitionCooldown = 0; // seconds until next floor change (ramp/stair)
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
  let dropSyncTimer = 0;
  let enemyStreamTimer = 0;
  let propStreamTimer = 0;
  let navWindowTimer = 0;
  let perfPublishTimer = 0;

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
    projectileSystem.setFirstPersonMode(firstPerson);
    if (!firstPerson) {
      fpCombatCameraState = createFirstPersonCombatCameraState();
      firstPersonCamera.fov = FP_CAMERA_FOV;
      enemies.forEach((enemy) => {
        enemy.meshRoot.scaling.set(1, 1, 1);
      });
    }

    if (activeLevelNumber < 0) {
      clearAllChunks();
      invalidateVerticalVisibilityCache();
      chunkUpdateTimer = CHUNK_UPDATE_INTERVAL;
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
          requestPointerLockIfPossible();
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
    pressedKeys.clear();
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

  const beginGravityHoleFall = (
    landingLevel: string,
    floors: number,
  ) => {
    if (holeFallLandingLevel) {
      return;
    }
    fallOriginFootY = player.position.y;
    isGrounded = false;
    verticalVelocity = Math.min(verticalVelocity, 0);
    holeFallLandingLevel = landingLevel;
    holeFallFloorCount = floors;

    const mapData = mapDataCache;
    if (mapData) {
      void loadLevelBinary(landingLevel, mapData);
    }
    void ensureLevelDoorsSeeded(landingLevel);
    void ensureLevelEnemiesSeeded(landingLevel);
    void ensureLevelItemsSeeded(landingLevel);
    void ensureLevelPropsSeeded(landingLevel);
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

  const isSolidCeilingTileAt = (
    level: string,
    tileX: number,
    tileZ: number,
  ) => {
    const symbol = getMapTileAt(level, tileX, tileZ);
    if (isVoidSymbol(symbol)) {
      return false;
    }
    const tileDef = symbol
      ? mapDataCache?.tileDefinitions?.[symbol]
      : undefined;
    return !isDownHoleTile(tileDef);
  };

  /**
   * Upper-floor slab side / underside — blocks movement when the hero body
   * intersects the 0.32u floor thickness band from below (pit edge, jump into lip).
   */
  const isBlockedByUpperFloorSlabAt = (
    worldX: number,
    worldZ: number,
    footY: number,
  ): boolean => {
    if (!mapDataCache?.levels) return false;
    const result = collisionWorld.query(
      worldX, worldZ,
      footY, footY + HERO_BODY_HEIGHT,
      Object.keys(mapDataCache.levels),
    );
    if (!result.ceiling) return false;
    return result.ceiling.bottomY <= footY + HERO_BODY_HEIGHT;
  };

  /** Feet Y cap when standing under solid geometry on the level above (column-only). */
  const resolveUpperLevelCeilingFeetCap = (): number | null => {
    if (!mapDataCache?.levels) return null;
    const result = collisionWorld.query(
      player.position.x, player.position.z,
      player.position.y, player.position.y + HERO_BODY_HEIGHT,
      Object.keys(mapDataCache.levels),
    );
    if (!result.ceiling || result.ceiling.isGraded) return null;
    if (player.position.y + HERO_BODY_HEIGHT < result.ceiling.bottomY - 0.04) return null;
    return result.ceiling.bottomY - CEILING_BODY_CLEARANCE - HERO_BODY_HEIGHT;
  };

  const resolveJumpImpulseForHeadroom = (): number => {
    const feetCap = resolveUpperLevelCeilingFeetCap();
    if (feetCap == null) {
      return jumpImpulse;
    }
    const headRoom = feetCap - player.position.y;
    if (headRoom < 0.35) {
      return 0;
    }
    if (headRoom < JUMP_FULL_HEADROOM) {
      return jumpImpulse * (headRoom / JUMP_FULL_HEADROOM);
    }
    return jumpImpulse;
  };

  const applyCeilingCollisionToVerticalMotion = () => {
    if (!mapDataCache?.levels) return;
    const result = collisionWorld.query(
      player.position.x, player.position.z,
      player.position.y, player.position.y + HERO_BODY_HEIGHT,
      Object.keys(mapDataCache.levels),
      activeLevel,
    );
    if (!result.ceiling || result.ceiling.isGraded) return;
    const maxY = result.ceiling.bottomY - CEILING_BODY_CLEARANCE - HERO_BODY_HEIGHT;
    if (player.position.y > maxY) {
      player.position.y = maxY;
      if (verticalVelocity > 0) verticalVelocity = 0;
    }
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
          : Object.keys(levels).find((level) => levels[level]?.playerPos) ??
            activeLevel;

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
    pressedKeys.clear();
    setSelectedEnemy(null);
    projectileSystem.disposeAll();
    holeFallLandingLevel = null;
    holeFallFloorCount = 0;
    verticalVelocity = 0;
    isGrounded = true;
    levelTransitionCooldown = 0;
    verticalTransitionGuard = null;

    if (respawn.level !== activeLevel) {
      applyActiveLevelChange(respawn.level, {
        tileX: Math.floor(respawn.x),
        tileZ: Math.floor(respawn.z),
        landingLocalZ: respawn.z - Math.floor(respawn.z),
        guardMs: 0,
      });
      await ensureMapLevelReady(respawn.level);
    }

    activeLevel = respawn.level;
    activeLevelNumber = parseLevelNumber(respawn.level);
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
    resetLivingEnemiesForPlayerRespawn();
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
    pressedKeys.clear();
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

  // S8-T2: 3D rune projectile cast — fires at selectedEnemy or forward if no target
  const castRune3d = () => {
    const now = Date.now();
    if (now - lastRuneCastAt < 1000) return; // 1s cooldown

    const slots = playerState.getEquippedRuneSlots();
    const runeId = slots[activeRuneSlotIndex];
    if (!runeId) return;

    const def = RuneRegistry.getRune(runeId);
    if (!def) return;

    // Find target enemy
    let targetEnemy: SliceEnemy | null = null;
    if (selectedEnemyUid) {
      targetEnemy = enemies.get(selectedEnemyUid) || null;
      if (targetEnemy?.isDead) targetEnemy = null;
    }
    if (!targetEnemy) {
      // pick nearest alive enemy within 8 units
      let nearestDist = 8;
      enemies.forEach((e) => {
        if (e.isDead) return;
        const d = Vector3.Distance(player.position, e.worldPos);
        if (d < nearestDist) {
          nearestDist = d;
          targetEnemy = e;
        }
      });
    }
    if (!targetEnemy) return; // no valid target

    lastRuneCastAt = now;

    // Build projectile mesh
    const hexColor = def.effect3d?.color ?? "#ff5500";
    const projMat = new StandardMaterial("rune_proj_mat_" + now, scene);
    projMat.emissiveColor = Color3.FromHexString(hexColor);
    projMat.disableLighting = true;

    const proj = MeshBuilder.CreateSphere(
      "rune_proj_" + now,
      { diameter: 0.18, segments: 4 },
      scene,
    );
    proj.material = projMat;
    proj.position = player.position.clone();
    proj.position.y += 0.3;

    const speed = def.effect3d?.speed ?? 14;
    const impactRadius = def.effect3d?.radius ?? 1.0;

    // Animate projectile frame-by-frame using onBeforeRender
    const finalTarget = targetEnemy; // capture in closure
    const removeObs = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      const toTarget = finalTarget.worldPos.subtract(proj.position);
      const dist = toTarget.length();
      if (dist < 0.2) {
        if (finalTarget.isDead) {
          proj.dispose();
          projMat.dispose();
          scene.onBeforeRenderObservable.remove(removeObs);
          playerState.gainIntelligenceExperience(10);
          playerState.log(
            "combat_gained_skill_xp",
            { skill: "Intelligence", amount: 10 },
            "#34d399",
          );
          return;
        }

        // Impact: apply damage
        const playerInt = playerState.getIntelligenceData().level;
        const dmg = RuneRegistry.calculateDamage(
          runeId,
          playerState.getLevel(),
          playerInt,
        );
        const damage = Math.max(
          1,
          dmg.min + Math.floor(Math.random() * (dmg.max - dmg.min + 1)),
        );
        applyRuneDamageToEnemy(finalTarget, damage, runeId);

        // Impact flash: scale-up then dispose
        const flashMat = new StandardMaterial("rune_flash_" + now, scene);
        flashMat.emissiveColor = Color3.FromHexString(hexColor);
        flashMat.wireframe = true;
        const flash = MeshBuilder.CreateSphere(
          "rune_flash_mesh_" + now,
          { diameter: impactRadius * 2, segments: 4 },
          scene,
        );
        flash.material = flashMat;
        flash.position = finalTarget.worldPos.clone();
        let flashAge = 0;
        const flashObs = scene.onBeforeRenderObservable.add(() => {
          flashAge += scene.getEngine().getDeltaTime() / 1000;
          flash.scaling.setAll(1 + flashAge * 4);
          const alpha = Math.max(0, 1 - flashAge / 0.3);
          flashMat.emissiveColor = Color3.FromHexString(hexColor).scale(alpha);
          if (flashAge > 0.3) {
            flash.dispose();
            flashMat.dispose();
            scene.onBeforeRenderObservable.remove(flashObs);
          }
        });

        proj.dispose();
        projMat.dispose();
        scene.onBeforeRenderObservable.remove(removeObs);
        return;
      }

      const step = speed * dt;
      proj.position.addInPlace(
        toTarget.normalize().scale(Math.min(step, dist)),
      );
    });

    playerState.log("action_cast_rune", { runeId }, "#ff8800");
  };

  // S11-T1: Cast rune at specific target (from targeting mode)
  const castRuneAtTarget = (targetEnemyUid: string) => {
    if (!targetingRuneId) return;

    const runeId = targetingRuneId;
    runeTargetingMode = false;
    targetingRuneId = null;
    const def = RuneRegistry.getRune(runeId);
    if (!def) return;

    const now = Date.now();
    if (now - lastRuneCastAt < 1000) {
      playerState.emit("message", t_game("msg_rune_cooldown_active"));
      return;
    }

    const targetEnemy = enemies.get(targetEnemyUid);
    if (!targetEnemy || targetEnemy.isDead) return;

    lastRuneCastAt = now;

    // Build projectile mesh (same as castRune3d)
    const hexColor = def.effect3d?.color ?? "#ff5500";
    const projMat = new StandardMaterial("rune_proj_mat_" + now, scene);
    projMat.emissiveColor = Color3.FromHexString(hexColor);
    projMat.disableLighting = true;

    const proj = MeshBuilder.CreateSphere(
      "rune_proj_" + now,
      { diameter: 0.18, segments: 4 },
      scene,
    );
    proj.material = projMat;
    proj.position = player.position.clone();
    proj.position.y += 0.3;

    const speed = def.effect3d?.speed ?? 14;
    const impactRadius = def.effect3d?.radius ?? 1.0;

    // Animate projectile
    const finalTarget = targetEnemy;
    const removeObs = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      const toTarget = finalTarget.worldPos.subtract(proj.position);
      const dist = toTarget.length();
      if (dist < 0.2) {
        if (finalTarget.isDead) {
          proj.dispose();
          projMat.dispose();
          scene.onBeforeRenderObservable.remove(removeObs);
          playerState.gainIntelligenceExperience(10);
          playerState.log(
            "combat_gained_skill_xp",
            { skill: "Intelligence", amount: 10 },
            "#34d399",
          );
          return;
        }

        // Impact: apply damage
        const playerInt = playerState.getIntelligenceData().level;
        const dmg = RuneRegistry.calculateDamage(
          runeId,
          playerState.getLevel(),
          playerInt,
        );

        const damage = Math.max(
          1,
          dmg.min + Math.floor(Math.random() * (dmg.max - dmg.min + 1)),
        );
        applyRuneDamageToEnemy(finalTarget, damage, runeId);

        // Impact flash
        const flashMat = new StandardMaterial("rune_flash_" + now, scene);
        flashMat.emissiveColor = Color3.FromHexString(hexColor);
        flashMat.wireframe = true;
        const flash = MeshBuilder.CreateSphere(
          "rune_flash_mesh_" + now,
          { diameter: impactRadius * 2, segments: 4 },
          scene,
        );
        flash.material = flashMat;
        flash.position = finalTarget.worldPos.clone();
        let flashAge = 0;
        const flashObs = scene.onBeforeRenderObservable.add(() => {
          flashAge += scene.getEngine().getDeltaTime() / 1000;
          flash.scaling.setAll(1 + flashAge * 4);
          const alpha = Math.max(0, 1 - flashAge / 0.3);
          flashMat.emissiveColor = Color3.FromHexString(hexColor).scale(alpha);
          if (flashAge > 0.3) {
            flash.dispose();
            flashMat.dispose();
            scene.onBeforeRenderObservable.remove(flashObs);
          }
        });

        // Remove rune from inventory
        const rune = playerState
          .getEnchantedRunes()
          .find((r) => r.runeId === runeId);
        if (rune && rune.count > 0) {
          rune.count--;
        }
        playerState.emit("runesUpdated");

        proj.dispose();
        projMat.dispose();
        scene.onBeforeRenderObservable.remove(removeObs);
      } else {
        const step = speed * dt;
        proj.position.addInPlace(
          toTarget.normalize().scale(Math.min(step, dist)),
        );
      }
    });

    playerState.emit("runeCasted");
    playerState.log("action_cast_rune", { runeId }, "#ff8800");
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (gameplayPaused || isPlayerDeathSequenceActive) {
      return;
    }
    void ensureAudioReady();

    const key = event.key.toLowerCase();
    pressedKeys.add(key);

    if (event.code === "Space") {
      if (isGrounded) {
        const impulse = resolveJumpImpulseForHeadroom();
        if (impulse > 0) {
          fallOriginFootY = player.position.y;
          verticalVelocity = impulse;
          isGrounded = false;
          audioManager.playJump();
        }
      }
      event.preventDefault();
    }

    if (key === "v" && !event.repeat) {
      // S12-T5: FP mode is DEBUG ONLY — product is always top-down. V = debug toggle.
      if (!isFirstPerson) {
        // eslint-disable-next-line no-console
        console.warn(
          "[DEBUG] Entering first-person mode — debug-only camera. Top-down is the product view.",
        );
      }
      setCameraMode(!isFirstPerson, !isFirstPerson);
    }

    if (key === "c" && !event.repeat) {
      if (isFirstPerson) {
        return;
      }
      const nextPreset: TopDownCameraPreset =
        activeTopDownCameraPreset === "safe" ? "cinematic" : "safe";
      applyTopDownCameraPreset(nextPreset);
    }

    if (key === "f" && !event.repeat) {
      const safetyEnabled = playerState.toggleFallSafety();
      playerState.emit("uiNotification", {
        type: safetyEnabled ? "info" : "warning",
        message: t_game(safetyEnabled ? "fall_safety_on" : "fall_safety_off"),
      });
    }

    // S8-T2: Q = cast active rune; R = cycle active rune slot
    if (key === "q" && !event.repeat) {
      castRune3d();
    }

    if (key === "r" && !event.repeat) {
      activeRuneSlotIndex = (activeRuneSlotIndex + 1) % 3;
      dispatchRuneSlotUpdate();
    }

    if (key === "e" && !event.repeat) {
      const pickedRealItem = tryPickupNearestItem();
      if (pickedRealItem) {
        syncDroppedItems(true);
        return;
      }

      if (tryInteractNearbyDoorRespectingPickup()) {
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

  const onCanvasContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };
  canvas.addEventListener("contextmenu", onCanvasContextMenu);

  const onCanvasPointerDown = () => {
    if (gameplayPaused || isPlayerDeathSequenceActive) {
      return;
    }
    requestPointerLockIfPossible();
  };
  canvas.addEventListener("pointerdown", onCanvasPointerDown);

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
          castRuneAtTarget(targetEnemy.uid);
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
      tryInteractPickedDoor(pickedDoorUuid)
    ) {
      return;
    }

    if (isRightClick) {
      tryInteractNearbyDoorRespectingPickup();
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
      chunkUpdateTimer += deltaSeconds;
      if (chunkUpdateTimer >= CHUNK_UPDATE_INTERVAL) {
        chunkUpdateTimer = 0;
        updateChunks();
      }
      return;
    }

    const tFrameStart = performance.now();
    let mapTimeAccum = 0;
    let enemyTimeAccum = 0;
    let physicsTimeAccum = 0;

    let tStart = tFrameStart;

    tStart = performance.now();
    dropSyncTimer += deltaSeconds;
    if (dropSyncTimer >= DROP_SYNC_INTERVAL) {
      dropSyncTimer = 0;
      syncDroppedItems();
    }
    mapTimeAccum += performance.now() - tStart;

    tStart = performance.now();
    enemyStreamTimer += deltaSeconds;
    if (enemyStreamTimer >= ENEMY_STREAM_SYNC_INTERVAL) {
      enemyStreamTimer = 0;
      syncEnemyStream();
    }
    enemyTimeAccum += performance.now() - tStart;

    tStart = performance.now();
    propStreamTimer += deltaSeconds;
    if (propStreamTimer >= PROP_STREAM_SYNC_INTERVAL) {
      propStreamTimer = 0;
      syncPropStream();
    }

    navWindowTimer += deltaSeconds;
    if (navWindowTimer >= 0.45) {
      navWindowTimer = 0;
      rebuildNavigationWindow(activeLevel);
    }
    mapTimeAccum += performance.now() - tStart;

    tStart = performance.now();
    // Animate dropped items (floating bob & shadow scaling)
    droppedItemMeshes.forEach((container) => {
      if (!container.isEnabled()) return;
      const itemPlane = (container as any).itemPlane;
      const shadowDisc = (container as any).shadowDisc;
      if (itemPlane) {
        const time = performance.now() * 0.003;
        const item = container.metadata as SliceDroppedItem | undefined;
        const phase = item ? getDeterministicRotation(item.itemId) * 10 : 0;
        
        // Bob height fluctuates above the grounded container anchor
        itemPlane.position.y = 0.06 + Math.sin(time + phase) * 0.03;

        if (shadowDisc) {
          const ratio = (itemPlane.position.y - 0.03) / 0.06;
          shadowDisc.visibility = 0.28 - ratio * 0.12; // fade shadow slightly as it rises
          const scale = 1.0 - ratio * 0.15; // shrink shadow slightly as it rises
          shadowDisc.scaling.set(scale, scale, scale);
        }
      }
    });

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
    chunkUpdateTimer += deltaSeconds;
    if (chunkUpdateTimer >= CHUNK_UPDATE_INTERVAL) {
      chunkUpdateTimer = 0;
      updateChunks();

      const chunkStats = (window as any).__slice3dChunkStreaming || {};
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
    }

    mapTimeAccum += performance.now() - tStart;

    tStart = performance.now();
    const aquaticSample = getAquaticSampleAt(
      player.position.x,
      player.position.z,
      activeLevel,
    );
    const speed = 4.5 * aquaticSample.speedMultiplier;
    let moveForward = 0;
    let moveRight = 0;

    if (pressedKeys.has("w") || pressedKeys.has("arrowup")) moveForward += 1;
    if (pressedKeys.has("s") || pressedKeys.has("arrowdown")) moveForward -= 1;
    if (pressedKeys.has("a") || pressedKeys.has("arrowleft")) moveRight -= 1;
    if (pressedKeys.has("d") || pressedKeys.has("arrowright")) moveRight += 1;

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

    if (isMoving) {
        let movement = Vector3.Zero();

        if (isFirstPerson) {
          const yaw = firstPersonCamera.rotation.y;
          const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
          const right = new Vector3(forward.z, 0, -forward.x);
          movement = forward.scale(moveForward).add(right.scale(moveRight));
        } else {
          // Deterministic camera-to-screen mapping: solve which world-space
          // (X,Z) delta produces desired screen-space delta.
          // Desired screen axes: right = +Xscreen, up = -Yscreen.
          const engineRef = scene.getEngine();
          const viewport = camera.viewport.toGlobal(
            engineRef.getRenderWidth(),
            engineRef.getRenderHeight(),
          );
          const origin = player.position.clone();
          const screenOrigin = Vector3.Project(
            origin,
            Matrix.Identity(),
            scene.getTransformMatrix(),
            viewport,
          );
          const screenX = Vector3.Project(
            origin.add(new Vector3(1, 0, 0)),
            Matrix.Identity(),
            scene.getTransformMatrix(),
            viewport,
          );
          const screenZ = Vector3.Project(
            origin.add(new Vector3(0, 0, 1)),
            Matrix.Identity(),
            scene.getTransformMatrix(),
            viewport,
          );

          const basisX = new Vector2(
            screenX.x - screenOrigin.x,
            screenX.y - screenOrigin.y,
          );
          const basisZ = new Vector2(
            screenZ.x - screenOrigin.x,
            screenZ.y - screenOrigin.y,
          );
          const desired = new Vector2(moveRight, -moveForward);

          const det = basisX.x * basisZ.y - basisX.y * basisZ.x;
          if (Math.abs(det) > 1e-6) {
            const worldDX = (desired.x * basisZ.y - desired.y * basisZ.x) / det;
            const worldDZ = (basisX.x * desired.y - basisX.y * desired.x) / det;
            movement = new Vector3(worldDX, 0, worldDZ);
          } else {
            // Fallback for degenerate projection matrix edge-cases.
            const cameraForward = camera.target.subtract(camera.position);
            cameraForward.y = 0;
            if (cameraForward.lengthSquared() > 1e-6) {
              cameraForward.normalize();
              const cameraRight = new Vector3(
                cameraForward.z,
                0,
                -cameraForward.x,
              );
              movement = cameraForward
                .scale(moveForward)
                .add(cameraRight.scale(moveRight));
            }
          }
        }

        movement.normalize().scaleInPlace(speed * deltaSeconds);

        // Substepping to prevent tunneling through walls during lag spikes
        const totalDistance = movement.length();
        if (totalDistance > 0) {
          const maxStepSize = 0.1; // safe step size (player radius is 0.32)
          const numSteps = Math.ceil(totalDistance / maxStepSize);
          const stepMovement = movement.scale(1 / numSteps);

          for (let i = 0; i < numSteps; i++) {
            const nextX = player.position.x + stepMovement.x;
            const nextZ = player.position.z + stepMovement.z;

            if (
              !isWorldPositionBlocked(nextX, player.position.z, 0.32, {
                blockVoidForPlayer: true,
                footY: player.position.y,
              })
            ) {
              player.position.x = nextX;
            }

            if (
              !isWorldPositionBlocked(player.position.x, nextZ, 0.32, {
                blockVoidForPlayer: true,
                footY: player.position.y,
              })
            ) {
              player.position.z = nextZ;
            }

            if (isGrounded && !holeFallLandingLevel && !isPlayerOverVoidAtLevel(activeLevel)) {
              snapFootToGradedSurface();
            }
          }
        }

        player.position.x = Math.min(
          mapMaxX,
          Math.max(mapMinX + 0.5, player.position.x),
        );
        player.position.z = Math.min(
          mapMaxZ,
          Math.max(mapMinZ + 0.5, player.position.z),
        );

        // Push player out of non-walkable collision volumes using CollisionWorld.
        // Replaces the old tile-grid depenetration that relied on activeLevel + isBlockingTile.
        {
          const footY = player.position.y;
          const headY = footY + HERO_BODY_HEIGHT;
          const radius = 0.32;
          const levelKeys = Object.keys(mapDataCache?.levels ?? {});
          const push = collisionWorld.resolvePushout(player.position.x, player.position.z, footY, headY, radius, levelKeys);
          if (push) {
            player.position.x += push[0];
            player.position.z += push[1];
          }
        }

        if (isGrounded && !holeFallLandingLevel && !isPlayerOverVoidAtLevel(activeLevel)) {
          syncVerticalLevelFromMovement(
            isMoving,
            movementStartX,
            movementStartZ,
          );
        }
    }
    physicsTimeAccum += performance.now() - tStart;

    tStart = performance.now();
    const isVerticalTransitionGuarded = () => {
      if (!verticalTransitionGuard) {
        return false;
      }
      if (performance.now() > verticalTransitionGuard.untilMs) {
        verticalTransitionGuard = null;
        return false;
      }
      const tileX = Math.floor(player.position.x);
      const tileZ = Math.floor(player.position.z);
      return (
        tileX === verticalTransitionGuard.tileX &&
        tileZ === verticalTransitionGuard.tileZ
      );
    };

    const canAttemptVerticalTransition = () => {
      if (levelTransitionCooldown > 0 || holeFallLandingLevel) {
        return false;
      }
      if (isVerticalTransitionGuarded()) {
        return false;
      }
      if (isGrounded) {
        return true;
      }
      const tileX = Math.floor(player.position.x);
      const tileZ = Math.floor(player.position.z);
      const symbol = getMapTileAt(activeLevel, tileX, tileZ);
      const tileDef = symbol
        ? mapDataCache?.tileDefinitions?.[symbol]
        : undefined;
      if (isGradedWalkTile(tileDef, LEVEL_HEIGHT) && Math.abs(verticalVelocity) < 3.0) {
        return true;
      }
      return false;
    };

    const tryHoleLevelTransition = () => {
      if (!canAttemptVerticalTransition()) {
        return;
      }

      const probe = probeHoleLevelTransition(
        player.position.x,
        player.position.z,
        activeLevel,
        getMapTileAt,
        (symbol: string | null) =>
          symbol ? mapDataCache?.tileDefinitions?.[symbol] : undefined,
        {
          parseLevelNumber,
          hasLevel: (level: string) => Boolean(mapDataCache?.levels?.[level]),
        },
      );
      if (!probe) {
        return;
      }

      if (!playerState.isFallSafetyEnabled()) {
        beginGravityHoleFall(probe.targetLevel, 1);
        levelTransitionCooldown = 0.35;
        return;
      }

      levelTransitionCooldown = 0.65;
      applyActiveLevelChange(probe.targetLevel, {
        tileX: probe.tileX,
        tileZ: probe.tileZ,
        landingLocalZ: probe.landingLocalZ,
        guardMs: 1200,
      });
    };

    const tryVerticalLevelTransitions = () => {
      if (holeFallLandingLevel) {
        return;
      }
      tryHoleLevelTransition();
    };

    tryVerticalLevelTransitions();

    const consumeFootstep = (heroSpriteMat as any)._consumeFootstepTick;
    if (typeof consumeFootstep === "function" && consumeFootstep()) {
      audioManager.playFootstep("floor", true);
    }

    if (levelTransitionCooldown > 0) {
      levelTransitionCooldown -= deltaSeconds;
    }

    const respawnDeltaMs = deltaSeconds * 1000;
    const px = player.position.x;
    const pz = player.position.z;
    const streamRadiusSq = enemyStreamRadiusUnits * enemyStreamRadiusUnits;
    pendingEnemyRespawns.forEach((record, spawnKey) => {
      record.elapsedMs += respawnDeltaMs;
      if (record.elapsedMs < record.respawnTimeMs) {
        return;
      }
      pendingEnemyRespawns.delete(spawnKey);

      if (record.level !== activeLevel) {
        return;
      }

      const spawnX = worldToSliceCoord(record.spawn.x);
      const spawnZ = worldToSliceCoord(record.spawn.y);
      const dx = spawnX - px;
      const dz = spawnZ - pz;
      if (dx * dx + dz * dz > streamRadiusSq) {
        return;
      }

      clearEnemy3dDeadPersistence(record.level, spawnKey);
      spawnEnemy(record.spawn, record.index, spawnKey, record.level, {
        withRespawnVfx: true,
      });
    });
    physicsTimeAccum += performance.now() - tStart;

    tStart = performance.now();
    updateEnemyAI(deltaSeconds);
    enemyTimeAccum += performance.now() - tStart;

    tStart = performance.now();
    if (!gameplayPaused) {
      projectileSystem.update(deltaSeconds);
    }
    tryAutoPlayerAttack(Date.now());
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

      const perfMem = (performance as any).memory;
      const usedHeapMb = perfMem
        ? Math.round((perfMem.usedJSHeapSize / (1024 * 1024)) * 10) / 10
        : undefined;
      const totalHeapMb = perfMem
        ? Math.round((perfMem.totalJSHeapSize / (1024 * 1024)) * 10) / 10
        : undefined;

      const chunkStats = (window as any).__slice3dChunkStreaming || {};

      playerState.updatePerfMetrics({
        fps: Math.round(engine.getFps()),
        totalUpdateTime: Math.round((mapTimeAccum + enemyTimeAccum + physicsTimeAccum) * 10) / 10,
        mapTime: Math.round(mapTimeAccum * 10) / 10,
        enemyTime: Math.round(enemyTimeAccum * 10) / 10,
        physicsTime: Math.round(physicsTimeAccum * 10) / 10,
        activeEnemies: Array.from(enemies.values()).filter(
          (e) => !e.isDead && Math.abs(levelToWorldY(e.level) - player.position.y) < LEVEL_HEIGHT && Vector3.Distance(e.worldPos, player.position) <= ENEMY_AI_RADIUS_UNITS,
        ).length,
        renderedTiles: chunkMeshes.size * CHUNK_SIZE * CHUNK_SIZE,
        totalObjects: activeMeshes,
        poolSize: chunkMeshes.size,
        drawCalls,
        activeMeshes,
        totalMeshes,
        totalMaterials,
        totalTextures,
        totalVertices,
        jsHeapUsedMb: usedHeapMb,
        jsHeapTotalMb: totalHeapMb,
        chunkLoaded: chunkStats.loadedChunks || chunkMeshes.size,
        chunkLoading: chunkStats.loadingChunks || chunkLoading.size,
      });

      (window as any).__slice3dPerfDiagnostics = {
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
        chunkLoaded: chunkStats.loadedChunks || chunkMeshes.size,
        chunkLoading: chunkStats.loadingChunks || chunkLoading.size,
        pendingChunkCandidates: chunkStats.pendingCandidates || 0,
        pendingChunkUnloads: chunkStats.pendingUnloads || 0,
        streamedDroppedItems: droppedItemMeshes.size,
        streamedEnemies: enemies.size,
        catalogedEnemies: enemySpawnCatalog.size,
        streamedProps: props.size,
        catalogedProps: propSpawnCatalog.size,
        navWindowTiles: navigationGridSize,
        activeLevel,
        qualityPreset: playerState.getDisplaySettings().qualityPreset,
        topDownDrawRadiusChunks,
        enemyStreamRadiusUnits,
        propStreamRadiusUnits,
        ts: Date.now(),
      };
      (window as any).__slice3dPerf = (window as any).__slice3dPerfDiagnostics;
    }

    telemetryLogTimer += deltaSeconds;
    telemetryPersistTimer += deltaSeconds;
    if (telemetryEnabled && telemetryLogTimer >= LOG_SAMPLE_INTERVAL) {
      telemetryLogTimer = 0;

      const chunkStats = (window as any).__slice3dChunkStreaming || {};
      const perfMem = (performance as any).memory;
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
        if (enemy.isDead || Math.abs(levelToWorldY(enemy.level) - player.position.y) >= LEVEL_HEIGHT) return;
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
        activeLevel,
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
          loaded: chunkStats.loadedChunks || chunkMeshes.size,
          loading: chunkStats.loadingChunks || chunkLoading.size,
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
          streamedDroppedItems: droppedItemMeshes.size,
          hasRealDroppedItems,
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

      const chunkKey = `${sample.activeLevel}:${sample.player.chunkX}_${sample.player.chunkZ}`;
      const chunkEntry = chunkHotspots.get(chunkKey) || {
        level: sample.activeLevel,
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

      (window as any).__slice3dLogsData = {
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

    // Gravity and fall system
    {
      const tileX = Math.floor(player.position.x);
      const tileZ = Math.floor(player.position.z);
      const onVoidTile = isPlayerOverVoidAtLevel(activeLevel);

      if (!onVoidTile) {
        lastSafePlayerX = player.position.x;
        lastSafePlayerZ = player.position.z;
        wasOnVoidWithSafety = false;
      }

      if (isGrounded && onVoidTile && !holeFallLandingLevel) {
        if (playerState.isFallSafetyEnabled()) {
          if (!wasOnVoidWithSafety) {
            wasOnVoidWithSafety = true;
            playerState.emit("uiNotification", {
              type: "warning",
              message: t_game("fall_safety_active"),
            });
          }

          player.position.x = lastSafePlayerX;
          player.position.z = lastSafePlayerZ;
          verticalVelocity = 0;
          isGrounded = true;
        } else {
          const landing = findVoidFallLanding(activeLevel, tileX, tileZ);
          if (landing) {
            beginGravityHoleFall(landing.landingLevel, landing.floors);
          }
        }
      }

      if (!isGrounded) {
        verticalVelocity += (holeFallLandingLevel ? fallGravity : gravity) * deltaSeconds;
        player.position.y += verticalVelocity * deltaSeconds;

        const levelGround = getHighestGroundBelow(
          player.position.x,
          player.position.z,
          player.position.y,
        );
        const levelGroundY = levelGround.footY;
        const landingLevel = holeFallLandingLevel ?? levelGround.level;

        if (player.position.y <= levelGroundY) {
          const impactSpeed = Math.abs(verticalVelocity);
          player.position.y = levelGroundY;
          verticalVelocity = 0;
          isGrounded = true;

          if (landingLevel !== activeLevel) {
            applyActiveLevelChange(landingLevel, undefined, { natural: true });
          }
          lastGroundedFootY = player.position.y;
          finishAirborneLanding(
            landingLevel,
            levelGroundY,
            impactSpeed,
            holeFallFloorCount,
          );
          holeFallLandingLevel = null;
          holeFallFloorCount = 0;
        }
      }

      applyCeilingCollisionToVerticalMotion();
    }

    if (isGrounded && !holeFallLandingLevel && !isPlayerOverVoidAtLevel(activeLevel)) {
      snapFootToGradedSurface();
      syncVerticalLevelFromMovement(
        isMoving,
        movementStartX,
        movementStartZ,
      );
      lastGroundedFootY = player.position.y;
    }

    const playerAquatic = getAquaticSampleAt(
      player.position.x,
      player.position.z,
      activeLevel,
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

    wallRevealSystem.update(
      true,
      player.position,
      activeLevel,
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
      getGroundSurfaceY(player.position.x, player.position.z, activeLevel) +
        0.01,
      player.position.z,
    );

    // Top-down product mode: hero stays screen-centered (Diablo/PoE-style).
    // Lazy lerp made fast movement feel like the character "outruns" the camera.
    camera.setTarget(
      new Vector3(player.position.x, player.position.y, player.position.z),
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
        currentLevel: activeLevel,
        playerPos: {
          x: Math.round(player.position.x * 32 * 100) / 100,
          y: Math.round(player.position.z * 32 * 100) / 100,
        },
      });
    }
  });

  // ── save() — callable from UI (F5, system menu) ──────────────────────────────
  const save = () =>
    saveSystem.saveGameDirect({
      map: sliceMapName,
      currentLevel: activeLevel,
      playerPos: {
        x: Math.round(player.position.x * 32 * 100) / 100,
        y: Math.round(player.position.z * 32 * 100) / 100,
      },
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
    doors.forEach((door) => updateDoorVisual(door));
    refreshDoorSystemsForLevel(activeLevel);
  };
  playerState.on("doorStatesChanged", handleDoorStatesChanged);

  return {
    engine,
    scene,
    save,
    whenWorldReady: () => worldReadyPromise,
    dispose: () => {
      pushLogEvent("session.dispose", {
        activeLevel,
        samples: runtimeLog.samples.length,
        events: runtimeLog.events.length,
      });
      persistRuntimeLogs();
      void flushRuntimeLogsToFile(true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
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
      canvas.removeEventListener("contextmenu", onCanvasContextMenu);
      canvas.removeEventListener("pointerdown", onCanvasPointerDown);
      scene.onPointerObservable.remove(pointerObserver);
      document.exitPointerLock?.();
      clearAllChunks();
      wallRevealSystem.dispose();
      waterEffectSystem.dispose();
      heroAquaticTint.dispose();
      mapRoot.dispose();
      tileMaterials.forEach((material) => material.dispose());
      droppedItemMeshes.forEach((mesh) => mesh.dispose());
      droppedItemMeshes.clear();
      activeSlashtrails.forEach((slash) => {
        slash.mesh.dispose();
        slash.material.dispose();
        slash.texture.dispose();
      });
      activeSlashtrails.length = 0;
      doors.forEach((door) => {
        const material = door.mesh.material;
        door.mesh.dispose();
        if (material instanceof StandardMaterial) {
          material.dispose();
        }
      });
      doors.clear();
      doorByLevelTile.clear();
      clearProps();
      clearEnemies();
      projectileSystem.disposeAll();
      disposeAllPooledSpriteTexturesForScene(scene);
      // S7-FP4: torus marker removed — no dispose needed
      delete (window as any).__slice3dLogs;
      delete (window as any).__slice3dLogsData;
      delete (window as any).__slice3dPerf;
      delete (window as any).__slice3dPerfDiagnostics;
      geometryWorker.terminate();
      scene.dispose();
      engine.dispose();
    },
  };
}
