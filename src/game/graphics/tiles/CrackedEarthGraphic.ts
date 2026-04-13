import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class CrackedEarthGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "cracked-earth-texture";
  public readonly TEXTURE_KEY = CrackedEarthGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Fundo Terra Seca (Bege/Laranja pálido)
    graphics.fillStyle(0xd2b48c, 1);
    graphics.fillRect(0, 0, 32, 32);

    // Rachaduras (Marrom escuro)
    graphics.lineStyle(2, 0x8b4513, 0.4);
    
    // Desenhar linhas de rachadura orgânicas
    graphics.beginPath();
    graphics.moveTo(5, 5);
    graphics.lineTo(12, 12);
    graphics.lineTo(8, 20);
    graphics.strokePath();

    graphics.beginPath();
    graphics.moveTo(25, 3);
    graphics.lineTo(18, 15);
    graphics.lineTo(28, 25);
    graphics.strokePath();

    graphics.beginPath();
    graphics.moveTo(2, 28);
    graphics.lineTo(15, 22);
    graphics.lineTo(20, 30);
    graphics.strokePath();
  }
}
