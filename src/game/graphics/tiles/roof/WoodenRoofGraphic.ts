import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class WoodenRoofGraphic extends BaseTileGraphic {
  static readonly TEXTURE_KEY = "wooden-roof-texture";
  public readonly TEXTURE_KEY = WoodenRoofGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Base Wood Color
    graphics.fillStyle(0x78350f, 1);
    graphics.fillRect(0, 0, 32, 32);

    // Shingle pattern
    graphics.lineStyle(1, 0x451a03, 0.6);
    
    for (let y = 0; y < 32; y += 8) {
      graphics.lineBetween(0, y, 32, y);
      const xOffset = (y % 16 === 0) ? 0 : 8;
      for (let x = xOffset; x < 32; x += 16) {
        graphics.lineBetween(x, y, x, y + 8);
      }
    }

    // Highlights on some shingles
    graphics.fillStyle(0x92400e, 0.3);
    for (let i = 0; i < 6; i++) {
        const rx = Math.floor(Math.random() * 24);
        const ry = Math.floor(Math.random() * 24);
        graphics.fillRect(rx, ry, 6, 2);
    }
  }
}
