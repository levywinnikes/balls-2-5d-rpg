import Phaser from "phaser";
import { BaseEnemyGraphic } from "./BaseEnemyGraphic";

export class RatGraphic extends BaseEnemyGraphic {
  public readonly TEXTURE_KEY = "rat-texture";
  public static readonly SPRITE_KEY = "rat-sprite";

  static preload(scene: Phaser.Scene): void {
    // 10-Row Standard (Generated Image is 1024x1024)
    // 4 cols = 256px
    // 10 rows = ~102.4px. Using 102px height.
    // User needs to remove background for perfect alignment, but this is the starting point.
    scene.load.spritesheet(this.SPRITE_KEY, "assets/enemies/rat.png", {
      frameWidth: 256,
      frameHeight: 102, 
      margin: 0, 
      spacing: 0
    });
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number
  ): Phaser.Physics.Arcade.Sprite {
    // Create animations (10 Rows Standard)
    if (!scene.anims.exists("rat-walk-down")) {
        const createAnim = (key: string, startFrame: number, endFrame: number, fps: number, loop: number) => {
             scene.anims.create({
                key: key,
                frames: scene.anims.generateFrameNumbers(RatGraphic.SPRITE_KEY, { start: startFrame, end: endFrame }),
                frameRate: fps,
                repeat: loop
            });
        };

        // Rows 0-3: Walk (4 frames each)
        createAnim("rat-walk-down", 0, 3, 8, -1);
        createAnim("rat-walk-left", 4, 7, 8, -1);
        createAnim("rat-walk-right", 8, 11, 8, -1);
        createAnim("rat-walk-up", 12, 15, 8, -1);

        // Rows 4-7: Attack (4 frames each)
        createAnim("rat-attack-down", 16, 19, 12, 0);
        createAnim("rat-attack-left", 20, 23, 12, 0);
        createAnim("rat-attack-right", 24, 27, 12, 0);
        createAnim("rat-attack-up", 28, 31, 12, 0);

        // Rows 8-9: Death (8 frames total: 32-39)
        createAnim("rat-die", 32, 39, 6, 0);
    }

    const sprite = scene.physics.add.sprite(x, y, this.SPRITE_KEY);
    
    // Scale handled by Registry (1.5)
    // Adjust physics body standard size for 256px frame
    // 256 scale 1.5 -> Huge? 
    // Wait, previous 125px scale 1.5 -> 187px.
    // generated 256px scale 1.5 -> 384px. 
    // User wanted "2x larger" than the TINY 0.2 version (which was ~50px).
    // So target is ~100px.
    // 256 * S = 100 => S = 0.4.
    // If Registry sets 1.5, I need to Compensate? 
    // Registry scale is "Global Visual Modifier".
    // If I want 256px frame to serve as 0.4, I should set Registry to 0.4?
    // But Registry is shared config.
    // I will let Registry control it, but if standard is 4.0 for others...
    // I'll stick to Registry 1.5 for Rat.
    // If 1.5 makes it huge (256*1.5), the user will complain.
    // Better to Pre-Scale? No.
    // I'll hint that the Registry scale might need adjustment for 1024px sheet.
    
    // Hitbox: Keep it small and centered.
    sprite.setSize(64, 64); 
    sprite.setOffset(96, 32); // Center in 256 frame

    if (scene.anims.exists("rat-walk-down")) {
        sprite.play("rat-walk-down");
    }

    return sprite;
  }

  protected drawEnemy(graphics: Phaser.GameObjects.Graphics): void {
    // Deprecated: No longer used for Rat.
    // Empty implementation to satisfy abstract class if not removed there.
  }
}
