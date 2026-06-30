# 3D Combat Parity (`createDebugSliceScene`)

Canonical reference for **combat formulas and wiring** in the Babylon slice runtime.  
**Code:** `src/three-d/runtime/createDebugSliceScene.ts`  
**2D reference:** `src/game/systems/BattleSystem.ts`  
**Registry data:** `src/game/entities/EnemyRegistry.ts`, `EnemyMagicRegistry`, `RuneRegistry`

Related: [SLICE_RUNTIME.md](./SLICE_RUNTIME.md) §15–17, [ENEMY_SPRITE_RUNTIME.md](./ENEMY_SPRITE_RUNTIME.md), [../contracts/BATTLE_SYSTEM_CONTRACT.md](../contracts/BATTLE_SYSTEM_CONTRACT.md) (stale — see §10)

---

## 1. Scope

This document covers:

| Area | Functions |
| :--- | :--- |
| Player target selection | `setSelectedEnemy`, pointer pick |
| Player auto-melee | `tryAutoPlayerAttack`, `applyPlayerAttackToEnemy` |
| Enemy melee | `applyEnemyAttackToPlayer` |
| Enemy magic | `tryEnemyMagicAttack` |
| AI combat triggers | `updateEnemyAI` |
| Death / loot / XP | `destroyEnemy`, `grantEnemyLoot` |
| Runes | `castRune3d`, `castRuneAtTarget` |
| Line of sight | `hasLineOfSight` |
| Vitals tick | `playerState.update` (hunger, regen, buffs) |

**Out of scope:** chunk streaming, stairs, save format — see [SLICE_RUNTIME.md](./SLICE_RUNTIME.md).

---

## 2. Combat loop placement

Every frame (`scene.onBeforeRenderObservable`):

1. `playerState.update(now, deltaMs)` — S10-T1 parity with 2D `GameScene` tick  
2. `updateEnemyAI(deltaSeconds)` — chase, magic, melee, path  
3. `tryAutoPlayerAttack(Date.now())` — if an enemy is selected  

Player attacks are **not** left-click; top-down uses **right-click** to select, then auto-attack while in range + LOS.

---

## 3. Target selection

| Input | Top-down | FP debug (`V`) |
| :--- | :--- | :--- |
| Select enemy | Right-click pick → `metadata.sliceEnemyUid` | Left or right click from screen center |
| Clear selection | Right-click empty / enemy dies / leaves AI radius | Same |
| Visual | Emissive highlight + amber floor spot + **head chevron** (pulsing) | Same |

`setSelectedEnemy(uid)` clears previous highlight; `applyEnemyTargetVisual` runs each frame on the selected enemy.

Right-click also sets `pendingStairInteract = true` for stair transitions (see SLICE_RUNTIME §11).

---

## 4. Player auto-melee

### 4.1 Gate conditions (`tryAutoPlayerAttack`)

All must pass:

| Check | Source |
| :--- | :--- |
| `selectedEnemyUid` set | pointer pick |
| Enemy alive | `enemies` map |
| Cooldown | `equippedWeapon.cooldown ?? 1000` ms since `lastPlayerAttackAt` |
| Range | `Vector3.Distance` ≤ `weapon.range / 32` world units (default range 50 px → ~1.56 units) |
| Line of sight | `hasLineOfSight(player, enemy)` |

On success: `setHeroAnimState("attack", 320)` → `applyPlayerAttackToEnemy(enemy)`.

### 4.2 Unarmed (S10-T4)

No equipped weapon:

- `maxAttack = 5` (fixed roll ceiling)  
- Range still from `weapon?.range || 50` on the empty slot path in `getPlayerAttackRangeUnits` — effectively default 50 px unless overridden elsewhere  

---

## 5. Player melee formulas (`applyPlayerAttackToEnemy`)

Notation: `randomInt(a, b)` = inclusive integer roll.

### 5.1 Step order (3D)

| Step | Rule |
| :---: | :--- |
| 1 | `maxAttack = floor(getTotalAttack())` or **5** if unarmed |
| 2 | `attackRoll = randomInt(1, maxAttack)` |
| 3 | `defenseRoll = randomInt(1, enemy.definition.defense)` |
| 4 | **Block:** if `attackRoll <= defenseRoll` → fire partial block via `defenseResistances.fire`, else full block (🛡️, `playBlock`, return) |
| 5 | `initialDamage = randomInt(1, maxAttack)` — **separate roll** from step 2 (2D parity) |
| 6 | **Armor:** `reduction = randomInt(ceil(armor×0.1), armor)`; `damage = max(0, initialDamage - reduction)` |
| 7 | Apply fire **partial-block** mitigation: `damage × (1 - mitigation)` |
| 8 | If `damage <= 0` → armor block UI, return |
| 9 | **Fire weapon:** `damage × (1 - enemy.resistances.fire)` clamped ±95% |
| 10 | **Crit:** if `random×100 <= getCriticalChance()` → replace damage with `randomInt(maxAttack, floor(maxAttack×(1+critMult)))`; +100 STR/DEX XP; `playCritical` |
| 11 | Else `playAttack` |
| 12 | `enemy.health -= damage`; provoked |
| 13 | If dead → `destroyEnemy` with overkill / fire-kill context |
| 14 | Else skill XP (§7) |

### 5.2 Parity vs `BattleSystem.handlePlayerAttack`

| Aspect | 2D `BattleSystem` | 3D slice | Match? |
| :--- | :--- | :--- | :--- |
| Block rolls | `attackRoll` vs `defenseRoll` | Same | ✅ |
| Base damage roll | New `randomInt(1, maxAttack)` after block | Same | ✅ |
| Fire partial block | `defenseResistances.fire` | `enemy.definition.defenseResistances?.fire` | ✅ |
| Fire elemental resist | After base, before armor | After armor, before crit | ⚠ order |
| Armor reduction | `randomInt(ceil(armor×0.1), armor)` | Same formula | ✅ |
| Crit timing | Before armor | **After** armor + fire resist | ⚠ order |
| Crit range | `min=maxAttack`, `max=maxAttack×(1+critMult)` | Same | ✅ |
| Skill XP on hit | `gainCombatExperience(effectiveDamage)` | Uses raw `damage` (not capped by remaining HP) | ⚠ minor |
| Kill blood | Overkill > 50% max HP | Same threshold in `destroyEnemy` | ✅ |

---

## 6. Enemy melee (`applyEnemyAttackToPlayer`)

### 6.1 Cooldown and animation

- Respects `enemy.definition.cooldown` (default 1000 ms) via `lastAttackAt`  
- Sets attack anim lock: `getGeneratedAttackDurationMs(enemy.enemyType)`  

### 6.2 Fire attack detection

`isFireAttack` when:

- `enemy.enemyType === "dragon"`, or  
- any `definition.magicAttacks` id contains `"fire"` (case-insensitive)  

Used for **block behavior**, not only magic spells.

### 6.3 Step order (3D)

| Step | Rule |
| :---: | :--- |
| 1 | `attackRoll = randomInt(1, enemy.definition.damage)` |
| 2 | `defenseRoll = randomInt(1, playerState.getTotalDefense())` |
| 3 | **Block:** if `defenseRoll >= attackRoll` → fire partial via shield `defenseResistances.fire`, else full block + reflex XP (`defenseExp + attackRoll`) |
| 4 | `finalDamage = max(1, attackRoll - floor(defenseRoll/2))` |
| 5 | Apply partial-block mitigation |
| 6 | **Armor:** same roll formula as player vs enemy armor |
| 7 | If `finalDamage <= 0` → armor block, return |
| 8 | `playerState.takeDamage(finalDamage)` + popup + logs |

### 6.4 Parity vs `BattleSystem.handleEnemyAttack`

| Aspect | 2D | 3D | Match? |
| :--- | :--- | :--- | :--- |
| Block + reflex XP | Same formula | Same | ✅ |
| Base damage | `max(1, attackRoll - floor(def/defRoll))` | Same | ✅ |
| Player fire **resistance** after armor | `getPlayerElementResistance("fire")` | **Not applied** in melee path | ❌ gap |
| Player blood on hit | `BloodSystem.emitBlood` | `emitPlayerDamagePopup` + HUD event only | ⚠ partial |
| Magic spell damage | Separate systems | `tryEnemyMagicAttack` (§8) | see §8 |

---

## 7. Skill XP on player hit (non-lethal)

When enemy survives:

```text
totalCombatXp = floor(weaponBaseXp + flatBonus + damage × (1 + damagePercent/100))
```

| Weapon | Skill |
| :--- | :--- |
| Fire element | Intelligence |
| Unarmed / sword / axe / club | Strength |
| Distance | Dexterity |
| Other | Strength (fallback) |

Matches `BattleSystem.gainCombatExperience` routing. 2D caps XP damage component with `effectiveDamage = min(damage, enemyHp)`; 3D uses full rolled damage.

---

## 8. Enemy magic (`tryEnemyMagicAttack`)

Called from `updateEnemyAI` when chasing/provoked, **before** melee range check.

Per `magicAttacks[]` entry (`EnemyMagicRegistry`):

| Gate | Field |
| :--- | :--- |
| Per-spell cooldown | `magicDef.cooldown` + `enemy.magicCooldowns` |
| HP band | `minHpPercentage`, `maxHpPercentage` vs `health/maxHealth` |
| Range | `distancePx ≤ magicDef.range` (world distance × 32) |
| LOS | `hasLineOfSight` |
| Proc chance | `Math.random() ≤ magicDef.chance` |

On cast:

- Damage: `randomInt(magicDef.minDamage, magicDef.maxDamage)` — **flat**, no defense roll  
- `playerState.takeDamage(spellDamage)`  
- Floating 🔥 + `playFireHit`  
- No reflex XP, no armor roll (differs from 2D magic paths — verify per spell in 2D if extending parity)

---

## 9. Enemy AI combat fields (`updateEnemyAI`)

Distances in **world units** unless noted.

| `EnemyDefinition` field | Usage |
| :--- | :--- |
| `attackRange` | `/32` → melee range |
| `aggroRange` | start chase |
| `chaseRange` | de-aggro unless provoked; provoked ×1.5 |
| `speed` | path movement `/32 × 0.35` |
| `cooldown` | melee cooldown ms |
| `magicAttacks` | spell list |
| `defense`, `damage`, `armor`, resistances | combat formulas |

Constants in slice: `ENEMY_AI_RADIUS_UNITS`, `ENEMY_VISIBILITY_RADIUS_UNITS` (see SLICE_RUNTIME §14).

When in melee range + LOS: stop path, `faceEnemyToward` player, `applyEnemyAttackToPlayer`.

---

## 10. Death, loot, persistence (`destroyEnemy`)

| Step | Behavior |
| :--- | :--- |
| Blood | `tgs_settings_blood` localStorage; overkill (>50% max HP) → large burst + splash audio |
| Animation | `death` anim lock for `getGeneratedDeathDurationMs` |
| Despawn | `meshRoot.dispose` after death anim |
| Persist kill | `playerState.markEnemy3dDead(activeLevel, spawnKey)` |
| Loot | `EnemyRegistry.generateLoot` → `addPersistentDroppedItem` (pixel coords ×32) |
| XP | `gainExperience(definition.exp)` + ★ floating text |
| Audio | `playEnemyDeath(enemyType)` |

Only **`applyPlayerAttackToEnemy`** calls `destroyEnemy` today when HP ≤ 0.

---

## 11. Runes

### 11.1 Quick cast — `Q` (`castRune3d`)

| Rule | Value |
| :--- | :--- |
| Global cooldown | 1000 ms (`lastRuneCastAt`) |
| Rune source | `getEquippedRuneSlots()[activeRuneSlotIndex]` |
| Target | Selected enemy, else nearest alive within **8** world units |
| Projectile | Sphere mesh; speed/radius/color from `RuneRegistry.effect3d` |
| Damage | `RuneRegistry.calculateDamage(runeId, playerLevel, intLevel)` then random in `[min,max]` |
| Inventory | **Does not** decrement rune count |
| Kill | Sets `health`; calls **`destroyEnemy`** on lethal hit (loot, XP, persist) |

### 11.2 Slot cycle — `R` (`activeRuneSlotIndex`)

Cycles `0..2`, dispatches HUD update via `dispatchRuneSlotUpdate()`.

### 11.3 Grimório targeting — `castRuneAtTarget` (S11-T1)

| Event | Action |
| :--- | :--- |
| `prepareRuneCast(runeId)` | Enter targeting mode |
| Left-click enemy | Cast at picked `sliceEnemyUid` |
| `cancelRuneCast` | Exit targeting |

Same projectile/damage as Q. **Decrements** matching entry in `getEnchantedRunes()` and emits `runesUpdated`, `runeCasted`.

---

## 12. Line of sight (`hasLineOfSight`)

Bresenham ray on `navigationGrid` (same grid as pathfinding):

- `navigationGrid[y][x] === 1` → blocked  
- Start tile ignored; end tile not checked as blocked in loop  
- Out-of-grid endpoints → returns **true** (permissive)

Used by: player auto-attack, enemy melee, enemy magic.

---

## 13. Vitals and buffs (3D-20)

Each render frame:

```typescript
playerState.update(performance.now(), engine.getDeltaTime());
```

Same entry point as 2D `GameScene` — hunger decay, HP/mana regen, buff timers. No separate 3D combat tick.

---

## 14. Known gaps (factual — code today)

| ID | Issue | Impact |
| :--- | :--- | :--- |
| **C-01** | ~~Rune kill does not call `destroyEnemy`~~ | **Fixed** — `applyRuneDamageToEnemy` |
| **C-02** | Player fire **resistance** missing in `applyEnemyAttackToPlayer` | Fire melee/magic-from-definition may over-damage vs 2D |
| **C-03** | Crit vs armor **order** differs from 2D on player attacks | Edge-case damage numbers |
| **C-04** | `BATTLE_SYSTEM_CONTRACT.md` formulas | Contract text does not match either runtime (see §15) |
| **C-05** | `castRune3d` (Q) vs grimório | Q does not consume inventory; grimório does |

Fixing these is **implementation work**, not doc scope — track in `MECHANICS_DELTAS.md` when resolved.

---

## 15. Stale contract note

`docs/contracts/BATTLE_SYSTEM_CONTRACT.md` lists simplified formulas (e.g. `AttackRoll - DefenseRoll/2` for player, armor `×0.2`). **Do not use it for 3D or current 2D combat.** This document + `BattleSystem.ts` are authoritative until the contract is rewritten.

---

## 16. Quick reference — function map

```
pointer (right-click) → setSelectedEnemy
each frame:
  playerState.update
  updateEnemyAI
    tryEnemyMagicAttack?
    applyEnemyAttackToPlayer?
  tryAutoPlayerAttack → applyPlayerAttackToEnemy → destroyEnemy?

Q → castRune3d
R → cycle rune slot
prepareRuneCast → click → castRuneAtTarget
```

See also [SLICE_RUNTIME.md §15](./SLICE_RUNTIME.md#15-combat-player) (wiring) and [COMPATIBILITY_AUDIT.md](./COMPATIBILITY_AUDIT.md) rows 3D-16–20, 3D-23.
