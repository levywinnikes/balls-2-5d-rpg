# 3D Projectile System

Canonical reference for **physical weapon projectiles** in the Babylon slice runtime.

**Code:** `src/three-d/runtime/Projectile3DSystem.ts`  
**Integration:** `createDebugSliceScene.ts` → `firePlayerWeaponProjectile`, `tryAutoPlayerAttack`  
**2D parity:** `src/game/entities/projectiles/WeaponProjectile.ts`

Related: [COMBAT_3D_PARITY.md](./COMBAT_3D_PARITY.md), [SLICE_RUNTIME.md](./SLICE_RUNTIME.md)

---

## 1. Scope (Fase 3 v1)

| Weapon | Visual | Speed | Notes |
| :--- | :--- | :--- | :--- |
| `short_bow` | Brown arrow box | 20 u/s | Linear flight |
| `throwing_star` | Gold spinning box | 16 u/s | Hits first enemy along path |

Runes (`castRune3d`) still use the legacy homing sphere — migration to this system is backlog.

---

## 2. Simulation model

```
fire(origin, direction, maxRange, profile)
  → each frame: move along normalized direction
  → sub-step collision (0.12 tile steps)
  → grid wall check (navigationGrid blocking tiles)
  → enemy radius check (first enemy wins)
  → onEnemyHit → applyPlayerAttackToEnemy (same formulas as melee)
```

**Line of sight at fire time:** `tryAutoPlayerAttack` still requires initial LOS to selected target.  
**Mid-flight:** projectile stops on blocking tiles; can hit a closer enemy before the selected one.

---

## 3. Grid collision

Reuses `findFirstBlockingTileOnGridLine` from `WallRevealLos.ts` on the same `navigationGrid` as combat pathfinding.

---

## 4. Visual (v1)

**PixelLab asset:** `docs/sprites/projectiles/arrow.spec.json`  
Regenerate: `npm run generate:arrow-projectile`  
Output: `public/assets/sprites/generated/arrow/` (base + 3 animations × 5 frames, direction `east`)

| Animation | Use |
| :--- | :--- |
| `feather_sway_gentle` | Slow / idle sway |
| `feather_sway` | Medium flight |
| `fly_loop` | Fast shot (default bow speed) |

Runtime picks animation by projectile speed. Fallback: procedural brown box if assets missing.

Throwing star still uses procedural gold box (item icon backlog).

---

## 5. Pause / dispose

- Projectiles **do not advance** while `gameplayPaused`.
- `projectileSystem.disposeAll()` on slice dispose.

---

## 6. Validation (debug sandbox)

1. Equip `short_bow`, select enemy, stand in range → arrow flies, damage on hit.
2. Put wall between player and enemy → projectile stops at wall, no damage.
3. Two enemies in a line → front enemy takes the hit.
4. Equip `throwing_star` → gold star spins and behaves the same.

---

## 7. Backlog

- Migrate rune projectiles to `Projectile3DSystem` (homing profile)
- Arrow sprite asset + FP visual tweak
- Ammo consumption for bow (`EquipmentSlot.AMMO`)
- `throwing_star` stack decrement on throw
