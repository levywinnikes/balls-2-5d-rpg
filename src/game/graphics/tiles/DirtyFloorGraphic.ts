import Phaser from "phaser";

export class DirtyFloorGraphic {
  static readonly TEXTURE_KEY = "dirty-floor-texture";
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

    // Base de madeira envelhecida
    graphics.fillStyle(0x6d4c41, 1);
    graphics.fillRect(0, 0, this.SIZE.width, this.SIZE.height);

    // Listras de tábuas
    graphics.lineStyle(2, 0x5d4037, 0.8);
    for (let i = 1; i < 4; i++) {
      graphics.lineBetween(i * 8, 0, i * 8, this.SIZE.height);
    }

    // Manchas de sujeira
    graphics.fillStyle(0x3e2723, 0.4);
    for (let i = 0; i < 5; i++) {
      const x = Phaser.Math.Between(0, this.SIZE.width);
      const y = Phaser.Math.Between(0, this.SIZE.height);
      const w = Phaser.Math.Between(4, 12);
      const h = Phaser.Math.Between(4, 8);
      graphics.fillRect(x, y, w, h);
    }

    graphics.generateTexture(
      this.TEXTURE_KEY,
      this.SIZE.width,
      this.SIZE.height
    );
    graphics.destroy();
  }
}
