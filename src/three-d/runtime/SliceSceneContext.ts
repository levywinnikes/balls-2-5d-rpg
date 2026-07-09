import { Engine, Scene, Mesh, ArcRotateCamera, UniversalCamera } from "@babylonjs/core";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { PlayerContext } from "./PlayerContext";
import { CollisionWorld } from "./CollisionWorld";
import { SliceEnemy } from "./EnemyStreamSystem";
import { AudioManager } from "../../game/systems/AudioManager";
import { SliceMapData } from "./SliceTileTypes";

export interface SliceSceneContext {
  engine: Engine;
  scene: Scene;
  canvas: HTMLCanvasElement;
  player: Mesh;
  playerCtx: PlayerContext;
  playerState: PlayerState;
  camera: ArcRotateCamera;
  firstPersonCamera: UniversalCamera;
  audioManager: AudioManager;
  collisionWorld: CollisionWorld;
  enemies: Map<string, SliceEnemy>;

  isFirstPerson: boolean;
  gameplayPaused: boolean;
  debugCollidersVisible: boolean;

  mapDataCache: SliceMapData | null;
  currentMapWidth: number;
  currentMapHeight: number;

  selectedEnemyUid: string | null;
  setSelectedEnemy: (uid: string | null) => void;
  activeRuneSlotIndex: number;

  runeTargetingMode: boolean;
  targetingRuneId: string | null;
}
