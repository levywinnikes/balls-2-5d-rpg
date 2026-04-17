# Architecture Map (AI-First)

## Purpose

This map is the quick navigation layer between contracts and implementation.
Use it before editing code to identify boundaries, owners, and validation scope.

## Core Modules

| Module | Primary Entry Points | Boundaries / Notes | Contract |
| :-- | :-- | :-- | :-- |
| Scene Runtime | `src/game/scenes/GameScene.ts`, `src/game/scenes/LoadingScene.ts` | Do not bypass `PlayerState` for UI state sync; keep scene pause/resume behavior contract-safe | `docs/contracts/MAP_SYSTEM_CONTRACT.md`, `docs/contracts/PLAYER_STATE_CONTRACT.md` |
| Player State Hub | `src/game/entities/Player/PlayerState.ts` | Single source of truth for player-facing state and events | `docs/contracts/PLAYER_STATE_CONTRACT.md` |
| UI Windows / HUD | `src/ui/windows/**`, `src/ui/components/**`, `src/ui/GameOverlay.tsx` | No hardcoded player-facing text; translation keys required | `docs/contracts/UI_DESIGN_CONTRACT.md` |
| Character Dashboard / Stat Panels | `src/ui/dashboard/HeroDashboard.tsx`, `src/ui/dashboard/components/ItemDetailPanel.tsx`, `src/ui/dashboard/components/StarPointsDetailPanel.tsx`, `src/ui/dashboard/components/ConditionDetailPanel.tsx`, `src/ui/dashboard/components/HeroEquipmentPanel.tsx`, `src/ui/dashboard/components/HeroSmartInventory.tsx`, `src/ui/dashboard/components/HeroStatsTab.tsx` | Presentation layer only; derive state from `PlayerState` and stat helpers, never from raw scene logic | `docs/contracts/UI_DESIGN_CONTRACT.md`, `docs/contracts/LOCALIZATION_CONTRACT.md` |
| Stat / Combat HUD | `src/ui/components/SkillProgressHUD.tsx`, `src/ui/components/SidebarSkills.tsx`, `src/game/utils/TooltipUtils.tsx` | These overlays mirror computed stats and combat state; keep tooltip labels localized and in sync with stat calculators | `docs/contracts/UI_DESIGN_CONTRACT.md`, `docs/contracts/LOCALIZATION_CONTRACT.md` |
| Content Localization / Labels | `src/game/i18n/translations.ts`, `src/game/systems/StatManager.ts`, `src/game/utils/TooltipUtils.tsx` | Keep translation keys synchronized across languages; no fallback literals for player-facing labels | `docs/contracts/LOCALIZATION_CONTRACT.md` |
| Map / BMS Access | `src/game/maps/MapLoader.ts`, `src/services/WorldMapService.ts` | Legacy map array access forbidden; use BMS-safe APIs | `docs/contracts/MAP_SYSTEM_CONTRACT.md`, `docs/SYSTEM_BMS.md` |
| Navigation / Pathfinding | `src/services/NavigationService.ts`, `src/workers/pathfinding.worker.ts`, `src/workers/navigation.worker.ts` | Preserve buffer contract expected by workers | `docs/contracts/MAP_SYSTEM_CONTRACT.md` |
| Save / Persistence | `src/game/systems/SaveSystem.ts`, `src/game/systems/AutoSaveSystem.ts` | Electron mode is canonical durable save path | `docs/contracts/PLAYER_STATE_CONTRACT.md` |
| Benchmark / Smoke | `src/game/systems/BenchmarkRunner.ts`, `scripts/run-benchmark-e2e.js` | Benchmark checkpoints and reporting must be updated with behavior changes | `docs/contracts/BENCHMARK_CONTRACT.md` |

## Module Impact Checklist

For every task summary, include:

1. Impacted module(s)
2. Contract(s) reviewed
3. Validation commands selected from `docs/VALIDATION_MATRIX.md`
4. Boundary risks (if any)

## Red Zones (Edit With High Caution)

- `src/game/entities/Player/PlayerState.ts`
- `src/game/maps/MapLoader.ts`
- `src/game/scenes/GameScene.ts`
- `src/game/systems/TransitionSystem.ts`
- `src/services/NavigationService.ts`
- `src/services/WorldMapService.ts`
- `src/ui/dashboard/HeroDashboard.tsx`
- `src/ui/dashboard/components/ItemDetailPanel.tsx`
- `src/ui/dashboard/components/StarPointsDetailPanel.tsx`
- `src/ui/dashboard/components/ConditionDetailPanel.tsx`

## Fast Start

1. Identify module in this map.
2. Read matching contract.
3. Execute validations from `docs/VALIDATION_MATRIX.md`.
4. Report module impact in task output.
