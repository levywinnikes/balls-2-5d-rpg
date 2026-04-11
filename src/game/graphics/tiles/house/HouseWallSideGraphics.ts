import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class HouseWallSideGraphic extends BaseTileGraphic {
  static readonly TEXTURE_KEY = "house-wall-side-texture";
  public readonly TEXTURE_KEY = HouseWallSideGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Parede lateral de casa — perspectiva oblíqua
    graphics.fillStyle(0xa0693d, 1); // Madeira um pouco mais escura (lateral = sombra)
    graphics.fillRect(0, 0, 32, 32);
    // Tábuas verticais visíveis na lateral
    graphics.fillStyle(0x8a5530, 1);
    for (let x = 0; x < 32; x += 10) {
      graphics.fillRect(x, 0, 2, 32);
    }
    // Destaque lateral esquerdo
    graphics.fillStyle(0xc4874a, 1);
    graphics.fillRect(0, 0, 3, 32);
    // Sombra superior
    graphics.fillStyle(0x5a3319, 1);
    graphics.fillRect(0, 0, 32, 2);
  }
}
