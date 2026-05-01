# FloatingText System - Análise de Recursos Reutilizáveis (2D → 3D)

## 1. Recursos Existentes no 2D

### 1.1 FloatingText.ts (`src/game/effects/FloatingText.ts`)

**Propósito:** Popup de dano/cura com animação float + escala + fade

**Recursos:**

- ✅ Suporta números (dano) e strings (mensagens)
- ✅ Suporta modo "crítico" (fonte 64px, animação scale pop 1.2x)
- ✅ Suporta ícones customizados (ex: 🔥, ❤, 💚)
- ✅ Suporta cores customizadas
- ✅ Suporta modo "ambient" (texto longo, fade 4s, mais sutil)
- ✅ Animação padrão: 1.2s float + fade + pop effect
- ✅ Ícones automáticos:
  - Dano negativo (`-X`) → ❤ (vermelho #FF3333)
  - Cura positiva (`+X`) → 💚 (verde #00AA00)

**Métodos estáticos:**

```typescript
FloatingText.createDamageText(scene, x, y, damage, isCritical?)
FloatingText.createText(scene, x, y, message, color?, isCritical?)
FloatingText.createAmbientText(scene, x, y, message)
```

**Estilo de texto:**

- Font: Arial, bold (normal para ambient)
- Cor: Vermelha crítico (#FF0000), branca padrão (#FF3333)
- Stroke: #000000 (6px padrão, 2px ambient)
- Depth: 99999999 (sempre na frente)

---

### 1.2 XPText.ts (`src/game/effects/XPText.ts`)

**Propósito:** Popup de experiência com estrela

**Recursos:**

- ✅ Formato fixo: `★ {xp} XP`
- ✅ Cor: Ouro/Amarelo (#F6E05E)
- ✅ Stroke: #000000 (6px)
- ✅ Font: Arial Bold 48px
- ✅ Animação: 1.2s float + fade + pop effect

**Uso:**

```typescript
new XPText(scene, x, y, xpAmount);
```

---

### 1.3 Uso em BattleSystem.ts

**Call sites existentes:**

```typescript
// Damage popup
new FloatingText(scene, enemy.x, enemy.y, damage, isCritical);

// XP popup
new XPText(scene, enemy.x, enemy.y, xpGained);

// Healing (if applicable)
new FloatingText(scene, player.x, player.y, healAmount, false, "#00AA00");

// Custom messages (ambient)
FloatingText.createAmbientText(scene, x, y, "Weak point hit!");
```

---

## 2. Estrutura 3D Existente

### 2.1 createDebugSliceScene.ts - "GameScene" do 3D

**Status:** ✅ Já é uma versão bastante sólida

**Características:**

- ✅ Inicia com intenção de ser um runtime completo (não debug)
- ✅ Contém lógica de combate completa (applyPlayerAttackToEnemy, applyEnemyAttackToPlayer)
- ✅ Sincronização com PlayerState (todos os eventos emitidos)
- ✅ Spawning de inimigos do mapa
- ✅ Pickup persistente de itens
- ✅ Sistema de IA (pathfinding, aggro, chase)
- ✅ Físicas básicas (gravidade, jump, colisões com limites)
- ✅ Câmeras (3ª pessoa + first person toggle)
- ✅ Áudio integrado (playFootstep, playAttack, playCritical, playPickup)

**O que NÃO tem:**

- ❌ FloatingText/damage numbers (só `playerState.log()`)
- ❌ StatusHUD/SkillProgressHUD/LevelUpNotification rendering
- ❌ Fórmula de dano com armor randomization (tem versão simplificada)

---

## 3. Plano de Implementação de FloatingText em 3D

### 3.1 Opções Tecnológicas

**Opção A: Overlay React (Simples, eficiente)**

- Criar componente `ThreeDFloatingText.tsx` em React
- Recebe posição 3D world → converte para tela 2D
- Renderiza como overlay CSS absoluto
- ✅ Reutiliza 100% da lógica visual de FloatingText
- ✅ Funciona com Babylon.js camera transforms
- ⚠️ Precisa de hook para sincronizar com câmera

**Opção B: Babylon.js TextBlock (Integrado, mais complexo)**

- Criar `ThreeDFloatingText.ts` em Babylon.js
- TextBlock como overlay texture
- ✅ Integrado ao pipeline de rendering 3D
- ⚠️ Menos flexível para estilos CSS

**Recomendação:** Opção A (React overlay) = mais simples, reutiliza estilos 100%.

---

### 3.2 FloatingText 3D - Implementação Proposta

**Arquivo novo:** `src/three-d/runtime/ThreeDFloatingText.tsx`

```typescript
// React component
// - Recebe: world position (x, y, z), damage/message, isCritical
// - Converte world → screen coords usando Babylon camera
// - Renderiza div absoluto com estilos de FloatingText.ts
// - Anima com CSS keyframes ou Framer Motion
// - Auto-destroi após 1.2s
```

**Integração em createDebugSliceScene.ts:**

```typescript
// Ao aplicar dano ao inimigo:
applyPlayerAttackToEnemy(enemy) {
  // ... lógica de dano ...
  emitFloatingText({
    position: enemy.worldPos,
    damage: damage,
    isCritical: isCritical
  });
}

// Emits event → React component pega e renderiza
```

---

### 3.3 Caminho de Dados

```
createDebugSliceScene.ts (Babylon.js)
  ↓
PlayerState.emit("floatingText", {x, y, z, damage, isCritical})
  ↓
ThreeDSliceView.tsx (React listener)
  ↓
ThreeDFloatingText.tsx (renderiza overlay)
  ↓
Desaparece após 1.2s
```

---

## 4. Ordem de Implementação

1. ✅ Entender FloatingText.ts (já feito)
2. ✅ Entender XPText.ts (já feito)
3. ⏭️ Criar `ThreeDFloatingText.tsx` (React overlay wrapper)
4. ⏭️ Integrar `PlayerState.emit("floatingText")` em createDebugSliceScene.ts
5. ⏭️ Wiring de listener em ThreeDSliceView.tsx
6. ⏭️ Testes de posicionamento/timing
7. ⏭️ StatusHUD/SkillProgressHUD/LevelUpNotification rendering (próximo passo)

---

## 5. Checksum de Recursos Disponíveis

| Recurso                         | Arquivo                                        | Status       | Reutilizável                          |
| ------------------------------- | ---------------------------------------------- | ------------ | ------------------------------------- |
| FloatingText class              | `src/game/effects/FloatingText.ts`             | ✅ Completo  | 100% (adaptar a Babylon camera)       |
| XPText class                    | `src/game/effects/XPText.ts`                   | ✅ Completo  | 100% (adaptar a Babylon camera)       |
| BattleSystem (damage formula)   | `src/game/systems/BattleSystem.ts`             | ✅ Existente | Pode ser importado direto             |
| PlayerState (events)            | `src/game/entities/Player/PlayerState.ts`      | ✅ Agnóstico | 100% sem mudanças                     |
| createDebugSliceScene (runtime) | `src/three-d/runtime/createDebugSliceScene.ts` | ✅ Sólido    | Base para integração                  |
| ThreeDSliceView (React root)    | `src/three-d/bootstrap/ThreeDSliceView.tsx`    | ✅ Existe    | Precisa agregar FloatingText listener |
