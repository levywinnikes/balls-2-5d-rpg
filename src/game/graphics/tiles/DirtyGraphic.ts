import Phaser from "phaser";

export class DirtyGraphic {
  static readonly TEXTURE_KEY = "dirty-texture";
  private static readonly SIZE = { width: 128, height: 128 };

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

    return scene.add.sprite(x, y, this.TEXTURE_KEY);
  }

  private static createTexture(scene: Phaser.Scene): void {
    const graphics = scene.add.graphics();

    // Base marrom-terra
    graphics.fillStyle(0x5d4037, 1);
    graphics.fillRect(0, 0, this.SIZE.width, this.SIZE.height);

    // Detalhes de terra (manchas mais escuras)
    graphics.fillStyle(0x3e2723, 0.6);
    for (let i = 0; i < 8; i++) {
      const x = Phaser.Math.Between(0, this.SIZE.width);
      const y = Phaser.Math.Between(0, this.SIZE.height);
      const size = Phaser.Math.Between(3, 8);
      graphics.fillCircle(x, y, size);
    }

    // Pedrinhas e detritos
    graphics.fillStyle(0xbcaaa4, 1);
    for (let i = 0; i < 5; i++) {
      const x = Phaser.Math.Between(2, this.SIZE.width - 2);
      const y = Phaser.Math.Between(2, this.SIZE.height - 2);
      graphics.fillRect(x, y, 2, 2);
    }

    graphics.generateTexture(
      this.TEXTURE_KEY,
      this.SIZE.width,
      this.SIZE.height
    );
    graphics.destroy();
  }
}
