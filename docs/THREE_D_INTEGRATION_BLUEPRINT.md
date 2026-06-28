# 3D Integration Blueprint

**Last updated:** 2026-06-17  
**Status:** 3D top-down slice is the **product runtime**; 2D Phaser is legacy.

Canonical deep-dives live under **`docs/three-d/`** — this file is the **integration map** (React ↔ Babylon ↔ shared game systems).

---

## 1. Architecture

```text
App.tsx
  └── ThreeDSliceView.tsx          React shell: menu, HUD, windows, canvas lifecycle
        └── createDebugSliceScene    Babylon loop: map, combat, AI, save
              ├── geometry.worker    Chunk mesh buffers
              ├── TwoDParitySpriteFactory / ThreeDEnemyVisualRegistry
              └── PlayerState (singleton) + SaveSystem.saveGameDirect
```

| Layer | Doc |
| :--- | :--- |
| Runtime loop | [three-d/SLICE_RUNTIME.md](./three-d/SLICE_RUNTIME.md) |
| Combat | [three-d/COMBAT_3D_PARITY.md](./three-d/COMBAT_3D_PARITY.md) |
| Save/load | [three-d/SAVE_LOAD_3D.md](./three-d/SAVE_LOAD_3D.md) |
| Events | [three-d/PLAYER_STATE_EVENTS_3D.md](./three-d/PLAYER_STATE_EVENTS_3D.md) |
| Inventory / audit | [three-d/SYSTEMS_INVENTORY.md](./three-d/SYSTEMS_INVENTORY.md), [three-d/COMPATIBILITY_AUDIT.md](./three-d/COMPATIBILITY_AUDIT.md) |

---

## 2. ThreeDSliceView.tsx (React shell)

**File:** `src/three-d/bootstrap/ThreeDSliceView.tsx`

### Responsibilities (delivered)

| Area | Implementation |
| :--- | :--- |
| Menu gating | `MainMenuUI` until `isInGame`; `handleThreeDStart` / `handleReturnToMenu` |
| Canvas lifecycle | Mount canvas only in-game; `createDebugSliceScene` + `dispose` on exit |
| Default map | `DEFAULT_3D_MAP = "city_3d_mundi_p1"` |
| HUD | `HUD`, rune hotbar (S8), damage vignette (S9), FP crosshair (S7 debug) |
| Windows | `WindowLayer`, `SystemMenuUI`, `HeroDashboard`, grimório/container via `WindowSystem` |
| Floating combat text | `ThreeDFloatingText` ← `PlayerState` `floatingText` events |
| Notifications | `NotificationSystem`, `LevelUpNotification` |
| Save UI | F5 + system menu → `runtime.save()` |
| DOM bridges | `slice3d:*`, `ui:windowToggled`, `returnToTitle` — see [PLAYER_STATE_EVENTS_3D.md](./three-d/PLAYER_STATE_EVENTS_3D.md) |

### Load game

Restores `playerState.loadState(save.playerState)`, sets URL `?map=` / `?level=`, then starts slice. See [SAVE_LOAD_3D.md §4](./three-d/SAVE_LOAD_3D.md#4-load-flow-menu--slice).

---

## 3. createDebugSliceScene.ts (game loop)

**File:** `src/three-d/runtime/createDebugSliceScene.ts` (~5200 lines)

Do **not** duplicate behavior here — use [SLICE_RUNTIME.md](./three-d/SLICE_RUNTIME.md).

Summary:

- BMS map load + chunk streaming ([CHUNK_STREAMING_3D.md](./three-d/CHUNK_STREAMING_3D.md))
- Top-down camera (product) + FP debug (`V`)
- Combat, enemies, loot, stairs, void fall
- `playerState.update` every frame (hunger/regen)
- Auto-save 60 s + `save()` export on `SliceRuntime`

**Do not** import `BattleSystem` for 3D combat — formulas are inlined with S10 parity ([COMBAT_3D_PARITY.md](./three-d/COMBAT_3D_PARITY.md)).

---

## 4. Shared systems (reuse as-is)

| System | Module | 3D usage |
| :--- | :--- | :--- |
| Player progression | `PlayerState` | Single singleton; emit/on bridge |
| Persistence | `SaveSystem.saveGameDirect` | No Phaser scene required |
| Audio | `AudioManager` | Footsteps, combat, pickup |
| Registries | `EnemyRegistry`, `RuneRegistry`, `ItemRegistry`, … | Data-driven spawn/combat |
| i18n | `t_game` | UI + slice messages |
| Minimap / fog | `WorldMapService`, `exploreArea` | Pre-render on map load |
| Maps | BMS JSON + `.bin` | `MapLoader` patterns via slice fetch |

---

## 5. Visual parity

| Topic | Doc |
| :--- | :--- |
| Hero billboard | [CHARACTER_VISUAL_SCOPE.md](./CHARACTER_VISUAL_SCOPE.md), [sprites/DIRECTION_CONVENTION.md](./sprites/DIRECTION_CONVENTION.md) |
| Enemy billboards | [three-d/ENEMY_SPRITE_RUNTIME.md](./three-d/ENEMY_SPRITE_RUNTIME.md) |
| Future body equip | [three-d/HERO_BODY_EQUIPMENT.md](./three-d/HERO_BODY_EQUIPMENT.md) |
| Item icons in world | [sprites/items/ITEM_VISUAL_PIPELINE.md](./sprites/items/ITEM_VISUAL_PIPELINE.md) |

2D `FloatingText` Phaser class is **not** used in 3D — use `PlayerState.emit("floatingText", …)` + `ThreeDFloatingText`.

---

## 6. Default maps

| Context | Map name |
| :--- | :--- |
| Menu new game | `city_3d_mundi_p1` — [world/MUNDI_P1_README.md](./world/MUNDI_P1_README.md) |
| Slice URL fallback | `debug_sandbox` |
| Combat regression | `debug_sandbox` — [debug/DEBUG_SANDBOX_MAP.md](./debug/DEBUG_SANDBOX_MAP.md) |
| Benchmark menu entry | `city_3d_multi` |

---

## 7. Perspective contract

Top-down 3D is canonical product view. FP camera is **debug-only** (`V`).  
See [contracts/PERSPECTIVE_MODE_CONTRACT.md](./contracts/PERSPECTIVE_MODE_CONTRACT.md).

---

## 8. Maintenance

When changing 3D integration:

1. Update the matching row in [COMPATIBILITY_AUDIT.md](./three-d/COMPATIBILITY_AUDIT.md)  
2. Update the domain doc (SLICE, COMBAT, SAVE, …)  
3. Append factual behavior notes to [MECHANICS_DELTAS.md](./MECHANICS_DELTAS.md) if player-visible rules change
