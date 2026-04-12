import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class SandGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "sand-texture";
  public readonly TEXTURE_KEY = SandGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    const w = 32;
    const h = 32;

    // Fundo areia clara (tons quentes)
    graphics.fillStyle(0xf4e1a1, 1); // amarelo areia claro
    graphics.fillRect(0, 0, w, h);

    // Leve variação de cor para evitar visual plano (ruído)
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(0, w);
      const y = Phaser.Math.Between(0, h);
      const alpha = Phaser.Math.FloatBetween(0.05, 0.15);
      const color = Phaser.Display.Color.GetColor(
        240 + Phaser.Math.Between(-10, 10),
        225 + Phaser.Math.Between(-15, 15),
        160 + Phaser.Math.Between(-10, 10)
      );
      graphics.fillStyle(color, alpha);
      graphics.fillRect(x, y, 1, 1);
    }

    // Pequenas ondulações/linhas suaves para simular vento/areia movendo
    graphics.lineStyle(1, 0xe5d392, 0.2);
    for (let i = 0; i < 2; i++) {
      const startY = Phaser.Math.Between(2, h - 6);
      graphics.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = startY + Math.sin((x + i * 20) * 0.5) * 2;
        if (x === 0) {
          graphics.moveTo(x, y);
        } else {
          graphics.lineTo(x, y);
        }
      }
      graphics.strokePath();
    }

    // Pontinhos pequenos representando grãos de areia um pouco mais escuros
    graphics.fillStyle(0xd2b56a, 0.7);
    for (let i = 0; i < 10; i++) {
        const x = Phaser.Math.Between(0, w);
        const y = Phaser.Math.Between(0, h);
        graphics.fillCircle(x, y, 0.6);
    }

    // Pedrinhas pequenas
    graphics.fillStyle(0xbfa26a, 0.5);
    for (let i = 0; i < 5; i++) {
      const x = Phaser.Math.Between(2, w - 4);
      const y = Phaser.Math.Between(2, h - 4);
      graphics.fillEllipse(
        x,
        y,
        Phaser.Math.Between(2, 3),
        Phaser.Math.Between(1, 2)
      );
    }

    // Conchinhas
    graphics.fillStyle(0xfff5e1, 0.8);
    graphics.lineStyle(1, 0xe0d6b0, 0.6);
    for (let i = 0; i < 1; i++) {
      const x = Phaser.Math.Between(4, w - 6);
      const y = Phaser.Math.Between(4, h - 6);
      graphics.fillCircle(x, y, 2);
      graphics.beginPath();
      graphics.moveTo(x - 1, y);
      graphics.lineTo(x + 1, y);
      graphics.strokePath();
    }
  }
}
