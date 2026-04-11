import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class HouseWallBackGraphic extends BaseTileGraphic {
  static readonly TEXTURE_KEY = "house-wall-texture-back";
  public readonly TEXTURE_KEY = HouseWallBackGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Parede traseira de casa — madeira mais escura (North face, in shade)
    graphics.fillStyle(0xa0693d, 1);
    graphics.fillRect(0, 0, 32, 32);
    // Tábuas horizontais
    graphics.fillStyle(0x8a5530, 1);
    for (let y = 0; y < 32; y += 8) {
      graphics.fillRect(0, y, 32, 2);
    }
    // Borda escura nas laterais
    graphics.fillStyle(0x5a3319, 1);
    graphics.fillRect(0, 0, 2, 32);
    graphics.fillRect(30, 0, 2, 32);
  }
}
