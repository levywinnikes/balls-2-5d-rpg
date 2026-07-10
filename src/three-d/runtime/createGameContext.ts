import type { Engine, Scene, Mesh, StandardMaterial } from "@babylonjs/core";
import type { GameContext, MutableStateBox } from "./GameContext";
import type { PlayerContext } from "./PlayerContext";
import type { PlayerState } from "../../game/entities/Player/PlayerState";
import type { AudioManager } from "../../game/systems/AudioManager";
import type { CollisionWorld } from "./CollisionWorld";
import type { ChunkStreamSystem } from "./ChunkStreamSystem";
import type { StreamOrchestrator } from "./StreamOrchestrator";
import type { NavigationSystem } from "./NavigationSystem";
import type { CameraSystem } from "./CameraSystem";
import type { QualitySystem } from "./QualitySystem";
import type { DoorSystem } from "./DoorSystem";
import type { PropStreamSystem } from "./PropStreamSystem";
import type { DropStreamSystem } from "./DropStreamSystem";
import type { EnemyStreamSystem } from "./EnemyStreamSystem";
import type { InteractableWallRevealSystem } from "./InteractableWallRevealSystem";
import type { WaterEffectSystem } from "./WaterEffectSystem";
import type { Projectile3DSystem } from "./Projectile3DSystem";
import type { SliceCombatSystem } from "./SliceCombatSystem";
import type { SliceEnemySystem } from "./SliceEnemySystem";
import type { SliceInputManager } from "./SliceInputManager";
import type { VisibilitySystem } from "./VisibilitySystem";
import type { TileMaterialSystem } from "./TileMaterialSystem";
import type { PointerPickingSystem } from "./PointerPickingSystem";
import type { TelemetryLogger } from "./TelemetryLogger";
import type { SaveSystem } from "../../core/systems/SaveSystem";
import type { HeroAnimState, HeroBmsDirection } from "./TwoDParitySpriteFactory";
import type { AquaticSample } from "./WaterProfile";

export interface CreateGameContextDeps {
  engine: Engine;
  scene: Scene;
  canvas: HTMLCanvasElement;
  audioManager: AudioManager;
  audioSystem: MutableStateBox<any>;
  collisionWorld: CollisionWorld;
  enemies: Map<string, any>;

  chunkSystem: ChunkStreamSystem;
  orchestrator: StreamOrchestrator;
  navigationSystem: NavigationSystem;
  cameraSystem: CameraSystem;
  qualitySystem: QualitySystem;
  doorSystem: DoorSystem;
  propSystem: PropStreamSystem;
  dropSystem: DropStreamSystem;
  enemySystem: EnemyStreamSystem;
  wallRevealSystem: InteractableWallRevealSystem;
  waterEffectSystem: WaterEffectSystem;
  projectileSystem: Projectile3DSystem;
  sliceCombatSystem: MutableStateBox<SliceCombatSystem>;
  sliceEnemySystem: MutableStateBox<SliceEnemySystem>;
  inputManager: MutableStateBox<SliceInputManager>;
  visibilitySystem: VisibilitySystem;
  tileMaterialSystem: TileMaterialSystem;
  pointerPickingSystem: PointerPickingSystem;
  telemetryLogger: TelemetryLogger;
  saveSystem: MutableStateBox<SaveSystem>;
  sceneInstrumentation: any;

  player: Mesh;
  playerCtx: PlayerContext;
  playerState: PlayerState;
  camera: any;
  firstPersonCamera: any;
  heroSpriteMat: StandardMaterial;
  heroBillboard: Mesh;
  heroShadow: Mesh;

  checkLevelDrift: MutableStateBox<() => void>;

  isFirstPerson: MutableStateBox<boolean>;
  gameplayPaused: MutableStateBox<boolean>;
  debugCollidersVisible: MutableStateBox<boolean>;
  mapDataCache: MutableStateBox<any>;
  currentMapWidth: MutableStateBox<number>;
  currentMapHeight: MutableStateBox<number>;
  sliceMapName: string;
  mapMinX: MutableStateBox<number>;
  mapMaxX: MutableStateBox<number>;
  mapMinZ: MutableStateBox<number>;
  mapMaxZ: MutableStateBox<number>;
  lastChunkRenderLevel: MutableStateBox<string | null>;
  worldMapReady: MutableStateBox<boolean>;
  worldBootstrapReady: MutableStateBox<boolean>;

  selectedEnemyUid: MutableStateBox<string | null>;
  setSelectedEnemy: (v: string | null) => void;
  activeRuneSlotIndex: MutableStateBox<number>;
  runeTargetingMode: MutableStateBox<boolean>;
  targetingRuneId: MutableStateBox<string | null>;
  enemyHighlightPulseT: MutableStateBox<number>;

  heroAnimLockedUntil: MutableStateBox<number>;
  isPlayerDeathSequenceActive: MutableStateBox<boolean>;
  playerDeathTimeoutId: MutableStateBox<number | null>;
  verticalTransitionGuard: MutableStateBox<{
    untilMs: number; tileX: number; tileZ: number; fromLevel: string; toLevel: string;
  } | null>;

  syncLevelSideEffects: MutableStateBox<() => void>;
  applyActiveLevelChange: MutableStateBox<(level: string, transition?: any, opts?: { natural?: boolean }) => void>;

  getCurrentLevel: () => string;
  getRenderLevel: () => string;
  getMapTileAt: (level: string, tx: number, tz: number) => string | null;
  setHeroDirection: (dir: HeroBmsDirection) => void;
  setHeroAnimState: (state: HeroAnimState, lockMs?: number) => void;
  resolveHeroBmsDirection: (moveForward: number, moveRight: number, fallback: HeroBmsDirection) => HeroBmsDirection;
  isPlayerOverVoidAtLevel: (level: string) => boolean;
  getGroundSurfaceY: (x: number, z: number, level: string) => number;
  isTileBlockedForGameplay: (tileX: number, tileY: number) => boolean;
  updateEnemyAI: (dt: number) => void;
  applyEnemyTargetVisual: (root: any, pulse: number, health?: { current: number; max: number }) => void;
  restoreEnemyTargetVisual: (root: any) => void;
  getAquaticSampleAt: (x: number, z: number, level: string) => AquaticSample;
  findFirstBlockingTileOnWorldLine: (...args: any[]) => any;

  fallSystem: MutableStateBox<{ finishAirborneLanding: (level: string, y: number, impactSpeed: number, floorCount: number) => void }>;
}

export function createGameContext(d: CreateGameContextDeps): GameContext {
  return {
    get engine() { return d.engine; },
    get scene() { return d.scene; },
    get canvas() { return d.canvas; },
    get audioManager() { return d.audioManager; },
    get collisionWorld() { return d.collisionWorld; },
    get enemies() { return d.enemies; },
    get audioSystem() { return d.audioSystem.get(); },
    get saveSystem() { return d.saveSystem.get(); },
    get checkLevelDrift() { return d.checkLevelDrift.get(); },
    get telemetryEnabledRef() { return d.telemetryLogger.telemetryEnabledRef; },
    get sceneInstrumentation() { return d.sceneInstrumentation; },
    get chunkSystem() { return d.chunkSystem; },
    get orchestrator() { return d.orchestrator; },
    get navigationSystem() { return d.navigationSystem; },
    get cameraSystem() { return d.cameraSystem; },
    get qualitySystem() { return d.qualitySystem; },
    get doorSystem() { return d.doorSystem; },
    get propSystem() { return d.propSystem; },
    get dropSystem() { return d.dropSystem; },
    get enemySystem() { return d.enemySystem; },
    get wallRevealSystem() { return d.wallRevealSystem; },
    get waterEffectSystem() { return d.waterEffectSystem; },
    get projectileSystem() { return d.projectileSystem; },
    get sliceCombatSystem() { return d.sliceCombatSystem.get(); },
    get sliceEnemySystem() { return d.sliceEnemySystem.get(); },
    get inputManager() { return d.inputManager.get(); },
    get visibilitySystem() { return d.visibilitySystem; },
    get tileMaterialSystem() { return d.tileMaterialSystem; },
    get pointerPickingSystem() { return d.pointerPickingSystem; },
    get telemetryLogger() { return d.telemetryLogger; },

    get player() { return d.player; },
    get playerCtx() { return d.playerCtx; },
    get playerState() { return d.playerState; },
    get camera() { return d.camera; },
    get firstPersonCamera() { return d.firstPersonCamera; },
    get heroSpriteMat() { return d.heroSpriteMat; },
    get heroBillboard() { return d.heroBillboard; },
    get heroShadow() { return d.heroShadow; },

    get isFirstPerson() { return d.isFirstPerson.get(); },
    set isFirstPerson(v) { d.isFirstPerson.set(v); },
    get gameplayPaused() { return d.gameplayPaused.get(); },
    set gameplayPaused(v) { d.gameplayPaused.set(v); },
    get debugCollidersVisible() { return d.debugCollidersVisible.get(); },
    set debugCollidersVisible(v) { d.debugCollidersVisible.set(v); },

    get mapDataCache() { return d.mapDataCache.get(); },
    set mapDataCache(v) { d.mapDataCache.set(v); },
    get currentMapWidth() { return d.currentMapWidth.get(); },
    set currentMapWidth(v) { d.currentMapWidth.set(v); },
    get currentMapHeight() { return d.currentMapHeight.get(); },
    set currentMapHeight(v) { d.currentMapHeight.set(v); },
    get sliceMapName() { return d.sliceMapName; },
    get mapMinX() { return d.mapMinX.get(); },
    set mapMinX(v) { d.mapMinX.set(v); },
    get mapMaxX() { return d.mapMaxX.get(); },
    set mapMaxX(v) { d.mapMaxX.set(v); },
    get mapMinZ() { return d.mapMinZ.get(); },
    set mapMinZ(v) { d.mapMinZ.set(v); },
    get mapMaxZ() { return d.mapMaxZ.get(); },
    set mapMaxZ(v) { d.mapMaxZ.set(v); },
    get lastChunkRenderLevel() { return d.lastChunkRenderLevel.get(); },
    set lastChunkRenderLevel(v) { d.lastChunkRenderLevel.set(v); },
    get worldMapReady() { return d.worldMapReady.get(); },
    set worldMapReady(v) { d.worldMapReady.set(v); },
    get worldBootstrapReady() { return d.worldBootstrapReady.get(); },
    set worldBootstrapReady(v) { d.worldBootstrapReady.set(v); },

    get selectedEnemyUid() { return d.selectedEnemyUid.get(); },
    set selectedEnemyUid(v) { d.selectedEnemyUid.set(v); },
    setSelectedEnemy(v) { d.setSelectedEnemy(v); },
    get activeRuneSlotIndex() { return d.activeRuneSlotIndex.get(); },
    set activeRuneSlotIndex(v) { d.activeRuneSlotIndex.set(v); },
    get runeTargetingMode() { return d.runeTargetingMode.get(); },
    set runeTargetingMode(v) { d.runeTargetingMode.set(v); },
    get targetingRuneId() { return d.targetingRuneId.get(); },
    set targetingRuneId(v) { d.targetingRuneId.set(v); },
    get enemyHighlightPulseT() { return d.enemyHighlightPulseT.get(); },
    set enemyHighlightPulseT(v) { d.enemyHighlightPulseT.set(v); },

    get verticalVelocity() { return d.playerCtx.verticalVelocity; },
    set verticalVelocity(v) { d.playerCtx.verticalVelocity = v; },
    get isGrounded() { return d.playerCtx.isGrounded; },
    set isGrounded(v) { d.playerCtx.isGrounded = v; },
    get holeFallLandingLevel() { return d.playerCtx.holeFallLandingLevel; },
    set holeFallLandingLevel(v) { d.playerCtx.holeFallLandingLevel = v; },
    get holeFallFloorCount() { return d.playerCtx.holeFallFloorCount; },
    set holeFallFloorCount(v) { d.playerCtx.holeFallFloorCount = v; },
    get fallOriginFootY() { return d.playerCtx.fallOriginFootY; },
    set fallOriginFootY(v) { d.playerCtx.fallOriginFootY = v; },
    get wasOnVoidWithSafety() { return d.playerCtx.wasOnVoidWithSafety; },
    set wasOnVoidWithSafety(v) { d.playerCtx.wasOnVoidWithSafety = v; },
    get lastSafePlayerX() { return d.playerCtx.lastSafePositionX; },
    set lastSafePlayerX(v) { d.playerCtx.lastSafePositionX = v; },
    get lastSafePlayerZ() { return d.playerCtx.lastSafePositionZ; },
    set lastSafePlayerZ(v) { d.playerCtx.lastSafePositionZ = v; },
    get lastGroundedFootY() { return d.playerCtx.lastGroundedFootY; },
    set lastGroundedFootY(v) { d.playerCtx.lastGroundedFootY = v; },
    get levelTransitionCooldown() { return d.playerCtx.levelTransitionCooldown; },
    set levelTransitionCooldown(v) { d.playerCtx.levelTransitionCooldown = v; },
    get verticalTransitionGuard() { return d.verticalTransitionGuard.get(); },
    set verticalTransitionGuard(v) { d.verticalTransitionGuard.set(v); },

    get heroAnimLockedUntil() { return d.heroAnimLockedUntil.get(); },
    set heroAnimLockedUntil(v) { d.heroAnimLockedUntil.set(v); },

    get isPlayerDeathSequenceActive() { return d.isPlayerDeathSequenceActive.get(); },
    set isPlayerDeathSequenceActive(v) { d.isPlayerDeathSequenceActive.set(v); },
    get playerDeathTimeoutId() { return d.playerDeathTimeoutId.get(); },
    set playerDeathTimeoutId(v) { d.playerDeathTimeoutId.set(v); },

    get getCurrentLevel() { return d.getCurrentLevel; },
    get getRenderLevel() { return d.getRenderLevel; },
    get getMapTileAt() { return d.getMapTileAt; },
    get setHeroDirection() { return d.setHeroDirection; },
    get setHeroAnimState() { return d.setHeroAnimState; },
    get resolveHeroBmsDirection() { return d.resolveHeroBmsDirection; },
    get isPlayerOverVoidAtLevel() { return d.isPlayerOverVoidAtLevel; },
    get getGroundSurfaceY() { return d.getGroundSurfaceY; },
    get syncLevelSideEffects() { return d.syncLevelSideEffects.get(); },
    get applyActiveLevelChange() { return d.applyActiveLevelChange.get(); },
    get isTileBlockedForGameplay() { return d.isTileBlockedForGameplay; },
    get updateEnemyAI() { return d.updateEnemyAI; },
    get finishAirborneLanding() { return d.fallSystem.get().finishAirborneLanding; },
    get applyEnemyTargetVisual() { return d.applyEnemyTargetVisual; },
    get restoreEnemyTargetVisual() { return d.restoreEnemyTargetVisual; },
    get getAquaticSampleAt() { return d.getAquaticSampleAt; },
    get findFirstBlockingTileOnWorldLine() { return d.findFirstBlockingTileOnWorldLine; },
  };
}
