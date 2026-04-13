# Binary Map System (BMS) - Technical Documentation

## Overview
The **Binary Map System (BMS)** is the core architectural standard for world management in the Balls 2.5D RPG. It replaces legacy 2D JSON arrays with high-performance binary buffers (`Uint8Array`), allowing for continental-scale maps (1024x1024+) with minimal memory usage and instant loading.

## 1. Data Structure

### A. Metadata (`maps/[name].json`)
The JSON file acts as the header for the map, containing globally shared properties and level pointers.

| Property | Type | Description |
| :--- | :--- | :--- |
| `width` | `number` | Width of all levels in tiles. |
| `height` | `number` | Height of all levels in tiles. |
| `tileSize` | `number` | Size of a single tile in pixels (default: 32). |
| `tileAtlas` | `string[]` | Ordered list of tile symbols. Index matches binary byte value. |
| `levels` | `Record` | Map of level IDs to `LevelData`. |

### B. Binary Levels (`maps/[name]_[level].bin`)
Each level is a flat `Uint8Array` where:
- **1 byte = 1 tile**.
- The value at index `i` is the index of the symbol in the `tileAtlas`.
- **Coordinate Mapping**: Index `i = y * width + x`.

## 2. Source of Truth: `MapLoader`
All systems **MUST** use the `MapLoader` singleton to access map data. Direct access to `mapData.levels[z].map` is strictly forbidden and will cause runtime crashes.

### Key Methods:
- `getTileAt(x, y, level)`: Returns the symbol string for a tile.
- `getBinaryLevels()`: Returns the raw buffers (used by renderers and services).
- `loadAllLevels(mapName)`: Asynchronously streams all `.bin` files into memory.

## 3. Tile & Entity Definitions
Property names have been standardized to avoid ambiguity:
- **`tileDefinitions`**: Metadata for terrain types (collisions, colors, transitions).
- **`entityTemplates`**: Templates for spawning NPCs, Enemies, and Containers.

### Transition Logic:
Tiles with the `transition` property define level connections:
- `up`: Character moves to level Z+1 (Manual Interaction required).
- `down` / `dwn` / `hole`: Character moves to level Z-1 (Automatic or step-on).

## 4. Performance Optimizations
- **Worker-Side Pathfinding**: The `NavigationService` passes binary buffers to workers to avoid blocking the main thread.
- **Pre-rendered Minimap**: `WorldMapService` renders the entire world to static canvas buffers once at startup, allowing UI components to simply "copy" slices of the map instantly.

## 5. Legado (Atenção)
Qualquer arquivo que ainda utilize `.map[` ou tente calcular o tamanho via `.map.length` está **OBSOLETO** e deve ser refatorado para usar `mapData.width` e `mapData.height`.

---
*Last Updated: 2026-04-13*
*Reference File: src/game/maps/MapLoader.ts*
