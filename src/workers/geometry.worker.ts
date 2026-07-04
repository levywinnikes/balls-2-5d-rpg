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
  geometryProfile?:
    | "box"
    | "stair"
    | "slab"
    | "water-hole"
    | "ramp-n"
    | "ramp-s"
    | "ramp-e"
    | "ramp-w";
  // Backward compatibility with old descriptors.
  isStair?: boolean;
  /** `up` = climb north; `down` = descend north (mirrored mesh + height). */
  stairDir?: "up" | "down";
  height: number; // world-unit height of this tile
  levelOffsetY: number; // world Y of the floor for this level
  materialKey: string; // "kind:hexcolor" — determined by main thread
  /** Depth below rim for `water-hole` profile. */
  pitDepth?: number;
  /** Bit mask: 1=N, 2=S, 4=E, 8=W — wall when neighbor is not water. */
  pitWallMask?: number;
}

export interface GeometryWorkerRequest {
  requestId: string; // chunk key e.g. "3_5"
  tiles: TileDescriptor[];
}

export interface GeometryGroupBuffer {
  materialKey: string;
  tileKey?: string; // "tx_ty" for per-tile meshes (blocking/wall tiles)
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
/** Keep in sync with runtime `FLOOR_SLAB_THICKNESS`. */
const FLOOR_SLAB_THICKNESS = 0.32;
/** Keep in sync with `StairConfig3D.ts` STAIR_STEP_COUNT. */
const STEP_COUNT = 8;

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
// Stair geometry (4-step staircase, south→north)
// ---------------------------------------------------------------------------

function buildStairVerts(
  x: number,
  y: number,
  baseY: number,
  stairDir: "up" | "down" = "up",
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

    let y0: number;
    let y1: number;
    // South (+Z / high localZ) = entry; north (−Z) = exit — must match StairConfig3D + solid fill.
    if (stairDir === "up") {
      const risenSteps = i + 1;
      y1 = baseY + FLOOR_SLAB_THICKNESS + risenSteps * stepRise;
      y0 = y1 - stepRise;
    } else {
      const treadTop =
        baseY + LEVEL_HEIGHT_UNITS + FLOOR_SLAB_THICKNESS - i * stepRise;
      y1 = treadTop;
      y0 = y1 - stepRise;
    }

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

/** Solid backing under treads — closes the void below walkable stairs. */
function buildStairSolidFillVerts(
  x: number,
  y: number,
  baseY: number,
  stairDir: "up" | "down" = "up",
): { positions: number[]; indices: number[]; uvs: number[] } {
  const x0 = x;
  const x1 = x + 1;
  const z0 = y;
  const z1 = y + 1;
  const fillDepth = 0.28;
  const yBot = baseY - fillDepth;

  let yNorth: number;
  let ySouth: number;
  if (stairDir === "up") {
    ySouth = baseY;
    yNorth = baseY + LEVEL_HEIGHT_UNITS;
  } else {
    ySouth = baseY + LEVEL_HEIGHT_UNITS;
    yNorth = baseY;
  }

  const positions = [
    x0, yBot, z1,
    x1, yBot, z1,
    x1, yBot, z0,
    x0, yBot, z0,
    x0, ySouth, z1,
    x1, ySouth, z1,
    x1, yNorth, z0,
    x0, yNorth, z0,
  ];
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 7, 6, 4, 6, 5,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
  ];
  const uvs = [
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
  ];
  return { positions, indices, uvs };
}

// ---------------------------------------------------------------------------
// Ramp wedge geometry (closed prism with sloped top)
// ---------------------------------------------------------------------------

function buildRampVerts(
  x: number,
  y: number,
  levelOffsetY: number,
  height: number,
  direction: "n" | "s" | "e" | "w",
): { positions: number[]; indices: number[]; uvs: number[] } {
  const x0 = x;
  const x1 = x + 1;
  const z0 = y;
  const z1 = y + 1;
  const yBot = levelOffsetY;

  // Corner heights for top surface (NW, SW, SE, NE)
  let yNW = yBot;
  let ySW = yBot;
  let ySE = yBot;
  let yNE = yBot;

  if (direction === "n") {
    ySW = yBot + height;
    ySE = yBot + height;
  } else if (direction === "s") {
    yNW = yBot + height;
    yNE = yBot + height;
  } else if (direction === "e") {
    yNW = yBot + height;
    ySW = yBot + height;
  } else {
    yNE = yBot + height;
    ySE = yBot + height;
  }

  const positions = [
    // top (+Y-ish)
    x0,
    yNW,
    z0,
    x0,
    ySW,
    z1,
    x1,
    ySE,
    z1,
    x1,
    yNE,
    z0,
    // bottom (-Y)
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
    // north face (-Z)
    x0,
    yBot,
    z0,
    x0,
    yNW,
    z0,
    x1,
    yNE,
    z0,
    x1,
    yBot,
    z0,
    // south face (+Z)
    x1,
    yBot,
    z1,
    x1,
    ySE,
    z1,
    x0,
    ySW,
    z1,
    x0,
    yBot,
    z1,
    // east face (+X)
    x1,
    yBot,
    z0,
    x1,
    yNE,
    z0,
    x1,
    ySE,
    z1,
    x1,
    yBot,
    z1,
    // west face (-X)
    x0,
    yBot,
    z1,
    x0,
    ySW,
    z1,
    x0,
    yNW,
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

/** Quake-style pool: depressed floor + inner walls; water surface is a separate effect at rim. */
function buildWaterHoleVerts(
  x: number,
  y: number,
  levelOffsetY: number,
  holeDepth: number,
  pitWallMask: number,
  rimOffsetY: number,
): { positions: number[]; indices: number[]; uvs: number[] } {
  const x0 = x;
  const x1 = x + 1;
  const z0 = y;
  const z1 = y + 1;
  const rimY = levelOffsetY + rimOffsetY;
  const bottomY = rimY - Math.max(0.08, holeDepth);

  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];

  const pushQuad = (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
    dx: number,
    dy: number,
    dz: number,
  ) => {
    const base = positions.length / 3;
    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
  };

  pushQuad(x0, bottomY, z0, x0, bottomY, z1, x1, bottomY, z1, x1, bottomY, z0);

  const inset = 0.03;
  const ix0 = x0 + inset;
  const ix1 = x1 - inset;
  const iz0 = z0 + inset;
  const iz1 = z1 - inset;

  if (pitWallMask & 1) {
    pushQuad(ix0, bottomY, z0, ix1, bottomY, z0, ix1, rimY, z0, ix0, rimY, z0);
  }
  if (pitWallMask & 2) {
    pushQuad(ix1, bottomY, z1, ix0, bottomY, z1, ix0, rimY, z1, ix1, rimY, z1);
  }
  if (pitWallMask & 4) {
    pushQuad(x1, bottomY, iz1, x1, bottomY, iz0, x1, rimY, iz0, x1, rimY, iz1);
  }
  if (pitWallMask & 8) {
    pushQuad(x0, bottomY, iz0, x0, bottomY, iz1, x0, rimY, iz1, x0, rimY, iz0);
  }

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

  // Group tiles: blocking tiles get per-tile keys (one mesh per tile),
  // non-blocking tiles merge by materialKey as before.
  const accums = new Map<string, GeomAccum>();

  const getAccum = (key: string): GeomAccum => {
    let a = accums.get(key);
    if (!a) {
      a = { positions: [], indices: [], uvs: [] };
      accums.set(key, a);
    }
    return a;
  };

  for (const tile of tiles) {
    // For blocking (wall) tiles use a per-tile key so each tile becomes its own mesh.
    // This allows per-tile visibility control for the wall-occlusion system.
    const perTileSuffix = tile.isBlocking ? `@@${tile.x}_${tile.y}` : "";
    const accumKey = `${tile.materialKey}${perTileSuffix}`;
    const accum = getAccum(accumKey);
    const {
      x,
      y,
      geometryProfile,
      isStair,
      height,
      levelOffsetY,
    } = tile;

    const profile = (geometryProfile || (isStair ? "stair" : "box")) as
      | "box"
      | "stair"
      | "slab"
      | "water-hole"
      | "ramp-n"
      | "ramp-s"
      | "ramp-e"
      | "ramp-w";
    const tileHeight = Math.max(0.03, height);

    if (profile === "stair") {
      const stairDir = tile.stairDir === "down" ? "down" : "up";
      if (stairDir === "down") {
        // Down stairs do not need to render steps geometry because the up-stair tile on the level below
        // already renders the full staircase. We just continue here so no floor slab is generated,
        // leaving the hole open.
        continue;
      }
      const stairBaseY = levelOffsetY;
      const { positions, indices, uvs } = buildStairVerts(
        x,
        y,
        stairBaseY,
        stairDir,
      );
      mergeInto(accum, positions, indices, uvs);
      // No solid wedge fill — it duplicated a ramp under the treads (FP looked like
      // two stacked stairs). Tread side faces close the mesh; void below is culled top-down.
      continue;
    }

    if (profile === "slab") {
      const { positions, indices, uvs } = buildFloorQuadVerts(
        x,
        y,
        levelOffsetY + tileHeight,
      );
      mergeInto(accum, positions, indices, uvs);
      continue;
    }

    if (profile === "water-hole") {
      const depth = Math.max(0.08, tile.pitDepth ?? 0.22);
      const { positions, indices, uvs } = buildWaterHoleVerts(
        x,
        y,
        levelOffsetY,
        depth,
        tile.pitWallMask ?? 0,
        0.06,
      );
      mergeInto(accum, positions, indices, uvs);
      continue;
    }

    if (
      profile === "ramp-n" ||
      profile === "ramp-s" ||
      profile === "ramp-e" ||
      profile === "ramp-w"
    ) {
      const dir = profile.split("-")[1] as "n" | "s" | "e" | "w";
      const { positions, indices, uvs } = buildRampVerts(
        x,
        y,
        levelOffsetY,
        tileHeight,
        dir,
      );
      mergeInto(accum, positions, indices, uvs);
      continue;
    }

    const { positions, indices, uvs } = buildBoxVerts(
      x,
      y,
      tileHeight,
      levelOffsetY,
    );
    mergeInto(accum, positions, indices, uvs);
  }

  // Remove the old materialKey variable reference — we now use accumKey directly.

  // Build response groups with transferable buffers.
  // Per-tile blocking tiles encode the tile coords after "@@"; parse it back out.
  const groups: GeometryGroupBuffer[] = [];
  const transferables: ArrayBuffer[] = [];

  accums.forEach((accum, accumKey) => {
    if (accum.positions.length === 0) return;

    // Split accumKey on "@@" to recover materialKey and optional tileKey
    const sepIdx = accumKey.lastIndexOf("@@");
    const materialKey = sepIdx < 0 ? accumKey : accumKey.substring(0, sepIdx);
    const tileKey = sepIdx < 0 ? undefined : accumKey.substring(sepIdx + 2);

    const normals = computeNormals(accum.positions, accum.indices);

    const positions = new Float32Array(accum.positions);
    const indices = new Uint32Array(accum.indices);
    const normalsF = new Float32Array(normals);
    const uvsF = new Float32Array(accum.uvs);

    groups.push({
      materialKey,
      tileKey,
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
