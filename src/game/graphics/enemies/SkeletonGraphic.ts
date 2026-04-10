import Phaser from "phaser";
import { BaseEnemyGraphic } from "./BaseEnemyGraphic";

export class SkeletonGraphic extends BaseEnemyGraphic {
  public readonly TEXTURE_KEY = "skeleton-texture";

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
    // Implementação do desenho do esqueleto
    graphics.fillStyle(0xaaaaaa, 1);
    graphics.fillCircle(16, 16, 12);
    graphics.fillStyle(0xff0000, 1);
    graphics.fillCircle(10, 10, 3);
    graphics.fillCircle(22, 10, 3);
    graphics.fillStyle(0x000000, 1);
    graphics.fillRect(10, 20, 12, 2);
  }
}
