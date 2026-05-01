# Mechanics Deltas

## Delta Entry

- Date: 2026-04-23
- Task: topdown camera preset toggle
- Scope: topdown camera now supports safe and cinematic presets; sprite remains vertical
- Domain: perspective
- Modules: src/three-d/runtime/createDebugSliceScene.ts
- Previous Behavior:
  - topdown camera was fixed at one near-vertical beta/radius setup
- New Behavior:
  - safe preset is default in topdown
  - cinematic preset is available via key C while in topdown
  - first-person debug mode remains unchanged
- Invariants Preserved:
  - player sprite billboard remains vertical (no local tilt)
  - product-facing mode remains topdown-first
  - first-person remains debug-only
- Risks:
  - cinematic preset can reduce readability in dense combat scenes
- Validation:
  - editor diagnostics checked for touched runtime file (no errors)
- Rollback Hint:
  - remove applyTopDownCameraPreset and key C branch, restoring fixed camera parameters

## Delta Entry

- Date: 2026-04-23
- Task: generated functional hero sprite sheet pipeline
- Scope: hero billboard animation now uses generated sprite sheet instead of runtime procedural drawing
- Domain: perspective
- Modules: src/three-d/runtime/createDebugSliceScene.ts, scripts/generate-hero-functional-sprite.js, public/assets/sprites/hero_functional_sheet.png
- Previous Behavior:
  - hero billboard frames were drawn procedurally at runtime via DynamicTexture
- New Behavior:
  - hero sprite sheet is generated offline with Node + pngjs
  - runtime maps state/direction/frame using UV offsets over one texture
  - frame timing/state transitions remain unchanged
- Invariants Preserved:
  - player sprite remains vertical billboard
  - topdown remains product mode and first-person remains debug-only
  - existing state machine (idle/walk/attack/death) and direction resolution kept
- Risks:
  - UV row order mismatch can swap direction visuals if metadata/order diverges
- Validation:
  - npm run generate:hero-sprite executed successfully
  - editor diagnostics checked for touched runtime file (no errors)
- Rollback Hint:
  - restore runtime DynamicTexture frame generation block and texture map assignment

## Delta Entry

- Date: 2026-04-23
- Task: hero sprite orientation/grounding correction and shadow reference
- Scope: corrected billboard UV vertical mapping, lowered sprite anchoring, and added floor shadow for spatial readability
- Domain: perspective
- Modules: src/three-d/runtime/createDebugSliceScene.ts
- Previous Behavior:
  - hero billboard could appear upside-down and with up/down rows mismatched
  - hero looked visually floating with weak ground reference
- New Behavior:
  - sprite frames are sampled with V-flip to keep orientation upright and rows coherent
  - hero billboard anchor is lower to reduce floating perception
  - a subtle circular shadow is rendered under the hero
- Invariants Preserved:
  - billboard-based hero representation and existing animation state machine remain unchanged
  - topdown-first product direction remains unchanged
- Risks:
  - if a future sheet changes row convention, V mapping may need re-tune
- Validation:
  - editor diagnostics checked for touched runtime file (no errors)
- Rollback Hint:
  - restore previous billboard Y offset and UV vScale/vOffset mapping, and remove shadow disc mesh/material

## Delta Entry

- Date: 2026-04-23
- Task: shadow decoupled from jump height and vertical direction remap
- Scope: hero shadow now remains on ground plane while jumping; sprite up/down direction follows movement axis convention used in topdown
- Domain: perspective
- Modules: src/three-d/runtime/createDebugSliceScene.ts
- Previous Behavior:
  - shadow moved with player jump because it was parented to player transform
  - vertical direction mapping used +Z as down, causing up/down confusion
- New Behavior:
  - shadow is updated per-frame with player X/Z and fixed ground Y from active level
  - in first-person mode, shadow is hidden with billboard
  - direction resolver now maps +Z to up and -Z to down
- Invariants Preserved:
  - billboard animation state machine and frame timing remain unchanged
  - topdown-first runtime behavior remains unchanged
- Risks:
  - shadow Y offset may require minor tuning on specific maps with extreme floor visuals
- Validation:
  - editor diagnostics checked for touched runtime file (no errors)
- Rollback Hint:
  - re-parent shadow to player and restore previous +Z/down direction mapping

## Delta Entry

- Date: 2026-04-23
- Task: static 2D sprites for hero and enemies in 3D runtime
- Scope: replaced hero multi-frame sheet animation with a single static sprite and enforced sprite billboard fallback for all enemy ids
- Domain: perspective
- Modules: src/three-d/runtime/createDebugSliceScene.ts, src/three-d/runtime/ThreeDEnemyVisualRegistry.ts
- Previous Behavior:
  - hero used generated multi-frame sprite sheet with runtime state/frame mapping
  - enemies used static sprites only for mapped ids and procedural mesh fallback for others
- New Behavior:
  - hero uses static sprite `/assets/items/Hero/hero.png` as billboard
  - hero frame/state runtime mapping logic was removed
  - enemies now resolve to static sprite path for all ids via deterministic fallback rules
- Invariants Preserved:
  - gameplay logic, movement, combat, and camera flow remain unchanged
  - topdown-first runtime behavior remains unchanged
- Risks:
  - static hero loses animation feedback (attack/walk/death cues)
  - fallback enemy sprite may not match all archetypes perfectly
- Validation:
  - editor diagnostics checked for touched runtime files (no errors)
- Rollback Hint:
  - restore hero sheet-state block in createDebugSliceScene and procedural fallback branch in ThreeDEnemyVisualRegistry

## Delta Entry

- Date: 2026-04-23
- Task: restore classic yellow ball hero visual
- Scope: player visual in 3D runtime reverted to yellow ball style and humanoid hero billboard kept disabled
- Domain: perspective
- Modules: src/three-d/runtime/createDebugSliceScene.ts
- Previous Behavior:
  - hero humanoid static billboard was rendered in topdown mode
  - player capsule body was almost hidden
- New Behavior:
  - player body is visible as yellow ball-like shape (short capsule profile)
  - hero billboard sprite remains disabled in both topdown and first-person camera flows
- Invariants Preserved:
  - player movement, gravity, combat, and camera controls remain unchanged
  - ground shadow behavior remains level-anchored
- Risks:
  - if sprite mode is needed later, billboard activation flow must be explicitly reintroduced
- Validation:
  - editor diagnostics checked for touched runtime file (no errors)
- Rollback Hint:
  - restore previous capsule dimensions/visibility and re-enable heroBillboard in topdown flow

## Delta Entry

- Date: 2026-04-23
- Task: enforce 2D-to-3D sprite parity for hero and enemies
- Scope: 3D runtime now renders procedural billboard textures that mirror current 2D graphic definitions
- Domain: perspective
- Modules:
  - src/three-d/runtime/TwoDParitySpriteFactory.ts
  - src/three-d/runtime/ThreeDEnemyVisualRegistry.ts
  - src/three-d/runtime/createDebugSliceScene.ts
- Previous Behavior:
  - 3D hero used a static PNG portrait-like billboard
  - 3D enemies used simplified placeholder PNG mappings
- New Behavior:
  - Hero billboard texture is generated procedurally from the 2D PlayerGraphic idle frame style
  - Enemy billboard textures are generated procedurally per enemyId, matching the 2D enemy graphic families
- Invariants Preserved:
  - combat, movement, and level shadow grounding logic unchanged
  - first-person still hides billboard and shadow
- Risks:
  - parity is frame/style parity (single-frame billboard), not full animation parity
- Validation:
  - editor diagnostics for touched runtime files (no errors)
- Rollback Hint:
  - restore static PNG texture loading in createDebugSliceScene and ThreeDEnemyVisualRegistry

## Delta Entry

- Date: 2026-04-23
- Task: fix enemy orientation/selection readability in 3D combat
- Scope: remove camera-dependent enemy tilt artifacts, improve click selection reliability, and add clear ground/target indicators
- Domain: perspective
- Modules:
  - src/three-d/runtime/ThreeDEnemyVisualRegistry.ts
  - src/three-d/runtime/TwoDParitySpriteFactory.ts
  - src/three-d/runtime/createDebugSliceScene.ts
- Previous Behavior:
  - enemies could appear visually tilted/inconsistent depending on camera angle
  - some enemy sprites were hard to click/select for combat
  - weak visual grounding for enemy feet/contact point
- New Behavior:
  - enemy runtime no longer applies `lookAt` root rotation during movement
  - enemy visuals include dedicated ground shadow and explicit selection ring
  - enemy clickability increased via invisible billboard pick-proxy mesh
  - dynamic procedural sprite texture uses vertical UV correction for stable orientation
- Invariants Preserved:
  - enemy AI, pathfinding, aggro, attack range, and damage formulas unchanged
  - existing hero ground-shadow behavior preserved
- Risks:
  - emissive pulse currently applies to all child materials of selected enemy, including helper meshes
- Validation:
  - editor diagnostics for touched runtime files (no errors)
  - npx tsc --noEmit --skipLibCheck (pass)
  - npm run benchmark:e2e (pass, 14/14)
- Rollback Hint:
  - restore previous enemy visual registry and re-enable root lookAt in enemy path advance
