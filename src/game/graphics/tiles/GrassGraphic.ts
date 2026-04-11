import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class GrassGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "grass-texture";
  public readonly TEXTURE_KEY = GrassGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    const size = 32;
    
    // 1. Solid Base (Cute Green)
    graphics.fillStyle(0x4ade80, 1.0); 
    graphics.fillRect(0, 0, size, size);

    // 2. Subtle Texture / Noise Dots
    graphics.fillStyle(0x22c55e, 0.3); // Darker green
    for(let i=0; i<8; i++) {
        const x = Phaser.Math.Between(2, 28);
        const y = Phaser.Math.Between(2, 28);
        graphics.fillCircle(x, y, 1);
    }

    // 3. Decorated Grass Blades (Varied heights/colors)
    const bladeColors = [0x22c55e, 0x16a34a, 0x86efac];
    for (let i = 0; i < 12; i++) {
        const x = Phaser.Math.Between(2, 28);
        const y = Phaser.Math.Between(4, 30);
        const height = Phaser.Math.Between(3, 8);
        const color = Phaser.Math.RND.pick(bladeColors);
        
        graphics.lineStyle(2, color, 0.8);
        graphics.beginPath();
        graphics.moveTo(x, y);
        graphics.lineTo(x + (Math.random() * 4 - 2), y - height);
        graphics.strokePath();
    }

    // 4. "Enfeitadinho" Flowers (Small dots with centers)
    const flowerColors = [0xfef08a, 0xfecaca, 0xe9d5ff]; // Yellow, Red, Purple
    for (let i = 0; i < 3; i++) {
        const x = Phaser.Math.Between(5, 25);
        const y = Phaser.Math.Between(5, 25);
        const color = Phaser.Math.RND.pick(flowerColors);
        
        // Petals
        graphics.fillStyle(color, 1);
        graphics.fillCircle(x, y, 2.5);
        
        // Center
        graphics.fillStyle(0xffffff, 0.8);
        graphics.fillCircle(x, y, 1);
    }
  }
}
