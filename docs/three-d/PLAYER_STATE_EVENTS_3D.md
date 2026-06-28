# PlayerState & DOM Events in 3D

Catalog of **event bridges** between `createDebugSliceScene`, `ThreeDSliceView`, and React UI.  
**Pattern:** gameplay emits via `PlayerState.emit(...)` or `document.dispatchEvent(CustomEvent)`; React listens with hooks or `addEventListener`.

Related: [SLICE_RUNTIME.md §18](./SLICE_RUNTIME.md#18-playerstate-integration), [COMBAT_3D_PARITY.md](./COMBAT_3D_PARITY.md), [THREE_D_INTEGRATION_BLUEPRINT.md](../THREE_D_INTEGRATION_BLUEPRINT.md)

---

## 1. PlayerState listeners (slice → runtime)

Registered in `createDebugSliceScene.ts`:

| Event | Payload | Handler |
| :--- | :--- | :--- |
| `dropItem` | item drop request | `handleDropItem` — spawns persistent drop |
| `requestPickup` | pickup request | `handleRequestPickup` |
| `spawnDroppedItem` | drop data | `addDroppedItemFromEvent` |
| `prepareRuneCast` | `runeId: string` | Enter grimório targeting; emit `uiNotification` |
| `cancelRuneCast` | — | Exit targeting mode |
| `equipmentChanged` | — | `syncHeroVisualProfile` (billboard layers) |
| `displaySettingsChanged` | display settings object | Babylon render scale / quality / FPS cap |

---

## 2. PlayerState emits (runtime → UI)

Emitted from slice (non-exhaustive — combat emits many `floatingText`):

| Event | Payload (typical) | Consumer |
| :--- | :--- | :--- |
| `floatingText` | `{ x, y, z, damage?, message?, icon?, customColor?, isCritical?, isAmbient? }` | `ThreeDFloatingText.tsx` |
| `uiNotification` | `{ type, message }` | `NotificationSystem` |
| `message` | localized string | HUD / toast |
| `inventoryUpdated` | — | Inventory windows |
| `runesUpdated` | — | Grimório / rune inventory |
| `runeCasted` | — | Post cast hook |
| `log` / combat logs | via `playerState.log(...)` | Combat log UI |

Combat floating text uses **world coords** (Babylon X/Z); overlay projects via engine/scene.

---

## 3. DOM CustomEvents (slice ↔ React shell)

| Event | Detail | Emitter | Listener |
| :--- | :--- | :--- | :--- |
| `slice3d:playerHit` | `{ damage: number }` | `emitPlayerDamagePopup` | `ThreeDSliceView` — vignette flash |
| `slice3d:cameraModeChanged` | `{ firstPerson: boolean }` | FP toggle (`V`) | Crosshair show/hide |
| `slice3d:runeSlotChanged` | `{ slots: string[], activeIndex: number }` | `dispatchRuneSlotUpdate` | Rune hotbar HUD |
| `ui:windowToggled` | `{ key: string, isOpen: boolean }` | UIContext windows | Maps to `WindowSystem` ids |
| `returnToTitle` | — | System menu | Disposes runtime, shows menu |

### Window id map (`ThreeDSliceView`)

| UIContext key | WindowSystem id |
| :--- | :--- |
| `heroMenu` | `hero_menu` |
| `settings` | `settings` |
| `expandedMap` | `expandedMap` |
| `questLog` | `questLog` |
| `cheats` | `cheats` |
| `grimorio` | `grimorio` |

---

## 4. PlayerState listeners (React shell only)

In `ThreeDSliceView.tsx` (not in slice):

| Event | Handler |
| :--- | :--- |
| `windowOpened` | Open `container` or `altar` window from container events |
| `containerClosed` | Close container windows when id cleared |

---

## 5. Keyboard shortcuts (shell)

Handled in `ThreeDSliceView` when in game (slice handles movement/combat keys on canvas focus):

| Key | Action |
| :--- | :--- |
| `I` / `Tab` | Hero menu |
| `J` / `L` | Quest log |
| `O` | Settings |
| `M` | Expanded map |
| `Escape` | System menu / close windows |
| `F5` | Quick save |

Slice-local keys (documented in SLICE_RUNTIME): WASD, Space jump, `V` FP debug, `C` camera preset, `Q`/`R` runes, `E` pickup, `F` fall safety.

---

## 6. Grimório targeting flow

```text
UI: prepareRuneCast(runeId)
  → slice: runeTargetingMode = true
  → left-click enemy mesh (sliceEnemyUid)
  → castRuneAtTarget(uid)
  → emit runesUpdated, runeCasted

UI: cancelRuneCast()
  → slice: clear targeting
```

See [COMBAT_3D_PARITY.md §11](./COMBAT_3D_PARITY.md#11-runes).

---

## 7. Adding a new bridge

1. Prefer **`PlayerState.emit`** for data that already flows to 2D HUD patterns.  
2. Use **`document.dispatchEvent`** only for React-only concerns (vignette, crosshair) with no `PlayerState` subscriber yet.  
3. Update this file + [COMPATIBILITY_AUDIT.md](./COMPATIBILITY_AUDIT.md) row 3D-24 if adding a new public event.
