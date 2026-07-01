import Phaser from "phaser";
import {
  ARROW_PROJECTILE_DEF,
  projectileAnimKey,
  projectileFramePath,
  projectileTextureKey,
} from "./ProjectileSpriteRegistry";

export class ArrowProjectileGraphic {
  static preload(scene: Phaser.Scene): void {
    const def = ARROW_PROJECTILE_DEF;
    Object.entries(def.animations).forEach(([animationName, animDef]) => {
      for (let i = 0; i < animDef.frameCount; i += 1) {
        const key = projectileTextureKey(def.id, animationName, i);
        if (!scene.textures.exists(key)) {
          scene.load.image(
            key,
            projectileFramePath(def.id, animationName, def.direction, i),
          );
        }
      }
    });
  }

  static ensureAnimations(scene: Phaser.Scene): void {
    const def = ARROW_PROJECTILE_DEF;
    Object.entries(def.animations).forEach(([animationName, animDef]) => {
      const key = projectileAnimKey(def.id, animationName);
      if (scene.anims.exists(key)) {
        return;
      }
      scene.anims.create({
        key,
        frames: Array.from({ length: animDef.frameCount }, (_, i) => ({
          key: projectileTextureKey(def.id, animationName, i),
        })),
        frameRate: animDef.frameRate,
        repeat: -1,
      });
    });
  }

  static resolveAnimationForSpeed(speed: number): string {
    if (speed >= 600) {
      return "fly_loop";
    }
    if (speed >= 520) {
      return "feather_sway";
    }
    return "feather_sway_gentle";
  }

  static getAnimationKey(speed: number): string {
    return projectileAnimKey(
      ARROW_PROJECTILE_DEF.id,
      this.resolveAnimationForSpeed(speed),
    );
  }

  static getFirstFrameKey(speed: number): string {
    const animation = this.resolveAnimationForSpeed(speed);
    return projectileTextureKey(ARROW_PROJECTILE_DEF.id, animation, 0);
  }
}
