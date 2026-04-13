import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class CrystalSpikeGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "crystal-spike-texture";
  public readonly TEXTURE_KEY = CrystalSpikeGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Fundo Chão Escuro (Dungeon)
    graphics.fillStyle(0x1e293b, 1);
    graphics.fillRect(0, 0, 32, 32);

    // Cristal (Triângulo/Diamante)
    // Usaremos cores translúcidas para dar efeito de cristal
    graphics.fillStyle(0x38bdf8, 0.8);
    
    // Espinho principal
    graphics.fillTriangle(16, 5, 8, 25, 24, 25);
    
    // Brilho lateral
    graphics.fillStyle(0xe0f2fe, 0.6);
    graphics.fillTriangle(16, 5, 12, 15, 16, 25);
    
    // Luz de cores variadas (Aura mágica)
    graphics.fillStyle(0x818cf8, 0.4);
    graphics.fillCircle(16, 16, 8);
  }
}
