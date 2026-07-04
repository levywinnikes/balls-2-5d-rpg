# Engine 3D — Análise de estado e plano de consolidação

**Status:** CANÔNICO · **Prioridade:** ler **antes** de implementar features ou remendos  
**Data:** 2026-07-03  
**Motivo:** remendos recentes (visibilidade, escadas, mapa) quebraram uns aos outros — precisamos congelar regras e endurecer a base.

**Audiência:** devs e IAs. Não é backlog de features; é **contrato técnico + ordem de trabalho**.

Docs relacionados: [DESIGN_RULES_3D.md](./DESIGN_RULES_3D.md), [PRODUCT_3D_VISION.md](./PRODUCT_3D_VISION.md), [STAIR_MAP_RULES.md](./STAIR_MAP_RULES.md), [COMPATIBILITY_AUDIT.md](./COMPATIBILITY_AUDIT.md)

---

## 1. Resumo executivo

A engine 3D **funciona em partes** (streaming, água, combate, BMS multi-andar), mas **não tem fronteiras claras** entre três problemas diferentes que foram tratados como um só:

| Problema | O que o jogador vê | Módulo responsável |
|----------|-------------------|-------------------|
| **A — Quais andares existem no mundo?** | Torres longe aparecem / somem | `resolveVerticalVisibleLevels` + chunks |
| **B — O teto esconde o herói (top-down)?** | Sprite atrás do telhado | R1 oclusão (`syncVerticalLevelVisibility`) |
| **C — Geometria bate com gameplay?** | Pés no chão, escadas sobem, portas na parede | `TileSurfaceResolver` + worker + **mapa** |

Remendos falharam porque misturaram **A, B e C** na mesma `if` (ex.: esconder nível +1 inteiro no mapa quando o herói está debaixo de um tile).

**Decisão de processo:** nenhuma mudança em visibilidade, escadas ou mapa até passar o **checklist §7** para a área tocada.

---

## 2. Mapa da arquitetura (como está hoje)

```
                    ┌─────────────────────────────────────┐
                    │     createDebugSliceScene.ts        │
                    │  (~7700 linhas — orquestrador)      │
                    └───────────┬─────────────────────────┘
        loop/input │           │ chunks / meshes
                   ▼           ▼
    PlayerState ◄──┤    geometry.worker.ts
    (level, HP)    │    (box, stair, ramp, water-hole)
                   │
    ┌──────────────┼──────────────┬──────────────────────┐
    ▼              ▼              ▼                      ▼
TileSurface   VerticalLevel   StairConfig3D      WaterEffectSystem
Resolver      Visibility3D    VerticalTransition3D
    │              │              │
    ▼              ▼              ▼
 foot Y         level keys      probeStair /
 ground         to mesh         ramp / hole
```

### 2.1 Constantes físicas (runtime — devem bater com worker)

| Constante | Valor | Onde | Notas |
|-----------|-------|------|-------|
| `LEVEL_HEIGHT_UNITS` | 2.0 | runtime + worker | Distância BMS entre andares |
| `FLOOR_SLAB_THICKNESS` | 0.32 | runtime + worker (chão) | Topo visual do ladrilho |
| `FLOOR_SURFACE_Y` | = espessura | runtime | Pés caminham no **topo** do slab |
| `DEFAULT_WALL_H` | ~1.999 | worker | Parede ≤ altura do andar |
| `DOOR_PANEL_HEIGHT` | ~1.60 | runtime | ≤ parede − piso |
| `STAIR_STEP_COUNT` | 8 | worker + StairConfig3D | Degraus por tile |
| `CHUNK_SIZE` | 16 tiles | runtime | Meshes **merged por chunk**, não por tile |

### 2.2 Mapa BMS

| Peça | Formato |
|------|---------|
| JSON | `tileAtlas`, `tileDefinitions`, `levels` |
| Binário | `{mapName}_{level}.bin` — 1 byte/tile |
| Geradores | `scripts/generate-debug-sandbox-map.js`, `generate-world-p1-macro-map.js` |

**Regra:** nunca editar bins à mão; regenerar com npm script.

---

## 3. Tensões estruturais (por que “conserta e quebra”)

### T1 — Granularidade: tile vs chunk vs level

| Decisão | Granularidade | Efeito |
|---------|---------------|--------|
| BMS / escadas / oclusão R1 | **1 tile (coluna XZ)** | Correta para gameplay |
| Mesh 3D | **chunk 16×16**, todos os tiles do **mesmo level** num buffer | Não dá para esconder 1 coluna de +1 sem esconder chunk inteiro |
| `resolveVerticalVisibleLevels` | **level key** (ex. `"1"`) | Se +1 entra no set, **todos** os chunks de +1 no raio são construídos |

**Consequência:** R1 “esconder andar +1” não pode significar “esconder o level +1 globalmente” — só faz sentido **no chunk do herói** (implementação atual) ou exige **geometria por coluna** (refactor grande).

### T2 — Top-down vs first-person

| Modo | Produto? | Oclusão R1 | Notas |
|------|----------|------------|-------|
| Top-down | **Sim** | Sim — peel no chunk do herói | Legibilidade do sprite |
| FP (`V`) | Debug | **Não** | Precisa ver teto, escadas, volume |

Qualquer oclusão aplicada em FP **quebra** subida de escada e FP debug.

### T3 — Três eixos de altura

1. **`tileDefinitions.height`** (JSON, ex. cob 0.06) — legado 2D  
2. **`FLOOR_SLAB_THICKNESS`** (0.32) — mesh 3D real  
3. **`TileSurfaceResolver.floorSlabThickness`** — pés do ator  

Se (2) e (3) divergem → herói “dentro do piso”. **Resolvido em 2026-07** via `floorSlabThickness`; manter sincronizado.

### T4 — Escada: geometria vs transição de andar

| Camada | Comportamento |
|--------|---------------|
| **Geometria** | 8 degraus caminháveis (Doom-style) — R7 |
| **Gameplay** | `probeStairLevelTransition` — troca `activeLevel` ao andar **norte** no tile |
| **Mapa** | Patamar `cob` no XZ do `stu` de baixo; `std` separado ≥4 tiles — [STAIR_MAP_RULES.md](./STAIR_MAP_RULES.md) |

Se o mapa desalinha L0/L+1 (salas com origens diferentes), a geometria parece certa mas **a transição falha** ou há vazio acima.

### T5 — Monólito `createDebugSliceScene.ts`

~7700 linhas concentram: física, visibilidade, combate, portas, AI, save, debug hooks.  
**Risco:** cada patch toca efeitos colaterais. Plano de extração em [DESIGN_RULES_3D.md §7](./DESIGN_RULES_3D.md) — **não empilhar** features no monólito sem extrair módulo.

---

## 4. Estado por subsistema (jul/2026)

### 4.1 Visibilidade vertical

| Peça | Estado | Problema conhecido |
|------|--------|-------------------|
| `resolveVerticalVisibleLevels` | Stack completo no raio | OK para “ver torre ao longe” |
| `resolveUpperOcclusionLevel` | Coluna do herói | OK |
| `syncVerticalLevelVisibility` top-down | R1 só no **chunk do herói** | Parcial: chunk 16×16 ainda esconde/mostra bloco grande |
| Peel heurístico +Z | **Removido** | Causava sumiço inconsistente |
| Peel “só coluna do herói” no level set | **Revertido** | Sumia torre inteira |

**Gap produto (aceito até refactor):** herói **atrás** de torre alta em top-down pode ainda ficar parcialmente coberto por chunks de +1 **fora** do chunk do herói. Solução correta = peel por coluna ou depth bias do sprite — **não** esconder levels inteiros.

**Debug:** `window.__slice3dVerticalVisibility`

### 4.2 Altura e física

| Peça | Estado |
|------|--------|
| `TileSurfaceResolver` | Fonte única — R3 |
| Pés vs mesh chão | Alinhados via `floorSlabThickness` 0.32 |
| Pulo / gravidade | Gravidade só no ar; pouso em `y <= footY` (sem snap 0.65 antecipado) |
| Dano de queda | Velocidade + distância vertical; pulo normal abaixo do limiar |

**Doc desatualizada:** [SYSTEMS_INVENTORY.md](./SYSTEMS_INVENTORY.md) ainda cita `Player ground offset 0.8` — corrigir quando atualizar inventário.

### 4.3 Escadas e transições

| Peça | Estado |
|------|--------|
| Worker `buildStairVerts` | OK |
| `probeStairLevelTransition` + segment probe | OK |
| Hub `debug_sandbox` | Salas `towerRoom` / `cellarRoom` alinhadas L0/L±1 (jul/2026) |
| Anexo stress | Torre + cratera + dungeon — **precisa validação manual** |
| Portas | Altura ajustada a parede (jul/2026) |

**Não implementado:** escada de corda / clique (R7).

### 4.4 Mapas de teste

| Mapa | Papel | Regenerar |
|------|-------|-----------|
| `debug_sandbox` | Menu Debug — hub + anexo stress | `npm run generate:debug-sandbox` |
| `debug_vertical` | Stress 5 andares dedicado | `npm run generate:debug-vertical` |
| `city_3d_mundi_p1` | Produto / mundo | scripts world p1 |

**Um mapa só (`debug_sandbox`)** concentra demais (inimigos, itens, vertical, stress) — dificulta isolar bugs. Manter `debug_vertical` para regressão **só vertical**.

---

## 5. Histórico de regressões (lições)

| Data | Mudança | Sintoma | Causa raiz |
|------|---------|---------|------------|
| 2026-07 | Snap pouso 0.65 u | “Teleporte” ao cair | Snap antecipado no ar |
| 2026-07 | `floorSlabThickness` | Pés dentro do piso | JSON height 0.06 vs mesh 0.32 |
| 2026-07 | Oclusão level +1 global | Vazio acima dentro da torre | R1 aplicada a **todo** mesh do level |
| 2026-07 | Upper levels só na coluna do herói | Torre sumiu ao longe | Level key removido do render set |
| 2026-07 | Peel chunk +Z sul | Comportamento aleatório | Heurística sem contrato |
| 2026-07 | `carveAlignedRoom` no eixo da escada | Escada/porta desalinhadas | L+1 centrado no tile errado |

---

## 6. Invariantes (contrato da engine)

Estas regras **não são negociáveis** sem atualizar este doc + DESIGN_RULES:

### I1 — Altura
- Todo `position.y` de ator passa por `TileSurfaceResolver`.
- `floorSlabThickness` runtime = espessura do box de chão no worker.

### I2 — Andar BMS
- Toda mudança de level usa `applyActiveLevelChange`.
- `PlayerState.currentLevel` = `activeLevel` do runtime.

### I3 — Visibilidade
- **Só** `syncVerticalLevelVisibility` altera `mesh.visibility` / `setEnabled` por andar.
- R1 **nunca** em FP.
- R1 top-down **nunca** esconde um level inteiro no mapa — só meshes no chunk do herói (até termos peel por coluna).

### I4 — Escadas (mapa)
- [STAIR_MAP_RULES.md](./STAIR_MAP_RULES.md) — geradores devem usar `carveShaftTileOnBuffer` / `buildStackedTowerOnBuffers` / padrão `buildHouse` do p1.

### I5 — Escadas (runtime)
- Transição ao caminhar **norte** (`localZ <= STAIR_TOP_EDGE_Z`).
- Sem teleporte / clique para `stu`/`std` normais.

### I6 — Mapas
- Regenerar após mudar gerador; Ctrl+F5 no browser.

---

## 7. Checklist antes de merge (3D)

Copiar na PR / sessão de IA:

```
Área tocada: [ ] visibilidade [ ] altura [ ] escadas [ ] mapa [ ] worker [ ] outro

[ ] Li ENGINE_3D_STATE_AND_HARDENING.md + DESIGN_RULES_3D.md
[ ] Identifiquei se o bug é A (stream), B (oclusão) ou C (geometria/mapa)
[ ] Não misturei esconder "level" com esconder "chunk" sem documentar
[ ] FP testado se mexe em visibility
[ ] Top-down testado: embaixo da torre / atrás da torre / dentro da torre
[ ] debug_sandbox regenerado (se mapa)
[ ] debug_vertical passou (se vertical)
[ ] window.__slice3dVerticalVisibility inspecionado
[ ] Docs atualizados (COMPATIBILITY_AUDIT / este arquivo se invariante mudou)
```

---

## 8. Plano de consolidação (ordem — sem features novas)

### Fase 0 — Congelar (agora)
- [x] Documento este arquivo
- [ ] **Parar** remendos de visibilidade até Fase 1
- [ ] Reverter qualquer mudança local não commitada que viole I3

### Fase 1 — Visibilidade (contrato fechado)
1. Escrever spec curta em `VerticalLevelVisibility3D.ts` (comentário + testes manuais)
2. Três cenários automatizados **manuais** documentados:
   - Embaixo do teto (hub L0 na torre) — telhado some **só** no chunk do herói
   - Atrás da torre — herói visível (aceitar limitação ou implementar sprite depth bias)
   - FP na torre — vê teto e patamar +1
3. **Opcional (refactor):** `renderingGroupId` hero acima de terreno em top-down — [BillboardDepthConfig.ts](../../src/three-d/runtime/BillboardDepthConfig.ts)

### Fase 2 — Vertical gameplay
1. Congelar layout hub em `debug_sandbox` — só mudar via STAIR_MAP_RULES
2. Validar `debug_vertical` end-to-end (5 andares)
3. Extrair `VerticalPhysics3D.ts` do monólito (pulo, queda, dano) — **sem mudar comportamento**

### Fase 3 — Mapas produto
1. `buildHouse` / `buildTower` do p1 como **única** API de shaft vertical
2. Remover layouts experimentais do anexo stress até passarem checklist
3. Regenerar `city_3d_mundi_p1` só após Fase 2 verde

### Fase 4 — Extração do monólito
Ordem sugerida: visibilidade → física vertical → transições → portas  
Cada extração = PR pequeno + checklist §7.

---

## 9. Matriz de teste manual mínima

| # | Mapa | Modo | Passos | Esperado |
|---|------|------|--------|----------|
| T1 | debug_sandbox | Top-down | Hub L0 torre leste, porta sul → norte → stu | Sobe para +1; patamar sólido |
| T2 | debug_sandbox | Top-down | +1 std sul-interior | Desce para L0 |
| T3 | debug_sandbox | Top-down | Porão oeste | std desce / stu sobe -1 |
| T4 | debug_sandbox | FP (V) | Mesma torre | Vê paredes/teto; transição funciona |
| T5 | debug_sandbox | Top-down | Atrás da torre (norte) | Herói legível (sprite não permanentemente oculto) |
| T6 | debug_sandbox | Top-down | Pulo no hub | Queda fluida, sem teleporte |
| T7 | debug_vertical | Ambos | Torre + poço documentados | Todos os andares transitáveis |
| T8 | debug_sandbox | Top-down | Porta câmara inimigo | Porta ≤ parede, abre/fecha |

---

## 10. O que NÃO fazer (anti-padrões)

| Não faça | Faça em vez disso |
|----------|-------------------|
| Esconder level `"1"` inteiro no render set | Chunk do herói ou refactor coluna |
| Peel por +Z / heurística de câmera sem spec | Spec em §8 Fase 1 + teste T5 |
| `carveAlignedRoom` centrado no tile da escada | Mesma `towerRoom {x,y,w,h}` em L0 e L+1 |
| Novo `.bat` / mapa debug separado | Incrementar `debug_sandbox` + STAIR_MAP_RULES |
| Patch em `createDebugSliceScene` > ~50 linhas sem extrair | PR pequeno ou novo módulo |
| Assumir FP = produto | Top-down é contrato; FP sem R1 |

---

## 11. Próximo passo recomendado

**Não implementar features** até:

1. Você validar **T1–T6** no build atual (Ctrl+F5 + menu Debug).
2. Anotar quais testes falham (screenshot + Z + modo).
3. Só então abrir **uma** tarefa por fase (ex.: “Fase 1 visibilidade” ou “Fase 2 escadas hub”).

Atualizar este doc quando um invariante mudar ou uma fase for concluída.
