# Debug Vertical Map (`debug_vertical`)

Mapa de **stress test** para mundo 3D vertical: torres, subsolo profundo, poços, lago e rampa de andar.

Relacionado: [PRODUCT_3D_VISION.md](../three-d/PRODUCT_3D_VISION.md), [CHUNK_STREAMING_3D.md](../three-d/CHUNK_STREAMING_3D.md)

---

## Andares

| Level | Nome | Conteúdo |
|-------|------|----------|
| **+2** | Topo da torre | Plataforma pequena + buraco sul (queda) |
| **+1** | Torre média | Sala ampla, escadas ↑↓, sacada sul |
| **0** | Superfície | Praça, torre norte, dungeon sul, lago leste, rampa oeste, poço central |
| **-1** | Dungeon | Catacumbas grandes + sala central + poço |
| **-2** | Caverna | Caverna com lago subterrâneo |

---

## Zonas (level 0 — spawn no centro)

| Direção | Feature | Como testar |
|---------|---------|-------------|
| **Norte** | Torre + `stu` | Sobe para +1 e +2 |
| **Sul** | Entrada dungeon + `std` | Desce para -1 |
| **Oeste** | Rampa dourada `rfu` | Ande para **sul** → +1 |
| **Leste** | Lago `wat`/`wtr` | Água com buraco |
| **Centro** | Poço 3×3 | Cai para -1 / -2 (desative F se tiver trava) |
| **+1 sul** | Sacada + void | Queda para superfície |

---

## Renderização inteligente (Fase C)

O runtime só **constrói/mostra** andares relevantes num raio de ~12 tiles ao redor do jogador.

No console do navegador:

```js
window.__slice3dVerticalVisibility
// { activeLevel, visibleLevels, totalLevels, columnRadius, ... }
```

Longe de poços/torres, andares distantes **não** são mesclados — reduz custo em mapas continentais.

---

## Como jogar

| Modo | Comando |
|------|---------|
| **Bat (Windows)** | `play-debug-vertical.bat` |
| **npm** | `npm run play:debug-vertical` |
| **URL** | `?slice3d=1&map=debug_vertical&autostart=1` |

Regenerar mapa:

```bash
npm run generate:debug-vertical
```

---

## Comparação com `debug_sandbox`

| Mapa | Foco |
|------|------|
| `debug_sandbox` | Todos itens/inimigos + demo vertical compacto no hub |
| `debug_vertical` | **Só** mundo vertical — 5 andares, sem galeria de loot |

Use `debug_vertical` para validar torres, poços, visibilidade por coluna e performance.
