import Phaser from "phaser";

export class CloudGraphic {
  static preload(scene: Phaser.Scene): void {
    // No external assets needed
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number
  ): Phaser.GameObjects.Sprite {
    const textureKey = "tile-cloud";
    if (!scene.textures.exists(textureKey)) {
        const graphics = scene.make.graphics();
        
        // Base Cloud Color (White/Light Blue)
        graphics.fillStyle(0xffffff, 0.8);
        graphics.fillCircle(16, 16, 14);
        
        // Highlights
        graphics.fillStyle(0xe0f7fa, 0.5);
        graphics.fillCircle(10, 10, 6);
        graphics.fillCircle(22, 12, 5);
        
        graphics.generateTexture(textureKey, 32, 32);
        graphics.destroy();
    }

    return scene.add.sprite(x, y, textureKey);
  }
}
