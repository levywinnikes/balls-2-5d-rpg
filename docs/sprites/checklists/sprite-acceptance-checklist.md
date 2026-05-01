# Sprite Acceptance Checklist

Use this checklist before merging any sprite-related implementation.

## A. Art Quality

1. Silhouette is recognizable at gameplay zoom.
2. Palette matches family identity and does not drift between states.
3. Outline remains readable on light and dark map backgrounds.
4. Shading uses at most three bands (base, shadow, highlight).

## B. Direction and Animation

1. Idle, walk, and attack exist in all four directions and share the same proportions.
2. Mandatory states exist: idle, walk, attack, death.
3. Death animation can be single-direction for 2D monsters and must contain 4 to 8 frames.
4. Default death direction is south, unless a per-creature override is documented with readability justification.
5. Target frame counts are met or explicitly justified.
6. Frame targets match the declared tier profile (trash, elite, or boss).
7. Attack keyframe communicates impact direction clearly.
8. Death sequence reads clearly and does not look like idle/walk drift.

## C. Technical Consistency

1. Background is transparent and edge cleanup is complete.
2. Atlas/sheet naming follows deterministic entity id conventions.
3. Source canvas and target hitbox are documented in the spec file.
4. Any deviations from standard size/hitbox are documented.

## D. Runtime Parity

1. 2D runtime preview approved in gameplay context.
2. 3D slice billboard readability approved in gameplay context.
3. Enemy/player identity colors remain consistent between 2D and 3D.
4. No 3D-only color identity divergence was introduced.

## E. Merge Gate

1. Sprite spec file exists and is complete.
2. Checklist result is recorded in task summary.
3. Related contracts/docs were reviewed for impacted behavior.
4. If runtime code changed, required validation commands were executed.
