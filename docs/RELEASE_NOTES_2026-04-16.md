# Release Notes - 2026-04-16

## Summary
This release hardens quality governance around the BMS map contract, improves contribution safety documentation, and applies broad low-risk cleanup to UI and gameplay-adjacent code. It also includes targeted regression fixes in transition flow and consumable typing.

## Scope
- Added BMS contract guard enforcement in CI and local scripts.
- Added safe contribution guidelines for incremental, non-breaking changes.
- Applied lint-oriented cleanup and stability improvements across UI and supporting systems.
- Fixed transition block regression and restored strict typing import in consumable manager.

## Commits
- 0d79b53: chore(quality): add BMS contract guard and safe contribution docs
- 27601a9: refactor(ui): apply safe lint cleanup and stability adjustments
- 3efa73b: fix(types): restore consumable manager typing import
- c7b3912: fix(transition): remove malformed auto-transition block

## Key Changes
### Quality and Governance
- Added/updated CI guardrails and local quality scripts.
- Added safe contribution documentation for low-risk workflow.

### Runtime and Engine Safety
- Removed malformed auto-transition logic in transition system.
- Restored missing type import pattern in consumable manager.

### UI and Stability
- Removed unused imports and dead code in multiple UI modules.
- Improved hook dependency correctness and reduced lint noise.
- Preserved existing behavior while improving maintainability.

## Validation
- check:bms: passed
- ci: passed
- production build: compiled successfully

## Residual Risk
- Bundle size advisory remains (non-blocking).
- Broad UI cleanup touched many files; runtime smoke test is still recommended for map transitions, inventory/equipment interactions, and window flows.

## Recommended Smoke Test
1. Start game and transition between levels/floors.
2. Open hero dashboard and switch tabs with keyboard and mouse.
3. Move items between inventory, equipment, and containers.
4. Open expanded map, add/rename/remove markers, and use zoom/center controls.
5. Run one full quest flow check in quest log UI.
