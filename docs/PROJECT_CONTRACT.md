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

| Contract | Purpose | Path |
| :--- | :--- | :--- |
| **Technical Stack** | Framework versions, folder structure, and runtime rules. | [TECHNICAL_STACK.md](file:///c:/Users/kifit/OneDrive/Documentos/GitHub/balls-2-5d2-rpg/docs/contracts/TECHNICAL_STACK.md) |
| **Battle System** | Damage formulas, turn order, and combat events. | [BATTLE_SYSTEM_CONTRACT.md](file:///c:/Users/kifit/OneDrive/Documentos/GitHub/balls-2-5d2-rpg/docs/contracts/BATTLE_SYSTEM_CONTRACT.md) |
| **Player State** | How to handle the Singleton, emitted events, and saving/loading. | [PLAYER_STATE_CONTRACT.md](file:///c:/Users/kifit/OneDrive/Documentos/GitHub/balls-2-5d2-rpg/docs/contracts/PLAYER_STATE_CONTRACT.md) |
| **UI Design** | Styling rules, glassmorphism, and React component standards. | [UI_DESIGN_CONTRACT.md](file:///c:/Users/kifit/OneDrive/Documentos/GitHub/balls-2-5d2-rpg/docs/contracts/UI_DESIGN_CONTRACT.md) |
| **Map & 2.5D** | Z-Levels, Dynamic Rendering, and Line of Sight. | [MAP_SYSTEM_CONTRACT.md](file:///c:/Users/kifit/OneDrive/Documentos/GitHub/balls-2-5d2-rpg/docs/contracts/MAP_SYSTEM_CONTRACT.md) |
| **Editor** | Level Editor interactivity and Map Server serialization. | [EDITOR_CONTRACT.md](file:///c:/Users/kifit/OneDrive/Documentos/GitHub/balls-2-5d2-rpg/docs/contracts/EDITOR_CONTRACT.md) |
| **Generator** | Procedural generation algorithms (Cellular Automata). | [GENERATOR_CONTRACT.md](file:///c:/Users/kifit/OneDrive/Documentos/GitHub/balls-2-5d2-rpg/docs/contracts/GENERATOR_CONTRACT.md) |

## Maintenance Protocol
- **Creation:** When a new complex system is added, a new contract MUST be created.
- **Updates:** If a code change modifies a rule defined in a contract, the contract MUST be updated in the same PR/Task.
- **Conflicts:** If a user request contradicts a contract, the AI must explicitly ask for clarification or propose a contract update.

## Communication Standard
- All technical documentation is written in **English** for precision and consistency with the codebase.
- User communication can be in **Portuguese** or **English** as per user preference.
