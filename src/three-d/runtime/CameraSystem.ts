import { ArcRotateCamera, Scene, UniversalCamera, Vector3 } from "@babylonjs/core";
import {
  createFirstPersonCombatCameraState,
  type FirstPersonCombatCameraState,
  FP_CAMERA_FOV,
  updateFirstPersonCombatCamera,
} from "./FirstPersonCombatPresentation";
import {
  bmsDirectionToFirstPersonYaw,
  firstPersonYawToBmsDirection,
} from "./BmsDirectionResolver";
import type { HeroBmsDirection } from "./TwoDParitySpriteFactory";

type TopDownCameraPreset = "safe" | "cinematic";

export type CameraSystemConfig = {
  scene: Scene;
  canvas: HTMLCanvasElement;
  getPlayerPosition: () => Vector3;
  getHeroDirection: () => HeroBmsDirection;
  setHeroDirection: (dir: HeroBmsDirection) => void;
  getIsGameplayPaused: () => boolean;
  getCurrentLevel: () => string;
  parseLevelNumber: (level: string) => number;
  onCameraModeChanged: (firstPerson: boolean) => void;
  FIRST_PERSON_EYE_ABOVE_FEET: number;
};

export class CameraSystem {
  private cfg: CameraSystemConfig;
  readonly topDownCamera: ArcRotateCamera;
  readonly fpCamera: UniversalCamera;
  isFirstPerson = false;
  activeTopDownCameraPreset: TopDownCameraPreset = "safe";

  private fpCombatCameraState: FirstPersonCombatCameraState;
  private fpCaptureSuspendedForMenu = false;
  private topDownCaptureSuspendedForMenu = false;

  // Injected after construction (cyclic dependencies)
  setEnemyScalesDefault: (() => void) | null = null;
  heroBillboard: { setEnabled: (v: boolean) => void } | null = null;
  heroShadow: { setEnabled: (v: boolean) => void } | null = null;
  chunkClearAll: (() => void) | null = null;
  chunkTick: ((dt: number) => void) | null = null;
  invalidateVerticalVisibilityCache: (() => void) | null = null;
  getSelectedEnemyUid: (() => string | null) | null = null;
  getEnemyWorldPos: ((uid: string) => Vector3 | null) | null = null;
  getIsEnemyDead: ((uid: string) => boolean) | null = null;

  constructor(config: CameraSystemConfig) {
    this.cfg = config;
    this.fpCombatCameraState = createFirstPersonCombatCameraState();

    this.topDownCamera = new ArcRotateCamera(
      "slice-camera",
      Math.PI / 2, 0.72, 9,
      new Vector3(0, 1.5, 0),
      config.scene,
    );
    this.applyTopDownCameraPreset("safe");
    this.topDownCamera.wheelPrecision = 1000000;
    this.topDownCamera.panningSensibility = 0;
    this.topDownCamera.attachControl(config.canvas, true);

    this.fpCamera = new UniversalCamera(
      "slice-fp-camera",
      new Vector3(6, 1.55, 6),
      config.scene,
    );
    this.fpCamera.minZ = 0.05;
    this.fpCamera.maxZ = 120;
    this.fpCamera.fov = FP_CAMERA_FOV;
    this.fpCamera.inertia = 0.05;
    this.fpCamera.angularSensibility = 800;
    this.fpCamera.speed = 0;
  }

  private applyTopDownCameraPreset(preset: TopDownCameraPreset): void {
    this.activeTopDownCameraPreset = preset;
    const cam = this.topDownCamera;
    if (preset === "safe") {
      cam.beta = 0.72; cam.radius = 9; cam.fov = 0.92; cam.maxZ = 52;
      cam.lowerRadiusLimit = 9; cam.upperRadiusLimit = 9;
      cam.lowerBetaLimit = 0.72; cam.upperBetaLimit = 0.72;
    } else {
      cam.beta = 0.56; cam.radius = 11; cam.fov = 1.05; cam.maxZ = 58;
      cam.lowerRadiusLimit = 11; cam.upperRadiusLimit = 11;
      cam.lowerBetaLimit = 0.56; cam.upperBetaLimit = 0.56;
    }
    cam.lowerAlphaLimit = Math.PI / 2;
    cam.upperAlphaLimit = Math.PI / 2;
  }

  cycleTopDownPreset(): void {
    this.applyTopDownCameraPreset(
      this.activeTopDownCameraPreset === "safe" ? "cinematic" : "safe",
    );
  }

  setMode(firstPerson: boolean, shouldRequestPointerLock = false): void {
    const cfg = this.cfg;
    this.isFirstPerson = firstPerson;

    if (!firstPerson) {
      this.fpCombatCameraState = createFirstPersonCombatCameraState();
      this.fpCamera.fov = FP_CAMERA_FOV;
      this.setEnemyScalesDefault?.();
    }

    if (cfg.parseLevelNumber(cfg.getCurrentLevel()) < 0) {
      this.chunkClearAll?.();
      this.invalidateVerticalVisibilityCache?.();
      this.chunkTick?.(0.2);
    }

    cfg.onCameraModeChanged(firstPerson);

    if (firstPerson) {
      this.heroBillboard?.setEnabled(false);
      this.topDownCamera.detachControl();
      const pos = cfg.getPlayerPosition();
      this.fpCamera.position.set(pos.x, pos.y + cfg.FIRST_PERSON_EYE_ABOVE_FEET, pos.z);
      this.fpCamera.rotation.y = bmsDirectionToFirstPersonYaw(cfg.getHeroDirection());
      cfg.scene.activeCamera = this.fpCamera;
      this.topDownCaptureSuspendedForMenu = false;
      if (cfg.getIsGameplayPaused()) {
        this.fpCaptureSuspendedForMenu = true;
      } else {
        this.fpCaptureSuspendedForMenu = false;
        this.fpCamera.attachControl(cfg.canvas, true);
      }
      return;
    }

    this.fpCamera.detachControl();
    document.exitPointerLock?.();
    this.heroBillboard?.setEnabled(true);
    cfg.setHeroDirection(
      firstPersonYawToBmsDirection(this.fpCamera.rotation.y, cfg.getHeroDirection()),
    );
    cfg.scene.activeCamera = this.topDownCamera;
    this.fpCaptureSuspendedForMenu = false;
    if (cfg.getIsGameplayPaused()) {
      this.topDownCaptureSuspendedForMenu = true;
    } else {
      this.topDownCaptureSuspendedForMenu = false;
      this.topDownCamera.attachControl(cfg.canvas, true);
    }
  }

  suspend(): void {
    if (this.isFirstPerson) {
      document.exitPointerLock?.();
      this.fpCamera.detachControl();
      this.fpCaptureSuspendedForMenu = true;
      this.topDownCaptureSuspendedForMenu = false;
      return;
    }
    this.topDownCamera.detachControl();
    this.topDownCaptureSuspendedForMenu = true;
    this.fpCaptureSuspendedForMenu = false;
  }

  resume(): void {
    if (this.isFirstPerson && this.fpCaptureSuspendedForMenu) {
      this.fpCaptureSuspendedForMenu = false;
      this.cfg.scene.activeCamera = this.fpCamera;
      this.fpCamera.attachControl(this.cfg.canvas, true);
      return;
    }
    if (!this.isFirstPerson && this.topDownCaptureSuspendedForMenu) {
      this.topDownCaptureSuspendedForMenu = false;
      this.cfg.scene.activeCamera = this.topDownCamera;
      this.topDownCamera.attachControl(this.cfg.canvas, true);
    }
  }

  updateCombatCamera(deltaSeconds: number): void {
    const cfg = this.cfg;
    if (!this.isFirstPerson) return;

    let combatTargetPos: Vector3 | null = null;
    const uid = this.getSelectedEnemyUid?.();
    if (uid) {
      const focused = this.getEnemyWorldPos?.(uid);
      if (focused && !this.getIsEnemyDead?.(uid)) {
        combatTargetPos = focused;
      }
    }

    const result = updateFirstPersonCombatCamera(
      this.fpCamera.rotation.y,
      cfg.getPlayerPosition(),
      cfg.FIRST_PERSON_EYE_ABOVE_FEET,
      combatTargetPos,
      deltaSeconds,
      this.fpCombatCameraState,
    );

    this.fpCombatCameraState = result.state;
    this.fpCamera.position.copyFrom(result.position);
    this.fpCamera.fov = result.fov;
  }

  updateTopDownTarget(pos: Vector3): void {
    if (this.isFirstPerson) return;
    this.topDownCamera.setTarget(pos);
  }
}
