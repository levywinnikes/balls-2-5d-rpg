import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class StairDownGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "stair-down-texture";
  public readonly TEXTURE_KEY = StairDownGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Escada de madeira descendo (tons escuros / buraco)
    graphics.fillStyle(0x3d1f05, 1);
    graphics.fillRect(2, 2, 28, 28);
    
    graphics.lineStyle(2, 0x000000, 1);
    for (let i = 0; i < 5; i++) {
        graphics.strokeLineShape(new Phaser.Geom.Line(2, 6 + i * 5, 30, 6 + i * 5));
    }
  }
}
