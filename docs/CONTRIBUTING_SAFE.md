# Safe Contribution Guide

This project is an isometric RPG with a Phaser engine, React UI, and a BMS-based map system. The goal of this guide is to keep changes safe and incremental.

## Before You Change Code

1. Read [AI_READ_FIRST.md](./AI_READ_FIRST.md).
2. Read [PROJECT_CONTRACT.md](./PROJECT_CONTRACT.md).
3. If your change touches maps, read [SYSTEM_BMS.md](./SYSTEM_BMS.md).
4. If your change touches UI layout or styling, check the UI contract files under `docs/contracts/`.
5. If your change adds or modifies player-facing UI text, update translation keys in `src/game/i18n/translations.ts` for all supported languages.
6. Follow [AI_RUNBOOK.md](./AI_RUNBOOK.md) and select required validations from [VALIDATION_MATRIX.md](./VALIDATION_MATRIX.md).

## Safe Workflow

1. Make the smallest change that solves the problem.
2. Keep engine behavior intact unless the task explicitly requires behavior changes.
3. Prefer removing dead code, unused imports, and duplicated logic before refactoring larger systems.
4. Run the local quality gate:
   - `npm run check:bms`
   - `npm run ci`
5. If `npm run build` or `npm run ci` reports warnings, fix only the low-risk ones first.

## High-Risk Areas

Treat these files as sensitive unless the task is explicitly about them:

- `src/game/entities/Player/PlayerState.ts`
- `src/game/maps/MapLoader.ts`
- `src/game/scenes/GameScene.ts`
- `src/game/systems/TransitionSystem.ts`
- `src/services/NavigationService.ts`
- `src/services/WorldMapService.ts`

## Good Defaults

- Avoid direct access to legacy map arrays or tile collections.
- Prefer typed, explicit APIs over shared mutable state.
- Remove unused imports and dead code when you are already touching a file.
- Keep CI passing before moving on to the next change.

## If You Need To Change Behavior

1. Document the change.
2. Validate with the smallest relevant test or runtime check.
3. Update contracts if the new behavior changes a rule.
4. Avoid broad refactors in the same change unless they are necessary.
