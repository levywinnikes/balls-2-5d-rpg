import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class LavaGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "lava-texture";
  public readonly TEXTURE_KEY = LavaGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // 1. Fundo Magma (Vermelho Escuro / Laranja Escuro)
    graphics.fillGradientStyle(0x8b0000, 0x8b0000, 0xff4500, 0xff4500, 1);
    graphics.fillRect(0, 0, 32, 32);

    // 2. Fluxos de Lava (Amarelo / Laranja Brilhante)
    graphics.lineStyle(2, 0xffff00, 0.6);
    
    // Ondas de calor
    for (let i = 0; i < 3; i++) {
        const y = 8 + i * 8;
        graphics.beginPath();
        graphics.moveTo(0, y);
        graphics.lineTo(8, y + 2);
        graphics.lineTo(16, y - 2);
        graphics.lineTo(24, y + 2);
        graphics.lineTo(32, y);
        graphics.strokePath();
    }

    // 3. Bolhas de ar/gás (Círculos escuros e claros)
    graphics.fillStyle(0xff8c00, 0.8);
    graphics.fillCircle(10, 10, 2);
    graphics.fillCircle(25, 22, 1.5);
    
    graphics.fillStyle(0x000000, 0.2);
    graphics.fillCircle(12, 12, 1);
  }
}
