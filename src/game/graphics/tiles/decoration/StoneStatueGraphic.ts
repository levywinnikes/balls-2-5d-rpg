import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class StoneStatueGraphic extends BaseTileGraphic {
  static readonly TEXTURE_KEY = "stone-statue-texture";
  public readonly TEXTURE_KEY = StoneStatueGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Pedestal Base
    graphics.fillStyle(0x374151, 1);
    graphics.fillRect(4, 24, 24, 8);
    graphics.fillStyle(0x4b5563, 1);
    graphics.fillRect(6, 20, 20, 4);

    // Statue Body (Simplified shape)
    graphics.fillStyle(0x6b7280, 1);
    // Torso
    graphics.fillRect(10, 8, 12, 12);
    // Head
    graphics.fillRect(12, 2, 8, 6);
    
    // Shading/Details
    graphics.fillStyle(0x1f2937, 0.5);
    graphics.fillRect(10, 8, 2, 12); // Left side shadow
    graphics.fillRect(12, 2, 2, 6);  // Head shadow
    
    // Highlights
    graphics.fillStyle(0xd1d5db, 0.4);
    graphics.fillRect(20, 8, 2, 12); // Right side highlight
    graphics.fillRect(18, 2, 2, 6);
  }
}
