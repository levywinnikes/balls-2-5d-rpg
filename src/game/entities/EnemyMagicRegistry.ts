export interface EnemyMagicDefinition {
  id: string;
  name: string;
  minDamage: number;
  maxDamage: number;
  cooldown: number; // in ms
  chance: number; // 0.0 to 1.0 (probability per check)
  range: number; // pixels
  minHpPercentage?: number; // 0.0 to 1.0
  maxHpPercentage?: number; // 0.0 to 1.0
  type?: 'instant' | 'projectile';
}

export class EnemyMagicRegistry {
  private static magicAttacks: Map<string, EnemyMagicDefinition> = new Map();

  static registerMagic(def: EnemyMagicDefinition): void {
    if (this.magicAttacks.has(def.id)) {
      console.warn(`Magic attack with ID ${def.id} already registered. Overwriting.`);
    }
    this.magicAttacks.set(def.id, def);
  }

  static getMagic(id: string): EnemyMagicDefinition | undefined {
    return this.magicAttacks.get(id);
  }
}

export function registerDefaultMagics() {
  EnemyMagicRegistry.registerMagic({
    id: "rat_bite",
    name: "Rabies Bite",
    minDamage: 5,
    maxDamage: 10,
    cooldown: 5000,
    chance: 0.3,
    range: 64, // Close range
    type: 'instant'
  });

  EnemyMagicRegistry.registerMagic({
    id: "dragon_fire",
    name: "Fire Breath",
    minDamage: 50,
    maxDamage: 100,
    cooldown: 4000,
    // chance: 0.2, // 20% chance per tick when ready? No, logic is "check per frame". 20% per frame is HUGE.
    // Logic in Enemy.ts: "Checking per tick (60fps) with low chance is standard."
    // Wait, if I check every frame, 0.2 is 20% chance PER FRAME. That means it triggers almost instantly when cooldown is ready.
    // If I want it to be "sometimes" within the ready window, I should use a much lower chance like 0.01 (1% per frame ≈ 60% per second).
    // OR, I should change the logic in Enemy.ts to not check every frame, or use a "mean time to happen".
    // Let's use 0.02 (2% per frame).
    chance: 0.02, 
    range: 300,
    minHpPercentage: 0.2, // Enrages below 20%? Or always? Let's say always for now, but remove limit.
    type: 'instant' // Placeholder for now, eventually projectile
  });
}
