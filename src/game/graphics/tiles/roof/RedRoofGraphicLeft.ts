import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class RedRoofGraphicLeft extends BaseTileGraphic {
  static readonly TEXTURE_KEY = "Red-Roof-texture-left";
  public readonly TEXTURE_KEY = RedRoofGraphicLeft.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Lateral esquerda do telhado
    graphics.fillStyle(0xb22020, 1);
    graphics.fillRect(0, 0, 32, 32);
    // Borda esquerda escura
    graphics.fillStyle(0x6b0f0f, 1);
    graphics.fillRect(0, 0, 6, 32);
    // Sombra superior
    graphics.fillStyle(0x8b1010, 1);
    graphics.fillRect(0, 0, 32, 8);
    // Linhas de telha
    graphics.lineStyle(1, 0x7a0f0f, 1);
    graphics.strokeLineShape(new Phaser.Geom.Line(6, 16, 32, 16));
    graphics.strokeLineShape(new Phaser.Geom.Line(20, 0, 20, 16));
  }
}
