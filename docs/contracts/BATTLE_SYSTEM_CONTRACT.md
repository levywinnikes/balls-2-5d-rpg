# Battle System Contract

## 1. Core Logic (`BattleSystem.ts`)
The battle system is tick-based but simulated in real-time within the Phaser update loop.

## 2. Damage Formulas
- **Player Attack Roll:** `min=1, max=WeaponDamage + (Strength * 0.5)`.
- **Defense Roll (Block):** `min=1, max=ShieldDefense + (Dexterity * 0.3)`.
- **Damage Dealt:** `InitialDamage = AttackRoll - (DefenseRoll / 2)`.
- **Armor Reduction:** `Reduction = Random(Armor * 0.2, Armor)`.
- **Final Damage:** `max(1, InitialDamage - Reduction)`.

## 3. Critical Hits
- **Chance:** Intelligence-based or flat chance from items.
- **Multiplier:** Default `1.5x`.

## 4. Visual Feedback
- **Damage Numbers:** Use `FloatingText` class in Phaser.
- **Colors:**
  - `White`: Physical damage.
  - `Red`: Critical damage.
  - `Green`: Healing.
  - `Blue`: Mana drain.
- **Blocked Attacks:** Must play a "Sparks" or "Shield hit" particle effect.

## 5. Loot & XP
- **XP Calculation:** Based on `EnemyDefinition.exp`. Divided among party members (if implemented).
- **Loot Table:** Read from `EnemyRegistry.ts`.
- **Loot Generation:** Must occur at the moment of death, before the enemy sprite is removed.
