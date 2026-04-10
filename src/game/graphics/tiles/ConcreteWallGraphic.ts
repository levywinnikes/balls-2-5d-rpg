import Phaser from "phaser";

export class ConcreteWallGraphic {
  static readonly TEXTURE_KEY = "concrete-wall-texture";
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

    // Cor base cinza
    graphics.fillStyle(0x9e9e9e, 1);
    graphics.fillRect(0, 0, this.SIZE.width, this.SIZE.height);

    // Textura de concreto (padrão de blocos)
    graphics.fillStyle(0x757575, 1);
    for (let y = 0; y < this.SIZE.height; y += 8) {
      for (let x = 0; x < this.SIZE.width; x += 8) {
        if ((x + y) % 16 === 0) {
          graphics.fillRect(x, y, 4, 4);
        }
      }
    }

    // Bordas mais escuras
    graphics.lineStyle(2, 0x616161);
    graphics.strokeRect(0, 0, this.SIZE.width, this.SIZE.height);

    graphics.generateTexture(
      this.TEXTURE_KEY,
      this.SIZE.width,
      this.SIZE.height
    );
    graphics.destroy();
  }
}
