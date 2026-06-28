import Phaser from "phaser";
import { BaseTileGraphic } from "../tiles/BaseTileGraphic";
import {
  getPropDef,
  pickPropAnimation,
  propAnimKey,
  propFramePath,
  propTextureKey,
} from "./PropRegistry";

/**
 * PixelLab-generated animated decoration (single south-facing loop).
 * Assets live under public/assets/sprites/generated/{propId}/.
 */
export abstract class GeneratedAnimatedPropGraphic extends BaseTileGraphic {
  static readonly PROP_ID: string;

  protected static getPropId(): string {
    const propId = (this as typeof GeneratedAnimatedPropGraphic).PROP_ID;
    if (!propId) {
      throw new Error("GeneratedAnimatedPropGraphic missing PROP_ID.");
    }
    return propId;
  }

  protected static applySize(def: ReturnType<typeof getPropDef>): void {
    (this as typeof BaseTileGraphic).SIZE = {
      width: def.size.width,
      height: def.size.height,
    };
  }

  static preload(scene: Phaser.Scene): void {
    const propId = this.getPropId();
    const def = getPropDef(propId);
    this.applySize(def);

    Object.keys(def.animations).forEach((animationName) => {
      const animDef = def.animations[animationName];
      for (let i = 0; i < animDef.frameCount; i += 1) {
        const key = propTextureKey(propId, animationName, i);
        if (!scene.textures.exists(key)) {
          scene.load.image(
            key,
            propFramePath(propId, animationName, def.direction, i),
          );
        }
      }
    });
  }

  protected static ensureAnimations(scene: Phaser.Scene): void {
    const propId = this.getPropId();
    const def = getPropDef(propId);

    Object.entries(def.animations).forEach(([animationName, animDef]) => {
      const key = propAnimKey(propId, animationName);
      if (scene.anims.exists(key)) return;

      scene.anims.create({
        key,
        frames: Array.from({ length: animDef.frameCount }, (_, i) => ({
          key: propTextureKey(propId, animationName, i),
        })),
        frameRate: animDef.frameRate,
        repeat: -1,
      });
    });
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number,
    pool?: Phaser.GameObjects.Sprite[],
  ): Phaser.GameObjects.Sprite {
    const propId = this.getPropId();
    const def = getPropDef(propId);
    this.applySize(def);
    this.ensureAnimations(scene);

    const animationName = pickPropAnimation(propId, x, y);
    const animKey = propAnimKey(propId, animationName);
    const fallbackKey = propTextureKey(propId, animationName, 0);

    let sprite: Phaser.GameObjects.Sprite;
    if (pool && pool.length > 0) {
      sprite = pool[0];
      sprite.setTexture(fallbackKey);
      sprite.setPosition(x, y);
      sprite.setActive(true);
      sprite.setVisible(true);
      sprite.setAlpha(1);
      sprite.setTint(0xffffff);
      if (sprite.body) {
        (
          sprite.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody
        ).enable = true;
      }
    } else {
      sprite = scene.add.sprite(x, y, fallbackKey);
    }

    sprite.setOrigin(def.origin.x, def.origin.y);
    sprite.setDisplaySize(def.size.width, def.size.height);
    if (scene.anims.exists(animKey)) {
      sprite.play(animKey);
    }
    return sprite;
  }

  protected drawTile(_graphics: Phaser.GameObjects.Graphics): void {
    // Generated props never draw procedurally.
  }
}

export class OakTreePropGraphic extends GeneratedAnimatedPropGraphic {
  static readonly PROP_ID = "oak_tree";
  static readonly TEXTURE_KEY = "prop-oak_tree-sway_gentle-0";
  public readonly TEXTURE_KEY = OakTreePropGraphic.TEXTURE_KEY;
}

export class WildFlowerPropGraphic extends GeneratedAnimatedPropGraphic {
  static readonly PROP_ID = "wild_flower";
  static readonly TEXTURE_KEY = "prop-wild_flower-sway_gentle-0";
  public readonly TEXTURE_KEY = WildFlowerPropGraphic.TEXTURE_KEY;
}
