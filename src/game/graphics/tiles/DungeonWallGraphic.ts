import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class DungeonWallGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "dungeon-wall-texture";
  public readonly TEXTURE_KEY = DungeonWallGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
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
  }
}
