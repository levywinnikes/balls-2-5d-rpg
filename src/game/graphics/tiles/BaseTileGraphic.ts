import Phaser from "phaser";

/**
 * ⚠️ MANDATORY TILE CONTRACT ⚠️
 * All tiles MUST inherit from BaseTileGraphic to ensure:
 * 1. Texture singleton across the game.
 * 2. REUSE: All tiles must check the provided 'pool' argument before adding new sprites.
 * 3. CONSISTENCY: Single-sprite graphics only (use the standard return type).
 */
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

    let sprite: Phaser.GameObjects.Sprite;
    // RECLAIM logic: If pool has a sprite, reuse it.
    if (pool && pool.length > 0) {
        sprite = pool[0];
        sprite.setTexture(textureKey);
        sprite.setPosition(x, y);
        sprite.setActive(true);
        sprite.setVisible(true);
        sprite.setAlpha(1);
        sprite.setTint(0xffffff);
        // Ensure body is re-enabled if it exists
        if (sprite.body) {
            (sprite.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody).enable = true;
        }
    } else {
        sprite = scene.add.sprite(x, y, textureKey);
    }

    sprite.setDisplaySize(this.SIZE.width, this.SIZE.height);
    return sprite;
  }

  protected abstract drawTile(graphics: Phaser.GameObjects.Graphics): void;
}
