# 🤖 AI QUICK-START DATA SHEET

## 1. DATA ACCESS & BMS (CRITICAL)

- **Forbidden**: `levelData.map`, `levelData.tiles`, `mapData.tiles`.
- **Allowed**:
  - `mapData.tileDefinitions` (Metadata)
  - `mapData.entityTemplates` (Portals/NPCs)
  - `MapLoader.getTileAt(x, y, level)` (Tile data)
  - `mapData.width` / `mapData.height` (Dimensions)

## 2. KEY SERVICE HUB

| Logic Category        | Target File                               |
| :-------------------- | :---------------------------------------- |
| Map Loading/Indexing  | `src/game/maps/MapLoader.ts`              |
| UI State / Fog of War | `src/game/entities/Player/PlayerState.ts` |
| Minimap Buffers       | `src/services/WorldMapService.ts`         |
| Level Transitions     | `src/game/systems/TransitionSystem.ts`    |
| Navigation Workers    | `src/services/NavigationService.ts`       |

## 2.1 ADDITIONAL RUNTIME SYSTEMS

- `src/game/systems/QuestManager.ts`: quest lifecycle and save/load state.
- `src/game/systems/InventorySystem.ts`: item pickup flow and pickup notifications.
- `src/game/services/MapProcessingService.ts`: spawn resolution and legacy grid helpers.
- `src/game/systems/AutoSaveSystem.ts`: disabled persistence shim kept for compatibility.
- `src/game/systems/AudioManager.ts`: procedural audio startup and shutdown.
- `src/game/services/RuntimeErrorMonitor.ts`: global runtime error capture and reporting.
- `src/game/systems/PathfindingManager.ts`: singleton wrapper around the pathfinding worker.
- `src/game/systems/TooltipManager.ts`: world tooltip positioning and lifecycle.
- `src/game/systems/WindowSystem.ts`: draggable window implementation used by overlay UIs.
- `src/game/managers/ConsumableManager.ts`: item consumption adapter and effect application.
- `src/game/entities/EnemyMagicRegistry.ts`: enemy spell definitions and combat magic tuning.
- Movement is handled by `NavigationService`, `PathfindingManager`, and `TransitionSystem`; there is no active `MovementSystem` implementation.

## 2.2 CONTENT, COMBAT & UI SHELL

- `src/game/systems/BattleSystem.ts`: combat resolution, damage mitigation, and battle-side notifications.
- `src/game/systems/StatManager.ts`: derived stats, DPS/APS, star points, and equipment modifiers.
- `src/game/entities/weapons/WeaponRegistry.ts`: item/weapon source of truth and preload bridge for related registries.
- `src/game/entities/EnemyRegistry.ts`: enemy definitions, loot tables, and combat tuning.
- `src/ui/GameOverlay.tsx`: scene overlay shell, pause/resume handoff, and HUD composition.
- `src/ui/components/window/WindowRegistry.ts`: window catalog and default dimensions.
- `src/ui/components/window/WindowContext.tsx`: open/close/focus state plus window position persistence via `PlayerState`.
- `src/ui/HUD.tsx`: persistent HUD composition and toolbar/minimap layout.
- `src/ui/components/NotificationSystem.tsx` and `src/ui/components/StatusWidget.tsx`: direct `PlayerState` event subscribers for toasts and status bars.
- `src/ui/components/window/WindowLayer.tsx`: renders external windows, but intentionally skips `hero_menu` because that flow is owned by the overlay/dashboard path.
- Legacy note: some registry entries still use raw English names/descriptions, so localization checks must cover registry definitions as well as JSON content packs.

## 2.3 APP, LOADING & LEVEL RENDERING

- `src/App.tsx`: React/Phaser bootstrap, benchmark auto-start, and game/editor switching.
- `src/game/scenes/BootScene.ts`: initial asset boot and handoff to title.
- `src/game/scenes/LoadingScene.ts`: BMS metadata and binary streaming.
- `src/game/maps/LevelRenderer.ts`: level rendering, fog/lighting, and perspective handling.
- `src/game/graphics/TilePool.ts`: sprite pooling for map rendering.

## 2.4 NAVIGATION PATHS

- `src/services/NavigationService.ts` + `src/game/systems/PathfindingManager.ts`: path request wrappers around the workers.
- `src/workers/pathfinding.worker.ts`: single-level grid pathfinding worker.
- `src/workers/navigation.worker.ts`: multilevel pathfinding worker using portals/stairs.

## 2.5 GRAPHICS, HUDS & FEEDBACK

- `src/game/graphics/tiles/**`: procedural tile registry and tile renderers; tile definitions must include step sound, speed modifier, and minimap/world-map color metadata for walkable terrain.
- `src/game/graphics/PlayerGraphic.ts`: legacy procedural fallback for player visuals; canonical gameplay sprite policy is in `docs/contracts/SPRITE_PIPELINE_CONTRACT.md`.
- `src/game/graphics/ItemGraphic.ts`: procedural item texture generator.
- `src/game/hud/PlayerHud.ts`: cached static/dynamic player bar with animated health and XP rendering.
- `src/game/hud/EnemyHud.ts`: enemy health bar visibility is controlled by damage state and z-level matching.
- `src/game/hud/InventoryIcons.ts`: shared glyphs for the in-game UI.
- `src/game/effects/**`: floating text, XP, and level-up feedback effects.
- Enemy selection visuals are level-aware; if target and player are on different Z-levels, the indicator hides and clears the selection.

## 2.4 EDITOR PATHS

- `src/game/scenes/MapEditorScene.ts` + `src/game/mapEditor/editor-ui.ts`: in-game editor still has partial legacy map-shape handling and separate save flow.
- `src/editor/scenes/EditorScene.ts` + `src/editor/ui/EditorLayout.tsx`: standalone editor path with its own bootstrap.
- `scripts/map-server.js`: separate local save endpoint for editor persistence with basic width/height/layers validation; it writes to `public/maps/newmap.json`.
- The main menu `MAP EDITOR` button now routes to the dedicated editor app route instead of the in-game editor scene.

## 2.5 CONTENT DATA PACKS

- `public/data/dialogues.json`: dialogue tree source used by the dialogue manager.
- `public/data/quests/*.json`: quest definitions and stage/reward conditions.
- `public/data/enemies.json`: enemy metadata feed for runtime content.
- `public/maps/*.json`: map metadata, level config, tile atlas, and entity templates.
- Legacy note: some quest/dialogue files still contain raw prose text, so localization checks must be applied when editing those JSON content packs.

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
- The guard fails if forbidden legacy patterns are found (e.g. `levelData.map`, `levelData.tiles`, `mapData.tiles`, `mapData.levels[...].map`, `levelData.map.length`).
- Temporary scope note: `src/editor/` is excluded from this check until editor migration to BMS is completed.

## 6. SAVE SYSTEM MODE (IMPORTANT)

- Reliable local save persistence is **Electron-only** (`window.electronAPI`).
- Browser runtime uses session fallback only (in-memory), which is not durable storage.
- When validating save/load behavior, use `npm run electron-dev`.

## 7. CONTRACT MAINTENANCE (MANDATORY)

- Every feature task must update affected files in `docs/contracts/` as part of Definition of Done.
- Benchmark-related changes must update `docs/contracts/BENCHMARK_CONTRACT.md` in the same task.
- Do not wait for explicit user reminder to keep contracts aligned with code.

## 8. UI TRANSLATION RULE (MANDATORY)

- Any player-facing text added to UI/HUD/windows/scenes must be translated via keys in `src/game/i18n/translations.ts`.
- Do not introduce hardcoded interface strings.
- For UI changes, read and follow `docs/contracts/UI_DESIGN_CONTRACT.md` before editing code.

## 9. LOCALIZATION DOMAIN RULE (MANDATORY)

- Item names and descriptions must always use translation keys.
- Quest titles, quest descriptions, and quest objective text must always use translation keys.
- NPC dialogue text (including future conversation systems) must always use translation keys.
- For these domains, read and follow `docs/contracts/LOCALIZATION_CONTRACT.md` before editing code.

## 10. DASHBOARD / OVERVIEW LAYER (IMPORTANT)

- The character dashboard is split across `src/ui/dashboard/HeroDashboard.tsx` and the detail panels under `src/ui/dashboard/components/`.
- `ItemDetailPanel.tsx`, `StarPointsDetailPanel.tsx`, and `ConditionDetailPanel.tsx` are presentation-only views; they should read state from shared helpers and not own game rules.
- When these files change, update `docs/ARCHITECTURE_MAP.md` and the localization contract if any visible labels or descriptions change.
- For UI overview work, check `src/game/systems/StatManager.ts` as the source of computed stat labels and breakdowns.

## 11. DOCUMENTATION PASS RULE (IMPORTANT)

- Whenever the AI opens a new source file during investigation, it should capture any finding that helps future navigation or maintenance.
- Record module boundaries, important entry points, hidden dependencies, special validation needs, and cross-file relationships in the relevant docs when they matter.
- Keep these notes concise and actionable; do not duplicate code, but do record what a future AI or maintainer needs to know before editing.
- If a file changes the mental model of the engine, prefer updating `docs/ARCHITECTURE_MAP.md` or the relevant contract in the same task.

## 12. EXECUTION RUNBOOK (MANDATORY)

- Before implementing any task, follow [AI_RUNBOOK.md](./AI_RUNBOOK.md).
- Map impacted modules using [ARCHITECTURE_MAP.md](./ARCHITECTURE_MAP.md) before code edits.
- Determine required validations using [VALIDATION_MATRIX.md](./VALIDATION_MATRIX.md).
- Do not mark a task as complete without reporting executed validations and outcomes.

---

_Reference current implementation plan for full context._
