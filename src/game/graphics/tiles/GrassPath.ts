import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class GrassGraphicPath extends BaseTileGraphic {
  static readonly TEXTURE_KEY = "grass-texture-path";
  public readonly TEXTURE_KEY = GrassGraphicPath.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Base — terra batida
    graphics.fillStyle(0x8b6914, 1);
    graphics.fillRect(0, 0, 32, 32);
    // Pedras de caminho
    graphics.fillStyle(0x9e7c1e, 1);
    graphics.fillRect(2, 3, 12, 10);
    graphics.fillRect(18, 2, 12, 9);
    graphics.fillRect(5, 18, 10, 10);
    graphics.fillRect(17, 19, 13, 9);
    // Bordas escuras das pedras
    graphics.lineStyle(1, 0x5a4510, 1);
    graphics.strokeRect(2, 3, 12, 10);
    graphics.strokeRect(18, 2, 12, 9);
    graphics.strokeRect(5, 18, 10, 10);
    graphics.strokeRect(17, 19, 13, 9);
    // Grama nas bordas
    graphics.fillStyle(0x5ea033, 1);
    graphics.fillRect(0, 0, 2, 32);
    graphics.fillRect(30, 0, 2, 32);
  }
}
