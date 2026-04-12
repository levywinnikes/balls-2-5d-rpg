import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class CloudGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "tile-cloud";
  public readonly TEXTURE_KEY = CloudGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Base Cloud Color (White/Light Blue)
    graphics.fillStyle(0xffffff, 0.8);
    graphics.fillCircle(16, 16, 14);
    
    // Highlights
    graphics.fillStyle(0xe0f7fa, 0.5);
    graphics.fillCircle(10, 10, 6);
    graphics.fillCircle(22, 12, 5);
  }
}
