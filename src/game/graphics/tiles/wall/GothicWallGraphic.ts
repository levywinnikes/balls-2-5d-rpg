import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class GothicWallGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "gothic-wall-texture";
  public readonly TEXTURE_KEY = GothicWallGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // 1. Ornate Stone Base (Warm Grey)
    graphics.fillStyle(0x78716c, 1);
    graphics.fillRect(0, 0, 32, 32);

    // 2. Masonry Blocks
    graphics.lineStyle(1, 0x44403c, 0.5);
    graphics.strokeRect(0, 0, 16, 16);
    graphics.strokeRect(16, 0, 16, 16);
    graphics.strokeRect(0, 16, 16, 16);
    graphics.strokeRect(16, 16, 16, 16);

    // 3. Arched Window (Center)
    // Clear a window area
    graphics.fillStyle(0x1e293b, 1); // Dark interior
    const winW = 12, winH = 18;
    const wx = 10, wy = 6;
    
    // Bottom Rect
    graphics.fillRect(wx, wy + winW/2, winW, winH - winW/2);
    // Top Arch
    graphics.fillCircle(wx + winW/2, wy + winW/2, winW/2);
    
    // 4. Window Frame / Stained Glass Tracery
    graphics.lineStyle(1, 0xd4d4d8, 0.4);
    graphics.moveTo(wx + winW/2, wy);
    graphics.lineTo(wx + winW/2, wy + winH);
    graphics.moveTo(wx, wy + 10);
    graphics.lineTo(wx + winW, wy + 10);
    graphics.strokePath();

    // 5. Bevel / Shadow
    graphics.lineStyle(2, 0x44403c, 0.3);
    graphics.strokeRect(1, 1, 30, 30);
  }
}
