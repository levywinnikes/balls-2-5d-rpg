import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class MudGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "mud-texture";
  public readonly TEXTURE_KEY = MudGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Fundo Lama (Marrom escuro/esverdeado)
    graphics.fillStyle(0x451a03, 1);
    graphics.fillRect(0, 0, 32, 32);

    // Bolhas/Textura viscosity (Círculos marrom médio)
    graphics.fillStyle(0x713f12, 0.6);
    graphics.fillCircle(10, 10, 6);
    graphics.fillCircle(24, 22, 5);
    graphics.fillCircle(8, 26, 4);

    // Detalhes brilhantes (Reflexo da lama)
    graphics.fillStyle(0xa16207, 0.3);
    graphics.fillRect(12, 8, 4, 1);
    graphics.fillRect(22, 20, 3, 1);
  }
}
