# Bootstrap Flow — Ordem de inicialização da engine

**Status:** CANÔNICO  
**Última atualização:** 2026-07-14

---

## 1. Ordem completa

```
createSliceScene(canvas)
│
├── 1. Babylon Engine + Scene
├── 2. Hero visuals (billboard, shadow, material)
├── 3. Streaming systems
│     ├── WaterEffectSystem
│     ├── WallRevealSystem
│     ├── PropStreamSystem
│     ├── EnemyStreamSystem
│     ├── DropStreamSystem
│     └── DoorSystem
├── 4. Orchestrator + Camera + TileMaterial + TelemetryLogger
├── 5. CollisionWorld + NavigationSystem + PathfindingManager
├── 6. PointerPickingSystem + ChunkStreamSystem
├── 7. GameContext (ctx = createGameContext({...}))
│     └── box() pattern: late-init systems wrapped em MutableStateBox
├── 8. Late-init systems (dependem de ctx)
│     ├── LevelTransitionSystem
│     ├── DamagePopupSystem
│     ├── GroundQuerySystem
│     ├── PlayerFallSystem
│     ├── SliceCombatSystem
│     ├── SliceEnemySystem
│     ├── DropPickupSystem
│     └── SliceInputManager
├── 9. void bootstrapWorldSession() — ASSÍNCRONO
│     ├── ensureMapLevelReady(currentLevel)
│     │     ├── loadMapData() → rebuild collision
│     │     ├── ensureWorldMapReady() → load binaries, minimap, rebuild
│     │     ├── doorSystem.ensureLevelSeeded()
│     │     ├── renderMapLevel() → chunk geometry
│     │     └── propSystem.ensureLevelSeeded()
│     └── worldBootstrapReady = true
├── 10. RenderSystem.attach() — inicia render loop
└── 11. return { engine, scene, save, dispose }
```

---

## 2. box() pattern

Sistemas criados na **fase 8** precisam de `ctx`, mas `ctx` é criado na **fase 7**. Como `ctx` precisa de referências a sistemas que ainda não existem, usa-se `MutableStateBox`:

```typescript
// Fase 7: ctx captura referência lazy
ctx = createGameContext({
  sliceCombatSystem: box(() => sliceCombatSystem, (v) => { sliceCombatSystem = v }),
});

// Fase 8: sistema é criado e atribuído
sliceCombatSystem = new SliceCombatSystem({ ctx });
```

O getter `ctx.sliceCombatSystem` resolve em runtime, após atribuição.

---

## 3. Assincronia

`void bootstrapWorldSession()` é fire-and-forget. O jogo inicia antes do bootstrap terminar. Durante o bootstrap:

- `worldBootstrapReady = false` → chunk system faz tick mínimo (spawn chunk)
- `worldBootstrapReady = true` → jogo totalmente funcional

O `worldReadyPromise` permite await externo (ex: loading screen).

---

## 4. Pontos críticos

### 4.1 TDZ (Temporal Dead Zone)

**⚠️ ERRO HISTÓRICO:** `ctx` era usado em closures antes da declaração `let ctx`. Causava `ReferenceError: Cannot access 'ctx' before initialization`. Corrigido movendo `void bootstrapWorldSession()` para depois da criação de `ctx`.

### 4.2 Ordem das fases 3-5

Sistemas de streaming (fase 3) e CollisionWorld (fase 5) precisam existir antes do bootstrap (fase 9). O bootstrap chama `loadMapData` que usa `collisionWorld.rebuild()` e sistemas de streaming para seedar conteúdo.

### 4.3 RenderSystem (fase 10)

Só inicia após ctx e todos os sistemas late-init existirem. O `renderSystem.attach()` registra o `onBeforeRenderObservable` que chama `tick()` todo frame.

---

## 5. Contratos

| Contrato | Detalhe |
|---|---|
| `ctx` | Criado na fase 7. Só usar após atribuição. |
| Late-init (fase 8) | Atribuir à variável `let` capturada pelo box(). |
| Bootstrap (fase 9) | Assíncrono. Não bloquear inicialização. |
| RenderSystem (fase 10) | Último a iniciar. Depende de tudo anterior. |
