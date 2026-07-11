# Regras de Design 3D — Obrigatório para IAs e Devs

**Status:** CANÔNICO · **Prioridade:** igual a contrato  
**Audiência:** qualquer IA ou humano que edite `src/three-d/**`, `geometry.worker.ts`, ou mapas 3D de playtest  
**Última revisão:** 2026-07-04

> Se você ignora este arquivo, o usuário terá que repetir as mesmas correções manualmente.  
> **Leia antes de implementar.** Não é sugestão — é decisão de produto já tomada.

Visão resumida: [PRODUCT_3D_VISION.md](./PRODUCT_3D_VISION.md)

---

## 1. Norte do produto (decisão fechada)

| Decisão | Significado |
|---------|-------------|
| **3D real, câmera top-down** | Mundo com volume (altura, queda, poços, andares). Câmera olha de cima; não é “2D com textura de chão”. |
| **Um mapa continental** | Vários andares BMS (`-2…0…+2`) no **mesmo** mapa — torres, dungeons, cavernas. |
| **Não refazer a engine** | Babylon + BMS + `PlayerState` continuam. Melhorar **organização** e **regras**, não jogar fora. |
| **3D é o runtime de produto** | `?slice3d=1` / app padrão. Phaser 2D é legado salvo regressão explícita. |

---

## 2. Regras obrigatórias (MUST)

### R1 — Oclusão de andar superior por raio de câmera

**Quando o herói está embaixo de geometria de um andar superior, esse andar (e todos acima) devem ficar invisíveis** — o herói **nunca** pode ficar escondido atrás do "teto".

A detecção usa o **raio `câmera → herói`**: para cada andar superior, calcula o ponto de interseção do raio com o piso do andar. Se o tile nessa interseção for sólido (`isStaticTileBlocking`) e o piso estiver acima da cabeça do herói, aquele andar é o nível de oclusão. Isso substitui a abordagem antiga que checava apenas o tile acima do herói — agora a oclusão respeita o ângulo real da câmera.

| Item | Onde |
|------|------|
| Detecção | `findUpperOcclusionLevel()` — interseção do raio `câmera→herói` com o piso de cada andar superior |
| Aplicação | `syncVerticalLevelVisibility()` — **única** função que define `mesh.visibility` / `setEnabled` por andar |
| Escopo | **Top-down only** — esconde **todos os chunks** dos andares `>= occludedFromLevel`. |
| Debug | `window.__slice3dVerticalVisibility.occludedFromLevel` |

**Teste manual:** `debug_sandbox` ou `debug_vertical` — ande sob torre/ponte no andar `0`; andar `+1` some completamente.

> **Por que ocultar o nível inteiro e não só o chunk?**  
> Oclusão parcial (só o chunk do herói) fazia o andar superior parecer "comido" — partes visíveis e invisíveis no mesmo nível, criando artefatos visuais estranhos. Oculta o nível inteiro garante consistência visual.

### R1a — Primeira pessoa: sem oclusão vertical

**No modo primeira pessoa, a oclusão R1 não se aplica.** Todos os andares do mapa são renderizados simultaneamente, limitados apenas pelo `camera.maxZ` (far clipping plane). A pilha vertical (`verticallyVisible`, escadas, buracos) é irrelevante — o jogador vê a estrutura completa independente de conexões entre andares.

| Item | Onde |
|------|------|
| Regra | `syncVerticalLevelVisibility()` usa `Object.keys(mapData.levels)` como `showLevels` quando `isFirstPerson === true` |
| Far plane | `firstPersonCamera.maxZ = 120` |
| Motivo | Qualquer filtragem de andar em primeira pessoa produce visibilidade quebrada (estruturas "cortadas") |

**Teste manual:** `?slice3d=1&map=debug_sandbox&fp=1` — olhe para cima em uma torre; todos os andares devem estar visíveis.

---

### R1b — Ocultação cirúrgica de paredes no raio (top-down)

**Paredes em andares visíveis (abaixo do nível de oclusão) que intersectam o raio `câmera → herói` devem ser ocultadas individualmente**, para que o herói nunca fique bloqueado por paredes de andares superiores que o usuário decidiu manter visíveis.

A visão geral do sistema de oclusão vertical no modo top-down:

1. **R1**: determina `occlusionStartLevel` — o primeiro andar (do mais baixo para o mais alto) cujo tile na interseção do raio com o piso é sólido. Esse andar e todos acima são ocultados por completo.
2. **R1b**: nos andares restantes (visíveis, abaixo de `occlusionStartLevel`), caminha os tiles ao longo do segmento 2D do raio dentro do volume de cada andar (piso ao teto) usando **DDA** (Digital Differential Analyzer). Para cada tile que é parede, oculta o mesh específico daquele tile.

| Item | Onde |
|------|------|
| Detecção | `hideWallsOnRay()` — 2D DDA do raio projetado no plano XZ de cada andar visível |
| Aplicação | `hideWallsOnRay()` chamada logo após `syncVerticalLevelVisibility()` no frame loop |
| Índice tile→mesh | `wallTileIndex: Map<"levelKey::tx_tz", Mesh>` — construído durante o carregamento dos chunks |
| Restauração | Meshes fora do raio no frame seguinte são restaurados (`visibility = 1, setEnabled(true)`), exceto se o andar inteiro foi ocultado por R1 |
| Escopo | **Top-down only** — primeira pessoa usa R1a (sem oclusão) |

**Pré-requisito técnico:** tiles bloqueantes (`isBlocking = true`) geram **um mesh individual por tile** no `geometry.worker.ts` (sufixo `@@tx_ty` no accumKey), permitindo ocultar uma parede sem afetar as demais no mesmo chunk. Tiles não bloqueantes (pisos, água, etc.) continuam mesclados por material como antes.

**Teste manual:** `?slice3d=1&map=debug_sandbox` — câmera em ângulo onde uma parede do andar `+2` fica entre a câmera e o herói no andar `0`. A parede deve desaparecer, mas o piso do andar `+2` continua visível.

---

### R2 — Oclusão ganha do culling

Existe **culling por coluna** (`VerticalLevelVisibility3D`) para performance.  
Se culling e oclusão conflitarem, **a oclusão sempre vence**.

**NUNCA** criar um segundo sistema que force `visibility = 1` em andares superiores depois da oclusão.

---

### R3 — Uma fonte de verdade para altura

Toda posição Y de ator (pés, água, queda) parte de **`TileSurfaceResolver`**.

| Pergunta | API |
|----------|-----|
| Onde é o chão? | `sampleTileSurface().surfaceY` |
| Onde ficam os pés? | `sampleActorFootY()` |
| Y final com água? | `sampleActorWorldY()` = pés + `sinkOffset` |

**Água:** pés ancoram na **borda do buraco (rim)**, não no fundo + `sinkOffset` (isso faz atravessar o chão).

---

### R4 — Água = buraco, não adesivo

| Certo | Errado |
|-------|--------|
| Geometria `water-hole` no worker (fundo + paredes) | Bloco/plano azul no chão |
| Superfície líquida shader só no rim | Chão mergulhado duplicado em `WaterEffectSystem` |
| `wat`/`wtr` = zona gameplay + buraco | Tile opaco que tapa o herói |

---

### R5 — Mudança de andar sincroniza estado

Ao mudar de andar (escada, rampa, queda):

- `activeLevel` no runtime
- `playerState.setCurrentLevel()`
- `applyActiveLevelChange()` — **usar sempre**, não atualizar só `player.position.y`

---

### R6 — Mapas de teste vertical

Antes de declarar feature vertical “pronta”, validar em:

| Mapa | URL |
|------|-----|
| `debug_sandbox` | `?slice3d=1&map=debug_sandbox` |
| `debug_vertical` | `?slice3d=1&map=debug_vertical` |

Regenerar: `npm run generate:debug-sandbox` / `npm run generate:debug-vertical`

---

### R7 — Escadas = geometria caminhável (natural)

Escadas (`stu`/`std`) são **degraus 3D**. O herói sobe/desce **andando**; o andar BMS segue a **altura dos pés** — sem teleporte na borda do tile.

| Certo | Errado |
|-------|--------|
| 8 degraus; mesh + `TileSurfaceResolver` alinhados | Blocos empilhados / rampa invisível |
| `inferLevelFromFootY` quando footY cruza o patamar | `probeStairLevelTransition` + snap de Z |
| Mapa: piso no desembarque do andar de cima (M2) | `std` no mesmo XZ do `stu` de baixo |

**Interação por clique** só para escada de corda — **não implementado**.

| Item | Onde |
|------|------|
| Geometria | `geometry.worker.ts` `buildStairVerts` |
| Altura dos pés | `StairConfig3D.sampleStairFootY` → `TileSurfaceResolver` |
| Troca de andar | `NaturalFloorLevel3D.inferLevelFromFootY` |
| Layout mínimo | [`STAIR_MAP_RULES.md`](./STAIR_MAP_RULES.md) |

---

## 3. Proibido (NEVER)

| # | Não faça | Por quê |
|---|----------|---------|
| N1 | Segundo loop que seta `mesh.visibility = 1` em todos os andares “visíveis” | Quebrou oclusão (regressão 2026-06) |
| N2 | `sampleWaterHoleBottomY` + `sinkOffset` para pés | Herói atravessa o fundo do poço |
| N3 | Chão plano de água por tile no worker | Parece Minecraft / grid |
| N4 | Assumir `.map[]` em níveis BMS | Crash binário |
| N5 | Escada/rampa sem testar `activeLevel` | Jogador em andar errado para colisão/água |
| N6 | Feature 3D grande sem extrair para módulo dedicado | Bootstrap `createSliceScene.ts` (1420 linhas). Extraia para `src/three-d/runtime/`, siga o padrão dos 31 módulos existentes. |
| N7 | Ignorar oclusão porque “é só otimização” | **É gameplay e legibilidade** — R1 + R1b são requisitos do usuário |
| N8 | Escada com clique, teleporte ou animação de elevador | Usuário quer degraus caminháveis estilo Doom |
| N9 | Restaurar paredes ocultas por R1b entre `syncVerticalLevelVisibility` e `hideWallsOnRay` | `hideWallsOnRay` roda **depois** de `syncVerticalLevelVisibility`; restaurar no meio quebra a oclusão cirúrgica |

---

## 4. Matriz de cuidado (arquivo → o que verificar)

| Se você mexer em… | Verifique obrigatoriamente… |
|-------------------|----------------------------|
| `syncVerticalLevelVisibility` / oclusão | Andar de cima some embaixo da torre; `occludedFromLevel` no console |
| `hideWallsOnRay` / `wallTileIndex` | Paredes no raio somem em top-down; não afetar primeira pessoa |
| `VerticalLevelVisibility3D` | Não reativar andares ocultos; performance em `debug_vertical` longe do poço |
| `TileSurfaceResolver` | Água, rampas, escadas, queda no sandbox |
| `WaterEffectSystem` / `water-hole` | Buraco visível, superfície no rim, herói não atravessa fundo |
| `VerticalTransition3D` | Rampa `rfu` e queda de borda |
| `StairConfig3D` / escadas | Degraus caminháveis; sem clique/teleporte |
| `geometry.worker.ts` | `tsc`, chunk load, z-fighting entre andares; per-tile meshes para blocking tiles |
| `generate-debug-*.js` | Regenerar JSON+bin; F5 no browser |
| `BillboardDepthConfig` | Sprite do herói **não** atrás da água nem do chão |

---

## 5. Checklist pré-implementação (IA)

Copie mentalmente antes de cada PR/tarefa 3D:

```
[ ] Li DESIGN_RULES_3D.md (este arquivo)
[ ] Li PRODUCT_3D_VISION.md se a tarefa mexe em verticalidade/água
[ ] Se mexo em visibility de mesh: uso só syncVerticalLevelVisibility?
[ ] Se mexo em altura Y: passa por TileSurfaceResolver?
[ ] Se mexo em água: buraco + superfície, sem chão extra?
[ ] Se mexo em andar: applyActiveLevelChange + teste escada/rampa?
[ ] Testei debug_sandbox ou debug_vertical in-game (ou expliquei por que não)
[ ] Atualizei doc/contrato afetado (não esperar o usuário pedir)
```

---

## 6. Decisões de design — log (não reabrir sem o usuário)

| Data | Decisão | Motivo |
|------|---------|--------|
| 2026-06 | Top-down permanece; FP só debug (`V`) | Produto = Diablo-like, não FPS |
| 2026-06 | Água = buraco Quake-style | Usuário rejeitou “adesivo no chão” |
| 2026-06 | `TileSurfaceResolver` central | Bugs de altura espalhados em 4 arquivos |
| 2026-06 | Culling por coluna + oclusão unificados | Performance sem matar legibilidade |
| 2026-06 | Mapas `debug_sandbox` + `debug_vertical` | Sandbox = conteúdo; vertical = stress de andares |
| 2026-07 | Oclusão R1 top-down = chunk do herói only; FP sem R1 | Remendos globais quebravam torre e FP — ver ENGINE_3D_STATE_AND_HARDENING |
| 2026-07 | Pés = topo do slab 0.32 (`floorSlabThickness`) | JSON height ≠ mesh 3D |
| 2026-07 | Oclusão R1 mudou de chunk-only → nível inteiro | Oclusão parcial (só chunk) deixava andar "comido"; esconder o nível inteiro dá consistência visual |

---

## 7. Arquitetura alvo (concluído — jul/2026)

```
createSliceScene.ts         → bootstrap & wiring (1420 linhas, -60% do original)
GameContext.ts              → interface central — estado, sistemas, callbacks
createGameContext.ts        → factory — 254 linhas, parametrizado
31 módulos extraídos        → cada <300 linhas, focado, testável
```

Ver `src/three-d/runtime/ARCHITECTURE.md` para o mapa completo.

Novos subsistemas: **extrair** de `createSliceScene.ts` como módulo dedicado, seguindo o padrão existente.

---

## 8. Referências cruzadas

| Doc | Conteúdo |
|-----|----------|
| [PRODUCT_3D_VISION.md](./PRODUCT_3D_VISION.md) | Visão em linguagem simples |
| [SLICE_RUNTIME.md](./SLICE_RUNTIME.md) | Loop, input, combate |
| [CHUNK_STREAMING_3D.md](./CHUNK_STREAMING_3D.md) | Chunks + culling |
| [WATER_SYSTEM_3D.md](./WATER_SYSTEM_3D.md) | Água |
| [ELEVATION_AND_TRANSITION_PLAN.md](./ELEVATION_AND_TRANSITION_PLAN.md) | Rampas, escadas |
| [ENGINE_3D_STATE_AND_HARDENING.md](./ENGINE_3D_STATE_AND_HARDENING.md) | **Estado, invariantes, plano de consolidação** |
| [STAIR_MAP_RULES.md](./STAIR_MAP_RULES.md) | Layout de escadas em mapas |
| [DEBUG_VERTICAL_MAP.md](../debug/DEBUG_VERTICAL_MAP.md) | Mapa stress vertical |
| [PERSPECTIVE_MODE_CONTRACT.md](../contracts/PERSPECTIVE_MODE_CONTRACT.md) | Câmera e eixos |

---

## 9. Mensagem para IAs futuras

O usuário já definiu estas regras em conversas anteriores.  
**Não trate como “nice to have”.**  
Se uma tarefa parece mais rápida violando R1–R7, **pare e escolha o caminho correto** ou pergunte ao usuário com a regra explícita em risco.

Em especial: **qualquer coisa acima da cabeça do herói deve escondê-la quando ele passar por baixo.** Sem exceção.
