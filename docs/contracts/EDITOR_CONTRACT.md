# Editor & Persistence Contract

## 1. Architecture

The Level Editor is a separate scene (`EditorScene.ts`) that runs within the same Phaser instance but with different game logic and UI.

## 2. Editor-Phaser Bridge

- **Control:** React UI sets the editor state (selected tile, tool) via `editorScene.setEditorState()`.
- **Interactivity:**
  - **Brush Tool:** Paints the selected symbol at the grid coordinate.
  - **Eraser Tool:** Removes the symbol from the grid.
  - **Auto-symbol Creation:** If a tile ID is selected that doesn't have a symbol in the JSON, the editor automatically generates a unique 2-character symbol and adds it to the `tiles` dictionary.

## 3. Persistence Protocol (Map Server)

- **Local Server:** `scripts/map-server.js`.
- **Endpoint:** `POST http://localhost:3001/save-map`.
- **File Target:** `public/maps/newmap.json`.
- **Safety:** The server performs basic validation of the `width`, `height`, and `layers` properties before writing to disk.

## 3.1 Entry Point

- The main menu's `MAP EDITOR` button should route into the dedicated editor app (`EditorLayout.tsx`) rather than the in-game editor scene.

## 4. Map Normalization

- The editor works with raw JSON.
- After saving, the `MapLoader` in the game will normalize the sizes if they were changed in the editor (e.g., adding rows/columns at the edges).

## 5. View & Controls

- **Camera:** WASD for panning, Mouse wheel for zoom (implemented via Phaser camera API).
- **Grid:** A dynamic graphics overlay helps visualize tile boundaries at 128x128px (HD) or 32x32px (depending on the map setting).
