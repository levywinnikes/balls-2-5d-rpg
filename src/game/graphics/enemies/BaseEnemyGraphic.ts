import Phaser from "phaser";

export abstract class BaseEnemyGraphic {
  protected static SIZE = { width: 32, height: 32 };
  
  // To be overridden in subclasses as 'static readonly TEXTURE_KEY'
  // and 'public readonly TEXTURE_KEY' (for instance access if needed)

  static preload(scene: Phaser.Scene): void {
    const textureKey = (this as any).TEXTURE_KEY;
    if (!textureKey) {
        console.warn("BaseEnemyGraphic.preload called on class without TEXTURE_KEY", this);
        return;
    }
    if (!scene.textures.exists(textureKey)) {
      this.createTexture(scene, textureKey);
    }
  }

  static createStandardAnimations(scene: Phaser.Scene, keyPrefix: string, spriteKey: string): void {
      if (scene.anims.exists(`${keyPrefix}-walk-down`)) return;

      // Purely procedural fallback: all animations use the same single frame
      const createStaticAnim = (key: string) => {
          scene.anims.create({
              key: key,
              frames: [{ key: spriteKey, frame: 0 }],
              frameRate: 1,
              repeat: -1
          });
      };

      const keys = [
          "walk-down", "walk-left", "walk-right", "walk-up",
          "attack-down", "attack-left", "attack-right", "attack-up",
          "die"
      ];

      keys.forEach(k => createStaticAnim(`${keyPrefix}-${k}`));
  }

  protected static createTexture(
    scene: Phaser.Scene,
    textureKey: string
  ): void {
    const graphics = scene.add.graphics();

    // Indirect call to drawEnemy (instantiating subclass)
    const instance = new (this as any)();
    instance.drawEnemy(graphics);

    graphics.generateTexture(textureKey, this.SIZE.width, this.SIZE.height);
    graphics.destroy();
  }

  protected abstract drawEnemy(graphics: Phaser.GameObjects.Graphics): void;
}
