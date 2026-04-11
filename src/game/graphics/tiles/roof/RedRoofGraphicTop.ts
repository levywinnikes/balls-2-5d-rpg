import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class RedRoofGraphicTop extends BaseTileGraphic {
  static readonly TEXTURE_KEY = "Red-Roof-texture-top";
  public readonly TEXTURE_KEY = RedRoofGraphicTop.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Topo do telhado — cumeeira
    graphics.fillStyle(0x8b1010, 1); // Vermelho bem escuro para cumeeira
    graphics.fillRect(0, 0, 32, 32);
    // Cumeeira (linha de topo)
    graphics.fillStyle(0x5a0000, 1);
    graphics.fillRect(0, 0, 32, 6);
    // Corpo da telha
    graphics.fillStyle(0xb22020, 1);
    graphics.fillRect(0, 6, 32, 26);
    // Linhas de telha
    graphics.lineStyle(1, 0x7a0f0f, 1);
    graphics.strokeLineShape(new Phaser.Geom.Line(0, 18, 32, 18));
    graphics.strokeLineShape(new Phaser.Geom.Line(16, 6, 16, 32));
  }
}
