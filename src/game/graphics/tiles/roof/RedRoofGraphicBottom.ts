import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class RedRoofGraphicBottom extends BaseTileGraphic {
  static readonly TEXTURE_KEY = "Red-Roof-texture-bottom";
  public readonly TEXTURE_KEY = RedRoofGraphicBottom.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Parte inferior do telhado — beiral
    graphics.fillStyle(0xb22020, 1);
    graphics.fillRect(0, 0, 32, 24);
    // Beiral com sombra
    graphics.fillStyle(0x6b0f0f, 1);
    graphics.fillRect(0, 24, 32, 8);
    // Destaque do topo
    graphics.fillStyle(0xd44040, 1);
    graphics.fillRect(0, 0, 32, 5);
    // Linhas de telha
    graphics.lineStyle(1, 0x7a0f0f, 1);
    graphics.strokeLineShape(new Phaser.Geom.Line(0, 12, 32, 12));
    graphics.strokeLineShape(new Phaser.Geom.Line(8, 12, 8, 24));
    graphics.strokeLineShape(new Phaser.Geom.Line(24, 12, 24, 24));
  }
}
