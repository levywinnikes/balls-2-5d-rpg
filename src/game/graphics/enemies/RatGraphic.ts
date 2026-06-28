import Phaser from "phaser";
import { BaseEnemyGraphic } from "./BaseEnemyGraphic";

export class RatGraphic extends BaseEnemyGraphic {
  public static readonly TEXTURE_KEY = "rat-texture";
  public readonly TEXTURE_KEY = RatGraphic.TEXTURE_KEY;

  static preload(scene: Phaser.Scene): void {
    super.preload(scene);
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number,
  ): Phaser.Physics.Arcade.Sprite {
    const textureKey = new this().TEXTURE_KEY;

    if (!scene.textures.exists(textureKey)) {
      this.createTexture(scene, textureKey);
    }

    const sprite = scene.physics.add.sprite(x, y, textureKey);
    sprite.setSize(24, 16);
    this.createStandardAnimations(scene, "rat", textureKey);
    return sprite;
  }

  protected drawEnemy(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x808080, 1);
    graphics.fillEllipse(16, 22, 24, 12);
    graphics.fillStyle(0xffc0cb, 1);
    graphics.fillCircle(10, 14, 3);
    graphics.fillCircle(22, 14, 3);
    graphics.fillStyle(0x666666, 1);
    graphics.fillEllipse(16, 10, 8, 6);
    graphics.fillStyle(0x000000, 1);
    graphics.fillCircle(14, 10, 1);
    graphics.fillCircle(18, 10, 1);
    graphics.fillStyle(0x555555, 1);
    graphics.fillCircle(8, 24, 2);
    graphics.fillCircle(12, 26, 2);
    graphics.fillCircle(20, 26, 2);
    graphics.fillCircle(24, 24, 2);
    graphics.lineStyle(1, 0xffc0cb, 1);
    graphics.beginPath();
    graphics.moveTo(28, 22);
    graphics.lineTo(31, 24);
    graphics.strokePath();
  }
}
