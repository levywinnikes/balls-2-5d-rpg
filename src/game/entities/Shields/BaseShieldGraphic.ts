import Phaser from "phaser";

export abstract class BaseShieldGraphic {
  constructor(protected readonly textureKey: string) {}

  protected static preload(scene: Phaser.Scene, textureKey: string): void {
    if (!scene.textures.exists(textureKey)) {
      scene.load.image(textureKey, this.createBase64Texture());
    }
  }

  protected static createBase64Texture(): string {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get canvas context");
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fillRect(0, 0, 32, 32);

    return canvas.toDataURL();
  }

  protected static createTexture(
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

    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fillRect(0, 0, 32, 32);

    scene.textures.addCanvas(textureKey, canvas);
  }

  abstract drawShield(graphics: Phaser.GameObjects.Graphics): void;
}
