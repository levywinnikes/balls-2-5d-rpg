# Architecture Overview - Balls 2.5D RPG

## Core Architecture

This project is built using a layered architecture with a **Phaser-free core layer** providing framework-agnostic game data and logic.

| Layer            | Responsibility                                | Technology                                   |
| :--------------- | :-------------------------------------------- | :------------------------------------------- |
| **View/UI**      | HUD, Windows (Inventory, Stats), Menus        | React (Tailwind/CSS)                         |
| **Logic/Engine** | Physics, Rendering, Pathfinding, AI           | Phaser 3 / Babylon.js (3D)                   |
| **State**        | Global single source of truth for player data | `PlayerState` (Singleton/EventEmitter)       |
| **Core**         | Framework-agnostic registries, systems, types | `src/core/` — pure TypeScript, no Phaser     |
| **Data**         | Map definitions, Item stats, Dialogue         | JSON + Binary (BMS)                          |

## Scene Management (`src/game/scenes/`)

1. **`MainMenuScene`**: Landing page and save file selection.
2. **`LoadingScene`**: Handles asynchronous downloading of BMS metadata and binary chunks.
3. **`GameScene`**: The main game loop. Manages entities, physics, and world interaction.

## State Communication

Communication between the Phaser Engine and React UI is handled strictly via the **`PlayerState` Singleton**:

- **Phaser -> UI**: Phaser emits events on `PlayerState` (e.g., `inventoryUpdated`). React hooks (`usePlayerState`) subscribe to these events to force re-renders.
- **UI -> Phaser**: React calls methods on `PlayerState`, which may emit events that `GameScene` listens for (e.g., `spawnDroppedItem`).

## Visual Direction and Layer Ownership

- Top-down layered presentation is the only player-facing visual target for maps and scene readability.
- Any alternate camera or perspective mode is debug-only and must not dictate map structure, traversal semantics, or UI decisions.
- `PlayerState` remains the source of truth for runtime view flags and player context.
- Map structure, current level, and layer visibility decisions must stay coherent across `PlayerState`, scene/runtime state, and renderer ownership.
- Vertical readability work should prefer smooth hide/show behavior for structures above the player instead of authoring maps around non-top-down viewpoints.

## Hero Menu / Window Pause Flow

- The **Hero Menu** is a UI window managed by the React window system, not by Phaser scene routing.
- Opening the Hero Menu pauses `GameScene` through the overlay pause bridge; closing it resumes gameplay.
- The window is interaction-driven and can be opened by mouse click or keyboard shortcut, then manipulated through the window chrome (drag, minimize, close).
- Benchmark automation treats the Hero Menu as a critical UI pause state and verifies both the window state and the paused scene state.

## System Menu / Modal Pause Flow

- The **System Menu** is a modal UI overlay opened from the HUD.
- It pauses `GameScene` while open and resumes the scene when closed.
- The primary path is mouse-driven through the HUD system button, with in-panel buttons for save, quest log, exit, and resume.
- Benchmark automation uses the real HUD click path and verifies that the modal both opens and restores gameplay correctly.

## Settings / Pause Flow

- The **Settings** window is a standard window launched from the HUD.
- It also pauses `GameScene` while open, so benchmark coverage must verify both the UI state and the resumed state after close.
- Because it is a draggable window, the benchmark should interact with the real HUD button and the generic window close control instead of calling internal window APIs.

## Persistence System

Persistence is handled by two parallel `SaveSystem` implementations:
- **`src/game/systems/SaveSystem.ts`** — Phaser-aware, used by 2D `GameScene`. Receives a `Phaser.Scene` reference for reading registry state.
- **`src/core/systems/SaveSystem.ts`** — Framework-agnostic, used by 3D Babylon slice. The caller provides context (`map`, `currentLevel`, `playerPos`) explicitly. Constructor takes no arguments.

- **Primary Mode (Supported)**: Electron local persistence via `window.electronAPI`.
- **Browser Mode**: Ephemeral fallback only (in-memory session), not reliable disk persistence.
- **Data Saved**: Player equipment, position, level, health, hunger, and explored area (Fog of War).
- **Map Persistence**: The state of dropped items and dead enemies is persisted per-level within the `PlayerState` maps.

### Save Flow

1. `GameScene` owns the live runtime state and injects it into `SaveSystem`.
2. `SaveSystem.saveGame()` reads `currentMap` and `currentLevel` from the scene registry.
3. Before serializing, it syncs active dropped items from the scene into `PlayerState` so per-level item state stays authoritative.
4. The save payload is built from `PlayerState.exportSnapshot()` plus scene data such as `playerPos`, `deadEnemies`, `activeEnemies`, `ui`, `timestamp`, and `version`.
5. In Electron mode, the payload is written through `window.electronAPI.saveGame()`.
6. In browser mode, the payload is kept only in `memorySaveData`, which is session-only and not durable.

### Load Flow

1. `SaveSystem.loadCharacter()` asks Electron for the saved payload, or returns the current in-memory payload in browser mode.
2. `GameScene` restores `currentMap`, `currentLevel`, `playerPos`, and then loads the persisted player snapshot back into `PlayerState`.
3. Enemy state and per-level persistence maps are repopulated from the loaded save payload.
4. If the load data is missing or incompatible, the caller must treat that as a failed load and fall back to a clean start path.

### Benchmark Coverage

- The benchmark harness validates save/load by creating a temporary character, saving it, loading it back, and comparing the loaded map, level, character name, inventory, and the quest state used by the smoke test.
- Use `npm run benchmark:e2e` when checking persistence regressions, because it covers the full save/load roundtrip instead of serialization alone.

## Key Services

- **`src/core/`** — Phaser-free layer with pure TypeScript registries (`WeaponRegistry`, `ItemRegistry`, `ContainerRegistry`, `EnemyRegistry`, `ShieldRegistry`), systems (`SaveSystem`, `StatManager`, `QuestManager`), magic (`RuneRegistry`), cosmetics (`HeroSkinRegistry`), and types (`gameTypes.ts`).
- **`src/game/`** — Phaser-bound layer for scenes, graphics, physics, and 2D-specific logic. The game registries now delegate data to `src/core/` equivalents.
- **`MapLoader`**: Safe interface for binary map access.
- **`WorldMapService`**: Pre-renders whole world segments for UI map components.
- **`NavigationService`**: High-level API for multi-floor pathfinding using web workers.
- **`StatManager`**: Centralized logic for all RPG attribute calculations (Defense, Damage, etc.).
- **`RuntimeErrorMonitor`**: Global runtime observability layer that captures `window.error`, `unhandledrejection`, and `console.error` for benchmark validation.

## Runtime Observability

Benchmark and autoplay flows rely on `RuntimeErrorMonitor` to detect silent failures that do not immediately crash the scene. It records runtime errors, exposes them to the benchmark report, and allows E2E runs to fail fast when the game logs an unexpected error.

---

_For technical details on the map engine, see [SYSTEM_BMS.md](./SYSTEM_BMS.md)_.
_Reference Files: `src/game/entities/Player/PlayerState.ts` (delegates to `src/core/`) — `src/core/systems/SaveSystem.ts` (Phaser-free persistence) — `src/core/types/gameTypes.ts` (shared type definitions)_
