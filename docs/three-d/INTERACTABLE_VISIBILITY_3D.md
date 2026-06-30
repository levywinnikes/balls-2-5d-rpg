# Interactable Wall Reveal (3D Top-Down)

**Purpose:** Hint where hidden enemies/doors are without drawing sprites on wall faces.

---

## Visual (subtle)

- **Floor ring only** — soft amber (enemy) or blue (door) disc on the ground at the object's tile
- **No vertical ghost sprite** — avoids the "bug pasted on wall" look
- Only when grid LOS from player is blocked

## Interaction (invisible)

- Transparent pick plane sized like the real object
- Right-click selects enemy or toggles door (same metadata as live meshes)

---

## Door vs pickup

See `SLICE_RUNTIME.md` — E picks up items first; left-click does not open doors in FP.

---

## Future

True wall cutout / stencil peek is backlog; floor ping + invisible pick is the interim UX.
