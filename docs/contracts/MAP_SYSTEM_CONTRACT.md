# Map System & 2.5D Contract

## 1. Grid & Projection

- **Base Grid**: **32×32 pixels** per tile. This is the _canonical_ unit for all positioning and rendering.
- **Graphic Architecture (Tiles)**: Tile foundations (floors, walls, structural map tiles) are procedural runtime generation (`Phaser.Graphics`). External textures are forbidden for tile foundations.
- **Graphic Architecture (Entities)**: Gameplay entities (actors, enemies, sprite props) follow `SPRITE_PIPELINE_CONTRACT.md` and may use authored sprite atlases.
- **Visual Style**: Casual and upbeat adventure. Use vibrant colors and clean geometric shapes.
- **Projection**: Oblique (Tibia-style). Camera is top-down with slight Y-axis compression.
- **Z-Axis (Floors)**: Separation is `10,000` units per level. Level 0 = ground, positive = upper floors/roofs, negative = underground.

## 2. Camera & Viewport

- **Camera Zoom**: Calculated in `GameScene.handleResize()`.
  - Formula: `zoom = screenWidth / (VISIBLE_TILES_WIDTH * TILE_SIZE)`
  - `TILE_SIZE = 32` (must NOT be 128)
  - `VISIBLE_TILES_WIDTH = 20` (tiles visible on screen horizontally)
- **Follow**: Camera follows player with `lerp(0.1, 0.1)` for smooth movement.
- **Bounds**: Camera is bounded to the full map extent (`mapWidth × mapHeight` pixels).

## 3. Collision System

- **Body Size**: For all standard tiles (Walls, Trees, Rocks, Mountains), `bodySize = { width: 32, height: 32 }`.
- **Body Offset**: For standard tiles at `origin(0.5, 0.5)`, `bodyOffset = { x: 0, y: 0 }`.
- **Wall System (UNIFIED)**: All wall tile variants are now unified. Since everything is a 32x32 square, there is NO visual or physics distinction between "side", "front", or "corner" walls. They all use `GenericWallGraphic`.
- **Legacy Cleanup**: Avoid any use of `setScale(4)` or `128px` base sizes in graphic classes.

## 4. Dynamic Level Renderer (`DynamicLevelRenderer.ts`)

- **Culling**: Only tiles within the `renderRadius` of the player are active.
- **Pooling (TilePool)**: Sprites are reused from a central pool to prevent GC spikes.
- **Under Logic**:
  - Tiles can have an `under` property.
  - If `under: "..."`, it means "transparent to the level below".
  - The renderer recursively fetches the lower level's tile for that coordinate.
- **Transparency (Upper-Structure Occlusion)**: When a player is physically under tiles from upper levels, those upper level tiles become semi-transparent or are culled via the `update()` loop. This applies to any structure type; no special roof category is required.

## 5. Map Loader (`MapLoader.ts`)

- **tileSize**: Read from `data.tileSize` in the JSON file. Must be `32`.
- **Normalization**: Every level in a map MUST be padded (with `"wat"` for floor 0 or `"..."` for others) to match the dimensions of the largest floor.
- **Line of Sight (LOS)**:
  - Algorithm: **Bresenham's** with steps of `tileSize / 4` for accuracy.
  - Rules: Defined in `TileRegistry.doesTileBlockRanged()`.

## 6. Map Data Structure

- **Canonical BMS shape**:
  - `tileAtlas`: symbol table for binary levels
  - `tileDefinitions`: per-symbol tile metadata
  - `entityTemplates`: per-symbol entity metadata
  - `levels[level].binFile`: binary layer
  - `levels[level].entities[]`: per-instance placed entities
- **Symbols**:
  - binary tile cells resolve through `tileAtlas` -> `tileDefinitions`
  - `levels[level].entities[].symbol` resolves through `entityTemplates`
- **Per-instance overrides**: entities may carry `uuid`, `contents`, `locked`, `keyId`, and similar state-seeding fields when the map needs multiple instances of the same template with different defaults.
- **Respawn**: entities can specify a `respawn` time in milliseconds.

### 6.1 Interactive door entity

Doors are **entity instances**, not a special save-only concept.

Suggested template:

```json
{
  "type": "door",
  "id": "wooden_door",
  "block": true,
  "locked": false,
  "keyId": null
}
```

Suggested placed instance:

```json
{
  "x": 12,
  "y": 8,
  "symbol": "dor",
  "uuid": "door_debug_01",
  "locked": false,
  "keyId": "bronze_key"
}
```

Rules:

- **`uuid` is required** for persistent doors.
- `locked` / `keyId` may live on the template and be overridden per instance.
- Closed doors must be treated as **blocking** for collision, LOS, and pathfinding.
- Open doors must be treated as **non-blocking**.
- Runtime should persist mutable door state separately from the static map file.

## 7. Entities & Items

- **DroppedItem**: Display size `24×24px` (75% of 32px tile). Body size `20×20`, offset `2, 2`.
- **ContainerRegistry**: All containers use procedural textures. No PNG assets.
- **Enemy Size**: World integration baseline remains tile-compatible (32x32 world unit). Source sprite canvases can be larger according to `SPRITE_PIPELINE_CONTRACT.md`.

## 8. Geometry Profiles (3D Natural Composition)

- **No Special Roof Category**: "Roof" is not a runtime category. Any overhead/cap is just structure assembled in upper levels.
- **Per-Tile Geometry Piece**: Tiles may declare `geometryProfile` to select a generic mesh piece in the worker pipeline.
- **Current Canonical Profiles**:
  - `box`: full block (default for structural tiles)
  - `stair`: stepped ramp
  - `slab`: thin top surface piece
  - `ramp-n`, `ramp-s`, `ramp-e`, `ramp-w`: sloped wedge pieces
- **Composition Rule**: New geometry types must snap to the same tile grid/level coordinates and height conventions so pieces fit together without ad-hoc offsets.
