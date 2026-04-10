import Phaser from "phaser";

export class InventoryIcons {
  // Cor principal dos ícones (vermelho do coração)
  private static readonly ICON_COLOR = 0xcccccc;
  private static readonly ICON_LIGHT = 0xe6e6e6;
  private static readonly ICON_DARK = 0xb3b3b3;

  public static drawBagIcon(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number
  ): void {
    // Mochila mais estilizada
    graphics.fillStyle(this.ICON_DARK, 1);
    graphics.fillRoundedRect(x - 12, y - 10, 24, 18, 5); // Bolsa principal

    graphics.fillStyle(this.ICON_COLOR, 1);
    graphics.fillRoundedRect(x - 10, y - 8, 20, 14, 3); // Parte frontal

    graphics.fillStyle(this.ICON_LIGHT, 1);
    graphics.fillRect(x - 8, y - 5, 16, 3); // Detalhe horizontal
    graphics.fillRect(x - 5, y - 1, 10, 3); // Detalhe horizontal

    // Alça da mochila
    graphics.fillStyle(this.ICON_DARK, 1);
    graphics.fillRoundedRect(x - 8, y - 15, 16, 6, 3);
  }

  public static drawStatusIcon(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number
  ): void {
    // Coração mais estilizado
    graphics.fillStyle(this.ICON_COLOR, 1);

    // Parte inferior do coração
    graphics.fillTriangle(x, y + 8, x - 10, y - 5, x + 10, y - 5);

    // Partes arredondadas superiores
    graphics.fillCircle(x - 5, y - 3, 6);
    graphics.fillCircle(x + 5, y - 3, 6);

    // Destaque
    graphics.fillStyle(this.ICON_LIGHT, 0.5);
    graphics.fillCircle(x - 3, y - 5, 2);
    graphics.fillCircle(x + 3, y - 5, 2);
  }

  public static drawEquipmentIcon(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number
  ): void {
    // Espada mais estilizada
    graphics.fillStyle(this.ICON_DARK, 1);
    graphics.fillRect(x - 2, y - 15, 4, 20); // Cabo

    graphics.fillStyle(this.ICON_COLOR, 1);
    graphics.fillTriangle(x - 8, y - 12, x + 8, y - 12, x, y + 5); // Lâmina

    // Guarda da espada
    graphics.fillStyle(this.ICON_DARK, 1);
    graphics.fillRect(x - 6, y - 10, 12, 3);

    // Detalhe na ponta
    graphics.fillStyle(this.ICON_LIGHT, 1);
    graphics.fillTriangle(x - 2, y + 3, x + 2, y + 3, x, y + 7);
  }
}
