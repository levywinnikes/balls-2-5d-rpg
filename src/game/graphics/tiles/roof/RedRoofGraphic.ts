import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class RedRoofGraphic extends BaseTileGraphic {
  static readonly TEXTURE_KEY = "Red-Roof-texture";
  public readonly TEXTURE_KEY = RedRoofGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Telha vermelha — bloco central
    graphics.fillStyle(0xb22020, 1); // Vermelho escuro
    graphics.fillRect(0, 0, 32, 32);
    // Sombra superior
    graphics.fillStyle(0x8b1010, 1);
    graphics.fillRect(0, 0, 32, 8);
    // Destaque inferior
    graphics.fillStyle(0xd44040, 1);
    graphics.fillRect(0, 24, 32, 8);
    // Linhas de telha separadas
    graphics.lineStyle(1, 0x7a0f0f, 1);
    graphics.strokeLineShape(new Phaser.Geom.Line(0, 16, 32, 16));
    graphics.lineStyle(1, 0x7a0f0f, 0.5);
    graphics.strokeLineShape(new Phaser.Geom.Line(8, 0, 8, 16));
    graphics.strokeLineShape(new Phaser.Geom.Line(24, 0, 24, 16));
    graphics.strokeLineShape(new Phaser.Geom.Line(16, 16, 16, 32));
  }
}
