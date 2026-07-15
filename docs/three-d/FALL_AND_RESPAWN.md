# Fall & Respawn System — Dano de queda, morte, renascimento

**Status:** CANÔNICO  
**Última atualização:** 2026-07-14  
**Sistema:** `PlayerFallSystem.ts`

---

## 1. Dano de queda

### 1.1 Fórmula

```
impactSpeed ≤ 8.0  → 0%   (pulo normal, seguro)
impactSpeed = 12   → 22%
impactSpeed = 16   → 44%
impactSpeed = 20   → 67%
impactSpeed ≥ 26   → 100% (fatal)
```

**Linear:** `(impactSpeed - 8.0) / 18.0`, clamp [0, 1].

### 1.2 Modificadores

- **Água:** `damagePercent *= computeFallDamageMultiplier(aquatic)` — reduz dano
- **Água profunda:** dano mínimo 0 (não 1)

### 1.3 Fluxo

```
tickPhysics → jogador aterrissa
  ↓
events.onGrounded(ctx, impactSpeed)
  ↓
finishAirborneLanding(level, footY, impactSpeed)
  ↓
impactSpeed < 8.0? → sem dano, só reseta fallOriginFootY
impactSpeed ≥ 8.0? → applyFallImpactDamage(impactSpeed, level)
  ↓
playerDied = playerState.takeDamage(damage)
  ↓
playerDied? → triggerPlayerDeathSequence()
```

---

## 2. Morte

```typescript
triggerPlayerDeathSequence(): void {
  ctx.isPlayerDeathSequenceActive = true;
  setHeroAnimState("death");
  ctx.playerDeathTimeoutId = setTimeout(() => {
    completePlayerRespawn();  // 2 segundos depois
  }, PLAYER_DEATH_SEQUENCE_MS);
}
```

A sequência de morte:
1. Flag `isPlayerDeathSequenceActive = true` (pausa input)
2. Animação de morte no herói
3. Após 2s: `completePlayerRespawn()`

---

## 3. Respawn

### 3.1 Ponto de spawn

```typescript
resolveRespawnSpawn()
  ├── 1. spawnPoint explícito (playerState.getSpawnPoint)
  │      └── Setado no world bootstrap, alterável por checkpoint
  ├── 2. Última posição segura (ctx.lastSafePlayerX/Z)
  └── 3. Fallback: playerPos do mapa ou (3.5, 5.5) no nível 0
```

### 3.2 completePlayerRespawn

```
completePlayerRespawn()
  ├── Reseta posição (playerCtx + player.position)
  ├── snapPlayerFootToActiveLevel()
  ├── Reseta física (verticalVelocity, isGrounded, holeFallLandingLevel)
  ├── Reseta fallOriginFootY = posição atual (evita loop de morte)
  ├── playerState.respawn() → recupera HP
  └── playerState.emit("playerRespawned")
```

### 3.3 Loop de morte (CORRIGIDO)

**Bug:** `fallOriginFootY` não era resetado no respawn. Após morrer de queda, o jogador renascia com `fallOriginFootY` do topo da queda anterior. Ao cair 0.1m do spawn, o cálculo `dropDistance = fallOriginFootY - landingY` dava vários andares → morte instantânea → loop infinito.

**Correção:** `completePlayerRespawn` agora reseta `fallOriginFootY = playerCtx.position.y`.

---

## 4. API pública

| Função | Uso |
|---|---|
| `calculateFallDamagePercent(speed)` | Física pura, exportada pra testes |
| `finishAirborneLanding(level, y, speed)` | Chamado pelo `onGrounded` |
| `resolveRespawnSpawn()` | Resolve posição de renascimento |
| `completePlayerRespawn()` | Executa o respawn completo |
| `triggerPlayerDeathSequence()` | Inicia sequência de morte |

---

## 5. Contratos

| Contrato | Detalhe |
|---|---|
| `fallOriginFootY` | Resetado em todo pouso e todo respawn |
| `isPlayerDeathSequenceActive` | Pausa input e render loop |
| `playerDeathTimeoutId` | Sempre limpo no dispose |
| Spawn point | `playerState.setSpawnPoint()` → aberto pra checkpoints futuros |
