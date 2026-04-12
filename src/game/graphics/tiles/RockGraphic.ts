import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class RockGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "rock-texture";
  public readonly TEXTURE_KEY = RockGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Base da pedra
    graphics.fillStyle(0x708090, 1);
    graphics.fillEllipse(16, 16, 10, 8);

    // Detalhes de sombra
    graphics.fillStyle(0x5f6a6a, 1);
    graphics.fillEllipse(16, 18, 8, 6);

    // Detalhes de luz
    graphics.fillStyle(0x8c9c9c, 1);
    graphics.fillEllipse(14, 12, 3, 2);
    graphics.fillEllipse(18, 14, 2, 3);
  }
}
