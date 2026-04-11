import Phaser from "phaser";
import { BaseEnemyGraphic } from "./BaseEnemyGraphic";

export class DemonGraphic extends BaseEnemyGraphic {
  public static readonly TEXTURE_KEY = "demon-texture";

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number
  ): Phaser.Physics.Arcade.Sprite {
    const textureKey = this.TEXTURE_KEY;
    if (!scene.textures.exists(textureKey)) this.createTexture(scene, textureKey);

    const sprite = scene.physics.add.sprite(x, y, textureKey);
    this.createStandardAnimations(scene, "demon", textureKey);
    sprite.setSize(this.SIZE.width, this.SIZE.height);
    return sprite;
  }

  protected drawEnemy(graphics: Phaser.GameObjects.Graphics): void {
    // Corpo enorme e musculoso
    graphics.fillStyle(0x8b0000, 1); // Vermelho escuro
    graphics.fillRect(10, 10, 12, 18); // Corpo maior que o orc

    // Cabeça com chifres
    graphics.fillStyle(0x660000, 1); // Vermelho mais escuro
    graphics.fillCircle(16, 8, 8); // Cabeça maior

    // Chifres
    graphics.fillStyle(0x333333, 1); // Cinza escuro
    graphics.fillTriangle(8, 4, 12, 0, 16, 4); // Chifre esquerdo
    graphics.fillTriangle(24, 4, 20, 0, 16, 4); // Chifre direito

    // Olhos flamejantes
    graphics.fillStyle(0xff4500, 1); // Laranja avermelhado
    graphics.fillCircle(13, 7, 2); // Olho esquerdo
    graphics.fillCircle(19, 7, 2); // Olho direito
    graphics.fillRect(14, 12, 4, 4); // Boca
    graphics.fillStyle(0xffffff, 1); // Dentes brancos
    graphics.fillTriangle(14, 12, 16, 14, 18, 12); // Dente superior
    graphics.fillTriangle(14, 16, 16, 14, 18, 16); // Dente inferior

    // Asas demoníacas
    graphics.fillStyle(0x4d0000, 1); // Vermelho muito escuro
    graphics.fillTriangle(0, 10, 10, 10, 5, 20); // Asa esquerda
    graphics.fillTriangle(32, 10, 22, 10, 27, 20); // Asa direita

    // Garras
    graphics.fillStyle(0x333333, 1); // Cinza escuro
    graphics.fillTriangle(8, 28, 10, 24, 12, 28); // Garra esquerda
    graphics.fillTriangle(20, 28, 22, 24, 24, 28); // Garra direita
  }
}
