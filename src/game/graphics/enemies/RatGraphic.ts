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
    y: number
  ): Phaser.Physics.Arcade.Sprite {
    const textureKey = new this().TEXTURE_KEY;

    if (!scene.textures.exists(textureKey)) {
      this.createTexture(scene, textureKey);
    }

    const sprite = scene.physics.add.sprite(x, y, textureKey);
    sprite.setSize(24, 16); // Pequeno
    
    this.createStandardAnimations(scene, "rat", textureKey);
    return sprite;
  }

  protected drawEnemy(graphics: Phaser.GameObjects.Graphics): void {
    // Corpo cinza oval
    graphics.fillStyle(0x808080, 1);
    graphics.fillEllipse(16, 20, 24, 16);

    // Orelhas
    graphics.fillStyle(0xffc0cb, 1);
    graphics.fillCircle(10, 12, 4);
    graphics.fillCircle(22, 12, 4);

    // Olhos pretos minúsculos
    graphics.fillStyle(0x000000, 1);
    graphics.fillCircle(12, 18, 2);
    graphics.fillCircle(20, 18, 2);

    // Rabo
    graphics.lineStyle(1, 0xffc0cb, 1);
    graphics.beginPath();
    graphics.moveTo(16, 28);
    graphics.lineTo(16, 32);
    graphics.strokePath();
  }
}
