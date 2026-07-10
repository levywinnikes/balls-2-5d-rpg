import { Vector3 } from "@babylonjs/core";

export interface InteractableRevealTarget {
  worldPos: Vector3;
  boundsMin: Vector3;
  boundsMax: Vector3;
  pickProxyMode: "door" | "enemy";
  pickProxyUid: string;
  pickProxyNode?: any;
}

export function collectInteractableRevealTargets(
  deps: {
    enemies: Map<string, any>;
    doorSystem: { doors: Map<string, any> };
    player: { position: { x: number; y: number; z: number } };
    getCurrentLevel: () => string;
    levelToWorldY: (level: string | number) => number;
    LEVEL_HEIGHT: number;
    WALK_SURFACE: number;
    WALL_REVEAL_TARGET_RADIUS_UNITS: number;
  },
): InteractableRevealTarget[] {
  const { enemies, doorSystem, player, getCurrentLevel, levelToWorldY, LEVEL_HEIGHT, WALK_SURFACE, WALL_REVEAL_TARGET_RADIUS_UNITS } = deps;
  const targets: InteractableRevealTarget[] = [];
  const currentLevel = getCurrentLevel();
  const px = player.position.x;
  const pz = player.position.z;
  const radius = WALL_REVEAL_TARGET_RADIUS_UNITS;

  enemies.forEach((enemy) => {
    if (enemy.isDead) return;
    if (enemy.level !== currentLevel) return;
    const dx = enemy.worldPos.x - px;
    const dz = enemy.worldPos.z - pz;
    if (dx * dx + dz * dz > radius * radius) return;
    const baseY = levelToWorldY(currentLevel);
    const h = LEVEL_HEIGHT;
    targets.push({
      worldPos: enemy.worldPos.clone(),
      boundsMin: new Vector3(enemy.worldPos.x - 0.4, baseY + WALK_SURFACE, enemy.worldPos.z - 0.4),
      boundsMax: new Vector3(enemy.worldPos.x + 0.4, baseY + h, enemy.worldPos.z + 0.4),
      pickProxyMode: "enemy",
      pickProxyUid: enemy.uid,
      pickProxyNode: enemy.meshRoot,
    });
  });

  doorSystem.doors.forEach((door) => {
    if (door.level !== currentLevel) return;
    const dx = door.worldPos.x - px;
    const dz = door.worldPos.z - pz;
    if (dx * dx + dz * dz > radius * radius) return;
    const baseY = levelToWorldY(currentLevel);
    const h = LEVEL_HEIGHT;
    targets.push({
      worldPos: door.worldPos.clone(),
      boundsMin: new Vector3(door.worldPos.x - 0.5, baseY + WALK_SURFACE, door.worldPos.z - 0.5),
      boundsMax: new Vector3(door.worldPos.x + 0.5, baseY + h, door.worldPos.z + 0.5),
      pickProxyMode: "door",
      pickProxyUid: door.uid,
    });
  });

  return targets;
}
