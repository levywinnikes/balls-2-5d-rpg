import Phaser from "phaser";
import { BaseEnemyGraphic } from "./BaseEnemyGraphic";

export class GoblinGraphic extends BaseEnemyGraphic {
  public readonly TEXTURE_KEY = "goblin-texture";

  static preload(scene: Phaser.Scene): void {
    super.preload(scene, new this().TEXTURE_KEY);
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number
  ): Phaser.Physics.Arcade.Sprite {
    const textureKey = new this().TEXTURE_KEY;

    if (!scene.textures.exists(textureKey)) {
      this.createTexture(scene, textureKey);
    }

    const sprite = scene.physics.add.sprite(x, y, textureKey);
    sprite.setSize(this.SIZE.width, this.SIZE.height);
    return sprite;
  }

  protected drawEnemy(graphics: Phaser.GameObjects.Graphics): void {
    // Corpo verde
    graphics.fillStyle(0x228b22, 1);
    graphics.fillEllipse(16, 20, 8, 10);

    // Cabeça
    graphics.fillStyle(0x32cd32, 1);
    graphics.fillCircle(16, 10, 6);

    // Olhos vermelhos
    graphics.fillStyle(0xff0000, 1);
    graphics.fillCircle(14, 8, 1.5);
    graphics.fillCircle(18, 8, 1.5);

    // Boca
    graphics.lineStyle(1, 0x8b0000);
    graphics.beginPath();
    graphics.arc(16, 12, 3, 0, Math.PI);
    graphics.strokePath();

    // Orelhas pontudas
    graphics.fillStyle(0x32cd32, 1);
    graphics.fillTriangle(10, 6, 6, 2, 10, 10);
    graphics.fillTriangle(22, 6, 26, 2, 22, 10);

    // Arma (clava)
    graphics.fillStyle(0x8b4513, 1);
    graphics.fillRect(22, 18, 6, 2);
    graphics.fillCircle(28, 19, 3);
  }
}
