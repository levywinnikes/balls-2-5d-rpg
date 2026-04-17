# Project Master Contract: Balls 2.5D RPG (Alpha 1)

## 1. Core Vision

- **Aesthetic**: Procedural minimalism. No external PNGs for gameplay entities.
- **Graphic Engine**: "Balls & Shapes" - everything is generated via `Phaser.Graphics`.
- **Scaling**: 32x32 standard grid (HD 128x128 mode is deprecated).
- **Architecture**: 2.5D Oblique Projection (Tibia-style) using dynamic layering.

## The Rule of Zero

> [!IMPORTANT]
> **Before writing a single line of code, the AI MUST read the relevant contracts.**
> Failure to do so risks breaking architectural integrity and game balance.

## Sub-Contract Directory

| Contract            | Purpose                                                                          | Path                                                                                                                                    |
| :------------------ | :------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| **Technical Stack** | Framework versions, folder structure, and runtime rules.                         | [TECHNICAL_STACK.md](file:///c:/Users/kifit/OneDrive/Documentos/GitHub/balls-2-5d2-rpg/docs/contracts/TECHNICAL_STACK.md)               |
| **Battle System**   | Damage formulas, turn order, and combat events.                                  | [BATTLE_SYSTEM_CONTRACT.md](file:///c:/Users/kifit/OneDrive/Documentos/GitHub/balls-2-5d2-rpg/docs/contracts/BATTLE_SYSTEM_CONTRACT.md) |
| **Player State**    | How to handle the Singleton, emitted events, and saving/loading.                 | [PLAYER_STATE_CONTRACT.md](file:///c:/Users/kifit/OneDrive/Documentos/GitHub/balls-2-5d2-rpg/docs/contracts/PLAYER_STATE_CONTRACT.md)   |
| **UI Design**       | Styling rules, glassmorphism, and React component standards.                     | [UI_DESIGN_CONTRACT.md](file:///c:/Users/kifit/OneDrive/Documentos/GitHub/balls-2-5d2-rpg/docs/contracts/UI_DESIGN_CONTRACT.md)         |
| **Map & 2.5D**      | Z-Levels, Dynamic Rendering, and Line of Sight.                                  | [MAP_SYSTEM_CONTRACT.md](file:///c:/Users/kifit/OneDrive/Documentos/GitHub/balls-2-5d2-rpg/docs/contracts/MAP_SYSTEM_CONTRACT.md)       |
| **Editor**          | Level Editor interactivity and Map Server serialization.                         | [EDITOR_CONTRACT.md](file:///c:/Users/kifit/OneDrive/Documentos/GitHub/balls-2-5d2-rpg/docs/contracts/EDITOR_CONTRACT.md)               |
| **Generator**       | Procedural generation algorithms (Cellular Automata).                            | [GENERATOR_CONTRACT.md](file:///c:/Users/kifit/OneDrive/Documentos/GitHub/balls-2-5d2-rpg/docs/contracts/GENERATOR_CONTRACT.md)         |
| **Benchmark**       | Automated benchmark/smoke execution, required checkpoints, and result reporting. | [BENCHMARK_CONTRACT.md](file:///c:/Users/kifit/OneDrive/Documentos/GitHub/balls-2-5d2-rpg/docs/contracts/BENCHMARK_CONTRACT.md)         |

## Maintenance Protocol

- **Creation:** When a new complex system is added, a new contract MUST be created.
- **Updates:** If a code change modifies a rule defined in a contract, the contract MUST be updated in the same PR/Task.
- **Feature Rule (Mandatory):** Every feature task MUST include contract maintenance as part of Definition of Done. The AI must proactively update affected contracts without requiring a separate user request.
- **Benchmark Rule (Mandatory):** Every feature that affects gameplay, UI flow, transitions, save/load, inventory, map interactions, or performance-sensitive systems MUST update `BENCHMARK_CONTRACT.md` and benchmark checkpoints in the same task.
- **Conflicts:** If a user request contradicts a contract, the AI must explicitly ask for clarification or propose a contract update.

## Delivery Checklist (PR/Task)

Every feature or bugfix task MUST pass this checklist before merge:

1. Relevant contracts were reviewed (`docs/PROJECT_CONTRACT.md` + affected files in `docs/contracts/`).
2. Contract updates were included in the same task when behavior/rules changed.
3. Benchmark impact was assessed and benchmark coverage was updated when required.
4. Validation commands were run according to impact (`npm run smoke:test`, `npm run benchmark:e2e`, `npm run build`, and/or `npm run ci`).
5. Runtime errors and warnings introduced by the change were addressed or explicitly documented.
6. Generated local artifacts/logs are not committed unless they are explicitly part of repository policy.
7. Task summary includes: scope, files touched, validation results, and residual risks.

If any item is not satisfied, the task is considered incomplete.

## Communication Standard

- All technical documentation is written in **English** for precision and consistency with the codebase.
- User communication can be in **Portuguese** or **English** as per user preference.
