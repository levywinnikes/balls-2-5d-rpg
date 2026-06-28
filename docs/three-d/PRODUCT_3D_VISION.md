# Visão 3D do Produto

**Regras obrigatórias e anti-padrões para IAs:** [DESIGN_RULES_3D.md](./DESIGN_RULES_3D.md) ← leia primeiro ao implementar.

**Para quem:** design, gameplay, programação.  
**Objetivo:** um RPG em **um mapa contínuo gigante**, 3D de verdade, câmera **top-down**.

---

## O que o jogador deve sentir

- Andar num **mundo com volume** — não um chão plano com figurinhas em cima.
- **Subir** morros, rampas, escadas, torres.
- **Cair** de lugares altos.
- **Afundar** na água e ver o fundo do poço.
- Entrar em **cavernas e dungeons** no subsolo (vários andares abaixo).
- Subir em **torres e estruturas** (vários andares acima).
- Tudo num **único mapa** — sem telas de loading entre andar e andar.

A câmera olha de cima (como Diablo ou Hades), mas o mundo funciona como Quake/Mario 64 por baixo: altura real, queda, volumes.

---

## Regras do mundo

| Conceito | Significado |
|----------|-------------|
| **Andar (level)** | Camada do mapa: `0` = chão, `-1` = subsolo, `+1` = andar de cima |
| **Tile** | Quadrado 1×1 do mapa; pode ser chão, parede, rampa, escada, água |
| **Altura do chão** | Onde o personagem **pisa** naquele tile |
| **Transição** | Escada ou rampa liga dois andares |
| **Água** | Buraco no terreno + superfície líquida; gameplay de wade/swim |
| **Vão (`...`)** | Buraco sem chão → queda para o andar de baixo |
| **Oclusão de andar superior** | **Obrigatório:** se o herói está embaixo de geometria do andar de cima, esse andar (e acima) **some** — o herói nunca fica escondido atrás do teto |

Implementação: `findUpperOcclusionLevel` + `syncVerticalLevelVisibility` em `createDebugSliceScene.ts`.  
Debug: `window.__slice3dVerticalVisibility.occludedFromLevel` (número do andar oculto ou `null`).

---

## O que já funciona (base)

- Mapas grandes com BMS binário e streaming por chunks.
- Vários andares no mesmo mapa (`-1`, `0`, `+1`…).
- Escadas entre andares, rampas locais, queda em vão.
- Água com poço + superfície animada.
- Estruturas acima somem/ficam transparentes quando o jogador está embaixo.

---

## O que estamos construindo agora

1. **Uma regra única de altura** (`TileSurfaceResolver`) — um lugar só decide “onde fica o chão e os pés”.
2. **Sandbox vertical** — torre (+1), subsolo (-1), lago, rampas no `debug_sandbox`.
3. **Organização do código** — tirar lógica do arquivo gigante, módulo por módulo.

---

## Próximas metas (ordem)

| Fase | Entrega |
|------|---------|
| **A** | Calculadora de altura + sandbox vertical ✅ em progresso |
| **B** | Rampas mudam de andar; queda de borda; escadas sincronizam level | ✅ sandbox |
| **C** | Renderização por coluna vertical (`VerticalLevelVisibility3D`) | ✅ |
| **C-map** | Mapa `debug_vertical` (5 andares) | ✅ |
| **D** | Biomas (floresta com morros, cidade com ladeiras, dungeon procedural) |

---

## Teste rápido

```
?slice3d=1&map=debug_sandbox
```

| Zona | Onde | O que testar |
|------|------|--------------|
| Oeste | Hub | Rampas e morro |
| Leste | Hub | Lago (buraco + água) |
| Norte | Hub | Escada `stu` → torre **ou** rampa dourada `rfu` (ande para **sul**) |
| Torre +1 | Sul da plataforma | Borda aberta — caia no hub (desative F se tiver trava de queda) |
| Sul | Hub | Escada → subsolo (andar -1) |

---

## Não é objetivo

- Trocar de engine (Unity/Godot) — Babylon + BMS continuam.
- Câmera livre estilo FPS como modo principal — FP é só debug (`V`).

**Referências técnicas:** [ELEVATION_AND_TRANSITION_PLAN.md](./ELEVATION_AND_TRANSITION_PLAN.md), [CHUNK_STREAMING_3D.md](./CHUNK_STREAMING_3D.md), [WATER_SYSTEM_3D.md](./WATER_SYSTEM_3D.md)
