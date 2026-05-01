# Sprite Pipeline Contract

## 1. Purpose

This contract defines the canonical visual pipeline for gameplay sprites (actors, enemies, and sprite-based props) for both the 2D runtime and the 3D slice runtime.

Product direction:

1. Use authored sprite sheets as the primary source for gameplay characters.
2. Keep top-down readability as the first acceptance criterion.
3. Preserve parity between 2D gameplay and 3D slice presentation.

## 2. Scope and Ownership

In scope:

1. Player actor sprites
2. Enemy sprites
3. NPC sprites
4. Sprite-based world props (including tree props when implemented as entities)

Out of scope:

1. Base map tiles and structural walls/floors (remain under MAP_SYSTEM_CONTRACT)
2. Projection math and depth equations (remain under PERSPECTIVE_MODE_CONTRACT)

## 3. Source Rules (Authoring)

1. Authoring source is external sprite tooling (example: PixelLab).
2. Runtime import format must be atlas/sheet compatible with the current engine path.
3. A procedural fallback can remain for debugging and migration safety.
4. No direct copy/paste of copyrighted third-party artworks; style inspiration is allowed, cloning is not.
5. All generated sprites must use a transparent background. The generation CLI enforces `no_background: true` on every `generate-image-pixflux` call. Never commit sprites with a solid or opaque background.

## 4. Visual Direction

Target style:

1. Vibrant, clean, high-contrast adventure look.
2. Flat-color readability with limited shading bands.
3. Strong silhouettes that stay readable at gameplay camera distance.

Allowed reference language:

1. "Kurzgesagt-inspired" as a color/shape clarity reference.
2. Adaptation for pixel gameplay is mandatory; avoid literal illustration-style transfer.

## 5. Camera-Driven Readability Rules

1. Primary gameplay readability baseline is top-down / low top-down.
2. Sprites must remain legible when represented as billboards in the 3D slice.
3. Fine details that disappear at combat zoom should be removed or exaggerated.
4. Head/torso silhouettes may be intentionally oversized to improve recognition.

## 6. Required Animation Set

For all gameplay actors and enemies:

1. Direction policy:
   - idle/walk/attack: 4 (down, left, right, up)
   - death: 1 shared direction for 2D monsters
   - death default direction: south
   - per-creature death direction override is allowed only with documented readability justification in the sprite spec
2. Mandatory states:
   - idle
   - walk
   - attack
   - death

Minimum frame targets:

1. idle: 4
2. walk: 6
3. attack: 6
4. death: 4-8 (target 6)

Tier profile guidance (recommended):

1. trash:
   - attack: 6
   - death: 4-6
2. elite:
   - attack: 6-8
   - death: 6-8
3. boss:
   - attack: 8-12
   - death: 8-12

If memory/performance pressure appears, reduce frames before removing a mandatory state.

## 7. Size and Hitbox Baselines

Default sprite canvas:

1. Standard actor/enemy: 64x64 source canvas
2. Large elite/boss: 96x96 or 128x128 source canvas

World integration baseline:

1. Gameplay world unit remains tile-based at 32x32.
2. Runtime hitbox is authoritative for combat/collision, not raw sprite canvas size.
3. Recommended target world hitboxes:
   - small enemies: 20-24
   - standard enemies/actors: 28-32
   - brutes/elites: 40-48

## 8. Color and Contrast Guidelines

1. Keep one dominant hue family per enemy family.
2. Keep one accent hue for attack/readability cues.
3. Use a consistent dark outline value to preserve silhouette in mixed backgrounds.
4. Cap shading to three bands (base, shadow, highlight) for clean readability.

## 9. 2D and 3D Parity Rules

1. Enemy/player identity colors must match between 2D sprites and 3D billboard materials.
2. If a sprite is changed in 2D, update corresponding 3D visual profile/material mapping in the same task.
3. Do not introduce 3D-only enemy identity colors that diverge from 2D gameplay recognition.

## 10. Tree and Prop Policy

1. Trees as map tiles remain under tile contracts (procedural and tile-size constrained).
2. Trees as entity props (spawnable/interactable units) may use this sprite pipeline.
3. Any migration from tile-tree to prop-tree must explicitly document collision and pathfinding implications.

## 11. Naming and Asset Conventions

1. Keep deterministic texture keys by entity id.
2. Keep animation key naming uniform across all entities.
3. Keep atlas metadata versioned when frame layouts change.

## 12. Validation for Sprite Tasks

For sprite-pipeline-only contract/document updates:

1. Follow docs-only validation in VALIDATION_MATRIX.

For code-integrated sprite runtime changes:

1. Run `npx tsc --noEmit --skipLibCheck` and relevant benchmark checks according to impacted area.
2. Verify 2D and 3D visual parity in at least one combat scenario.

## 13. Initial Production Template (Recommended)

To start new enemy families quickly:

1. Template Type: humanoid or creature according to gameplay role
2. Camera View: low top-down
3. Directions: 4
4. States: idle/walk/attack/death
5. First pilot enemy: goblin spearman family (base, elite, miniboss variants)
