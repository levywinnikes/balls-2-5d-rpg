import Phaser from "phaser";

export class FloorGraphic {
  static readonly TEXTURE_KEY = "floor-texture";
  private static readonly SIZE = { width: 32, height: 32 };

  static preload(scene: Phaser.Scene): void {
    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      this.createTexture(scene);
    }
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number
  ): Phaser.GameObjects.Sprite {
    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      this.createTexture(scene);
    }

    return scene.add.sprite(x, y, this.TEXTURE_KEY);
  }

  private static createTexture(scene: Phaser.Scene): void {
    const graphics = scene.add.graphics();

    // Base marrom clara
    graphics.fillStyle(0xd2b48c, 1);
    graphics.fillRect(0, 0, this.SIZE.width, this.SIZE.height);

    // Padrão de ladrilhos
    graphics.lineStyle(1, 0xb8860b, 0.5);
    for (let i = 0; i < this.SIZE.width; i += 8) {
      graphics.moveTo(i, 0);
      graphics.lineTo(i, this.SIZE.height);
      graphics.moveTo(0, i);
      graphics.lineTo(this.SIZE.width, i);
    }
    graphics.strokePath();

    // Manchas aleatórias
    graphics.fillStyle(0xb8860b, 0.2);
    for (let i = 0; i < 5; i++) {
      graphics.fillCircle(
        Phaser.Math.Between(4, 28),
        Phaser.Math.Between(4, 28),
        Phaser.Math.Between(1, 3)
      );
    }

    graphics.generateTexture(
      this.TEXTURE_KEY,
      this.SIZE.width,
      this.SIZE.height
    );
    graphics.destroy();
  }
}
