# World Map — Mundi Phase 1 (`city_3d_mundi_p1`)

Player-facing and agent reference for the **512×512 macro world** used as the default 3D map.

**Play:** menu new game → `city_3d_mundi_p1` (or `?map=city_3d_mundi_p1`)  
**Assets:** `public/maps/city_3d_mundi_p1.json` + `city_3d_mundi_p1_{level}.bin`  
**Generator:** `scripts/generate-world-p1-macro-map.js`  
**Design source:** `docs/MAP_MUNDI_3D_P1_BLUEPRINT_512.json`

Related: [../contracts/WORLD_MAP_CONTRACT.md](../contracts/WORLD_MAP_CONTRACT.md), [../three-d/SLICE_RUNTIME.md §3](../three-d/SLICE_RUNTIME.md#3-session-configuration)

---

## 1. What P1 is

| Aspect | Detail |
| :--- | :--- |
| Phase | **P1** — macro layout validation (not final hand-crafted city) |
| Size | 512×512 tiles, 32 px/tile |
| Model | Island surrounded by sea (`wat` border ≥20 tiles) |
| Levels | Multi-level BMS (`-2` … `+3` bins) — floating / underground stack |
| Default level | `"0"` ground (`config.startLevel`) |
| Replaces | Does **not** replace `city_3d_multi` (benchmark / legacy multi tileset) |

P1 proves: macrozone generation, transition bands, sea border, multi-level bins, and 3D chunk streaming at continental scale.

---

## 2. Macrozones (blueprint)

Seven zones in `MAP_MUNDI_3D_P1_BLUEPRINT_512.json`:

| ID | Name | Role |
| :--- | :--- | :--- |
| Z1-NW-FOREST | Floresta Umbra | Early exploration, cave POI |
| Z2-NORTH-URBAN | Arco Urbano Septentrional | Services, commerce, capital_norte |
| Z3-NE-SWAMP | Marisma Verde | Hazard routes, swamp |
| Z4-CENTRAL-PLAINS | Planicie Cardinal | Connector hub, open market |
| Z5-WEST-HIGHLANDS | Serra Ferrugem | Vertical terrain, iron lookout |
| Z6-SE-DESERT | Dunas de Ember | Mid-late challenge |
| Z7-SOUTH-COAST | Costa Rubra | Coast, port, marine dungeon hooks |

Each zone defines `bbox`, biome tile cores (`grs`, `cob`, `stn`, …), hazard tier, and `keyPoi` labels used by the generator as placement hints.

---

## 3. Regenerating the map

```bash
node scripts/generate-world-p1-macro-map.js
```

Outputs:

- `public/maps/city_3d_mundi_p1.json` — metadata, `tileDefinitions`, level bin paths
- `public/maps/city_3d_mundi_p1_*.bin` — per-level tile indices

Validation artifacts (CI / gatekeeper):

- `docs/MAP_MUNDI_3D_P1_VALIDATION.json`
- `docs/MAP_MUNDI_3D_P0_*` — prior phase KPIs and approvals

---

## 4. Playing in 3D

| Entry | Map param |
| :--- | :--- |
| Main menu new character | `DEFAULT_3D_MAP` in `ThreeDSliceView.tsx` → `city_3d_mundi_p1` |
| Debug sandbox (separate) | `debug_sandbox` — combat/item rooms, not mundi |
| URL override | `?map=city_3d_mundi_p1&autostart=1` |

Slice fallback when **no** URL map: `debug_sandbox` (dev only — menu always sets map for normal play).

---

## 5. Acceptance targets (blueprint)

From `p1AcceptanceTargets`:

- Sea border compliance: 100%
- Critical transition violations: 0
- Max structural repeat ratio: ≤ 0.22
- Required macrozones: 7
- Main progression routes: 2 (`progressionRoutes.main`)

---

## 6. Related maps (do not confuse)

| Map | Purpose |
| :--- | :--- |
| `city_3d_mundi_p1` | **Product default** — macro P1 world |
| `city_3d_mundi_p1_before` | Generator baseline / compare previews |
| `city_3d_multi` | Benchmark smoke, multi-level test city |
| `debug_sandbox` | Combat/item/regression rooms |

Preview SVGs: `artifacts/map-previews/city_3d_mundi_p1_*.svg`

---

## 7. Agent checklist

When editing mundi P1:

1. Change **blueprint JSON** first, then generator, then regen bins  
2. Run `node scripts/check-p1-blueprint.js` if available  
3. Update validation JSON if gatekeeper rules change  
4. Do not assume `.map` arrays — BMS binary only ([MAP_SYSTEM_CONTRACT](../contracts/MAP_SYSTEM_CONTRACT.md))  
5. Test 3D load + chunk metrics on level `0` and one upper level (`+1`)
