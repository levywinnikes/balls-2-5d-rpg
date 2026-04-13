import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class CactusGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "cactus-texture";
  public readonly TEXTURE_KEY = CactusGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Fundo Areia (Padrão para deserto)
    graphics.fillStyle(0xfde047, 1);
    graphics.fillRect(0, 0, 32, 32);

    // Corpo do Cacto (Verde vibrante)
    graphics.fillStyle(0x166534, 1);
    
    // Tronco principal
    graphics.fillRect(13, 8, 6, 20);
    graphics.fillCircle(16, 8, 3);

    // Braço esquerdo
    graphics.fillRect(9, 14, 4, 3);
    graphics.fillRect(7, 10, 3, 7);
    graphics.fillCircle(8.5, 10, 1.5);

    // Braço direito
    graphics.fillRect(19, 18, 4, 3);
    graphics.fillRect(22, 13, 3, 8);
    graphics.fillCircle(23.5, 13, 1.5);

    // Detalhes/Espinhos (Pontos amarelos minúsculos)
    graphics.fillStyle(0xfef08a, 1);
    graphics.fillRect(15, 12, 1, 1);
    graphics.fillRect(17, 18, 1, 1);
    graphics.fillRect(8, 12, 1, 1);
    graphics.fillRect(24, 15, 1, 1);
  }
}
