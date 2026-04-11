import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class RedRoofGraphicRight extends BaseTileGraphic {
  static readonly TEXTURE_KEY = "Red-Roof-texture-right";
  public readonly TEXTURE_KEY = RedRoofGraphicRight.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Lateral direita do telhado
    graphics.fillStyle(0xb22020, 1);
    graphics.fillRect(0, 0, 32, 32);
    // Borda direita escura
    graphics.fillStyle(0x6b0f0f, 1);
    graphics.fillRect(26, 0, 6, 32);
    // Sombra superior
    graphics.fillStyle(0x8b1010, 1);
    graphics.fillRect(0, 0, 32, 8);
    // Linhas de telha
    graphics.lineStyle(1, 0x7a0f0f, 1);
    graphics.strokeLineShape(new Phaser.Geom.Line(0, 16, 26, 16));
    graphics.strokeLineShape(new Phaser.Geom.Line(12, 0, 12, 16));
  }
}
