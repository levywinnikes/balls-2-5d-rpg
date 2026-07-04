# Escadas — modelo natural (3D)

**Regra simples:** escada é **geometria 3D**. Você caminha nos degraus; o andar BMS muda quando a **altura dos pés** cruza o patamar do andar de cima/baixo. Sem teleporte, sem “clique para subir”.

---

## O que o jogador faz

1. Entra no tile `stu` ou `std`
2. Caminha (WASD) **como em qualquer rampa** — eixo **sul → norte** (degraus sobem/d descem ao caminhar para **norte**)
3. Os pés sobem/descem degrau a degrau
4. Quando os pés passam de ~2 m de altura (um andar), o jogo passa a usar o mapa `+1` ou `-1` — **sem mover X/Z**

---

## O que a engine faz

| Peça | Papel |
|------|--------|
| `geometry.worker.ts` | 8 degraus por tile (sul = baixo, norte = alto) |
| `StairConfig3D.sampleStairFootY` | Altura da superfície em cada ponto |
| `StairTraversal3D` | Caminhar na escada + cruzar borda norte → troca de map layer |
| `TileSurfaceResolver` | Pés colados na superfície (inclinada ou plana) |

### Comportamento (FPS clássico)

1. Escada = **superfície inclinada** — pés sobem/descem enquanto você caminha para **norte**.
2. Ao passar da **metade norte** do tile (`localZ ≤ 0.38`), o **map layer** muda (`stu` → +1, `std` → −1). Mesmo X/Z, sem teleporte.
3. Fora de escada, o layer segue a **altura dos pés** (~2 m por andar).

---

## Mapa — regras de layout

### Orientação (sempre)

```
Sul (porta / entrada) ............... y maior
        ↑ caminhar NORTE sobe/desce
Norte (saída da escada / patamar) ... y menor
```

Dentro do tile: `localZ` alto = sul (entrada), `localZ` baixo = norte (saída).

### Regras M1–M4

| # | Regra |
|---|--------|
| **M1** | Tile `stu`/`std` = 1×1 com degraus; **mesmo (X,Z) em todos os andares** do poço (shaft) |
| **M2** | No andar de **desembarque**, o tile do `stu`/`std` de baixo é **piso** (`cob`), não outra escada |
| **M3** | Torre multi-andar: subir continua em `(cx, landingZ)`; patamar = piso no andar de cima |
| **M4** | **Espaço físico:** tile **norte** do `stu`/`std` = **piso walkable** (nunca parede). Sala mínima **5×6** tiles |
| **M5** | **Abertura norte:** coluna do shaft `(cx, clearNorth…landingZ)` **sem parede norte** — alcova aberta pro hub, não poço fechado |

### M4 — por que existe (colisão)

A engine testa movimento **norte** com o tile vizinho ao **norte**. Se for `wal`, o herói **trava** no meio da escada — parece bug, mas é mapa.

Layout mínimo de shaft (vista lateral, sul embaixo):

```
  y=roomY+0   [ piso aberto — M5, conecta ao hub ]
  y=roomY+1   [ piso livre ]     ← clearNorthZ (M4)
  y=roomY+2   [ stu L0 / patamar L+1 ]  ← landingZ
  y=roomY+3   [ stu L+2+ / approach ]  ← continueUpZ (torres multi-andar)
  y=roomY+4   [ std L+1 ]                ← downZ (roomH≥6)
  y=roomY+5…  [ approach ]
  y=doorZ     [ porta sul ]      ← doorZ
```

Porão (L−1): patamar em `landingZ`; subir de volta via `stu` em `continueUpZ` (tile acima = piso em L0).

Gerador: `shaftRoomMetrics`, `carveShaftRoomOnBuffer`, `carveShaftTileOnBuffer`, `buildStackedTowerOnBuffers` em `scripts/generate-debug-sandbox-map.js`.

Validação: `node scripts/inspect-sandbox-stairs.js` (M2 + M4 + M5).

---

## O que ainda usa “gatilho” (exceções)

| Caso | Por quê |
|------|---------|
| Poço `hol` | Não há degraus — queda + pouso |
| Rampa `levelTransition` | Sobe 2 m num tile longo; transição na borda |

Escada normal **não** entra aqui.

---

## Teste (`debug_sandbox` hub)

Regenerar: `npm run generate:debug-sandbox` → **Ctrl+F5**

| Zona | Onde | O quê |
|------|------|--------|
| **Torre** | Leste do hub (carvalho na porta sul da sala) | Entrar pelo sul → caminhar **NORTE** no `stu` → patamar +1 → `std` mais ao sul desce |
| **Porão** | Oeste do hub (carvalho na porta sul) | Entrar pelo sul → caminhar **NORTE** no `std` → patamar −1 |
| **Stress** | Sul do mapa | Torre empilhada / cratera — não confundir com hub |

Coordenadas exatas após regerar: saída de `node scripts/inspect-sandbox-stairs.js` (secção *Hub L0 stairs*).

Hub L0 tem **exatamente uma** escada sobe e **uma** desce — salas dedicadas 7×6 (torre 8×6), nunca `stu`/`std` colados na parede norte.
