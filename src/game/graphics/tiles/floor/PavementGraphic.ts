import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class PavementGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "pavement-texture";
  public readonly TEXTURE_KEY = PavementGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Cinza base (concreto)
    graphics.fillStyle(0x7a7a7a, 1);
    graphics.fillRect(0, 0, 32, 32);

    // Bevel edges (Efeito de bloco de concreto)
    graphics.lineStyle(2, 0x5a5a5a, 0.8);
    graphics.strokeRect(1, 1, 30, 30);

    // Detalhes de textura (pedras menores/imperfeições)
    graphics.fillStyle(0x6a6a6a, 0.6);
    graphics.fillRect(4, 4, 3, 3);
    graphics.fillRect(22, 6, 2, 2);
    graphics.fillRect(12, 18, 4, 4);
    graphics.fillRect(25, 23, 3, 3);
    
    // Subtle cross-lines for urban pavement grid
    graphics.lineStyle(1, 0x5a5a5a, 0.3);
    graphics.moveTo(16, 0);
    graphics.lineTo(16, 32);
    graphics.moveTo(0, 16);
    graphics.lineTo(32, 16);
  }
}
