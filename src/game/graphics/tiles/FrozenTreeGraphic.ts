import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class FrozenTreeGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "frozen-tree-texture";
  public readonly TEXTURE_KEY = FrozenTreeGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // 1. Fundo Neve (blend)
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(0, 0, 32, 32);

    // 2. Tronco (Marrom acinzentado frio)
    graphics.fillStyle(0x4a4a4a, 1);
    graphics.fillRect(14, 20, 4, 12);

    // 3. Folhagem com Neve (Cones empilhados)
    graphics.fillStyle(0x2f4f4f, 1); // Verde bem escuro
    
    // Cone de baixo
    graphics.fillTriangle(4, 25, 28, 25, 16, 15);
    // Cone do meio
    graphics.fillTriangle(6, 18, 26, 18, 16, 8);
    // Cone do topo
    graphics.fillTriangle(10, 10, 22, 10, 16, 2);

    // 4. Acúmulo de Neve (Topo dos cones)
    graphics.fillStyle(0xffffff, 1);
    graphics.fillTriangle(12, 15, 20, 15, 16, 12);
    graphics.fillTriangle(14, 8, 18, 8, 16, 5);
  }
}
