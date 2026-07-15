# Collision System — Como o jogador e entidades interagem com o mundo 3D

**Status:** CANÔNICO  
**Última atualização:** 2026-07-14  
**Sistemas envolvidos:** `CollisionWorld`, `PlayerPhysicsSystem`, `isTileBlockedForGameplay`, `DoorSystem`, `PropStreamSystem`

---

## 1. Visão geral

A colisão no jogo tem **duas camadas** que se complementam:

| Camada | Responsável | Tipo |
|---|---|---|
| **Volumes estáticos** | `CollisionWorld` | Piso, parede, rampa, escada — derivado dos tiles do mapa |
| **Bloqueio dinâmico** | `isTileBlockedForGameplay` → `isBlockingTile` | Portas (aberta/fechada), props colidíveis |

O movimento do jogador (`blocked()`) consulta **ambas as camadas** a cada step.

---

## 2. Fluxo completo

```
Tile no mapa (.bin)
  ↓
CollisionWorld.rebuild()          ← chamado quando mapa carrega
  ↓
buildTileVolume(level, baseY, tx, tz)
  ├── void ("...") → sem volume
  ├── hole (id="hole") → sem volume (buraco)
  ├── water → buildWaterVolume()
  ├── stair → buildStairVolume()
  ├── ramp-* → buildRampVolume()
  ├── renderAs="floor" → buildFloorVolume()     [isWalkable: true]
  ├── renderAs="block" → buildBoxVolume()       [isWalkable: false]
  └── fallback → buildFloorVolume()
  ↓
volumes[] (array de CollisionVolume)
  ↓
query(x, z, footY, headY, levelKeys)  ← chamado a cada frame
  ↓
retorna { floor, ceiling }
  ↓
PlayerPhysicsSystem.blocked()
  ├── cw.isHorizontalBlocked()        ← camada 1: volumes estáticos
  └── q.isTileBlockedForGameplay()    ← camada 2: bloqueio dinâmico
  ↓
movimento permitido ou bloqueado
```

---

## 3. Volumes estáticos (CollisionWorld)

### 3.1 Construção

`CollisionWorld.rebuild(levelKeys, mapWidth, mapHeight)` itera todos os tiles de cada nível e chama `buildTileVolume` para cada um.

### 3.2 Tipos de volume

| Tile | Volume criado | Walkable |
|---|---|---|
| Void (`...`) | Nenhum | — |
| Hole (`id:"hole"`) | Nenhum | — |
| Floor (`renderAs:"floor"`) | `buildFloorVolume`: caixa fina `FLOOR_THICKNESS` | ✅ Sim |
| Wall (`renderAs:"block"`) | `buildBoxVolume`: caixa alta `WALL_HEIGHT` | ❌ Não |
| Stair | `buildStairVolume`: degraus | ✅ Sim |
| Ramp | `buildRampVolume`: wedge inclinado | ✅ Sim |
| Water | `buildWaterVolume`: superfície + parede do poço | ✅ Sim |

### 3.3 Consulta

```typescript
// Existe piso walkable abaixo do jogador?
const floor = collisionWorld.queryFloor(x, z, footY, headY, [level]);
// → { surfaceY, footY, level, isGraded }

// Existe parede bloqueando o movimento horizontal?
const blocked = collisionWorld.isHorizontalBlocked(x, z, footY, headY, radius, [level]);
// → boolean
```

---

## 4. Bloqueio dinâmico (isTileBlockedForGameplay)

### 4.1 O que é

Alguns tiles têm bloqueio que **não vem do CollisionWorld** — depende de estado runtime:

- **Porta fechada**: bloqueia. Porta aberta: libera.
- **Prop colidível** (árvore, pedra): sempre bloqueia.

### 4.2 Como funciona

```typescript
// createSliceScene.ts
const isTileBlockedForGameplay = (tileX, tileY) => {
  const symbol = getMapTileAt(getCurrentLevel(), tileX, tileY);
  const tileDef = symbol ? mapData.tileDefinitions?.[symbol] : undefined;

  // Porta: estado dinâmico (aberta/fechada)
  if (isBlockingTile(symbol, tileDef, { level, tileX, tileY })) {
    return true;
  }

  // Prop: colisível sempre
  return propSystem.isCollidableTile(getCurrentLevel(), tileX, tileY);
};
```

### 4.3 isBlockingTile

```typescript
// TileBlocking.ts
isBlockingTile(symbol, tileDef, { level, tileX, tileY })
  ├── doorSystem.getDoorAtTile(level, tileX, tileY)
  │     → se porta fechada → bloqueia
  │     → se porta aberta → libera
  ├── propSystem.isCollidableTile(level, tileX, tileY)
  │     → se prop colidível → bloqueia
  └── isStaticTileBlocking(symbol, tileDef)
        → parede, bloco → bloqueia
        → piso, água, void → libera
```

---

## 5. Movimento do jogador (blocked)

```typescript
// PlayerPhysicsSystem.ts
function blocked(x, z, footY, cw, keys, q, ctx, isFallSafetyEnabled) {
  // Camada 1: volumes estáticos (CollisionWorld)
  if (cw.isHorizontalBlocked(x, z, footY, headY, radius, keys)) return true;

  // Camada 2: bloqueio dinâmico (portas, props)
  const tx = Math.floor(x), tz = Math.floor(z);
  if (q.isTileBlockedForGameplay(tx, tz)) return true;

  // Camada 3: fall safety (só quando ativo)
  if (isFallSafetyEnabled && /* tile é void sem rampa abaixo */) return true;

  return false;
}
```

---

## 6. Perguntas frequentes

**P: Por que portas não tinham colisão antes?**  
R: Porque o `blocked()` só checava `isTileBlockedForGameplay` dentro do `isFallSafetyEnabled`. Movimento normal só usava `cw.isHorizontalBlocked()` — que vê porta como piso (walkable). O fix foi mover a checagem pra fora do `if (isFallSafetyEnabled)`.

**P: Por que o CollisionWorld não sabe sobre portas?**  
R: Por design. CollisionWorld lê geometria estática do mapa. Portas são entidades dinâmicas gerenciadas pelo DoorSystem. O `isTileBlockedForGameplay` faz a ponte entre os dois sistemas.

**P: Um tile de porta deveria ser tratado diferente pelo CollisionWorld?**  
R: Não. O CollisionWorld deve tratar o tile pelo que ele é (piso, parede). A lógica de "porta bloqueia quando fechada" é do DoorSystem, acessada via `isTileBlockedForGameplay`.

---

## 7. Contratos

| Contrato | Detalhe |
|---|---|
| CollisionWorld | Só lida com geometria estática. Não sabe sobre entidades. |
| isTileBlockedForGameplay | Única ponte entre geometria estática e bloqueio dinâmico. |
| blocked() | Deve SEMPRE consultar ambas as camadas (estática + dinâmica). |
| DoorSystem | Dono do estado da porta. `isBlockingTile()` é a API de consulta. |
