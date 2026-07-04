# Perspective Mode Contract (Top-Down Product Direction)

## 1. Purpose

This contract defines perspective behavior during alpha-to-migration, with top-down as the only player-facing product direction and alternate view modes retained only for internal debugging and validation.

Scope:

- Top-down and alternate debug-view runtime behavior during migration.
- Rendering projection over multi-level maps.
- Entity/container synchronization under perspective transforms.
- Interaction with level transitions and save/load.

Current product status:

- Top-down layered presentation is the only product-facing visual direction.
- Alternate runtime view modes may exist for development and validation only.
- Perspective/debug switching must not remain exposed as a normal gameplay choice.

Related analysis:

- `docs/PERSPECTIVE_MODE_PHASE1_FEASIBILITY.md`
- `docs/PERSPECTIVE_MODE_MASTER_PLAN.md`
- `docs/PERSPECTIVE_PHASE0_BASELINE.md`

## 2. Current Runtime Model

### 2.1 Source of Truth

- `PlayerState` owns the runtime mode state and any debug-view flags.
- Mode changes emit `perspectiveModeChanged` with the selected mode.
- Product-facing map semantics and visibility rules must be authored for top-down first, regardless of any internal debug mode state.

### 2.2 UI Trigger

- Any perspective toggle must be treated as internal/debug-only UI.
- Player-facing HUD flows must not depend on perspective switching for normal gameplay.

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

### 2.5 3D Babylon Runtime (`createDebugSliceScene.ts`)

Product-facing 3D slice rules (top-down is canonical):

1. **Camera follow:** In top-down mode, `ArcRotateCamera.setTarget` must track the player position **every frame without lazy lerp**. The hero stays screen-centered; the world scrolls (ARPG baseline: Diablo / Path of Exile style).
2. **Camera presets:** `safe` and `cinematic` presets tune beta/radius/FOV only; they must not reintroduce follow lag or player off-center drift at movement speed ~4.5 u/s.
3. **Alternate view:** First-person camera is debug-only (`V` toggle). It must not drive map authoring, UI axis conventions, or minimap semantics.
4. **Axis / minimap parity:** World position published to `PlayerState` uses `(player.x * 32, player.z * 32)` with `+X = east`, `+Y = south`; see `docs/MAP_UI_MECHANICS.md`. Do not mirror axes in UI to compensate for camera bugs.
5. **Hero presentation:** Modular billboard (`hero_base` + `equippedHairId` hair layer) is the player-facing avatar in top-down; grounding uses `HERO_BILLBOARD_LAYOUT.anchorY` from measured feet row in generated PNGs.
6. **First-person rendering:** No modo primeira pessoa, **todos os andares do mapa são renderizados** sem oclusão vertical. A única limitação é o far clipping plane (`camera.maxZ = 120`). A pilha vertical (`verticallyVisible`) e conexões entre andares (escadas/buracos) são ignoradas — o jogador vê a estrutura completa. Ver `DESIGN_RULES_3D.md` R1a.

Implementation reference: `src/three-d/runtime/createDebugSliceScene.ts`, `src/three-d/runtime/TwoDParitySpriteFactory.ts`, `docs/sprites/MODULAR_SPRITE_AND_NPC_GENERATION_GUIDE.md` §4.2.

## 3. Level System Coupling

### 3.1 Multi-Level Visibility

- Renderer keeps current level as main context and can render lower and upper levels within culling boundaries.
- Transparency and under-tile logic (`under: "..."`) are part of vertical readability.
- **3D slice (canonical):** when the hero stands under upper-level geometry, those levels **must hide entirely** (every chunk) so the hero stays visible. Partial occlusion (hiding only the hero's chunk) produces visual artifacts — the upper level looks "bitten". Implementation and anti-regression rules: **`docs/three-d/DESIGN_RULES_3D.md`** § R1–R2 (`syncVerticalLevelVisibility`, `findUpperOcclusionLevel`). Do not add parallel mesh-visibility passes.

### 3.2 Transition System

- Transition flow is handled by `TransitionSystem`.
- Manual transitions (stairs/holes) are currently favored over automatic transitions.
- Perspective mode must not break transition consistency for `currentLevel` registry state and pathfinding updates.

## 4. Persistence Rules (Current and Target)

### 4.1 Current Behavior

- Alternate debug modes may still be runtime-switchable internally.
- Persistence behavior is still provisional and may change while top-down migration stabilizes.

### 4.2 Target Behavior

- Before beta/release, persistence policy must be finalized and documented in both save and player-state contracts.

## 5. Known Gaps

1. Top-down migration is not production-ready and may still present visual/interaction inconsistencies.
2. Stair readability, upper-floor hide/show, and combat clarity still need scenario-driven visual tuning in top-down maps.
3. Some transition/debug entry points still rely on permissive typing and should be tightened.
4. Perspective-specific UX expectations are not yet formalized as measurable criteria for top-down-first validation.

## 6. Change Direction (Required for Refactor)

When perspective mode is redesigned, implementation must be split into these phases:

1. Product intent definition:

- Define expected player experience for top-down mode.
- Define debug-only expectations for alternate modes without letting them drive player-facing design.
- Define acceptance criteria for visibility, controls, and readability with top-down as primary baseline.

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
2. Keep `currentLevel` registry, player state level, renderer level, and top-down visibility state in sync.
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
