import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class HouseWallCornerGraphicLeft extends BaseTileGraphic {
  static readonly TEXTURE_KEY = "house-wall-corner-left";
  public readonly TEXTURE_KEY = HouseWallCornerGraphicLeft.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Canto esquerdo — parte frontal (sul)
    graphics.fillStyle(0xc4874a, 1);
    graphics.fillRect(0, 0, 32, 32);
    // Coluna de canto
    graphics.fillStyle(0x8a5530, 1);
    graphics.fillRect(0, 0, 8, 32);
    // Tábuas horizontais
    graphics.fillStyle(0xa0693d, 1);
    for (let y = 0; y < 32; y += 8) {
      graphics.fillRect(8, y, 24, 2);
    }
    // Topo
    graphics.fillStyle(0x7a4a25, 1);
    graphics.fillRect(0, 0, 32, 2);
  }
}
