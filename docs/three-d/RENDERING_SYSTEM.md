# Rendering System — Chunk geometry pipeline + entidades

**Status:** CANÔNICO  
**Última atualização:** 2026-07-14  
**Sistemas envolvidos:** `ChunkStreamSystem`, `geometry.worker`, `DoorSystem`, `PropStreamSystem`, `EnemyStreamSystem`

---

## 1. Visão geral

O mundo é renderizado em **duas camadas independentes**:

| Camada | Responsável | Grupo |
|---|---|---|
| **Chunk geometry** | `ChunkStreamSystem` → `geometry.worker` | Tiles do mapa (piso, parede, água, escada) |
| **Entidades** | `DoorSystem`, `PropStreamSystem`, `EnemyStreamSystem` | Portas, props, inimigos, itens |

As duas camadas **não se coordenam**. Cada uma renderiza no mesmo espaço 3D independentemente. Se houver overlap (ex: porta sobre tile de parede), ambos aparecem.

---

## 2. Pipeline de chunk geometry

```
ChunkStreamSystem.buildChunk()
  │
  ├── Itera tiles do chunk (16×16)
  │     ├── Lê symbol do binary cache
  │     ├── Lê tileDef do mapData
  │     └── Cria TileDescriptor:
  │           ├── geometryProfile → define forma 3D
  │           ├── height           → altura da geometria
  │           ├── levelOffsetY     → Y base do nível
  │           └── materialKey      → textura
  │
  ├── Envia array de TileDescriptor[] → geometry.worker
  │
  └── Worker processa cada tile:
        profile = geometryProfile || (isStair ? "stair" : "box")
        ├── "box"   → buildBoxVerts()        (parede 3D cheia)
        ├── "stair" → buildStairVerts()      (degraus)
        ├── "slab"  → buildFloorQuadVerts()  (piso fino)
        ├── "water-hole" → buildWaterHoleVerts()
        └── "ramp-*" → buildRampVerts()      (wedge inclinado)
```

### 2.1 Detalhe crítico: perfil padrão

Quando `geometryProfile` é **undefined** no TileDescriptor, o worker assume `"box"` (parede). Isso significa que tiles sem `geometryProfile` explícito viram **blocos sólidos**, mesmo que `renderAs === "floor"`.

**Correção aplicada:** `ChunkStreamSystem.buildChunk()` agora força `geometryProfile: "slab"` quando `tileDef.renderAs === "floor"`.

```typescript
// Linha 369 do ChunkStreamSystem.ts
geometryProfile: tileDef?.geometryProfile
  ?? (tileDef?.renderAs === "floor" ? "slab" : undefined)
```

### 2.2 Altura da geometria

Tiles com `renderAs === "floor"` usam `cfg.WALK_SURFACE` (0.32) como altura — mesma espessura da colisão. Outros tiles usam `resolveTileHeight()` que considera `tileDef.height` e `LEVEL_HEIGHT`.

---

## 3. Materiais

Cada tile tem um material visual resolvido por `cfg.getTileMaterial(symbol, tileDef)`. O material é cached por `materialKey = "${level}::${mat.name}"`.

Materiais são enviados ao worker via `addMat(materialKey, mat, level)`. O worker agrupa vértices com o mesmo `materialKey` em um único `GeometryGroup`. Cada grupo vira um `Mesh` no Babylon.

---

## 4. Entidades

Entidades são malhas 3D independentes do chunk geometry. Cada sistema gerencia seu próprio ciclo de vida:

| Sistema | Mesh | Posicionamento |
|---|---|---|
| `DoorSystem` | `MeshBuilder.CreateBox` (painel) | `tileCenter + baseY` |
| `PropStreamSystem` | `createPropBillboard` (sprite) | `resolveWorldAnchorY` |
| `EnemyStreamSystem` | `createEnemyVisual` (sprite) | `worldPos` |

Entidades e chunk geometry ocupam o **mesmo espaço 3D**. Se houver overlap (ex: porta sobre parede), ambos renderizam sem garantia de ordem.

---

## 5. Ordem de renderização

Babilon renderiza por `renderingGroupId` (0 → 1 → 2). Atualmente:

- Chunks: grupo 0 (padrão)
- Entidades: grupo 0 (padrão)

**Não há separação de grupos.** A ordem de renderização depende da ordem de criação dos meshes na cena. Chunks são criados durante `renderMapLevel` (bootstrap). Entidades são criadas durante `ensureLevelSeeded` (também bootstrap). Como ambas acontecem no mesmo frame, a ordem é imprevisível.

### 5.1 Como resolver overlap visual

Para garantir que entidades sempre renderizem **acima** dos chunks, definir `renderingGroupId = 1` nas entidades. **Cuidado:** testar visualmente antes de commitar — essa mudança afeta o jogo inteiro e pode causar bugs de transparência/z-order.

---

## 6. Perguntas frequentes

**P: Por que o piso da porta aparecia como "parede laranja"?**  
R: O tile `flr` tinha `renderAs: "floor"` mas `geometryProfile: undefined`. O worker defaultava para `"box"` (parede 3D cheia). Hoje o `ChunkStreamSystem` força `"slab"` para tiles com `renderAs === "floor"`.

**P: Por que não unificar chunk geometry e entidades num sistema só?**  
R: Performance. Chunk geometry é merged mesh (1 draw call por chunk, não 1 por tile). Entidades são objetos individuais com comportamento próprio (animação, interação). Separar é correto.

**P: Como adicionar um novo perfil de geometria?**  
R: 1) Adicionar ao union type em `geometry.worker.ts` 2) Adicionar `if (profile === "novo")` no worker 3) Se for usado por um tile type, mapear no `ChunkStreamSystem.buildChunk()`.
