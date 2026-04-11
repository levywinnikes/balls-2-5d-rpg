# World Generator Contract (v2.50)

This contract defines the absolute rules for the Procedural World Engine. AI agents must follow these standards to ensure world consistency, traversability, and rendering integrity.

## 1. Procedural Engine Standards
- **Grid Standard**: All geometry and placement must be multiples of 32 (32px Grid).
- **Infinite Depth Support**: The engine officially supports 8 floors (Z:+3 to Z:-4).
- **Spawn Integrity**: Level 0 at (128, 128) must be a 10x10 dry, monster-free pavement plaza.
- **Actor/Terrain Decoupling**: Entities (Player, Enemies, Items) MUST be stored in the `entities` array per level, NOT in the floor `map` grid. This allows entities to stand on any biome naturally.

## 2. Perspective & Height (The 2.5D Rule)
- **Root Position**: All structures start at a physical $(X, Y)$ coordinate.
- **Vertical Shift**: For every floor level $Z$, the structure is visually offset in the map grid at $(X, Y - Z)$.
- **Constant Footprint**: The $(W, H)$ of a house remains identical across levels.
- **Roof Persistence**: Roofs are placed at $Z_{max} + 1$, matching the top floor footprint but shifted by an additional -1 in the $Y$ axis.

## 3. Stair Pairing & Navigation (Global Alignment)
- **Global Sync**: A `sup` (stair_up) at Level $Z$ and a `sdn` (stair_down) at Level $Z+1$ MUST share the exact same global $(X, Y)$ coordinates for perfect verticality.
- **Alternating Shaft Rule (Multi-Story Standard)**: To prevent softlocks in buildings with 3+ floors, the `stair_up` and `stair_down` transitions on a single floor MUST NOT occupy the same space.
    - **Implementation**: Alternate the stair shaft X-coordinate based on floor parity (e.g., Even floors use X+2, Odd floors use X+4).
- **Phase Priority Rule**: All landing zone clearance and terrain smoothing (cleanup) MUST occur BEFORE placing functional objects (stairs, items, NPCs). Placing objects first and then running cleanup causes critical bugs (overwriting functional tiles with floor).
- **Safe Landing Rule (The 2-Tile Offset)**: To prevent infinite loops, the player MUST NOT spawn directly on top of the return stair.
    - **Ascending**: Player arrives at `(X, Y-2)` relative to the original `sup` coordinate.
    - **Descending**: Player arrives at `(X, Y+2)` relative to the original `sdn` coordinate.
- **Landing Safety**: `ensureSafeTransition` must be called to guarantee a 1x1 walkable `floor` tile at the landing destination.
- **Cave Access**: Level 0 must contain clear `hole` tiles leading to Level -1. Subterranean levels must have high stair density (40+ per level) for continuity.

## 4. Mandatory Metadata & Colors
- **Map Presence**: EVERY tile definition MUST include a `color` attribute (Hex string).
- **Color Consistency**: The color should represent the average visual tone of the tile for the World Map.
- **Minimap Logic**: Failure to provide a color results in a black void (Critical Bug).

## 5. Urban & Architectural Standards
- **Town Foundation**: The town square (100-175 range) MUST be on a `pavement` (`pav`) foundation.
- **Interior Materials**: Houses must use `floor` tiles as their ground material to prevent grass indoors.
- **Persistence**: Terrain tiles MUST NOT be overwritten or removed to place entities.

## 6. Population & Biomes
- **Safe Zones**: Town (Level 0, 100-175) is a strict 0% monster zone.
- **Depth Tiering**:
    - **Highlands (Z:+1 to +3)**: 0.1% density.
    - **Surface (Z:0)**: 0.3% density (Rats).
    - **Caves (Z:-1 to -3)**: 1.5% - 4% density (Skeletons/Goblins).
    - **Abyss (Z:-4)**: 6% density (Orcs/Dragons).

## 7. Geographical Features
- **Solid Coastlines**: Water -> Sand -> Grass transitions must be contiguous and noise-free.
- **Smoothing Pass**: Use transitional tiles (e.g., `grs_wat_n`) to eliminate square edges. Priority: Snow > Grass > Path > Sand > Water.

## 8. Rendering & Logic
- **Culling**: Renderer only processes within viewport + 2 tile buffer.
- **Invisibility**: Upper levels ($Z+1$) are hidden when the player is under a roof.
- **Tile Comments**: Mandatory: `// MANDATORY: Ensure 'color' is defined for Minimap/WorldMap support.`
