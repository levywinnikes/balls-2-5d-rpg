import Phaser from "phaser";
import { BaseShieldGraphic } from "./BaseShieldGraphic";

export class ShieldGraphic extends BaseShieldGraphic {
  public readonly TEXTURE_KEY = "shield-texture";

  constructor() {
    super("shield-texture");
  }

  static preload(scene: Phaser.Scene): void {
    super.preload(scene, "shield-texture");
  }

  static create(scene: Phaser.Scene): Phaser.GameObjects.Sprite {
    const textureKey = "shield-texture";

    if (!scene.textures.exists(textureKey)) {
      ShieldGraphic.createShieldTexture(scene, textureKey);
    }

    const sprite = scene.add.sprite(0, 0, textureKey);
    sprite.setOrigin(0.5, 0.5);
    return sprite;
  }

  // Método renomeado para evitar conflito com o método protegido da base
  private static createShieldTexture(
    scene: Phaser.Scene,
    textureKey: string
  ): void {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get canvas context");
    }

    // Fundo transparente
    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fillRect(0, 0, 32, 32);

    // Forma básica do escudo
    ctx.fillStyle = "#8B4513";
    ctx.beginPath();
    ctx.ellipse(16, 16, 12, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Detalhes do escudo
    ctx.strokeStyle = "#A0522D";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(16, 16, 10, 13, 0, 0, Math.PI * 2);
    ctx.stroke();

    scene.textures.addCanvas(textureKey, canvas);
  }

  drawShield(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x8b4513, 1);
    graphics.fillEllipse(16, 16, 12, 15);

    graphics.lineStyle(2, 0xa0522d, 1);
    graphics.strokeEllipse(16, 16, 10, 13);
  }
}
