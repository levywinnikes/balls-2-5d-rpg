import { Vector3, Camera } from "@babylonjs/core";
import { resolveBmsDirectionFromWorldDelta } from "./BmsDirectionResolver";
import { SliceSceneContext } from "./SliceSceneContext";
import { SliceEnemy } from "./EnemyStreamSystem";
import { HeroBmsDirection, resolveHeroBmsDirection } from "./TwoDParitySpriteFactory";
import { applyEnemyAnimLod, setEnemyVisualAnimState, setEnemyVisualDirection, type EnemyVisualAnimState, type EnemyVisualRoot } from "./ThreeDEnemyVisualRegistry";
import { getFirstPersonEnemyProximityScale } from "./FirstPersonCombatPresentation";
import { LEVEL_HEIGHT } from "../../constants/World";

export interface SliceEnemySystemConfig {
  ctx: SliceSceneContext;
  applyEnemyAttackToPlayer: (enemy: SliceEnemy, now: number) => void;
  tryEnemyMagicAttack: (enemy: SliceEnemy, now: number) => boolean;
  requestEnemyPath: (enemy: SliceEnemy, targetPos: Vector3) => Promise<void>;
  advanceEnemyPath: (enemy: SliceEnemy, deltaSeconds: number) => void;
  applyActorAquaticY: (worldPos: Vector3, level: string) => void;
  getAquaticSampleAt: (x: number, z: number, level: string) => any;
  levelToWorldY: (level: string) => number;
  getCurrentLevel: () => string;
  hasLineOfSight: (origin: Vector3, target: Vector3) => boolean;
  setSelectedEnemy: (uid: string | null) => void;
  getSelectedEnemy: () => string | null;
}

const ENEMY_VISIBILITY_RADIUS_UNITS = 26;
const ENEMY_AI_RADIUS_UNITS = 18;

export class SliceEnemySystem {
  private config: SliceEnemySystemConfig;

  constructor(config: SliceEnemySystemConfig) {
    this.config = config;
  }

  public update(deltaSeconds: number): void {
    const now = Date.now();
    const { ctx } = this.config;

    ctx.enemies.forEach((enemy) => {
      // Treat enemy as "on current level" when within LEVEL_HEIGHT vertically (Y-based)
      const onActiveLevel = Math.abs(this.config.levelToWorldY(enemy.level) - this.config.levelToWorldY(this.config.getCurrentLevel())) <= LEVEL_HEIGHT;
      if (!onActiveLevel) {
        enemy.meshRoot.setEnabled(false);
        if (this.config.getSelectedEnemy() === enemy.uid) {
          this.config.setSelectedEnemy(null);
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
        ctx.player.position,
      );
      const enemyVisible = distanceToPlayer <= ENEMY_VISIBILITY_RADIUS_UNITS;
      enemy.meshRoot.setEnabled(enemyVisible);
      applyEnemyAnimLod(enemy.meshRoot, distanceToPlayer, enemyVisible);

      if (ctx.isFirstPerson && enemyVisible) {
        const fpScale = getFirstPersonEnemyProximityScale(distanceToPlayer);
        enemy.meshRoot.scaling.set(fpScale, fpScale, fpScale);
      } else if (enemy.meshRoot.scaling.x !== 1) {
        enemy.meshRoot.scaling.set(1, 1, 1);
      }

      if (!enemyVisible && this.config.getSelectedEnemy() === enemy.uid) {
        this.config.setSelectedEnemy(null);
      }

      if (distanceToPlayer > ENEMY_AI_RADIUS_UNITS) {
        this.setEnemyAnimState(enemy, "idle");
        enemy.currentPath = [];
        enemy.meshRoot.position = enemy.worldPos; // Ensure base position is applied
        return;
      }

      // Perform resource-heavy operations only when within AI range (active AI)
      this.config.applyActorAquaticY(enemy.worldPos, enemy.level);
      enemy.meshRoot.position = enemy.worldPos;
      const enemyAquatic = this.config.getAquaticSampleAt(
        enemy.worldPos.x,
        enemy.worldPos.z,
        enemy.level,
      );
      const enemyAquaticTint = (enemy.meshRoot as EnemyVisualRoot)._aquaticTint;
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
        ? this.config.tryEnemyMagicAttack(enemy, now)
        : false;

      if (didCastMagic) {
        enemy.currentPath = [];
        return;
      }

      if (
        currentlyChasing &&
        distanceToPlayer <= attackRangeUnits &&
        this.config.hasLineOfSight(enemy.worldPos, ctx.player.position)
      ) {
        enemy.currentPath = [];
        this.faceEnemyToward(
          enemy,
          ctx.player.position.x,
          ctx.player.position.z,
        );
        this.config.applyEnemyAttackToPlayer(enemy, now);
        if (now >= enemy.animLockedUntil && enemy.animState === "attack") {
          this.setEnemyAnimState(enemy, "idle");
        }
        return;
      }

      const targetPos = currentlyChasing ? ctx.player.position : enemy.spawnPos;
      const prevX = enemy.worldPos.x;
      const prevZ = enemy.worldPos.z;

      if (now - enemy.lastPathAt > 1000) {
        // Skip pathfinding when the enemy is already at (or within 0.8 units of)
        // its target — prevents hammering the pathfinder with trivially empty paths.
        const distToTarget = Vector3.Distance(enemy.worldPos, targetPos);
        if (distToTarget >= 0.8) {
          enemy.lastPathAt = now;
          void this.config.requestEnemyPath(enemy, targetPos);
        }
      }

      this.config.advanceEnemyPath(enemy, deltaSeconds);
      const movedSq =
        (enemy.worldPos.x - prevX) * (enemy.worldPos.x - prevX) +
        (enemy.worldPos.z - prevZ) * (enemy.worldPos.z - prevZ);

      if (currentlyChasing) {
        this.faceEnemyToward(
          enemy,
          ctx.player.position.x,
          ctx.player.position.z,
        );
      } else if (movedSq > 0.0001) {
        this.setEnemyDirection(
          enemy,
          this.resolveEnemyBmsDirection(
            enemy,
            enemy.worldPos.x - prevX,
            enemy.worldPos.z - prevZ,
          ),
        );
      }

      if (movedSq > 0.0001) {
        this.setEnemyAnimState(enemy, "walk");
      } else {
        this.setEnemyAnimState(enemy, "idle");
      }

      if (
        !currentlyChasing &&
        Vector3.Distance(enemy.worldPos, enemy.spawnPos) < 0.4
      ) {
        enemy.currentPath = [];
      }
    });
  }

  private setEnemyDirection(enemy: SliceEnemy, direction: HeroBmsDirection): void {
    if (enemy.animDirection === direction) {
      return;
    }
    enemy.animDirection = direction;
    setEnemyVisualDirection(enemy.meshRoot, direction);
  }

  private setEnemyAnimState(
    enemy: SliceEnemy,
    nextState: EnemyVisualAnimState,
    lockMs = 0,
  ): void {
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
  }

  private faceEnemyToward(
    enemy: SliceEnemy,
    targetX: number,
    targetZ: number,
  ): void {
    if (enemy.isDead) {
      return;
    }
    const dx = targetX - enemy.worldPos.x;
    const dz = targetZ - enemy.worldPos.z;
    if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001) {
      return;
    }
    this.setEnemyDirection(enemy, this.resolveEnemyBmsDirection(enemy, dx, dz));
  }

  private resolveEnemyBmsDirection(
    enemy: SliceEnemy,
    deltaX: number,
    deltaZ: number,
  ): HeroBmsDirection {
    const { ctx } = this.config;
    const activeCamera = ctx.scene.activeCamera ?? ctx.camera;
    return resolveBmsDirectionFromWorldDelta(
      deltaX,
      deltaZ,
      enemy.animDirection,
      {
        scene: ctx.scene,
        camera: activeCamera as Camera,
        origin: enemy.worldPos,
      }
    );
  }
}
