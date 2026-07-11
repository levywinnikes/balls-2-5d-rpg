import type { SliceRuntime, Slice3DLogSample, Slice3DLogEvent, Slice3DSessionLog, Slice3DHotspot, Slice3DSummary } from "./Slice3DTypes";

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
import { RenderSystem } from "./RenderSystem";
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
import type { GameContext, MutableStateBox } from "./GameContext";
import { createPlayerFallSystem, type PlayerFallSystem } from "./PlayerFallSystem";
import { createLevelTransitionSystem } from "./LevelTransitionSystem";
import { createRuneCastSystem } from "./RuneCastSystem";
import { createDropPickupSystem } from "./DropPickupSystem";
import { createDamagePopupSystem } from "./DamagePopupSystem";
import { createGroundQuerySystem } from "./GroundQuerySystem";
import { loadLevelBinary as loadLevelBinaryImpl, loadMapData as loadMapDataImpl, ensureWorldMapReady as ensureWorldMapReadyImpl } from "./MapDataLoader";
import { ensureDebugSandboxStarterLoadout as ensureDebugLoadout } from "./DebugSandboxSetup";
import { ensureMapLevelReady as ensureMapLevelReadyImpl } from "./LevelBootstrap";
import { bootstrapWorldSession as bootstrapWorld } from "./WorldBootstrap";
import { createDebugColliderVisuals } from "./DebugColliderVisuals";
import { isStaticTileBlocking as staticBlock, isBlockingTile as blockingTile } from "./TileBlocking";
import { resolvePoolFloorMaterial as resolvePoolFloor } from "./PoolFloorResolver";
import { collectInteractableRevealTargets as collectRevealTargets } from "./RevealTargetCollector";
import { renderMapLevel as renderMap } from "./MapRenderer";
import { applyDisplaySettings as applyDisplaySettingsImpl } from "./DisplaySettings";
import { createGameContext } from "./createGameContext";
import { triggerPlayerAttackSlashEffect as createSlashTrail, getDeterministicRotation, getWeaponSlashColor, type ActiveSlash } from "./SlashTrailEffect";
import { destroyEnemy as destroyEnemyImpl, grantEnemyLoot as grantEnemyLootImpl, setSelectedEnemy as setSelectedEnemyImpl } from "./EnemyDeathHandler";
import { requestEnemyPath as requestEnemyPathImpl, advanceEnemyPath as advanceEnemyPathImpl } from "./EnemyPathfinding";
import { SliceEnemySystem } from "./SliceEnemySystem";
import { SliceCombatSystem } from "./SliceCombatSystem";
import {
  createFirstPersonCombatCameraState,
  FP_CAMERA_FOV,
  getFirstPersonEnemyProximityScale,
  updateFirstPersonCombatCamera,
} from "./FirstPersonCombatPresentation";
import { getAquaticVisualPreset } from "./AquaticVisualConfig";
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
  STEP_UP_LIMIT,
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
import { QualitySystem, type QualityPreset } from "./QualitySystem";
import { VisibilitySystem } from "./VisibilitySystem";
import { TileMaterialSystem, safeTileColor } from "./TileMaterialSystem";
import { buildRoofMesh, buildStairMesh } from "./ChunkGeometryBuilder";
import { PointerPickingSystem } from "./PointerPickingSystem";
import { TelemetryLogger } from "./TelemetryLogger";
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
import { AudioSystem } from "./AudioSystem";
import { CameraSystem } from "./CameraSystem";
import type {
  GeometryWorkerRequest,
  GeometryWorkerResponse,
  GeometryGroupBuffer,
} from "../../workers/geometry.worker";

import { createMaterial, worldToSliceCoord, clamp, worldToGrid, gridToWorld } from "./SliceRuntimeUtils";
import type { TopDownCameraPreset } from "./Slice3DTypes";
export type {
  SliceRuntime,
  Slice3DLogSample,
  Slice3DLogEvent,
  Slice3DSessionLog,
  Slice3DHotspot,
  Slice3DSummary,
} from "./Slice3DTypes";

export function createSliceScene(canvas: HTMLCanvasElement): SliceRuntime {
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
  const audioSystem = new AudioSystem();
  const audioManager = audioSystem.manager;
  const startingPosition = playerState.getPosition();
  const searchParams = new URLSearchParams(window.location.search);
  const sliceMapName =
    searchParams.get("map") ||
    searchParams.get("mapName") ||
    "debug_sandbox";
  /** Props / dropped loot sit on walkable surface (not actor foot clearance). */
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
  // cameraSystem created after state variables are declared
  // these are just references set later
  let camera: ArcRotateCamera;
  let firstPersonCamera: UniversalCamera;

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
  const lastPlayerAquaticMode: { mode: AquaticSample["mode"] } = { mode: "dry" };

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

  const activeSlashtrails: ActiveSlash[] = [];

  let selectedEnemyUid: string | null = null;
  let lastFocusedCombatHealthSyncAt = 0;
  let activeRuneSlotIndex = 0;
  // S11-T1: rune targeting mode (Opção A parity)
  let runeTargetingMode = false;
  let targetingRuneId: string | null = null;
  const triggerPlayerAttackSlashEffect = (enemy: SliceEnemy): void => { createSlashTrail({ player, scene, getEquippedWeaponId: () => playerState.equippedWeaponId, activeSlashtrails, getWeaponColor: getWeaponSlashColor }, enemy); };
  let mapDataCache: SliceMapData | null = null;
  let worldMapReady = false;

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
  const qualitySystem = new QualitySystem({
    CHUNK_SIZE,
    initialPreset: playerState.getDisplaySettings().qualityPreset as QualityPreset,
  });
  const initialRadii = qualitySystem.getStreamRadii();
  propSystem.propStreamRadiusUnits = initialRadii.propStreamRadiusUnits;
  propSystem.propStreamRadiusUnitsFirstPerson = initialRadii.propStreamRadiusUnitsFirstPerson;
  propSystem.propDespawnRadiusUnits = initialRadii.propDespawnRadiusUnits;
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
  const initialRadii2 = qualitySystem.getStreamRadii();
  enemySystem.enemyStreamRadiusUnits = initialRadii2.enemyStreamRadiusUnits;
  enemySystem.enemyDespawnRadiusUnits = initialRadii2.enemyDespawnRadiusUnits;
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
  const initialRadii3 = qualitySystem.getStreamRadii();
  dropSystem.droppedItemStreamRadiusUnits = initialRadii3.droppedItemStreamRadiusUnits;
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
      pushLogEvent: (event: string, data: any) => telemetryLogger.pushLogEvent(event, data),
    },
  );
  qualitySystem.orchestrator = orchestrator;
  let isFirstPerson = false;
  let gameplayPaused = playerState.isGameplayPaused();
  const cameraSystem = new CameraSystem({
    scene,
    canvas,
    getPlayerPosition: () => player.position,
    getHeroDirection: () => heroDirection,
    setHeroDirection: (dir) => { heroDirection = dir; },
    getIsGameplayPaused: () => gameplayPaused,
    getCurrentLevel,
    parseLevelNumber,
    onCameraModeChanged: (firstPerson) => {
      document.dispatchEvent(new CustomEvent("slice3d:cameraModeChanged", { detail: { firstPerson } }));
    },
    FIRST_PERSON_EYE_ABOVE_FEET,
  });
  camera = cameraSystem.topDownCamera;
  firstPersonCamera = cameraSystem.fpCamera;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const geometryWorker: Worker = new Worker(
    new URL("../../workers/geometry.worker.ts", import.meta.url),
  );

  // Tile material cache — distinct materials are bounded by `kind × baseHex`,
  // same logic for the tile-material system is now inside TileMaterialSystem
  const tileMaterialSystem = new TileMaterialSystem(scene);
  const levelBinaryCache = new Map<string, Uint8Array>();


  const mapLoaderCfg = { get ctx() { return ctx; }, levelBinaryCache, get collisionWorld() { return collisionWorld; }, get rebuildDebugMeshes() { return () => rebuildDebugColliderMeshes(); } };
  const loadLevelBinary = (level: string, mapData: SliceMapData) => loadLevelBinaryImpl(mapLoaderCfg, level, mapData);
  const loadMapData = () => loadMapDataImpl(mapLoaderCfg, sliceMapName);
  const ensureWorldMapReady = (mapData: SliceMapData) => ensureWorldMapReadyImpl(mapLoaderCfg, mapData);

  const runtimeStartedAt = Date.now();
  const telemetryLogger = new TelemetryLogger({
    sliceMapName,
    telemetryEnabledRef: { value: true },
    getCurrentLevel,
    getElapsedSec: () => Math.round(((Date.now() - runtimeStartedAt) / 1000) * 100) / 100,
    getIsFirstPerson: () => isFirstPerson,
  });
  const telemetryEnabled = telemetryLogger.telemetryEnabledRef;
  const pushLogEvent = telemetryLogger.pushLogEvent.bind(telemetryLogger);

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

  // LevelTransition callbacks are resolved after their dependencies are created below
  let applyActiveLevelChange: ReturnType<typeof createLevelTransitionSystem>["applyActiveLevelChange"];
  let syncLevelSideEffects: ReturnType<typeof createLevelTransitionSystem>["syncLevelSideEffects"];
  let snapPlayerFootToActiveLevel: ReturnType<typeof createLevelTransitionSystem>["snapPlayerFootToActiveLevel"];
  let snapFootToGradedSurface: ReturnType<typeof createLevelTransitionSystem>["snapFootToGradedSurface"];
  let addDroppedItemFromEvent: ReturnType<typeof createDropPickupSystem>["addDroppedItemFromEvent"];
  let handleDropItem: ReturnType<typeof createDropPickupSystem>["handleDropItem"];
  let handleRequestPickup: ReturnType<typeof createDropPickupSystem>["handleRequestPickup"];
  let emitPlayerDamagePopup: ReturnType<typeof createDamagePopupSystem>["emitPlayerDamagePopup"];
  let emitBloodBurst: ReturnType<typeof createDamagePopupSystem>["emitBloodBurst"];
  let groundQuery: ReturnType<typeof createGroundQuerySystem>;
  let saveSystem: SaveSystem;

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

  const getGroundSurfaceY = (
    worldX: number,
    worldZ: number,
    level: string,
  ) => groundQuery.getGroundSurfaceY(worldX, worldZ, level);

  const resolveWorldAnchorY = (
    worldX: number,
    worldZ: number,
    level: string,
    restOffset = 0.012,
  ) => groundQuery.resolveWorldAnchorY(worldX, worldZ, level, restOffset);

  const applyActorAquaticY = (worldPos: Vector3, level: string) =>
    groundQuery.applyActorAquaticY(worldPos, level);


  const isVoidSymbol = (symbol: string | null) => !symbol || symbol === "...";

  /** True void = no physical surface at this tile on the given level.
   * A void tile directly above a floor-level ramp on the level below is NOT
   * a true void — the ramp geometry fills that space. */
  const isPlayerOverVoidAtLevel = (level: string) => {
    const mapData = mapDataCache;
    const levelKeys = mapData?.levels ? Object.keys(mapData.levels) : [level];
    return !collisionWorld.queryFloor(
      player.position.x,
      player.position.z,
      player.position.y - 0.5,
      player.position.y + HERO_BODY_HEIGHT,
      [level],
      player.position.y + STEP_UP_LIMIT,
    );
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
  let lastChunkRenderLevel: string | null = null;


  const isStaticTileBlocking = (s: string | null, d?: SliceTileDefinition) => staticBlock(s, d);
  const isBlockingTile = (s: string | null, d?: SliceTileDefinition, o?: { level?: string; tileX?: number; tileY?: number }) => blockingTile({ doorSystem, propSystem }, s, d, o);
  const renderMapLevel = (level: string) => renderMap({ ctx, loadLevelBinary }, level);
  let visibilitySystem: VisibilitySystem;

  visibilitySystem = new VisibilitySystem({
    getMapDataCache: () => mapDataCache,
    getMapTileAt,
    getPlayerPosition: () => player.position,
    getCamera: () => camera!,
    getIsFirstPerson: () => isFirstPerson,
    getRenderLevel,
    getCurrentLevel,
    getHoleFallLandingLevel: () => ctx.holeFallLandingLevel,
    parseLevelNumber,
    isGradedWalkAt,
    isStaticTileBlocking,
    levelToWorldY,
    waterEffectSystem,
  });

  const resolvePoolFloorMaterial = (l: string, x: number, y: number) => resolvePoolFloor({ mapDataCache: mapDataCache, getMapTileAt, tileMaterialSystem }, l, x, y);
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
    levelMeshes: visibilitySystem.levelMeshes,
    meshLevelByMesh: visibilitySystem.meshLevelByMesh,
    wallTileIndex: visibilitySystem.wallTileIndex,
    levelBinaryCache,
    tileMaterials: tileMaterialSystem.tileMaterials,
    tileMaterialLRU: tileMaterialSystem.tileMaterialLRU,
    getMapData: () => mapDataCache,
    getMapTileAt,
    getTileDef: (symbol) => symbol ? mapDataCache?.tileDefinitions?.[symbol] ?? null : null,
    getTileMaterial: tileMaterialSystem.getTileMaterial.bind(tileMaterialSystem),
    resolvePoolFloorMaterial,
    isBlockingTile,
    isDownHoleTile: (symbol, tileDef) => isDownHoleTile(tileDef ?? null),
    getRenderableLevels: () => visibilitySystem.getRenderableLevels(),
    registerMeshForLevel: (levelKey, mesh) =>
      visibilitySystem.registerMeshForLevel(levelKey, mesh),
    parseLevelNumber: (level) => parseLevelNumber(level),
    levelToWorldY,
    isFirstPerson: () => isFirstPerson,
    getPlayerPosition: () => ({ x: player.position.x, z: player.position.z }),
    getTopDownDrawRadiusChunks: () => qualitySystem.topDownDrawRadiusChunks,
    getFirstPersonDrawRadiusChunks: () => qualitySystem.firstPersonDrawRadiusChunks,
    getTopDownChunkBuildBudgetPerTick: () => qualitySystem.topDownChunkBuildBudgetPerTick,
    getFirstPersonChunkBuildBudgetPerTick: () => qualitySystem.firstPersonChunkBuildBudgetPerTick,
    findUpperOcclusionLevel: () => visibilitySystem.findUpperOcclusionLevel(),
    onDiagnostics: (stats) => {
      window.__slice3dChunkStreaming = stats as typeof window.__slice3dChunkStreaming;
    },
  });
  visibilitySystem.bindVerticalStackRadius(() =>
    chunkSystem.resolveVerticalStackRadiusTiles(),
  );
  cameraSystem.heroBillboard = heroBillboard;
  cameraSystem.heroShadow = heroShadow;
  cameraSystem.chunkClearAll = () => chunkSystem.clearAll();
  cameraSystem.chunkTick = (dt) => chunkSystem.tick(dt);
  cameraSystem.invalidateVerticalVisibilityCache = () =>
    visibilitySystem.invalidateCache();
  cameraSystem.setEnemyScalesDefault = () => {
    enemies.forEach((enemy) => enemy.meshRoot.scaling.set(1, 1, 1));
  };
  cameraSystem.getSelectedEnemyUid = () => selectedEnemyUid;
  cameraSystem.getEnemyWorldPos = (uid) => enemies.get(uid)?.worldPos ?? null;
  cameraSystem.getIsEnemyDead = (uid) => enemies.get(uid)?.isDead ?? true;
  const ensureDebugSandboxStarterLoadout = (mapData: SliceMapData) => ensureDebugLoadout(playerState, mapData);

  const pointerPickingSystem = new PointerPickingSystem({
    scene,
    doorSystem,
    wallRevealSystem,
    dropSystem,
    enemies,
    levelToWorldY,
    getRenderLevel,
    getIsFirstPerson: () => isFirstPerson,
    getPickupRange: () => playerState.pickupRange / 32,
  });

  let debugCollidersVisible = false;
  let debugColliderParent: TransformNode | null = null;
  let playerDebugMesh: Mesh | null = null;
  const debugVisualsCfg = { scene, debugCollidersVisible: () => debugCollidersVisible, debugColliderParent: () => debugColliderParent, setDebugParent: (v: any) => { debugColliderParent = v; }, playerDebugMesh: () => playerDebugMesh, setPlayerDebugMesh: (v: any) => { playerDebugMesh = v; }, collisionWorld, player, HERO_BODY_HEIGHT };
  const debugVisuals = createDebugColliderVisuals(debugVisualsCfg);

  const createWedgeMesh = (v: any, p: any) => debugVisuals.createWedgeMesh(v, p);
  const rebuildDebugColliderMeshes = () => debugVisuals.rebuildDebugColliderMeshes();
  const updatePlayerDebugMesh = () => debugVisuals.updatePlayerDebugMesh();
  const ensureMapLevelReady = (requestedLevel: string) => ensureMapLevelReadyImpl({ loadMapData: () => loadMapData(), ensureWorldMapReady: (d: any) => ensureWorldMapReady(d), ensureDebugLoadout: (d: any) => ensureDebugSandboxStarterLoadout(d), get doorSystem() { return doorSystem; }, get ctx() { return ctx; }, renderMapLevel: (l: any) => renderMapLevel(l), get propSystem() { return propSystem; }, get player() { return player; }, getMapTileAt: (l: any, x: any, z: any) => getMapTileAt(l, x, z), isBlockingTile: (s: any, d: any, o: any) => isBlockingTile(s, d, o), isVoidSymbol: (s: any) => isVoidSymbol(s), worldToSliceCoord: (v: any) => worldToSliceCoord(v), get currentMapWidth() { return currentMapWidth; }, get currentMapHeight() { return currentMapHeight; }, snapPlayerFootToActiveLevel, get playerState() { return playerState; } }, requestedLevel);
  let lt: ReturnType<typeof createLevelTransitionSystem>;

  const setSelectedEnemy = (enemyUid: string | null) => { setSelectedEnemyImpl(ctx, enemyUid); };
  const grantEnemyLoot = (enemy: SliceEnemy) => { grantEnemyLootImpl(ctx, enemy); };
  const destroyEnemy = (enemy: SliceEnemy, context?: { finishingDamage?: number; isFireKill?: boolean }) => { destroyEnemyImpl({ ctx, enemySpawnCatalog, pendingEnemyRespawns, ENEMY_RESPAWN_MS, emitBloodBurst, setEnemyAnimState, getGeneratedDeathDurationMs }, enemy, context); };
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

  const LOG_SLOW_PATH_MS = 100;
  const enemyPathfindingCfg = { get ctx() { return ctx; }, pathfindingManager, applyActorAquaticY };
  const requestEnemyPath = (enemy: SliceEnemy, targetPos: Vector3) => requestEnemyPathImpl(enemyPathfindingCfg, enemy, targetPos);
  const advanceEnemyPath = (enemy: SliceEnemy, deltaSeconds: number) => advanceEnemyPathImpl(enemyPathfindingCfg, enemy, deltaSeconds);
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

  const collectInteractableRevealTargets = () => collectRevealTargets({ enemies, doorSystem, player, getCurrentLevel, levelToWorldY, LEVEL_HEIGHT, WALK_SURFACE, WALL_REVEAL_TARGET_RADIUS_UNITS });
  const tryPickupPersistentItem = (item: DroppedItemData, requestedCount?: number) => dropPickup.tryPickupPersistentItem(item, requestedCount);
  const tryPickupNearestItem = (): boolean => dropPickup.tryPickupNearestItem();
  let dropPickup: ReturnType<typeof createDropPickupSystem>;

  const waitForSpawnChunkReady = (timeoutMs = 12000): Promise<boolean> =>
    chunkSystem.waitForSpawnChunkReady(timeoutMs);

  const bootstrapWorldSession = (retries = 3, baseDelayMs = 2000) => bootstrapWorld({ ctx, sliceMapName, ensureMapLevelReady, snapPlayerFootToActiveLevel, waitForSpawnChunkReady: () => waitForSpawnChunkReady(), player, getMapTileAt, isVoidSymbol, reanchorWorldContentOnLevel, propSystem, setPlayerAvatarVisible: (v: boolean) => setPlayerAvatarVisible(v), cameraSystem: cameraSystem as any, resolveWorldReady: resolveWorldReady ?? undefined, getRenderLevel }, retries, baseDelayMs);

  const seedLevelKeys = Object.keys((mapDataCache as SliceMapData | null)?.levels ?? {});
  void orchestrator.seedAllLevels(seedLevelKeys);
  orchestrator.dropSystem.syncStream(true);

  let inputManager: SliceInputManager;
  let ctx: GameContext;
  let fallSystem: PlayerFallSystem;
  let sliceEnemySystem: SliceEnemySystem;
  let sliceCombatSystem: SliceCombatSystem;

  const playerCtx = createPlayerContext(player.position.x, player.position.y, player.position.z);

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

  const setCanvasGameplayInputEnabled = (enabled: boolean) => {
    canvas.style.pointerEvents = enabled ? "auto" : "none";
    if (!enabled) canvas.blur();
  };

  const handleGameplayPauseChanged = (paused: boolean) => {
    gameplayPaused = paused;
    inputManager?.clearPressedKeys();
    if (paused) {
      cameraSystem.suspend();
      setCanvasGameplayInputEnabled(false);
      return;
    }
    setCanvasGameplayInputEnabled(true);
    cameraSystem.resume();
  };

  playerState.on("gameplayPauseChanged", handleGameplayPauseChanged);
  if (gameplayPaused) {
    handleGameplayPauseChanged(true);
  }

  // PlayerFallSystem handles void fall, death sequence, and respawn logic

  // Activate first-person mode if URL contains ?fp=1
  if (searchParams.get("fp") === "1") {
    cameraSystem.setMode(true, false);
    isFirstPerson = true;
  }

  // S8-T2: rune slot dispatch moved to RuneCastSystem

  const box = (get: () => any, set: (v: any) => void) => ({ get, set }) as any as MutableStateBox<any>;

  ctx = createGameContext({
    engine, scene, canvas, audioManager, audioSystem, camera, firstPersonCamera,
    collisionWorld, enemies,
    chunkSystem, orchestrator, navigationSystem, cameraSystem,
    qualitySystem, doorSystem, propSystem, dropSystem, enemySystem,
    wallRevealSystem, waterEffectSystem, projectileSystem,
    sliceCombatSystem: box(() => sliceCombatSystem, (v) => { sliceCombatSystem = v; }),
    sliceEnemySystem: box(() => sliceEnemySystem, (v) => { sliceEnemySystem = v; }),
    inputManager: box(() => inputManager, (v) => { inputManager = v; }),
    visibilitySystem, tileMaterialSystem, pointerPickingSystem, telemetryLogger,
    saveSystem: box(() => saveSystem, (v) => { saveSystem = v; }), sceneInstrumentation,
    player, playerCtx, playerState, heroSpriteMat, heroBillboard, heroShadow,
    checkLevelDrift,
    isFirstPerson: box(() => isFirstPerson, (v) => { isFirstPerson = v; }),
    gameplayPaused: box(() => gameplayPaused, (v) => { gameplayPaused = v; }),
    debugCollidersVisible: box(() => debugCollidersVisible, (v) => { debugCollidersVisible = v; }),
    mapDataCache: box(() => mapDataCache, (v) => { mapDataCache = v; }),
    currentMapWidth: box(() => currentMapWidth, (v) => { currentMapWidth = v; }),
    currentMapHeight: box(() => currentMapHeight, (v) => { currentMapHeight = v; }),
    sliceMapName,
    mapMinX: box(() => mapMinX, (v) => { mapMinX = v; }),
    mapMaxX: box(() => mapMaxX, (v) => { mapMaxX = v; }),
    mapMinZ: box(() => mapMinZ, (v) => { mapMinZ = v; }),
    mapMaxZ: box(() => mapMaxZ, (v) => { mapMaxZ = v; }),
    lastChunkRenderLevel: box(() => lastChunkRenderLevel, (v) => { lastChunkRenderLevel = v; }),
    worldMapReady: box(() => worldMapReady, (v) => { worldMapReady = v; }),
    worldBootstrapReady: box(() => worldBootstrapReady, (v) => { worldBootstrapReady = v; }),
    selectedEnemyUid: box(() => selectedEnemyUid, (v) => { selectedEnemyUid = v; }),
    setSelectedEnemy,
    activeRuneSlotIndex: box(() => activeRuneSlotIndex, (v) => { activeRuneSlotIndex = v; }),
    runeTargetingMode: box(() => runeTargetingMode, (v) => { runeTargetingMode = v; }),
    targetingRuneId: box(() => targetingRuneId, (v) => { targetingRuneId = v; }),
    enemyHighlightPulseT: box(() => enemyHighlightPulseT, (v) => { enemyHighlightPulseT = v; }),
    heroAnimLockedUntil: box(() => heroAnimLockedUntil, (v) => { heroAnimLockedUntil = v; }),
    isPlayerDeathSequenceActive: box(() => isPlayerDeathSequenceActive, (v) => { isPlayerDeathSequenceActive = v; }),
    playerDeathTimeoutId: box(() => playerDeathTimeoutId, (v) => { playerDeathTimeoutId = v; }),
    verticalTransitionGuard: box(() => verticalTransitionGuard, (v) => { verticalTransitionGuard = v; }),
    getCurrentLevel, getRenderLevel, getMapTileAt,
    setHeroDirection, setHeroAnimState, resolveHeroBmsDirection,
    isPlayerOverVoidAtLevel, getGroundSurfaceY, syncLevelSideEffects: box(() => syncLevelSideEffects, (v) => { syncLevelSideEffects = v; }),
    applyActiveLevelChange: box(() => applyActiveLevelChange, (v) => { applyActiveLevelChange = v; }), isTileBlockedForGameplay,
    updateEnemyAI,
    applyEnemyTargetVisual, restoreEnemyTargetVisual,
    getAquaticSampleAt, findFirstBlockingTileOnWorldLine,
    fallSystem: box(() => fallSystem, (v) => { fallSystem = v; }),
  });
  lt = createLevelTransitionSystem({
    ctx,
    ensureMapLevelReady: (level) => ensureMapLevelReady(level),
    loadLevelBinary: (level, mapData) => loadLevelBinary(level, mapData),
    hasLevelBinary: (level) => levelBinaryCache.has(level),
  });
  applyActiveLevelChange = lt.applyActiveLevelChange;
  syncLevelSideEffects = lt.syncLevelSideEffects;
  snapPlayerFootToActiveLevel = lt.snapPlayerFootToActiveLevel;
  snapFootToGradedSurface = lt.snapFootToGradedSurface;

  const damagePopup = createDamagePopupSystem({ ctx, scene });
  emitPlayerDamagePopup = damagePopup.emitPlayerDamagePopup;
  emitBloodBurst = damagePopup.emitBloodBurst;

  groundQuery = createGroundQuerySystem({ ctx });

  fallSystem = createPlayerFallSystem({
    ctx,
    getCurrentLevel: ctx.getCurrentLevel,
    setHeroAnimState: ctx.setHeroAnimState,
    emitPlayerDamagePopup,
    getAquaticSampleAt: ctx.getAquaticSampleAt,
    getMapTileAt: ctx.getMapTileAt,
    isVoidSymbol: (symbol) => isVoidSymbol(symbol),
    applyActiveLevelChange: ctx.applyActiveLevelChange,
    ensureMapLevelReady,
    snapPlayerFootToActiveLevel,
  });

  sliceCombatSystem = new SliceCombatSystem({
    ctx,
    projectileSystem,
    destroyEnemy,
    emitBloodBurst,
    emitPlayerDamagePopup,
    triggerPlayerDeathSequence: fallSystem.triggerPlayerDeathSequence,
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
    getSelectedEnemy: () => ctx.selectedEnemyUid,
  });

  dropPickup = createDropPickupSystem({ ctx });
  addDroppedItemFromEvent = dropPickup.addDroppedItemFromEvent;
  handleDropItem = dropPickup.handleDropItem;
  handleRequestPickup = dropPickup.handleRequestPickup;

  void bootstrapWorldSession();

  inputManager = new SliceInputManager({
    canvas,
    isPaused: () => ctx.gameplayPaused,
    isPlayerDeathSequenceActive: () => ctx.isPlayerDeathSequenceActive,
    isFirstPerson: () => ctx.isFirstPerson,
    ensureAudioReady: () => ctx.audioSystem.ensureReady(),
    onCastRune: () => ctx.sliceCombatSystem.castRune3d(),
    onCycleRuneSlot: () => {
      ctx.activeRuneSlotIndex = (ctx.activeRuneSlotIndex + 1) % 3;
      runeSystem.dispatchRuneSlotUpdate();
    },
    onToggleDebugColliders: () => {
      ctx.debugCollidersVisible = !ctx.debugCollidersVisible;
      rebuildDebugColliderMeshes();
      // eslint-disable-next-line no-console
      console.warn(`[DEBUG] Collision visualization: ${ctx.debugCollidersVisible ? "ON" : "OFF"}`);
    },
    onToggleCameraMode: (newFP: boolean) => {
      if (newFP) {
        console.warn(
          "[DEBUG] Entering first-person mode — debug-only camera. Top-down is the product view.",
        );
      }
      ctx.cameraSystem.setMode(newFP, newFP);
      ctx.isFirstPerson = ctx.cameraSystem.isFirstPerson;
    },
    onCycleCameraPreset: () => {
      ctx.cameraSystem.cycleTopDownPreset();
    },
    onToggleFallSafety: () => {
      const safetyEnabled = ctx.playerState.toggleFallSafety();
      ctx.playerState.emit("uiNotification", {
        type: safetyEnabled ? "info" : "warning",
        message: t_game(safetyEnabled ? "fall_safety_on" : "fall_safety_off"),
      });
    },
    onInteract: () => {
      const pickedRealItem = tryPickupNearestItem();
      if (pickedRealItem) {
        ctx.orchestrator.dropSystem.syncStream(true);
        return;
      }

      if (ctx.doorSystem.tryInteractNearbyDoorRespectingPickup(ctx.playerState.pickupRange / 32, ctx.pointerPickingSystem.getNearestPickupItemDistance())) {
        return;
      }

      if (!ctx.dropSystem.hasRealDroppedItems) {
        const dist = Vector3.Distance(ctx.player.position, pickupOrb.position);
        if (dist <= 1.25) {
          const added = ctx.playerState.addItem("torch", 1);
          if (added) {
            fallbackPickupConsumed = true;
            pickupOrb.setEnabled(false);
            ctx.audioManager.playPickup();
            ctx.playerState.log("action_pickup");
          }
        }
      }
    }
  });







  playerState.on("dropItem", handleDropItem);
  playerState.on("requestPickup", handleRequestPickup);
  playerState.on("spawnDroppedItem", addDroppedItemFromEvent);

  const runeSystem = createRuneCastSystem({ ctx });
  runeSystem.dispatchRuneSlotUpdate();














  const pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
    if (gameplayPaused || ctx.isPlayerDeathSequenceActive) {
      return;
    }
    if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) {
      return;
    }

    const isRightClick = pointerInfo.event.button === 2;
    const isLeftClick = pointerInfo.event.button === 0;

    // S11-T1: Handle rune targeting mode (delegated to RuneCastSystem)
    if (isLeftClick) {
      const px = isFirstPerson ? engine.getRenderWidth() / 2 : scene.pointerX;
      const py = isFirstPerson ? engine.getRenderHeight() / 2 : scene.pointerY;
      if (runeSystem.handleRuneTargetClick(px, py)) return;
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

    const enemyUid = pointerPickingSystem.resolveEnemyUidFromPointer(pointerX, pointerY);

    if (enemyUid && enemies.has(enemyUid)) {
      setSelectedEnemy(enemyUid);
      return;
    }

    const pickedDoorUuid = pointerPickingSystem.resolveDoorUuidFromPointer(pointerX, pointerY);
    if (
      pickedDoorUuid &&
      isRightClick &&
      doorSystem.tryInteractPickedDoor(pickedDoorUuid)
    ) {
      return;
    }

    if (isRightClick) {
      doorSystem.tryInteractNearbyDoorRespectingPickup(playerState.pickupRange / 32, pointerPickingSystem.getNearestPickupItemDistance());
      return;
    }

    setSelectedEnemy(null);
  });

  // ── RenderSystem: owns onBeforeRender + runRenderLoop ─────────────────
  saveSystem = new SaveSystem();
  const renderSystem = new RenderSystem({
    ctx,
    heroShadowMat,
    heroAquaticTint,
    lastPlayerAquaticMode,
    activeSlashtrails,
    enemySpawnCatalog,
    syncVerticalLevelVisibility: (dt) =>
      visibilitySystem.syncVerticalLevelVisibility(dt),
    hideWallsOnRay: () => visibilitySystem.hideWallsOnRay(),
    updatePlayerDebugMesh,
    collectInteractableRevealTargets,
  });
  renderSystem.attach();

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

  // ─── Display Settings bridge (PlayerState → Babylon engine) ─────────────
  // Render scale: setHardwareScalingLevel(1/scale) lowers internal resolution
  // without touching camera FOV. Quality preset also tunes chunk/enemy/prop radii.
  const applyDisplaySettings = (s: any) => applyDisplaySettingsImpl({ engine, qualitySystem, hemiLight, scene, renderSystem }, s);
  const handleDisplaySettings = (s: any) => applyDisplaySettings(s);
  playerState.on("displaySettingsChanged", handleDisplaySettings);
  const handleDoorStatesChanged = () => {
    ctx.doorSystem.handleDoorStatesChanged();
  };
  playerState.on("doorStatesChanged", handleDoorStatesChanged);

  return {
    engine,
    scene,
    save,
    whenWorldReady: () => worldReadyPromise,
    dispose: () => {
      ctx.telemetryLogger.pushLogEvent("session.dispose", {
        currentLevel: getCurrentLevel(),
        samples: ctx.telemetryLogger.runtimeLog.samples.length,
        events: ctx.telemetryLogger.runtimeLog.events.length,
      });
      ctx.inputManager.dispose();
      ctx.telemetryLogger.persistRuntimeLogs();
      void ctx.telemetryLogger.flushRuntimeLogsToFile(true);


      ctx.playerState.off("dropItem", handleDropItem);
      ctx.playerState.off("requestPickup", handleRequestPickup);
      ctx.playerState.off("spawnDroppedItem", addDroppedItemFromEvent);
      ctx.playerState.off("equipmentChanged", syncHeroVisualProfile);
      ctx.playerState.off("displaySettingsChanged", handleDisplaySettings);
      ctx.playerState.off("doorStatesChanged", handleDoorStatesChanged);
      ctx.playerState.off("gameplayPauseChanged", handleGameplayPauseChanged);
      if (ctx.playerDeathTimeoutId !== null) {
        window.clearTimeout(ctx.playerDeathTimeoutId);
        ctx.playerDeathTimeoutId = null;
      }


      ctx.scene.onPointerObservable.remove(pointerObserver);
      document.exitPointerLock?.();
      ctx.chunkSystem.clearAll();
      ctx.wallRevealSystem.dispose();
      ctx.waterEffectSystem.dispose();
      heroAquaticTint.dispose();
      mapRoot.dispose();
      ctx.tileMaterialSystem.dispose();
      ctx.dropSystem.clear();
      activeSlashtrails.forEach((slash) => {
        slash.mesh.dispose();
        slash.material.dispose();
        slash.texture.dispose();
      });
      activeSlashtrails.length = 0;
      ctx.doorSystem.clear();
      ctx.propSystem.clear();
      ctx.enemySystem.clear();
      ctx.projectileSystem.disposeAll();
      disposeAllPooledSpriteTexturesForScene(ctx.scene);
      ctx.telemetryLogger.dispose();
      delete window.__slice3dLogsData;
      delete window.__slice3dPerf;
      delete window.__slice3dPerfDiagnostics;
      geometryWorker.terminate();
      ctx.scene.dispose();
      ctx.engine.dispose();
    },
  };
}
