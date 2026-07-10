import { Vector3, Mesh } from "@babylonjs/core";
import type { InteractableRevealTarget } from "./InteractableWallRevealSystem";

export function collectInteractableRevealTargets(
  deps: {
    enemies: Map<string, any>;
    doorSystem: { doors: Map<string, any>; DOOR_PANEL_HEIGHT?: number };
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

  enemies.forEach((enemy) => {
    if (enemy.isDead || Math.abs(levelToWorldY(enemy.level) - levelToWorldY(getCurrentLevel())) > LEVEL_HEIGHT) return;
    const dx = enemy.worldPos.x - player.position.x;
    const dz = enemy.worldPos.z - player.position.z;
    if (dx * dx + dz * dz > WALL_REVEAL_TARGET_RADIUS_UNITS ** 2) return;
    const pickProxy = enemy.meshRoot
      .getChildMeshes()
      .find((mesh: Mesh) => mesh.name.endsWith("-pick-proxy")) as Mesh | undefined;
    const pickWidth = pickProxy?.getBoundingInfo().boundingBox.extendSize.x
      ? pickProxy.getBoundingInfo().boundingBox.extendSize.x * 2 : 1.2;
    const pickHeight = pickProxy?.getBoundingInfo().boundingBox.extendSize.y
      ? pickProxy.getBoundingInfo().boundingBox.extendSize.y * 2 : 1.15;
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

  doorSystem.doors.forEach((door: any) => {
    if (Math.abs(levelToWorldY(door.level) - levelToWorldY(getCurrentLevel())) > LEVEL_HEIGHT) return;
    const feetY = levelToWorldY(door.level);
    const doorHeight = doorSystem.DOOR_PANEL_HEIGHT ?? 1.5;
    targets.push({
      id: door.uuid,
      kind: "door",
      level: door.level,
      position: new Vector3(door.tileX + 0.5, feetY, door.tileY + 0.5),
      pickWidth: door.hingeOnX ? 0.92 : 0.22,
      pickHeight: doorHeight,
      pickCenterY: WALK_SURFACE + doorHeight / 2,
      pickMetadata: { sliceDoorUuid: door.uuid },
    });
  });

  return targets;
}
