import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class CorruptedGrassGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "corrupted-grass-texture";
  public readonly TEXTURE_KEY = CorruptedGrassGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Fundo Roxo Escuro
    graphics.fillStyle(0x312e81, 1);
    graphics.fillRect(0, 0, 32, 32);

    // Manchas Magenta (Corrupção)
    graphics.fillStyle(0x701a75, 0.7);
    graphics.fillCircle(10, 10, 5);
    graphics.fillCircle(25, 25, 6);
    graphics.fillCircle(5, 28, 4);

    // Pontos Brilhantes Magenta (Esporos)
    graphics.fillStyle(0xd946ef, 1);
    graphics.fillRect(12, 12, 2, 2);
    graphics.fillRect(22, 18, 2, 2);
    graphics.fillRect(8, 26, 1, 1);
    graphics.fillRect(28, 4, 2, 2);
  }
}
