# Documentation Audit & Backlog

**Propósito:** trabalhar **só documentação** — descrever o que o projeto **é hoje**, fechar lacunas canônicas e corrigir divergências doc ↔ código. **Não** é lista de prioridade de produto nem decisão “alpha vs depois”.

**Entrada canônica:** `docs/PROJECT_DOCUMENTATION_INDEX.md`  
**Fluxo de execução (quando houver código):** `docs/AI_RUNBOOK.md`

---

## Como usar este arquivo

1. Escolha **uma linha** da tabela §2 (domínio).
2. Leia os arquivos de implementação listados.
3. Escreva ou atualize o doc canônico até `status` virar `covered`.
4. Registre delta de comportamento em `docs/MECHANICS_DELTAS.md` **se** o doc descrever mudança recente ainda não registrada.
5. Atualize `.github/agent-runtime/contract-checklist.json` na próxima tarefa que tocar código.

Sessão típica com IA: *“Documenta o domínio X conforme DOCUMENTATION_AUDIT §2”* — sem replanejar escopo de jogo.

---

## 1. Estados de cobertura

| Estado | Significado |
| :--- | :--- |
| `covered` | Doc canônico existe e bate com o código atual |
| `partial` | Doc existe mas incompleto, desatualizado ou espalhado |
| `missing` | Comportamento relevante sem doc canônico |
| `divergent` | Doc e código contradizem; corrigir doc primeiro (protocolo no índice) |

---

## 2. Inventário por domínio

| Domínio | Doc(s) canônico(s) | Status | Lacuna / nota |
| :--- | :--- | :--- | :--- |
| Workflow IA | `AI_RUNBOOK.md`, `AI_READ_FIRST.md` | partial | `AI_READ_FIRST` ganhou sprites 3D; falta apontar `DOCUMENTATION_AUDIT` |
| Arquitetura | `ARCHITECTURE_MAP.md`, `ARCHITECTURE_OVERVIEW.md` | partial | Pouco detalhe em `src/three-d/**` vs `src/game/**` |
| BMS / mapas | `SYSTEM_BMS.md`, `MAP_SYSTEM_CONTRACT.md` | covered | — |
| Perspectiva 3D | `PERSPECTIVE_MODE_CONTRACT.md`, **`THREE_D_INTEGRATION_BLUEPRINT.md`** | covered | Atualizado 2026-06-17 |
| Runtime slice 3D | **`three-d/SLICE_RUNTIME.md`**, **`COMBAT_3D_PARITY.md`**, **`SAVE_LOAD_3D.md`**, **`CHUNK_STREAMING_3D.md`**, **`PLAYER_STATE_EVENTS_3D.md`**, `COMPATIBILITY_AUDIT.md` | covered | Contract patches menores pendentes |
| PlayerState bridge | `PLAYER_STATE_CONTRACT.md`, **`three-d/PLAYER_STATE_EVENTS_3D.md`** | partial | Tick 3D ainda não no contract |
| Combate | **`three-d/COMBAT_3D_PARITY.md`**, `BATTLE_SYSTEM_CONTRACT.md` | partial | Battle contract ainda stale vs runtimes |
| Save | **`three-d/SAVE_LOAD_3D.md`**, `SAVE_SYSTEM_CONTRACT.md` | covered | SL-01 load gap documentado |
| UI / HUD | `UI_DESIGN_CONTRACT.md`, **`THREE_D_INTEGRATION_BLUEPRINT.md` §2** | partial | Grimório/crosshair no blueprint; UI contract não |
| Mundo / geradores | `WORLD_MAP_CONTRACT.md`, **`world/MUNDI_P1_README.md`**, `MAP_MUNDI_3D_*.json` | covered | — |
| Sprites — direções | **`sprites/DIRECTION_CONVENTION.md`** | covered | Novo; manter como referência |
| Sprites — herói alpha | **`CHARACTER_VISUAL_SCOPE.md`** | covered | — |
| Sprites — herói equip (futuro) | `three-d/HERO_BODY_EQUIPMENT.md` | partial | Fase 2; escopo claro, implementação mínima |
| Sprites — inimigos 3D | **`three-d/ENEMY_SPRITE_RUNTIME.md`** | covered | goblin swap documentado no spec |
| Itens / ícones | `sprites/items/ITEM_VISUAL_PIPELINE.md`, `catalog.json` | covered | — |
| Geração PixelLab | `sprites/MODULAR_SPRITE_AND_NPC_GENERATION_GUIDE.md` | covered | §1.1 direções |
| Debug / playtest | **`debug/DEBUG_SANDBOX_MAP.md`** | covered | Layout `enemy_rooms` |
| Benchmark CI | `BENCHMARK_CONTRACT.md`, `smoke_test` | covered | — |
| Sprints / plano | `SPRINT_STATE.json`, `SPRINT_MASTER_PLAN.md` | **divergent** | Master plan sprint 17 ≠ state (mundi vs torres v2) |
| Deltas de mecânica | `MECHANICS_DELTAS.md` | partial | Falta delta formal: inimigo gerado, direção, sandbox rooms, item icons batch |
| Checklist agente | `contract-checklist.json` | **divergent** | Parado em S17-P1-05; não reflete docs sprites/debug recentes |

---

## 3. Fila sugerida só de documentação (ordem técnica)

**3D hub:** [`three-d/README.md`](./three-d/README.md) — backlog principal **concluído** (ver [`COMPATIBILITY_AUDIT.md`](./three-d/COMPATIBILITY_AUDIT.md) § Documentation backlog).

Pendências menores (não bloqueiam agentes no runtime 3D):

1. Patch `BATTLE_SYSTEM_CONTRACT.md` from `COMBAT_3D_PARITY.md`
2. Patch `PLAYER_STATE_CONTRACT.md` — 3D tick + container branch
3. Patch `MAP_SYSTEM_CONTRACT.md` — stairDir 3D
4. `THREE_D_MIGRATION_STRATEGY` — product status
5. Review `FLOATING_TEXT_SYSTEM_ANALYSIS.md` vs `ThreeDFloatingText`
6. Blood/VFX settings doc (`tgs_settings_blood`)
7. Reconciliar `SPRINT_MASTER_PLAN.md` ↔ `SPRINT_STATE.json`
8. Completar `MECHANICS_DELTAS.md` (§4 abaixo)

---

## 4. Trabalho recente ainda sem delta mecânico

Registrar em `MECHANICS_DELTAS.md` quando documentarmos o domínio (não bloqueia escrita do doc):

- Inimigos com sprite gerado (`goblin_lanceiro`, `GENERATED_SPRITE_*`, direção, ataque).
- `DIRECTION_CONVENTION.md` + swap east/west goblin.
- Debug sandbox layout `enemy_rooms` (substitui grid único).
- Ícones de itens batch / `catalog.json` (se ainda não delta completo).
- `CharacterVisualProfile` / remoção overlay elmo no corpo (se delta incompleto).

---

## 5. Template de sessão (copiar no chat)

```text
Modo: só documentação (DOCUMENTATION_AUDIT.md)
Domínio: [ex.: three-d/SLICE_RUNTIME]
Tarefa: ler [arquivos] e escrever/atualizar [doc]
Não: decidir escopo de produto, não implementar código
Saída: doc markdown + links no PROJECT_DOCUMENTATION_INDEX
```

---

## 6. Histórico de auditoria

| Data | Alteração |
| :--- | :--- |
| 2026-06-17 | Criação inicial do inventário pós-trabalho sprites/sandbox/direções |
| 2026-06-17 | **`three-d/SLICE_RUNTIME.md`** — runtime `createDebugSliceScene` canonical reference |
