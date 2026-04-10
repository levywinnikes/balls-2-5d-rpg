import Phaser from "phaser";

export class BloodSystem {
  private scene: Phaser.Scene;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // We use a white pixel texture for tinting. 
    if (!scene.textures.exists("blood_pixel")) {
        const graphics = scene.make.graphics({ x: 0, y: 0 });
        graphics.fillStyle(0xffffff);
        graphics.fillRect(0, 0, 4, 4); // 4x4 pixel particle
        graphics.generateTexture("blood_pixel", 4, 4);
    }

    // In Phaser 3.60+, add.particles returns an Emitter directly if using new syntax, 
    // or we might need to adjust.
    // Let's assume standardized Emitter usage.
    this.emitter = scene.add.particles(0, 0, "blood_pixel", {
        speed: 100,
        scale: { start: 1, end: 0 },
        blendMode: 'ADD',
        emitting: false
    });
    this.emitter.setDepth(5);
  }

  public emitBlood(x: number, y: number, damage: number, maxHp: number, color: number = 0xff0000) {
    if (damage <= 0) return;

    const percentage = damage / maxHp;
    let particleCount = 5;
    let speed = 50;
    let lifespan = 500;
    let scaleStart = 1;
    
    // Intensity Logic
    if (percentage > 1.0) {
        particleCount = 60;
        speed = 200;
        lifespan = 1000;
        scaleStart = 2.0;
    } else if (percentage > 0.5) {
        particleCount = 30;
        speed = 120;
        lifespan = 800;
        scaleStart = 1.5;
    } else if (percentage > 0.1) {
        particleCount = 15;
        speed = 80;
        lifespan = 600;
    } else {
        particleCount = 5;
        speed = 40;
        lifespan = 400;
    }

    // Emit using the shared emitter with dynamic config?
    // Phaser 3.60 allows emitParticleAt with config overrides or setConfig.
    // Ideally we create a temporary emitter for the burst if colors differ rapidly.
    // Or we just update the main emitter style and explode.
    // If multiple bloods happen same frame, last style wins. Acceptable for now.
    
    this.emitter.setConfig({
        speed: { min: speed * 0.5, max: speed * 1.5 },
        angle: { min: 0, max: 360 },
        scale: { start: scaleStart, end: 0.5 },
        alpha: { start: 1, end: 0 },
        lifespan: lifespan,
        tint: color,
        gravityY: 0,
        quantity: particleCount,
    });
    
    this.emitter.explode(particleCount, x, y);
  }

  // "Rastro de sangue" - stays for a while
  public emitPersistentBlood(x: number, y: number, color: number, count: number = 1, scale: number = 1.0, isOverkill: boolean = false) {
      const puddleCount = isOverkill ? count * 3 : count;
      const spread = isOverkill ? 100 : 20; // Spread further on ground if overkill

      this.emitter.setConfig({
          speed: 0, // Stationery on ground (fixed flying bug)
          scale: { start: 1.5 * scale, end: 1.2 * scale }, 
          alpha: { start: 0.8, end: 0 },
          lifespan: isOverkill ? 30000 : 20000, 
          tint: color,
          gravityY: 0,
          quantity: puddleCount,
          blendMode: 'NORMAL',
          emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, spread) } as any 
      });
      this.emitter.explode(puddleCount, x, y);
  }

  // "Despedaçar" - Shatter effect
  public emitShatter(x: number, y: number, color: number, isCharred: boolean = false) {
      // If charred, use black/dark grey for ash, and some orange for sparks
      const mainColor = isCharred ? 0x222222 : color;
      const count = isCharred ? 60 : 100;

      this.emitter.setConfig({
          speed: { min: 50, max: 300 },
          angle: { min: 0, max: 360 },
          scale: { start: 2.5, end: 0 },
          alpha: { start: 1, end: 0 },
          lifespan: 1500,
          tint: mainColor,
          gravityY: 0,
          quantity: count,
          blendMode: 'NORMAL'
      });
      this.emitter.explode(count, x, y);

      if (isCharred) {
          // Add Ember sparks
          this.emitter.setConfig({
              speed: { min: 100, max: 400 },
              scale: { start: 1.0, end: 0 },
              alpha: { start: 1, end: 0 },
              lifespan: 800,
              tint: 0xffaa00, // Orange Embers
              blendMode: 'ADD',
              quantity: 40
          });
          this.emitter.explode(40, x, y);
      }
  }

  // "Purpurina" - Rainbow glitter burst + persistent ground stains for Star Rune overkill
  public emitGlitter(x: number, y: number) {
      // Rainbow colors for the explosion
      const rainbowColors = [
          0xFF0000, // Red
          0xFF7700, // Orange
          0xFFDD00, // Yellow
          0x00FF44, // Green
          0x00BBFF, // Cyan/Blue
          0x5500FF, // Indigo
          0xFF00FF, // Magenta/Violet
      ];

      // Phase 1: Bright rainbow burst (ADD blend for glow)
      rainbowColors.forEach((color, i) => {
          this.emitter.setConfig({
              speed: { min: 100, max: 400 },
              angle: { min: (i * 51) % 360, max: ((i * 51) + 80) % 360 }, // Spread in sectors
              scale: { start: 2.5, end: 0 },
              alpha: { start: 1, end: 0 },
              lifespan: 1200,
              tint: color,
              gravityY: 60,
              quantity: 12,
              blendMode: 'ADD'
          });
          this.emitter.explode(12, x, y);
      });

      // Phase 2: Central white flash
      this.emitter.setConfig({
          speed: { min: 20, max: 150 },
          angle: { min: 0, max: 360 },
          scale: { start: 3.0, end: 0 },
          alpha: { start: 1, end: 0 },
          lifespan: 400,
          tint: 0xFFFFFF,
          gravityY: 0,
          quantity: 20,
          blendMode: 'ADD'
      });
      this.emitter.explode(20, x, y);

      // Phase 3: Persistent rainbow ground stains (NORMAL blend, long lifespan)
      rainbowColors.forEach((color) => {
          this.emitter.setConfig({
              speed: 0, // Stationary on ground
              scale: { start: 1.8, end: 1.0 },
              alpha: { start: 0.7, end: 0 },
              lifespan: 25000, // 25 seconds
              tint: color,
              gravityY: 0,
              quantity: 5,
              blendMode: 'NORMAL',
              emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 60) } as any
          });
          this.emitter.explode(5, x, y);
      });

      // Phase 4: Tiny sparkle twinkles lingering
      this.emitter.setConfig({
          speed: { min: 10, max: 50 },
          angle: { min: 0, max: 360 },
          scale: { start: 1.0, end: 0 },
          alpha: { start: 1, end: 0 },
          lifespan: 2000,
          tint: 0xFFFFFF,
          gravityY: -10, // Float up slightly
          quantity: 15,
          blendMode: 'ADD'
      });
      this.emitter.explode(15, x, y);
  }
}
