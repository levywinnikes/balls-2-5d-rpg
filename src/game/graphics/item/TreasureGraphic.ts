import Phaser from "phaser";

export class TreasureGraphic {
  static readonly TEXTURE_KEY = "treasure-texture";
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

    // Baú do tesouro
    graphics.fillStyle(0xdaa520, 1);
    graphics.fillRect(8, 16, 16, 10);

    // Detalhes do baú
    graphics.lineStyle(2, 0xb8860b);
    graphics.strokeRect(8, 16, 16, 10);
    graphics.lineBetween(8, 20, 24, 20);

    // Tampa do baú
    graphics.fillStyle(0xffd700, 1);
    graphics.fillRect(10, 12, 12, 4);

    // Moedas saindo
    graphics.fillStyle(0xffdf00, 1);
    graphics.fillCircle(18, 10, 2);
    graphics.fillCircle(14, 8, 1.5);
    graphics.fillCircle(22, 9, 1);

    graphics.generateTexture(
      this.TEXTURE_KEY,
      this.SIZE.width,
      this.SIZE.height
    );
    graphics.destroy();
  }
}
