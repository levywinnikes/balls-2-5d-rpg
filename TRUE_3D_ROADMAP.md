# True 3D Roadmap

## Filosofia

`activeLevel` é uma cache de `inferLevelFromFootY(player.position.y)` — ~93% dos seus usos
são trivialmente substituíveis pela chamada direta. A variável sobreviveu da arquitetura 2D
onde o nível (floor) era uma dimensão discreta do espaço do jogo, não uma coordenada contínua.

O objetivo é eliminar `activeLevel` como fonte de verdade, substituindo-a por:

```
playerLevel = inferLevelFromFootY(player.position.y)
```

A variável ainda existe como cache de desempenho (evita recomputar centenas de vezes por frame),
mas deixa de ser um "modo" que ramifica lógica de gameplay.

---

## Arquitetura Ideal

```
Player Y ──► inferLevelFromFootY() ──► playerLevel (cache, não fonte de verdade)
                 │
                 ├── Colisão horizontal: isHorizontalBlocked consulta TODOS os volumes
                 ├── Colisão vertical:   snapFootToGradedSurface consulta TODOS os volumes walkable
                 ├── Streaming:          carregar por distância 3D (não por level)
                 ├── Inimigos/Props:     spawn/despawn por distância 3D à câmera
                 ├── Portas:            interagir por distância 3D, visibilidade por Y
                 ├── Minimapa:          slice vertical contínuo centrado no Y do jogador
                 └── Salvar:            persistir (level, x, y, z) como tupla 3D
```

### Princípios

1. **Nível é derivado, não armazenado.** `playerLevel` é computado de `player.position.y`.
2. **Volumes não têm dono.** `queryFloor` varre todos os volumes sem filtro de level.
3. **Distância 3D > filtro de level.** Streaming, inimigos, props — decidir por distância euclidiana, não por level string.
4. **Colisão resolve tudo.** Sem depenetração baseada em definição de tile. `CollisionWorld` resolve empurrão.
5. **`activeLevel` vira `cachedPlayerLevel`.** Seta única, atualizada por `applyActiveLevelChange` (que vira event emitter puro).

---

## Plano de Migração

### Fase 1: Física e Movimento (~30 locais, alto impacto)

Objetivo: `snapFootToGradedSurface`, depenetração, `syncVerticalLevelFromMovement` não dependerem de `activeLevel`.

- `snapFootToGradedSurface`: remover parâmetro `sameLevelOnly` e o `level`. A função consulta TODOS os volumes walkable e snap para o melhor piso independente de nível.
- Depenetração (linhas 7382-7436): substituir grid 3x3 com `isBlockingTile` por `isHorizontalBlocked` do CollisionWorld. O pushout deve usar distância ao volume, não ao tile.
- `syncVerticalLevelFromMovement`: já usa `inferLevelFromFootY` (commit 23313a4). Apenas propagar.

### Fase 2: Streaming de Conteúdo (~20 locais, médio impacto)

Objetivo: inimigos, props, portas, drops — streamar por distância 3D.

- `syncEnemyStream`: em vez de `entry.level !== activeLevel`, comparar distância 3D do enemy ao jogador.
- `syncPropStream`: mesma lógica.
- Portas: `door.level !== activeLevel` → `Math.abs(doorY - playerY) < LEVEL_HEIGHT`.
- Dropped items: `getPersistentDroppedItems` sem filtro de level, filtrar por Y.

### Fase 3: Renderização e Visibilidade (~15 locais, médio impacto)

Objetivo: wall occlusion, camera, wall reveal — baseados em Y, não level.

- `getRenderableLevels`: em vez de `[activeLevel-1, activeLevel, activeLevel+1]`, computar stack vertical por Y do jogador e câmera.
- `hideWallsOnRay`: usar Y da câmera e do jogador para decidir quais paredes ocultar.
- Wall reveal system: passar Y bounds (Y - raio, Y + raio) em vez de level string.

### Fase 4: Purga do `activeLevel` (~5 locais, baixo impacto)

Objetivo: `activeLevel` vira `let cachedPlayerLevel` apenas para evitar recomputação.

- Remover todas as escritas em `activeLevel` (as ~5 mutações).
- `applyActiveLevelChange` vira event-only (não seta estado).
- `cachedPlayerLevel` só é lido, nunca escrito manualmente — atualizado automaticamente no frame loop.

## Status de Execução

| Fase | Status | Commit |
|------|--------|--------|
| Fase 1: Física e Movimento | ✅ Concluída | `f2d885e` |
| Fase 2: Streaming de Conteúdo | ✅ Concluída | `4de8a2d` |
| Fase 3: Renderização e Visibilidade | ✅ Já estava correta* | — |
| Fase 4: Purga do `activeLevel` | ⏳ Pendente | — |

*`hideWallsOnRay` e `getRenderableLevels` já usam Y da câmera/player via `levelToWorldY`. A referência a `parseLevelNumber(activeLevel)` é apenas para calcular o número de nível a partir do nível em cache — como `activeLevel` é atualizado por `inferLevelFromFootY`, o resultado é correto.

### Fase 4 — Notas

As 5 mutações reais de `activeLevel`:
- L453: inicialização (necessária, seed do estado)
- L1970: em `applyActiveLevelChange` (drive principal)
- L3986: em `ensureMapLevelReady` (bootstrap inicial)
- L5710: em `reanchorWorldContentOnLevel` / level change event
- L6597: em `applyHoleFallLanding` (queda em buraco)

Para Fase 4: `applyActiveLevelChange` deve virar event emitter puro — o setter
`activeLevel = newLevel` fica dentro do frame loop via `inferLevelFromFootY`,
não mais dentro do handler de transição. Isso requer separar o seeding de level
do setter de `activeLevel`.

