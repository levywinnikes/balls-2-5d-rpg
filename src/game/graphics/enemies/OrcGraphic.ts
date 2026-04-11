import Phaser from "phaser";
import { BaseEnemyGraphic } from "./BaseEnemyGraphic";

export class OrcGraphic extends BaseEnemyGraphic {
  public static readonly TEXTURE_KEY = "orc-texture";
  public readonly TEXTURE_KEY = OrcGraphic.TEXTURE_KEY;

  static create(scene: Phaser.Scene, x: number, y: number): Phaser.Physics.Arcade.Sprite {
    const textureKey = this.TEXTURE_KEY;
    if (!scene.textures.exists(textureKey)) this.createTexture(scene, textureKey);
    
    const sprite = scene.physics.add.sprite(x, y, textureKey);
    this.createStandardAnimations(scene, "orc", textureKey);
    return sprite;
  }

  protected drawEnemy(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x32cd32, 1); // LimeGreen
    graphics.fillRect(6, 6, 20, 24);
    graphics.fillStyle(0x000000, 1);
    graphics.fillRect(10, 10, 4, 4);
    graphics.fillRect(18, 10, 4, 4);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(12, 18, 2, 4);
    graphics.fillRect(18, 18, 2, 4);
  }
}
