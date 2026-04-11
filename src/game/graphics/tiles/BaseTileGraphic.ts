import Phaser from "phaser";

export abstract class BaseTileGraphic {
  protected static SIZE = { width: 32, height: 32 };
  
  // To be overridden in subclasses as 'static readonly TEXTURE_KEY'
  // and 'public readonly TEXTURE_KEY' (for instance access if needed)

  static preload(scene: Phaser.Scene): void {
    const textureKey = (this as any).TEXTURE_KEY;
    if (!textureKey) {
        console.warn("BaseTileGraphic.preload called on class without TEXTURE_KEY", this);
        return;
    }
    if (!scene.textures.exists(textureKey)) {
      this.createTexture(scene, textureKey);
    }
  }

  protected static createTexture(
    scene: Phaser.Scene,
    textureKey: string
  ): void {
    const graphics = scene.add.graphics();

    // Call drawTile (instantiating subclass instance safely)
    const instance = new (this as any)();
    instance.drawTile(graphics);

    graphics.generateTexture(textureKey, this.SIZE.width, this.SIZE.height);
    graphics.destroy();
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number,
    pool?: Phaser.GameObjects.Sprite[]
  ): Phaser.GameObjects.Sprite {
    const textureKey = (this as any).TEXTURE_KEY;

    if (!scene.textures.exists(textureKey)) {
      this.createTexture(scene, textureKey);
    }

    const sprite = scene.add.sprite(x, y, textureKey);
    sprite.setDisplaySize(this.SIZE.width, this.SIZE.height);
    return sprite;
  }

  protected abstract drawTile(graphics: Phaser.GameObjects.Graphics): void;
}
