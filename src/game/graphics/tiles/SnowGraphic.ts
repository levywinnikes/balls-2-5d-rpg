import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class SnowGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "snow-texture";
  public readonly TEXTURE_KEY = SnowGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // 1. Fundo branco nevado com leve brilho azulado
    graphics.fillGradientStyle(0xffffff, 0xffffff, 0xe0f7ff, 0xe0f7ff, 1);
    graphics.fillRect(0, 0, 32, 32);

    // 2. Pequenas saliências de neve / cristais
    graphics.lineStyle(1, 0xb0e2ff, 0.4);
    
    const points = [
        {x: 5, y: 5}, {x: 25, y: 8}, {x: 12, y: 15}, {x: 20, y: 25}, {x: 8, y: 28}
    ];

    points.forEach(p => {
        graphics.beginPath();
        graphics.moveTo(p.x, p.y);
        graphics.lineTo(p.x + 2, p.y + 1);
        graphics.strokePath();
    });

    // 3. Brilho de gelo (pontos puramente brancos)
    graphics.fillStyle(0xffffff, 0.8);
    for(let i=0; i<5; i++) {
        graphics.fillCircle(Math.random()*32, Math.random()*32, 0.5);
    }
  }
}
