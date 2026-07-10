import type { Scene, Engine, ArcRotateCamera, UniversalCamera, Mesh, StandardMaterial, TransformNode, DynamicTexture } from "@babylonjs/core";
import { Vector3, Matrix, Vector2 } from "@babylonjs/core";
import type { HeroSpriteMaterial } from "./TwoDParitySpriteFactory";
import type { SliceEnemy } from "./EnemyStreamSystem";
import type { InteractableRevealTarget } from "./InteractableWallRevealSystem";
import type { ChunkStreamSystem } from "./ChunkStreamSystem";
import type { StreamOrchestrator } from "./StreamOrchestrator";
import type { NavigationSystem } from "./NavigationSystem";
import type { CameraSystem } from "./CameraSystem";
import type { QualitySystem } from "./QualitySystem";
import type { DoorSystem } from "./DoorSystem";
import type { PropStreamSystem } from "./PropStreamSystem";
import type { DropStreamSystem } from "./DropStreamSystem";
import type { EnemyStreamSystem, SpawnCatalogEntry } from "./EnemyStreamSystem";
import type { PlayerState } from "../../game/entities/Player/PlayerState";
import type { Projectile3DSystem } from "./Projectile3DSystem";
import type { InteractableWallRevealSystem } from "./InteractableWallRevealSystem";
import type { WaterEffectSystem } from "./WaterEffectSystem";
import type { SliceCombatSystem } from "./SliceCombatSystem";
import type { CollisionWorld } from "./CollisionWorld";
import type { SliceInputManager } from "./SliceInputManager";
import type { AquaticShaderHandle } from "./AquaticSpriteShader";
import type { SaveSystem } from "../../core/systems/SaveSystem";
import type { PlayerContext } from "./PlayerContext";
import { tickPhysics } from "./PlayerPhysicsSystem";
import type { AquaticSample } from "./WaterProfile";
import type { SliceMapData } from "./SliceTileTypes";
import type { Slice3DSessionLog, Slice3DLogSample } from "./createDebugSliceScene";
import type { GameContext } from "./GameContext";
import "./WaterHoleConfig";
import "./FallSafetySystem";

const parseLevelNumber = (level: string) => Number.parseInt(level, 10) || 0;

const CHUNK_SIZE = 16;
const CHUNK_UPDATE_INTERVAL = 0.2;
const ENEMY_VISIBILITY_RADIUS_UNITS = 26;
const ENEMY_AI_RADIUS_UNITS = 18;
const LEVEL_HEIGHT = 4;
const PERF_PUBLISH_INTERVAL = 0.25;
const LOG_SAMPLE_INTERVAL = 2.5;
const LOG_PERSIST_INTERVAL = 12;
const LOG_MAX_SAMPLES = 36000;
const LOG_FRAME_WINDOW_MAX = 120;
const LOG_PATH_WINDOW_MAX = 120;
const LOG_HEAP_WINDOW_SECONDS = 300;
const LOG_UNLOAD_RECOVERY_GRACE_SECONDS = 25;
const LOG_FILE_FLUSH_INTERVAL = 10;
const AUTO_SAVE_INTERVAL = 60;
const WALK_SURFACE = 0.01;

export interface TelemetryData {
  previousHeapUsedMb: number | undefined;
  frameMsWindow: number[];
  pathMsWindow: number[];
  heapHistory: Array<{ elapsedSec: number; usedMb: number }>;
  chunkHotspots: Map<string, {
    level: string; chunkX: number; chunkZ: number; samples: number;
    frameMsAcc: number; drawCallsAcc: number; activeMeshesAcc: number;
    verticesAcc: number; maxHeapUsedMb: number; maxPathMs: number;
  }>;
  unloadCheckpoints: Array<{
    atSec: number; heapMb: number; resolved: boolean; succeeded: boolean;
  }>;
  chunkUnloadRecoveryFailures: number;
  pathMetrics: {
    requests: number; success: number; failed: number; errors: number;
    totalMs: number; maxMs: number; lastMs: number; lastPathLen: number; inFlight: number;
  };
}

export interface RenderSystemDeps {
  ctx: GameContext;

  heroShadowMat: StandardMaterial;
  heroAquaticTint: AquaticShaderHandle;
  lastPlayerAquaticMode: { mode: AquaticSample["mode"] };
  activeSlashtrails: Array<{
    mesh: Mesh;
    material: StandardMaterial;
    texture: DynamicTexture;
    elapsed: number;
    duration: number;
    startScale: number;
    endScale: number;
  }>;
  enemySpawnCatalog: Map<string, SpawnCatalogEntry>;

  syncVerticalLevelVisibility: (dt: number) => void;
  hideWallsOnRay: () => void;
  updatePlayerDebugMesh: () => void;
  collectInteractableRevealTargets: () => InteractableRevealTarget[];
}

export class RenderSystem {
  private deps: RenderSystemDeps;
  fpsTargetMinFrameMs = 0;
  private lastRenderAt = 0;
  private perfPublishTimer = 0;
  private telemetryLogTimer = 0;
  private telemetryPersistTimer = 0;
  private telemetryFileFlushTimer = 0;
  private autoSaveTimer = 0;
  private enemyHighlightPulseT = 0;
  private lastFocusedCombatHealthSyncAt = 0;
  constructor(deps: RenderSystemDeps) {
    this.deps = deps;
  }

  attach(): void {
    const s = this.deps.ctx.scene;
    const e = this.deps.ctx.engine;

    s.onBeforeRenderObservable.add(() => this.tick());
    s.onBeforeRenderObservable.add(() => this.tickAutoSave());
    e.runRenderLoop(() => this.runRenderLoop());
  }

  /** Monolith may move player mesh / mirror vars outside tickPhysics — sync before sim. */
  private syncPlayerCtxFromScene(): void {
    const { playerCtx, player } = this.deps.ctx;
    playerCtx.position.x = player.position.x;
    playerCtx.position.y = player.position.y;
    playerCtx.position.z = player.position.z;
  }

  private tick(): void {
    const {
      ctx,
      heroShadowMat, heroAquaticTint, lastPlayerAquaticMode,
      activeSlashtrails, enemySpawnCatalog,
      syncVerticalLevelVisibility, hideWallsOnRay,
      updatePlayerDebugMesh, collectInteractableRevealTargets,
    } = this.deps;

    const {
      scene, engine, camera, firstPersonCamera,
      chunkSystem, orchestrator, navigationSystem, cameraSystem,
      qualitySystem, doorSystem, propSystem, dropSystem, enemySystem,
      playerState, projectileSystem, wallRevealSystem, waterEffectSystem,
      sliceCombatSystem, collisionWorld, inputManager,
      player, playerCtx, heroSpriteMat, heroBillboard, heroShadow,
      audioManager, enemies,
      getCurrentLevel, getRenderLevel, getMapTileAt,
      setHeroDirection, setHeroAnimState,
      resolveHeroBmsDirection, setSelectedEnemy, finishAirborneLanding,
      isPlayerOverVoidAtLevel, getGroundSurfaceY, syncLevelSideEffects,
      updateEnemyAI,
      applyActiveLevelChange, applyEnemyTargetVisual,
      restoreEnemyTargetVisual, getAquaticSampleAt,
      findFirstBlockingTileOnWorldLine, isTileBlockedForGameplay,
    } = ctx;

    if (ctx.gameplayPaused) return;
    if (ctx.isPlayerDeathSequenceActive) return;

    const deltaSeconds = engine.getDeltaTime() / 1000;

    if (!ctx.worldBootstrapReady) {
      chunkSystem.tick(deltaSeconds);
      return;
    }

    const tFrameStart = performance.now();
    let mapTimeAccum = 0;
    let enemyTimeAccum = 0;
    let physicsTimeAccum = 0;

    let tStart = tFrameStart;

    ctx.checkLevelDrift();
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

    playerState.update(performance.now(), engine.getDeltaTime());

    chunkSystem.tick(deltaSeconds);

    const chunkStats = (window as any).__slice3dChunkStreaming || {};
    const unloadedThisTick = chunkStats.unloadedThisTick || 0;
    if (unloadedThisTick > 0 && this.deps.ctx.telemetryLogger.previousHeapUsedMb !== undefined) {
      this.deps.ctx.telemetryLogger.unloadCheckpoints.push({
        atSec: this.deps.ctx.telemetryLogger.getElapsedSec(),
        heapMb: this.deps.ctx.telemetryLogger.previousHeapUsedMb,
        resolved: false,
        succeeded: false,
      });
      if (this.deps.ctx.telemetryLogger.unloadCheckpoints.length > 100) {
        this.deps.ctx.telemetryLogger.unloadCheckpoints.shift();
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
    if (nowMs >= ctx.heroAnimLockedUntil) {
      if (isMoving) {
        setHeroDirection(
          resolveHeroBmsDirection(moveForward, moveRight, "south"),
        );
        setHeroAnimState("walk");
      } else {
        setHeroAnimState("idle");
      }
    }

    // ── Physics tick ───────────────────────────────────────────────────────
    {
      this.syncPlayerCtxFromScene();

      let worldDx = 0;
      let worldDz = 0;
      if (isMoving) {
        let movement = Vector3.Zero();
        if (ctx.isFirstPerson) {
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

      playerCtx.isFallSafetyEnabled = playerState.isFallSafetyEnabled();

      const physicsInput = {
        moveX: worldDx,
        moveZ: worldDz,
        deltaSeconds,
        jumpPressed: inputManager.consumeJumpRequested(),
        sprintHeld: inputManager.isKeyPressed("shift"),
        speedMultiplier: aquaticSample.speedMultiplier,
      };

      tickPhysics(playerCtx, physicsInput, collisionWorld, {
        getMapTileAt,
        getTileDef: (symbol: string | null) => {
          const mapData = this.deps.ctx.mapDataCache;
          return symbol ? mapData?.tileDefinitions?.[symbol] : undefined;
        },
        hasLevel: (level: string) =>
          Boolean(this.deps.ctx.mapDataCache?.levels?.[level]),
        allLevels: () =>
          Object.keys(this.deps.ctx.mapDataCache?.levels ?? {}),
        getMapWidth: () => this.deps.ctx.currentMapWidth,
        getMapHeight: () => this.deps.ctx.currentMapHeight,
        parseLevelNumber,
      }, {
        onFallSafetyActive: () => {
          playerState.emit("uiNotification", {
            type: "warning",
            message: "fall_safety_active",
          });
        },
        onHoleTransition: (_fromLevel: string, toLevel: string, transition: { tileX: number; tileZ: number; landingLocalZ: number; guardMs: number }) => {
          applyActiveLevelChange(toLevel, transition);
        },
        onNaturalLevelTransition: (toLevel: string) => {
          applyActiveLevelChange(toLevel, undefined, { natural: true });
        },
        onGrounded: (_ctx: PlayerContext, impactSpeed: number) => {
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

      player.position.x = playerCtx.position.x;
      player.position.y = playerCtx.position.y;
      player.position.z = playerCtx.position.z;
    }
    physicsTimeAccum += performance.now() - tStart;

    const consumeFootstep = (heroSpriteMat as any)._consumeFootstepTick;
    if (typeof consumeFootstep === "function" && consumeFootstep()) {
      audioManager.playFootstep("floor", true);
    }

    physicsTimeAccum += performance.now() - tStart;

    tStart = performance.now();
    updateEnemyAI(deltaSeconds);
    enemyTimeAccum += performance.now() - tStart;

    tStart = performance.now();
    if (!ctx.gameplayPaused) {
      projectileSystem.update(deltaSeconds);
    }
    sliceCombatSystem.tryAutoPlayerAttack(Date.now());
    physicsTimeAccum += performance.now() - tStart;

    this.perfPublishTimer += deltaSeconds;
    if (this.perfPublishTimer >= PERF_PUBLISH_INTERVAL) {
      this.perfPublishTimer = 0;

      const drawCalls = this.deps.ctx.sceneInstrumentation.drawCallsCounter.current;
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
          (e) => !e.isDead && Math.abs(Number(e.level) - parseLevelNumber(getCurrentLevel())) <= 1 && Vector3.Distance(e.worldPos, player.position) <= ENEMY_AI_RADIUS_UNITS,
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
        topDownDrawRadiusChunks: qualitySystem.topDownDrawRadiusChunks,
        enemyStreamRadiusUnits: enemySystem.enemyStreamRadiusUnits,
        propStreamRadiusUnits: propSystem.propStreamRadiusUnits,
        ts: Date.now(),
      };
      (window as any).__slice3dPerf = (window as any).__slice3dPerfDiagnostics;
    }

    this.telemetryLogTimer += deltaSeconds;
    this.telemetryPersistTimer += deltaSeconds;
    if (ctx.telemetryEnabledRef.value && this.telemetryLogTimer >= LOG_SAMPLE_INTERVAL) {
      this.telemetryLogTimer = 0;

      const chunkStats = (window as any).__slice3dChunkStreaming || {};
      const perfMem = (performance as any).memory;
      const usedHeapMb = perfMem
        ? Math.round((perfMem.usedJSHeapSize / (1024 * 1024)) * 10) / 10
        : undefined;
      const totalHeapMb = perfMem
        ? Math.round((perfMem.totalJSHeapSize / (1024 * 1024)) * 10) / 10
        : undefined;
      const heapDeltaMb =
        usedHeapMb !== undefined && this.deps.ctx.telemetryLogger.previousHeapUsedMb !== undefined
          ? Math.round((usedHeapMb - this.deps.ctx.telemetryLogger.previousHeapUsedMb) * 10) / 10
          : undefined;
      this.deps.ctx.telemetryLogger.previousHeapUsedMb = usedHeapMb;

      const drawCalls = this.deps.ctx.sceneInstrumentation.drawCallsCounter.current;

      let activeEnemies = 0;
      let visibleEnemies = 0;
      let aiActiveEnemies = 0;
      enemies.forEach((enemy: any) => {
        if (enemy.isDead || Math.abs(parseLevelNumber(enemy.level) - parseLevelNumber(getCurrentLevel())) > 1) return;
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
        elapsedSec: this.deps.ctx.telemetryLogger.getElapsedSec(),
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
          selectedEnemyUid: ctx.selectedEnemyUid,
        },
        items: {
          streamedDroppedItems: dropSystem.droppedItemMeshes.size,
          hasRealDroppedItems: dropSystem.hasRealDroppedItems,
        },
        pathfinding: {
          requests: this.deps.ctx.telemetryLogger.pathMetrics.requests,
          success: this.deps.ctx.telemetryLogger.pathMetrics.success,
          failed: this.deps.ctx.telemetryLogger.pathMetrics.failed,
          errors: this.deps.ctx.telemetryLogger.pathMetrics.errors,
          inFlight: this.deps.ctx.telemetryLogger.pathMetrics.inFlight,
          avgMs:
            this.deps.ctx.telemetryLogger.pathMetrics.requests > 0
              ? Math.round((this.deps.ctx.telemetryLogger.pathMetrics.totalMs / this.deps.ctx.telemetryLogger.pathMetrics.requests) * 100) / 100
              : 0,
          maxMs: Math.round(this.deps.ctx.telemetryLogger.pathMetrics.maxMs * 100) / 100,
          lastMs: this.deps.ctx.telemetryLogger.pathMetrics.lastMs,
          lastPathLen: this.deps.ctx.telemetryLogger.pathMetrics.lastPathLen,
        },
      };

      if (this.deps.ctx.telemetryLogger.runtimeLog.samples.length >= LOG_MAX_SAMPLES) {
        this.deps.ctx.telemetryLogger.runtimeLog.samples.shift();
        this.deps.ctx.telemetryLogger.runtimeLog.counters.samplesDropped += 1;
      }
      this.deps.ctx.telemetryLogger.runtimeLog.samples.push(sample);

      this.deps.ctx.telemetryLogger.pushBounded(this.deps.ctx.telemetryLogger.frameMsWindow, sample.perf.frameMs, LOG_FRAME_WINDOW_MAX);
      if (sample.pathfinding.lastMs > 0) {
        this.deps.ctx.telemetryLogger.pushBounded(
          this.deps.ctx.telemetryLogger.pathMsWindow,
          sample.pathfinding.lastMs,
          LOG_PATH_WINDOW_MAX,
        );
      }

      if (sample.perf.jsHeapUsedMb !== undefined) {
        this.deps.ctx.telemetryLogger.heapHistory.push({
          elapsedSec: sample.elapsedSec,
          usedMb: sample.perf.jsHeapUsedMb,
        });
        const cutoff = sample.elapsedSec - LOG_HEAP_WINDOW_SECONDS;
        while (this.deps.ctx.telemetryLogger.heapHistory.length && this.deps.ctx.telemetryLogger.heapHistory[0].elapsedSec < cutoff) {
          this.deps.ctx.telemetryLogger.heapHistory.shift();
        }

        this.deps.ctx.telemetryLogger.unloadCheckpoints.forEach((checkpoint) => {
          if (checkpoint.resolved) return;
          const elapsedSinceUnload = sample.elapsedSec - checkpoint.atSec;
          const droppedEnough = sample.perf.jsHeapUsedMb! <= checkpoint.heapMb - 1;
          if (droppedEnough) {
            checkpoint.resolved = true;
            checkpoint.succeeded = true;
            return;
          }
          if (elapsedSinceUnload >= LOG_UNLOAD_RECOVERY_GRACE_SECONDS) {
            checkpoint.resolved = true;
            checkpoint.succeeded = false;
            this.deps.ctx.telemetryLogger.chunkUnloadRecoveryFailures += 1;
            this.deps.ctx.telemetryLogger.pushLogEvent("memory.unload-recovery-failed", {
              atSec: checkpoint.atSec,
              baselineHeapMb: checkpoint.heapMb,
              currentHeapMb: sample.perf.jsHeapUsedMb,
              elapsedSec: Math.round(elapsedSinceUnload * 100) / 100,
            });
          }
        });
      }

      const chunkKey = `${sample.currentLevel}:${sample.player.chunkX}_${sample.player.chunkZ}`;
      const chunkEntry = this.deps.ctx.telemetryLogger.chunkHotspots.get(chunkKey) || {
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
      this.deps.ctx.telemetryLogger.chunkHotspots.set(chunkKey, chunkEntry);

      if ((sample.perf.heapDeltaMb || 0) <= -8) {
        this.deps.ctx.telemetryLogger.pushLogEvent("memory.gc-like-drop", {
          heapDeltaMb: sample.perf.heapDeltaMb,
          usedMb: sample.perf.jsHeapUsedMb,
        });
      }

      if (sample.chunks.pendingCandidates > 16) {
        this.deps.ctx.telemetryLogger.pushLogEvent("chunk.backlog", {
          pendingCandidates: sample.chunks.pendingCandidates,
          loaded: sample.chunks.loaded,
          loading: sample.chunks.loading,
        });
      }

      (window as any).__slice3dLogsData = {
        latestSample: sample,
        totalSamples: this.deps.ctx.telemetryLogger.runtimeLog.samples.length,
        totalEvents: this.deps.ctx.telemetryLogger.runtimeLog.events.length,
        counters: this.deps.ctx.telemetryLogger.runtimeLog.counters,
        summary: this.deps.ctx.telemetryLogger.buildSummary(),
        topHotspots: this.deps.ctx.telemetryLogger.buildHotspots(5),
      };
    }

    if (ctx.telemetryEnabledRef.value && this.telemetryPersistTimer >= LOG_PERSIST_INTERVAL) {
      this.telemetryPersistTimer = 0;
      this.deps.ctx.telemetryLogger.persistRuntimeLogs();
    }

    if (ctx.telemetryEnabledRef.value) {
      this.telemetryFileFlushTimer += deltaSeconds;
      if (this.telemetryFileFlushTimer >= LOG_FILE_FLUSH_INTERVAL) {
        this.telemetryFileFlushTimer = 0;
        void this.deps.ctx.telemetryLogger.flushRuntimeLogsToFile(false);
      }
    }

    this.enemyHighlightPulseT += deltaSeconds;
    if (ctx.selectedEnemyUid) {
      const selectedEnemy = enemies.get(ctx.selectedEnemyUid);
      if (!selectedEnemy || selectedEnemy.isDead) {
        setSelectedEnemy(null);
      } else {
        const pulse =
          (Math.sin(this.enemyHighlightPulseT * Math.PI * 1.8) * 0.5 + 0.5) * 0.22;
        applyEnemyTargetVisual(selectedEnemy.meshRoot, pulse, {
          current: selectedEnemy.health,
          max: selectedEnemy.maxHealth,
        });

        const nowMs = Date.now();
        if (nowMs - this.lastFocusedCombatHealthSyncAt >= 250) {
          this.lastFocusedCombatHealthSyncAt = nowMs;
          playerState.emit("combatEnemyHealthChanged", {
            uid: selectedEnemy.uid,
            health: selectedEnemy.health,
            maxHealth: selectedEnemy.maxHealth,
          });
        }
      }
    }

    if (ctx.isGrounded && !ctx.holeFallLandingLevel && !isPlayerOverVoidAtLevel(getCurrentLevel())) {
      syncLevelSideEffects();
    }

    const playerAquatic = getAquaticSampleAt(
      player.position.x,
      player.position.z,
      getCurrentLevel(),
    );
    heroAquaticTint.update(playerAquatic);
    if (playerAquatic.mode !== "dry" && this.deps.lastPlayerAquaticMode.mode === "dry") {
      audioManager.playSplash();
    }
    this.deps.lastPlayerAquaticMode.mode = playerAquatic.mode;
    const aquaticPreset = (playerAquatic as any).visualPreset;
    heroShadowMat.alpha = aquaticPreset
      ? 0.32 * aquaticPreset.shadowScale
      : 0.32;

    syncVerticalLevelVisibility(deltaSeconds);
    hideWallsOnRay();

    if (ctx.isFirstPerson) {
      heroBillboard.setEnabled(false);
      heroShadow.setEnabled(false);
      cameraSystem.updateCombatCamera(deltaSeconds);

      playerState.exploreArea(
        getRenderLevel(),
        Math.floor(player.position.x),
        Math.floor(player.position.z),
        8,
        this.deps.ctx.currentMapWidth,
        this.deps.ctx.currentMapHeight,
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
      (fromWorldX: number, fromWorldZ: number, toWorldX: number, toWorldZ: number) =>
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
      getGroundSurfaceY(player.position.x, player.position.z, getRenderLevel()) + 0.01,
      player.position.z,
    );

    camera.setTarget(new Vector3(player.position.x, player.position.y, player.position.z));

    const currentLevel = getCurrentLevel();
    playerState.exploreArea(
      currentLevel,
      Math.floor(player.position.x),
      Math.floor(player.position.z),
      8,
      this.deps.ctx.currentMapWidth,
      this.deps.ctx.currentMapHeight,
    );

    playerState.recordPlayerPosition(
      currentLevel,
      player.position.x * 32,
      player.position.z * 32,
    );

    updatePlayerDebugMesh();
  }

  private tickAutoSave(): void {
    const { engine, player, getCurrentLevel, saveSystem } = this.deps.ctx;
    this.autoSaveTimer += engine.getDeltaTime() / 1000;
    if (this.autoSaveTimer >= AUTO_SAVE_INTERVAL) {
      this.autoSaveTimer = 0;
      void saveSystem.saveGameDirect({
        map: this.deps.ctx.sliceMapName,
        currentLevel: getCurrentLevel(),
        playerPos: {
          x: Math.round(player.position.x * 32 * 100) / 100,
          y: Math.round(player.position.z * 32 * 100) / 100,
        },
        playerY: Math.round(player.position.y * 1000) / 1000,
      });
    }
  }

  private runRenderLoop(): void {
    if (this.fpsTargetMinFrameMs > 0) {
      const now = performance.now();
      if (now - this.lastRenderAt < this.fpsTargetMinFrameMs) return;
      this.lastRenderAt = now;
    }
    this.deps.ctx.scene.render();
  }

  setFpsTargetMinFrameMs(v: number): void {
    this.fpsTargetMinFrameMs = v;
  }
}
