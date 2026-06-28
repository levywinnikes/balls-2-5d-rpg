# Regras de Design 3D — Obrigatório para IAs e Devs

**Status:** CANÔNICO · **Prioridade:** igual a contrato  
**Audiência:** qualquer IA ou humano que edite `src/three-d/**`, `geometry.worker.ts`, ou mapas 3D de playtest  
**Última revisão:** 2026-06-28

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

### R1 — Oclusão de andar superior

**Quando o herói está embaixo de geometria de um andar superior, esse andar (e todos acima) devem ficar invisíveis** — o herói **nunca** pode ficar escondido atrás do “teto”.

| Item | Onde |
|------|------|
| Detecção | `findUpperOcclusionLevel()` |
| Aplicação | `syncVerticalLevelVisibility()` — **única** função que define `mesh.visibility` / `setEnabled` por andar |
| Debug | `window.__slice3dVerticalVisibility.occludedFromLevel` |

**Teste manual:** `debug_sandbox` ou `debug_vertical` — ande sob torre/ponte no andar `0`; andar `+1` some.

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

### R7 — Escadas = geometria caminhável (estilo Doom)

Escadas normais (`stu`/`std`, `geometryProfile: "stair"`) são **degraus físicos** — o herói sobe/desce caminhando, como em qualquer FPS clássico.

| Certo | Errado |
|-------|--------|
| 8 degraus por tile; altura cumulativa no worker + `TileSurfaceResolver` | Blocos empilhados / rampa invisível |
| Troca de andar ao **caminhar para o norte** — subir (`stu`) e descer (`std`) usam o mesmo eixo | Descer indo ao sul / subir indo ao norte |
| `std` = mesh espelhado (sul = patamar do andar atual, norte = desce) | Mesma mesh de `stu` no andar de cima |
| `probeStairLevelTransition()` + `applyActiveLevelChange()` | `pendingStairInteract`, `isStairAnimActive` |

**Interação por clique** só para escadas de encosto (corda/escada de mão) — **não implementado ainda**; não reutilizar o fluxo de escada normal.

| Item | Onde |
|------|------|
| Geometria | `geometry.worker.ts` `buildStairVerts` |
| Altura dos pés | `StairConfig3D.sampleStairFootY` → `TileSurfaceResolver` |
| Troca de andar | `probeStairLevelTransition` em `createDebugSliceScene` |

**Arquitetura de mapa (escadas):**

| Regra | Motivo |
|-------|--------|
| Patamar (`cob`/`flr`) no tile onde `stu` de baixo desemboca | Nunca `std` empilhado no mesmo XZ do `stu` do andar inferior |
| Mínimo **4 tiles** entre `stu` e `std` no mesmo andar | Evita “subir para descer” |
| Torre e porão = **eixos separados** (ex.: torre leste, porão oeste) | Dois shafts no mesmo corredor confundem o jogador |

---

## 3. Proibido (NEVER)

| # | Não faça | Por quê |
|---|----------|---------|
| N1 | Segundo loop que seta `mesh.visibility = 1` em todos os andares “visíveis” | Quebrou oclusão (regressão 2026-06) |
| N2 | `sampleWaterHoleBottomY` + `sinkOffset` para pés | Herói atravessa o fundo do poço |
| N3 | Chão plano de água por tile no worker | Parece Minecraft / grid |
| N4 | Assumir `.map[]` em níveis BMS | Crash binário |
| N5 | Escada/rampa sem testar `activeLevel` | Jogador em andar errado para colisão/água |
| N6 | Feature 3D grande só dentro de `createDebugSliceScene.ts` sem plano de extração | Arquivo já ~6k linhas; cada feature fica mais cara |
| N7 | Ignorar oclusão porque “é só otimização” | **É gameplay e legibilidade** — requisito do usuário |
| N8 | Escada com clique, teleporte ou animação de elevador | Usuário quer degraus caminháveis estilo Doom |

---

## 4. Matriz de cuidado (arquivo → o que verificar)

| Se você mexer em… | Verifique obrigatoriamente… |
|-------------------|----------------------------|
| `syncVerticalLevelVisibility` / oclusão | Andar de cima some embaixo da torre; `occludedFromLevel` no console |
| `VerticalLevelVisibility3D` | Não reativar andares ocultos; performance em `debug_vertical` longe do poço |
| `TileSurfaceResolver` | Água, rampas, escadas, queda no sandbox |
| `WaterEffectSystem` / `water-hole` | Buraco visível, superfície no rim, herói não atravessa fundo |
| `VerticalTransition3D` | Rampa `rfu` e queda de borda |
| `StairConfig3D` / escadas | Degraus caminháveis; sem clique/teleporte |
| `geometry.worker.ts` | `tsc`, chunk load, z-fighting entre andares |
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
| 2026-06 | Escadas = degraus caminháveis, sem teleporte | Usuário rejeitou clique + “elevador” |

---

## 7. Arquitetura alvo (organização — em progresso)

```
createDebugSliceScene.ts   → orquestra loop (encolher com o tempo)
TileSurfaceResolver.ts     → altura (feito)
VerticalLevelVisibility3D.ts → quais andares mesclar (feito)
syncVerticalLevelVisibility  → visibilidade final (feito)
WaterEffectSystem.ts       → só superfície líquida
geometry.worker.ts         → geometria por perfil (water-hole, ramp, stair…)
```

Novos subsistemas: **extrair** de `createDebugSliceScene.ts`, não empilhar.

---

## 8. Referências cruzadas

| Doc | Conteúdo |
|-----|----------|
| [PRODUCT_3D_VISION.md](./PRODUCT_3D_VISION.md) | Visão em linguagem simples |
| [SLICE_RUNTIME.md](./SLICE_RUNTIME.md) | Loop, input, combate |
| [CHUNK_STREAMING_3D.md](./CHUNK_STREAMING_3D.md) | Chunks + culling |
| [WATER_SYSTEM_3D.md](./WATER_SYSTEM_3D.md) | Água |
| [ELEVATION_AND_TRANSITION_PLAN.md](./ELEVATION_AND_TRANSITION_PLAN.md) | Rampas, escadas |
| [DEBUG_VERTICAL_MAP.md](../debug/DEBUG_VERTICAL_MAP.md) | Mapa stress vertical |
| [PERSPECTIVE_MODE_CONTRACT.md](../contracts/PERSPECTIVE_MODE_CONTRACT.md) | Câmera e eixos |

---

## 9. Mensagem para IAs futuras

O usuário já definiu estas regras em conversas anteriores.  
**Não trate como “nice to have”.**  
Se uma tarefa parece mais rápida violando R1–R7, **pare e escolha o caminho correto** ou pergunte ao usuário com a regra explícita em risco.

Em especial: **qualquer coisa acima da cabeça do herói deve escondê-la quando ele passar por baixo.** Sem exceção.
