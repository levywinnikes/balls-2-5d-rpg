# Door System — Ciclo de vida, colisão, interação

**Status:** CANÔNICO  
**Última atualização:** 2026-07-14  
**Sistema:** `DoorSystem.ts`

---

## 1. Arquitetura

Portas são **entidades**, não tiles. O tile embaixo da porta é um tile normal (piso, parede) — o `DoorSystem` não sabe e não se importa com o tipo do tile.

```
Tile (piso/parede)     → CollisionWorld → volume estático
Entidade porta (dor)   → DoorSystem     → mesh 3D + estado dinâmico
                                       → isBlockingTile() → bloqueio dinâmico
```

A ponte entre os dois é `isTileBlockedForGameplay` → `isBlockingTile` → `doorSystem.isBlockingTile()`.

---

## 2. Ciclo de vida

### 2.1 Criação (ensureLevelSeeded)

Chamado durante bootstrap para cada nível com entidades `dor`:

```
ensureLevelSeeded(level)
  ├── Lê mapData.levels[level].entities
  ├── Filtra entityDef.type === "door"
  ├── resolveDoorOrientation (paredes adjacentes → hingeOnX/Side)
  ├── Cria mesh: MeshBuilder.CreateBox (painel da porta)
  ├── Registra no Map: doors.set(uuid) + doorByLevelTile.set(key, uuid)
  └── updateDoorVisual(door)
```

### 2.2 Posicionamento

```typescript
updateDoorVisual(door):
  floorTop = levelToWorldY(level) + FLOOR_THICKNESS
  centerY = floorTop + doorHeight / 2
  door.mesh.position = (tileCenterX, centerY, tileCenterZ)
  // Se aberta: rotaciona 90° e desloca pra hinge
```

### 2.3 Dimensões

- `DOOR_PANEL_HEIGHT = max(1.35, LEVEL_HEIGHT - FLOOR_THICKNESS)` = 1.68
- Largura: 0.96 (paralelo à parede) ou 0.14 (perpendicular)
- Posição Y: `baseY + FLOOR_THICKNESS` (topo do piso)

### 2.4 Destruição

```typescript
clear():
  doors.forEach(door → door.mesh.dispose(); material.dispose())
  doors.clear()
  doorByLevelTile.clear()
```

---

## 3. Colisão

### 3.1 Porta fechada → bloqueia

```
jogador tenta andar → blocked()
  → isTileBlockedForGameplay(tx, tz)
    → isBlockingTile(symbol, tileDef, {level, tileX, tileY})
      → doorSystem.getDoorAtTile(level, tileX, tileY)
        → porta existe? → isDoorOpenAtTile?
          → NÃO → bloqueia ✅
```

### 3.2 Porta aberta → libera

```
mesmo fluxo → isDoorOpenAtTile? → SIM → NÃO bloqueia → jogador passa ✅
```

### 3.3 Interação (abrir/fechar)

```typescript
interactDoorByUuid(uuid):
  state = getDoorState(uuid)
  if (state.locked) → emit "trancada"
  else → setDoorOpen(uuid, !state.open)
       → updateDoorVisual(door)
```

---

## 4. Visual

O mesh da porta é um `Box` (paralelepípedo) com cor derivada da parede (`wallColor.scale(0.9)`).

**Problema conhecido:** Se o tile embaixo da porta for parede (`wal`), o chunk geometry renderiza um bloco de parede no mesmo lugar. A porta fica escondida atrás da parede. Soluções possíveis:
- Mapa: usar tile `flr` (piso) nas posições de porta
- Engine: `renderingGroupId` (entidades no grupo 1, chunks no 0)

---

## 5. Orientação

`resolveDoorOrientation` verifica tiles adjacentes (N/S/E/W) procurando paredes. Se acha parede a leste ou oeste → `hingeOnX: true`. Se acha ao norte ou sul → `hingeOnX: false`.

---

## 6. Contratos

| Contrato | Detalhe |
|---|---|
| Porta é entidade | Não é tile. `DoorSystem` é dono do mesh e estado. |
| Tile embaixo | Pode ser qualquer coisa. `DoorSystem` não sabe/não liga. |
| Colisão | Via `isTileBlockedForGameplay` → `doorSystem.isBlockingTile()`. |
| Estado | Persistido no `PlayerState` (getDoorState/setDoorOpen). |
| Interação | Tecla E, raio de 1.55 tiles. |
