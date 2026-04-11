import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class StairUpGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "stair-up-texture";
  public readonly TEXTURE_KEY = StairUpGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Escada de madeira subindo (tons mais claros)
    graphics.fillStyle(0x8b4513, 1);
    graphics.fillRect(2, 2, 28, 28);
    
    graphics.lineStyle(2, 0xd2b48c, 1); // Tan color to highlight steps
    for (let i = 0; i < 5; i++) {
        graphics.strokeLineShape(new Phaser.Geom.Line(2, 6 + i * 5, 30, 6 + i * 5));
    }
  }
}
