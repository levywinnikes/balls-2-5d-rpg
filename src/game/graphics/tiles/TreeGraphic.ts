import Phaser from "phaser";

export class TreeGraphic {
  static readonly TEXTURE_KEY = "tree-texture";
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
    sprite.setScale(4);
    return sprite;
  }

  private static createTexture(scene: Phaser.Scene): void {
    const graphics = scene.add.graphics();

    // Tronco marrom
    graphics.fillStyle(0x8b4513, 1);
    graphics.fillRect(14, 20, 4, 12);

    // Copa da árvore verde
    graphics.fillStyle(0x2e8b57, 1);
    graphics.fillTriangle(6, 20, 26, 20, 16, 4);

    // Detalhes na copa
    graphics.fillStyle(0x3cb371, 1);
    graphics.fillCircle(10, 16, 3);
    graphics.fillCircle(22, 16, 3);
    graphics.fillCircle(16, 10, 4);

    graphics.generateTexture(
      this.TEXTURE_KEY,
      this.SIZE.width,
      this.SIZE.height
    );
    graphics.destroy();
  }
}
