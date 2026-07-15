# Level Transition System — Mudança de nível, snap de pé, efeitos colaterais

**Status:** CANÔNICO  
**Última atualização:** 2026-07-14  
**Sistemas envolvidos:** `LevelTransitionSystem`, `PlayerFallSystem`, `StreamOrchestrator`, `LevelBootstrap`

---

## 1. Visão geral

"Transição de nível" NÃO significa teleportar o jogador. Significa **atualizar sistemas de streaming** quando o jogador muda de nível (Y-derived).

O nível do jogador é **derivado** da posição Y (physics), nunca o contrário. A física move o jogador; o sistema de nível reage.

```
Física (tickPhysics) → Y muda
  ↓
checkLevelDrift (todo frame, leve)
  → applyActiveLevelChange (streaming side effects apenas)
  → NUNCA mexe em player.position
```

---

## 2. Componentes

### 2.1 checkLevelDrift — detecção de mudança

```typescript
// StreamOrchestrator.ts — chamado TODO FRAME do RenderSystem
checkLevelDrift(playerStateLevel: string): boolean {
  if (playerStateLevel !== currentLevel) {
    applyActiveLevelChange(playerStateLevel);  // streaming apenas
    seedLevel(playerStateLevel);               // conteúdo do novo nível
    return true;
  }
  return false;
}
```

**Contrato:** LEVE. Só streaming. NUNCA carrega mapa, NUNCA mexe em posição.

**⚠️ ERRO HISTÓRICO:** Este método já chamou `ensureMapLevelReady()` (bootstrap pesado) causando teleporte quando o jogador caía em buraco. Corrigido em 2026-07-14.

### 2.2 applyActiveLevelChange — efeitos colaterais

```typescript
// LevelTransitionSystem.ts
applyActiveLevelChange(newLevel: string): void {
  // Streaming
  playerState.setCurrentLevel(newLevel);
  WorldMapService.ensureLevelBuffer(newLevel);
  visibilitySystem.invalidateCache();
  chunkSystem.tick();

  // Conteúdo
  doorSystem.ensureLevelSeeded(newLevel);
  orchestrator.seedLevel(newLevel);
  orchestrator.seedAdjacentLevels(newLevel);
  enemySystem.syncStream(true);
  propSystem.syncStream(true);

  // Telemetria
  telemetryLogger.pushLogEvent("level.change", { from, to });
}
```

**Contrato:** NUNCA modifica `player.position`. Só streaming, UI, telemetria.

### 2.3 snapPlayerFootToActiveLevel — ancora pé no chão

```typescript
snapPlayerFootToActiveLevel(): void {
  const currentLevel = ctx.getCurrentLevel();
  const footY = /* query collision world for ground Y */;
  ctx.playerCtx.position.y = footY;
  ctx.verticalVelocity = 0;
  ctx.isGrounded = true;
}
```

Chamado durante bootstrap e respawn para garantir que o jogador está no chão do nível atual.

### 2.4 snapFootToGradedSurface — snap com água

Similar ao `snapPlayerFootToActiveLevel` mas considera superfícies aquáticas (sink offset). Usado pelo `syncLevelSideEffects`.

### 2.5 syncLevelSideEffects — reação a Y-derived change

```typescript
syncLevelSideEffects(): void {
  if (holeFallLandingLevel || isPlayerOverVoid) return;  // não durante queda
  if (levelTransitionCooldown > 0) return;
  if (currentLevel !== lastSideEffectLevel) {
    applyActiveLevelChange(currentLevel);
    snapFootToGradedSurface();
  }
}
```

Chamado no RenderSystem APÓS a física, só quando grounded e não em queda.

---

## 3. Bootstrap de nível (LevelBootstrap)

`ensureMapLevelReady` é **pesado** — chamado apenas no startup e respawn:

```
ensureMapLevelReady(level)
  ├── loadMapData()         // JSON, rebuild collision
  ├── ensureWorldMapReady() // binários, minimap, rebuild collision
  ├── doorSystem.ensureLevelSeeded()
  ├── renderMapLevel()      // chunk geometry
  ├── propSystem.ensureLevelSeeded()
  └── snapPlayerFootToActiveLevel()
```

**Contrato:** PESADO. Só startup e respawn. NUNCA chamar de `checkLevelDrift`.

---

## 4. Fluxo de queda em buraco (corrigido)

```
1. Jogador pisa em tile hole
2. tickPhysics → voidAction: begin_void_fall
3. holeFallLandingLevel = "-1", FALL_GRAVITY ativa
4. Jogador cai, Y diminui
5. checkLevelDrift → detecta nível mudou → applyActiveLevelChange (streaming)
6. queryFloor acha piso no nível -1 → jogador "land"
7. onGrounded → finishAirborneLanding → dano de queda
```

**Antes da correção:** passo 5 chamava `ensureMapLevelReady()` que resetava posição do jogador pro spawn.

---

## 5. Contratos

| Contrato | Detalhe |
|---|---|
| `checkLevelDrift` | Leve. Só streaming. Chamado todo frame. |
| `applyActiveLevelChange` | Nunca mexe em `player.position`. |
| `ensureMapLevelReady` | Pesado. Só startup/respawn. |
| `snapPlayerFootToActiveLevel` | Só Y. Ancora pé no chão do nível atual. |
| Nível do jogador | Derivado da física (Y). Nunca imposto. |
