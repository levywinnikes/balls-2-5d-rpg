# Water System (3D Slice)

Scope: **3D slice only** (`?slice3d=1`).

## Core idea: water = buraco no terreno + superfície líquida

| System | Responsibility |
|--------|----------------|
| **Terrain (seco)** | Cobble, ramps, stairs — geometria normal |
| **Water hole** | `wat`/`wtr` geram perfil `water-hole` no worker (fundo + paredes internas) |
| **Liquid surface** | `WaterEffectSystem` — shader animado só na borda do buraco (rim) |
| **Gameplay** | `WaterProfile` / `WaterQuery3D` — wade, swim, sink |

```
  Chão seco (cobble)              Zona wat/wtr
  ──────────────────              ─────────────
  altura normal (rim Y)    →      ┌─────────────┐
                                  │ paredes     │
                                  │  fundo      │  ← geometria worker
                                  │ ~~~~~~~~~~~ │  ← superfície shader
                                  └─────────────┘
```

Como Quake/GoldSrc: o terreno tem um vão; a água preenche visualmente; dá para ver o fundo.

## Runtime

| Module | Role |
|--------|------|
| `WaterHoleConfig.ts` | Profundidade (`wtr` ~0.22u, `wat` ~0.42u), rim offset, máscara de paredes |
| `geometry.worker.ts` | Perfil `water-hole` — chão do poço + paredes onde vizinho é seco |
| `WaterEffectSystem.ts` | Superfície líquida merged (sem chão plano extra) |
| `GroundHeightQuery3D.ts` | Wrapper fino → `TileSurfaceResolver` |
| `TileSurfaceResolver.ts` | **Regra única** de altura (chão, pés, água) |
| `WaterProfile.ts` / `WaterQuery3D.ts` | Gameplay aquático |
| `AquaticSpriteShader.ts` | Tint no sprite submerso |

## Authoring

- `wat` → `id: "water"` — poço fundo (natação)
- `wtr` → `id: "water-shallow"` — poço raso (wading)
- Anel `wtr` + núcleo `wat` no sandbox (`scripts/generate-debug-sandbox-map.js`)
- Material do fundo/paredes: cobble (ou tile seco) do vizinho mais próximo

Ramps e buracos de terreno **sem** água continuam independentes — ver [ELEVATION_AND_TRANSITION_PLAN.md](./ELEVATION_AND_TRANSITION_PLAN.md).

## Test

`?slice3d=1&map=debug_sandbox` — lago a leste do hub.

Backlog: [PENDING_BACKLOG.json](./PENDING_BACKLOG.json)
