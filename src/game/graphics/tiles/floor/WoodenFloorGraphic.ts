import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class WoodenFloorGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "wooden-floor-texture";
  public readonly TEXTURE_KEY = WoodenFloorGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Marrom base
    graphics.fillStyle(0x8b4513, 1); // SaddleBrown
    graphics.fillRect(0, 0, 32, 32);

    // Linhas de tábuas
    graphics.lineStyle(1, 0x5d2e0a, 1);
    
    // Linha horizontal superior/inferior
    graphics.strokeLineShape(new Phaser.Geom.Line(0, 0, 32, 0));
    graphics.strokeLineShape(new Phaser.Geom.Line(0, 31, 32, 31));

    // Divisões horizontais (tábuas)
    graphics.strokeLineShape(new Phaser.Geom.Line(0, 10, 32, 10));
    graphics.strokeLineShape(new Phaser.Geom.Line(0, 21, 32, 21));

    // Divisões verticais (desalinhadas)
    graphics.strokeLineShape(new Phaser.Geom.Line(10, 0, 10, 10));
    graphics.strokeLineShape(new Phaser.Geom.Line(22, 10, 22, 21));
    graphics.strokeLineShape(new Phaser.Geom.Line(15, 21, 15, 32));
  }
}
