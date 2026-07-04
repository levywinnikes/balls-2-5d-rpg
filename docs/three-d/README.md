# 3D Runtime Documentation Hub

Canonical documentation for the **Babylon.js slice runtime** (`src/three-d/**`). The 2D Phaser runtime is legacy/debug unless explicitly referenced for parity.

**Product direction:** top-down 3D is the player-facing mode (`App.tsx` default). See `docs/contracts/PERSPECTIVE_MODE_CONTRACT.md`.

---

## Read order (agents and developers)

0. **[DESIGN_RULES_3D.md](./DESIGN_RULES_3D.md)** — **MANDATORY** decisions, NEVER list, pre-flight checklist  
0b. **[ENGINE_3D_STATE_AND_HARDENING.md](./ENGINE_3D_STATE_AND_HARDENING.md)** — **estado real, tensões, checklist, plano de consolidação** (ler antes de remendar)  
1. [PRODUCT_3D_VISION.md](./PRODUCT_3D_VISION.md) — product north star (plain language)  
2. [SYSTEMS_INVENTORY.md](./SYSTEMS_INVENTORY.md) — what exists in code today  
3. [COMPATIBILITY_AUDIT.md](./COMPATIBILITY_AUDIT.md) — doc ↔ code ↔ contracts ↔ delivered mechanics  
3. Domain deep-dives (as they are completed):

| Doc | System |
| :--- | :--- |
| [../sprites/DIRECTION_CONVENTION.md](../sprites/DIRECTION_CONVENTION.md) | Sprite directions (hero + enemies) |
| [../CHARACTER_VISUAL_SCOPE.md](../CHARACTER_VISUAL_SCOPE.md) | Hero visual alpha scope |
| [HERO_BODY_EQUIPMENT.md](./HERO_BODY_EQUIPMENT.md) | Future body equipment layers |
| [ENEMY_SPRITE_RUNTIME.md](./ENEMY_SPRITE_RUNTIME.md) | Generated enemy billboards |
| [../debug/DEBUG_SANDBOX_MAP.md](../debug/DEBUG_SANDBOX_MAP.md) | Playtest map |
| [../debug/DEBUG_VERTICAL_MAP.md](../debug/DEBUG_VERTICAL_MAP.md) | **Vertical stress map** (-2…+2) |
| [SLICE_RUNTIME.md](./SLICE_RUNTIME.md) | **`createDebugSliceScene`** — loop, input, map, chunks, stairs, combat wiring |
| [COMBAT_3D_PARITY.md](./COMBAT_3D_PARITY.md) | Combat formulas, runes, parity matrix vs `BattleSystem` |
| [SAVE_LOAD_3D.md](./SAVE_LOAD_3D.md) | `saveGameDirect`, snapshot, load gaps |
| [CHUNK_STREAMING_3D.md](./CHUNK_STREAMING_3D.md) | Worker protocol, chunk budgets |
| [WATER_SYSTEM_3D.md](./WATER_SYSTEM_3D.md) | Aquatic tiles, shader tint, surfaces (3D only) |
| [ENGINE_3D_STATE_AND_HARDENING.md](./ENGINE_3D_STATE_AND_HARDENING.md) | **Estado da engine, invariantes, plano de consolidação** |
| [STAIR_MAP_RULES.md](./STAIR_MAP_RULES.md) | Layout de escadas nos geradores de mapa |
| [PENDING_BACKLOG.json](./PENDING_BACKLOG.json) | **Active pending tasks** (water, elevation, enemies) |
| [ELEVATION_AND_TRANSITION_PLAN.md](./ELEVATION_AND_TRANSITION_PLAN.md) | Ramps, stairs, hills — plan + Phase 1 status |
| [PLAYER_STATE_EVENTS_3D.md](./PLAYER_STATE_EVENTS_3D.md) | emit/on + DOM bridges |
| [../world/MUNDI_P1_README.md](../world/MUNDI_P1_README.md) | Default map `city_3d_mundi_p1` |

4. Cross-cutting: [../PROJECT_DOCUMENTATION_INDEX.md](../PROJECT_DOCUMENTATION_INDEX.md), [../DOCUMENTATION_AUDIT.md](../DOCUMENTATION_AUDIT.md)

---

## Source code map

```
src/three-d/
  bootstrap/ThreeDSliceView.tsx    React shell, menu, HUD, canvas lifecycle
  runtime/
    createDebugSliceScene.ts       Main Babylon runtime (~5200 lines)
    TwoDParitySpriteFactory.ts     Hero + enemy billboard materials
    CharacterVisualProfile.ts      hero_default profile resolution
    ThreeDEnemyVisualRegistry.ts   Enemy mesh + procedural/generated sprite
    GroundHeightQuery3D.ts         Thin wrapper → TileSurfaceResolver
    TileSurfaceResolver.ts         Single source of truth for surface/foot Y
    VerticalLevelVisibility3D.ts   Column-based level culling (Fase C)
    WaterProfile.ts / WaterQuery3D.ts / WaterEffectSystem.ts
    ThreeDFloatingText.tsx         React overlay for floating combat text
src/workers/geometry.worker.ts   Off-thread chunk mesh buffers
```

**Entry:** `App.tsx` → `ThreeDSliceView` → `createDebugSliceScene(canvas)` when `isInGame`.

**Default map:** URL `?map=` or `ThreeDSliceView` constant `city_3d_mundi_p1`; `createDebugSliceScene` reads `debug_sandbox` when param set.

---

## Maintenance rule

When a 3D subsystem behavior changes:

1. Update the matching row in `COMPATIBILITY_AUDIT.md`  
2. Update or create the domain deep-dive doc  
3. Append `docs/MECHANICS_DELTAS.md`  
4. Run validations from `docs/VALIDATION_MATRIX.md` (gameplay → `tsc` + `smoke:test`)
