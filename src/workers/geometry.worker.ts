/**
 * geometry.worker.ts
 *
 * Off-thread chunk geometry builder. Receives tile descriptions from the
 * main thread, computes raw vertex/index buffers (no Babylon.js dependency),
 * and returns transferable ArrayBuffers so no data is copied.
 *
 * Message protocol:
 *   IN  → GeometryWorkerRequest
 *   OUT → GeometryWorkerResponse (transferable)
 */

// ---------------------------------------------------------------------------
// Types shared with the main thread (kept inline — no shared import path
// that would require DOM/Babylon types in this worker scope).
// ---------------------------------------------------------------------------

export interface TileDescriptor {
  x: number;
  y: number; // tile grid Z (depth)
  symbol: string;
  tileId: string;
  isBlocking: boolean;
  isRoof: boolean;
  isStair: boolean;
  height: number; // world-unit height of this tile
  levelOffsetY: number; // world Y of the floor for this level
  materialKey: string; // "kind:hexcolor" — determined by main thread
}

export interface GeometryWorkerRequest {
  requestId: string; // chunk key e.g. "3_5"
  tiles: TileDescriptor[];
}

export interface GeometryGroupBuffer {
  materialKey: string;
  isRoof: boolean;
  positions: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  uvs: Float32Array;
}

export interface GeometryWorkerResponse {
  requestId: string;
  groups: GeometryGroupBuffer[];
  /** total tile count processed, for diagnostics */
  tileCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEVEL_HEIGHT_UNITS = 2.0;
const STEP_COUNT = 4;

// ---------------------------------------------------------------------------
// Roof geometry constants (shared by all roof shape functions)
// ---------------------------------------------------------------------------

/** Height above levelOffsetY where the eave (low edge of a slope panel) sits.
 *  Matches the current pyramid base height so plain-rof tiles blend naturally. */
const ROOF_EAVE_H = 0.4;

/** Height above levelOffsetY where the ridge (peak/high edge) sits. */
const ROOF_RIDGE_H = 1.1;

// ---------------------------------------------------------------------------
// Per-group geometry accumulator
// ---------------------------------------------------------------------------

interface GeomAccum {
  positions: number[];
  indices: number[];
  uvs: number[];
}

function mergeInto(
  dst: GeomAccum,
  srcPositions: number[],
  srcIndices: number[],
  srcUvs: number[],
): void {
  const base = dst.positions.length / 3;
  for (const p of srcPositions) dst.positions.push(p);
  for (const i of srcIndices) dst.indices.push(base + i);
  for (const uv of srcUvs) dst.uvs.push(uv);
}

// ---------------------------------------------------------------------------
// Box geometry (replaces MeshBuilder.CreateBox + MergeMeshes)
// ---------------------------------------------------------------------------

function buildBoxVerts(
  x: number,
  y: number,
  height: number,
  levelOffsetY: number,
): { positions: number[]; indices: number[]; uvs: number[] } {
  const x0 = x,
    x1 = x + 1;
  const z0 = y,
    z1 = y + 1;
  const yBot = levelOffsetY;
  const yTop = levelOffsetY + height;

  // 24 vertices (4 per face) to preserve sharp edges and proper face UVs.
  const positions = [
    // top (+Y), CCW viewed from above
    x0,
    yTop,
    z0,
    x0,
    yTop,
    z1,
    x1,
    yTop,
    z1,
    x1,
    yTop,
    z0,
    // bottom (-Y), CCW viewed from below
    x0,
    yBot,
    z1,
    x0,
    yBot,
    z0,
    x1,
    yBot,
    z0,
    x1,
    yBot,
    z1,
    // front (-Z), CCW viewed from -Z
    x0,
    yBot,
    z0,
    x0,
    yTop,
    z0,
    x1,
    yTop,
    z0,
    x1,
    yBot,
    z0,
    // back (+Z), CCW viewed from +Z
    x1,
    yBot,
    z1,
    x1,
    yTop,
    z1,
    x0,
    yTop,
    z1,
    x0,
    yBot,
    z1,
    // right (+X), CCW viewed from +X
    x1,
    yBot,
    z0,
    x1,
    yTop,
    z0,
    x1,
    yTop,
    z1,
    x1,
    yBot,
    z1,
    // left (-X), CCW viewed from -X
    x0,
    yBot,
    z1,
    x0,
    yTop,
    z1,
    x0,
    yTop,
    z0,
    x0,
    yBot,
    z0,
  ];

  const indices: number[] = [];
  for (let f = 0; f < 6; f++) {
    const base = f * 4;
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const uvs: number[] = [];
  for (let f = 0; f < 6; f++) {
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
  }

  return { positions, indices, uvs };
}

// ---------------------------------------------------------------------------
// Roof geometry (pyramid with 4 triangular faces)
// ---------------------------------------------------------------------------

function buildRoofVerts(
  x: number,
  y: number,
  baseY: number,
  ridgeH: number,
): { positions: number[]; indices: number[]; uvs: number[] } {
  const x0 = x,
    x1 = x + 1;
  const z0 = y,
    z1 = y + 1;
  const xM = x + 0.5,
    zM = y + 0.5;
  const yBase = baseY,
    yRidge = baseY + ridgeH;

  const positions = [
    x0,
    yBase,
    z0, // 0 front-left
    x1,
    yBase,
    z0, // 1 front-right
    x1,
    yBase,
    z1, // 2 back-right
    x0,
    yBase,
    z1, // 3 back-left
    xM,
    yRidge,
    zM, // 4 peak
  ];

  const indices = [
    0,
    4,
    1, // front
    1,
    4,
    2, // right
    2,
    4,
    3, // back
    3,
    4,
    0, // left
  ];

  const uvs = [0, 0, 1, 0, 1, 1, 0, 1, 0.5, 0.5];

  return { positions, indices, uvs };
}

// ---------------------------------------------------------------------------
// Stair geometry (4-step staircase, south→north)
// ---------------------------------------------------------------------------

function buildStairVerts(
  x: number,
  y: number,
  baseY: number,
): { positions: number[]; indices: number[]; uvs: number[] } {
  const stepDepth = 1.0 / STEP_COUNT;
  const stepRise = LEVEL_HEIGHT_UNITS / STEP_COUNT;

  const allPositions: number[] = [];
  const allIndices: number[] = [];
  const allUvs: number[] = [];

  for (let i = 0; i < STEP_COUNT; i++) {
    const x0 = x;
    const x1 = x + 1;
    const z0 = y + (STEP_COUNT - 1 - i) * stepDepth;
    const z1 = y + (STEP_COUNT - i) * stepDepth;
    const y0 = baseY;
    const y1 = baseY + (i + 1) * stepRise;

    const base = allPositions.length / 3;
    allPositions.push(
      x0,
      y0,
      z1,
      x1,
      y0,
      z1,
      x1,
      y0,
      z0,
      x0,
      y0,
      z0, // bottom 0-3
      x0,
      y1,
      z1,
      x1,
      y1,
      z1,
      x1,
      y1,
      z0,
      x0,
      y1,
      z0, // top    4-7
    );
    allIndices.push(
      base + 4,
      base + 7,
      base + 6,
      base + 4,
      base + 6,
      base + 5, // top face
      base + 0,
      base + 1,
      base + 2,
      base + 0,
      base + 2,
      base + 3, // bottom
      base + 0,
      base + 4,
      base + 5,
      base + 0,
      base + 5,
      base + 1, // south riser
      base + 3,
      base + 2,
      base + 6,
      base + 3,
      base + 6,
      base + 7, // north face
      base + 1,
      base + 5,
      base + 6,
      base + 1,
      base + 6,
      base + 2, // east side
      base + 0,
      base + 3,
      base + 7,
      base + 0,
      base + 7,
      base + 4, // west side
    );

    // Repeated face UV pattern per 8 vertices (acceptable for stair chunks)
    allUvs.push(0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1);
  }

  return { positions: allPositions, indices: allIndices, uvs: allUvs };
}

// ---------------------------------------------------------------------------
// Gable roof — directional slope panel (quad, one edge at eave, one at ridge)
// ---------------------------------------------------------------------------
//
// direction 'n': eave (low) at north (z0), ridge (high) at south (z1)
//                normal faces north-up  → place in NORTH half of building
// direction 's': eave at south (z1), ridge at north (z0)
//                normal faces south-up  → place in SOUTH half
// direction 'e': eave at east (x1), ridge at west (x0)
//                normal faces east-up   → place in EAST half (N-S ridge)
// direction 'w': eave at west (x0), ridge at east (x1)
//                normal faces west-up   → place in WEST half (N-S ridge)
//
// Winding verified so that computeNormals() produces outward-facing normals.
// ---------------------------------------------------------------------------

function buildRoofSlopePanelVerts(
  x: number,
  y: number,
  levelOffsetY: number,
  direction: "n" | "s" | "e" | "w",
): { positions: number[]; indices: number[]; uvs: number[] } {
  const x0 = x,
    x1 = x + 1;
  const z0 = y,
    z1 = y + 1;
  const yEave = levelOffsetY + ROOF_EAVE_H;
  const yRidge = levelOffsetY + ROOF_RIDGE_H;

  let positions: number[];

  if (direction === "n") {
    // Eave at north (z0=low), ridge at south (z1=high).
    // Winding NW-eave → SW-ridge → SE-ridge → NE-eave gives normal (0,1,-0.7) ✓
    positions = [
      x0, yEave, z0, // 0 NW eave
      x0, yRidge, z1, // 1 SW ridge
      x1, yRidge, z1, // 2 SE ridge
      x1, yEave, z0, // 3 NE eave
    ];
  } else if (direction === "s") {
    // Eave at south (z1=low), ridge at north (z0=high).
    // Winding SW-eave → SE-eave → NE-ridge → NW-ridge gives normal (0,1,0.7) ✓
    positions = [
      x0, yEave, z1, // 0 SW eave
      x1, yEave, z1, // 1 SE eave
      x1, yRidge, z0, // 2 NE ridge
      x0, yRidge, z0, // 3 NW ridge
    ];
  } else if (direction === "e") {
    // Eave at east (x1=low), ridge at west (x0=high).
    // Winding NW-ridge → SW-ridge → SE-eave → NE-eave gives normal (0.7,1,0) ✓
    positions = [
      x0, yRidge, z0, // 0 NW ridge
      x0, yRidge, z1, // 1 SW ridge
      x1, yEave, z1, // 2 SE eave
      x1, yEave, z0, // 3 NE eave
    ];
  } else {
    // direction === 'w'
    // Eave at west (x0=low), ridge at east (x1=high).
    // Winding NW-eave → SW-eave → SE-ridge → NE-ridge gives normal (-0.7,1,0) ✓
    positions = [
      x0, yEave, z0, // 0 NW eave
      x0, yEave, z1, // 1 SW eave
      x1, yRidge, z1, // 2 SE ridge
      x1, yRidge, z0, // 3 NE ridge
    ];
  }

  const indices = [0, 1, 2, 0, 2, 3];
  const uvs = [0, 0, 0, 1, 1, 1, 1, 0];

  return { positions, indices, uvs };
}

// ---------------------------------------------------------------------------
// Gable roof — flat ridge cap (horizontal quad at ridge height)
// ---------------------------------------------------------------------------

function buildRoofRidgePanelVerts(
  x: number,
  y: number,
  levelOffsetY: number,
): { positions: number[]; indices: number[]; uvs: number[] } {
  const x0 = x,
    x1 = x + 1;
  const z0 = y,
    z1 = y + 1;
  const yTop = levelOffsetY + ROOF_RIDGE_H;

  // CCW from above → normal (0,1,0)
  const positions = [x0, yTop, z0, x0, yTop, z1, x1, yTop, z1, x1, yTop, z0];
  const indices = [0, 1, 2, 0, 2, 3];
  const uvs = [0, 0, 0, 1, 1, 1, 1, 0];

  return { positions, indices, uvs };
}

function buildFloorQuadVerts(
  x: number,
  y: number,
  topY: number,
): { positions: number[]; indices: number[]; uvs: number[] } {
  const x0 = x;
  const x1 = x + 1;
  const z0 = y;
  const z1 = y + 1;

  // Single top quad avoids dark side faces between thin floor tiles.
  const positions = [x0, topY, z0, x0, topY, z1, x1, topY, z1, x1, topY, z0];

  const indices = [0, 1, 2, 0, 2, 3];
  const uvs = [0, 0, 0, 1, 1, 1, 1, 0];

  return { positions, indices, uvs };
}

// ---------------------------------------------------------------------------
// Flat normal computation (no Babylon.js VertexData.ComputeNormals available)
// Computes per-vertex averaged face normals.
// ---------------------------------------------------------------------------

function computeNormals(positions: number[], indices: number[]): number[] {
  const normals = new Array<number>(positions.length).fill(0);
  const vertexCount = positions.length / 3;
  const faceCount = indices.length / 3;

  for (let f = 0; f < faceCount; f++) {
    const i0 = indices[f * 3];
    const i1 = indices[f * 3 + 1];
    const i2 = indices[f * 3 + 2];

    const ax = positions[i0 * 3],
      ay = positions[i0 * 3 + 1],
      az = positions[i0 * 3 + 2];
    const bx = positions[i1 * 3],
      by = positions[i1 * 3 + 1],
      bz = positions[i1 * 3 + 2];
    const cx = positions[i2 * 3],
      cy = positions[i2 * 3 + 1],
      cz = positions[i2 * 3 + 2];

    // edge vectors
    const ex = bx - ax,
      ey = by - ay,
      ez = bz - az;
    const fx = cx - ax,
      fy = cy - ay,
      fz = cz - az;

    // cross product
    const nx = ey * fz - ez * fy;
    const ny = ez * fx - ex * fz;
    const nz = ex * fy - ey * fx;

    for (const vi of [i0, i1, i2]) {
      normals[vi * 3] += nx;
      normals[vi * 3 + 1] += ny;
      normals[vi * 3 + 2] += nz;
    }
  }

  // Normalize
  for (let v = 0; v < vertexCount; v++) {
    const nx = normals[v * 3];
    const ny = normals[v * 3 + 1];
    const nz = normals[v * 3 + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    normals[v * 3] = nx / len;
    normals[v * 3 + 1] = ny / len;
    normals[v * 3 + 2] = nz / len;
  }

  return normals;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-restricted-globals
self.onmessage = (evt: MessageEvent<GeometryWorkerRequest>) => {
  const { requestId, tiles } = evt.data;

  // Group tiles by materialKey + isRoof flag
  const accums = new Map<string, GeomAccum>();
  const roofKeys = new Set<string>();

  const getAccum = (key: string): GeomAccum => {
    let a = accums.get(key);
    if (!a) {
      a = { positions: [], indices: [], uvs: [] };
      accums.set(key, a);
    }
    return a;
  };

  for (const tile of tiles) {
    const {
      x,
      y,
        tileId,
        isRoof,
      isStair,
      isBlocking,
      height,
      levelOffsetY,
      materialKey,
    } = tile;

    if (isRoof) {
      roofKeys.add(materialKey);
        if (tileId.includes("slope")) {
          // Directional gable slope panel: roof-slope-n/s/e/w
          const dir =
            tileId.endsWith("-n")
              ? "n"
              : tileId.endsWith("-s")
                ? "s"
                : tileId.endsWith("-e")
                  ? "e"
                  : "w";
          const { positions, indices, uvs } = buildRoofSlopePanelVerts(
            x,
            y,
            levelOffsetY,
            dir as "n" | "s" | "e" | "w",
          );
          mergeInto(getAccum(materialKey), positions, indices, uvs);
        } else if (tileId.includes("ridge")) {
          // Flat ridge cap tile
          const { positions, indices, uvs } = buildRoofRidgePanelVerts(
            x,
            y,
            levelOffsetY,
          );
          mergeInto(getAccum(materialKey), positions, indices, uvs);
        } else {
          // Legacy plain pyramid (for old 'rof' tiles)
          const wallBaseH = Math.max(0.4, height);
          const ridgeH = 0.65;
          const { positions, indices, uvs } = buildRoofVerts(
            x,
            y,
            levelOffsetY + wallBaseH,
            ridgeH,
          );
          mergeInto(getAccum(materialKey), positions, indices, uvs);
        }
    } else if (isStair) {
      const { positions, indices, uvs } = buildStairVerts(x, y, levelOffsetY);
      mergeInto(getAccum(materialKey), positions, indices, uvs);
    } else {
      const tileHeight = Math.max(0.03, height);
      const { positions, indices, uvs } = buildBoxVerts(
        x,
        y,
        tileHeight,
        levelOffsetY,
      );
      mergeInto(getAccum(materialKey), positions, indices, uvs);
    }
  }

  // Build response groups with transferable buffers
  const groups: GeometryGroupBuffer[] = [];
  const transferables: ArrayBuffer[] = [];

  accums.forEach((accum, materialKey) => {
    if (accum.positions.length === 0) return;

    const normals = computeNormals(accum.positions, accum.indices);

    const positions = new Float32Array(accum.positions);
    const indices = new Uint32Array(accum.indices);
    const normalsF = new Float32Array(normals);
    const uvsF = new Float32Array(accum.uvs);

    groups.push({
      materialKey,
      isRoof: roofKeys.has(materialKey),
      positions,
      indices,
      normals: normalsF,
      uvs: uvsF,
    });

    transferables.push(
      positions.buffer,
      indices.buffer,
      normalsF.buffer,
      uvsF.buffer,
    );
  });

  const response: GeometryWorkerResponse = {
    requestId,
    groups,
    tileCount: tiles.length,
  };

  // eslint-disable-next-line no-restricted-globals
  (self as any).postMessage(response, transferables);
};
