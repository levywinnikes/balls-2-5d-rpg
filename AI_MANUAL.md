# AI Project Manual - The Grandfather Sword

> [!IMPORTANT]
> **Instructions for AI**: Always consult this specific file before starting any task to understand the project architecture, data structures, and common workflows. If you make structural changes or add new systems, **YOU MUST UPDATE THIS FILE** to keep it current.

## 1. Project Overview
**Name:** The Grandfather Sword
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
  graphic: { ... };  // HD Sprite (128x128)
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
    *   **Tile Size:** 128x128 (HD).
    *   **World Pos:** `GridX * 128 + 64` (Center).
-   **Under Property Rules:**
    *   `under` on a Tile/Entity refers to the **ID** of the tile below it (e.g. `under: "floor"`).
    *   **Exception**: `under: "..."` means "See-through to level below". Do not use map keys here.

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

## 6. Asset Generation Guidelines (Sprites)

> [!TIP]
> **Actor Sprite Sheets**: All Characters (Player/Enemies) must follow this EXACT 4x10 grid layout to work with the animation code.

**Grid Format:** 4 Columns x 10 Rows.
**Grid Format:** 4 Columns x 10 Rows.
**Sheet Size:** 951x2364px (High Res).
**Frame Size:** Approx 237x236px.

### Row Definition:
| Row | Action | Direction |
| :-- | :----- | :-------- |
| 1   | Walk   | Down      |
| 2   | Walk   | Left      |
| 3   | Walk   | Right     |
| 4   | Walk   | Up        |
| 5   | Attack | Down      |
| 6   | Attack | Left      |
| 7   | Attack | Right     |
| 8   | Attack | Up        |
| 9   | Death  | (Anim 1)  |
| 10  | Death  | (Anim 2)  |

### AI Image Generation Prompt Template:
> [!TIP]
> **Use Reference**: For consistent grid alignment, **ALWAYS** pass the existing file `public/assets/enemies/rat.png` as a reference image in your generation tool (argument `ImagePaths`). This helps the model understand the exact 4x10 layout.

> [!WARNING]
> **Perspective Rule**: Do NOT use "Isometric" (Diamond shape). Use **"Oblique Projection" / "Cabinet Projection"** (Tibia Style).
> - Top-Down View.
> - Front faces look flat towards the camera.
> - Top faces are visible.
> - **NO** rotation of 45 degrees for the base.

Use this prompt when generating new sprites:
```text
High Quality Sprite Sheet. Animated Cartoon Style.
Grid: 4 columns x 10 rows.
Content: [CHARACTER DESCRIPTION, e.g., A Human Hero Peasant].
Style: Clean, vibrant, high-definition cartoon style. Not pixel art. 
Perspective: Top-Down Oblique Projection (Tibia Style). NOT Isometric.
Dimensions: Total Sheet 951x2364px. Each frame approx 237x236px.
IMPORTANT: Character must stand UPRIGHT.
Row 1: Walk Down (Front View)
Row 2: Walk Left (Side View)
Row 3: Walk Right (Side View)
Row 4: Walk Up (Back View)
Row 5: Attack/Punch Down (Front View)
Row 6: Attack/Punch Left (Side View)
Row 7: Attack/Punch Right (Side View)
Row 8: Attack/Punch Up (Back View)
Row 9: Death Animation Part 1 (Collapsing)
Row 10: Death Animation Part 2 (Laying dead)
Constraint: Exact 4x10 Grid. Clean White Background.
```

## 7. Common Development Tasks

### 7.1 How to Build the Executable (Win/Mac/Linux)
To generate the distributable `.exe` (Windows) or binary:
1.  Run the command:
    ```bash
    npm run dist
    ```
2.  The output will be in the `dist/` folder (created automatically).
3.  **Note:** Requires `electron-builder` (already installed).

### How to Add a New Item
1.  Add PNG to `public/assets/items/`.
2.  Register in `WeaponRegistry.ts`:
3.  Add translation key.
4.  **For Containers:** 
    *   Add PNG to `assets/tiles/` (HD 128x128 Oblique).
    *   Register in `ContainerRegistry.ts` (NOT WeaponRegistry).
    *   Define `maxSlots`, `movable`, and `weight`.

### How to Add a New Enemy
1.  Generate Sprite Sheet using the **Asset Generation Guidelines** above.
2.  Create `MyEnemyGraphic.ts` in `src/game/graphics/enemies/` (Copy `RatGraphic.ts` as it implements the animation rows).
3.  Register in `EnemyRegistry.ts` with stats and loot.
4.  Preload it in `EnemyRegistry.preloadAll`.

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
