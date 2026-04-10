
import Phaser from "phaser";
import { BaseEnemyGraphic } from "./BaseEnemyGraphic";

export class OrcGraphic extends BaseEnemyGraphic {
  public readonly TEXTURE_KEY = "orc-texture";
  
  // New Sprite Dimensions: 1312 x 3268 (4 cols, 10 rows)
  private static readonly FRAME_WIDTH = 328; 
  private static readonly FRAME_HEIGHT = 326.8;

  static preload(scene: Phaser.Scene): void {
    if (!scene.textures.exists("orc-texture")) {
      scene.load.spritesheet("orc-texture", "assets/enemies/orc.png", {
        frameWidth: this.FRAME_WIDTH,
        frameHeight: this.FRAME_HEIGHT,
      });
    }
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number
  ): Phaser.Physics.Arcade.Sprite {
    const textureKey = "orc-texture";

    if (!scene.textures.exists(textureKey)) {
      console.warn("Orc texture not found, it should be preloaded in scene.");
    }

    const sprite = scene.physics.add.sprite(x, y, textureKey, 0);
    
    // Consistent with Hero Peasant scale and offset
    sprite.setScale(0.61); 
    sprite.setSize(16, 32); 
    sprite.setOffset(156, 221); 
    
    this.createAnimations(scene);
    
    return sprite;
  }

  private static createAnimations(scene: Phaser.Scene): void {
      const textureKey = "orc-texture";
      const keyPrefix = "orc";
      
      // Use standard row layout (0:Down, 1:Left, 2:Right, 3:Up)
      this.createStandardAnimations(scene, keyPrefix, textureKey);
      
      // Directional Idle Animations (matching hero peasant pattern)
      const createIdle = (dir: string, frame: number) => {
          if (!scene.anims.exists(`orc-idle-${dir}`)) {
              scene.anims.create({
                  key: `orc-idle-${dir}`,
                  frames: [{ key: textureKey, frame }],
                  frameRate: 4,
              });
          }
      };

      createIdle("down", 0);
      createIdle("left", 4);
      createIdle("right", 8);
      createIdle("up", 12);

      // Death Animation - Explicitly use all 8 frames from Rows 8-9 (32 to 39)
      if (!scene.anims.exists("orc-die")) {
          scene.anims.create({
              key: "orc-die",
              frames: scene.anims.generateFrameNumbers(textureKey, { start: 32, end: 39 }),
              frameRate: 8,
              repeat: 0
          });
      }
  }

  // No procedural drawing needed anymore
  protected drawEnemy(graphics: Phaser.GameObjects.Graphics): void {
      // Procedural drawing removed in favor of spritesheet
  }
}
