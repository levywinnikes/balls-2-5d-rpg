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
import { createGameContext } from "./createGameContext";
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

export type {
  SliceRuntime,
  Slice3DLogSample,
  Slice3DLogEvent,
  Slice3DSessionLog,
  Slice3DHotspot,
  Slice3DSummary,
} from "./Slice3DTypes";
import type { SliceRuntime, Slice3DLogSample, Slice3DLogEvent, Slice3DSessionLog, Slice3DHotspot, Slice3DSummary } from "./Slice3DTypes";
import { createMaterial, worldToSliceCoord, clamp, worldToGrid, gridToWorld } from "./SliceRuntimeUtils";
import type { TopDownCameraPreset } from "./Slice3DTypes";
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

  // buildRoofMesh and buildStairMesh moved to ChunkGeometryBuilder

  // Build (or skip) one 16×16-tile chunk at chunk-grid position (cx, cy).
  // lod 0 = full detail, 1 = walls-only, 2 = ground-only
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
          return tileMaterialSystem.getTileMaterial(symbol, tileDef, "#9ca3af");
        }
      }
    }

    const cobDef = mapData?.tileDefinitions?.cob;
    return tileMaterialSystem.getTileMaterial("cob", cobDef, "#9ca3af");
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

  let lt: ReturnType<typeof createLevelTransitionSystem>;

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
        ctx.audioManager.playSplash();
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
      ctx.enemies.delete(enemy.uid);
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
    ctx.playerState.markEnemy3dDead(enemy.level, enemy.spawnKey);

    if (ctx.selectedEnemyUid === enemy.uid) {
      setSelectedEnemy(null);
    }

    ctx.playerState.emit("combatEnemyRemoved", { uid: enemy.uid });

    grantEnemyLoot(enemy);
    ctx.playerState.gainExperience(enemy.definition.exp);

    ctx.playerState.emit("floatingText", {
      x: enemy.worldPos.x,
      y: enemy.worldPos.y,
      z: enemy.worldPos.z,
      message: enemy.definition.exp.toString(),
      icon: "★",
      customColor: "#F6E05E",
      isAmbient: true,
    });

    ctx.playerState.log("combat_killed", { target: enemy.enemyType }, "#ffaa00");
    ctx.playerState.log(
      "combat_gained_xp",
      { xp: enemy.definition.exp },
      "#ffff00",
    );
    ctx.audioManager.playEnemyDeath(enemy.enemyType);
  };  // end destroyEnemy



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
  const requestEnemyPath = async (
    enemy: SliceEnemy,
    targetPosition: Vector3,
  ) => {
    const pathRequestStartedAt = performance.now();
    telemetryLogger.pathMetrics.requests += 1;
    telemetryLogger.pathMetrics.inFlight += 1;
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
      telemetryLogger.pathMetrics.failed += 1;
      telemetryLogger.pathMetrics.inFlight = Math.max(0, telemetryLogger.pathMetrics.inFlight - 1);
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
      telemetryLogger.pathMetrics.lastMs = Math.round(tookMs * 100) / 100;
      telemetryLogger.pathMetrics.maxMs = Math.max(telemetryLogger.pathMetrics.maxMs, telemetryLogger.pathMetrics.lastMs);
      telemetryLogger.pathMetrics.totalMs += tookMs;

      if (!path || path.length === 0 || enemy.isDead) {
        telemetryLogger.pathMetrics.failed += 1;
        if (tookMs >= LOG_SLOW_PATH_MS) {
          telemetryLogger.pushLogEvent("pathfinding.slow-empty", {
            enemyUid: enemy.uid,
            tookMs: telemetryLogger.pathMetrics.lastMs,
            startX,
            startY,
            endX,
            endY,
          });
        }
        return;
      }

      telemetryLogger.pathMetrics.success += 1;
      telemetryLogger.pathMetrics.lastPathLen = path.length;

      if (tookMs >= LOG_SLOW_PATH_MS) {
        telemetryLogger.pushLogEvent("pathfinding.slow", {
          enemyUid: enemy.uid,
          tookMs: telemetryLogger.pathMetrics.lastMs,
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
      telemetryLogger.pathMetrics.errors += 1;
      telemetryLogger.pushLogEvent("pathfinding.error", {
        enemyUid: enemy.uid,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      telemetryLogger.pathMetrics.inFlight = Math.max(0, telemetryLogger.pathMetrics.inFlight - 1);
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

  let dropPickup: ReturnType<typeof createDropPickupSystem>;

  const waitForSpawnChunkReady = (timeoutMs = 12000): Promise<boolean> =>
    chunkSystem.waitForSpawnChunkReady(timeoutMs);

  const bootstrapWorldSession = async (retries = 3, baseDelayMs = 2000) => {
    telemetryLogger.pushLogEvent("world.bootstrap.start", { map: sliceMapName, level: getCurrentLevel() });
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

        ctx.lastGroundedFootY = player.position.y;
        ctx.fallOriginFootY = player.position.y;
        ctx.isGrounded = true;
        ctx.holeFallLandingLevel = null;
        ctx.holeFallFloorCount = 0;
        ctx.verticalVelocity = 0;

        reanchorWorldContentOnLevel(getRenderLevel());
        propSystem.syncStream(true);

        worldBootstrapReady = true;
        setPlayerAvatarVisible(true);
        cameraSystem.updateTopDownTarget(player.position);

        resolveWorldReady?.();
        document.dispatchEvent(
          new CustomEvent("slice3d:worldBootstrap", {
            detail: { ready: true, map: sliceMapName, level: getCurrentLevel() },
          }),
        );
        telemetryLogger.pushLogEvent("world.bootstrap.ready", {
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
          telemetryLogger.pushLogEvent("world.bootstrap.failed", { error: String(error), attempts: attempt + 1 });
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
  let ctx: GameContext;
  let fallSystem: PlayerFallSystem;
  let sliceEnemySystem: SliceEnemySystem;
  let sliceCombatSystem: SliceCombatSystem;

  // Physics state — PlayerContext is the single source of truth
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
  // navigation timer managed internally by NavigationSystem













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

  const box = <T,>(get: () => T, set: (v: T) => void): MutableStateBox<T> => ({ get, set });

  ctx = createGameContext({
    engine, scene, canvas, audioManager, audioSystem: box(() => audioSystem, (v) => { (audioSystem as any) = v; }), camera, firstPersonCamera,
    collisionWorld, enemies,
    chunkSystem, orchestrator, navigationSystem, cameraSystem,
    qualitySystem, doorSystem, propSystem, dropSystem, enemySystem,
    wallRevealSystem, waterEffectSystem, projectileSystem,
    sliceCombatSystem: box(() => sliceCombatSystem, (v) => { (sliceCombatSystem as any) = v; }),
    sliceEnemySystem: box(() => sliceEnemySystem, (v) => { (sliceEnemySystem as any) = v; }),
    inputManager: box(() => inputManager, (v) => { (inputManager as any) = v; }),
    visibilitySystem, tileMaterialSystem, pointerPickingSystem, telemetryLogger,
    saveSystem: box(() => saveSystem, (v) => { (saveSystem as any) = v; }), sceneInstrumentation,
    player, playerCtx, playerState, heroSpriteMat, heroBillboard, heroShadow,
    checkLevelDrift: box(() => checkLevelDrift, (v) => { (checkLevelDrift as any) = v; }),
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
    isPlayerOverVoidAtLevel, getGroundSurfaceY, syncLevelSideEffects: box(() => syncLevelSideEffects, (v) => { (syncLevelSideEffects as any) = v; }),
    applyActiveLevelChange: box(() => applyActiveLevelChange, (v) => { (applyActiveLevelChange as any) = v; }), isTileBlockedForGameplay,
    updateEnemyAI,
    applyEnemyTargetVisual, restoreEnemyTargetVisual,
    getAquaticSampleAt, findFirstBlockingTileOnWorldLine,
    fallSystem: box(() => fallSystem, (v) => { (fallSystem as any) = v; }) as any,
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

  dropPickup = createDropPickupSystem({ ctx, tryPickupPersistentItem });
  addDroppedItemFromEvent = dropPickup.addDroppedItemFromEvent;
  handleDropItem = dropPickup.handleDropItem;
  handleRequestPickup = dropPickup.handleRequestPickup;

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

    qualitySystem.applyConfig(settings.qualityPreset as QualityPreset);

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

    renderSystem.setFpsTargetMinFrameMs(
      settings.fpsTarget && settings.fpsTarget > 0
        ? 1000 / settings.fpsTarget
        : 0,
    );
  };
  applyDisplaySettings(playerState.getDisplaySettings());
  const handleDisplaySettings = (
    settings: ReturnType<typeof playerState.getDisplaySettings>,
  ) => {
    applyDisplaySettings(settings);
  };
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
