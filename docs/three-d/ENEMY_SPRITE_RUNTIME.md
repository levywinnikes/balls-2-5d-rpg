# Enemy Generated Sprite Runtime (3D)

Canonical guide for wiring PixelLab-generated enemy sprites into the Babylon.js slice runtime. Read this before touching `TwoDParitySpriteFactory.ts`, `ThreeDEnemyVisualRegistry.ts`, or enemy AI direction in `createDebugSliceScene.ts`.

Related docs:

- Asset generation: `docs/sprites/MODULAR_SPRITE_AND_NPC_GENERATION_GUIDE.md` (section 3)
- Sprite contract: `docs/contracts/SPRITE_PIPELINE_CONTRACT.md`
- Pilot spec: `docs/sprites/enemies/goblin-lanceiro.spec.json`
- Test map: `docs/debug/DEBUG_SANDBOX_MAP.md`

---

## 1. Direction convention (critical)

**Canonical doc:** `docs/sprites/DIRECTION_CONVENTION.md` — read fully before changing direction code or integrating new enemies.

Summary (details + validation + post-mortem in that file):

| BMS direction | 2D anim suffix | Sprite faces | Phaser velocity |
| :--- | :--- | :--- | :--- |
| `south` | `down` | Toward camera (front) | `velocity.y > 0` |
| `north` | `up` | Away from camera (back) | `velocity.y < 0` |
| `east` | `right` | Right profile | `velocity.x > 0` |
| `west` | `left` | Left profile | `velocity.x < 0` |

**World axes in the 3D slice:**

- Map tile `x` → world `X`
- Map tile `y` → world `Z` (see `worldToSliceCoord` / spawn in `createDebugSliceScene.ts`)

**Runtime mapping** — `resolveBmsDirectionFromWorldDelta` in `BmsDirectionResolver.ts`:

1. Project world `(deltaX, deltaZ)` through the **active camera** (top-down *or* first-person).
2. Convert to screen `(moveRight, moveForward)` — same axes as hero WASD.
3. Call `resolveHeroBmsDirection` — **one function for hero + all enemies**.

Asset E/W remap (only when PixelLab folders are mislabeled): `src/three-d/runtime/sprite-direction-meta.json` (from `npm run audit:sprite-directions`).

Regression: `npm run test:sprite-direction`

Same screen axes as `resolveHeroBmsDirection` (camera top-down α=π/2). See `docs/sprites/DIRECTION_CONVENTION.md` §3.

**Asset folder remap:** only if `direction_validation.status` is `runtime_swap_east_west` — fix assets on disk instead (`npm run fix:sprite-east-west`).

Hero input uses `resolveHeroBmsDirection(moveForward, moveRight)` (screen-relative WASD). Enemies use world delta — do **not** copy the hero function for pathfinding.

Reference 2D parity: `src/game/entities/Enemy.ts` lines ~197–200.

### Why E/W keeps breaking (read this once)

| Space | Horizontal rule | Example |
| :--- | :--- | :--- |
| **Phaser 2D** | `velocity.x > 0` → anim `right` / folder `east` | Tile X increases to the right on canvas |
| **3D slice world** | `screen-right = −deltaX` → folder `east` | Camera α=π/2: world **+X** appears on the **left** of the screen |

Same PNG folders, **different axis mapping**. Copying the Phaser rule into `resolveWorldBmsDirection` inverts every enemy left/right in 3D.

**Fix assets:** `npm run audit:sprite-directions -- --fix`  
**Fix runtime:** `npm run test:sprite-direction` (must pass before merge)

---

## 2. Asset folder layout

Generated assets live under:

```
public/assets/sprites/generated/{entityId}/
  character.json
  character_rotations/
    south.png | north.png | east.png | west.png
  idle_south/frame_00.png … frame_03.png
  idle_north/…
  idle_east/…
  idle_west/…
  walk_{direction}/frame_XX.png
  attack_{direction}/frame_XX.png
  death_south/frame_XX.png   ← death is south-only, clamped (no loop)
```

Folder naming: `{state}_{direction}` with zero-padded frames `frame_00.png`.

---

## 3. Code registration checklist

When adding a new generated enemy (copy from `skeleton`):

0. **Spec:** `category: "enemy"` + prompt **unarmed** — see `MODULAR_SPRITE_AND_NPC_GENERATION_GUIDE.md` §3.0.
1. **Validate directions** against `hero_base` — mandatory steps in `docs/sprites/DIRECTION_CONVENTION.md` §2. Add `direction_validation` to the spec JSON.
1. **Generate assets** with `npm run generate:pixellab-sprite -- --spec docs/sprites/enemies/{spec}.json --entity {entityId}`.
2. **`GENERATED_SPRITE_ENTITIES`** — add `{entityId}` in `TwoDParitySpriteFactory.ts`.
3. **`GENERATED_ANIM_DEFS`** — list frame counts per state/direction (death usually `south` only).
4. **`GENERATED_SPRITE_ALIASES`** — map legacy registry IDs (e.g. `goblin` → `goblin_lanceiro`).
5. **`EnemyRegistry.ts`** — enemy stats unchanged; visual is resolved by ID.
6. **`ThreeDEnemyVisualRegistry.ts`** — optional billboard size tweak in `PROFILE_BY_ENEMY_ID`.
7. **`createDebugSliceScene.ts`** — uses `resolveBmsDirectionFromWorldDelta`; no per-enemy hacks.
8. **Gate:** `npm run test:sprite-direction` before merging sprite or AI changes.

Runtime picks **animated** mode by default. `GENERATED_SPRITE_PROFILES` with `mode: "rotations"` is fallback-only when frame folders are missing.

---

## 4. Runtime behavior

| Concern | Implementation |
| :--- | :--- |
| Material | `createGeneratedSpriteAnimatedMaterial` |
| States | `_setAnimState`: idle / walk / attack / death |
| Direction | `_setDirection` via `setEnemyVisualDirection` |
| Death | `death_south` only; material clamps last frame; dispose delayed by `getGeneratedDeathDurationMs` |
| Attack lock | `getGeneratedAttackDurationMs` — must cover all attack frames; `_setAnimState("attack", true)` restarts clip |
| Fallback | Procedural capsule from `createEnemyParitySpriteMaterial` when ID not in `GENERATED_SPRITE_ENTITIES` |

AI direction updates:

- **While chasing or in melee:** face player via `resolveBmsDirectionFromWorldDelta` (active camera)
- **While returning to spawn:** movement delta
- **While attacking:** face player before `applyEnemyAttackToPlayer`; idle between swings after lock expires

---

## 5. Validation

1. Regenerate sandbox if needed: `npm run generate:debug-sandbox`
2. Launch: menu **DEBUG SANDBOX** or `play-debug-sandbox.bat`
3. Confirm for `goblin` and `goblin_lanceiro` (full matrix in `docs/sprites/DIRECTION_CONVENTION.md` §2):
   - **South / north / east / west** when player stands below / above / right / left
   - Attack plays all frames in the correct direction
   - Death plays `death_south` once, corpse stays until duration elapses

---

## 6. Known limitations

- Only entities in `GENERATED_SPRITE_ENTITIES` use PNG sheets; others keep procedural placeholders.
- **Implemented generated enemies:** `goblin_lanceiro`, `skeleton`, `bear`, `rat` (quadruped `template_id: cat`).
- Death animation is south-only (PixelLab default).
- Goblin canvas is 64×64 vs hero 92×92 — billboard scale may differ slightly.
