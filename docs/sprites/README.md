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

- `templates/sprite-spec.template.yaml`: reusable spec template for any actor/enemy/prop.
- `enemies/goblin-lanceiro.spec.yaml`: pilot enemy spec to bootstrap production.
- `enemies/goblin-lanceiro.spec.json`: machine-ready pilot spec for script execution.
- `checklists/sprite-acceptance-checklist.md`: final quality gate before integration.

## PixelLab API Integration (Implemented)

Runtime script:

- `npm run generate:pixellab-sprite -- --spec docs/sprites/enemies/goblin-lanceiro.spec.json --entity goblin_lanceiro_v1`

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
2. Death can be authored in 1 shared direction for 2D monsters.
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
