import Phaser from "phaser";

export class ItemGraphic {
  public static readonly TEXTURE_KEY_PREFIX = "item-";

  static preload(scene: Phaser.Scene, textureKey: string): void {
    if (!scene.textures.exists(textureKey)) {
        this.createTexture(scene, textureKey);
    }
  }

  private static createTexture(scene: Phaser.Scene, textureKey: string): void {
      const graphics = scene.add.graphics();
      // Use a consistent but "random" color based on the key
      let hash = 0;
      for (let i = 0; i < textureKey.length; i++) {
          hash = textureKey.charCodeAt(i) + ((hash << 5) - hash);
      }
      const color = (hash & 0x00FFFFFF);
      
      graphics.fillStyle(color, 1);
      graphics.fillCircle(16, 16, 12);
      graphics.lineStyle(2, 0xffffff, 0.8);
      graphics.strokeCircle(16, 16, 12);
      
      graphics.generateTexture(textureKey, 32, 32);
      graphics.destroy();
  }

  static create(scene: Phaser.Scene, textureKey: string): Phaser.GameObjects.Sprite {
    if (!scene.textures.exists(textureKey)) {
        this.createTexture(scene, textureKey);
    }
    const sprite = scene.add.sprite(0, 0, textureKey);
    sprite.setDisplaySize(32, 32);
    sprite.setOrigin(0.5, 0.5);
    return sprite;
  }
}
