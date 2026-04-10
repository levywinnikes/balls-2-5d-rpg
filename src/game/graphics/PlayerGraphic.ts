import Phaser from "phaser";

export class PlayerGraphic {
  static readonly TEXTURE_KEY = "hero_peasant";
  // New Sprite Dimensions: 1312 x 3268 (4 cols, 10 rows)
  private static readonly FRAME_WIDTH = 328; 
  private static readonly FRAME_HEIGHT = 326.8;

  static preload(scene: Phaser.Scene): void {
    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      scene.load.spritesheet(this.TEXTURE_KEY, "assets/sprites/hero_peasant.png", {
        frameWidth: this.FRAME_WIDTH,
        frameHeight: this.FRAME_HEIGHT,
      });
    }
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number
  ): Phaser.Physics.Arcade.Sprite {
    // Ensure texture is loaded (if not preloaded)
    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      // Fallback or warning - typically should be preloaded in scene
      console.warn("Player texture not found: " + this.TEXTURE_KEY);
    }

    const sprite = scene.physics.add.sprite(x, y, this.TEXTURE_KEY, 0);
    
    // Adjust body size for collision - character is likely smaller than the 328x326 frame
    sprite.setSize(16, 32); 
    // Recalculated offset for 328x326.8 frame to keep character centered
    sprite.setOffset(156, 221); 

    // Scale down because frame is Huge. 
    sprite.setScale(0.61); 
    sprite.setDepth(2);

    this.createAnimations(scene);

    // Play default idle
    sprite.play("player-idle-down");

    return sprite;
  }

  private static createAnimations(scene: Phaser.Scene): void {
    // Walk Animations (Rows 0-3)
    // Row 0: Walk Down (frames 0-3)
    scene.anims.create({
      key: "player-walk-down",
      frames: scene.anims.generateFrameNumbers(this.TEXTURE_KEY, { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });

    // Row 1: Walk Left (frames 4-7)
    scene.anims.create({
      key: "player-walk-left",
      frames: scene.anims.generateFrameNumbers(this.TEXTURE_KEY, { start: 4, end: 7 }),
      frameRate: 8,
      repeat: -1,
    });

    // Row 2: Walk Right (frames 8-11)
    scene.anims.create({
      key: "player-walk-right",
      frames: scene.anims.generateFrameNumbers(this.TEXTURE_KEY, { start: 8, end: 11 }),
      frameRate: 8,
      repeat: -1,
    });

    // Row 3: Walk Up (frames 12-15)
    scene.anims.create({
      key: "player-walk-up",
      frames: scene.anims.generateFrameNumbers(this.TEXTURE_KEY, { start: 12, end: 15 }),
      frameRate: 8,
      repeat: -1,
    });

    // Directional Idle Animations
    scene.anims.create({
      key: "player-idle-down",
      frames: [{ key: this.TEXTURE_KEY, frame: 0 }],
      frameRate: 4,
    });
    scene.anims.create({
      key: "player-idle-left",
      frames: [{ key: this.TEXTURE_KEY, frame: 4 }],
      frameRate: 4,
    });
    scene.anims.create({
      key: "player-idle-right",
      frames: [{ key: this.TEXTURE_KEY, frame: 8 }],
      frameRate: 4,
    });
    scene.anims.create({
      key: "player-idle-up",
      frames: [{ key: this.TEXTURE_KEY, frame: 12 }],
      frameRate: 4,
    });

    // Alias for generic idle
    if (!scene.anims.exists("player-idle")) {
        scene.anims.create({
            key: "player-idle",
            frames: [{ key: this.TEXTURE_KEY, frame: 0 }],
            frameRate: 4,
        });
    }

    // Death Animation (Rows 9-10) -> Frames 32 to 39
    scene.anims.create({
        key: "player-death",
        frames: scene.anims.generateFrameNumbers(this.TEXTURE_KEY, { start: 32, end: 39 }),
        frameRate: 8,
        repeat: 0 // Do not repeat
    });

    // Alias for existing code compatibility if needed
    if (!scene.anims.exists("player-walk")) {
        // Map generic "walk" to walk-down for now
        scene.anims.create({
            key: "player-walk",
            frames: scene.anims.generateFrameNumbers(this.TEXTURE_KEY, { start: 0, end: 3 }),
            frameRate: 8,
            repeat: -1,
        });
    }
  }
}
