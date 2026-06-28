import Phaser from "phaser";
import { BaseEnemyGraphic } from "./BaseEnemyGraphic";

export class BearGraphic extends BaseEnemyGraphic {
  public static readonly TEXTURE_KEY = "bear-texture";
  public readonly TEXTURE_KEY = BearGraphic.TEXTURE_KEY;

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
    sprite.setSize(36, 28);
    this.createStandardAnimations(scene, "bear", textureKey);
    return sprite;
  }

  protected drawEnemy(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x6b4423, 1);
    graphics.fillEllipse(16, 22, 28, 20);
    graphics.fillStyle(0x3d2817, 1);
    graphics.fillCircle(10, 14, 5);
    graphics.fillCircle(22, 14, 5);
    graphics.fillStyle(0x1a1208, 1);
    graphics.fillCircle(9, 14, 2);
    graphics.fillCircle(21, 14, 2);
    graphics.fillStyle(0xc4a574, 1);
    graphics.fillEllipse(16, 24, 10, 6);
  }
}
