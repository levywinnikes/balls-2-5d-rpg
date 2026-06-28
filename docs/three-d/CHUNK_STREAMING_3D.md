# 3D Chunk Streaming & Geometry Worker

Deep reference for tile mesh streaming. Summary also in [SLICE_RUNTIME.md §9](./SLICE_RUNTIME.md#9-chunk-streaming).

**Code:** `createDebugSliceScene.ts` (`updateChunks`, `buildChunk`), `src/workers/geometry.worker.ts`

Related: [SYSTEMS_INVENTORY.md](./SYSTEMS_INVENTORY.md), [../contracts/MAP_SYSTEM_CONTRACT.md](../contracts/MAP_SYSTEM_CONTRACT.md)

---

## 1. Purpose

Continental maps (512×512+) cannot mesh all tiles at once. The slice:

1. Divides the active BMS level into **16×16 tile chunks**
2. Builds only chunks within a **Chebyshev radius** of the player
3. Offloads vertex math to a **Web Worker**
4. Unloads distant chunks under a per-tick budget

---

## 2. Constants

| Symbol | Value | Meaning |
| :--- | :--- | :--- |
| `CHUNK_SIZE` | 16 | Tiles per chunk edge |
| `TOPDOWN_DRAW_RADIUS_CHUNKS` | 3 | Product camera load radius |
| `FIRST_PERSON_DRAW_RADIUS_CHUNKS` | 4 | Debug FP radius |
| `TOPDOWN_CHUNK_BUILD_BUDGET_PER_TICK` | 2 | Max new chunks per update |
| `FIRST_PERSON_CHUNK_BUILD_BUDGET_PER_TICK` | 3 | FP build budget |
| `CHUNK_UNLOAD_BUDGET_PER_TICK` | 8 | Max unloads per update |
| `CHUNK_UPDATE_INTERVAL` | 0.2 s | How often `updateChunks` runs |
| `LEVEL_HEIGHT_UNITS` | 2.0 | Vertical spacing per BMS level (worker + slice) |

Player chunk index:

```text
cx = floor(player.x / 16)
cy = floor(player.z / 16)
```

---

## 3. Update algorithm (`updateChunks`)

1. **Unload:** chunks with Chebyshev distance `> drawRadius + 1`, farthest first, max `CHUNK_UNLOAD_BUDGET_PER_TICK`
2. **LOD selection** per candidate chunk:

   | Distance (chunks) | LOD |
   | :---: | :---: |
   | ≤ 2 | 0 (full) |
   | ≤ 4 | 1 |
   | else in radius | 2 |

3. **LOD upgrade:** if player moves closer and loaded LOD is coarser than desired → `clearChunk` + rebuild
4. **Build:** sort candidates by distance, build up to budget via `buildChunk(cx, cy, lod)`
5. **Metrics:** assign `window.__slice3dChunkStreaming` (includes `visibleLevels`)

### Vertical level culling (Fase C)

`VerticalLevelVisibility3D.resolveVerticalVisibleLevels` filters which BMS levels are meshed per chunk build. Only levels in a **column radius** (~12 tiles) around the player are included:

- **Active level** — always
- **Upper floors** — if solid geometry exists in that column
- **Lower floors** — under void pits / down stairs / open shafts
- **Connectors** — `stu` / `std` / `levelTransition` ramps peek one adjacent floor

Debug: `window.__slice3dVerticalVisibility` in the browser console.

Stress map: `debug_vertical` — see [DEBUG_VERTICAL_MAP.md](../debug/DEBUG_VERTICAL_MAP.md).

---

## 4. Build pipeline (`buildChunk`)

Main thread per chunk:

1. Read tile symbols from binary level buffer (`loadLevelBinary`)
2. Resolve `tileDefinitions` → height, blocking, geometry profile, material color
3. Pack `TileDescriptor[]` for worker
4. `geometryWorker.postMessage(GeometryWorkerRequest)`
5. On response: create Babylon meshes grouped by `materialKey`, register in `chunkMeshes`, `levelMeshes`

Roof tiles use **`buildRoofMesh`** on main thread (S12-BUG2: must be `Mesh` for vertex data).

---

## 5. Worker message protocol

Defined in `geometry.worker.ts` (shared types exported for main thread import).

### Request — `GeometryWorkerRequest`

```typescript
{
  requestId: string;   // chunk key "cx_cy"
  tiles: TileDescriptor[];
}
```

### `TileDescriptor` (main → worker)

| Field | Role |
| :--- | :--- |
| `x`, `y` | Tile grid coords (y = depth / Z) |
| `symbol`, `tileId` | BMS identity |
| `isBlocking` | Pathfinding alignment |
| `geometryProfile` | `box`, `stair`, `slab`, ramps, … |
| `height`, `levelOffsetY` | Extrusion / floor Y |
| `materialKey` | `"kind:#hexcolor"` batching key |

### Response — `GeometryWorkerResponse` (transferable)

```typescript
{
  requestId: string;
  groups: GeometryGroupBuffer[];  // positions, indices, normals, uvs per material
  tileCount: number;
}
```

Worker uses `postMessage(response, [transferables])` — **zero-copy** ArrayBuffers.

### Supported profiles (worker)

`box`, `stair`, `slab`, `ramp-n/s/e/w` — see worker implementation for stair step count (`STEP_COUNT = 4`).

---

## 6. Integration with other systems

| System | Interaction |
| :--- | :--- |
| Navigation | `rebuildNavigationGrid` on level load — separate from chunk meshes |
| Upper-level fade | Meshes tracked in `levelMeshes` for `updateUpperLevelVisibility` |
| Minimap | `WorldMapService.preRenderAll` — not chunk-dependent |
| Save | Chunk state not saved — rebuilt from BMS binary on load |

---

## 7. Debugging

```javascript
window.__slice3dChunkStreaming
// { playerChunk, loadedChunks, loadingChunks, builtThisTick, pendingCandidates, ... }
```

Sprint 1 tuning target: stable FPS with ≤2 builds/tick in top-down on 512×512 maps.

---

## 8. Future doc hooks

Optional extraction from slice if constants move to config: draw radius per map size, LOD distance tables, worker profile catalog per `tileDefinitions.renderAs`.
