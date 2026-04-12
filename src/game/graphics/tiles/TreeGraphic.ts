import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class TreeGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "tree-texture";
  public readonly TEXTURE_KEY = TreeGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Tronco marrom
    graphics.fillStyle(0x8b4513, 1);
    graphics.fillRect(14, 20, 4, 12);

    // Copa da árvore verde
    graphics.fillStyle(0x2e8b57, 1);
    graphics.fillTriangle(6, 20, 26, 20, 16, 4);

    // Detalhes na copa
    graphics.fillStyle(0x3cb371, 1);
    graphics.fillCircle(10, 16, 3);
    graphics.fillCircle(22, 16, 3);
    graphics.fillCircle(16, 10, 4);
  }
}
