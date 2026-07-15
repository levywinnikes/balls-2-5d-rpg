import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  TransformNode,
} from "@babylonjs/core";
import type { SliceTileDefinition } from "./SliceTileTypes";
import { FLOOR_THICKNESS } from "../../constants/World";

export type SliceDoor = {
  uuid: string;
  level: string;
  tileX: number;
  tileY: number;
  doorId: string;
  locked: boolean;
  keyId?: string | null;
  mesh: Mesh;
  root: TransformNode;
  floorSlab: Mesh;
  hingeOnX: boolean;
  hingeSide: number;
};

export type DoorSystemConfig = {
  scene: Scene;
  getCurrentLevel: () => string;
  levelToWorldY: (level: string | number) => number;
  parseLevelNumber: (level: string) => number;
  getMapTileAt: (level: string, tx: number, tz: number) => string | null;
  isStaticTileBlocking: (symbol: string | null, tileDef?: SliceTileDefinition | null) => boolean;
  loadMapDataAsync: () => Promise<any>;
  safeTileColor: (hex: string | undefined, fallback: string) => Color3;
  rebuildNavigationGrid: (level: string) => void;
  resetLevelEnemyPaths: (level: string) => void;
  getDoorState: (uuid: string) => { open: boolean; locked?: boolean; keyId?: string | null } | null;
  setDoorOpen: (uuid: string, open: boolean) => void;
  seedDoorState: (uuid: string, state: { open: boolean; locked: boolean; keyId?: string | null }) => void;
  emitMessage: (msg: string) => void;
  emitUiNotification: (notification: { type: string; message: string }) => void;
  getPlayerPosition: () => { x: number; z: number };
};

export class DoorSystem {
  readonly doors = new Map<string, SliceDoor>();
  readonly doorByLevelTile = new Map<string, string>();
  readonly seededDoorLevels = new Set<string>();
  readonly DOOR_PANEL_HEIGHT: number;
  readonly DOOR_INTERACT_RADIUS = 1.55;
  readonly DOOR_PICK_INTERACT_RADIUS = 2.75;

  constructor(private config: DoorSystemConfig) {
    const levelHeight = config.levelToWorldY("1") - config.levelToWorldY("0");
    // Door fits between floor surface and level ceiling
    this.DOOR_PANEL_HEIGHT = Math.max(1.35, levelHeight - FLOOR_THICKNESS);
  }

  private getDoorTileKey(level: string, tileX: number, tileY: number): string {
    return `${level}:${tileX}:${tileY}`;
  }

  getDoorAtTile(level: string, tileX: number, tileY: number): SliceDoor | null {
    const uuid = this.doorByLevelTile.get(this.getDoorTileKey(level, tileX, tileY));
    return uuid ? this.doors.get(uuid) ?? null : null;
  }

  isDoorOpenAtTile(level: string, tileX: number, tileY: number): boolean {
    const door = this.getDoorAtTile(level, tileX, tileY);
    if (!door) return false;
    return !!this.config.getDoorState(door.uuid)?.open;
  }

  isBlockingTile(level: string, tileX: number, tileY: number): boolean {
    const door = this.getDoorAtTile(level, tileX, tileY);
    if (!door) return false;
    return !this.isDoorOpenAtTile(level, tileX, tileY);
  }

  private isPlayerOnDoorTile(door: SliceDoor): boolean {
    const pos = this.config.getPlayerPosition();
    return Math.floor(pos.x) === door.tileX && Math.floor(pos.z) === door.tileY;
  }

  private canCloseDoor(door: SliceDoor): boolean {
    const state = this.config.getDoorState(door.uuid);
    if (!state?.open) return true;
    return !this.isPlayerOnDoorTile(door);
  }

  getDoorInteractDistance(door: SliceDoor): number {
    const pos = this.config.getPlayerPosition();
    const px = pos.x;
    const pz = pos.z;
    const closestX = Math.max(door.tileX, Math.min(door.tileX + 1, px));
    const closestZ = Math.max(door.tileY, Math.min(door.tileY + 1, pz));
    const dx = px - closestX;
    const dz = pz - closestZ;
    return Math.sqrt(dx * dx + dz * dz);
  }

  findNearbyDoor(maxDistance = this.DOOR_INTERACT_RADIUS): SliceDoor | null {
    const cfg = this.config;
    let nearestDoor: SliceDoor | null = null;
    let nearestDistance = maxDistance + 1;

    this.doors.forEach((door) => {
      if (Math.abs(cfg.levelToWorldY(door.level) - cfg.levelToWorldY(cfg.getCurrentLevel())) > cfg.levelToWorldY("1") - cfg.levelToWorldY("0")) {
        return;
      }
      const distance = this.getDoorInteractDistance(door);
      if (distance > maxDistance || distance >= nearestDistance) return;
      nearestDoor = door;
      nearestDistance = distance;
    });

    return nearestDoor;
  }

  private resolveDoorOrientation(
    level: string,
    tileX: number,
    tileY: number,
    mapData: any,
  ) {
    const cfg = this.config;
    const wallAt = (x: number, y: number) => {
      const symbol = cfg.getMapTileAt(level, x, y);
      const tileDef = symbol ? mapData.tileDefinitions?.[symbol] : undefined;
      return cfg.isStaticTileBlocking(symbol, tileDef);
    };

    const northWall = wallAt(tileX, tileY - 1);
    const southWall = wallAt(tileX, tileY + 1);
    const eastWall = wallAt(tileX + 1, tileY);
    const westWall = wallAt(tileX - 1, tileY);

    const hingeOnX = eastWall || westWall;
    const hingeOnZ = northWall || southWall;

    if (hingeOnX && !hingeOnZ) {
      return { hingeOnX: true, hingeSide: westWall ? -1 : 1 };
    }
    if (hingeOnZ && !hingeOnX) {
      return { hingeOnX: false, hingeSide: northWall ? -1 : 1 };
    }

    return { hingeOnX: true, hingeSide: westWall ? -1 : 1 };
  }

  async ensureLevelSeeded(level: string): Promise<void> {
    if (this.seededDoorLevels.has(level)) return;
    const cfg = this.config;

    const mapData = await cfg.loadMapDataAsync();
    if (!mapData) return;

    const levelData = mapData.levels?.[level];
    const entityTemplates = mapData.entityTemplates || {};
    const wallColor = cfg.safeTileColor(
      mapData.tileDefinitions?.wal?.color,
      "#7c5a3b",
    );

    levelData?.entities?.forEach((entity: any, index: number) => {
      const entityDef = entityTemplates[entity.symbol];
      if (!entityDef || entityDef.type !== "door") return;

      const uuid = entity.uuid || entityDef.uuid || `door_${level}_${entity.x}_${entity.y}_${index}`;
      if (this.doors.has(uuid)) return;

      cfg.seedDoorState(uuid, {
        open: false,
        locked: entity.locked ?? entityDef.locked ?? false,
        keyId: entity.keyId ?? entityDef.keyId ?? null,
      });

      const orientation = this.resolveDoorOrientation(level, entity.x, entity.y, mapData);
      const doorHeight = this.DOOR_PANEL_HEIGHT;

      const doorMesh = MeshBuilder.CreateBox(
        `slice-door-${uuid}`,
        {
          width: orientation.hingeOnX ? 0.96 : 0.14,
          height: doorHeight,
          depth: orientation.hingeOnX ? 0.14 : 0.96,
        },
        cfg.scene,
      );
      const doorMaterial = new StandardMaterial(`slice-door-mat-${uuid}`, cfg.scene);
      doorMaterial.diffuseColor = wallColor.scale(0.9);
      doorMaterial.specularColor = Color3.Black();
      doorMaterial.emissiveColor = wallColor.scale(0.15);
      doorMesh.material = doorMaterial;
      doorMesh.isPickable = true;
      doorMesh.metadata = { sliceDoorUuid: uuid };

      // Floor slab — door entity is self-contained, no tile dependency
      const floorSlab = MeshBuilder.CreateBox(
        `slice-door-floor-${uuid}`,
        { width: 1.0, height: FLOOR_THICKNESS, depth: 1.0 },
        cfg.scene,
      );
      const floorMat = new StandardMaterial(`slice-door-floor-mat-${uuid}`, cfg.scene);
      floorMat.diffuseColor = wallColor.scale(0.7);
      floorMat.specularColor = Color3.Black();
      floorSlab.material = floorMat;
      floorSlab.isPickable = false;

      const doorRoot = new TransformNode(`slice-door-root-${uuid}`, cfg.scene);
      doorMesh.parent = doorRoot;
      floorSlab.parent = doorRoot;

      const door: SliceDoor = {
        uuid,
        level,
        tileX: entity.x,
        tileY: entity.y,
        doorId: entityDef.id || "door",
        locked: entity.locked ?? entityDef.locked ?? false,
        keyId: entity.keyId ?? entityDef.keyId ?? null,
        mesh: doorMesh,
        root: doorRoot,
        floorSlab,
        hingeOnX: orientation.hingeOnX,
        hingeSide: orientation.hingeSide,
      };
      this.doors.set(uuid, door);
      this.doorByLevelTile.set(this.getDoorTileKey(level, entity.x, entity.y), uuid);
      this.updateDoorVisual(door);
    });

    this.seededDoorLevels.add(level);
    this.refreshDoorSystemsForLevel(level);
  }

  private updateDoorVisual(door: SliceDoor): void {
    const cfg = this.config;
    const state = cfg.getDoorState(door.uuid);
    const isOpen = !!state?.open;
    const levelWorldY = cfg.levelToWorldY(door.level);
    const doorHeight = this.DOOR_PANEL_HEIGHT;

    // Floor at base, door panel on top — both children of root
    door.floorSlab.position.set(0, FLOOR_THICKNESS / 2, 0);
    door.mesh.position.set(0, FLOOR_THICKNESS + doorHeight / 2, 0);
    door.mesh.rotation.set(0, 0, 0);
    if (isOpen) door.mesh.rotation.y = (Math.PI / 2) * (door.hingeSide ?? 1);

    // Root at tile center, base Y
    door.root.position.set(door.tileX + 0.5, levelWorldY, door.tileY + 0.5);
    door.root.setEnabled(
      Math.abs(levelWorldY - cfg.levelToWorldY(cfg.getCurrentLevel())) <= this.DOOR_PANEL_HEIGHT + 1,
    );
  }

  refreshDoorSystemsForLevel(level: string): void {
    this.config.rebuildNavigationGrid(level);
    this.config.resetLevelEnemyPaths(level);
  }

  interactDoorByUuid(uuid: string): boolean {
    const cfg = this.config;
    const door = this.doors.get(uuid);
    if (!door || Math.abs(cfg.levelToWorldY(door.level) - cfg.levelToWorldY(cfg.getCurrentLevel())) > cfg.levelToWorldY("1") - cfg.levelToWorldY("0")) {
      return false;
    }

    const state = cfg.getDoorState(uuid);
    if (state?.locked) {
      cfg.emitMessage("Door is locked.");
      return false;
    }

    const isOpen = !!state?.open;
    if (isOpen && !this.canCloseDoor(door)) {
      cfg.emitUiNotification({
        type: "warning",
        message: "Não dá para fechar — você está na passagem.",
      });
      return false;
    }

    cfg.setDoorOpen(uuid, !isOpen);
    this.updateDoorVisual(door);
    this.refreshDoorSystemsForLevel(door.level);
    return true;
  }

  findDoorUuidFromPick(pickResult: { pickedMesh?: any } | null | undefined): string | null {
    let currentMesh = pickResult?.pickedMesh;
    while (currentMesh) {
      const uuid = (currentMesh.metadata as { sliceDoorUuid?: string } | undefined)?.sliceDoorUuid;
      if (uuid) return uuid;
      currentMesh = currentMesh.parent;
    }
    return null;
  }

  tryInteractPickedDoor(doorUuid: string): boolean {
    const cfg = this.config;
    const door = this.doors.get(doorUuid);
    if (!door || Math.abs(cfg.levelToWorldY(door.level) - cfg.levelToWorldY(cfg.getCurrentLevel())) > cfg.levelToWorldY("1") - cfg.levelToWorldY("0")) {
      return false;
    }
    if (this.getDoorInteractDistance(door) > this.DOOR_PICK_INTERACT_RADIUS) {
      return false;
    }
    return this.interactDoorByUuid(doorUuid);
  }

  tryInteractNearbyDoorRespectingPickup(
    pickupRange: number,
    nearestItemDistance: number,
  ): boolean {
    const nearbyDoor = this.findNearbyDoor();
    if (!nearbyDoor) return false;

    const doorDistance = this.getDoorInteractDistance(nearbyDoor);
    if (nearestItemDistance <= pickupRange && nearestItemDistance + 0.08 < doorDistance) {
      return false;
    }

    return this.interactDoorByUuid(nearbyDoor.uuid);
  }

  handleDoorStatesChanged(): void {
    this.doors.forEach((door) => this.updateDoorVisual(door));
    this.refreshDoorSystemsForLevel(this.config.getCurrentLevel());
  }

  clear(): void {
    this.doors.forEach((door) => {
      const panelMat = door.mesh.material;
      const floorMat = door.floorSlab.material;
      door.root.dispose(); // disposes children (mesh + floorSlab)
      if (panelMat instanceof StandardMaterial) panelMat.dispose();
      if (floorMat instanceof StandardMaterial) floorMat.dispose();
    });
    this.doors.clear();
    this.doorByLevelTile.clear();
  }
}
