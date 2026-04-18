# Perspective Mode Phase 1 Feasibility

## 1. Goal of this phase

Assess if the current framework can support the target perspective redesign and decide the best technical path before implementation.

Target outcome:

- GTA2-like angle behavior (as reference), but compact floor height.
- True stacked floors in 3D-looking projection (no global Y+1 fake offset).
- Better visual consistency for buildings/stairs across levels.
- Keep game rules, map logic, and 32px grid intact.

## 2. Current stack and constraints

### 2.1 Current stack

- Engine in project: `phaser ^3.90.0`
- NPM latest Phaser: `4.0.0`
- Candidate 3D options in ecosystem:
  - `@enable3d/phaser-extension 0.26.1`
  - `three 0.184.0`
  - `babylonjs 9.3.1`

### 2.2 Contract constraints

From project contracts:

- 32x32 tile grid is canonical.
- Current rendering model is map-centric and heavily integrated with LevelRenderer/MapLoader/GameScene.
- Procedural graphics are preferred/mandated for gameplay visuals.
- Existing architecture is Phaser + React bridge with PlayerState event model.

Implication:

- Any approach that requires replacing scene/runtime ownership has high migration risk.
- Any approach that depends on static external texture pipeline conflicts with current rules.

## 3. Options considered

### Option A: Stay on Phaser 3 and redesign 2.5D renderer (recommended)

Description:

- Keep Phaser 3 runtime and gameplay systems.
- Replace current perspective hack with a true stacked tile-block projection pipeline.
- Introduce per-level world-height projection math and proper face rendering/order.

Pros:

- Lowest migration risk for gameplay systems.
- Reuses current map, transition, and collision architecture.
- Fastest path to visible improvements.
- Fits current contracts with minimal policy changes.

Cons:

- Requires careful custom render math and depth ordering rules.
- Still not a full 3D engine (no native 3D physics).

Risk level: Medium
Time-to-first-result: Short/Medium

### Option B: Upgrade to Phaser 4 now

Description:

- Migrate project from Phaser 3.x to 4.x before renderer redesign.

Pros:

- Uses latest major engine branch.

Cons:

- Very high migration scope now (API changes and runtime regressions likely).
- Delays actual perspective fix.
- No guarantee this alone solves projection architecture problems.

Risk level: High
Time-to-first-result: Long

### Option C: Keep Phaser for gameplay + add real 3D engine layer (Three/Babylon)

Description:

- Hybrid runtime: gameplay logic stays in Phaser, rendering handled by Three/Babylon.

Pros:

- True 3D pipeline and camera controls.

Cons:

- Highest complexity (dual-engine sync, input sync, camera sync, UI sync).
- Requires major architecture rewrite.
- Hard to preserve current contracts and benchmark stability in early phase.

Risk level: Very High
Time-to-first-result: Long

### Option D: Phaser + enable3d extension

Description:

- Use Phaser extension to add 3D capabilities.

Pros:

- Keeps Phaser-centered workflow.

Cons:

- Still introduces new 3D runtime model and integration complexity.
- Extension maturity and long-term maintenance risk vs core engine path.

Risk level: Medium/High
Time-to-first-result: Medium/Long

## 4. Decision matrix (Phase 1)

Criteria:

- C1: Solves current visual bug roots (stacking/aliasing/positioning)
- C2: Preserves existing gameplay architecture
- C3: Delivery speed for first playable improvement
- C4: Migration/regression risk
- C5: Contract compatibility

Assessment summary:

- Option A scores best overall for Phase 1.
- Option B should be evaluated later, after renderer stabilization.
- Option C is a strategic reboot path, not a Phase 1 path.
- Option D may be a later experiment, not the primary path now.

## 5. Recommendation

Recommend Option A for Phase 1:

- Keep Phaser 3 for now.
- Do NOT upgrade to Phaser 4 before the renderer redesign.
- Do NOT adopt full 3D engine yet.
- Build a real stacked 2.5D block projection in current runtime first.

Why:

- It directly addresses the real problem (projection architecture), not just engine version.
- It gives the fastest validated path to a better main mode.

## 6. What to check in Phase 1 result (acceptance)

### Visual correctness

1. Floors align vertically without fake global Y shifts.
2. Building edges are straight (no jagged staircase artifact caused by offset hacks).
3. Stair/upper-floor composition remains stable while player moves.

### Runtime consistency

1. `currentLevel` and rendered level containers stay synchronized.
2. Transition system does not produce depth glitches.
3. Entity depth ordering remains deterministic.

### Performance

1. No major FPS regression in standard exploration scenarios.
2. No obvious stutter introduced by perspective updates.

## 7. Proposed technical spikes (next immediate work)

1. Spike S1: Projection core

- Add a dedicated projection utility for world->screen with per-level height.
- Remove dependence on global Y+1 illusion in the 3D path.

2. Spike S2: Tile block rendering

- Render top + side faces from tile definition/procedural color logic.
- Keep floor height compact (configurable height constant).

3. Spike S3: Depth and transitions

- Define one depth policy for tiles, entities, and overlays under multi-level perspective.
- Validate with stairs/hole transitions.

4. Spike S4: Validation harness

- Add perspective checkpoints to benchmark/smoke flow.

## 8. Phaser 4 and Real 3D reevaluation gate

Reevaluate Phaser 4 migration or real 3D only after all are true:

1. New projection pipeline is stable and measured.
2. Remaining issues are engine-limited (not architecture-limited).
3. Benchmark data shows hard limits impossible to solve in Phaser 3 pipeline.
