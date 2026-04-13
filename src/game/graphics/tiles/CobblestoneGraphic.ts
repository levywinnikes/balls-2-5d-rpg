import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class CobblestoneGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "cobblestone-texture";
  public readonly TEXTURE_KEY = CobblestoneGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Fundo Cimento (Cinza médio)
    graphics.fillStyle(0x64748b, 1);
    graphics.fillRect(0, 0, 32, 32);

    // Pedras Individuais (Cinza claro e escuro)
    const stones = [
        { x: 2, y: 2, w: 12, h: 12, c: 0x94a3b8 },
        { x: 16, y: 4, w: 13, h: 10, c: 0x475569 },
        { x: 4, y: 16, w: 10, h: 13, c: 0x475569 },
        { x: 16, y: 18, w: 14, h: 11, c: 0x94a3b8 }
    ];

    stones.forEach(s => {
        graphics.fillStyle(s.c, 1);
        graphics.fillRect(s.x, s.y, s.w, s.h);
        // Borda da pedra
        graphics.lineStyle(1, 0x1e293b, 0.5);
        graphics.strokeRect(s.x, s.y, s.w, s.h);
    });
  }
}
