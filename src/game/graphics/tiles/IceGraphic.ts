import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class IceGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "ice-texture";
  public readonly TEXTURE_KEY = IceGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // 1. Fundo Azul Gelo Semi-Translucido
    graphics.fillGradientStyle(0xadd8e6, 0xadd8e6, 0x00bfff, 0x00bfff, 1);
    graphics.fillRect(0, 0, 32, 32);

    // 2. Rachaduras internas (Branco/Azul claro)
    graphics.lineStyle(1, 0xffffff, 0.4);
    
    graphics.beginPath();
    graphics.moveTo(5, 5);
    graphics.lineTo(15, 20);
    graphics.lineTo(25, 15);
    graphics.strokePath();

    graphics.beginPath();
    graphics.moveTo(10, 25);
    graphics.lineTo(20, 22);
    graphics.strokePath();

    // 3. Brilho de superfície
    graphics.fillStyle(0xffffff, 0.2);
    graphics.fillTriangle(0, 0, 15, 0, 0, 15);
  }
}
