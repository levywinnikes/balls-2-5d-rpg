# Engine Architecture

## Overview

The 3D engine is a **modular, dependency-injected system** centered around a single `GameContext` object. All shared state, system references, and callbacks flow through `ctx`.

**📚 Documentação detalhada em `docs/three-d/`:**
- [COLLISION_SYSTEM.md](../../docs/three-d/COLLISION_SYSTEM.md) — Volumes, blocked(), isTileBlockedForGameplay
- [RENDERING_SYSTEM.md](../../docs/three-d/RENDERING_SYSTEM.md) — Chunk geometry pipeline, entidades
- [LEVEL_TRANSITION.md](../../docs/three-d/LEVEL_TRANSITION.md) — checkLevelDrift, applyActiveLevelChange, snap
- [FALL_AND_RESPAWN.md](../../docs/three-d/FALL_AND_RESPAWN.md) — Dano de queda, morte, spawnPoint
- [DOOR_SYSTEM.md](../../docs/three-d/DOOR_SYSTEM.md) — Ciclo de vida, colisão, interação
- [BOOTSTRAP_FLOW.md](../../docs/three-d/BOOTSTRAP_FLOW.md) — Ordem de inicialização completa

```
createSliceScene()  ← entry point, one-time setup
  ├── creates Babylon engine/scene
  ├── creates 30+ systems
  ├── wires them via GameContext (ctx)
  ├── bootstraps the world (async)
  └── returns { engine, scene, save, dispose }
```

## File Map

```
src/three-d/runtime/
  createSliceScene.ts          Bootstrap & wiring (1420 lines)
  createGameContext.ts          ctx factory (254 lines)
  GameContext.ts                Central interface (135 lines)

  ── Core Systems ──
  PlayerContext.ts              Physics state (position, velocity, grounded)
  PlayerPhysicsSystem.ts        Capsule movement, jump, void detection
  PlayerFallSystem.ts           Fall damage, death sequence, respawn
  CollisionWorld.ts             Tile-based collision volumes (queryFloor, isHorizontalBlocked)

  ── Level & Map ──
  LevelTransitionSystem.ts      Level changes (applyActiveLevelChange, sync, snap)
  LevelBootstrap.ts             ensureMapLevelReady — full level load pipeline
  WorldBootstrap.ts             bootstrapWorldSession — retry loop, world-ready signal
  MapDataLoader.ts              Fetch JSON/binary, rebuild collision, bootstrap minimap
  MapRenderer.ts                renderMapLevel — binary load, nav rebuild, chunk tick
  PoolFloorResolver.ts          Water tile → neighbor floor material for rendering

  ── Combat & Enemies ──
  EnemyStreamSystem.ts          Enemy spawning, streaming, AI tick
  EnemyDeathHandler.ts          destroyEnemy — death sequence, loot, XP, respawn
  EnemyPathfinding.ts           requestEnemyPath (A*), advanceEnemyPath (waypoint movement)
  SlashTrailEffect.ts           Attack VFX — billboarded gradient slash
  SliceCombatSystem.ts          Rune casting, combat state

  ── Items & Pickup ──
  DropPickupSystem.ts           Drop/pickup/persistent item logic
  DropStreamSystem.ts           Dropped item mesh streaming

  ── Rendering ──
  RenderSystem.ts               Main render loop (tick, telemetry, auto-save)
  ChunkStreamSystem.ts          Chunk geometry streaming
  ChunkGeometryBuilder.ts       Mesh builders (roof, stair)
  TileMaterialSystem.ts         Tile → material resolution
  VisibilitySystem.ts           Vertical level occlusion
  InteractableWallRevealSystem.ts  Wall reveal behind enemies/doors
  WaterEffectSystem.ts          Water rendering
  DebugColliderVisuals.ts       Debug collision wireframes
  TwoDParitySpriteFactory.ts    Hero sprite material & direction

  ── Infrastructure ──
  Slice3DTypes.ts               Shared type definitions
  SliceRuntimeUtils.ts          Pure utility functions
  GroundQuerySystem.ts          getGroundSurfaceY, resolveWorldAnchorY, applyActorAquaticY
  TileBlocking.ts               isStaticTileBlocking, isBlockingTile
  RevealTargetCollector.ts      collectInteractableRevealTargets
  DamagePopupSystem.ts          Floating damage numbers, blood burst
  RuneCastSystem.ts             Rune targeting mode & UI bridge
  DebugSandboxSetup.ts          Grants test items for debug maps
  DisplaySettings.ts            Render scale, quality preset, fog
  TelemetryLogger.ts            Performance logging & runtime diagnostics
  PointerPickingSystem.ts       Click → entity resolution
  NavigationSystem.ts           Grid-based A* navigation
  CameraSystem.ts               Top-down & first-person camera
  DoorSystem.ts                 Door state & interaction
  PropStreamSystem.ts           Prop (tree, rock, etc.) streaming
  AudioSystem.ts                Audio playback
  SliceInputManager.ts          Keyboard/mouse → game actions
  QualitySystem.ts              Quality preset ↔ streaming radii
  StreamOrchestrator.ts         Coordinates prop/enemy/drop streaming
  FallSafetySystem.ts           Void detection & safety teleport
  NaturalFloorLevel3D.ts        Level inference from Y position
  TileWorldY.ts                 Tile height & ramp calculations
  StairConfig3D.ts              Stair geometry config
  WaterHoleConfig.ts            Water hole detection
  WaterProfile.ts               Aquatic tile properties
  WaterQuery3D.ts               Aquatic sampling at world position
  WallRevealLos.ts              Line-of-sight raycasting
  BmsDirectionResolver.ts       Direction → sprite frame mapping
  FirstPersonCombatPresentation.ts  First-person combat camera
  SpriteAnimLod.ts              Sprite animation LOD
  SpriteTexturePool.ts          Sprite texture recycling
  SliceQualityRuntime.ts        Quality → runtime config mapping
  GeneratedSpriteDirectionMeta.ts  Pre-computed direction metadata
```

## Initialization Order

```
1. Babylon Engine + Scene created
2. Hero billboard + shadow meshes
3. Streaming systems (Water, WallReveal, Props, Enemies, Drops, Doors)
4. StreamOrchestrator, CameraSystem, TileMaterialSystem, TelemetryLogger
5. CollisionWorld, NavigationSystem, PathfindingManager
6. PointerPickingSystem, ChunkStreamSystem
7. GameContext (ctx) — central state hub
8. Late-init systems (LevelTransition, Damage, Ground, PlayerFall, SliceCombat, SliceEnemy, DropPickup, InputManager)
9. void bootstrapWorldSession() — async world load
10. RenderSystem — render loop
```

## The box() Pattern

Some systems are created AFTER ctx but need to be accessible via ctx. The `box()` function creates a getter/setter pair:

```typescript
// Variable declared early, assigned later
let fallSystem: PlayerFallSystem;

// ctx getter uses box() to defer access
ctx = createGameContext({
  fallSystem: box(() => fallSystem, (v) => { fallSystem = v; }),
});

// System created later, now ctx.fallSystem works
fallSystem = createPlayerFallSystem({ ctx });
```

This is a **lazy initialization pattern** for circular dependencies (systems need ctx, ctx needs system references).

## Key Design Decisions

- **PlayerContext is single source of truth** for physics state (no mirrored variables)
- **GameContext centralizes all shared state** (no scattered closure captures)
- **RenderSystemDeps only has render-specific fields** (10 fields, everything else via ctx)
- **All types are explicit** (zero `any` in public interfaces)
- **Extracted modules are <300 lines** each (AI-comprehensible). Pre-existing systems (CollisionWorld, SliceCombatSystem, etc.) remain at their original sizes.
