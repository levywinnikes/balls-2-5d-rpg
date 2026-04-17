# UI Design Contract

## 1. Aesthetics: RPG Glassmorphism

- **Primary Background:** `rgba(26, 26, 26, 0.8)` (Anthracite Semi-Transparent).
- **Glass Effect:** `backdrop-filter: blur(8px)`.
- **Borders:** Thin, logic-based borders.
  - Active/Hover: `1px solid rgba(255, 255, 255, 0.2)`.
  - Inactive: `1px solid rgba(255, 255, 255, 0.05)`.
- **Shadows:** Deep, soft shadows for floating windows.

## 2. Component Structure

- **Windows:** Use `GameWindow.tsx`. It handles dragging, closing, and z-index management.
- **Slots:**
  - Standard Item Slot: 64x64px.
  - Large Item Slot: 128x128px (for equipment).
  - Hover Effect: Scale up by 5% and add a golden/white outer glow.

## 3. Typography

- **Primary:** "Inter" (Fallback: sans-serif).
- **Heading:** "Inter" with bold weight (700).
- **Numerical Data:** Use a Monospace font for HP/MP values to prevent jumping.

## 4. UI Events & React Performance

- **Subscriptions:** Always use `on` and `off` from `PlayerState` inside `useEffect`.
- **DRAGGING RULE:**
  - NEVER use controlled `position` state for dragging windows.
  - Use `react-rnd` with uncontrolled updates and sync only when absolutely necessary (e.g., resizing or snap-to-grid).

## 5. Tooltips

- Tooltips must be smart:
  - Check screen boundaries.
  - If right-edge is clipped, flip to the left of the cursor.
  - If bottom-edge is clipped, flip above the cursor.

## 6. Localization & Text Contract (Mandatory)

- Any user-facing UI text MUST come from translation keys.
- Hardcoded UI strings are forbidden in React components, Phaser scenes, HUD overlays, and window controls.
- Use `t_game(...)` (or the active translation helper) for labels, buttons, notifications, and status messages.
- When adding UI text, add keys for all supported languages in `src/game/i18n/translations.ts` in the same task.
- Placeholder variables must be represented as tokens (e.g. `{count}`, `{name}`) and replaced at runtime.
- Fallback to literal text is allowed only for developer-only logs and debugging output, never for player-facing UI.
