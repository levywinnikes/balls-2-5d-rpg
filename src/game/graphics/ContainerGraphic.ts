import Phaser from "phaser";

export class ContainerGraphic {
  static preload(scene: Phaser.Scene) {
    // No external asset to preload for this procedural graphic
  }

  static create(scene: Phaser.Scene): Phaser.GameObjects.Sprite {
    const graphics = scene.make.graphics({ x: 0, y: 0 });

    // Draw Chest Body
    graphics.fillStyle(0x8B4513, 1); // SaddleBrown
    graphics.fillRect(0, 0, 32, 32);

    // Draw Rim/Border
    graphics.lineStyle(2, 0x5D4037, 1); // Darker Brown
    graphics.strokeRect(0, 0, 32, 32);

    // Draw Lock (Gold/Yellow)
    graphics.fillStyle(0xFFD700, 1);
    graphics.fillRect(12, 12, 8, 8);
    graphics.lineStyle(1, 0x000000, 0.5);
    graphics.strokeRect(12, 12, 8, 8);

    // Generate Texture
    const textureKey = "container_wooden_chest";
    if (!scene.textures.exists(textureKey)) {
        graphics.generateTexture(textureKey, 32, 32);
    }
    
    // Create Sprite
    const sprite = scene.add.sprite(0, 0, textureKey);
    return sprite;
  }
}
