import Phaser from "phaser";
import { BaseWeaponGraphic } from "./BaseWeaponGraphic";

export class BowGraphic extends BaseWeaponGraphic {
  public readonly TEXTURE_KEY = "bow-texture";

  static preload(scene: Phaser.Scene): void {
    super.preload(scene, new this().TEXTURE_KEY);
  }

  static create(scene: Phaser.Scene): Phaser.GameObjects.Sprite {
    const textureKey = new this().TEXTURE_KEY;

    if (!scene.textures.exists(textureKey)) {
      this.createTexture(scene, textureKey);
    }

    const sprite = scene.add.sprite(0, 0, textureKey);
    sprite.setOrigin(0.5, 0.5);
    return sprite;
  }

  protected drawWeapon(graphics: Phaser.GameObjects.Graphics): void {
    // Desenho do arco
    graphics.lineStyle(3, 0x8b4513, 1); // Madeira
    graphics.beginPath();
    graphics.arc(
      16,
      16,
      12,
      Phaser.Math.DegToRad(220),
      Phaser.Math.DegToRad(320),
      false,
      0.1
    );
    graphics.strokePath();

    // Corda
    graphics.lineStyle(2, 0xffffff, 1);
    graphics.moveTo(16 - 10, 16 + 6);
    graphics.lineTo(16 + 10, 16 + 6);
    graphics.strokePath();

    // Detalhes
    graphics.fillStyle(0xcd853f, 1);
    graphics.fillCircle(16 - 10, 16 + 6, 2);
    graphics.fillCircle(16 + 10, 16 + 6, 2);
  }
}
