import { Vector3 } from "@babylonjs/core";
import type { SliceEnemy } from "./EnemyStreamSystem";
import type { GameContext } from "./GameContext";
import { EnemyRegistry } from "../../game/entities/EnemyRegistry";

export function setSelectedEnemy(
  ctx: GameContext,
  enemyUid: string | null,
): void {
  if (enemyUid === null && ctx.selectedEnemyUid !== null) {
    const prev = ctx.enemies.get(ctx.selectedEnemyUid);
    if (prev && prev.meshRoot && !prev.isDead) {
      ctx.restoreEnemyTargetVisual(prev.meshRoot);
    }
    ctx.playerState.emit("combatFocusChanged", { uid: null });
    ctx.selectedEnemyUid = null;
    return;
  }

  if (enemyUid === null) {
    ctx.selectedEnemyUid = null;
    return;
  }

  if (ctx.selectedEnemyUid && ctx.selectedEnemyUid !== enemyUid) {
    const prev = ctx.enemies.get(ctx.selectedEnemyUid);
    if (prev && prev.meshRoot && !prev.isDead) {
      ctx.restoreEnemyTargetVisual(prev.meshRoot);
    }
  }

  const enemy = ctx.enemies.get(enemyUid);
  if (!enemy || enemy.isDead) return;

  ctx.selectedEnemyUid = enemyUid;
  ctx.playerState.emit("combatFocusChanged", { uid: enemyUid });
}

export function grantEnemyLoot(
  ctx: GameContext,
  enemy: SliceEnemy,
): void {
  const loot = EnemyRegistry.generateLoot(enemy.enemyType);
  loot.forEach((drop) => {
    ctx.playerState.addPersistentDroppedItem(ctx.getCurrentLevel(), {
      itemId: ctx.playerState.generateUID(),
      weaponId: drop.itemId,
      x: enemy.worldPos.x * 32,
      y: enemy.worldPos.z * 32,
      createdAt: Date.now(),
      count: drop.count || 1,
      stars: drop.stars || 0,
      attributes: [...(drop.attributes || [])],
    });
  });
}

export interface EnemyDeathDeps {
  ctx: GameContext;
  enemySpawnCatalog: Map<string, { level: string; spawn: any; index: number }>;
  pendingEnemyRespawns: Map<string, { level: string; spawn: any; index: number; elapsedMs: number; respawnTimeMs: number }>;
  ENEMY_RESPAWN_MS: number;
  emitBloodBurst: (origin: Vector3, colorHex: string, particleCount: number, spread: number, lifetimeSec: number) => void;
  setEnemyAnimState: (enemy: SliceEnemy, state: any, lockMs?: number) => void;
  getGeneratedDeathDurationMs: (enemyType: string) => number;
}

export function destroyEnemy(
  deps: EnemyDeathDeps,
  enemy: SliceEnemy,
  context?: { finishingDamage?: number; isFireKill?: boolean },
): void {
  const { ctx, enemySpawnCatalog, pendingEnemyRespawns, ENEMY_RESPAWN_MS, emitBloodBurst, setEnemyAnimState, getGeneratedDeathDurationMs } = deps;

  if (enemy.isDead) return;

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
        22, 1.6, 1.2,
      );
      ctx.audioManager.playSplash();
    } else if (!isFireKill) {
      emitBloodBurst(
        enemy.worldPos.clone().add(new Vector3(0, 0.25, 0)),
        "#7a1010",
        8, 0.45, 0.8,
      );
    }
  }

  enemy.isDead = true;
  setEnemyAnimState(enemy, "death", 60_000);

  const deathMs = getGeneratedDeathDurationMs(enemy.enemyType);
  window.setTimeout(() => {
    if (enemy.meshRoot.isDisposed()) return;
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
    setSelectedEnemy(ctx, null);
  }

  ctx.playerState.emit("combatEnemyRemoved", { uid: enemy.uid });

  grantEnemyLoot(ctx, enemy);
  ctx.playerState.gainExperience(enemy.definition.exp);

  ctx.playerState.emit("floatingText", {
    x: enemy.worldPos.x,
    y: enemy.worldPos.y,
    z: enemy.worldPos.z,
    message: enemy.definition.exp.toString(),
    icon: "\u2605",
    customColor: "#F6E05E",
    isAmbient: true,
  });

  ctx.playerState.log("combat_killed", { target: enemy.enemyType }, "#ffaa00");
  ctx.playerState.log("combat_gained_xp", { xp: enemy.definition.exp }, "#ffff00");
  ctx.audioManager.playEnemyDeath(enemy.enemyType);
}
