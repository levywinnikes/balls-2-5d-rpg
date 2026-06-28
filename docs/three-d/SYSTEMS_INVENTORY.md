# 3D Systems Inventory

**Purpose:** factual inventory of the Babylon slice runtime as implemented today.  
**Last reviewed:** 2026-06-17 (code: `src/three-d/**`, `geometry.worker.ts`)

For compatibility with contracts and gaps, see [COMPATIBILITY_AUDIT.md](./COMPATIBILITY_AUDIT.md).

---

## 1. Bootstrap and shell

| Component | File | Responsibility |
| :--- | :--- | :--- |
| App routing | `src/App.tsx` | 3D default; 2D only when legacy flag |
| Slice view | `src/three-d/bootstrap/ThreeDSliceView.tsx` | Menu, canvas, HUD stack, runtime lifecycle |
| Floating text UI | `src/three-d/runtime/ThreeDFloatingText.tsx` | React layer for world-projected text |

### ThreeDSliceView — integrated React UI

When `isInGame`:

- `HUD`, `HeroDashboard`, `NotificationSystem`, `LevelUpNotification`
- `WindowLayer` (inventory, grimório, settings, etc.)
- Rune hotbar (3 slots, active highlight)
- FP crosshair overlay (debug)
- Damage vignette flash
- `PerfMonitor` (optional)
- `SystemMenuUI` / save / return to title

### Session start

| Input | Behavior |
| :--- | :--- |
| Main menu new game | `PlayerState.reset()`, URL `?map=` |
| Load game | `PlayerState.loadState()`, URL `?map=` + `?level=` |
| `?autostart=1&map=` | Skip menu (e.g. `play-debug-sandbox.bat`) |

Runtime created once per session; `dispose()` on return to menu.

---

## 2. Core runtime (`createDebugSliceScene.ts`)

Single factory: `createDebugSliceScene(canvas) → SliceRuntime`.

**Returns:** `{ engine, scene, save, dispose }`

**Global debug:** `window.__slice3dChunkStreaming`, `window.__slice3dLogs`, `window.__slice3dLogsData`

### 2.1 World and coordinates

| Concept | Implementation |
| :--- | :--- |
| Tile size | 32 px; world unit = tile (BMS parity) |
| `worldToSliceCoord` | `pixel / 32` |
| Map X → world X | Entity spawn: `entity.x * tileSize + tileSize/2` → world X |
| Map Y → world Z | Same for Z axis |
| Level → world Y | `levelNumber * 2.0` (`LEVEL_HEIGHT_UNITS`) |
| Player ground offset | `0.8` above level floor |
| Active level | `PlayerState.getCurrentLevel()`; synced on stairs/void |

**Layer semantics (S12):**

| Level | Meaning |
| :--- | :--- |
| `-1` | Underground / sewer |
| `0` | Ground floor |
| `+1` | Upper floor / floating structures |
| `+2` | Rooftops / sky structures |

### 2.2 Camera and input

| Mode | Type | Trigger | Product |
| :--- | :--- | :--- | :--- |
| Top-down | `ArcRotateCamera` | Default | **Yes** |
| Presets | `safe` / `cinematic` | Key `C` | Yes (beta/radius/FOV only) |
| First-person | `UniversalCamera` | Key `V` | **Debug only** |

Top-down rules (`PERSPECTIVE_MODE_CONTRACT` §2.5):

- `alpha = π/2` locked; `+Z` = screen down = south
- Camera target = player position every frame (no lerp lag)
- Movement uses screen→world projection (`Vector3.Project` basis)

**Movement keys:** WASD / arrows; speed `4.5` u/s  
**Other keys:** Space jump, E pickup, Q rune, R cycle rune slot, F fall safety toggle

### 2.3 Map loading and chunk streaming

| Piece | Detail |
| :--- | :--- |
| Map JSON | `fetch(/maps/{sliceMapName}.json)` |
| Binary tiles | Per-level `{mapName}_{level}.bin` cached in `levelBinaryCache` |
| Chunk size | 16×16 tiles |
| Draw radius | 3 chunks (top-down), 4 (FP debug) |
| Build budget | 2 chunks/tick (top-down), 3 (FP) |
| Unload budget | 8 chunks/tick |
| Geometry | `geometry.worker.ts` builds buffers; main thread creates `Mesh` |
| Materials | `StandardMaterial` per `materialKey`; LRU cap 256 |
| LOD | 0 / 1 / 2 per chunk (`chunkLodByKey`) |

**Upper-level visibility:** `updateUpperLevelVisibility` — fade/hide structures above player when under cover (S12-T2).

### 2.4 Player avatar

| Piece | File / API |
| :--- | :--- |
| Collision proxy | Hidden capsule mesh (movement, pick) |
| Billboard | `createHeroModularSpriteMaterial` + `HERO_BILLBOARD_LAYOUT` |
| Profile | `resolveCharacterVisualProfile` → `hero_base` + hair |
| Shadow | Disc under feet |
| Anim | `_setAnimState`, `_setDirection`; footstep via `_consumeFootstepTick` |
| Legacy debug ball | Yellow sphere (visibility ~0) |

Events: `equipmentChanged` → refresh hair profile only (alpha scope).

### 2.5 Enemies

| Piece | Detail |
| :--- | :--- |
| Registry | `EnemyRegistry` definitions |
| Visual | `ThreeDEnemyVisualRegistry.createEnemyVisual` |
| Generated sprites | `goblin_lanceiro` (+ alias `goblin`) via `TwoDParitySpriteFactory` |
| Others | Procedural canvas billboard |
| Spawn | Map `entityTemplates` + `levels[].entities` |
| Persistence | `spawnKey`; skip if `playerState.isEnemy3dDead(level, key)` |
| AI | Pathfinding via `PathfindingManager`; chase/aggro/attack ranges |
| Direction | `faceEnemyToward` + `resolveWorldBmsDirection` |
| Death | `death_south` anim delay; `emitBloodBurst`; persist dead |
| Selection | Pointer pick; emissive pulse; torus ring optional |

Constants: visibility radius, AI radius documented in code (search `ENEMY_`).

### 2.6 Combat (player → enemy)

| Behavior | Implementation |
| :--- | :--- |
| Click attack | Pointer pick on enemy proxy |
| Formulas | Rolls aligned with 2D / `BattleSystem` patterns (S10) |
| Weapon element | Fire partial block |
| Unarmed | Roll 1..5 |
| Floating text | `playerState.emit("floatingText", …)` |
| Hero attack anim | `setHeroAnimState("attack", lockMs)` |

### 2.7 Combat (enemy → player)

| Behavior | Implementation |
| :--- | :--- |
| Melee | `applyEnemyAttackToPlayer`; cooldown from definition |
| Magic | `tryEnemyMagicAttack` (line of sight, range, chance) |
| Defense | `playerState.getTotalDefense()` (S10-T2) |
| Damage | `playerState.takeDamage` |
| Block UI | Shield emoji floating text |

### 2.8 Items and loot

| Behavior | Implementation |
| :--- | :--- |
| Map seed items | `ensureLevelItemsSeeded` from entities |
| Dropped items | `PlayerState` persistent drops per level |
| Meshes | Icon texture from `public/assets/items/{id}.png` |
| Pickup | Key E / `requestPickup` event |
| Drop | `dropItem` event → world mesh |
| Containers | `ContainerRegistry` — altar/chest opens UI instead of pickup (S11-T2) |
| Stream radius | `DROPPED_ITEM_STREAM_RADIUS_UNITS` |
| Fallback orb | Debug torch pickup if no real drops on level |

### 2.9 Runes and grimório

| Behavior | Implementation |
| :--- | :--- |
| Quick cast | Q → `castRune3d` toward selected/nearest enemy |
| Slot cycle | R → 3 slots from `playerState.getEquippedRuneSlots()` |
| Targeting mode | Event from grimório UI → click enemy → `castRuneAtTarget` (S11-T1) |
| Projectile | Emissive sphere + impact flash |
| HUD | `ThreeDSliceView` rune bar; `slice3d:runeSlotsUpdated` |

### 2.10 Vertical navigation

| Behavior | Implementation |
| :--- | :--- |
| Stairs | Tile `stairDir` / geometry profile `stair`; smooth anim |
| Block movement | `isStairAnimActive` |
| Level change | Updates `activeLevel`, re-seeds enemies/items, chunks |
| Void fall | `isVoidFallActive`; landing level detection |
| Fall safety | Toggle F; `playerState.isFallSafetyEnabled()` blocks void |

### 2.11 PlayerState tick (2D parity)

Each frame: `playerState.update(now, deltaMs)` — hunger, HP regen, buff timers (S10-T1).

Position sync: `playerState.recordPlayerPosition(activeLevel, x*32, z*32)`.

### 2.12 Save / load

| Piece | Detail |
| :--- | :--- |
| API | `SaveSystem.saveGameDirect` (Phaser stub constructor) |
| Manual | `SliceRuntime.save()` — F5 / system menu |
| Auto-save | Every 60 s |
| Payload | map name, `currentLevel`, player pixel pos |
| Load | `ThreeDSliceView.handleThreeDStart` restores `PlayerState` before scene |

### 2.13 Audio

`AudioManager` — footsteps from hero walk ticks, jump, attack, block, pickup, enemy death.

### 2.14 Display settings

`PlayerState.getDisplaySettings()` → render scale, quality preset, FPS target (partial).  
Event: `displaySettingsChanged`.

### 2.15 Diagnostics and logging

| Feature | Access |
| :--- | :--- |
| Session log | Samples, events, path metrics, heap slope |
| Persist | `localStorage` key `slice3d.runtime.logs.latest` |
| Export | `downloadRuntimeLogs`, periodic flush to `artifacts/runtime-logs/` |
| Chunk metrics | `__slice3dChunkStreaming` |

---

## 3. Supporting modules

### 3.1 `TwoDParitySpriteFactory.ts`

| Export | Role |
| :--- | :--- |
| `createHeroModularSpriteMaterial` | Body + hair compositing, animation |
| `createEnemyParitySpriteMaterial` | Generated or procedural enemy |
| `createGeneratedSpriteAnimatedMaterial` | PNG frame animation |
| `resolveWorldBmsDirection` | Enemy facing from world delta |
| `resolveHeroBmsDirection` | Hero facing from WASD |
| `getGeneratedAttackDurationMs` / `getGeneratedDeathDurationMs` | Anim locks |
| `HERO_BILLBOARD_LAYOUT` | Feet anchor, plane size |

### 3.2 `CharacterVisualProfile.ts`

- Profiles defined: `hero_default` (active), phase-2 placeholders disabled in resolver  
- `equippedHairId` on `PlayerState`

### 3.3 `ThreeDEnemyVisualRegistry.ts`

- Per-enemy color/size profile  
- Billboard plane + shadow + pick proxy + selection ring

### 3.4 `geometry.worker.ts`

- Input: tile descriptors with `geometryProfile`, heights, `materialKey`  
- Output: transferable vertex/index buffers grouped by material  
- Profiles: `box`, `stair`, `slab`, ramps N/S/E/W

---

## 4. Shared dependencies (not in `three-d/`)

| System | Used for |
| :--- | :--- |
| `PlayerState` | All gameplay state, events, 3D persistence fields |
| `EnemyRegistry` / `EnemyMagicRegistry` | Enemy stats and spells |
| `WeaponRegistry` / `ItemRegistry` | Combat and items |
| `ContainerRegistry` | Altars / chests |
| `PathfindingManager` + workers | Enemy paths |
| `RuneRegistry` | Rune definitions |
| `SaveSystem` | Serialize snapshot |
| `AudioManager` | SFX |
| `MapLoader` patterns | Tile/block queries via loaded map data in scene |

---

## 5. Maps exercised in 3D

| Map | Role |
| :--- | :--- |
| `city_3d_mundi_p1` | Default world (512×512, multi-level) |
| `debug_sandbox` | Registry playtest (enemy rooms + items) |
| `smoke_test` | CI benchmark transitions |
| Sprint maps | `cidade_suspensa`, `esgoto_v1`, `ilhas_v1`, dungeons, `torres_v1`, etc. |

Generation scripts: `scripts/generate-*.js`; validators: `npm run check:bms`, `check:world-mundi`.

---

## 6. Documentation coverage summary

| Area | Deep doc status |
| :--- | :--- |
| Sprite directions | ✅ `DIRECTION_CONVENTION.md` |
| Hero visual alpha | ✅ `CHARACTER_VISUAL_SCOPE.md` |
| Enemy sprites | ✅ `ENEMY_SPRITE_RUNTIME.md` |
| Debug sandbox | ✅ `DEBUG_SANDBOX_MAP.md` |
| Perspective / camera | ✅ `PERSPECTIVE_MODE_CONTRACT.md` §2.5 |
| Full slice runtime | ✅ **`SLICE_RUNTIME.md`** | — |
| Combat parity | ❌ scattered in sprints / deltas |
| Save 3D fields | ❌ partial in `SAVE_SYSTEM_CONTRACT` |
| Chunk worker | ❌ inline comments only |
| React bridge events | ❌ not catalogued |

See [COMPATIBILITY_AUDIT.md](./COMPATIBILITY_AUDIT.md) for row-by-row status and next documentation tasks.
