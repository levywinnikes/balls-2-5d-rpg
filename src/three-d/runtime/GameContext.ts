import type { SliceSceneContext } from "./SliceSceneContext";
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
import type { SliceCombatSystem } from "./SliceCombatSystem";
import type { SliceEnemySystem } from "./SliceEnemySystem";
import type { VisibilitySystem } from "./VisibilitySystem";
import type { TileMaterialSystem } from "./TileMaterialSystem";
import type { PointerPickingSystem } from "./PointerPickingSystem";
import type { TelemetryLogger } from "./TelemetryLogger";
import type { Projectile3DSystem } from "./Projectile3DSystem";
import type { SliceInputManager } from "./SliceInputManager";
import type { AudioSystem } from "./AudioSystem";
import type { SaveSystem } from "../../core/systems/SaveSystem";
import type { StandardMaterial, Mesh, TransformNode, SceneInstrumentation } from "@babylonjs/core";
import type { HeroAnimState, HeroBmsDirection } from "./TwoDParitySpriteFactory";
import type { AquaticSample } from "./WaterProfile";
import type { GridPoint } from "./WallRevealLos";
import type { SliceMapData } from "./SliceTileTypes";

/**
 * Read-write bridge for a mutable closure variable.
 * Used to keep closure vars as the source of truth while exposing them via ctx getters/setters.
 */
export interface MutableStateBox<T> {
  get: () => T;
  set: (v: T) => void;
}

/**
 * Full runtime context — centralises ALL shared mutable state and system references
 * so inline functions can destructure what they need instead of capturing closure variables.
 */
export interface GameContext extends SliceSceneContext {
  // ── Physics / vertical state ──────────────────────────────────────────
  verticalVelocity: number;
  isGrounded: boolean;
  holeFallLandingLevel: string | null;
  holeFallFloorCount: number;
  fallOriginFootY: number;
  wasOnVoidWithSafety: boolean;
  lastSafePlayerX: number;
  lastSafePlayerZ: number;
  lastGroundedFootY: number;
  levelTransitionCooldown: number;
  verticalTransitionGuard: {
    untilMs: number;
    tileX: number;
    tileZ: number;
    fromLevel: string;
    toLevel: string;
  } | null;

  // ── Hero visual state (not in SliceSceneContext) ──────────────────────
  heroAnimLockedUntil: number;
  heroSpriteMat: StandardMaterial;
  heroBillboard: Mesh;
  heroShadow: Mesh;

  // ── Map / world state ─────────────────────────────────────────────────
  mapMinX: number;
  mapMaxX: number;
  mapMinZ: number;
  mapMaxZ: number;
  lastChunkRenderLevel: string | null;
  worldMapReady: boolean;
  worldBootstrapReady: boolean;
  sliceMapName: string;
  mapDataCache: SliceMapData | null;
  currentMapWidth: number;
  currentMapHeight: number;

  // ── Death / respawn state ─────────────────────────────────────────────
  isPlayerDeathSequenceActive: boolean;
  playerDeathTimeoutId: number | null;
  enemyHighlightPulseT: number;

  // ── System references (for access outside the system's own scope) ─────
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
  sliceCombatSystem: SliceCombatSystem;
  sliceEnemySystem: SliceEnemySystem;
  inputManager: SliceInputManager;
  visibilitySystem: VisibilitySystem;
  tileMaterialSystem: TileMaterialSystem;
  pointerPickingSystem: PointerPickingSystem;
  telemetryLogger: TelemetryLogger;
  audioSystem: AudioSystem;
  saveSystem: SaveSystem;

  checkLevelDrift: () => void;
  telemetryEnabledRef: { value: boolean };
  sceneInstrumentation: SceneInstrumentation;

  // ── Callback functions (moved from RenderSystemDeps for universal access) ──
  getCurrentLevel: () => string;
  getRenderLevel: () => string;
  getMapTileAt: (level: string, tileX: number, tileZ: number) => string | null;
  setHeroDirection: (dir: HeroBmsDirection) => void;
  setHeroAnimState: (state: HeroAnimState, lockMs?: number) => void;
  resolveHeroBmsDirection: (moveForward: number, moveRight: number, fallback: HeroBmsDirection) => HeroBmsDirection;
  isPlayerOverVoidAtLevel: (level: string) => boolean;
  getGroundSurfaceY: (x: number, z: number, level: string) => number;
  syncLevelSideEffects: () => void;
  applyActiveLevelChange: (level: string, transition?: any, opts?: { natural?: boolean }) => void;
  isTileBlockedForGameplay: (tileX: number, tileY: number) => boolean;
  updateEnemyAI: (dt: number) => void;
  finishAirborneLanding: (level: string, y: number, impactSpeed: number, floorCount: number) => void;
  applyEnemyTargetVisual: (root: TransformNode, pulse: number, health?: { current: number; max: number }) => void;
  restoreEnemyTargetVisual: (root: TransformNode) => void;
  getAquaticSampleAt: (x: number, z: number, level: string) => AquaticSample;
  findFirstBlockingTileOnWorldLine: (
    fromWorldX: number, fromWorldZ: number, toWorldX: number, toWorldZ: number,
    isBlocked: (tileX: number, tileY: number) => boolean,
    options?: { skipStart?: boolean; skipEnd?: boolean },
  ) => GridPoint | null;
}
