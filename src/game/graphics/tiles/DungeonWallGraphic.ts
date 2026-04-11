import Phaser from "phaser";

export class DungeonWallGraphic {
  static readonly TEXTURE_KEY = "dungeon-wall-texture";
  private static readonly SIZE = { width: 32, height: 32 };

  static preload(scene: Phaser.Scene): void {
    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      this.createTexture(scene);
    }
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number
  ): Phaser.GameObjects.Sprite {
    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      this.createTexture(scene);
    }
    return scene.add.sprite(x, y, this.TEXTURE_KEY);
  }

  private static createTexture(scene: Phaser.Scene): void {
    const graphics = scene.make.graphics();
    
    // Base Wall Color (Darker Slate / Iron)
    graphics.fillStyle(0x1e293b, 1);
    graphics.fillRect(0, 0, 32, 32);
    
    // Top Edge Highlight (2.5D effect)
    graphics.fillStyle(0x334155, 1);
    graphics.fillRect(0, 0, 32, 4);
    
    // Brick Outlines (Dungeon Blocks)
    graphics.lineStyle(1, 0x0f172a, 0.8);
    
    // Horizontal row
    graphics.lineBetween(0, 16, 32, 16);
    
    // Vertical mortar lines (offset for brick effect)
    graphics.lineBetween(16, 4, 16, 16);
    graphics.lineBetween(8, 16, 8, 32);
    graphics.lineBetween(24, 16, 24, 32);

    // Weathering detail
    graphics.fillStyle(0x000000, 0.2);
    graphics.fillRect(0, 30, 32, 2); // Bottom shadow

    graphics.generateTexture(this.TEXTURE_KEY, this.SIZE.width, this.SIZE.height);
    graphics.destroy();
  }
}
