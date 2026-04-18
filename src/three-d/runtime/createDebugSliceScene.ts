import {
  ArcRotateCamera,
  Color3,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core";
import {
  DroppedItemData,
  PlayerState,
} from "../../game/entities/Player/PlayerState";
import { t_game } from "../../game/i18n/translations";
import { ItemRegistry } from "../../game/entities/items/ItemRegistry";
import { WeaponRegistry } from "../../game/entities/weapons/WeaponRegistry";

type SliceRuntime = {
  engine: Engine;
  scene: Scene;
  dispose: () => void;
};

function createMaterial(
  scene: Scene,
  name: string,
  diffuseColor: Color3,
): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = diffuseColor;
  material.specularColor = new Color3(0.08, 0.08, 0.08);
  return material;
}

function worldToSliceCoord(value: number): number {
  return value / 32;
}

type MapEntity = {
  x: number;
  y: number;
  symbol: string;
  uuid?: string;
  contents?: Array<{ id: string; count: number }>;
};

type SliceMapData = {
  tileSize?: number;
  entityTemplates?: Record<string, any>;
  levels?: Record<string, { entities?: MapEntity[]; playerPos?: { x: number; y: number } }>;
};

function createHouse(scene: Scene): void {
  const wallMaterial = createMaterial(
    scene,
    "slice-wall",
    Color3.FromHexString("#8b7355"),
  );
  const roofMaterial = createMaterial(
    scene,
    "slice-roof",
    Color3.FromHexString("#a63f3f"),
  );
  const floorMaterial = createMaterial(
    scene,
    "slice-floor",
    Color3.FromHexString("#6b8f2a"),
  );

  const base = MeshBuilder.CreateBox(
    "house-base",
    { width: 8, depth: 6, height: 0.75 },
    scene,
  );
  base.position = new Vector3(0, 0.375, 0);
  base.material = floorMaterial;

  const frontWall = MeshBuilder.CreateBox(
    "house-front-wall",
    { width: 8, height: 3, depth: 0.35 },
    scene,
  );
  frontWall.position = new Vector3(0, 1.875, -2.825);
  frontWall.material = wallMaterial;

  const backWall = frontWall.clone("house-back-wall") as Mesh;
  backWall.position.z = 2.825;

  const leftWall = MeshBuilder.CreateBox(
    "house-left-wall",
    { width: 0.35, height: 3, depth: 6 },
    scene,
  );
  leftWall.position = new Vector3(-3.825, 1.875, 0);
  leftWall.material = wallMaterial;

  const rightWall = leftWall.clone("house-right-wall") as Mesh;
  rightWall.position.x = 3.825;

  const roof = MeshBuilder.CreateBox(
    "house-roof",
    { width: 8.6, depth: 6.6, height: 0.8 },
    scene,
  );
  roof.position = new Vector3(0, 3.55, 0);
  roof.material = roofMaterial;
}

export function createDebugSliceScene(canvas: HTMLCanvasElement): SliceRuntime {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  });
  const scene = new Scene(engine);
  scene.clearColor.set(0.67, 0.8, 0.96, 1);
  const playerState = PlayerState.getInstance();
  playerState.setPerspectiveMode("3D");
  const startingPosition = playerState.getPosition();
  const searchParams = new URLSearchParams(window.location.search);
  const sliceMapName =
    searchParams.get("map") || searchParams.get("mapName") || "perspective_debug";

  const camera = new ArcRotateCamera(
    "slice-camera",
    -Math.PI / 4,
    1.08,
    18,
    new Vector3(0, 1.5, 0),
    scene,
  );
  camera.lowerRadiusLimit = 18;
  camera.upperRadiusLimit = 18;
  camera.lowerBetaLimit = 1.08;
  camera.upperBetaLimit = 1.08;
  camera.lowerAlphaLimit = -Math.PI / 4;
  camera.upperAlphaLimit = -Math.PI / 4;
  camera.wheelPrecision = 1000000;
  camera.panningSensibility = 0;
  camera.attachControl(canvas, true);

  const firstPersonCamera = new UniversalCamera(
    "slice-fp-camera",
    new Vector3(6, 1.55, 6),
    scene,
  );
  firstPersonCamera.minZ = 0.05;
  firstPersonCamera.inertia = 0;
  firstPersonCamera.angularSensibility = 3200;
  firstPersonCamera.speed = 0;

  const hemiLight = new HemisphericLight(
    "slice-hemi-light",
    new Vector3(0.25, 1, -0.25),
    scene,
  );
  hemiLight.intensity = 1.0;
  hemiLight.groundColor = new Color3(0.28, 0.26, 0.24);

  const groundMaterial = createMaterial(
    scene,
    "slice-ground",
    Color3.FromHexString("#6a9f36"),
  );
  const ground = MeshBuilder.CreateGround(
    "slice-ground",
    { width: 36, height: 36, subdivisions: 2 },
    scene,
  );
  ground.material = groundMaterial;

  const pathMaterial = createMaterial(
    scene,
    "slice-path",
    Color3.FromHexString("#c89d62"),
  );
  const path = MeshBuilder.CreateBox(
    "slice-path",
    { width: 3.2, depth: 10, height: 0.12 },
    scene,
  );
  path.position = new Vector3(6, 0.06, 0);
  path.material = pathMaterial;

  createHouse(scene);

  const playerMaterial = createMaterial(
    scene,
    "slice-player",
    Color3.FromHexString("#f2d53c"),
  );
  const player = MeshBuilder.CreateCapsule(
    "slice-player",
    { radius: 0.42, height: 1.6, tessellation: 8 },
    scene,
  );
  player.position = new Vector3(
    startingPosition.x !== 0 ? worldToSliceCoord(startingPosition.x) : 6,
    0.8,
    startingPosition.y !== 0 ? worldToSliceCoord(startingPosition.y) : 6,
  );
  player.material = playerMaterial;

  const blockMaterial = createMaterial(
    scene,
    "slice-block",
    Color3.FromHexString("#8d6b4f"),
  );
  const testBlock = MeshBuilder.CreateBox(
    "slice-test-block",
    { width: 2.6, depth: 2.6, height: 2.6 },
    scene,
  );
  testBlock.position = new Vector3(-6, 1.3, 5);
  testBlock.material = blockMaterial;

  // Fallback pickup kept only for empty-state debugging while 3D begins consuming
  // the real persistent dropped-item list from PlayerState.
  const pickupMaterial = createMaterial(
    scene,
    "slice-pickup",
    Color3.FromHexString("#ffd166"),
  );
  const pickupOrb = MeshBuilder.CreateSphere(
    "slice-pickup-orb",
    { diameter: 0.6, segments: 12 },
    scene,
  );
  pickupOrb.position = new Vector3(4.5, 0.45, 4);
  pickupOrb.material = pickupMaterial;
  let fallbackPickupConsumed = false;

  const droppedItemMaterial = createMaterial(
    scene,
    "slice-dropped-item",
    Color3.FromHexString("#ffd166"),
  );
  const droppedItemMeshes = new Map<string, Mesh>();
  const seededLevels = new Set<string>();
  const seedingLevels = new Set<string>();
  let activeLevel = playerState.getCurrentLevel();
  let hasRealDroppedItems = false;

  const ensureLevelItemsSeeded = async (level: string) => {
    if (seededLevels.has(level) || seedingLevels.has(level)) return;

    if (playerState.hasVisitedLevel(level)) {
      seededLevels.add(level);
      return;
    }

    seedingLevels.add(level);

    try {
      const response = await fetch(`/maps/${sliceMapName}.json`);
      if (!response.ok) {
        throw new Error(`Map metadata missing (${response.status})`);
      }

      const mapData = (await response.json()) as SliceMapData;
      const tileSize = mapData.tileSize || 32;
      const levelData = mapData.levels?.[level];
      const entityTemplates = mapData.entityTemplates || {};

      if (levelData?.entities && Array.isArray(levelData.entities)) {
        levelData.entities.forEach((entity) => {
          const entityDef = entityTemplates[entity.symbol];
          if (!entityDef || entityDef.type !== "item") return;

          const worldX = entity.x * tileSize + tileSize / 2;
          const worldY = entity.y * tileSize + tileSize / 2;
          const rawItemUid = entity.uuid || entityDef.uuid;
          const uniqueId = rawItemUid || `map_${level}_${entity.x}_${entity.y}`;

          playerState.addPersistentDroppedItem(level, {
            itemId: uniqueId,
            weaponId: entityDef.id,
            x: worldX,
            y: worldY,
          });

          const contents = entity.contents || entityDef.contents;
          if (!contents || !Array.isArray(contents)) return;

          contents.forEach((content: { id: string; count: number }) => {
            const def =
              WeaponRegistry.getWeaponDefinition(content.id) ||
              ItemRegistry.getItem(content.id);
            const isStackable = !!def?.stackable;

            if (isStackable) {
              playerState.addItemToContainer(uniqueId, content.id, content.count);
              return;
            }

            for (let i = 0; i < content.count; i++) {
              playerState.addItemToContainer(uniqueId, content.id, 1);
            }
          });
        });
      }

      playerState.markLevelVisited(level);
      seededLevels.add(level);
    } catch (error) {
      console.warn(
        `[3D Slice] Failed to seed map items for ${sliceMapName}/${level}`,
        error,
      );
    } finally {
      seedingLevels.delete(level);
    }
  };

  const syncDroppedItems = () => {
    const currentLevel = playerState.getCurrentLevel();
    if (currentLevel !== activeLevel) {
      droppedItemMeshes.forEach((mesh) => mesh.dispose());
      droppedItemMeshes.clear();
      activeLevel = currentLevel;
      void ensureLevelItemsSeeded(currentLevel);
    }

    const persistentItems = playerState.getPersistentDroppedItems(currentLevel);
    const nextIds = new Set(persistentItems.map((item) => item.itemId));

    droppedItemMeshes.forEach((mesh, itemId) => {
      if (!nextIds.has(itemId)) {
        mesh.dispose();
        droppedItemMeshes.delete(itemId);
      }
    });

    persistentItems.forEach((item) => {
      let mesh = droppedItemMeshes.get(item.itemId);
      if (!mesh) {
        mesh = MeshBuilder.CreateSphere(
          `slice-dropped-${item.itemId}`,
          { diameter: 0.5, segments: 10 },
          scene,
        );
        mesh.material = droppedItemMaterial;
        droppedItemMeshes.set(item.itemId, mesh);
      }

      mesh.position.set(
        worldToSliceCoord(item.x),
        0.4,
        worldToSliceCoord(item.y),
      );
      mesh.metadata = item;
    });

    hasRealDroppedItems = persistentItems.length > 0;
    pickupOrb.setEnabled(!hasRealDroppedItems && !fallbackPickupConsumed);
  };

  const tryPickupPersistentItem = (item: DroppedItemData): boolean => {
    const pickupCount = item.count || 1;
    const added = playerState.addItem(
      item.weaponId,
      pickupCount,
      item.itemId,
      item.stars || 0,
      [...(item.attributes || [])],
    );

    if (!added) {
      return false;
    }

    playerState.removePersistentDroppedItem(activeLevel, item.itemId);

    const def = WeaponRegistry.getWeaponDefinition(item.weaponId);
    const itemName = def ? t_game((`item_${def.id}` as any)) : item.weaponId;
    playerState.emit("uiNotification", {
      type: "pickup",
      message: t_game("notif_item_get")
        .replace("{amount}", pickupCount.toString())
        .replace("{item}", itemName),
    });
    playerState.log("action_pickup");
    return true;
  };

  const tryPickupNearestItem = (): boolean => {
    const pickupRange = playerState.pickupRange / 32;
    let nearestItem: DroppedItemData | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    droppedItemMeshes.forEach((mesh) => {
      const item = mesh.metadata as DroppedItemData | undefined;
      if (!item) return;

      const distance = Vector3.Distance(player.position, mesh.position);
      if (distance <= pickupRange && distance < nearestDistance) {
        nearestItem = item;
        nearestDistance = distance;
      }
    });

    if (nearestItem) {
      return tryPickupPersistentItem(nearestItem);
    }

    return false;
  };

  void ensureLevelItemsSeeded(activeLevel);
  syncDroppedItems();

  const pressedKeys = new Set<string>();

  let isFirstPerson = false;
  let verticalVelocity = 0;
  const gravity = -18;
  const jumpImpulse = 7.2;
  const playerGroundY = 0.8;
  let isGrounded = true;

  const setCameraMode = (firstPerson: boolean) => {
    isFirstPerson = firstPerson;

    if (isFirstPerson) {
      camera.detachControl();
      firstPersonCamera.position.set(
        player.position.x,
        player.position.y + 0.72,
        player.position.z,
      );
      scene.activeCamera = firstPersonCamera;
      firstPersonCamera.attachControl(canvas, true);
      return;
    }

    firstPersonCamera.detachControl();
    scene.activeCamera = camera;
    camera.attachControl(canvas, true);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    pressedKeys.add(key);

    if (event.code === "Space") {
      if (isGrounded) {
        verticalVelocity = jumpImpulse;
        isGrounded = false;
      }
      event.preventDefault();
    }

    if (key === "v" && !event.repeat) {
      setCameraMode(!isFirstPerson);
    }

    if (key === "e" && !event.repeat) {
      const pickedRealItem = tryPickupNearestItem();
      if (pickedRealItem) {
        syncDroppedItems();
        return;
      }

      if (!hasRealDroppedItems) {
        const dist = Vector3.Distance(player.position, pickupOrb.position);
        if (dist <= 1.25) {
          const added = playerState.addItem("torch", 1);
          if (added) {
            fallbackPickupConsumed = true;
            pickupOrb.setEnabled(false);
            playerState.log("action_pickup");
          }
        }
      }
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    pressedKeys.delete(event.key.toLowerCase());
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  scene.onBeforeRenderObservable.add(() => {
    syncDroppedItems();

    const deltaSeconds = engine.getDeltaTime() / 1000;
    const speed = 4.5;
    let moveForward = 0;
    let moveRight = 0;

    if (pressedKeys.has("w") || pressedKeys.has("arrowup")) moveForward += 1;
    if (pressedKeys.has("s") || pressedKeys.has("arrowdown")) moveForward -= 1;
    if (pressedKeys.has("a") || pressedKeys.has("arrowleft")) moveRight -= 1;
    if (pressedKeys.has("d") || pressedKeys.has("arrowright")) moveRight += 1;

    if (moveForward !== 0 || moveRight !== 0) {
      let movement = Vector3.Zero();

      if (isFirstPerson) {
        const yaw = firstPersonCamera.rotation.y;
        const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const right = new Vector3(forward.z, 0, -forward.x);
        movement = forward.scale(moveForward).add(right.scale(moveRight));
      } else {
        movement = new Vector3(moveRight, 0, moveForward);
      }

      movement.normalize().scaleInPlace(speed * deltaSeconds);
      player.position.addInPlace(movement);
      player.position.x = Math.min(14, Math.max(-14, player.position.x));
      player.position.z = Math.min(14, Math.max(-14, player.position.z));
    }

    verticalVelocity += gravity * deltaSeconds;
    player.position.y += verticalVelocity * deltaSeconds;
    if (player.position.y <= playerGroundY) {
      player.position.y = playerGroundY;
      verticalVelocity = 0;
      isGrounded = true;
    }

    if (isFirstPerson) {
      firstPersonCamera.position.set(
        player.position.x,
        player.position.y + 0.72,
        player.position.z,
      );
      playerState.recordPlayerPosition(
        "0",
        player.position.x * 32,
        player.position.z * 32,
      );
      return;
    }

    const currentTarget = camera.target;
    camera.setTarget(
      Vector3.Lerp(
        currentTarget,
        new Vector3(player.position.x, 1.4, player.position.z),
        0.12,
      ),
    );

    playerState.recordPlayerPosition(
      "0",
      player.position.x * 32,
      player.position.z * 32,
    );
  });

  engine.runRenderLoop(() => {
    scene.render();
  });

  return {
    engine,
    scene,
    dispose: () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      scene.dispose();
      engine.dispose();
    },
  };
}
