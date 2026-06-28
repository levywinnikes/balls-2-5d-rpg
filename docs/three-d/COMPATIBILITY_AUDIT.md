# 3D Compatibility Audit

**Purpose:** compare **code today** ↔ **canonical docs** ↔ **contracts** ↔ **mechanics already delivered** (sprints / `MECHANICS_DELTAS.md`).  
**Not a product priority list** — only factual gaps and **next documentation steps**.

**Inventory reference:** [SYSTEMS_INVENTORY.md](./SYSTEMS_INVENTORY.md)  
**Last reviewed:** 2026-06-17

---

## Legend

| Doc status | Meaning |
| :--- | :--- |
| ✅ covered | Canonical doc matches current code |
| ⚠ partial | Doc exists but incomplete or stale |
| ❌ missing | No canonical doc for this 3D surface |
| 🔀 divergent | Doc and code disagree — fix doc first |

| Parity | Meaning |
| :--- | :--- |
| ✅ | 3D implements same rules as documented 2D/canonical behavior |
| ⚠ | Partial or single-frame billboard only |
| ❌ | Not wired in 3D or known mismatch |
| n/a | 3D-only or no 2D equivalent |

---

## Audit matrix

| ID | 3D subsystem | Code anchor | Canonical doc(s) | Doc | Contract | Parity / delivered | Gap (factual) | Next doc step |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **3D-01** | App entry / default mode | `App.tsx` | `PERSPECTIVE_MODE_CONTRACT`, `THREE_D_MIGRATION_STRATEGY` | ⚠ | ✅ | ✅ 3D default | Migration strategy still reads like optional 3D | Update `THREE_D_MIGRATION_STRATEGY` § product status |
| **3D-02** | React shell | `ThreeDSliceView.tsx` | **`THREE_D_INTEGRATION_BLUEPRINT`**, **`PLAYER_STATE_EVENTS_3D.md`** | ✅ | ⚠ | ✅ HUD wired | — | — |
| **3D-03** | Session / URL params | `ThreeDSliceView`, URL | **`SLICE_RUNTIME.md` §3** | ✅ | n/a | ✅ works | — | — |
| **3D-04** | Coordinates / axes | `createDebugSliceScene` | `PERSPECTIVE_MODE_CONTRACT` §2.5, `DIRECTION_CONVENTION` | ✅ | ✅ | ✅ S12-BUG1 fixed | — | — |
| **3D-05** | Top-down camera | `ArcRotateCamera`, presets | `PERSPECTIVE_MODE_CONTRACT`, **`SLICE_RUNTIME.md` §6** | ✅ | ✅ | ✅ S11/S12 delivered | — | — |
| **3D-06** | FP debug camera | Key `V` | `PERSPECTIVE_MODE_CONTRACT` | ✅ | ✅ | ✅ debug-only | — | — |
| **3D-07** | Chunk streaming | `updateChunks`, budgets | **`SLICE_RUNTIME.md` §9**, **`CHUNK_STREAMING_3D.md`** | ✅ | ⚠ | ✅ Sprint 1 delivered | LOD fade thresholds inline | Optional extract constants |
| **3D-08** | Geometry worker | `geometry.worker.ts` | **`CHUNK_STREAMING_3D.md` §5** | ✅ | n/a | ✅ works | — | — |
| **3D-09** | Layer semantics Z | `levelToWorldY`, comments | `PERSPECTIVE_MODE_CONTRACT`, **`SLICE_RUNTIME.md` §4** | ✅ | ✅ | ✅ delivered | — | — |
| **3D-10** | Upper-level fade | `updateUpperLevelVisibility` | **`SLICE_RUNTIME.md` §10** | ⚠ | ⚠ | ✅ S12-T2 | Fade thresholds still code-only | Document fade constants if extracted |
| **3D-11** | Stairs / level transition | stair anim block | **`SLICE_RUNTIME.md` §11**, `MAP_SYSTEM_CONTRACT` | ⚠ | ⚠ | ✅ Sprint 3 | 3D anim flags not in map contract | Patch MAP contract with stairDir reference |
| **3D-12** | Void / fall safety | `isVoidFallActive`, key F | **`SLICE_RUNTIME.md` §12** | ✅ | n/a | ✅ works | — | — |
| **3D-13** | Hero billboard | `TwoDParitySpriteFactory`, profile | `CHARACTER_VISUAL_SCOPE`, `DIRECTION_CONVENTION`, modular §4.2 | ✅ | ✅ | ✅ S11/S12 | — | — |
| **3D-14** | Hero equipment visual | `CharacterVisualProfile` | `CHARACTER_VISUAL_SCOPE`, `HERO_BODY_EQUIPMENT` | ✅ | ✅ | ✅ alpha (icons only) | Phase 2 profiles listed but no assets | Keep HERO_BODY_EQUIPMENT as future; no code doc drift |
| **3D-15** | Enemy visuals | `ThreeDEnemyVisualRegistry` | `ENEMY_SPRITE_RUNTIME`, `DIRECTION_CONVENTION` | ✅ | ✅ | ⚠ | Only `goblin_lanceiro` fully generated; rest procedural | Document placeholder policy in ENEMY_SPRITE_RUNTIME §6 |
| **3D-16** | Enemy AI / path | `updateEnemyAI`, pathfinding | **`SLICE_RUNTIME.md` §14**, **`COMBAT_3D_PARITY.md` §9** | ✅ | n/a | ✅ works | — | — |
| **3D-17** | Enemy persistence | `spawnKey`, `deadEnemies3d` | **`SAVE_LOAD_3D.md` §6**, `SAVE_SYSTEM_CONTRACT` | ✅ | ✅ | ✅ Sprint 2 | SL-01 load position gap | Fix load envelope apply in code |
| **3D-18** | Player melee combat | pointer + formulas | **`COMBAT_3D_PARITY.md` §4–7** | ✅ | ⚠ | ✅ S6/S10 | `BATTLE_SYSTEM_CONTRACT` stale vs both runtimes | Rewrite battle contract from COMBAT doc |
| **3D-19** | Enemy melee/magic | `applyEnemyAttackToPlayer`, magic | **`COMBAT_3D_PARITY.md` §6–8** | ✅ | ⚠ | ⚠ S10 | C-02 fire resist gap vs 2D | Fix code or document as accepted delta |
| **3D-20** | Hunger / regen / buffs | `playerState.update` | **`COMBAT_3D_PARITY.md` §13**, `PLAYER_STATE_CONTRACT` | ✅ | ⚠ | ✅ S10-T1 | Contract still omits 3D tick line | Patch PLAYER_STATE_CONTRACT § lifecycle |
| **3D-21** | Items pickup/drop | E key, events | `PLAYER_STATE_CONTRACT` | ⚠ | ⚠ | ✅ | Container parity S11-T2 not in contract | Document container pickup branch |
| **3D-22** | Item icons world | `getDroppedItemMaterial` | `ITEM_VISUAL_PIPELINE` | ✅ | ✅ | ✅ | — | — |
| **3D-23** | Runes Q/R + projectile | `castRune3d` | **`COMBAT_3D_PARITY.md` §11** | ✅ | ⚠ | ✅ S8 | Q does not consume inventory (grimório does) | Optional: consume on Q |
| **3D-24** | Grimório targeting | `castRuneAtTarget`, events | **`PLAYER_STATE_EVENTS_3D.md` §6**, `COMBAT_3D_PARITY` | ✅ | ⚠ | ✅ S11-T1 | — | — |
| **3D-25** | Blood / overkill | `emitBloodBurst`, settings | — | ❌ | n/a | ✅ S11-T3 | `tgs_settings_blood` localStorage only in code | Document VFX settings |
| **3D-26** | Floating text | emit + `ThreeDFloatingText` | `FLOATING_TEXT_SYSTEM_ANALYSIS` | ⚠ | n/a | ⚠ | Analysis may predate 3D React overlay | Review analysis vs 3D path |
| **3D-27** | Save / autosave | `saveGameDirect` | **`SAVE_LOAD_3D.md`**, `SAVE_SYSTEM_CONTRACT` §4 | ✅ | ✅ | ✅ Fase 2.2 | SL-01 load envelope | Fix `handleThreeDStart` restore |
| **3D-28** | Display settings | render scale, quality | `PLAYER_STATE_CONTRACT` | ⚠ | ⚠ | ⚠ | FPS cap noted as TODO in code | Document implemented vs stub |
| **3D-29** | Audio footstep | hero + `_consumeFootstepTick` | modular guide §4.2 | ✅ | n/a | ✅ | — | — |
| **3D-30** | Diagnostics | `__slice3dLogs`, export | `BENCHMARK_CONTRACT` (partial) | ⚠ | ⚠ | ✅ | Not in benchmark contract checklist | Add 3D log export to benchmark or ops doc |
| **3D-31** | Debug sandbox map | `debug_sandbox` | `DEBUG_SANDBOX_MAP` | ✅ | n/a | ✅ | — | — |
| **3D-32** | World map P1 | `city_3d_mundi_p1` | **`docs/world/MUNDI_P1_README.md`**, `WORLD_MAP_CONTRACT` | ✅ | ✅ | ✅ S17-P1-* | — | — |
| **3D-33** | Minimap / map UI | `PlayerState` position | `MAP_UI_MECHANICS` | ⚠ | ✅ | ✅ deltas 2026 | Axis fix documented in deltas not map UI doc | Sync `MAP_UI_MECHANICS` with 3D axis rules |
| **3D-34** | i18n UI | `t_game`, windows | `LOCALIZATION_CONTRACT` | ✅ | ✅ | ✅ | — | — |
| **3D-35** | Selection / highlight | emissive pulse | **`SLICE_RUNTIME.md` §15** | ✅ | n/a | ✅ S7-FP4 | — | — |
| **3D-36** | Doors / interactive blockers | door UUID + LOS/nav overlay | **`SLICE_RUNTIME.md` §12**, `MAP_SYSTEM_CONTRACT`, `SAVE_SYSTEM_CONTRACT`, `PLAYER_STATE_CONTRACT` | ⚠ | ⚠ | n/a | Mechanic not implemented yet; contract defined first | Implement debug-sandbox door rollout |

---

## Delivered mechanics cross-check (sprints → 3D)

Source: `docs/SPRINT_STATE.json` completed sprints 1–16 + progress S17-P1; 3D-relevant items:

| Sprint / task | Delivered | Verified in 3D code | Documented in audit row |
| :--- | :--- | :--- | :--- |
| S1 chunk budgets | ✅ | ✅ `CHUNK_*_BUDGET` | 3D-07 |
| S2 enemy kill persist | ✅ | ✅ `isEnemy3dDead` | 3D-17 |
| S3 stairs continuous | ✅ | ✅ `isStairAnimActive` | 3D-11 |
| S7 FP crosshair / highlight | ✅ | ✅ `ThreeDSliceView`, emissive | 3D-06, 3D-35 |
| S8 runes Q/R | ✅ | ✅ `castRune3d` | 3D-23 |
| S10 food/defense/unarmed | ✅ | ✅ combat + `playerState.update` | 3D-18–20 |
| S11 grimório, altar, blood, billboards | ✅ | ✅ | 3D-13, 3D-24, 3D-25 |
| S12 layers, roof fade, minimap bug | ✅ | ✅ | 3D-09, 3D-10, 3D-33 |
| S17-P1 mundi map gen | ✅ | ✅ loadable map | 3D-32 |

**Not in 3D slice (2D or missing):** full `GameScene` tile renderer, `LevelRenderer` perspective containers (2D path), `TransitionSystem.ts` as separate module — 3D reimplements transitions inline.

---

## Documentation backlog (ordered)

Work through this list **without product scope debates**. Each item = one doc PR/session.

| Order | Deliverable | Closes rows | Status |
| :---: | :--- | :--- | :---: |
| 1 | **`SLICE_RUNTIME.md`** | 3D-03,05,09,12,35 + partial 07,10,11,14,16 | ✅ done |
| 2 | **`COMBAT_3D_PARITY.md`** | 3D-16, 18–20, 23 | ✅ done |
| 3 | **`SAVE_LOAD_3D.md`** | 3D-17, 27 | ✅ done |
| 4 | **Update `THREE_D_INTEGRATION_BLUEPRINT.md`** | 3D-02 | ✅ done |
| 5 | **`CHUNK_STREAMING_3D.md`** | 3D-07, 08 | ✅ done |
| 6 | **`docs/world/MUNDI_P1_README.md`** | 3D-32 | ✅ done |
| 7 | **Patch contracts** (small deltas) | 3D-01, 11, 17, 21, 33 | partial — SAVE patched |
| 8 | **`PLAYER_STATE_EVENTS_3D.md`** | 3D-24 | ✅ done |
| 9 | **Review `FLOATING_TEXT_SYSTEM_ANALYSIS.md`** | 3D-26 | `ThreeDFloatingText.tsx` |

---

## Open factual gaps (need code read or human verify — not “priority”)

These are **unknowns** to close while documenting:

1. **`SAVE_SYSTEM_CONTRACT`** — does it list `deadEnemies3d`, persistent drops, 3D position fields completely?  
2. **Jump / gravity** — is jump intended for top-down product or debug-only? (Space key active in top-down.)  
3. **Default map mismatch** — `ThreeDSliceView` default `city_3d_mundi_p1` vs `createDebugSliceScene` fallback `debug_sandbox` when no URL param.  
4. **`SPRINT_MASTER_PLAN` vs `SPRINT_STATE`** — sprint 17 naming; document which is authoritative.  
5. **2D `GameScene`** — document explicitly as legacy path in `THREE_D_MIGRATION_STRATEGY`.

---

## How to advance one row

Template for each documentation session:

```text
Row: 3D-18
Read: createDebugSliceScene applyPlayerAttackToEnemy, BattleSystem.ts
Write: COMBAT_3D_PARITY.md § player melee
Update: COMPATIBILITY_AUDIT row 3D-18 → Doc ✅
Delta: MECHANICS_DELTAS if behavior clarified (not changed)
```

After all rows in a deliverable are ✅, mark deliverable done in [../DOCUMENTATION_AUDIT.md](../DOCUMENTATION_AUDIT.md).

---

## Summary counts (2026-06-17)

| Doc status | Rows (of 35) |
| :--- | :---: |
| ✅ covered | 25 |
| ⚠ partial | 9 |
| ❌ missing | 2 |
| 🔀 divergent | 0 |

**Conclusion:** Core 3D documentation backlog **complete** (SLICE, COMBAT, SAVE, CHUNK, EVENTS, MUNDI, blueprint refresh). Remaining ⚠ rows: contract patches (3D-01, 11, 21, 33), VFX/blood doc (3D-25), floating text review (3D-26), display settings (3D-28). Code gaps SL-01, C-01–C-02 documented in SAVE/COMBAT docs.
