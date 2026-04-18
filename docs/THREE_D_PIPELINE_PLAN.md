# Separate 3D Pipeline Plan

## Intent

This plan defines a separate 3D world pipeline that preserves gameplay systems where practical while replacing the current map/render/runtime world layer.

This is not a renderer tweak.

It is a controlled architecture split between:

1. preserved gameplay/domain systems
2. replaced world/runtime systems

## Product Goal

Deliver a real 3D world runtime with:

1. true block volume from all camera-valid angles
2. stable oblique camera presentation
3. real spatial depth instead of fake tile extrusion
4. preserved RPG gameplay rules where map representation is not authoritative

## Non-Goals

This plan does not aim to:

1. retrofit the current `LevelRenderer` into full 3D
2. preserve BMS as the runtime world format for the 3D slice
3. guarantee zero-touch reuse of every map-dependent gameplay system
4. migrate the entire game before a vertical slice proves viability

## Preserve vs Replace

### Preserve First

These systems should remain authoritative unless a 3D constraint proves otherwise:

1. `PlayerState` as the gameplay state hub
2. combat formulas and progression rules
3. skills, stats, inventory, quests, dialogue, buffs, markers
4. item, enemy, and content registries where they do not assume 2D tile access
5. React UI windows, HUD, and notification layer
6. save payload concepts, adapted only where world coordinates must change

### Replace First

These systems should be treated as 3D-pipeline-owned and not preserved by default:

1. `MapLoader` / BMS runtime world access
2. `LevelRenderer` / `PerspectiveProjection`
3. tile-based collision and tile adjacency assumptions
4. tile/path worker navigation based on 2D level grids
5. current roof-cut and multi-floor visibility logic
6. map-driven level transitions tied to stairs/holes in 2D tile space

## Target Architecture

## 1. Domain Layer

Owns gameplay rules and remains as independent as possible from world representation.

Main candidates to preserve:

1. `PlayerState`
2. battle/stat systems
3. quest/inventory/dialogue systems
4. data registries

Rule:

Gameplay code must stop querying raw tiles directly. It should depend on a world adapter.

## 2. World Adapter Layer

This is the isolation seam between preserved gameplay and the new 3D runtime.

Suggested responsibilities:

1. spatial queries
2. occupancy queries
3. line of sight
4. interaction reachability
5. spawn point resolution
6. ground height / floor resolution
7. transition trigger lookup

Suggested interface families:

1. `WorldQueryService`
2. `WorldNavigationService`
3. `WorldSpawnService`
4. `WorldTransitionService`

The old tilemap runtime and the new 3D runtime can both satisfy these interfaces during migration.

## 3. 3D Runtime Layer

Owns rendering and spatial simulation.

Expected responsibilities:

1. scene graph
2. camera rig
3. mesh/block generation
4. collision / physics queries
5. entity placement in 3D coordinates
6. runtime picking or interaction ray checks if needed

Recommended initial stack:

1. Babylon.js for rendering and camera
2. minimal collision first, full physics only if truly needed

## 4. UI Bridge Layer

React must continue to talk to state/domain, not directly to the 3D engine runtime.

Allowed direction:

1. React -> `PlayerState` / app services
2. 3D runtime -> `PlayerState` events and domain services

Forbidden direction:

1. React components calling Babylon scene internals directly

## Vertical Slice Scope

The first slice must prove feasibility, not feature completeness.

Required slice contents:

1. one controllable player in a 3D world
2. one building/block structure with real volume
3. one fixed oblique camera rig
4. basic collision against world geometry
5. one enemy with minimal chase or idle behavior
6. one basic attack interaction
7. one dropped item pickup flow

Excluded from slice 1:

1. save migration
2. quests
3. multi-floor buildings beyond what is needed to prove the camera/world
4. full benchmark replacement
5. editor migration

## Go/No-Go Criteria

The separate 3D pipeline continues only if the slice proves all of the following:

1. the world finally delivers convincing block volume without renderer hacks
2. movement and collision feel stable under the chosen camera
3. one combat interaction can happen without breaking state ownership
4. UI and gameplay state can remain driven by existing domain systems
5. implementation pain is lower than continuing fake-3D iteration in Phaser

If the slice fails these criteria, the team should stop before broad migration.

## Migration Phases

## Phase 0 - Freeze Current 2.5D Renderer

Goal:

1. stop investing in the current perspective renderer except for regressions/blockers

Deliverables:

1. keep current renderer as legacy playable mode
2. move new 3D exploration into separate modules or workspace area

## Phase 1 - 3D Slice Bootstrap

Goal:

1. create a minimal standalone 3D runtime path

Deliverables:

1. Babylon scene bootstrap
2. player controller
3. camera rig
4. one simple world block set

## Phase 2 - Adapter Extraction

Goal:

1. isolate gameplay-facing world queries behind interfaces

Deliverables:

1. first `WorldQueryService`
2. first `WorldNavigationService`
3. old runtime adapter and new 3D adapter side by side

## Phase 3 - Gameplay Reattachment

Goal:

1. reconnect preserved gameplay systems to the 3D slice through the adapter layer

Deliverables:

1. enemy interaction proof
2. damage proof
3. item pickup proof

## Phase 4 - Persistence and Content Migration

Goal:

1. decide how 3D world coordinates and map identity persist in save files

Deliverables:

1. new save position schema or compatibility adapter
2. first migrated map content rules

## Phase 5 - Benchmark Replacement Strategy

Goal:

1. define how benchmark coverage survives the world migration

Deliverables:

1. new slice benchmark or smoke scenario
2. runtime-error capture parity with current benchmark path

## Risks

1. world migration leaks tile assumptions back into preserved gameplay code
2. save payload grows incompatible without a versioned migration plan
3. pathfinding cost rises if a 3D navigation model is chosen too early
4. UI starts depending on scene internals and breaks the existing state boundary
5. scope expands into full-engine rewrite before slice validation

## Immediate Next Step

Build the 3D slice architecture first.

Do not start by migrating the whole game.

The next implementation document should specify:

1. folder layout for the 3D slice
2. Babylon bootstrap entry points
3. adapter interfaces to extract first
4. exact acceptance checklist for the first playable slice

That operational sequence now lives in [docs/THREE_D_MIGRATION_STRATEGY.md](./THREE_D_MIGRATION_STRATEGY.md).