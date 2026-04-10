import Phaser from "phaser";

export class TilePool {
  private pool: Phaser.GameObjects.Sprite[] = [];
  private scene: Phaser.Scene;
  private maxSize: number;

  constructor(scene: Phaser.Scene, maxSize: number = 1000) {
    this.scene = scene;
    this.maxSize = maxSize;
  }

  public get(): Phaser.GameObjects.Sprite | null {
    if (this.pool.length > 0) {
      const sprite = this.pool.pop()!;
      return sprite;
    }
    return null;
  }

  public release(sprite: Phaser.GameObjects.Sprite): void {
    if (this.pool.length < this.maxSize) {
      // Reset properties to clean state
      sprite.setActive(false);
      sprite.setVisible(false);
      sprite.off(Phaser.Input.Events.POINTER_DOWN);
      sprite.off(Phaser.Input.Events.POINTER_UP);
      sprite.off(Phaser.Input.Events.POINTER_OVER);
      sprite.off(Phaser.Input.Events.POINTER_OUT);
      sprite.removeAllListeners();
      
      // Reset physics if present
      if (sprite.body) {
        if (sprite.body instanceof Phaser.Physics.Arcade.Body) {
             sprite.body.stop();
             sprite.body.enable = false;
        } else if (sprite.body instanceof Phaser.Physics.Arcade.StaticBody) {
             sprite.body.enable = false; // StaticBody also has enable
        }
      }
      
      sprite.setTint(0xffffff);
      sprite.setAlpha(1);
      sprite.setRotation(0);
      sprite.setScale(1);
      
      this.pool.push(sprite);
    } else {
      sprite.destroy();
    }
  }

  public clear(): void {
    this.pool.forEach(sprite => sprite.destroy());
    this.pool = [];
  }

  public getRawPool(): Phaser.GameObjects.Sprite[] {
      return this.pool;
  }
}
