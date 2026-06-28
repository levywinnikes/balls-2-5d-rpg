# Save System Contract

## 1. Purpose

`SaveSystem.ts` is the persistence coordinator for the game. It owns the save payload, the load entry points, and the browser fallback behavior.

## 2. Persistence Modes

- **Electron mode** is the canonical durable path. It writes and reads saves through `window.electronAPI`.
- **Browser mode** is session-only. It stores the latest save in memory and must not be treated as durable storage.

## 3. Save Payload Schema

The canonical save payload is assembled from scene state plus the serialized `PlayerState` snapshot.

| Scope                  | Fields                                                                                                                                                                                              | Notes                                                                                                 |
| :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| Save envelope          | `map`, `currentLevel`, `playerPos`, `timestamp`, `version`                                                                                                                                          | Top-level metadata used by load and validation.                                                       |
| Player identity        | `playerState.characterName`                                                                                                                                                                         | Used by save slots and benchmark checks.                                                              |
| Core stats             | `health`, `maxHealth`, `level`, `experience`, `attackDamage`                                                                                                                                        | Restored directly into `PlayerState`.                                                                 |
| Skills                 | `skills.strength`, `skills.dexterity`, `skills.reflex`, `skills.intelligence`                                                                                                                       | Current skill levels and experience.                                                                  |
| Survival stats         | `willpowerExp`, `willpowerTarget`, `hunger`, `playTime`                                                                                                                                             | Persistent character progression state.                                                               |
| Equipment              | `equippedWeaponId`, `equippedShieldId`, `equippedHelmetId`, `equippedArmorId`, `equippedLegsId`, `equippedBootsId`, `equippedNeckId`, `equippedRingId`, `equippedAmmoId` and matching item payloads | Must preserve item identities when present.                                                           |
| Inventory              | `inventory`, `shieldInventoryIds`, `inventoryWeaponIds`                                                                                                                                             | Inventory entries must keep `uid` values when available.                                              |
| World progress         | `exploredAreas`, `persistentItems`, `containers`, `doorStates`                                                                                                                                      | Keyed collections that encode per-level/world progression.                                            |
| Global progression     | `visitedLevels`                                                                                                                                                                                     | Set of visited level IDs that must roundtrip intact.                                                  |
| Altars and runes       | `altarStorage`, `enchantedRunes`                                                                                                                                                                    | `altarStorage` is keyed by altar ID; `enchantedRunes` is global rune progression and inventory state. |
| Quest and status state | `quests`, `activeBuffs`, `markers`                                                                                                                                                                  | Global player progression and transient status snapshot.                                              |
| Scene state            | `deadEnemies`, `activeEnemies`, `ui`                                                                                                                                                                | **2D `GameScene` only.** 3D uses `playerState.deadEnemies3d` inside snapshot — see [SAVE_LOAD_3D.md](../three-d/SAVE_LOAD_3D.md). |
| 3D enemy kills         | `playerState.deadEnemies3d` in snapshot                                                                                                                                                             | `Record<level, spawnKey[]>` — must roundtrip via `exportSnapshot` / `loadState`. |
| 3D door states         | `playerState.doorStates` in snapshot                                                                                                                                                                | `Record<doorUuid, { open, locked?, keyId? }>` — authoritative for interactive 3D door state. |

## 4. Save Flow

### 2D (`GameScene`)

1. `GameScene` injects the live player, map, and transition context into `SaveSystem`.
2. `SaveSystem.saveGame()` reads `currentMap` and `currentLevel` from the scene registry.
3. Before serialization, active dropped items are copied from the scene into `PlayerState` so the save reflects what the player actually sees.
4. The final payload is built from `PlayerState.exportSnapshot()` plus scene data such as position, enemies, UI state, timestamp, and version.
5. In Electron mode, the payload is written to disk via `window.electronAPI.saveGame()`.
6. In browser mode, the payload is stored only in `memorySaveData` and is lost when the session ends.

### 3D (`createDebugSliceScene`)

1. Slice calls **`SaveSystem.saveGameDirect({ map, currentLevel, playerPos })`** — no Phaser scene.
2. Progression comes entirely from **`PlayerState.exportSnapshot()`** (includes `deadEnemies3d`, `persistentItems`, `doorStates`, …).
3. Top-level `deadEnemies` / `activeEnemies` arrays are left empty in 3D saves.
4. Auto-save every 60 s + manual F5 / system menu — see [SAVE_LOAD_3D.md](../three-d/SAVE_LOAD_3D.md).

## 5. Load Flow

1. `SaveSystem.loadCharacter()` retrieves the payload from Electron or returns the in-memory fallback in browser mode.
2. `GameScene` restores `map`, `currentLevel`, and `playerPos` first.
3. `PlayerState` is then restored from the saved snapshot.
4. Enemy lists, persistent items, and other scene-owned data are repopulated from the payload.
5. If the payload is missing, incompatible, or not the current browser session, the caller must treat the load as failed.

## 6. Scope Rules

- Global player state belongs in `PlayerState` and must survive save/load roundtrips.
- Per-level or per-map collections such as `exploredAreas`, `persistentItems`, and `containers` must remain keyed by the level/map context they belong to.
- Per-door mutable state must remain keyed by stable **door UUID**, not by array index or transient runtime mesh id.
- `altarStorage` must remain keyed by altar ID, not by level or map.
- `visitedLevels` is a global progression set of visited level IDs and must roundtrip intact.
- Derived values such as movement speed, attack speed, and other stat totals are not stored as authoritative values; they are recalculated on load.
- Scene objects that are only visual or temporary must not be treated as authoritative save data unless they are explicitly copied into `PlayerState` before save.

## 7. Benchmark Alignment

- The benchmark harness validates the save/load smoke path by creating a temporary character, saving it, loading it back, and checking the loaded map, level, character name, inventory, and expected quest state.
- Any gameplay change that affects persistence should update the benchmark roundtrip when practical.
