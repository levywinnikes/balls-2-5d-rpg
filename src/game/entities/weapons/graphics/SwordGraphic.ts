import Phaser from "phaser";
import { BaseWeaponGraphic } from "./BaseWeaponGraphic";

export class SwordGraphic extends BaseWeaponGraphic {
  public readonly TEXTURE_KEY = "sword-texture";

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
    // Lâmina
    graphics.fillStyle(0xe0e0e0, 1);
    graphics.fillRect(8, 4, 16, 4);

    // Guarda
    graphics.fillStyle(0xcd7f32, 1);
    graphics.fillRect(8, 8, 16, 2);

    // Punho
    graphics.fillStyle(0x8b4513, 1);
    graphics.fillRect(4, 8, 4, 8);
    graphics.fillRect(24, 8, 4, 8);

    // Detalhes
    graphics.lineStyle(1, 0xa0a0a0, 1);
    graphics.moveTo(8, 6);
    graphics.lineTo(24, 6);
    graphics.strokePath();
  }
}
