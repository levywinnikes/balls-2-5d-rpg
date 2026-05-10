# Copilot Instructions — Balls 2.5D RPG

## MANDATORY: Read contracts before any code change

Before writing or modifying any code, you MUST:

1. Identify which domain the task touches (see table below).
2. Read the corresponding contract file(s) listed for that domain.
3. If you have not read the relevant contract, **refuse to implement and ask for confirmation first**.

| Domain                                                                            | Contract file(s) to read                                                                         |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **3D Slice Runtime, HUD, FloatingText, Audio integration**                        | **`docs/THREE_D_INTEGRATION_BLUEPRINT.md` (CLÁUSULA PÉTREA — ler ANTES de qualquer mudança 3D)** |
| Map rendering, tiles, BMS, binary levels, LevelRenderer, TileRegistry             | `docs/contracts/MAP_SYSTEM_CONTRACT.md`, `docs/SYSTEM_BMS.md`                                    |
| 3D perspective, projection, volumetric walls, PerspectiveProjection               | `docs/contracts/PERSPECTIVE_MODE_CONTRACT.md`, `docs/PERSPECTIVE_MODE_MASTER_PLAN.md`            |
| Level transitions, stairs, holes, TransitionSystem                                | `docs/contracts/MAP_SYSTEM_CONTRACT.md`                                                          |
| Player state, stats, inventory, equipment                                         | `docs/contracts/PLAYER_STATE_CONTRACT.md`                                                        |
| Save/load, SaveSystem, persistence                                                | `docs/contracts/SAVE_SYSTEM_CONTRACT.md`                                                         |
| UI components, HUD, windows, React overlays                                       | `docs/contracts/UI_DESIGN_CONTRACT.md`                                                           |
| Any player-facing text, labels, notifications                                     | `docs/contracts/LOCALIZATION_CONTRACT.md`                                                        |
| Combat, BattleSystem, damage, XP                                                  | `docs/contracts/BATTLE_SYSTEM_CONTRACT.md`                                                       |
| Benchmark, smoke test, smoke_test.json, generate-smoke-map.js                     | `docs/contracts/BENCHMARK_CONTRACT.md`                                                           |
| **World map, island layout, biomes, tile atlas, structure rules, map generators** | **`docs/contracts/WORLD_MAP_CONTRACT.md`** (ler ANTES de qualquer gerador de mapa)               |
| Cross-cutting / multiple domains                                                  | All contracts above that apply                                                                   |

After reading, state: "Li o contrato X. A restrição relevante para esta tarefa é Y."

## MANDATORY: Communication and Disagreement Protocol

To avoid false agreement and silent divergence, before implementing you MUST:

1. Present a brief alignment check with 3 explicit points:
   - What I agree with from the request.
   - What I believe is risky or incompatible with contracts/current code.
   - What is still uncertain and requires confirmation.
2. If there is any conflict between user request and contracts/code behavior, do NOT proceed silently.
   - Explicitly describe the conflict.
   - Ask for decision/priority before implementation.
3. If uncertainty remains about map structure, projection, benchmark assumptions, or ownership boundaries, pause and ask targeted questions first.
4. Never say "you are right" as a default response pattern. Agreement must be evidence-based and tied to code/contracts.

Required pre-implementation response format (concise):

- `Entendimento:` one-line summary of the requested outcome.
- `Risco/Conflito:` what can break or what conflicts with contract.
- `Dúvida objetiva:` exactly what needs confirmation before coding.

## MANDATORY: Contract Checklist Gate (Deterministic)

Before any implementation tool use (file edits or implementation-oriented terminal commands), update:

- `.github/agent-runtime/contract-checklist.json`

Required fields in this file:

- `updatedAt` (ISO datetime)
- `task`
- `contractsRead` (non-empty array)
- `understanding`
- `riskConflict`
- `objectiveQuestion`

Enforcement:

- Workspace hook config: `.github/hooks/pretool-gate.json`
- Gate script: `scripts/copilot-pretool-gate.js`
- If checklist is missing/incomplete/stale, tool permission must be `ask` and implementation must pause until checklist is refreshed.

Checklist refresh triggers (mandatory):

- If observed runtime behavior diverges from expected contract behavior (ex: 2D vs 3D parity gaps), refresh checklist before implementation.
- If canonical docs/indices were changed in the current or previous task, refresh checklist before next implementation task.
- If task scope changes mid-execution (new impacted modules or contracts), refresh checklist immediately and continue only after update.

---

## Hard rules (non-negotiable)

### Map / BMS

- `MapLoader.getTileAt(x, y, level)` is the only allowed tile access. Never access `levelData.map`, `levelData.tiles`, or `mapData.levels[z].map` directly.
- All tile graphics are **procedural** (Phaser Graphics). External PNG textures for tiles are forbidden.
- Tile size is always **32×32 pixels**. Never use 128px or `setScale(4)`.
- Upper floor levels (level 1+) must use `"..."` (void/sky) as the default tile. Only explicitly placed structure tiles should be solid. Never fill upper floors with `grs` or any terrain tile as default.
- Every level in a map must be normalized to the same width×height, padded with `"..."` for upper floors.

### Perspective / 3D renderer

- Projection math lives exclusively in `PerspectiveProjection.ts`. Do not duplicate it.
- `LevelRenderer` owns all rendering and must not bypass `MapLoader` for tile data.
- `currentLevel`, renderer state, and entity depth must stay in sync at all times.
- `shouldHideUpperRoofTile()` controls roof cut — do not add parallel roof-hiding logic elsewhere.
- Roof tiles (`tileId.includes("roof")`) must never extrude volumetric walls.

### Benchmark

- Fast loop must avoid build-heavy validation by default; use `npm run smoke:test` for routine task completion.
- `npm run benchmark:e2e` is mandatory only for PR-final validation, release validation, or when benchmark runtime/harness flow is changed.
- Any change to `smoke_test.json`, `generate-smoke-map.js`, or transition logic requires running the benchmark.
- Never remove or rename existing benchmark steps without updating `BENCHMARK_CONTRACT.md`.

### Player-facing text

- All player-facing strings must use `t_game(...)` translation keys. No hardcoded strings.

### Architecture boundaries

- `PlayerState` is the single source of truth for player stats, inventory, and mode flags.
- React → Phaser: only via `PlayerState` methods. Phaser → React: only via `PlayerState` events.
- Do not bypass `PlayerState` for UI state sync.

### Collaboration safety

- Do not optimize for "agreement tone". Optimize for technical correctness and explicit trade-offs.
- If prior agreement is contradicted by new evidence, explicitly call out the contradiction and propose correction.
- When implementing from conversation context, re-check active contracts before code changes even if discussed earlier in the same thread.

---

## Validation commands by impact area

| Change area               | Required commands                                                            |
| ------------------------- | ---------------------------------------------------------------------------- |
| Gameplay, scenes, systems | `npx tsc --noEmit --skipLibCheck`, `npm run smoke:test`                      |
| Map / BMS                 | `npm run check:bms`, `npx tsc --noEmit --skipLibCheck`, `npm run smoke:test` |
| UI text / HUD             | `npm run check:i18n-ui`, `npx tsc --noEmit --skipLibCheck`                   |
| Save/load                 | `npx tsc --noEmit --skipLibCheck`, `npm run smoke:test`                      |
| Benchmark harness         | `npx tsc --noEmit --skipLibCheck`, `npm run benchmark:e2e`                   |

`benchmark:e2e` trigger set:

- required on PR-final validation and release validation
- required when benchmark harness/checkpoints/menu benchmark flow is touched

---

## Reference docs

- `docs/AI_READ_FIRST.md` — quick service hub and BMS rules
- `docs/AI_RUNBOOK.md` — mandatory execution flow
- `docs/PROJECT_DOCUMENTATION_INDEX.md` — canonical documentation domain index
- `docs/ARCHITECTURE_MAP.md` — module → contract mapping
- `docs/ARCHITECTURE_OVERVIEW.md` — system overview
- `docs/SYSTEM_BMS.md` — binary map system
- `docs/VALIDATION_MATRIX.md` — full validation matrix
