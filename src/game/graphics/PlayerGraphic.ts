import Phaser from "phaser";

export class PlayerGraphic {
  static readonly TEXTURE_KEY = "player-happy-ball";
  private static readonly SIZE = { width: 32, height: 32 };

  static preload(scene: Phaser.Scene): void {
    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      this.createTexture(scene);
    }
  }

  private static createTexture(scene: Phaser.Scene): void {
    const graphics = scene.add.graphics();

    // Body (Happy Yellow Ball)
    graphics.fillStyle(0xffff00, 1);
    graphics.fillCircle(16, 16, 14);

    // Eyes
    graphics.fillStyle(0x000000, 1);
    graphics.fillCircle(11, 12, 2); // Left
    graphics.fillCircle(21, 12, 2); // Right

    // Smile
    graphics.lineStyle(2, 0x000000, 1);
    graphics.beginPath();
    graphics.arc(16, 18, 8, 0.2 * Math.PI, 0.8 * Math.PI, false);
    graphics.strokePath();

    graphics.generateTexture(this.TEXTURE_KEY, this.SIZE.width, this.SIZE.height);
    graphics.destroy();
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number
  ): Phaser.Physics.Arcade.Sprite {
    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      this.createTexture(scene);
    }

    const sprite = scene.physics.add.sprite(x, y, this.TEXTURE_KEY);
    
    // Physical body for 32x32 world
    sprite.setSize(24, 24);
    sprite.setOffset(4, 4);
    sprite.setDepth(2);

    this.createAnimations(scene);

    return sprite;
  }

  private static createAnimations(scene: Phaser.Scene): void {
      // Since it's a ball, animations can just be slight squashes or tints
      // For now, we stub directional idles/walks as the same static ball
      const anims = [
          "player-walk-down", "player-walk-left", "player-walk-right", "player-walk-up",
          "player-idle-down", "player-idle-left", "player-idle-right", "player-idle-up",
          "player-idle", "player-walk"
      ];

      anims.forEach(key => {
          if (!scene.anims.exists(key)) {
              scene.anims.create({
                  key: key,
                  frames: [{ key: this.TEXTURE_KEY, frame: 0 }],
                  frameRate: 1,
                  repeat: -1
              });
          }
      });
  }
}
