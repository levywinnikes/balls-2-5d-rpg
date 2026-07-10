import { Vector3 } from "@babylonjs/core";
import type { GameContext } from "./GameContext";
import type { SliceEnemy } from "./EnemyStreamSystem";
import { PathfindingManager } from "../../game/systems/PathfindingManager";
import { worldToGrid, clamp } from "./SliceRuntimeUtils";

const LOG_SLOW_PATH_MS = 100;

export interface EnemyPathfindingConfig {
  ctx: GameContext;
  pathfindingManager: PathfindingManager;
  applyActorAquaticY: (worldPos: Vector3, level: string) => void;
}

export function requestEnemyPath(
  cfg: EnemyPathfindingConfig,
  enemy: SliceEnemy,
  targetPosition: Vector3,
): Promise<void> {
  const { ctx, pathfindingManager } = cfg;
  const pathRequestStartedAt = performance.now();

  ctx.telemetryLogger.pathMetrics.requests += 1;

  const startX = worldToGrid(enemy.worldPos.x, 0);
  const startY = worldToGrid(enemy.worldPos.z, 0);
  const endX = worldToGrid(targetPosition.x, 0);
  const endY = worldToGrid(targetPosition.z, 0);

  return pathfindingManager.requestPath(startX, startY, endX, endY).then((path) => {
    const elapsedMs = performance.now() - pathRequestStartedAt;

    if (path !== null) {
      enemy.currentPath = path;
      enemy.currentPathIndex = 0;
      ctx.telemetryLogger.pathMetrics.success += 1;
    } else {
      ctx.telemetryLogger.pathMetrics.failed += 1;
    }

    ctx.telemetryLogger.pathMetrics.totalMs += elapsedMs;
    ctx.telemetryLogger.pathMetrics.maxMs = Math.max(ctx.telemetryLogger.pathMetrics.maxMs, elapsedMs);
    ctx.telemetryLogger.pathMetrics.lastMs = elapsedMs;
    ctx.telemetryLogger.pathMetrics.lastPathLen = path?.length ?? 0;

    if (elapsedMs > LOG_SLOW_PATH_MS) {
      ctx.telemetryLogger.pushLogEvent("pathfinding.slow", {
        enemy: enemy.enemyType,
        ms: Math.round(elapsedMs),
        pathFound: path !== null,
        from: `${startX},${startY}`,
        to: `${endX},${endY}`,
      });
    }
  });
}

export function advanceEnemyPath(
  cfg: EnemyPathfindingConfig,
  enemy: SliceEnemy,
  deltaSeconds: number,
): void {
  const { ctx, applyActorAquaticY } = cfg;
  if (!enemy.currentPath.length || enemy.currentPathIndex >= enemy.currentPath.length) return;

  const waypoint = enemy.currentPath[enemy.currentPathIndex];
  const target = new Vector3(
    ctx.navigationSystem.gridToWorldX(waypoint.x),
    enemy.worldPos.y,
    ctx.navigationSystem.gridToWorldZ(waypoint.y),
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
  enemy.worldPos.x = clamp(enemy.worldPos.x, ctx.mapMinX + 0.5, ctx.mapMaxX);
  enemy.worldPos.z = clamp(enemy.worldPos.z, ctx.mapMinZ + 0.5, ctx.mapMaxZ);
  applyActorAquaticY(enemy.worldPos, enemy.level);
  enemy.meshRoot.position = enemy.worldPos;
}
