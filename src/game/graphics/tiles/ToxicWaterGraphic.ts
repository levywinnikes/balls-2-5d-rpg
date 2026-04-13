import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class ToxicWaterGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "toxic-water-texture";
  public readonly TEXTURE_KEY = ToxicWaterGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Fundo Verde Radioativo (Escuro)
    graphics.fillStyle(0x064e3b, 1);
    graphics.fillRect(0, 0, 32, 32);

    // Ondas/Brilho (Verde Limão Brilhante)
    graphics.fillStyle(0x4ade80, 0.4);
    graphics.fillRect(0, 8, 32, 4);
    graphics.fillRect(0, 22, 32, 3);

    // Partículas de "veneno"
    graphics.fillStyle(0xccff00, 0.8);
    graphics.fillRect(5, 5, 2, 2);
    graphics.fillRect(20, 15, 2, 2);
    graphics.fillRect(10, 25, 1, 1);
    graphics.fillRect(28, 10, 2, 2);
  }
}
