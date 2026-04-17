# Architecture Overview - Balls 2.5D RPG

## Core Architecture

This project is built using a hybrid **React + Phaser 3** architecture.

| Layer            | Responsibility                                | Technology                             |
| :--------------- | :-------------------------------------------- | :------------------------------------- |
| **View/UI**      | HUD, Windows (Inventory, Stats), Menus        | React (Tailwind/CSS)                   |
| **Logic/Engine** | Physics, Rendering, Pathfinding, AI           | Phaser 3                               |
| **State**        | Global single source of truth for player data | `PlayerState` (Singleton/EventEmitter) |
| **Data**         | Map definitions, Item stats, Dialogue         | JSON + Binary (BMS)                    |

## Scene Management (`src/game/scenes/`)

1. **`MainMenuScene`**: Landing page and save file selection.
2. **`LoadingScene`**: Handles asynchronous downloading of BMS metadata and binary chunks.
3. **`GameScene`**: The main game loop. Manages entities, physics, and world interaction.

## State Communication

Communication between the Phaser Engine and React UI is handled strictly via the **`PlayerState` Singleton**:

- **Phaser -> UI**: Phaser emits events on `PlayerState` (e.g., `inventoryUpdated`). React hooks (`usePlayerState`) subscribe to these events to force re-renders.
- **UI -> Phaser**: React calls methods on `PlayerState`, which may emit events that `GameScene` listens for (e.g., `spawnDroppedItem`).

## Persistence System

Persistence is handled in `src/game/systems/SaveSystem.ts`:

- **Primary Mode (Supported)**: Electron local persistence via `window.electronAPI`.
- **Browser Mode**: Ephemeral fallback only (in-memory session), not reliable disk persistence.
- **Data Saved**: Player equipment, position, level, health, hunger, and explored area (Fog of War).
- **Map Persistence**: The state of dropped items and dead enemies is persisted per-level within the `PlayerState` maps.

## Key Services

- **`MapLoader`**: Safe interface for binary map access.
- **`WorldMapService`**: Pre-renders whole world segments for UI map components.
- **`NavigationService`**: High-level API for multi-floor pathfinding using web workers.
- **`StatManager`**: Centralized logic for all RPG attribute calculations (Defense, Damage, etc.).

---

_For technical details on the map engine, see [SYSTEM_BMS.md](./SYSTEM_BMS.md)_.
_Reference File: src/game/entities/Player/PlayerState.ts_
