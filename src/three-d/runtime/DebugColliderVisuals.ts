import { type Scene, Mesh, MeshBuilder, StandardMaterial, Color3, TransformNode, VertexData } from "@babylonjs/core";

export interface DebugColliderDeps {
  scene: Scene;
  debugCollidersVisible: () => boolean;
  debugColliderParent: () => TransformNode | null;
  setDebugParent: (v: TransformNode | null) => void;
  playerDebugMesh: () => Mesh | null;
  setPlayerDebugMesh: (v: Mesh | null) => void;
  collisionWorld: any;
  player: { position: { x: number; y: number; z: number } };
  HERO_BODY_HEIGHT: number;
}

function createWedgeMesh(v: any, parent: TransformNode): Mesh {
  const mesh = new Mesh("wedge_" + v.level, parent.getScene());
  mesh.parent = parent;

  const x1 = v.x1, x2 = v.x2;
  const z1 = v.z1, z2 = v.z2;
  const baseY = v.baseY, highY = v.highY;

  let y_nw = baseY, y_ne = baseY, y_sw = baseY, y_se = baseY;
  if (v.direction === "n") { y_nw = highY; y_ne = highY; }
  else if (v.direction === "s") { y_sw = highY; y_se = highY; }
  else if (v.direction === "e") { y_ne = highY; y_se = highY; }
  else if (v.direction === "w") { y_nw = highY; y_sw = highY; }

  const positions = [
    x1, baseY, z1, x2, baseY, z1, x2, baseY, z2, x1, baseY, z2,
    x1, y_sw, z1, x2, y_se, z1, x2, y_ne, z2, x1, y_nw, z2,
  ];
  const indices = [
    0,2,1, 0,3,2, 4,5,6, 4,6,7, 0,1,5, 0,5,4, 1,2,6, 1,6,5, 2,3,7, 2,7,6, 3,0,4, 3,4,7
  ];
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.applyToMesh(mesh);
  return mesh;
}

export function createDebugColliderVisuals(deps: DebugColliderDeps) {
  const { scene, debugCollidersVisible, debugColliderParent, setDebugParent, playerDebugMesh, setPlayerDebugMesh, collisionWorld, player, HERO_BODY_HEIGHT } = deps;

  function rebuildDebugColliderMeshes(): void {
    const existing = debugColliderParent();
    if (existing) { existing.dispose(); setDebugParent(null); }
    const existingMesh = playerDebugMesh();
    if (existingMesh) { existingMesh.dispose(); setPlayerDebugMesh(null); }
    if (!debugCollidersVisible()) return;

    const parent = new TransformNode("debugCollidersParent", scene);
    setDebugParent(parent);

    const matWalkable = new StandardMaterial("matWalkable", scene);
    matWalkable.diffuseColor = new Color3(0, 1, 0);
    matWalkable.alpha = 0.3;
    matWalkable.backFaceCulling = false;

    const matSolid = new StandardMaterial("matSolid", scene);
    matSolid.diffuseColor = new Color3(1, 0, 0);
    matSolid.alpha = 0.3;
    matSolid.backFaceCulling = false;

    for (const v of collisionWorld.volumes) {
      let mesh: Mesh;
      if (v.kind === "aabb") {
        mesh = MeshBuilder.CreateBox("aabb_" + v.level, { width: v.x2 - v.x1, height: v.y2 - v.y1, depth: v.z2 - v.z1 }, scene);
        mesh.parent = parent;
        mesh.position.set((v.x1 + v.x2) / 2, (v.y1 + v.y2) / 2, (v.z1 + v.z2) / 2);
      } else {
        mesh = createWedgeMesh(v, parent);
      }
      mesh.material = v.isWalkable ? matWalkable : matSolid;
    }
  }

  function updatePlayerDebugMesh(): void {
    if (!debugCollidersVisible()) {
      const existingMesh = playerDebugMesh();
      if (existingMesh) { existingMesh.dispose(); setPlayerDebugMesh(null); }
      return;
    }
    let mesh = playerDebugMesh();
    if (!mesh) {
      mesh = MeshBuilder.CreateCylinder("playerDebug", { diameter: 0.64, height: HERO_BODY_HEIGHT }, scene);
      const mat = new StandardMaterial("playerDebugMat", scene);
      mat.diffuseColor = new Color3(0, 0, 1);
      mat.alpha = 0.4;
      mesh.material = mat;
      setPlayerDebugMesh(mesh);
    }
    mesh.position.x = player.position.x;
    mesh.position.y = player.position.y + HERO_BODY_HEIGHT / 2;
    mesh.position.z = player.position.z;
  }

  return { createWedgeMesh, rebuildDebugColliderMeshes, updatePlayerDebugMesh };
}
