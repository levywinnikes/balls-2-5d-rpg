import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class DirtyFloorGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "dirty-floor-texture";
  public readonly TEXTURE_KEY = DirtyFloorGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    const size = 32;

    // Base marrom-terra mais uniforme (estilo chão)
    graphics.fillStyle(0x795548, 1);
    graphics.fillRect(0, 0, size, size);

    // Divisões sutis (estilo solo batido)
    graphics.lineStyle(2, 0x5d4037, 0.4);
    graphics.beginPath();
    graphics.moveTo(0, 16);
    graphics.lineTo(32, 16);
    graphics.moveTo(16, 0);
    graphics.lineTo(16, 32);
    graphics.strokePath();

    // Textura de grãos/areia
    graphics.fillStyle(0x4e342e, 0.3);
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      graphics.fillRect(x, y, 1, 1);
    }
  }
}
