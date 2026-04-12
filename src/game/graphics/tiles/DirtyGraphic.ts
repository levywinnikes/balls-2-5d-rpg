import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class DirtyGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "dirty-texture";
  public readonly TEXTURE_KEY = DirtyGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    const size = 32;

    // Base marrom-terra
    graphics.fillStyle(0x5d4037, 1);
    graphics.fillRect(0, 0, size, size);

    // Detalhes de terra (manchas mais escuras)
    graphics.fillStyle(0x3e2723, 0.6);
    for (let i = 0; i < 8; i++) {
      const x = Phaser.Math.Between(0, size);
      const y = Phaser.Math.Between(0, size);
      const s = Phaser.Math.Between(3, 8);
      graphics.fillCircle(x, y, s);
    }

    // Pedrinhas e detritos
    graphics.fillStyle(0xbcaaa4, 1);
    for (let i = 0; i < 5; i++) {
      const x = Phaser.Math.Between(2, size - 2);
      const y = Phaser.Math.Between(2, size - 2);
      graphics.fillRect(x, y, 2, 2);
    }
  }
}
