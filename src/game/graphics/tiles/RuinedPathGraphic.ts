import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class RuinedPathGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "ruined-path-texture";
  public readonly TEXTURE_KEY = RuinedPathGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Fundo Terra (Marrom pálido)
    graphics.fillStyle(0x78350f, 1);
    graphics.fillRect(0, 0, 32, 32);

    // Pedras Quebradas (Cinza)
    graphics.fillStyle(0x64748b, 0.8);
    graphics.fillRect(5, 5, 8, 12);
    graphics.fillRect(20, 15, 6, 6);
    graphics.fillRect(10, 22, 10, 4);

    // Musgo (Verde escuro)
    graphics.fillStyle(0x166534, 0.6);
    graphics.fillCircle(8, 8, 4);
    graphics.fillCircle(25, 20, 3);
    
    // Rachaduras
    graphics.lineStyle(1, 0x1e293b, 0.4);
    graphics.beginPath();
    graphics.moveTo(5, 5);
    graphics.lineTo(20, 20);
    graphics.strokePath();
  }
}
