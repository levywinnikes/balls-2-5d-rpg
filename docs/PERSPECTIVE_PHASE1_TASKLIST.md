# Perspective Phase 1 Tasklist (Alpha Execution)

## Goal

Deliver a stable projection core for 3D mode in alpha with implementation-first priority.

## Working mode

- Keep tasks small and shippable.
- Prefer direct implementation over heavy process.
- Update docs as tasks land.

## Tasklist

1. Projection utility module

- Status: Done
- Scope: Move level scale, vertical stacking, and depth offset math into a shared utility.
- Acceptance:
  - Renderer container transform no longer hardcodes projection constants inline.
  - Depth offset uses the same utility math path.

1. Renderer transform integration

- Status: Done
- Scope: Integrate utility into LevelRenderer container updates and keep behavior parity.
- Acceptance:
  - Perspective toggle still works (`2D`/`3D`).
  - No regression in level container sync.

1. Deterministic depth policy cleanup

- Status: Done
- Scope: Consolidate depth stride usage for tiles/entities/containers in one policy.
- Acceptance:
  - No mixed magic numbers for depth offsets in renderer core.

1. Stair and multi-floor alignment pass

- Status: Done
- Scope: Tune compact floor height and verify stair transitions visually.
- Acceptance:
  - No obvious jagged level separation on stacked structures.
  - Stair up/down transitions keep expected ordering.

1. Volumetric wall stability pass

- Status: Done
- Scope: Validate side-face anchors while moving and during transitions.
- Acceptance:
  - No side-face drifting relative to roof/top tiles.

1. Performance guardrails (alpha)

- Status: Done
- Scope: Keep frame updates lean while perspective interpolates.
- Acceptance:
  - No severe runtime stutter introduced by projection refactor.

1. Documentation sync

- Status: Done
- Scope: Reflect implementation decisions in perspective and related contracts.
- Acceptance:
  - Contract text matches runtime behavior after each merged task block.

## Validation for each task block

1. `npm run build`
1. `npm run benchmark:e2e` when transition/render behavior changes

## Notes

- This file is the execution board for Phase 1. Phase 2 work is appended below.
- Status values: Pending, In progress, Done.
- Latest validation after top-edge silhouette pass: `npm run build` PASS, `npm run benchmark:e2e` PASS (`benchmark-report-1776460942973.json`).

---

# Phase 2 — 3D Block Visual Polish (In Progress)

## Status update

The current Phaser-based 2.5D/perspective path is now considered a limited prototype.

New direction:

1. freeze this renderer path for major visual ambitions
2. preserve it only for regression safety and reference
3. move future "real block volume" work to a separate 3D pipeline plan in [docs/THREE_D_PIPELINE_PLAN.md](./THREE_D_PIPELINE_PLAN.md)
4. initial isolated 3D slice bootstrap now exists separately via `?slice3d=1`

## Goal

Improve visual clarity and readability of the 3D perspective view without breaking gameplay or benchmark.

## Tasklist

1. Projection constants tuning

- Status: Done
- Scope: `PerspectiveProjection.ts` — increased `floorHeightPx` 32→40 for taller wall faces; reduced `levelScaleStep` 0.03→0.025 to keep distant floors readable; raised `minScale` 0.6→0.62.
- Rationale: Taller floor height makes side faces more visible. Lower scale step prevents top floors from shrinking too aggressively.

1. Face contrast improvement (N/S shading)

- Status: Done
- Scope: `LevelRenderer.getVolumetricFaceStyle()` — S face 0.9→0.97 (bright lit front), N face 0.58→0.44 (deep shadow), E 0.76→0.80, W 0.66→0.60. Stroke shade multiplier 0.52→0.44.
- Rationale: Strong N/S contrast is the primary visual cue for 3D block depth. Previous values were too flat.

1. Structure silhouette strengthening

- Status: Done
- Scope: `LevelRenderer.getTopSilhouetteStyle()` — color `0xd9d9d9`→`0xffffff` (pure white), alpha range 0.2–0.7 → 0.35–0.9, distance fade less aggressive (0.1→0.07 multiplier).
- Rationale: Crisp white edge reads much more clearly as a block top, especially when multiple floors overlap.

1. Stair-specific silhouette

- Status: Done
- Scope: `LevelRenderer` — added `getStairSilhouetteStyle()` returning golden/amber `0xffe080` at `width: 2`. `drawVolumetricPolygons()` now dispatches to stair vs structure silhouette independently.
- Rationale: Stairs need to be visually distinguishable from walls for navigation clarity. Golden outline at 2px provides this without adding new tile metadata.

1. Upper floor tint (cool-white instead of warm-yellow)

- Status: Done
- Scope: `LevelRenderer.updateAllTileTints()` — upper floor tint changed from warm yellow `(220+20d, 220+20d, 180)` to cool-white `(215+14d, 222+14d, 235+8d)`. Lower floor changed from blue-shift to warm amber `(d+18, d, d-14)`.
- Rationale: Warm-yellow upper floors looked sepia and distorted structure colors. Cool-white better represents sky illumination. Amber underground suggests torch/earth depth.

1. Orientable quadrant spike for unit tiles

- Status: Done
- Scope: `LevelRenderer.drawVolumetricPolygons()` — added a quadrant-based face selector with axis dead-zone/hysteresis for `rock`, `wall`, and `stone-wall`. The spike limits visible faces to the two player-facing sides instead of rendering every exposed side.
- Rationale: This is the smallest renderer-only experiment that tests the desired "maquette" language without changing the projection core. It validates whether 4-direction face selection is convincing before any broader tile metadata or art pipeline work.

1. Manual debug playground map

- Status: Done
- Scope: Added `public/maps/perspective_debug.json` plus binary levels and a debug button in `SettingsUI` that requests a clean load of the map through `PlayerState` -> `GameScene` -> `LoadingScene`.
- Rationale: The benchmark self-drives and is not suitable for manual visual validation. A dedicated arena is required to walk around `rock`, `wall`, and `stone-wall` structures and judge the 3D effect directly.

1. Volumetric exposure rule fix (debug readability)

- Status: Done
- Scope: `LevelRenderer.drawVolumetricPolygons()` now treats a side as exposed when the adjacent tile is not structural (instead of only when it is `...`). Added `isStructuralTileForVolumetric(...)` helper using tile metadata (`baseDepth`/stairs) and preserving `roof` as non-extrudable.
- Rationale: In the debug arena, walls are adjacent to floor tiles (`cob`), so the old `neighbor === "..."` condition suppressed almost all side faces and made the scene look flat.

## Validation

1. `npm run build` — required after any code change
1. `npm run benchmark:e2e` — required (rendering changes affect transition/viewport behavior)

## Exit criteria for Phase 2

1. Building and stair silhouettes remain consistent while player moves.
2. Compact style maintained — no over-stretched vertical scale.
3. Visual readability improved vs Phase 1 baseline in test scenarios.
4. `npm run benchmark:e2e` PASS 14/14.
