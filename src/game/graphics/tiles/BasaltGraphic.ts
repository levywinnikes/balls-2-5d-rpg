import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class BasaltGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "tile-basalt";
  public readonly TEXTURE_KEY = BasaltGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
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
  }
}
