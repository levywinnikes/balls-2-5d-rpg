import Phaser from "phaser";
import { BaseEnemyGraphic } from "./BaseEnemyGraphic";

export class GodGraphic extends BaseEnemyGraphic {
  public static readonly TEXTURE_KEY = "god-texture";
  public readonly TEXTURE_KEY = GodGraphic.TEXTURE_KEY;

  static create(scene: Phaser.Scene, x: number, y: number): Phaser.Physics.Arcade.Sprite {
    const textureKey = this.TEXTURE_KEY;
    if (!scene.textures.exists(textureKey)) this.createTexture(scene, textureKey);
    
    const sprite = scene.physics.add.sprite(x, y, textureKey);
    this.createStandardAnimations(scene, "god", textureKey);
    return sprite;
  }

  protected drawEnemy(graphics: Phaser.GameObjects.Graphics): void {
    // Divine Halo / Glow
    graphics.fillStyle(0xffff00, 0.4);
    graphics.fillCircle(16, 16, 14);
    
    // Core Body (Golden Sphere)
    graphics.fillStyle(0xffd700, 1); // Gold
    graphics.fillCircle(16, 16, 10);
    
    // Divine Eyes (White/Blue glow)
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(12, 14, 2);
    graphics.fillCircle(20, 14, 2);
    
    // Crown / Spike
    graphics.fillStyle(0xffa500, 1); // Orange-Gold
    graphics.fillTriangle(16, 2, 12, 8, 20, 8);
  }
}
