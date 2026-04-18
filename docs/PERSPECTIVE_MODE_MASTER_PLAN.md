# Perspective Mode Master Plan (Quality-First)

## 1. Plan intent

This plan is designed for a no-deadline, quality-first evolution of perspective rendering, with 3D as strategic target and 2D as controlled fallback.

Guiding principles:

- Optimize for correctness and long-term maintainability.
- Advance only through quality gates, not calendar pressure.
- Avoid parallel architecture forks that duplicate maintenance cost.

## 2. Product direction

1. Strategic mode: 3D/2.5D projection.
2. Temporary fallback: 2D mode, maintained only while needed for stability/performance parity.
3. End-state candidate: single robust projection core with profile-based output behavior.

## 3. Architecture strategy

### 3.1 Single projection core

- Build one world/projection/depth pipeline.
- Support two output profiles (`2D`, `3D`) over shared core math and ordering rules.
- Do not maintain two unrelated render systems.

### 3.2 Explicit ownership boundaries

- `PlayerState`: perspective state, events, and persistence policy.
- `LevelRenderer`: projection, depth sorting, block-face rendering, visual stacking.
- `TransitionSystem`: level switching consistency under perspective.
- `GameScene`: frame orchestration and entity/container synchronization.

### 3.3 Data compatibility

- Keep map schema/grid (32x32) intact.
- Keep gameplay systems independent from projection profile.

## 4. Work phases

## Phase 0 - Baseline and observability

Goal:

- Capture current behavior and define objective acceptance metrics.

Deliverables:

1. Test map scenarios for perspective stress:

- Multi-floor building
- Stair up/down transitions
- Dense object area
- Combat near elevation boundaries

2. Baseline captures:

- Visual screenshots/video references
- FPS and stutter samples
- Known artifact list

Exit criteria:

1. Baseline artifact catalog exists and is reproducible.
2. Performance baseline is recorded for comparison.

## Phase 1 - Projection core rewrite (spike to production path)

Goal:

- Replace fake Y-offset illusion with true level stacking projection math.

Deliverables:

1. Projection utility (world -> projected screen) with compact floor height model.
2. Per-level height stacking rules (no global Y+1 hacks).
3. Deterministic depth policy for tiles/entities per level.

Exit criteria:

1. Straight structural edges across floors (no jagged displacement artifacts).
2. Stable visual alignment between stacked floors.
3. No transition-induced depth corruption.

## Phase 2 - 3D block visual model

Goal:

- Render true compact block appearance for tiles in 3D profile.

Deliverables:

1. Tile top + side faces rendering path.
2. Side shading/lighting policy derived from same tile identity.
3. Visual profile controls (compact height constants, readability tuning).

Exit criteria:

1. Building and stair silhouettes remain consistent while player moves.
2. Compact style maintained (no over-stretched GTA-like vertical scale).
3. Visual readability improved vs baseline in test scenarios.

## Phase 3 - Transition and gameplay coherence hardening

Goal:

- Guarantee gameplay correctness under projection changes.

Deliverables:

1. TransitionSystem hardening for stairs/holes with typed and deterministic flow.
2. Entity/container sync validation across level switches.
3. Combat and interaction checks near multi-floor overlap zones.

Exit criteria:

1. No incorrect floor interactions from projection side effects.
2. No entity ordering glitches at transition boundaries.
3. Save/load returns to coherent projected state.

## Phase 4 - Performance and decision gate (2D future)

Goal:

- Validate maturity and decide long-term status of 2D fallback.

Deliverables:

1. Benchmark checkpoints expanded for perspective-specific scenarios.
2. Comparative report:

- Bug rate by profile
- Implementation complexity by profile
- Runtime performance by profile

3. Recommendation memo: keep 2D fallback or retire it.

Exit criteria:

1. 3D profile is stable across all priority scenarios.
2. Decision gate approved with evidence.

## 5. Quality gates (mandatory)

A phase only completes if all relevant gates pass:

1. Visual correctness gate

- No jagged level stacking artifacts caused by projection mismatch.
- Floor and wall continuity preserved under movement.

2. Spatial correctness gate

- `currentLevel`, renderer state, and entity depth remain consistent.
- Stair transitions maintain expected world position and ordering.

3. Gameplay correctness gate

- Collision, interaction, and combat remain deterministic under projection.

4. Performance gate

- No unacceptable regression in baseline stress scenarios.

5. Contract/documentation gate

- Contracts and benchmark docs updated with behavior changes.

## 6. Decision framework for 2D mode

Keep 2D temporary fallback while any of the following is true:

1. 3D profile still has unresolved critical gameplay correctness bugs.
2. 3D profile has unacceptable performance for target scenarios.
3. 3D profile lacks parity in key play loops.

Retire 2D when all are true:

1. 3D profile passes all quality gates consistently.
2. 2D maintenance cost exceeds practical value.
3. Team/product confirms 3D-only strategic direction.

## 7. Risk register

1. Risk: Projection rewrite introduces hidden gameplay regressions.

- Mitigation: phase-gated rollout + scenario map regression checks.

2. Risk: Depth ordering becomes brittle with edge entities.

- Mitigation: formal depth policy + deterministic tie-break rules.

3. Risk: Performance drops with side-face rendering.

- Mitigation: culling, pooling, and profile-level tuning constants.

4. Risk: Scope drift into full 3D engine migration.

- Mitigation: keep Phase 1-4 focused on Phaser-native projection first.

## 8. Immediate next actions

1. Build Phase 0 baseline map scenarios and artifact checklist.
2. Implement Phase 1 projection utility and remove Y-offset dependency in 3D path.
3. Run smoke/build/benchmark checks relevant to perspective path.

## 9. Related docs

- `docs/contracts/PERSPECTIVE_MODE_CONTRACT.md`
- `docs/PERSPECTIVE_MODE_PHASE1_FEASIBILITY.md`
- `docs/PERSPECTIVE_PHASE1_TASKLIST.md`
- `docs/PERSPECTIVE_PHASE0_BASELINE.md`
- `docs/contracts/MAP_SYSTEM_CONTRACT.md`
- `docs/contracts/PLAYER_STATE_CONTRACT.md`
- `docs/contracts/SAVE_SYSTEM_CONTRACT.md`
- `docs/contracts/BENCHMARK_CONTRACT.md`
