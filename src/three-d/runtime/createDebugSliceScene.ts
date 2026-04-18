import {
  ArcRotateCamera,
  Color3,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

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
  player.position = new Vector3(6, 0.8, 6);
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

  const pressedKeys = new Set<string>();
  const onKeyDown = (event: KeyboardEvent) =>
    pressedKeys.add(event.key.toLowerCase());
  const onKeyUp = (event: KeyboardEvent) =>
    pressedKeys.delete(event.key.toLowerCase());
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  scene.onBeforeRenderObservable.add(() => {
    const deltaSeconds = engine.getDeltaTime() / 1000;
    const speed = 4.5;
    let moveX = 0;
    let moveZ = 0;

    if (pressedKeys.has("w") || pressedKeys.has("arrowup")) moveZ += 1;
    if (pressedKeys.has("s") || pressedKeys.has("arrowdown")) moveZ -= 1;
    if (pressedKeys.has("a") || pressedKeys.has("arrowleft")) moveX -= 1;
    if (pressedKeys.has("d") || pressedKeys.has("arrowright")) moveX += 1;

    if (moveX !== 0 || moveZ !== 0) {
      const movement = new Vector3(moveX, 0, moveZ)
        .normalize()
        .scale(speed * deltaSeconds);
      player.position.addInPlace(movement);
      player.position.x = Math.min(14, Math.max(-14, player.position.x));
      player.position.z = Math.min(14, Math.max(-14, player.position.z));
    }

    const currentTarget = camera.target;
    camera.setTarget(
      Vector3.Lerp(
        currentTarget,
        new Vector3(player.position.x, 1.4, player.position.z),
        0.12,
      ),
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
