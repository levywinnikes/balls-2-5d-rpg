# Benchmark Contract

## 1. Purpose

This contract defines mandatory rules for the automated benchmark/smoke flow used to validate feature integrity.

## 2. Scope

The benchmark must validate critical runtime behavior in a deterministic test map and must be runnable without manual gameplay.

Current benchmark assets:

- Fixture map: `public/maps/smoke_test.json`
- Fixture binaries: `public/maps/smoke_test_0.bin`, `public/maps/smoke_test_-1.bin`
- Generator: `scripts/generate-smoke-map.js`
- Validator: `scripts/smoke-test-map.js`
- E2E launcher: `scripts/run-benchmark-e2e.js`
- Main menu entrypoint: `BENCHMARK` button in `src/ui/screens/MainMenuUI.tsx`
- In-game auto-runner/report: `src/game/scenes/GameScene.ts`
- Electron report/exit bridge: `public/electron.js` + `public/preload.js`
- Runtime error monitor: `src/game/services/RuntimeErrorMonitor.ts`

## 3. Mandatory Execution Rules

1. Benchmark mode must remain accessible from the main menu.
2. Benchmark run must execute automatically (no manual input required).
3. Benchmark must produce explicit PASS/FAIL results.
4. Result output must include:
   - overall status
   - total runtime
   - per-step status/timing
5. Benchmark run must return to title/menu after completion.
6. In E2E mode, benchmark run must write a JSON report and close the app with status code `0` (PASS) or `1` (FAIL).
7. Benchmark must capture runtime errors (`window.error`, `unhandledrejection`, and `console.error`) and fail the run if any are detected.
8. Runtime error capture exists specifically to catch silent failures such as black screens, missing assets, invalid transitions, and worker crashes that only appear in the console.
9. Each benchmark step must fail fast if the interaction does not complete within the step timeout; a stuck UI or paused flow is a failure, not a hang.

## 4.1 Execution Commands

- Fast static validation: `npm run smoke:test`
- Full benchmark automation (open app, auto-run, export JSON, enforce exit code): `npm run benchmark:e2e`
- Combined flow: `npm run smoke:full`
- E2E report must include `runtimeErrors` with source/message/timestamp.

## 4. Feature Update Policy (Mandatory)

For every feature task, the AI and contributors must evaluate benchmark impact.

If a feature affects any of the following, benchmark updates are REQUIRED in the same PR/task:

- level transitions
- player inventory/equipment interactions
- dropped items and pickup logic
- save/load state behavior
- map interaction and collision flow
- menu-to-game startup path
- UI flows used in smoke/benchmark

Required updates when impact exists:

1. Update benchmark checkpoints (`smokeTests` metadata and/or in-game benchmark steps).
2. Update this contract section `"Feature Coverage Matrix"`.
3. Run benchmark validation (`npm run smoke:test` and/or `npm run benchmark:e2e` depending on impact).
4. Include benchmark outcome in task/PR summary.

## 5. Feature Coverage Matrix

| Feature Area           | Covered | Validation Type                               | Source                                       |
| :--------------------- | :-----: | :-------------------------------------------- | :------------------------------------------- |
| Spawn initialization   |   Yes   | Auto-run step + fixture check                 | `GameScene.runBenchmark` / `smoke_test.json` |
| Item pickup            |   Yes   | Auto-run step + fixture entity check          | `GameScene.runBenchmark` / `smoke_test.json` |
| Down transition        |   Yes   | Auto-run step + tile checkpoint               | `GameScene.runBenchmark` / `smoke_test.json` |
| Up transition          |   Yes   | Auto-run step + tile checkpoint               | `GameScene.runBenchmark` / `smoke_test.json` |
| Save/Load behavior     |   Yes   | Auto-run save/load roundtrip                  | `GameScene.runBenchmark` / `SaveSystem`      |
| Quest log flow         |   Yes   | Auto-run quest activation + persistence check | `GameScene.runBenchmark` / `QuestManager`    |
| Window/UI interactions |   Yes   | Auto-run quest log + hero menu window toggle  | `GameScene.runBenchmark` / `UIContext`       |
| Modal pause flow       |   Yes   | Auto-run HUD click + system menu resume check | `GameScene.runBenchmark` / `UIContext`       |
| Settings pause flow    |   Yes   | Auto-run HUD click + settings close check     | `GameScene.runBenchmark` / `UIContext`       |
| Navigation/pathfinding |   Yes   | Auto-run worker route request + route result  | `GameScene.runBenchmark` / `Pathfinding API` |
| Inventory/equipment UI |   Yes   | Auto-run main-hand equip/unequip roundtrip    | `GameScene.runBenchmark` / `UIContext`       |
| Item drop flow         |   Yes   | Auto-run inventory drop + nearby pickup check | `GameScene.runBenchmark` / `PlayerState`     |

## 6. Remaining Coverage Targets

The following benchmark candidates are still not covered and should be added when their related systems change:

- Battle/combat loop: deterministic enemy encounter, damage application, critical hits, and loot/XP validation.
- Generator/map integrity: stair pairing, foundation support, and level normalization checks.
- Editor save flow: brush/erase/save roundtrip through the map server.
- World/minimap render: sanity check for world map buffers and minimap rendering on larger maps.

## 7. Definition of Done Addendum

A feature is NOT done unless:

1. Relevant contracts were reviewed and updated.
2. Benchmark impact was assessed.
3. Benchmark was updated when required.
4. `npm run smoke:test` passes.
5. When benchmark runtime path changed, `npm run benchmark:e2e` passes.

## 8. Documentation Language

All benchmark contract updates must be in English.
