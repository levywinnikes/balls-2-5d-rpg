import Phaser from "phaser";
import { BaseEnemyGraphic } from "./BaseEnemyGraphic";

export class DragonGraphic extends BaseEnemyGraphic {
  public readonly TEXTURE_KEY = "dragon-texture";
  public static readonly SPRITE_KEY = "dragon-sprite";

  static preload(scene: Phaser.Scene): void {
    // Dragon is 2048x2048 (2x Rat)
    // 4 cols = 512px
    // 10 rows -> 204px height (approx 204.8)
    scene.load.spritesheet(this.SPRITE_KEY, "assets/enemies/dragon.png", {
      frameWidth: 512,
      frameHeight: 204, 
      margin: 0, 
      spacing: 0
    });
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number
  ): Phaser.Physics.Arcade.Sprite {
    // Create animations
    if (!scene.anims.exists("dragon-walk-down")) {
        const createAnim = (key: string, startFrame: number, endFrame: number, fps: number, loop: number) => {
             scene.anims.create({
                key: key,
                frames: scene.anims.generateFrameNumbers(DragonGraphic.SPRITE_KEY, { start: startFrame, end: endFrame }),
                frameRate: fps,
                repeat: loop
            });
        };

        // Rows 0-3: Walk (4 frames each)
        createAnim("dragon-walk-down", 0, 3, 8, -1);
        createAnim("dragon-walk-left", 4, 7, 8, -1);
        createAnim("dragon-walk-right", 8, 11, 8, -1);
        createAnim("dragon-walk-up", 12, 15, 8, -1);

        // Rows 4-7: Attack (4 frames each)
        createAnim("dragon-attack-down", 16, 19, 12, 0);
        createAnim("dragon-attack-left", 20, 23, 12, 0);
        createAnim("dragon-attack-right", 24, 27, 12, 0);
        createAnim("dragon-attack-up", 28, 31, 12, 0);

        // Rows 8-9: Death (8 frames total: 32-39)
        createAnim("dragon-die", 32, 39, 6, 0);
    }

    const sprite = scene.physics.add.sprite(x, y, this.SPRITE_KEY);
    
    // Hitbox: Keep it centered.
    // Rat was 64x64. Dragon should be larger. Maybe 128x128?
    sprite.setSize(128, 128); 
    sprite.setOffset(192, 38); // Centering: (512-128)/2 = 192. (204-128)/2 = 38.

    if (scene.anims.exists("dragon-walk-down")) {
        sprite.play("dragon-walk-down");
    }

    return sprite;
  }

  protected drawEnemy(graphics: Phaser.GameObjects.Graphics): void {
    // Not used
  }
}
