# THREE_D_INTEGRATION_BLUEPRINT (Cláusula Pétrea)

**Última atualização:** 2026-04-18

## 1. Recursos 2D Reutilizáveis (100% Compartilhados)

### 1.1 Componentes React Prontos

| Componente            | Arquivo                                     | Status                     | Uso 3D                                    |
| --------------------- | ------------------------------------------- | -------------------------- | ----------------------------------------- |
| `HUD`                 | `src/ui/HUD.tsx`                            | ✅ Canônico (runtime 2D)   | Reutilizar diretamente em ThreeDSliceView |
| `StatusWidget`        | `src/ui/components/StatusWidget.tsx`        | ✅ Canônico (parte do HUD) | Vem via `HUD`                             |
| `SkillProgressHUD`    | `src/ui/components/SkillProgressHUD.tsx`    | ✅ Completo                | Renderizar em ThreeDSliceView             |
| `LevelUpNotification` | `src/ui/components/LevelUpNotification.tsx` | ✅ Completo                | Renderizar em ThreeDSliceView             |
| `NotificationSystem`  | `src/ui/components/NotificationSystem.tsx`  | ✅ Completo                | Já integrado                              |

Nota: `src/ui/windows/StatusHUD.tsx` e uma janela legada e nao deve ser usada como HUD principal no slice 3D.

**Hook padrão de listener:**

```typescript
usePlayerState("eventName", getterFunction, defaultValue);
```

### 1.2 Efeitos Visuais (FloatingText)

| Classe         | Arquivo                            | Tipos Suportados             |
| -------------- | ---------------------------------- | ---------------------------- |
| `FloatingText` | `src/game/effects/FloatingText.ts` | Dano, Cura, Crítico, Ambient |
| `XPText`       | `src/game/effects/XPText.ts`       | XP (★ {xp} XP)               |

**Método de criação:**

```typescript
FloatingText.createDamageText(scene, x, y, damage, isCritical);
FloatingText.createText(scene, x, y, message, color, isCritical);
FloatingText.createAmbientText(scene, x, y, message);
new XPText(scene, x, y, xpAmount);
```

### 1.3 Sistema de Audio

| Método                  | Arquivo                            | Tipos Suportados          | Exato/Nova           |
| ----------------------- | ---------------------------------- | ------------------------- | -------------------- |
| `playFootstep(terrain)` | `src/game/systems/AudioManager.ts` | "floor", "grass", "stone" | Exato                |
| `playJump()`            | `src/game/systems/AudioManager.ts` | N/A                       | **NOVA** (adicionar) |
| `playAttack()`          | `src/game/systems/AudioManager.ts` | N/A                       | Exato                |
| `playCritical()`        | `src/game/systems/AudioManager.ts` | N/A                       | Exato                |
| `playPickup()`          | `src/game/systems/AudioManager.ts` | N/A                       | Exato                |
| `playLevelUp()`         | `src/game/systems/AudioManager.ts` | N/A                       | Exato                |
| `playEnemyDeath(type)`  | `src/game/systems/AudioManager.ts` | enemyType                 | Exato                |

### 1.4 Sistemas de Dano/Fórmulas

**Arquivo:** `src/game/systems/BattleSystem.ts`

**Pode ser importado diretamente:**

```typescript
import { BattleSystem } from "../../game/systems/BattleSystem";
```

**Fórmula exata (usada no 3D):**

```typescript
// Dano base
let damage = Math.max(1, attackRoll - Math.floor(defenseRoll / 2));

// Redução de armor (RANDOMIZADO)
const armor = player.getTotalArmor();
if (armor > 0) {
  const minReduction = Math.ceil(armor * 0.1);
  const armorReduction = Phaser.Math.Between(minReduction, armor);
  damage = Math.max(0, damage - armorReduction);
}

// Crítico
const isCritical = Random() * 100 <= player.getCriticalChance();
if (isCritical) {
  const critMultiplier = 1 + player.getCriticalDamageMultiplier();
  damage = Math.max(1, Math.round(damage * critMultiplier));
}
```

---

## 2. Runtime 3D Arquitetura

### 2.1 createDebugSliceScene.ts ("GameScene do 3D")

**Arquivo:** `src/three-d/runtime/createDebugSliceScene.ts`

**Responsabilidades:**

- ✅ Babylon.js scene setup (camera, lights, meshes)
- ✅ Player movimento + gravidade + jump
- ✅ Enemy spawning + AI + pathfinding
- ✅ Combat logic (applyPlayerAttackToEnemy, applyEnemyAttackToPlayer)
- ✅ Item pickup + persistence
- ✅ Audio calls (playFootstep, playAttack, playCritical)
- ⏭️ FloatingText event emission (novo)
- ⏭️ Jump audio differentiation (novo)

**Call sites críticos para integração:**

```typescript
// 1. Aplicar dano ao inimigo (L~540)
applyPlayerAttackToEnemy(enemy) {
  // ... calcula damage ...
  // EMITIR: PlayerState.emit("floatingText", {x, y, z, damage, isCritical})
}

// 2. Aplicar dano ao player (L~590)
applyEnemyAttackToPlayer(enemy, now) {
  // ... calcula damage ...
  // EMITIR: PlayerState.emit("floatingText", {x, y, z, damage, isCritical})
}

// 3. Jump audio (L~1000)
if (isGrounded) {
  verticalVelocity = jumpImpulse;
  isGrounded = false;
  // CHAMAR: audioManager.playJump() [em vez de playFootstep]
}
```

### 2.2 ThreeDSliceView.tsx (React Root)

**Arquivo:** `src/three-d/bootstrap/ThreeDSliceView.tsx`

**Responsabilidades atuais:**

- ✅ Renderiza canvas Babylon.js
- ✅ Renderiza HeroDashboard
- ✅ Renderiza NotificationSystem
- ✅ Renderiza WindowLayer

**Responsabilidades novas:**

- ⏭️ Renderizar StatusHUD (sempre visível)
- ⏭️ Renderizar SkillProgressHUD (sempre visível)
- ⏭️ Renderizar LevelUpNotification (sempre visível)
- ⏭️ Renderizar ThreeDFloatingText container (sempre visível)

---

## 3. Implementação de FloatingText 3D

### 3.1 Novo Componente: ThreeDFloatingText.tsx

**Caminho:** `src/three-d/runtime/ThreeDFloatingText.tsx`

**Responsabilidade:**

- Recebe evento `floatingText` de PlayerState
- Converte posição 3D world → tela 2D usando câmera Babylon
- Renderiza overlay React com estilos de FloatingText.ts
- Anima + auto-destroi após 1.2s

**Interface:**

```typescript
interface FloatingTextData {
  x: number; // World position
  y: number;
  z: number;
  damage?: number;
  message?: string;
  isCritical?: boolean;
  icon?: string;
  customColor?: string;
  isAmbient?: boolean;
}
```

**Fluxo:**

```
createDebugSliceScene.ts emite:
  PlayerState.emit("floatingText", {...})
    ↓
ThreeDSliceView.tsx listener:
  playerState.on("floatingText", handleFloatingText)
    ↓
ThreeDFloatingText.tsx renderiza:
  Overlay div com CSS animation
    ↓
Auto-destroi após 1.2s
```

---

## 4. Checklist de Integração (Ordem Exata)

### Fase 1: HUD Rendering

- [ ] Importar StatusHUD, SkillProgressHUD, LevelUpNotification em ThreeDSliceView.tsx
- [ ] Renderizá-los na JSX (fora da canvas)
- [ ] Validar que atualizam conforme PlayerState muda

### Fase 2: Audio Differentiation

- [ ] Adicionar `playJump()` método em AudioManager.ts
- [ ] Chamar `audioManager.playJump()` em createDebugSliceScene.ts (L~1000)
- [ ] Remover chamada `playFootstep()` para jump

### Fase 3: FloatingText 3D

- [ ] Criar `ThreeDFloatingText.tsx`
- [ ] Criar container listener em ThreeDSliceView.tsx
- [ ] Emitir eventos em createDebugSliceScene.ts:
  - L~540: applyPlayerAttackToEnemy → emit dano
  - L~590: applyEnemyAttackToPlayer → emit dano
  - L~720: destroyEnemy → emit XP
  - (Healing se aplicável)

### Fase 4: BattleSystem Import (Opcional)

- [ ] Importar BattleSystem.ts se lógica de dano divergir
- [ ] Usar BattleSystem.getDamage() em vez de reimplementar

### Fase 5: Validação

- [ ] `npm run build` → 0 errors
- [ ] `npm run benchmark:e2e` → 14/14 pass
- [ ] Testar 3D slice:
  - StatusHUD visível e atualiza
  - SkillProgressHUD atualiza com combate
  - LevelUpNotification dispara ao subir
  - Damage popups aparecem (dano/cura/crítico/xp)
  - Audio: footstep ≠ jump ≠ attack ≠ critical

---

## 5. Formato de Dados de FloatingText

### 5.1 Casos de Uso Principais

**Caso 1: Damage ao inimigo (Player ataca)**

```typescript
PlayerState.emit("floatingText", {
  x: enemy.worldPos.x,
  y: enemy.worldPos.y,
  z: enemy.worldPos.z,
  damage: 15,
  isCritical: true, // Se critical
  // Ícones automáticos:
  // - isCritical=true → Magenta + 1.2x scale
  // - damage > 0 → ❤ vermelho
});
```

**Caso 2: Damage ao player (Enemy ataca)**

```typescript
PlayerState.emit("floatingText", {
  x: player.position.x,
  y: player.position.y,
  z: player.position.z,
  damage: 5,
  isCritical: false,
  // ❤ vermelho padrão
});
```

**Caso 3: XP ao matar**

```typescript
PlayerState.emit("floatingText", {
  x: enemy.worldPos.x,
  y: enemy.worldPos.y,
  z: enemy.worldPos.z,
  message: `★ 50 XP`,
  customColor: "#F6E05E", // Ouro
  isAmbient: false, // 1.2s fade
});
```

**Caso 4: Skill XP (Strength, Dex, etc)**

```typescript
// Já emitido automaticamente por PlayerState
// Apenas escutar "strengthExperienceChanged", etc
// SkillProgressHUD já trata
```

---

## 6. Referência Rápida: O Que Já Existe

| Feature              | Local                    | Status                 |
| -------------------- | ------------------------ | ---------------------- |
| HP/MP/XP bars        | StatusHUD.tsx            | ✅ Pronto              |
| Skill XP tracking    | SkillProgressHUD.tsx     | ✅ Pronto              |
| Level up popup       | LevelUpNotification.tsx  | ✅ Pronto              |
| Damage popup styling | FloatingText.ts          | ✅ Pronto              |
| XP popup styling     | XPText.ts                | ✅ Pronto              |
| Audio effects        | AudioManager.ts          | ✅ Pronto (+ playJump) |
| Combat formulas      | BattleSystem.ts          | ✅ Pronto              |
| 3D runtime           | createDebugSliceScene.ts | ✅ Sólido              |

**NÃO precisa reimplementar nada. Apenas integrar.**

---

## 7. Validação Pós-Implementação

```bash
# Build
npm run build
# ✓ Should compile with 0 errors

# Benchmark (CRÍTICO)
npm run benchmark:e2e
# ✓ Should pass 14/14 steps

# Testes Manuais (3D slice)
1. Abrir 3D slice
2. Ver StatusHUD visível (HP/MP/XP)
3. Atacar inimigo
   - Damage popup aparece com ícone ❤
   - Audio diferente (attack vs critical)
   - SkillProgressHUD atualiza
   - Notification "Gained XP" no canto
4. Pular
   - Audio diferente de footstep
5. Subir de nível
   - LevelUpNotification popup (Skyrim-style)
6. Levar dano
   - Damage popup em player
```

---

**Próximo passo:** Implementar Phase 1 (HUD Rendering) → Phase 2 (Audio) → Phase 3 (FloatingText)
