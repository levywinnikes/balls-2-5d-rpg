import Phaser from "phaser";

export class RockGraphic {
  static readonly TEXTURE_KEY = "rock-texture";
  private static readonly SIZE = { width: 32, height: 32 };

  static preload(scene: Phaser.Scene): void {
    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      this.createTexture(scene);
    }
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number,
    pool?: Phaser.GameObjects.Sprite[]
  ): Phaser.GameObjects.Sprite {
    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      this.createTexture(scene);
    }

    const sprite = scene.add.sprite(x, y, this.TEXTURE_KEY);
    return sprite;
  }

  private static createTexture(scene: Phaser.Scene): void {
    const graphics = scene.add.graphics();

    // Base da pedra
    graphics.fillStyle(0x708090, 1);
    graphics.fillEllipse(16, 16, 10, 8);

    // Detalhes de sombra
    graphics.fillStyle(0x5f6a6a, 1);
    graphics.fillEllipse(16, 18, 8, 6);

    // Detalhes de luz
    graphics.fillStyle(0x8c9c9c, 1);
    graphics.fillEllipse(14, 12, 3, 2);
    graphics.fillEllipse(18, 14, 2, 3);

    graphics.generateTexture(
      this.TEXTURE_KEY,
      this.SIZE.width,
      this.SIZE.height
    );
    graphics.destroy();
  }
}
