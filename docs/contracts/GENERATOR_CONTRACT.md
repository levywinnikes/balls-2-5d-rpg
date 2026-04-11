## 1. Procedural Engine Standards
- **Grid Standard**: All geometry and placement must be multiples of 32 (32px Grid).
- **Infinite Depth Support**: The engine now officially supports an 8-level verticality (Z:+3 to Z:-4).
- **Spawn Integrity**: Every generated map MUST include exactly one `ply` symbol placed on a valid, non-collidable tile on Level 0.

## 2. Perspective & Height (The 2.5D Rule)

To simulate depth and height in our coordinate-fixed engine, the **Perspective Offset Rule** must be strictly applied:

- **Root Position**: All structures have a physical "footprint" on Level 0 at $(X, Y)$.
- **Vertical Shift**: For every floor level $Z$, the structure must be stored in the map grid at $(X, Y - Z)$.
    - Example: A wall that is physically at $(10, 10)$ on ground level will be at $(10, 9)$ on Level 1, and $(10, 8)$ on Level 2.
- **Constant Footprint**: The width ($W$) and height ($H$) of the house floor MUST remain identical across all levels to ensure structural alignment.
- **Roof Persistence**: The roof MUST be placed on the level above the topmost floor ($Z_{max} + 1$), matching its dimensions but shifted by an additional -1 in the $Y$ axis relative to that floor.

## 4. Mandatory Metadata & Colors
- **Map Presence**: EVERY tile definition (in JSON or Registry) MUST include a `color` attribute (Hex string, e.g., `#ffffff`).
- **Minimap Visibility**: Failure to provide a color will result in black "void" spots on the World Map, which is considered a CRITICAL BUG.
- **Color Consistency**: The color should represent the average visual tone of the tile.
- **Entity Biome Alignment**: The `under` attribute of an entity MUST match the dominant biome of its spawn location (e.g., Rats on Surface = `grs`, Skeletons in Caves = `flr`).

## 3. Stair Pairing & Navigation

Vertical traversal must follow strict coordinate mapping to prevent collision errors:

- **Safe Landing Offset**: To prevent transition loops, the "landing spot" for a player ascending from Level $Z$ at $(X, Y)$ MUST be Level $Z+1$ at $(X, Y-1)$.
- **Stair Pairing Standard**: The `stair_down` at Level $Z+1$ MUST be placed at precisely the same $(X, Y)$ coordinate as the `stair_up` at Level $Z$. This ensures the player lands 1 tile North of the descent stair, preventing an immediate and unintentional return loop.

## 3. Natural Terrain Perspective (Hills & Mountains)
Hills and mountain ranges on the surface must provide a sense of elevation:
- **Entrance Depth**: The roof/peak of a hill MUST start at least **1 tile ABOVE** the entrance door or opening.
- **Climbable Slopes**: Mountains should include "Mountain Path" tiles that allow the hero to ascend without using stairs when appropriate.

## 4. Living Spaces & Furniture
Structures defined as "Houses" must contain functional interior layouts:
- **Beds**: Consist of two tiles: `bed_head` (Top) and `bed_foot` (Bottom).
- **Placement**: Beds must ONLY be placed against walls on `floor` tiles.
- **Density**: Each house should have at least 1-2 pieces of furniture (Beds, Chests, Altars) to avoid a "barren" feel.

## 5. Population Density & Biomes
To prevent the game from feeling like a continuous battlefield, population must be tiered:

| Level | Density | Notes |
| :--- | :--- | :--- |
| **Z:+3/+2 (Sky)** | **0%** | Empty of enemies. Reserved for future flying entities. |
| **Z:1 (Highlands)**| **0.1%**| Extremely rare. Mostly peaceful high-ground. |
| **Z:0 (Surface)** | **< 0.5%** | Enemies should be rare. Focus on peaceful travel. |
| **Z:0 (Town)** | **0%** | **SAFE ZONE**. No enemies allowed within town limits. |
| **Z:-1 (Caves)** | **2-3%** | Standard enemies (Rats, Skeletons, Goblins). |
| **Z:-2/-3 (Depths)**| **4%** | Dense populations. |
| **Z:-4 (Abyss)** | **6%** | High danger (Orcs, Dragons). |

## 6. Hydrography & Coastline Standards

Geographical features must exhibit coherence to ensure a premium world feel:
- **Solid Coastlines**: Transitions from `water` to `sand` to `grass` must be defined by clear distance buffers. Random "water noise" within the beach area is strictly forbidden.
- **Continuous Rivers**: Rivers MUST be generated as contiguous paths of `water` tiles. They should ideally flow from central high-ground (Caves/Town) towards the ocean.
- **River Width**: Rivers should be between 1 and 2 tiles wide to allow for bridge crossings in future updates.

## 7. Biome Clustering (Natural Features)
Trees and biological entities must not be scattered purely at random:
- **Forest Clusters**: Trees (`tre`) should be grouped in patches using noise patterns (e.g., Sine/Cosine density) to create clear wooded areas and clear meadows.
- **Quarry Clusters**: Rocks (`rok`) should appear in small groupings, simulating natural outcrops rather than isolated boulders.

## 8. Terrain Priority & Auto-tiling (Smoothing)

To eliminate square "staircase" edges, the generator must apply a smoothing pass based on the **Terrain Priority Hierarchy**:

1. **Snow** (Highest - Overlays all)
2. **Grass** 
3. **Path**
4. **Sand**
5. **Water** (Lowest - Base terrain)

### 5. Standards for Transition Tiles (Auto-tiling)
- **Hybrid Naming**: `[Higher]_[Lower]_[Direction]` (e.g., `grs_wat_n`).
- **50/50 Geometric Rule**: All terrain transitions MUST follow perfect 50% area splits.
- **Directional Geometry**:
  - `n/s/e/w`: Rectangular half-splits fixed at exactly 16px.
  - `nw/ne/sw/se`: Triangular splits cutting exactly from corner to corner (32px diagonal).
- **Handshake Standard**: By using fixed 50% proportions, all tiles are guaranteed to align at the 32px vertices or 16px midpoints, ensuring mathematical stability across the procedural grid.

## 10. Urban Standards (The Town Rule)
Geographical and structural rules for the Town:
- **Concrete Foundation**: The entire town square (100-175 range) MUST be layed upon a `pavement` (`pav`) tile, overwriting natural features like water or trees.
- **Sanctuary (Safe Zone)**: No hostile entity spawning is allowed within the town limits on Level 0.
- **Architectural Floors**: Buildings above-ground ($Z \ge 0$) must ALWAYS use `floor` as their base material for landing zones to prevent "grass interiors".

## 11. Subterranean Standards (The Cave Rule)
- **Organic Shapes**: Subterranean walls must be generated using Cellular Automata to create natural, sinuous shapes.
- **Stair Chains**: Every cave level MUST have at least 5-10 stair pairs (`sdn`/`sup`) connecting to the level below.
- **Landing Safety**: `ensureSafeTransition` must be called for EVERY stair to clear a 3x3 footprint at the destination.
- **The Magma Core**: Level -4 is the only level allowed to contain `lava` and `basalt` tiles. Levels -1 to -3 must remain organic stone.

## 12. Rendering & Performance
- **Tile Culling**: The `DynamicLevelRenderer` only renders tiles within the viewport plus a 2-tile buffer.
- **Minimap Support**: All tiles MUST have a `color` attribute in their registry definition for accurate map display. **No exceptions.**
- **Culling Invisibility**: Upper tiles ($Z+1$) should be hidden when the player is inside a building to prevent roof obscuration.

## 13. AI Mandatory Comments
When creating or registering a tile, the following comment must be placed:
`// MANDATORY: Ensure 'color' is defined for Minimap/WorldMap support.`
