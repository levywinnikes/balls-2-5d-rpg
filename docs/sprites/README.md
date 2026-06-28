# Sprite Production Pack

## Purpose

This folder defines the day-to-day production workflow for gameplay sprites.
It complements `docs/contracts/SPRITE_PIPELINE_CONTRACT.md` with practical templates and acceptance checklists.

## Recommended Generation Flow

Use this order for new characters and enemies:

1. Base frame generation: Pixflux
2. Consistency and corrections: Inpaint
3. Direction support (optional accelerator): Rotate
4. Animation pass: animate from approved base rotations

Rationale:

1. Pixflux gives the best baseline cost/flexibility for first-pass sprites.
2. Inpaint reduces rework while preserving silhouette and palette identity.
3. Rotate can speed up directional variants, but output still needs manual art review.

## Folder Structure

- **`DIRECTION_CONVENTION.md`**: canonical south/north/east/west rules, validation, common bugs (read before any sprite integration).
- `templates/sprite-spec.template.yaml`: reusable spec template for any actor/enemy/prop.
- `enemies/goblin-lanceiro.spec.yaml`: pilot enemy spec to bootstrap production.
- `enemies/goblin-lanceiro.spec.json`: machine-ready pilot spec for script execution.
- `checklists/sprite-acceptance-checklist.md`: final quality gate before integration.

## PixelLab API Integration (Implemented)

Runtime scripts:

- `npm run generate:pixellab-sprite -- --spec docs/sprites/enemies/goblin-lanceiro.spec.json --entity goblin_lanceiro_v1`
- `npm run generate:hair-layer -- --spec docs/sprites/hero/hair-classic.spec.json`

Hero modular base:

- Spec: `docs/sprites/hero/hero-base.spec.json` (approved mannequin, canvas 92×92)
- Hair overlay: derived from `hero_base` via `create-character-state` + pixel diff (see `docs/sprites/MODULAR_SPRITE_AND_NPC_GENERATION_GUIDE.md` §2.3)
- **Item icons (menu/chão/containers) + link to body layers:** `docs/sprites/items/ITEM_VISUAL_PIPELINE.md`
- 3D runtime integration (billboard, head tracking, footstep sync, camera): see modular guide §4.2
- Body equipment (helmet, armor, legs, boots, shield, weapons, bow): `docs/three-d/HERO_BODY_EQUIPMENT.md`

Required environment variable:

- `PIXELLAB_API_KEY`: your API key (do not commit).

Optional endpoint overrides:

- `PIXELLAB_BASE_URL` (default `https://api.pixellab.ai`)
- `PIXELLAB_CREATE_PATH` (default `/v1/generate`)
- `PIXELLAB_STATUS_PATH` (default `/v1/jobs/{jobId}`)
- `PIXELLAB_POLL_MS` (default `5000`)
- `PIXELLAB_TIMEOUT_MS` (default `120000`)

Examples:

1. From spec (recommended):

   `npm run generate:pixellab-sprite -- --spec docs/sprites/enemies/goblin-lanceiro.spec.json --entity goblin_lanceiro_v1`

2. Direct prompt:

   `npm run generate:pixellab-sprite -- --model pixflux --entity goblin_test --prompt "top-down low angle pixel art goblin spearman, transparent background, 64x64" --negative "blurry, noisy" --width 64 --height 64`

Output files:

- Generated PNG: `public/assets/sprites/generated/<entity>.png`
- Metadata: `public/assets/sprites/generated/<entity>.png.meta.json`

Notes:

1. The client supports direct-image responses and async job polling responses.
2. If your account uses different endpoints, set `PIXELLAB_CREATE_PATH` and `PIXELLAB_STATUS_PATH` accordingly.
3. The CLI validates JSON specs before generation and fails fast on missing/invalid required fields.

Tier frame profiles:

1. trash: idle 4, walk 6, attack 6, death 4-6 (target 6)
2. elite: idle 4, walk 6, attack 6-8 (target 7), death 6-8 (target 7)
3. boss: idle 4-6, walk 6-8, attack 8-12, death 8-12

Spec validation rules (JSON):

1. Required: `id`, `pipeline.model_primary`, `production_prompts.base_generation_prompt`.
2. Required: `sprite_sheet.source_canvas.width` and `height` as positive integers.
3. Required: `animation_profile.tier` as `trash`, `elite`, or `boss`.
4. Required: `animation_profile.frame_targets` (`idle`, `walk`, `attack`, `death`) within tier range.
5. Required: `sprite_sheet.directions.death_shared_direction`; if not `south`, provide `death_direction_override_reason`.
6. Recommended: `direction_validation` object (`reference`, `status`, `note`) — see `docs/sprites/DIRECTION_CONVENTION.md`.

## Required Baseline

Every gameplay sprite spec must include:

1. Category and gameplay role.
2. Camera/view assumptions.
3. Direction count and animation states.
4. Source canvas and target world hitbox.
5. Palette and silhouette rules.
6. Integration notes for 2D and 3D parity.
7. Acceptance checklist result.

Direction/frame policy baseline:

1. Idle, walk, and attack must be authored in 4 directions.
2. **Orientation must match `hero_base`** — see `docs/sprites/DIRECTION_CONVENTION.md`.
3. Death can be authored in 1 shared direction for 2D monsters.
3. Default death direction is south.
4. If a creature needs a different death direction, record a readability justification in the sprite spec.
5. Death animation should use 4 to 8 frames (target 6).

Override examples:

1. Valid override:
   - case: a large creature with oversized back-mounted shell becomes unreadable in south death silhouette.
   - decision: set `death_shared_direction: "west"` and document why south loses combat readability.

2. Invalid override:
   - case: changing death direction only for artistic preference without readability loss in south.
   - decision: reject override and keep `death_shared_direction: "south"`.

## Integration Rule

Specs in this folder are production inputs. Runtime integration and contract changes still follow:

1. `docs/contracts/SPRITE_PIPELINE_CONTRACT.md`
2. `docs/contracts/MAP_SYSTEM_CONTRACT.md`
3. `docs/contracts/PERSPECTIVE_MODE_CONTRACT.md`
