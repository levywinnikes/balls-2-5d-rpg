import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class ConcreteWallGraphic extends BaseTileGraphic {
  public readonly TEXTURE_KEY = "concrete-wall-texture";

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Cinza base
    graphics.fillStyle(0x808080, 1);
    graphics.fillRect(0, 0, 32, 32);

    // Margens para dar profundidade (Bevel)
    graphics.lineStyle(2, 0x404040, 1);
    graphics.strokeRect(0, 0, 32, 32);

    // Detalhes de pedra/concreto
    graphics.fillStyle(0x606060, 1);
    graphics.fillRect(5, 5, 4, 4);
    graphics.fillRect(20, 15, 3, 3);
    graphics.fillRect(10, 22, 5, 5);
  }
}
