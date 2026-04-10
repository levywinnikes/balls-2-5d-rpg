import Phaser from "phaser";

export class MountainGraphic {
  static readonly TEXTURE_KEY = "mountain-texture";
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

    // Base da montanha
    graphics.fillStyle(0x696969, 1);
    graphics.fillTriangle(0, 32, 16, 8, 32, 32);

    // Neve no topo
    graphics.fillStyle(0xf5f5f5, 1);
    graphics.fillTriangle(12, 12, 16, 8, 20, 12);

    // Detalhes de sombra
    graphics.fillStyle(0x555555, 1);
    graphics.fillTriangle(0, 32, 16, 16, 16, 32);

    graphics.generateTexture(
      this.TEXTURE_KEY,
      this.SIZE.width,
      this.SIZE.height
    );
    graphics.destroy();
  }
}
