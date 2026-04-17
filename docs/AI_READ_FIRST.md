# 🤖 AI QUICK-START DATA SHEET

## 1. DATA ACCESS & BMS (CRITICAL)

- **Forbidden**: `levelData.map`, `levelData.tiles`, `mapData.tiles`.
- **Allowed**:
  - `mapData.tileDefinitions` (Metadata)
  - `mapData.entityTemplates` (Portals/NPCs)
  - `MapLoader.getTileAt(x, y, level)` (Tile data)
  - `mapData.width` / `mapData.height` (Dimensions)

## 2. KEY SERVICE HUB

| Logic Category | Target File |
| :--- | :--- |
| Map Loading/Indexing | `src/game/maps/MapLoader.ts` |
| UI State / Fog of War | `src/game/entities/Player/PlayerState.ts` |
| Minimap Buffers | `src/services/WorldMapService.ts` |
| Level Transitions | `src/game/systems/TransitionSystem.ts` |
| Navigation Workers | `src/services/NavigationService.ts` |

## 3. COMMON SIDE EFFECTS

When you change the map system, look for regressions in:

- **Minimap**: If `WorldMapService` doesn't emit `buffersReady`, the UI stays stuck in "Loading".
- **Pathfinding**: Navigation workers expect a flat `Uint8Array`. Any change to buffer structure BREAKS pathfinding.
- **Urban Spawn**: Spawn points are read from JSON metadata `config.startLevel`. Any change to JSON structure might spawn the player in the sea.

## 4. TILE COLORS & GRAPHICS

Tiles are drawn procedurally in `src/game/graphics/tiles/`.

- Colors are cached in `WorldMapService.colorCache`.
- To add a new tile, register it in `TileRegistry.ts`.

## 5. SAFETY CHECK (BMS CONTRACT)

- Run `npm run check:bms` before opening a PR that touches map-related code.
- The guard fails if forbidden legacy patterns are found (e.g. `levelData.map`, `levelData.tiles`, `mapData.tiles`).

---
*Reference current implementation plan for full context.*
