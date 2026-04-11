import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class GrassGraphicTop extends BaseTileGraphic {
  static readonly TEXTURE_KEY = "grass-texture-top";
  public readonly TEXTURE_KEY = GrassGraphicTop.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Base da grama — terra escura
    graphics.fillStyle(0x4a7c2f, 1);
    graphics.fillRect(0, 0, 32, 32);
    // Tufos de grama
    graphics.fillStyle(0x5ea033, 1);
    for (let gx = 2; gx < 32; gx += 6) {
      graphics.fillRect(gx, 8, 3, 14);
      graphics.fillRect(gx + 1, 4, 2, 5);
    }
    // Sombra leve no fundo
    graphics.fillStyle(0x3a6020, 0.5);
    graphics.fillRect(0, 28, 32, 4);
    // Detalhes claros no topo
    graphics.fillStyle(0x7ecf45, 1);
    for (let gx = 4; gx < 30; gx += 8) {
      graphics.fillRect(gx, 6, 2, 8);
    }
  }
}
