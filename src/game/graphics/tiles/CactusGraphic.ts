import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class CactusGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "cactus-texture";
  public readonly TEXTURE_KEY = CactusGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // 1. Fundo Areia (igual ao SandGraphic para blend)
    graphics.fillStyle(0xf4e1a1, 1);
    graphics.fillRect(0, 0, 32, 32);

    // 2. Cactus (Verde Escuro)
    graphics.fillStyle(0x2d5a27, 1);
    
    // Tronco principal
    graphics.fillRect(12, 10, 8, 20);
    graphics.fillCircle(16, 10, 4); // Topo redondo

    // Braço esquerdo
    graphics.fillRect(8, 15, 4, 3);
    graphics.fillRect(6, 10, 3, 8);
    graphics.fillCircle(7.5, 10, 1.5);

    // Braço direito
    graphics.fillRect(20, 18, 4, 3);
    graphics.fillRect(23, 13, 3, 8);
    graphics.fillCircle(24.5, 13, 1.5);

    // Pontinhos/Espinhos (Amarelo claro)
    graphics.fillStyle(0xffffcc, 0.6);
    graphics.fillRect(15, 12, 1, 1);
    graphics.fillRect(18, 15, 1, 1);
    graphics.fillRect(7, 12, 1, 1);
  }
}
