import Phaser from "phaser";

export class RedRoofGraphic {
  static readonly TEXTURE_KEY = "Red-Roof-texture";
  private static readonly BASE_SIZE = { width: 128, height: 128 };
  private static readonly COLLISION_SIZE = { width: 32, height: 32 }; // Match MountainGraphic
  private static readonly TEXTURE_PATH = "assets/tiles/roof/redroof1.png";

  static preload(scene: Phaser.Scene): void {
    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      scene.load.image(this.TEXTURE_KEY, this.TEXTURE_PATH);
    }
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number,
    pool?: Phaser.GameObjects.Sprite[]
  ): Phaser.GameObjects.Sprite {
    const width = this.BASE_SIZE.width;
    const height = this.BASE_SIZE.height;

    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      //  return this.createDebugWall(scene, x, y, width, height);
    }

    // Create visual sprite
    const sprite = scene.add.sprite(x, y, this.TEXTURE_KEY);
    sprite.setDisplaySize(width, height);

    sprite.setDepth(0);

    return sprite;
  }
}
