import Phaser from "phaser";

export class BasaltGraphic {
  static preload(scene: Phaser.Scene): void {
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number
  ): Phaser.GameObjects.Sprite {
    const textureKey = "tile-basalt";
    if (!scene.textures.exists(textureKey)) {
        const graphics = scene.make.graphics();
        
        // Base Basalt Color (Dark Grey/Purplish)
        graphics.fillStyle(0x2f2f2f, 1);
        graphics.fillRect(0, 0, 32, 32);
        
        // Cracks/Stone Texture
        graphics.lineStyle(2, 0x1a1a1a, 0.5);
        graphics.beginPath();
        graphics.moveTo(0, 8);
        graphics.lineTo(32, 12);
        graphics.moveTo(16, 0);
        graphics.lineTo(20, 32);
        graphics.strokePath();
        
        graphics.generateTexture(textureKey, 32, 32);
        graphics.destroy();
    }

    return scene.add.sprite(x, y, textureKey);
  }
}
