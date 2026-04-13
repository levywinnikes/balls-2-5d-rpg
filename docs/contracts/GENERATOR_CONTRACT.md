# World Generator Contract (v5.0)

This contract defines the absolute rules for the Procedural World Engine. AI agents MUST follow these standards to ensure world consistency, traversability, and rendering integrity.

## 1. Procedural Engine Standards
- **Grid Standard**: All geometry and placement must be multiples of 32 (32px Grid).
- **Infinite Depth Support**: The engine officially supports floors from Z:+3 to Z:-4.
- **Actor/Terrain Decoupling**: Entities (Player, Enemies, Items) MUST be stored in the `entities` array per level, NOT in the floor `map` grid.

## 2. Perspective & Height (The 2.5D Rule)
- **Vertical Shift**: For every floor level $Z$, the structure is visually offset in the map grid at $(X, Y - Z)$.
- **Roof Persistence**: Roofs are placed at $Z_{max} + 1$, matching the top floor footprint but shifted by -1 in the $Y$ axis.

## 3. Stair Pairing & Navigation (CRITICAL)
- **Global Sync**: A `sup` at Level $Z$ and a `sdn` at Level $Z+1$ MUST share the exact same global $(X, Y)$ coordinates.
- **Alternating Shaft Rule**: Shafts MUST alternate X-coordinates based on floor parity (Even floors use X+2, Odd floors use X+4) to prevent multi-story softlocks.
- **Safe Landing (2-Tile Offset)**: 
    - **Ascending**: Player arrives at `(X, Y-2)` relative to the original `sup` coordinate.
    - **Descending**: Player arrives at `(X, Y+2)` relative to the original `sdn` coordinate.
- **Landing Safety**: `ensureSafeTransition` must be called to guarantee a walkable tile (`floor` or `dungeon_floor`) at the landing destination.

## 4. Vertical Structural Integrity (New in v5.0)
- **Support Foundation Requirement**: No habitable tile (floor) can exist at Level $Z > 0$ without a supporting structure at Level $Z-1$.
- **2.5D Foundation Offset**: A tile $(X, Y, Z)$ is visually "supported" by the tile at $(X, Y+1, Z-1)$.
- **Foundation Fill**: When building at $Z$, the generator MUST fill $(X, Y+1, Z-1)$ with a wall or solid basalt to prevent "floating" visuals.

## 5. Suspended Urban Architectures
- **The Platform City**: Cities (Town biome) are generated on **Level 1 (Z:1)**.
- **Sewer Sub-Level (Z:0)**: Beneath every city tile on Z:1, a sewer/basement system MUST exist on Z:0.
- **Platform Ledge Rule**: Any city tile on Z:1 that borders a non-city tile MUST have a `wall` (masonry) placed on Z:0 at $(X, Y+1)$ to serve as the platform foundation wall.
- **Access Holes**: `hole` symbols in the city pavement lead to the Sewer level. All `hole` arrival points at Z:0 must have a `stair_up` for return.

## 6. Compound Blueprint Architectures
- **Blueprint Logic**: Complex buildings (Churches, Mansions) must be defined as composite shapes (multiple rectangles at varying Heights).
- **Consitency**: Blueprints must automatically apply the **Support Foundation Requirement** to all sub-components.

---
*Note: This contract must be consulted and referenced in the header of all world generation scripts.*
