import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class WaterGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "water-texture";
  public readonly TEXTURE_KEY = WaterGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Azul base
    graphics.fillStyle(0x00bfff, 1); // DeepSkyBlue
    graphics.fillRect(0, 0, 32, 32);

    // Ondas simples
    graphics.lineStyle(1, 0xffffff, 0.4);
    
    // Onda 1
    graphics.beginPath();
    graphics.moveTo(5, 10);
    graphics.lineTo(15, 12);
    graphics.lineTo(25, 10);
    graphics.strokePath();

    // Onda 2
    graphics.beginPath();
    graphics.moveTo(8, 22);
    graphics.lineTo(18, 24);
    graphics.lineTo(28, 22);
    graphics.strokePath();
  }
}
