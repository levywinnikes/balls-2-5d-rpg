import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class SewerBrickGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "sewer-brick-texture";
  public readonly TEXTURE_KEY = SewerBrickGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Dark Wet Stone (Indigo-Slate)
    graphics.fillStyle(0x1e293b, 1);
    graphics.fillRect(0, 0, 32, 32);

    // Brick Grid
    graphics.lineStyle(1, 0x0f172a, 0.6);
    for (let i = 0; i <= 32; i += 8) {
        graphics.lineStyle(1, 0x0f172a, 0.6);
        graphics.moveTo(0, i);
        graphics.lineTo(32, i);
        
        // Staggered vertical joints
        const offset = (i % 16 === 0) ? 0 : 4;
        for (let j = offset; j <= 32; j += 8) {
            graphics.moveTo(j, i);
            graphics.lineTo(j, i + 8);
        }
    }
    graphics.strokePath();

    // Wet highlights (specular)
    graphics.fillStyle(0x334155, 0.4);
    graphics.fillRect(2, 2, 4, 1);
    graphics.fillRect(18, 12, 3, 1);
    graphics.fillRect(10, 24, 4, 1);

    // Slime details
    graphics.fillStyle(0x064e3b, 0.3);
    for (let i = 0; i < 3; i++) {
        const rx = Math.random() * 24;
        const ry = Math.random() * 24;
        graphics.fillCircle(rx + 4, ry + 4, 2);
    }
  }
}
