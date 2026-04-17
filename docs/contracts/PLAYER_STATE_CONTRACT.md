# Player State Contract

## 1. Single Source of Truth

- `PlayerState.ts` is the **ONLY** place where player stats, inventory, and equipment are stored.
- Access via `PlayerState.getInstance()`.

## 2. Event Emission

- Whenever a state variable changes, an event MUST be emitted.
- **Example:**
  ```typescript
  setHealth(val: number) {
    this.health = val;
    this.emit('updateStats', this);
  }
  ```
- React components must subscribe to these events (standard pattern: `useEffect` with `on` and cleanup with `off`).

## 3. Persistence (Save/Load)

- `SaveSystem.ts` handles serialization through Electron disk saves when available, with an in-memory browser fallback only.
- **Rules:**
  - `uid` for items must be preserved to maintain container links.
  - New properties in `PlayerState` must be added to the `SaveSystem` save/load path and to the `exportSnapshot()` / `loadFromData()` / `loadState()` flow.
  - Per-level persistent data such as dropped items, visited levels, altars, and containers must remain keyed by the level/map context they belong to.
  - Quests are part of the global player save state and must remain compatible with `exportSnapshot()` / `loadState()`.
  - If a new property affects gameplay, update the benchmark save/load roundtrip to assert it when practical.

## 4. Derived Stats

- Stats like `MovementSpeed` or `AttackDamage` should be calculated based on base stats + equipment modifiers.
- Avoid caching derived stats; calculate them on the fly or update them via a central `recalculateDerivedStats()` method.

## 5. Security

- Since this is a single-player game, client-side state is accepted. However, keep business logic (e.g., "Can I equip this?") inside `PlayerState` methods, not in UI components.
