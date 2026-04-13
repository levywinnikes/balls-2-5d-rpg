import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class FoundationWallGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "foundation-wall-texture";
  public readonly TEXTURE_KEY = FoundationWallGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // 1. Heavy Masonry Base (Dark Charcoal)
    graphics.fillStyle(0x262626, 1);
    graphics.fillRect(0, 0, 32, 32);

    // 2. Large Brick Outlines
    graphics.lineStyle(1, 0x171717, 1);
    for (let y = 0; y <= 32; y += 10) {
        graphics.moveTo(0, y);
        graphics.lineTo(32, y);
        const offset = (y % 20 === 0) ? 0 : 16;
        for (let x = offset; x <= 32; x += 32) {
             graphics.moveTo(x, y);
             graphics.lineTo(x, y + 10);
        }
    }
    graphics.strokePath();

    // 3. Texture/Wear Details
    graphics.fillStyle(0x404040, 0.4);
    for(let i=0; i<8; i++) {
        const rx = Math.random() * 28;
        const ry = Math.random() * 28;
        graphics.fillRect(rx, ry, 3, 2);
    }

    // 4. Highlight on top edge (Depth effect)
    graphics.lineStyle(1, 0x525252, 0.5);
    graphics.moveTo(0, 0);
    graphics.lineTo(32, 0);
    graphics.strokePath();
  }
}
