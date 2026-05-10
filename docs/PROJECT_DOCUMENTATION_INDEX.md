# Project Documentation Index

## Purpose

This index is the canonical entrypoint for documentation-first implementation.
If a domain is not documented here, implementation in that domain must pause until documentation is added.

For fast behavior lookup after each change, use [MECHANICS_DELTA_TEMPLATE.md](./MECHANICS_DELTA_TEMPLATE.md) to register concise mechanics deltas.

## Mandatory Rule

Before any code change:

1. Identify impacted domain(s).
2. Read canonical docs listed in this index.
3. Record coverage in `.github/agent-runtime/contract-checklist.json`.
4. If coverage is `missing` or `divergent`, update docs first.
5. Only then proceed with implementation.

## Domain Index

| Domain                          | Canonical docs/contracts                                                                                                       | Primary implementation areas                                                                 |
| :------------------------------ | :----------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| Global execution workflow       | `docs/AI_RUNBOOK.md`, `docs/VALIDATION_MATRIX.md`                                                                              | All tasks                                                                                    |
| Project architecture map        | `docs/ARCHITECTURE_MAP.md`, `docs/ARCHITECTURE_OVERVIEW.md`                                                                    | All cross-module changes                                                                     |
| Map system / BMS                | `docs/contracts/MAP_SYSTEM_CONTRACT.md`, `docs/SYSTEM_BMS.md`                                                                  | `src/game/maps/**`, `src/services/WorldMapService.ts`, map loaders                           |
| Perspective / 2.5D-3D           | `docs/contracts/PERSPECTIVE_MODE_CONTRACT.md`, `docs/PERSPECTIVE_MODE_MASTER_PLAN.md`, `docs/THREE_D_INTEGRATION_BLUEPRINT.md` | `src/game/maps/LevelRenderer.ts`, `src/game/maps/PerspectiveProjection.ts`, `src/three-d/**` |
| Player state and sync           | `docs/contracts/PLAYER_STATE_CONTRACT.md`                                                                                      | `src/game/entities/Player/PlayerState.ts`, state sync paths                                  |
| Save/load persistence           | `docs/contracts/SAVE_SYSTEM_CONTRACT.md`                                                                                       | `src/game/systems/SaveSystem.ts`, save/load bridges                                          |
| Combat                          | `docs/contracts/BATTLE_SYSTEM_CONTRACT.md`                                                                                     | `src/game/systems/BattleSystem.ts`, combat registries                                        |
| UI/HUD/window behavior          | `docs/contracts/UI_DESIGN_CONTRACT.md`                                                                                         | `src/ui/**`, HUD and window layers                                                           |
| Localization                    | `docs/contracts/LOCALIZATION_CONTRACT.md`                                                                                      | All player-facing labels/messages/content                                                    |
| Benchmark and smoke harness     | `docs/contracts/BENCHMARK_CONTRACT.md`                                                                                         | `scripts/run-benchmark-e2e.js`, `public/maps/smoke_test.json`, benchmark runners             |
| Editor                          | `docs/contracts/EDITOR_CONTRACT.md`                                                                                            | `src/editor/**`, editor scenes and save flow                                                 |
| Generation / biome / tooling    | `docs/contracts/GENERATOR_CONTRACT.md`, `docs/contracts/BIOME_SYSTEM_CONTRACT.md`                                              | map generation scripts and biome logic                                                       |
| **World map / island / biomes** | **`docs/contracts/WORLD_MAP_CONTRACT.md`**                                                                                     | `scripts/generate-*.js`, `public/maps/city_3d_multi.*`, tile atlas, structure rules          |
| Map UI mechanics                | `docs/MAP_UI_MECHANICS.md`                                                                                                     | `src/ui/components/SidebarMinimap.tsx`, `src/ui/windows/ExpandedMapWindow.tsx`                |

Additional canonical domain:

- Sprite pipeline / visual identity: `docs/contracts/SPRITE_PIPELINE_CONTRACT.md` (plus perspective and 3D integration docs for parity-sensitive changes). Operational production pack: `docs/sprites/**`. Primary areas: `src/game/graphics/**`, `src/game/entities/EnemyRegistry.ts`, `src/three-d/runtime/**`.

## Divergence Protocol (Doc vs Code)

When implementation and documentation disagree:

1. Mark checklist `docsCoverageStatus` as `divergent`.
2. Record exact mismatch in `divergenceNotes`.
3. Add planned doc updates in `docUpdatesRequired`.
4. Update docs before implementation changes.
5. Set `docUpdatesCompleted=true` only after docs reflect intended behavior.

## Coverage States

- `covered`: Canonical docs exist and match current/target behavior.
- `missing`: Domain behavior has no canonical documentation.
- `divergent`: Docs exist but do not match actual/target behavior.

## Definition of Done Addendum

A task is complete only if:

1. Domain was checked in this index.
2. Relevant docs/contracts were read and listed in checklist.
3. Any missing/divergent docs were updated before implementation.
4. Required validations from `docs/VALIDATION_MATRIX.md` were executed.
5. If runtime behavior changed, a mechanics delta entry was recorded using `docs/MECHANICS_DELTA_TEMPLATE.md`.
