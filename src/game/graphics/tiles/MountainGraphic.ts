import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class MountainGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "mountain-texture";
  public readonly TEXTURE_KEY = MountainGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Base da montanha
    graphics.fillStyle(0x696969, 1);
    graphics.fillTriangle(0, 32, 16, 8, 32, 32);

    // Neve no topo
    graphics.fillStyle(0xf5f5f5, 1);
    graphics.fillTriangle(12, 12, 16, 8, 20, 12);

    // Detalhes de sombra
    graphics.fillStyle(0x555555, 1);
    graphics.fillTriangle(0, 32, 16, 16, 16, 32);
  }
}
