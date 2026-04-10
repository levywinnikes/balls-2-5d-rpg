import Phaser from "phaser";

export abstract class BaseEnemyGraphic {
  protected static SIZE = { width: 32, height: 32 };
  public abstract readonly TEXTURE_KEY: string;

  static preload(scene: Phaser.Scene, textureKey: string): void {
    if (!scene.textures.exists(textureKey)) {
      this.createTexture(scene, textureKey);
    }
  }

  static createStandardAnimations(scene: Phaser.Scene, keyPrefix: string, spriteKey: string): void {
      if (scene.anims.exists(`${keyPrefix}-walk-down`)) return;

      const createAnim = (key: string, start: number, end: number, fps: number, loop: number) => {
          scene.anims.create({
              key: key,
              frames: scene.anims.generateFrameNumbers(spriteKey, { start, end }),
              frameRate: fps,
              repeat: loop
          });
      };

      // Walk (Rows 0-3)
      createAnim(`${keyPrefix}-walk-down`, 0, 3, 8, -1);
      createAnim(`${keyPrefix}-walk-left`, 4, 7, 8, -1);
      createAnim(`${keyPrefix}-walk-right`, 8, 11, 8, -1);
      createAnim(`${keyPrefix}-walk-up`, 12, 15, 8, -1);

      // Attack (Rows 4-7)
      createAnim(`${keyPrefix}-attack-down`, 16, 19, 12, 0);
      createAnim(`${keyPrefix}-attack-left`, 20, 23, 12, 0);
      createAnim(`${keyPrefix}-attack-right`, 24, 27, 12, 0);
      createAnim(`${keyPrefix}-attack-up`, 28, 31, 12, 0);

      // Death (Rows 8-9)
      createAnim(`${keyPrefix}-die`, 32, 39, 6, 0);
  }

  protected static createTexture(
    scene: Phaser.Scene,
    textureKey: string
  ): void {
    const graphics = scene.add.graphics();

    // Chamada indireta para o método de desenho
    const instance = new (this as any)();
    instance.drawEnemy(graphics);

    graphics.generateTexture(textureKey, this.SIZE.width, this.SIZE.height);
    graphics.destroy();
  }

  // Método de instância ao invés de estático
  protected abstract drawEnemy(graphics: Phaser.GameObjects.Graphics): void;
}
