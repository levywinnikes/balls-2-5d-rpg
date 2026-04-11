# World & Biome System Contract (Regras de Mundo)

Este contrato define a estrutura geográfica, climática e de camadas para o Balls 2.5D RPG.

## 1. Camadas de Profundidade (Z-Levels)
A profundidade do mundo é dividida em níveis representados por strings numéricas no JSON.

| Nível | Bioma Principal | Regra Visual / Descrição |
| :--- | :--- | :--- |
| **2** | Sky Islands | Nuvens e ilhas flutuantes. Iluminação intensa. |
| **1** | Roofs / Highlands | Telhados de casas e picos de montanhas. |
| **0** | Surface (Térreo) | Florestas, Desertos, Neve, Pântanos. (Nível Inicial) |
| **-1** | Deep Caves | Túneis de pedra e depósitos minerais. |
| **-2** | Volcanic / Abyss | Lava e Basalto. Efeito de Calor (Overlay Vermelho). |

## 2. Biomas e Ecossistemas
Cada bioma possui um conjunto de tiles e inimigos permitidos.

### A. Floresta (Forest)
- **Tiles**: `grass`, `tree`, `grass-path`.
- **Inimigos**: `rat`, `goblin`.
- **Clima**: Temperado, sombras de nuvens frequentes.

### B. Montanhas (Mountains)
- **Tiles**: `mountain`, `rock`, `stone-wall`.
- **Inimigos**: `orc`, `dragon` (apenas em picos altos ou vulcões).
- **Clima**: Ventoso, sem nuvens.

### C. Deserto (Desert)
- **Tiles**: `sand`, `cactus` [NEW], `dry-rock` [NEW].
- **Inimigos**: `orc`, `sand-skeleton` [NEW Variant].
- **Clima**: Quente, overlay amarelado leve.

### D. Neve (Ice/Snow)
- **Tiles**: `snow` [NEW], `ice` [NEW], `frozen-tree` [NEW].
- **Inimigos**: `ice-goblin` [NEW Variant], `dragon`.
- **Clima**: Frio, overlay azulado, partículas de neve.

### E. Pântano (Misty Swamp)
- **Tiles**: `dirty_floor`, `water` (escuro), `mossy-rock`.
- **Inimigos**: `slime` [NEW], `rat`.
- **Clima**: Nevoeiro constante, visibilidade reduzida.

### F. Subterrâneo (Caves/Volcanic)
- **Tiles**: `cave-wall`, `lava` [NEW], `obsidian` [NEW].
- **Inimigos**: `skeleton`, `demon`, `dragon`.
- **Regra**: O calor aumenta a partir do nível -5.

## 3. Normas Arquitetônicas e Estruturas

Para garantir a coerência visual e funcional do mundo (Alpha 1), as seguintes regras de construção devem ser seguidas:

### A. Construção de Casas
- **Entrada**: Toda casa deve ter uma "porta" (espaço sem colisão) voltada para o Sul (`Front`).
- **Piso Interno**: Deve ser exclusivamente do tipo `floor` (madeira) no Nível 0.
- **Paredes**: Devem ser do tipo `house-wall` e cercar todo o perímetro interno.
- **Telhado**: Deve ser renderizado no Nível 1, cobrindo exatamente a área das paredes e do piso interno.

### B. Montanhas e Cavernas
- **Formação**: Montanhas devem ter bordas irregulares. Picos acima de Y=100 (Coordenada do Mapa) devem ter `snow` no topo.
- **Entradas de Caverna**: Devem usar o tile `stair_down`. Toda escada para baixo deve levar a um tile seguro (sem colisão) no nível inferior.

### C. Regras de Transição (Escadas)
Para evitar o loop infinito ("Ping-Pong de Teleporte"), aplicamos a **Regra do Salto de 1 Tile**:
- **Ao Subir (`stair_up`)**: O jogador é teleportado para o nível `Z+1` na posição `X, Y-1` (1 tile ao Norte da escada de destino).
- **Ao Descer (`stair_down`)**: O jogador é teleportado para o nível `Z-1` na posição `X, Y+1` (1 tile ao Sul da escada de destino).

## 4. Ecossistemas e Spawn de Inimigos
- Inimigos têm 80% de chance de spawnar em seu bioma nativo.
## 5. Map Structure & Formatting (Strict Rules)

To ensure performance and compatibility with the loading pipeline, the following rules are **NON-NEGOTIABLE**:

- **Format**: Maps must be a valid JSON containing a `levels` dictionary.
- **Grid Structure**: Each level's `map` MUST be a `string[][]` (array of string arrays).
- **Symbol Convention**: All tile and entity markers in the grid MUST use the **3-character symbol convention** defined in the map's `tiles` and `entities` dictionaries.
- **The Absolute Transparency Symbol (`...`)**:
  - The symbol `"..."` is reserved for the Engine to represent absolute transparency.
  - **Constraint**: It MUST NOT be defined in the `tiles` or `entities` dictionaries.
  - **Behavior**: If the grid cell contains `"..."`, the renderer skips the current level and searches for a tile in the level below.
- **Resolution Pipeline**:
  - **Grid Symbol**: Looked up in `tiles` or `entities`.
  - **The `id` field**: Must match a valid ID registered in `TileRegistry.ts`.
  - **The `under` field**: Can be a symbol or an ID.
  - **Special Case**: `under: "..."` allows a tile to be drawn AND trigger the transparency check for the floor beneath it.

### C. Entity Placement
*   **Grid-Based**: All permanent entities (Player spawn, chests, static enemies) **MUST** be symbols within the map grid.
*   **Mapping**: Entities must be defined in the `entities` object, linking the symbol to a `type` and an optional `id`.
    *   `type`: "player", "enemy", or "item".
    *   `under`: The tile symbol that exists beneath the entity.
