# AI Project Manual - Balls 2.5D RPG (Alpha 1)

> [!IMPORTANT]
> **MANDATORY PROTOCOL**: Before any development work, you MUST consult the **[Project Master Contract](file:///c:/Users/kifit/OneDrive/Documentos/GitHub/balls-2-5d2-rpg/docs/PROJECT_CONTRACT.md)**. 
> This document and its referenced sub-contracts in `docs/contracts/` represent the absolute truth for this repository. Update them whenever you change core systems.

## 1. Project Overview
**Name:** Balls 2.5D RPG (Alpha 1)
**Type:** Isometric/Top-down MMORPG-style Single Player Game (Tibia-inspired).
**Stack:**
- **Runtime:** Electron (Desktop App)
- **UI Framework:** React 19 (HUD, Menus, Editor UI)
- **Game Engine:** Phaser 3.90 (Game Loop, Rendering, Physics)
- **Data:** JSON-based Maps, Singleton State Management.

## 2. Architecture & Design Patterns
The project uses a **Hybrid Architecture**:
- **React**: Handles the UI overlay, Window Management, and HUD.
- **Phaser**: Handles the Game World, Rendering, Physics, and Inputs.

### Key Communication Bridges
- **React -> Phaser:** `window.game` (Global Phaser instance).
- **Phaser -> React:** Events via `PlayerState.getInstance().emit("event", data)`. The UI listens to these events in `UIContext` or components.
- **Shared State:** `PlayerState.ts` is the SINGLE SOURCE OF TRUTH for player data.

## 3. Directory Structure & Key Files
```
src/
├── context/       
│   └── UIContext.tsx       # Manages Windows (Equipment, Skills, etc)
├── editor/        
│   └── scripts/map-server.js # Local Node server for saving maps
├── game/          
│   ├── entities/  
│   │   ├── Player/PlayerState.ts # [CRITICAL] Singleton for Player Data
│   │   ├── EnemyRegistry.ts      # [CRITICAL] Enemy Definitions & Loot
│   │   ├── weapons/WeaponRegistry.ts # Item Definitions (Facade)
│   │   ├── containers/ContainerRegistry.ts # [NEW] Container Definitions
│   │   └── graphics/         # Sprite Graphics
│   ├── maps/      
│   │   ├── MapLoader.ts          # Parses JSON maps
│   │   └── DynamicLevelRenderer.ts # Handles Z-Level visibility
│   ├── scenes/    
│   │   └── GameScene.ts          # [CRITICAL] Main Logic Loop
│   └── systems/   
│       └── BattleSystem.ts       # Combat Logic (Damage, Armor, XP)
├── ui/            
│   └── GameOverlay.tsx     # React UI Root
└── App.tsx        # Entry point, initializes Phaser
```

## 4. Core Data Structures
Understanding these structures is vital for writing compatible code.

### 4.1 Player State (`PlayerState.ts`)
The Singleton `PlayerState` holds all persistent data.
```typescript
interface InventoryItem {
  uid: string;       // [CRITICAL] Unique instance ID. MUST be preserved in SaveSystem.ts to maintain container integrity.
  itemId: string;    // Reference to WeaponRegistry ID
  count: number;
}
```

### 4.2 Enemy Definition (`EnemyRegistry.ts`)
```typescript
interface EnemyDefinition {
  id: string;        // e.g., "skeleton"
  health: number;
  damage: number;
  speed: number;     
  exp: number;
  loot: {
    itemId: string;
    chance: number; // 0.0 - 1.0
  }[];
  defense: number;   
  armor: number;     
}
```

### 4.3 Item/Weapon Definition (`WeaponRegistry.ts`)
```typescript
interface WeaponDefinition {
  id: string;        // e.g., "iron_sword"
  type: "melee" | "ranged" | "shield" | "armor" | ...;
  damage: number;
  defense: number;
  armor: number;
  weight: number;    
}
```

### 4.4 Container Definition (`ContainerRegistry.ts`)
```typescript
interface ContainerDefinition {
  id: string;        // e.g., "wooden_chest"
  name: string;
  weight: number;
  maxSlots: number;  // Capacity limit (e.g. 10)
  movable: boolean;  // Can be dragged?
  graphic: { ... };  // Procedural Sprite (32x32)
}
```
**Note:** `WeaponRegistry` acts as a **Facade**. If an ID is not found in `weapons`, it queries `ContainerRegistry`. This maintains backward compatibility.

## 5. Key System Flows

### 5.1 Combat Flow (`BattleSystem.ts`)
1.  **Attack Initiated:** `BattleSystem.handlePlayerAttack` or `handleEnemyAttack`.
2.  **Roll Hit/Block:** 
    *   Attacker rolls `1..AttackValue`.
    *   Defender rolls `1..DefenseValue` (Shield/Skill).
    *   If `Defense > Attack` -> **BLOCKED** (Sparks effect).
3.  **Damage Calculation:** 
    *   If Hit: `Damage = AttackRoll - (DefenseRoll / 2)` (Partial mitigation).
4.  **Armor Reduction:** 
    *   `ArmorReduction = Random(Armor * 0.1, Armor)`.
    *   Final Damage = `Damage - ArmorReduction`.
5.  **Apply:** `Player.takeDamage()` or `Enemy.takeDamage()`.

### 5.2 Item Drop & Pickup
1.  **Drop:** `GameScene.dropItemFromInventory` -> Removes from `PlayerState` -> Spawns `DroppedItem` sprite. -> **Adds to `persistentDroppedItems`**.
2.  **Pickup:** Click -> `Player.moveTo` -> `GameScene.pickupItem` -> `PlayerState.addItem`.

### 5.3 Map & Z-Levels
-   **Files:** `newmap.json` contains `levels: { "0": {...}, "1": {...} }`.
-   **Coordinate System:** 
    *   **Tile Size:** 32x32 pixels.
    *   **World Pos:** `GridX * 32 + 16` (Center).
- **Under Property Rules**:
    *   `under` on a Tile/Entity refers to the **Symbol or ID** of the tile below it (e.g. `under: "flr"` or `under: "floor"`).
    *   **Absolute Transparency**: `...` in the map grid is a reserved symbol. It is NOT a tile key. It tells the engine to skip the current level and render the one below.
    *   **Partial Transparency**: Using `under: "..."` in a tile/entity definition draws the object and then recursively triggers the search for the tile in the floor beneath it.

### 5.4 Interaction & Distance Rules
- **Interaction Radius:** ~100px (Standard).
- **Hysteresis (Buffer Zone):**
    - **Open:** Player must be close (< 150px) to interact.
    - **Close:** Auto-close only triggers at **> 250px**.
    - **Rule:** NEVER set Close Distance <= Open Distance. This causes "flapping" (open/close loop) at the boundary.

### 5.5 Ranged Line of Sight (LOS)
1. **Definition**: `checkLineOfSight` verifies if there are obstructions between an attacker and a target.
2. **Implementation**: Centralized in `MapLoader.ts`.
    * Uses **Bresenham's Line Algorithm** with high precision (`tileSize / 4` steps).
    * Queries `TileRegistry.doesTileBlockRanged(tileId)` for every point along the line.
3. **Behavior**:
    * **Blocking**: Walls, mountains, and trees block projectiles.
    * **Non-Blocking**: Low objects like `wooden_chest`, `rock`, and `water` allow projectiles to pass over them, even if they are collidable (`isCollidable: true`).

## 6. Procedural Graphics Guidelines (32x32)

> [!TIP]
> **Minimalist Shape System**: All game visuals are generated at runtime using `Phaser.Graphics`. No external PNGs are allowed for gameplay entities.

**Standard Grid:** 32x32 pixels.

### Graphic Engine Protocols:
- **Tiles**: Inherit from `BaseTileGraphic`. Implement `drawTile(graphics)`.
- **Enemies**: Inherit from `BaseEnemyGraphic`. Implement `drawEnemy(graphics)`.
- **Items**: Use `ItemGraphic.create(scene, textureKey)`.
- **Animations**: Standardized in `BaseEnemyGraphic`. Use frame 0 for static procedural shapes.

### Drawing Rules:
- Use `graphics.fillStyle(color, alpha)`.
- Use `graphics.fillRect(x, y, w, h)` or `graphics.fillCircle(x, y, radius)`.
- Stay within the 32x32 coordinate space (0-31).
- **Prohibited**: Never use `setScale(4)` or draw outside the 32x32 boundary unless it is a multi-tile entity.

## 7. Common Development Tasks

### 7.1 How to Add a New Item
1.  Register in `WeaponRegistry.ts` (or `ItemRegistry.ts`).
2.  Define a unique `textureKey` (e.g., `item-fire-sword`).
3.  The `ItemGraphic` system will automatically generate a colored circle if not manually defined.

### How to Add a New Enemy
1.  Create `MyEnemyGraphic.ts` in `src/game/graphics/enemies/`.
2.  Inherit from `BaseEnemyGraphic`.
3.  Implement `protected drawEnemy(graphics: Phaser.GameObjects.Graphics): void`.
4.  Register in `EnemyRegistry.ts` with stats and loot.

### How to Add a New Tile
1.  Create `MyTileGraphic.ts` in `src/game/graphics/tiles/`.
2.  Inherit from `BaseTileGraphic`.
3.  Implement `protected drawTile(graphics: Phaser.GameObjects.Graphics): void`.
4.  Register in `TileRegistry.ts`.

## 8. AI "Gotchas" & Rules
1.  **React Updates**: Changing `PlayerState` properties directy does NOT re-render React. You MUST `emit` an event.
2.  **Performance**: Avoid complex logic in `GameScene.update`.
3.  **Persistance**: If you add a new state that needs saving, add it to `saveGame` method in `SaveSystem.ts` AND `loadState` in `PlayerState.ts`.
4.  **UI Performance**: Use **Ref-based Uncontrolled Components** for draggable Windows (e.g. `GameWindow.tsx`). 
    *   **Drag**: Use `react-rnd` without controlled `position` prop.
    *   **Sync**: Use a `ref` and `ref.current.updatePosition()` in `useEffect` to sync external state changes without causing "elastic snapback" or re-renders.
    *   **Prohibited**: NEVER bind `onDrag` to a setState.
5.  **Smart Tooltips**: Tooltips must check screen boundaries. Use the implemented logic in `UIContext` (flipping left/right/up/down) to prevent off-screen clipping.

## 9. Scalability Strategy (Future-Proofing)
*Guidance for future AI agents on how to scale the game.*

### 9.1 Map System (Chunk Loading)
**Current State**: `newmap.json` (Single File) -> `DynamicLevelRenderer` (Culling).
**Future Bottleneck**: RAM usage will spike with maps >10MB.
**Target Architecture**:
1. **Editor/Build**: Split `newmap.json` into `chunks/chunk_X_Y.json` (files).
2. **Loading Screen**: `MapLoader` fetches only the *initial* chunks (surrounding Player Spawn).
3. **Runtime**: `DynamicLevelRenderer` fetches neighbor chunks via HTTP background requests as player moves.
4. **Memory**: Unload chunks > 3 screens away.

### 9.2 AI Pathfinding (Time-Slicing)
**Implemented**: `GameScene` uses a **Time-Slicing Queue**.
- `MAX_PF_PER_FRAME = 5`
- Enemies call `queuePathfinding()` instead of `easystar.calculate()`.
- **Result**: Supports 50+ smart enemies without lag.
- **Next Level (Hordes)**: If needing 200+ enemies, implement **Flow Fields** (Dijkstra Maps) or move Pathfinding to a **Web Worker**.

### 9.3 Loading Screen Architecture
- **Goal**: Do heavy processing (Map Normalization, JSON Parsing) *outside* the Game Loop.
- **Implementation**: Create a `LoadingScene.ts` or `BootScene.ts`.
- **Process**:
    1. Show progress bar.
    2. Fetch User Save / Map Data.
    3. Run `MapLoader.normalizeMapSizes()`.
    4. Start `GameScene` only when data is ready in Registry/Cache.

### 9.4 Teleportation & Respawn Strategy
**Scenario**: Player dies or teleports to a distant coordinate/Chunk.
**Risk**: Destination Chunks are not memory/cached.
**Rule**:
- **Short Distance** (< 30 tiles): Instant teleport (`player.setPosition`).
- **Long Distance / Respawn**: MUST route through `LoadingScene`.
    - Call: `scene.start("LoadingScene", { targetScene: "GameScene", playerPos: {x: 1000, y: 1000}, ... })`.
    - `LoadingScene` downloads the new area's Chunks before passing control back to `GameScene`.
    - This prevents the player appearing in a "void" or crashing the game.
