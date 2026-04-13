import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class ObsidianFloorGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "obsidian-floor-texture";
  public readonly TEXTURE_KEY = ObsidianFloorGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Fundo Preto Obsidiana
    graphics.fillStyle(0x0a0a0a, 1);
    graphics.fillRect(0, 0, 32, 32);

    // Detalhes Geométricos/Rachaduras (Púrpura escuro)
    graphics.lineStyle(2, 0x1e1b4b, 0.5);
    graphics.strokeRect(4, 4, 24, 24);
    
    // Pequenos pontos de brilho de lava (Laranja/Vermelho intenso)
    graphics.fillStyle(0xb91c1c, 0.6);
    graphics.fillRect(10, 10, 2, 2);
    graphics.fillRect(22, 20, 2, 2);
    
    // Reflexo vítreo (Azul muito escuro)
    graphics.fillStyle(0x1e293b, 0.3);
    graphics.fillRect(5, 5, 22, 2);
  }
}
