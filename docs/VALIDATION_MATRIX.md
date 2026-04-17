# Validation Matrix

Use this matrix to decide mandatory validation commands based on change impact.

## Rules

- Run all commands listed for every impacted area.
- If multiple areas are touched, combine all required commands.
- If a command cannot run locally, document why and provide a fallback plan.

## Impact -> Required Commands

| Impact Area | Required Commands |
| :-- | :-- |
| Docs-only (no code/config/runtime change) | No runtime command required; ensure markdown/lint checks pass if applicable |
| UI text / HUD / windows / notifications | `npm run check:i18n-ui`, `npm run build` |
| Gameplay logic / systems / scenes | `npm run build`, `npm run benchmark:e2e` |
| Save/load flow | `npm run build`, `npm run benchmark:e2e` |
| Map/BMS internals | `npm run check:bms`, `npm run build`, `npm run benchmark:e2e` |
| Pathfinding / navigation workers | `npm run build`, `npm run benchmark:e2e` |
| Benchmark harness / checkpoints | `npm run check:i18n-ui`, `npm run build`, `npm run benchmark:e2e` |
| Dependency or build config updates | `npm run build`, `npm run ci` |
| Cross-cutting refactor (multi-module) | `npm run check:i18n-ui`, `npm run build`, `npm run benchmark:e2e`, `npm run ci` |

## I18N Guard Scope

- `check:i18n-ui` validates newly added source lines only (diff-based guard).
- Existing legacy hardcoded strings outside the changed diff are not blocked by this guard.
- Any new player-facing string must use translation keys.

## Contract Update Requirement

When behavior, architecture rules, or UI language policy changes:

- Update affected files in [docs/contracts](./contracts/)
- Update [PROJECT_CONTRACT.md](./PROJECT_CONTRACT.md) if global policy changes
- Mention contract updates in the task summary
