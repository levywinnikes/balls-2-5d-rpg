import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class ManholeGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "manhole-texture";
  public readonly TEXTURE_KEY = ManholeGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // 1. Background Pavement (Matching PavementGraphic)
    graphics.fillStyle(0x7a7a7a, 1);
    graphics.fillRect(0, 0, 32, 32);
    graphics.lineStyle(1, 0x5a5a5a, 0.3);
    graphics.strokeRect(0, 0, 32, 32);

    // 2. Metallic Frame
    graphics.lineStyle(2, 0x404040, 1);
    graphics.strokeCircle(16, 16, 12);
    
    // 3. Main Hatch Cover
    graphics.fillStyle(0x525252, 1);
    graphics.fillCircle(16, 16, 11);
    
    // 4. Grip Pattern (Cross-hatch)
    graphics.lineStyle(1, 0x404040, 0.8);
    for(let i = 8; i <= 24; i += 4) {
        graphics.moveTo(i, 8);
        graphics.lineTo(i, 24);
        graphics.moveTo(8, i);
        graphics.lineTo(24, i);
    }
    graphics.strokePath();

    // 5. Rust and Dirt
    graphics.fillStyle(0x451a03, 0.3);
    graphics.fillCircle(10, 10, 2);
    graphics.fillCircle(22, 22, 1.5);
  }
}
