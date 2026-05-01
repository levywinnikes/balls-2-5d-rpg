# Mechanics Delta Template

Use this template when a task changes behavior, constraints, interaction rules, or runtime semantics.

Create one entry per changed behavior.

---

## Delta Entry

- Date: YYYY-MM-DD
- Task: short task name
- Scope: one-line behavior summary
- Domain: map | perspective | player-state | combat | ui | save | benchmark | other
- Modules: comma-separated module/file areas
- Previous Behavior:
  - what happened before
- New Behavior:
  - what happens now
- Invariants Preserved:
  - boundaries/contracts intentionally unchanged
- Risks:
  - main regression risk after this change
- Validation:
  - commands/tests executed and result
- Rollback Hint:
  - shortest safe rollback strategy

## Example (minimal)

- Date: 2026-04-23
- Task: 3d player billboard attack state sync
- Scope: player sprite enters attack animation when real attack is executed
- Domain: perspective
- Modules: src/three-d/runtime/createDebugSliceScene.ts
- Previous Behavior:
  - billboard was static and did not reflect attack action
- New Behavior:
  - attack state starts on successful attack trigger and returns to idle/walk
- Invariants Preserved:
  - combat authority remains in PlayerState and existing cooldown logic
- Risks:
  - visual desync in first-person mode if billboard remains visible
- Validation:
  - TypeScript editor diagnostics clean for touched file
- Rollback Hint:
  - remove attack-state trigger and revert billboard state machine block
