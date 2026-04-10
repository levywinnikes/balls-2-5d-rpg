import Phaser from "phaser";
import { BaseWeaponGraphic } from "./BaseWeaponGraphic";

export class AxeGraphic extends BaseWeaponGraphic {
  public readonly TEXTURE_KEY = "axe-texture";

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
    graphics.fillStyle(0xc0c0c0, 1);
    graphics.fillTriangle(16, 4, 28, 16, 16, 28);
    graphics.fillTriangle(16, 4, 4, 16, 16, 28);

    // Cabo
    graphics.fillStyle(0x8b4513, 1);
    graphics.fillRect(14, 8, 4, 20);

    // Reforço
    graphics.fillStyle(0x808080, 1);
    graphics.fillRect(12, 12, 8, 4);

    // Detalhes
    graphics.lineStyle(1, 0x606060, 1);
    graphics.moveTo(16, 8);
    graphics.lineTo(22, 16);
    graphics.moveTo(16, 8);
    graphics.lineTo(10, 16);
    graphics.strokePath();
  }
}
