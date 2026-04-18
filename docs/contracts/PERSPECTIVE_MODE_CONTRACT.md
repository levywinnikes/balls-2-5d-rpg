# Perspective Mode Contract (Alpha 3D In Progress)

## 1. Purpose

This contract defines perspective behavior during alpha, with active 3D implementation and lightweight governance focused on execution speed.

Scope:

- 2D/3D runtime behavior in alpha.
- Rendering projection over multi-level maps.
- Entity/container synchronization under perspective transforms.
- Interaction with level transitions and save/load.

Current product status:

- `3D` is in active implementation.
- Runtime can switch between `2D` and `3D` for development and validation.
- HUD perspective toggle is enabled in gameplay.

Related analysis:

- `docs/PERSPECTIVE_MODE_PHASE1_FEASIBILITY.md`
- `docs/PERSPECTIVE_MODE_MASTER_PLAN.md`
- `docs/PERSPECTIVE_PHASE0_BASELINE.md`

## 2. Current Runtime Model

### 2.1 Source of Truth

- `PlayerState` owns the runtime mode state via `_perspectiveMode: "2D" | "3D"`.
- Mode changes emit `perspectiveModeChanged` with the selected mode.

### 2.2 UI Trigger

- HUD perspective button calls `PlayerState.togglePerspectiveMode()`.
- Toggle is available in alpha to accelerate 3D iteration.

### 2.3 Renderer Integration

- `LevelRenderer` listens to `perspectiveModeChanged`.
- Rendering transitions interpolate between perspective factors for smooth switching.
- Projection math is centralized in `src/game/maps/PerspectiveProjection.ts`.
- Perspective is applied by:
  - per-level container scale and offset relative to player anchor.
  - compact floor stacking defaults for alpha (`levelScaleStep` and `floorHeightPx`).
  - sub-pixel snapping for more stable multi-floor alignment.
  - per-level tint and shading.
  - tile-class readability tuning (structure vs floor vs under-tile) using tile metadata.
  - volumetric wall polygons for vertical depth illusion.
  - directional face styling (N/S/E/W) with different lightness and edge outlines.
  - exposed top-edge silhouette strokes for structure/stair tiles to improve multi-floor readability.
  - tiny-wall filtering to suppress near-flat polygon shimmer.
  - level-based depth partitioning (`(targetLevel - currentLevel) * 100000`).

### 2.4 Scene Loop Integration

- `GameScene.update()` calls `levelRenderer.updatePerspective(delta)` every frame.
- Scene synchronizes player and related entities into level containers to keep projection coherent.
- Volumetric polygon updates are movement-driven (and transition-driven) to reduce wall drift while keeping frame cost controlled.

## 3. Level System Coupling

### 3.1 Multi-Level Visibility

- Renderer keeps current level as main context and can render lower and upper levels within culling boundaries.
- Transparency and under-tile logic (`under: "..."`) are part of vertical readability.

### 3.2 Transition System

- Transition flow is handled by `TransitionSystem`.
- Manual transitions (stairs/holes) are currently favored over automatic transitions.
- Perspective mode must not break transition consistency for `currentLevel` registry state and pathfinding updates.

## 4. Persistence Rules (Current and Target)

### 4.1 Current Behavior

- Perspective mode is runtime-switchable (`2D` / `3D`) in alpha.
- Persistence behavior is still provisional and may change while 3D stabilizes.

### 4.2 Target Behavior

- Before beta/release, persistence policy must be finalized and documented in both save and player-state contracts.

## 5. Known Gaps

1. 3D projection path is not production-ready and may present visual/interaction inconsistencies.
2. Stair readability and combat clarity still need scenario-driven visual tuning in alpha maps.
3. Some transition/debug entry points still rely on permissive typing and should be tightened.
4. Perspective-specific UX expectations (camera feel, readability, combat clarity) are not yet formalized as measurable criteria.

## 6. Change Direction (Required for Refactor)

When perspective mode is redesigned, implementation must be split into these phases:

1. Product intent definition:

- Define expected player experience for 2D and 3D modes.
- Define per-mode acceptance criteria (visibility, controls, readability).

1. Runtime architecture update:

- Decouple projection math from level ownership where possible.
- Ensure entity depth and container sync are stable under all transitions.

1. Persistence policy decision:

- Decide session/global save behavior and implement it consistently.

1. Validation update:

- Extend benchmark/smoke coverage with perspective-sensitive checkpoints.
- Include transition + perspective combinations in validation matrix mapping.

## 7. Mandatory Rules for Any Perspective Feature

1. No hardcoded user-facing text; use i18n keys.
2. Keep `currentLevel` registry, player state level, and renderer level in sync.
3. Any behavior change in projection, transitions, or persistence must update:

- `MAP_SYSTEM_CONTRACT.md`
- `PLAYER_STATE_CONTRACT.md`
- `SAVE_SYSTEM_CONTRACT.md` (if persistence changes).
- `BENCHMARK_CONTRACT.md` (if validations change).

## 8. Impact Checklist (Perspective Tasks)

Every perspective-related task summary must include:

1. Files touched in renderer, scene, player state, and UI trigger layer.
2. Whether persistence policy changed.
3. Which benchmark/smoke checks were executed.
4. Residual risks (visual artifacts, depth ordering, transition edge-cases).
