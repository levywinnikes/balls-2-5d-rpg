import type { Scene } from "@babylonjs/core";
import { Mesh, VertexData } from "@babylonjs/core";

const LEVEL_HEIGHT = 4;
const WALK_SURFACE = 0.01;

export function buildRoofMesh(
  name: string,
  tx: number,
  tz: number,
  baseY: number,
  ridgeH: number,
  scene: Scene,
): Mesh {
  const group = new Mesh(name, scene);

  const x0 = tx, x1 = tx + 1;
  const z0 = tz, z1 = tz + 1;
  const xM = tx + 0.5, zM = tz + 0.5;
  const yBase = baseY, yRidge = baseY + ridgeH;

  const vd = new VertexData();

  const positions = [
    x0, yBase, z0,
    x1, yBase, z0,
    x1, yBase, z1,
    x0, yBase, z1,
    xM, yRidge, zM,
  ];

  const indices = [
    0, 4, 1,
    1, 4, 2,
    2, 4, 3,
    3, 4, 0,
  ];

  const normals: number[] = new Array(positions.length).fill(0);
  VertexData.ComputeNormals(positions, indices, normals);

  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;
  vd.applyToMesh(group);

  return group;
}

export function buildStairMesh(
  name: string,
  tx: number,
  tz: number,
  baseY: number,
  scene: Scene,
): Mesh {
  const mesh = new Mesh(name, scene);
  const STEP_COUNT = 8;
  const stepDepth = 1.0 / STEP_COUNT;
  const stepRise = LEVEL_HEIGHT / STEP_COUNT;

  const allPositions: number[] = [];
  const allIndices: number[] = [];

  for (let i = 0; i < STEP_COUNT; i++) {
    const x0 = tx;
    const x1 = tx + 1;
    const z0 = tz + (STEP_COUNT - 1 - i) * stepDepth;
    const z1 = tz + (STEP_COUNT - i) * stepDepth;
    const y1 = baseY + WALK_SURFACE + (i + 1) * stepRise;
    const y0 = y1 - stepRise;

    const base = allPositions.length / 3;
    allPositions.push(
      x0, y0, z1, x1, y0, z1, x1, y0, z0, x0, y0, z0,
      x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0,
    );
    allIndices.push(
      base + 4, base + 7, base + 6, base + 4, base + 6, base + 5,
      base + 0, base + 1, base + 2, base + 0, base + 2, base + 3,
      base + 0, base + 4, base + 5, base + 0, base + 5, base + 1,
      base + 3, base + 2, base + 6, base + 3, base + 6, base + 7,
      base + 1, base + 5, base + 6, base + 1, base + 6, base + 2,
      base + 0, base + 3, base + 7, base + 0, base + 7, base + 4,
    );
  }

  const normals: number[] = new Array(allPositions.length).fill(0);
  VertexData.ComputeNormals(allPositions, allIndices, normals);
  const vd2 = new VertexData();
  vd2.positions = allPositions;
  vd2.indices = allIndices;
  vd2.normals = normals;
  vd2.applyToMesh(mesh);
  return mesh;
}
