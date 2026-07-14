import type { Scene, Mesh, TransformNode } from "@babylonjs/core";
import { Matrix } from "@babylonjs/core";
import { WALK_SURFACE } from "../../constants/World";
import type { DoorSystem } from "./DoorSystem";
import type { InteractableWallRevealSystem } from "./InteractableWallRevealSystem";
import type { DropStreamSystem } from "./DropStreamSystem";

export interface PointerPickingSystemConfig {
  scene: Scene;
  doorSystem: DoorSystem;
  wallRevealSystem: InteractableWallRevealSystem;
  dropSystem: DropStreamSystem;
  enemies: Map<string, any>;
  levelToWorldY: (level: string) => number;
  getRenderLevel: () => string;
  getIsFirstPerson: () => boolean;
  getPickupRange: () => number;
}

export class PointerPickingSystem {
  constructor(private readonly cfg: PointerPickingSystemConfig) {}

  projectPointerToGroundXZ(
    pointerX: number,
    pointerY: number,
  ): { x: number; z: number } | null {
    const activeCamera = this.cfg.scene.activeCamera;
    if (!activeCamera) {
      return null;
    }
    const ray = this.cfg.scene.createPickingRay(
      pointerX,
      pointerY,
      Matrix.Identity(),
      activeCamera,
    );
    const planeY =
      this.cfg.levelToWorldY(this.cfg.getRenderLevel()) + WALK_SURFACE;
    if (Math.abs(ray.direction.y) < 1e-5) {
      return null;
    }
    const t = (planeY - ray.origin.y) / ray.direction.y;
    if (t < 0) {
      return null;
    }
    return {
      x: ray.origin.x + ray.direction.x * t,
      z: ray.origin.z + ray.direction.z * t,
    };
  }

  resolveEnemyUidFromPointer(
    pointerX: number,
    pointerY: number,
  ): string | undefined {
    const { scene, enemies, wallRevealSystem } = this.cfg;
    const multiHits = scene.multiPick(pointerX, pointerY);
    if (multiHits) {
      for (const hit of multiHits) {
        const uid = extractEnemyUidFromMeshChain(hit.pickedMesh);
        if (uid && enemies.has(uid)) {
          return uid;
        }
      }
    }

    const singlePick = scene.pick(pointerX, pointerY);
    const fromSingle = extractEnemyUidFromMeshChain(singlePick?.pickedMesh);
    if (fromSingle && enemies.has(fromSingle)) {
      return fromSingle;
    }

    const ground = this.projectPointerToGroundXZ(pointerX, pointerY);
    if (ground) {
      const occluded = wallRevealSystem.findOccludedTargetNear(
        ground.x,
        ground.z,
        0.95,
      );
      const uid = occluded?.pickMetadata.sliceEnemyUid;
      if (uid && enemies.has(uid)) {
        return uid;
      }
    }

    return undefined;
  }

  resolveDoorUuidFromPointer(
    pointerX: number,
    pointerY: number,
  ): string | null {
    const { scene, doorSystem, wallRevealSystem } = this.cfg;
    const multiHits = scene.multiPick(pointerX, pointerY);
    if (multiHits) {
      for (const hit of multiHits) {
        const uuid = doorSystem.findDoorUuidFromPick(hit);
        if (uuid) {
          return uuid;
        }
      }
    }

    const singlePick = scene.pick(pointerX, pointerY);
    const fromSingle = doorSystem.findDoorUuidFromPick(singlePick);
    if (fromSingle) {
      return fromSingle;
    }

    if (!this.cfg.getIsFirstPerson()) {
      const ground = this.projectPointerToGroundXZ(pointerX, pointerY);
      if (ground) {
        const occluded = wallRevealSystem.findOccludedTargetNear(
          ground.x,
          ground.z,
          0.95,
        );
        const uuid = occluded?.pickMetadata.sliceDoorUuid;
        if (uuid && doorSystem.doors.has(uuid)) {
          return uuid;
        }
      }
    }

    return null;
  }

  getNearestPickupItemDistance(): number {
    const pickupRange = this.cfg.getPickupRange();
    let nearestDistance = Number.POSITIVE_INFINITY;

    this.cfg.dropSystem.droppedItemMeshes.forEach((mesh: TransformNode) => {
      if (!mesh.isEnabled()) {
        return;
      }

      const pos = mesh.getAbsolutePosition();
      const activeCamera = this.cfg.scene.activeCamera;
      if (!activeCamera) return;
      const camPos = activeCamera.position;
      const dx = pos.x - camPos.x;
      const dz = pos.z - camPos.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < nearestDistance) {
        nearestDistance = distance;
      }
    });

    return Number.isFinite(nearestDistance) ? nearestDistance : pickupRange;
  }
}

function extractEnemyUidFromMeshChain(mesh: any): string | undefined {
  if (!mesh) return undefined;
  const metadata = mesh.metadata;
  if (metadata?.enemyUid) return metadata.enemyUid;
  if (mesh.parent) return extractEnemyUidFromMeshChain(mesh.parent);
  return undefined;
}
