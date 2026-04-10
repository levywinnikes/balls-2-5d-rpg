import Phaser from "phaser";

export abstract class BaseWeaponGraphic {
  protected static SIZE = { width: 32, height: 32 };
  public abstract readonly TEXTURE_KEY: string;

  static preload(scene: Phaser.Scene, textureKey: string): void {
    if (!scene.textures.exists(textureKey)) {
      this.createTexture(scene, textureKey);
    }
  }

  protected static createTexture(
    scene: Phaser.Scene,
    textureKey: string
  ): void {
    const graphics = scene.add.graphics();

    // Chamada para o método de desenho específico
    const instance = new (this as any)();
    instance.drawWeapon(graphics);

    graphics.generateTexture(textureKey, this.SIZE.width, this.SIZE.height);
    graphics.destroy();
  }

  // Método abstrato que cada arma deve implementar
  protected abstract drawWeapon(graphics: Phaser.GameObjects.Graphics): void;
}
