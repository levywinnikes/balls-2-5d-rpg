# Separate 3D Migration Strategy

## Purpose

This document turns the separate 3D pipeline plan into an operational migration sequence.

It answers:

1. what to build first
2. what must remain frozen
3. when gameplay may reconnect
4. when persistence and benchmark work are allowed
5. when to stop if the 3D slice is not paying off

## Migration Principle

Do not migrate the game in one pass.

Migrate in proof-oriented layers:

1. prove the 3D world
2. prove the adapter seam
3. prove one gameplay loop
4. only then migrate persistence/content/benchmark

## Freeze Rules

Until the vertical slice passes, the following stay frozen except for regressions/blockers:

1. Phaser perspective renderer ambitions
2. BMS-to-3D conversion efforts beyond temporary slice fixtures
3. save schema changes
4. benchmark harness replacement
5. editor migration

This avoids spending migration effort before the new runtime is proven.

## Recommended Stack Decision

Recommended default:

1. Babylon.js for the 3D slice runtime

Reason:

1. TypeScript-friendly
2. good camera and scene primitives out of the box
3. easier path to a web/Electron-compatible spike than moving to an external engine

## Proposed Workspace Shape

Suggested new top-level runtime area:

1. `src/three-d/`

Suggested first folders:

1. `src/three-d/bootstrap/`
2. `src/three-d/runtime/`
3. `src/three-d/world/`
4. `src/three-d/entities/`
5. `src/three-d/adapters/`
6. `src/three-d/debug/`

Suggested responsibility split:

1. `bootstrap/`: Babylon engine bootstrap and scene entry
2. `runtime/`: camera rig, update loop, runtime orchestration
3. `world/`: block/building generation and spatial queries
4. `entities/`: player/enemy/item scene objects for the slice
5. `adapters/`: bridge between preserved gameplay/domain and the new world
6. `debug/`: temporary dev map fixtures, spawn presets, diagnostics

## Phase-by-Phase Strategy

## Phase 1 - Engine Bootstrap Slice

Goal:

1. render a minimal 3D scene inside the existing app stack without touching live gameplay runtime

Deliverables:

1. Babylon canvas integration path
2. fixed oblique camera
3. player capsule or placeholder mesh
4. block-based building mesh
5. ground plane and collision proof

Completion gate:

1. moving around one 3D house already feels closer to the desired result than the current 2.5D renderer

Rollback trigger:

1. if visual result still feels wrong after a minimal scene, stop before adapter work

## Phase 2 - World Adapter Extraction

Goal:

1. stop preserved gameplay code from assuming tilemap access

Deliverables:

1. `WorldQueryService` interface draft
2. `WorldNavigationService` interface draft
3. `WorldSpawnService` interface draft
4. adapter shim for current Phaser world
5. adapter shim for new 3D slice world

Priority methods to extract first:

1. `getPlayerWorldPosition()`
2. `isPositionWalkable()`
3. `findGroundPoint()`
4. `findNearestInteractionTarget()`
5. `hasLineOfSight()`

Completion gate:

1. at least one gameplay-facing caller can ask the adapter instead of a tile API directly

Rollback trigger:

1. if adapter extraction explodes into broad gameplay rewrites too early, narrow the slice instead of continuing

## Phase 3 - Single Gameplay Loop Reattachment

Goal:

1. prove that preserved gameplay systems can drive the 3D slice through the adapter seam

Deliverables:

1. one enemy represented in 3D
2. one basic attack flow using existing combat rules
3. one dropped item pickup using existing inventory/state rules

Rules:

1. keep AI minimal
2. do not migrate full quest or save logic yet
3. if a gameplay system needs a spatial query, route it through the adapter

Completion gate:

1. player can move, attack, damage, kill, and pick up in the 3D slice without bypassing `PlayerState`

Rollback trigger:

1. if combat only works by hardcoding scene-specific hacks, stop and redesign the adapter before moving on

## Phase 4 - Save and World Identity Strategy

Goal:

1. define how the new world persists without corrupting existing saves

Deliverables:

1. world-position schema proposal
2. map/world identifier strategy for 3D slice saves
3. versioning or compatibility notes for old saves

Recommended rule:

1. keep the current save payload concept, but version the world-position payload separately instead of mutating it ad hoc

Completion gate:

1. a save made in the slice restores player position and core `PlayerState` cleanly

Rollback trigger:

1. if save compatibility becomes unclear, freeze persistence work and keep the slice as ephemeral until the schema is explicit

## Phase 5 - Benchmark Transition

Goal:

1. preserve automated confidence while the world layer changes

Deliverables:

1. separate 3D slice smoke scenario
2. runtime-error capture parity
3. explicit PASS/FAIL contract for the slice

Recommended approach:

1. keep the current benchmark intact until the 3D slice has its own smoke path
2. run both paths during migration if necessary

Completion gate:

1. the slice can be launched, exercised automatically, and reported deterministically

Rollback trigger:

1. if the slice cannot be benchmarked deterministically, it is not ready to replace the old world runtime

## Explicit Order of Implementation

Use this order and do not skip ahead:

1. Babylon bootstrap
2. fixed camera rig
3. player movement + collision
4. one convincing building/block
5. adapter interfaces
6. first gameplay loop
7. save schema plan
8. benchmark plan
9. broader content migration

## What Not To Do Early

Avoid these before Phase 3 proves value:

1. migrating all maps
2. rewriting editor tooling
3. full navigation/pathfinding replacement
4. multi-floor megastructures
5. broad save compatibility promises
6. replacing the old benchmark harness

## Success Definition For The Slice

The slice is successful if all are true:

1. a house/block reads as genuinely 3D without fake tile hacks
2. the camera presentation matches the intended game feel
3. combat + pickup can reuse preserved state/domain systems
4. UI still observes gameplay state through the same boundary model
5. the development path feels simpler than continuing the Phaser fake-3D approach

## Failure Definition

Stop the migration if any of these remain true after Phase 3:

1. 3D visual result is still not the desired look
2. the adapter seam cannot be kept narrow
3. preserved systems require too much world-specific rewrite
4. runtime complexity exceeds the benefit

## Immediate Next Implementation Task

The next code task should be:

1. scaffold `src/three-d/`
2. add Babylon bootstrap dependencies and entry points
3. create a standalone debug scene with one player, one block house, and one fixed oblique camera

## Current bootstrap status

Implemented bootstrap slice entry:

1. Babylon dependency added
2. isolated query-param entry via `?slice3d=1`
3. `src/three-d/` scaffold created
4. standalone debug scene now renders a movable player, one house, one test block, and a fixed oblique camera

## Current test access and controls

Use one of these URLs to open the isolated Babylon slice (without entering normal gameplay flow):

1. `http://localhost:4000/?slice3d=1`
2. `http://localhost:4000/?debug_3d=true`
3. optional map override for seeding in the 3D slice: `http://localhost:4000/?slice3d=1&map=newmap`

Current runtime default:

1. 3D slice is now the default app entry.
2. Legacy 2D runtime remains available as fallback via:
	- `http://localhost:4000/?legacy2d=1`
	- `http://localhost:4000/?mode=2d`
3. Benchmark compatibility is preserved because `autobenchmark=1` forces legacy 2D entry.

Control mapping in the isolated slice:

1. `W` / `ArrowUp`: move forward
2. `S` / `ArrowDown`: move backward
3. `A` / `ArrowLeft`: strafe left
4. `D` / `ArrowRight`: strafe right
5. `Space`: jump
6. `V`: toggle third-person / first-person camera
7. First-person mode: look around with mouse
8. `E`: pickup nearby item (torch orb test), syncing to `PlayerState` inventory

Recent stabilization fixes for this phase:

1. URL compatibility fix to accept both `slice3d` and `debug_3d` query params
2. map JSON loading hardened in `MapLoader` using robust fetch-based path
3. W/S movement inversion corrected in the Babylon debug slice runtime
4. first 2D gameplay mechanic attached to 3D slice: proximity pickup via `PlayerState.addItem(...)`
5. dropped items in the 3D slice now consume the real per-level persistent item list from `PlayerState`, preserving item UID/count/stars/attributes on pickup

Current limitation:

1. the isolated 3D slice now reads real persistent dropped items and also seeds first-visit item entities from map JSON metadata (`entityTemplates` + `levels[level].entities`) into `PlayerState`
2. non-item entities remain outside this slice scope; enemy/container behavior still depends on broader migration phases
3. when no persistent dropped item exists for the current level, the torch orb fallback remains available only as an empty-state debug pickup
