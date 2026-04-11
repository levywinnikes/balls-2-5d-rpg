import Phaser from "phaser";
import { BaseEnemyGraphic } from "./BaseEnemyGraphic";

export class DragonGraphic extends BaseEnemyGraphic {
  public static readonly TEXTURE_KEY = "dragon-texture";
  public readonly TEXTURE_KEY = DragonGraphic.TEXTURE_KEY;
  protected static SIZE = { width: 64, height: 64 };

  static preload(scene: Phaser.Scene): void {
    super.preload(scene);
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number
  ): Phaser.Physics.Arcade.Sprite {
    const textureKey = new this().TEXTURE_KEY;

    if (!scene.textures.exists(textureKey)) {
      this.createTexture(scene, textureKey);
    }

    const sprite = scene.physics.add.sprite(x, y, textureKey);
    sprite.setSize(this.SIZE.width * 0.8, this.SIZE.height * 0.8);
    
    this.createStandardAnimations(scene, "dragon", textureKey);
    
    return sprite;
  }

  protected drawEnemy(graphics: Phaser.GameObjects.Graphics): void {
    // Escamas/Corpo (Bola roxa grande)
    graphics.fillStyle(0x4b0082, 1); // Indigo
    graphics.fillCircle(32, 32, 30);

    // Olhos brilhantes amarelo/fogo
    graphics.fillStyle(0xffff00, 1);
    graphics.fillCircle(22, 25, 6);
    graphics.fillCircle(42, 25, 6);
    graphics.fillStyle(0xff0000, 1);
    graphics.fillCircle(22, 25, 2);
    graphics.fillCircle(42, 25, 2);

    // Chifres/Espinhos
    graphics.fillStyle(0x2a004a, 1);
    graphics.fillTriangle(32, 2, 22, 12, 42, 12); // Superior
    graphics.fillTriangle(60, 20, 50, 32, 62, 32); // Direito
    graphics.fillTriangle(4, 20, 14, 32, 2, 32);   // Esquerdo

    // Boca soltando "fumaça" (pequeno círculo cinza)
    graphics.fillStyle(0x808080, 0.5);
    graphics.fillCircle(32, 45, 5);
  }
}
