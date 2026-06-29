# 3D Slice Runtime (`createDebugSliceScene`)

Canonical reference for the Babylon.js gameplay runtime.  
**Code:** `src/three-d/runtime/createDebugSliceScene.ts` (~5200 lines)  
**Bootstrap:** `src/three-d/bootstrap/ThreeDSliceView.tsx`

Related: [SYSTEMS_INVENTORY.md](./SYSTEMS_INVENTORY.md), [COMPATIBILITY_AUDIT.md](./COMPATIBILITY_AUDIT.md), [../contracts/PERSPECTIVE_MODE_CONTRACT.md](../contracts/PERSPECTIVE_MODE_CONTRACT.md)

---

## 1. Role in the project

The slice runtime is the **product-facing 3D game loop**:

- Loads BMS maps (`/maps/{name}.json` + `{name}_{level}.bin`)
- Streams tile geometry around the player
- Drives combat, loot, enemies, stairs, void fall, runes
- Syncs `PlayerState` (position, level, inventory, saves)
- Renders hero/enemy billboards

2D `GameScene` is legacy; new gameplay rules must be implemented here for 3D.

---

## 2. Public API

### Factory

```typescript
createDebugSliceScene(canvas: HTMLCanvasElement): SliceRuntime
```

### `SliceRuntime`

| Field | Type | Purpose |
| :--- | :--- | :--- |
| `engine` | Babylon `Engine` | Render loop |
| `scene` | Babylon `Scene` | World graph |
| `save()` | `() => Promise<boolean>` | Manual save via `SaveSystem.saveGameDirect` |
| `dispose()` | `() => void` | Tear down workers, listeners, meshes |

### Lifecycle

1. `ThreeDSliceView` sets `isInGame = true` after menu / autostart  
2. Canvas mounts → `createDebugSliceScene(canvas)`  
3. `engine.runRenderLoop(() => scene.render())`  
4. Return to menu → `dispose()`

---

## 3. Session configuration

### Map name

Read from URL at scene creation:

```
?map={mapName}   or   ?mapName={mapName}
```

Fallback if absent: **`debug_sandbox`**.

Menu flow (`ThreeDSliceView.handleThreeDStart`) writes `?map=` before scene starts — default menu map is **`city_3d_mundi_p1`** (`DEFAULT_3D_MAP` in `ThreeDSliceView.tsx`). The slice fallback only applies when no URL param exists.

### Level

Optional `?level=` restored on load game. Active level otherwise from `PlayerState.getCurrentLevel()` and stair/void transitions.

### Autostart

`?autostart=1&map=debug_sandbox` — skips menu (see `play-debug-sandbox.bat`).

---

## 4. Coordinate system

| Space | Rule |
| :--- | :--- |
| Tile grid | Map `width` × `height`; tile = 1 world unit |
| Pixel ↔ world | BMS pixel / 32 = world X or Z |
| Map JSON `entity.x/y` | Tile indices; spawn pixel = `tile * 32 + 16` |
| World Y (floor) | `levelNumber * 2.0` (`LEVEL_HEIGHT_UNITS`) |
| Player feet | `levelY + 0.8` (`PLAYER_GROUND_OFFSET`) |
| Published to UI | `recordPlayerPosition(level, x*32, z*32)` |

**Axis convention (product):** `+X` = east (screen right), `+Z` = south (screen down). See [../sprites/DIRECTION_CONVENTION.md](../sprites/DIRECTION_CONVENTION.md).

### Layer numbers

| Level | Semantics |
| :--- | :--- |
| `-1` | Underground / sewer |
| `0` | Ground |
| `+1` | Upper floor / floating structures |
| `+2` | Rooftops / high structures |

---

## 5. Main render loop (`scene.onBeforeRenderObservable`)

Each frame (order matters):

```
1. syncDroppedItems        (every DROP_SYNC_INTERVAL = 0.2s)
2. playerState.update      (hunger, regen, buffs — S10 parity)
3. updateChunks            (every CHUNK_UPDATE_INTERVAL = 0.2s)
4. updateUpperLevelVisibility
5. Player movement input   (blocked during stair / void fall)
6. Hero animation + footsteps
7. Stair transition anim
8. updateEnemyAI
9. tryAutoPlayerAttack
10. Perf metrics sample
11. Enemy selection highlight pulse
12. Gravity / void fall / ground clamp
13. Camera follow + exploreArea + recordPlayerPosition
```

Auto-save runs in a **separate** observer (60 s interval).

---

## 6. Camera

### Top-down (product)

- `ArcRotateCamera`, `alpha = π/2` locked  
- Presets **`safe`** / **`cinematic`**: key **`C`** toggles beta, radius, FOV  
- **`camera.setTarget(player.position)` every frame** — no lerp (ARPG-style lock)  
- Hero billboard + shadow enabled  

### First-person (debug only)

- Key **`V`** toggles; console warns on enter  
- `UniversalCamera`, eye height from `getHeroFirstPersonEyeHeight()` (~**0.86** world units above feet; 58% of hero billboard body height)  
- Hero billboard hidden; crosshair via React (`slice3d:cameraModeChanged`)  
- Pointer lock on canvas click  

Contract: [PERSPECTIVE_MODE_CONTRACT.md](../contracts/PERSPECTIVE_MODE_CONTRACT.md) §2.5.

---

## 7. Input

| Input | Top-down | First-person |
| :--- | :--- | :--- |
| WASD / arrows | Move (screen-projected) | Move relative to camera yaw |
| Space | Jump (`jumpImpulse = 7.2`) | Jump |
| **Right-click** | Select enemy / trigger stair interact | Select enemy (center pick) |
| Left-click | Rune targeting only (when active) | Rune targeting |
| E | Pickup nearest item | Same |
| Q | Cast equipped rune | Same |
| R | Cycle rune slot (3 slots) | Same |
| F | Toggle fall safety | Same |
| C | Camera preset | Ignored |
| V | Enter FP debug | Exit FP |

**Combat selection (top-down):** right-click enemy pick proxy → `selectedEnemyUid` → `tryAutoPlayerAttack` each frame when in range + LOS.

---

## 8. Map loading

### Pipeline

```
loadMapData()           fetch /maps/{sliceMapName}.json
loadLevelBinary(level)  fetch /maps/{sliceMapName}_{level}.bin → levelBinaryCache
ensureWorldMapReady()   WorldMapService.preRenderAll (minimap buffers)
ensureMapLevelReady()   set activeLevel, rebuildNavigationGrid, updateChunks()
```

### Spawn correction

If `playerPos` from JSON is void/blocked/out of bounds, spiral search up to radius 12 for nearest walkable tile.

### Level change

`ensureMapLevelReady(level)` updates `activeLevel`, `playerState.setCurrentLevel`, clears/rebuilds chunks for that level’s binary data.

---

## 9. Chunk streaming

| Constant | Value |
| :--- | :--- |
| `CHUNK_SIZE` | 16 tiles |
| `TOPDOWN_DRAW_RADIUS_CHUNKS` | 3 |
| `FIRST_PERSON_DRAW_RADIUS_CHUNKS` | 4 |
| `TOPDOWN_CHUNK_BUILD_BUDGET_PER_TICK` | 2 |
| `FIRST_PERSON_CHUNK_BUILD_BUDGET_PER_TICK` | 3 |
| `CHUNK_UNLOAD_BUDGET_PER_TICK` | 8 |
| `CHUNK_UPDATE_INTERVAL` | 0.2 s |

### Flow

1. `updateChunks()` computes player chunk `(floor(x/16), floor(z/16))`  
2. Unload farthest chunks first (budget per tick)  
3. Build missing chunks: main thread reads tiles → **`geometry.worker.ts`** → GPU meshes  
4. LOD 0/1/2 stored in `chunkLodByKey`  
5. Roof tiles: `buildRoofMesh` (Mesh, not TransformNode — S12-BUG2)  

### Debug metrics

`window.__slice3dChunkStreaming` — loaded/loading/pending counts per tick.

Worker protocol: see [CHUNK_STREAMING_3D.md](./CHUNK_STREAMING_3D.md) and `src/workers/geometry.worker.ts`.

---

## 10. Upper-level visibility

`updateUpperLevelVisibility(deltaSeconds)` — when player stands under a structure:

- Meshes on levels **above** active level fade/hide for readability (S12-T2)  
- Works with tile `under` / transparency metadata from map definitions  

Ownership: chunk builder registers meshes per level in `levelMeshes`; visibility walks upper levels.

---

## 11. Stairs

### Trigger

1. **Right-click** sets `pendingStairInteract = true`  
2. Next frame: `findNearbyStairTarget()` within **1.15** units  
3. Tile must have `tileDefinitions[sym].stairDir`: `"up"` \| `"down"`  
4. Target level must exist in `mapData.levels`  

### Animation

| Constant | Value |
| :--- | :--- |
| `stairAnimDuration` | 1.5 s |
| `STAIR_HORIZ_SPEED` | 1.0 tiles/s forward |
| Easing | Quadratic in/out |

- Horizontal movement along captured WASD direction (or toward stair center)  
- Y interpolated to target level `+ PLAYER_GROUND_OFFSET`  
- At ~45% progress: prefetch target level geometry  
- On complete: `ensureLevelEnemiesSeeded`, `ensureLevelItemsSeeded`  
- **`isStairAnimActive`** blocks normal movement  

Cooldown: `stairCooldown = stairAnimDuration + 0.5` after start.

---

## 12. Doors

### Contract

Doors are persistent **entity instances** with:

- `type: "door"` in `entityTemplates`
- per-instance `uuid` in `levels[level].entities[]`
- runtime state stored by UUID in `PlayerState.doorStates`

Suggested instance shape:

```json
{
  "x": 12,
  "y": 8,
  "symbol": "dor",
  "uuid": "door_debug_01",
  "locked": false,
  "keyId": "bronze_key"
}
```

### Interaction

- **Key `E`**: if player is close enough, toggles the nearest door
- **Right-click**: if clicking/picking a door, toggles it
- If closed, the door blocks **collision**, **LOS**, and **pathfinding**
- If open, the door is treated as non-blocking

### Persistence

- Door state is keyed by **UUID**
- Save payload must preserve at least:
  - `open`
  - optional `locked`
  - optional `keyId`

### Interaction precedence

1. Rune targeting
2. Enemy pick
3. Door interaction
4. Stair interaction
5. Clear selection / no-op

---

## 13. Void and fall safety

### Void tile

Identified by `isVoidSymbol(symbol)` on current floor tile.

### Fall safety (key **F**, `playerState.isFallSafetyEnabled()`)

- On void: snap back to `lastSafePlayerX/Z`, show notification  
- No level change  

### Unsafe void fall

- `findVoidFallLanding()` → target level + floor count  
- `isVoidFallActive`: gravity `fallGravity`, terminal velocity cap  
- On landing: level switch, `resolveVoidFall()` damage via `PlayerState`  
- Prefetch enemies/items on target level  

Jump/gravity apply when not in stair anim; ground clamp at `levelToWorldY + PLAYER_GROUND_OFFSET`.

---

## 14. Player avatar

| Piece | Notes |
| :--- | :--- |
| Collision | Capsule mesh (movement) |
| Visual | `createHeroModularSpriteMaterial` + `HERO_BILLBOARD_LAYOUT` |
| Profile | `resolveCharacterVisualProfile(playerState)` — alpha: `hero_base` + hair |
| Events | `equipmentChanged` → hair only |
| Anim API | `_setAnimState`, `_setDirection`, `_consumeFootstepTick` |

See [../CHARACTER_VISUAL_SCOPE.md](../CHARACTER_VISUAL_SCOPE.md).

---

## 15. Enemies

### Spawn

- From map `levels[level].entities` + `entityTemplates`  
- Skip if `playerState.isEnemy3dDead(level, spawnKey)`  
- `spawnKey = {level}_{type}_{index}_{time}`  

### AI radii

| Constant | Value |
| :--- | :--- |
| `ENEMY_VISIBILITY_RADIUS_UNITS` | 26 |
| `ENEMY_AI_RADIUS_UNITS` | 18 |

Beyond AI radius: idle, path cleared. Visible but far: mesh may hide.

### Behavior summary

- Pathfinding: `PathfindingManager.requestPath` on grid from `rebuildNavigationGrid`  
- Chase: path to player when in aggro/provoked  
- Melee: `applyEnemyAttackToPlayer` in range + LOS  
- Magic: `tryEnemyMagicAttack` per `EnemyMagicRegistry`  
- Facing: `faceEnemyToward(player)` when chasing; `resolveWorldBmsDirection` for movement  

### Death

- Anim lock via `getGeneratedDeathDurationMs`  
- `playerState.markEnemy3dDead`  
- Blood burst optional (`localStorage tgs_settings_blood`)  

Visuals: [ENEMY_SPRITE_RUNTIME.md](./ENEMY_SPRITE_RUNTIME.md).

---

## 16. Combat (player)

### Selection

Right-click pick walks mesh hierarchy for `metadata.sliceEnemyUid`.

### Auto-attack

`tryAutoPlayerAttack(now)` when `selectedEnemyUid` set:

- Cooldown from equipped weapon (`cooldown` ms)  
- Range: `weapon.range / 32` world units (unarmed uses roll path in `applyPlayerAttackToEnemy`)  
- Requires `hasLineOfSight`  
- Calls `applyPlayerAttackToEnemy` + hero attack anim  

Formulas align with 2D / `BattleSystem` patterns (S10) with documented edge-case deltas. Full matrix: [COMBAT_3D_PARITY.md](./COMBAT_3D_PARITY.md) §4–7.

---

## 17. Items and loot

| Mechanism | Detail |
| :--- | :--- |
| Map seed | `ensureLevelItemsSeeded` → persistent drops in `PlayerState` |
| World meshes | Icon from `/assets/items/{id}.png` |
| Stream radius | `DROPPED_ITEM_STREAM_RADIUS_UNITS` |
| Pickup E | `tryPickupNearestItem` |
| Events | `dropItem`, `requestPickup`, `spawnDroppedItem` |
| Containers | `ContainerRegistry` — opens UI instead of direct pickup (S11-T2) |
| Fallback orb | Debug torch if level has no real drops |

---

## 18. Runes

| Action | Behavior |
| :--- | :--- |
| Q | `castRune3d()` — projectile toward selected/nearest enemy |
| R | Cycle `activeRuneSlotIndex` (0..2) |
| Grimório | `prepareRuneCast` / `cancelRuneCast` events → click enemy → `castRuneAtTarget` |

React HUD listens for rune slot updates via custom events from runtime.

Damage formulas, inventory consumption (Q vs grimório), and known kill-path gaps: [COMBAT_3D_PARITY.md §11–12](./COMBAT_3D_PARITY.md#11-runes).

---

## 19. PlayerState integration

### Called every frame

- `playerState.update(now, deltaMs)`  
- `recordPlayerPosition(activeLevel, pixelX, pixelY)`  
- `exploreArea(...)` — fog of war for minimap  

### Listeners registered

| Event | Handler |
| :--- | :--- |
| `dropItem` | `handleDropItem` |
| `requestPickup` | `handleRequestPickup` |
| `spawnDroppedItem` | `addDroppedItemFromEvent` |
| `equipmentChanged` | `syncHeroVisualProfile` |
| `displaySettingsChanged` | render scale / quality |
| `prepareRuneCast` / `cancelRuneCast` | targeting mode |

Emit examples: `floatingText`, `uiNotification`, `runeCasted`, `message`.

Planned event catalog: [PLAYER_STATE_EVENTS_3D.md](./PLAYER_STATE_EVENTS_3D.md).

---

## 20. Save / load

- `SaveSystem` constructed with Phaser stub `{} as any`  
- `saveGameDirect({ map, currentLevel, playerPos })`  
- Auto-save every **60 s**  
- Manual: `runtime.save()` from system menu  

Snapshot fields for 3D-specific state: [SAVE_LOAD_3D.md](./SAVE_LOAD_3D.md).

---

## 21. Diagnostics

| Feature | Access |
| :--- | :--- |
| Session log | `window.__slice3dLogs`, `__slice3dLogsData` |
| localStorage | `slice3d.runtime.logs.latest` |
| File flush | `artifacts/runtime-logs/slice3d-latest.json` |
| Path metrics | Embedded in log samples |
| Heap slope | Unload recovery watchdog |

Event types via `pushLogEvent` (e.g. `pathfinding.slow`, `level.change`, `session.dispose`).

---

## 22. Display settings

`playerState.getDisplaySettings()`:

- **renderScale** → `engine.setHardwareScalingLevel(1/scale)`  
- **qualityPreset** → light intensity, particles, post-process  
- **fpsTarget** — noted in code as future cap (not fully enforced)  

Chunk draw radius is **not** tied to quality preset (view distance unchanged).

---

## 23. File dependency graph

```
ThreeDSliceView.tsx
  └── createDebugSliceScene.ts
        ├── TwoDParitySpriteFactory.ts
        ├── CharacterVisualProfile.ts
        ├── ThreeDEnemyVisualRegistry.ts
        ├── geometry.worker.ts
        ├── PathfindingManager → navigation.worker
        ├── PlayerState (singleton hub)
        ├── SaveSystem
        ├── WorldMapService (minimap prerender)
        ├── EnemyRegistry / ItemRegistry / ContainerRegistry / RuneRegistry
        └── AudioManager
```

---

## 24. Maintenance checklist

When changing this runtime:

1. Update this doc if behavior/constants change  
2. Update [COMPATIBILITY_AUDIT.md](./COMPATIBILITY_AUDIT.md) row(s)  
3. Update contracts if rules change (`PERSPECTIVE_MODE`, `PLAYER_STATE`, `BATTLE`, `MAP`)  
4. Append [MECHANICS_DELTAS.md](../MECHANICS_DELTAS.md)  
5. Run `npx tsc --noEmit` + `npm run smoke:test`  

---

## 25. Known gaps (document elsewhere)

| Topic | Target doc |
| :--- | :--- |
| Combat formula table | `COMBAT_3D_PARITY.md` |
| Save snapshot 3D fields | `SAVE_LOAD_3D.md` |
| PlayerState event list | `PLAYER_STATE_EVENTS_3D.md` |
| Worker-only deep dive | §9 + `geometry.worker.ts` header |

Cross-reference: [COMPATIBILITY_AUDIT.md](./COMPATIBILITY_AUDIT.md) rows 3D-03 through 3D-16, 3D-35.
