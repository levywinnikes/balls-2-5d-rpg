import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class IceCaveFloorGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "ice-cave-floor-texture";
  public readonly TEXTURE_KEY = IceCaveFloorGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Fundo Azul Gelo
    graphics.fillStyle(0x0c4a6e, 1);
    graphics.fillRect(0, 0, 32, 32);

    // Rachaduras no gelo (Ciano claro)
    graphics.lineStyle(1, 0x38bdf8, 0.5);
    graphics.beginPath();
    graphics.moveTo(0, 5);
    graphics.lineTo(32, 28);
    graphics.strokePath();

    graphics.beginPath();
    graphics.moveTo(32, 5);
    graphics.lineTo(0, 15);
    graphics.strokePath();

    // Cristais de gelo (Brilho branco)
    graphics.fillStyle(0xffffff, 0.4);
    graphics.fillCircle(16, 16, 3);
    graphics.fillCircle(5, 5, 2);
    graphics.fillCircle(25, 10, 2);
  }
}
