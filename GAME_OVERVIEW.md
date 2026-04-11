# Balls 2.5D RPG — Game Overview & Architecture

## 1. Project Overview
**Balls 2.5D RPG (Alpha 1)** is an isometric, open-world RPG-style single-player game inspired by *Tibia*. It features a **casual and upbeat adventure aesthetic** with 100% procedural visuals (no PNG assets), combining **Electron** for the desktop runtime, **React** for the UI, and **Phaser** for the game engine.

### Tech Stack
- **Runtime:** Electron (Desktop Application)
- **Game Engine:** Phaser 3.90 (Rendering, Physics, Input)
- **UI Framework:** React 19 (HUD, Windows, Drag & Drop)
- **Language:** TypeScript
- **Data Storage:** JSON (Maps, Enemies, Items)

---

## 2. Architecture: The Hybrid Model
The project uses a **Hybrid Architecture** where React and Phaser run simultaneously but handle different responsibilities. They communicate primarily through a Singleton State Manager (`PlayerState`) and global events.

### 2.1 Responsibilities
| Component | Responsibility |
| :--- | :--- |
| **Phaser (`src/game`)** | Renders the game world, handles physics, collisions, combat logic, enemy AI, and map management. |
| **React (`src/ui`)** | Renders the HUD, inventory windows, container windows, settings, and handles UI input (clicks, drags). |
| **PlayerState (`src/game/entities/Player/PlayerState.ts`)** | The **Single Source of Truth** for player data (HP, XP, Inventory). Bridges React and Phaser via `EventEmitter`. |

### 2.2 Data Flow
1.  **Phaser -> React**: Game events (e.g., "Player took damage") update `PlayerState`. `PlayerState` emits an event (e.g., `"updateStats"`). React components listen to this event and re-render.
2.  **React -> Phaser**: User interactions (e.g., "Drop Item") call methods on `PlayerState`. `PlayerState` validates the action and emits an event (e.g., `"dropItem"`). Phaser scenes listen to this event and update the game world (spread sprite).

---

## 3. Core Systems

### 3.1 Map System (`MapLoader.ts`)
*   **Format**: JSON-based maps (`newmap.json`).
*   **Structure**: Supports multiple Z-levels (0, 1, -1).
*   **Rendering**: `DynamicLevelRenderer` handles culling and layer visibility (transparency when walking under roofs).
*   **Current Limit**: Loads the entire map into memory at startup.

### 3.2 Battle System (`BattleSystem.ts`)
*   **Mechanics**: Tick-based interaction.
*   **Formulas**:
    *   **Attack**: `Random(1, AttackStats)`.
    *   **Defense**: `Random(1, DefenseStats)`.
    *   **Armor**: Flat reduction after defense modification.
    *   **Elements**: Support for Fire, Poison, etc., with resistances.
*   **Feedback**: Floating damage numbers (`FloatingText`) and particles.

### 3.3 State Management (`PlayerState.ts`)
*   Acts as a "God Object" managing:
    *   **Stats**: Strength, Dexterity, Intelligence, Health, Mana.
    *   **Inventory**: Array of `InventoryItem`.
    *   **Equipment**: Slots for Helmet, Armor, Legs, etc.
    *   **Containers**: Manages contents of chests/backpacks.
### 3.4 Pathfinding (`PathfindingManager.ts`)
*   **Threading**: Implemented via Web Workers (`pathfinding.worker.ts`).
*   **Logic**: Offloads A* calculations to a separate thread to prevent Game Loop lag during heavy hordes.


---

## 4. Improvement Roadmap & Suggestions

Based on code analysis, the following improvements are recommended to enhance scalability, maintainability, and gameplay depth.

### 4.1 🚀 Performance & Scalability
1.  **Map Chunking (Priority: High)**
    *   **Issue**: `MapLoader` loads the entire `newmap.json` at once. Large worlds will cause memory spikes.
    *   **Solution**: Split the map into 32x32 chunks (files). Load only chunks around the player. Unload distant chunks.
2.  **Container Virtualization (Priority: Medium)**
    *   **Issue**: Opening a container with 1000 items might lag React.
    *   **Solution**: Use `react-window` or strict pagination for container slots.

### 4.2 🛠 Code Architecture
3.  **Refactor `PlayerState` (God Object)**
    *   **Issue**: `PlayerState` is too large (2500+ lines).
    *   **Solution**: Split into sub-managers: `InventoryManager`, `StatsManager`, `EquipmentManager`.
4.  **Strict Typing for Events**
    *   **Solution**: Create a `GameEvents` interface and a typed EventBus wrapper.

### 4.3 ✨ New Systems (Planned)
5.  **Quest System (JSON-Driven)**
    *   **Concept**: Data-driven Quest Engine using JSON files to define states, objectives, and world mutations.
    *   **Structure**: 
        ```json
        {
          "id": "tutorial_quest",
          "stages": [
            {
               "id": 10,
               "description": "Talk to the Elder",
               "objectives": [{ "type": "dialogue", "target": "elder_npc" }],
               "rewards": [{ "type": "item", "id": "wood_sword" }],
               "worldEvents": [{ "type": "spawn_npc", "id": "guide", "x": 500, "y": 500 }]
            }
          ]
        }
        ```
    *   **Integration**: `QuestManager` listens to game events (`"enemyKilled"`, `"dialogueComplete"`) to advance stages.

6.  **Dialogue System (Graph-Based)**
    *   **Concept**: Node-based conversations supporting branching, conditions (Has Item, Quest Stage), and effects (Give Item, Start Quest).

### 4.4 🎨 UI/UX Overhaul
7.  **"Rich Aesthetics" Implementation**
    *   **Current**: Functional dark boxes (`bg-[#1a1a1a]`).
    *   **Proposal**: 
        *   **Glassmorphism**: Use `backdrop-blur` and subtle borders.
        *   **Theming**: Define strict CSS variables (`--color-panel-bg`, `--color-accent`) in `index.css` instead of hardcoded Hex.
        *   **Micro-interactions**: Add hover glow effects on Slots and animated progress bars.
    *   **Components**: Create reusable `RPGWindow`, `RPGButton`, `RPGSlot` components to unify the design language.

