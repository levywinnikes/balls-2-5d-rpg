import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class HouseWallFrontGraphic extends BaseTileGraphic {
  static readonly TEXTURE_KEY = "house-wall-texture-front";
  public readonly TEXTURE_KEY = HouseWallFrontGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Parede frontal de casa — madeira clara
    graphics.fillStyle(0xc4874a, 1); // Marrom madeira
    graphics.fillRect(0, 0, 32, 32);
    // Tábuas horizontais
    graphics.fillStyle(0xa0693d, 1);
    for (let y = 0; y < 32; y += 8) {
      graphics.fillRect(0, y, 32, 2);
    }
    // Borda escura nas laterais
    graphics.fillStyle(0x7a4a25, 1);
    graphics.fillRect(0, 0, 2, 32);
    graphics.fillRect(30, 0, 2, 32);
    // Topo sombra
    graphics.fillStyle(0x7a4a25, 1);
    graphics.fillRect(0, 0, 32, 2);
  }
}
