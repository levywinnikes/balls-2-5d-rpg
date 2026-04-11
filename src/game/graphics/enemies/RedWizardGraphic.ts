import Phaser from "phaser";
import { BaseEnemyGraphic } from "./BaseEnemyGraphic";

export class RedWizardGraphic extends BaseEnemyGraphic {
  public static readonly TEXTURE_KEY = "red-wizard-texture";
  public readonly TEXTURE_KEY = RedWizardGraphic.TEXTURE_KEY;

  static create(scene: Phaser.Scene, x: number, y: number): Phaser.Physics.Arcade.Sprite {
    const textureKey = this.TEXTURE_KEY;
    if (!scene.textures.exists(textureKey)) this.createTexture(scene, textureKey);
    
    const sprite = scene.physics.add.sprite(x, y, textureKey);
    this.createStandardAnimations(scene, "red_wizard", textureKey);
    return sprite;
  }

  protected drawEnemy(graphics: Phaser.GameObjects.Graphics): void {
    // Red Cloak (Body)
    graphics.fillStyle(0x8b0000, 1); // DarkRed
    graphics.fillRect(6, 12, 20, 18);
    
    // Hood / Hat
    graphics.fillStyle(0xff0000, 1); // Bright Red
    graphics.fillTriangle(16, 2, 6, 14, 26, 14);
    
    // Face (Dark/Void)
    graphics.fillStyle(0x1a1a1a, 1);
    graphics.fillRect(10, 14, 12, 6);
    
    // Glowing Eyes
    graphics.fillStyle(0xfff000, 1); // Yellow glow
    graphics.fillRect(12, 16, 2, 2);
    graphics.fillRect(18, 16, 2, 2);
    
    // Magic Staff (In hand)
    graphics.fillStyle(0x4b2d00, 1); // Brown
    graphics.fillRect(24, 8, 4, 22);
    graphics.fillStyle(0x00ffff, 1); // Magic gem
    graphics.fillCircle(26, 8, 3);
  }
}
