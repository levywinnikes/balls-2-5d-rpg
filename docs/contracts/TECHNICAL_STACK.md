# Technical Stack Contract

## 1. Runtime & Frameworks
- **Runtime:** Electron (Main process for window management, Renderer process for the game).
- **Game Engine:** Phaser 3.90+ (Canvas/WebGL rendering).
- **UI Framework:** React 19 (HUD, Overlays).
- **Language:** TypeScript (Strict mode preferred).
- **Styling:** Tailwind CSS + Vanilla CSS (for glassmorphism and specific animations).

## 2. Directory Structure Conventions
- `src/core`: **Phaser-free** core layer — framework-agnostic game types, registries, XP tables, stat/save/quest systems. Zero imports from Phaser. Used by both 2D (`PlayerState`, game registries) and 3D (Babylon slice runtime).
- `src/game`: All Phaser-related code (Scenes, Systems, Physics, Graphics). Game registries now delegate data to `src/core/` equivalents.
- `src/three-d`: Babylon.js 3D slice runtime. Imports from `src/core/` (never from `src/game/` for data).
- `src/ui`: All React-related code (Components, Contexts, Hooks).
- `src/editor`: Legacy or internal tools for map/asset management.
- `public/data`: JSON data files (maps, NPCs, quests, dialogues). **No PNG assets.**

## 3. Communication Channel (The Bridge)
- **React -> Phaser:** via `window.game` or direct references to scenes if available.
- **Phaser -> React:** via `PlayerState` Event Emitter.
- **NEVER** use React state to drive real-time game logic. React is for UI display ONLY.

## 4. Build & Distribution
- **Command:** `npm run dist` to create Electron binaries.
- Output folder: `dist/`.
- Ensure `main.js` (Electron entry) points to the correct entry point (`dist/index.html` in production, local dev server in development).

## 5. Asset & Rendering Rules (CRITICAL)

> [!IMPORTANT]
> **The project has ZERO PNG dependencies for gameplay graphics.**
> Any `scene.load.image()`, `scene.load.spritesheet()`, or `src="assets/..."` that references a PNG/JPG/SVG for gameplay must be considered a contract violation.

### Allowed
- `scene.add.graphics() + generateTexture()` — the only legal way to create game textures.
- `public/data/*.json` — JSON data files for maps, NPCs, quests, dialogues.

### Forbidden
- `scene.load.image(...)` or `scene.load.svg(...)` anywhere in the physics/game layer.
- `public/assets/*.png` or any image file for game tiles, walls, enemies, or NPCs.
- `BaseTileGraphic.TEXTURE_PATH` or any path-based texture loading.

### Rules for Graphic Implementations
- **Tile Size**: 32×32 pixels (canonical unit).
- **Graphic Class Pattern**: Extend `BaseTileGraphic`, implement `drawTile(graphics)`, declare `static readonly TEXTURE_KEY`.
- **Texture Caching**: Always check `scene.textures.exists(key)` before generating.
- **Entities (Enemies)**: Extend `BaseEnemyGraphic`. Animate via procedural frame generation.
- **NPCs**: Generated via `scene.add.graphics().generateTexture()` inside `GameScene.create()`.
- **Projectiles**: Same as NPCs — generated in `create()`, not in `preload()`.
- **Containers**: Defined via `preload()` lambda in `ContainerRegistry` using `graphics.generateTexture()`.

## 6. UI (React) — PNG Exception
React UI components **may** reference image paths as a fallback, but the canonical item icons for the game inventory are also expected to be procedural long-term. Current known React PNG usages (for UI display, not gameplay) are acceptable but should be migrated over time.
