import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class StoneWallGraphic extends BaseTileGraphic {
  static readonly TEXTURE_KEY = "stone-wall-texture";
  public readonly TEXTURE_KEY = StoneWallGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Base Stone - Dark gray
    graphics.fillStyle(0x4b5563, 1);
    graphics.fillRect(0, 0, 32, 32);

    // Large Stone Bricks mortar/cracks
    graphics.lineStyle(2, 0x1f2937, 0.8);
    
    // Horizontal lines
    graphics.lineBetween(0, 10, 32, 10);
    graphics.lineBetween(0, 20, 32, 20);
    graphics.lineBetween(0, 31, 32, 31);
    
    // Vertical mortar (staggered bricks)
    graphics.lineBetween(10, 0, 10, 10);
    graphics.lineBetween(22, 0, 22, 10);
    
    graphics.lineBetween(5, 10, 5, 20);
    graphics.lineBetween(18, 10, 18, 20);
    
    graphics.lineBetween(12, 20, 12, 32);
    graphics.lineBetween(26, 20, 26, 32);

    // Small highlights on bricks for "texture"
    graphics.fillStyle(0x6b7280, 0.4);
    graphics.fillRect(2, 2, 6, 2);
    graphics.fillRect(14, 12, 4, 2);
    graphics.fillRect(6, 22, 6, 2);
  }
}
