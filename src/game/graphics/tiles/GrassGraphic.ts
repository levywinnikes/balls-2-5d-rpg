import Phaser from "phaser";

export class GrassGraphic {
  static readonly TEXTURE_KEY = "grass-texture";
  private static readonly BASE_SIZE = { width: 128, height: 128 };
  private static readonly COLLISION_SIZE = { width: 128, height: 128 }; // Match MountainGraphic
  private static readonly TEXTURE_PATH = "assets/tiles/grass/cute-grass.png";

  static preload(scene: Phaser.Scene): void {
    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      scene.load.image(this.TEXTURE_KEY, this.TEXTURE_PATH);
    }
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number
  ): Phaser.GameObjects.Sprite {
    const width = this.BASE_SIZE.width;
    const height = this.BASE_SIZE.height;

    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      //  return this.createDebugWall(scene, x, y, width, height);
    }

    // Create visual sprite
    const sprite = scene.add.sprite(x, y, this.TEXTURE_KEY);
    sprite.setDisplaySize(width, height);
    sprite.setOrigin(0.3, 0.5);
    sprite.setDepth(0);

    return sprite;
  }
}
