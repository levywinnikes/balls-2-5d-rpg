import Phaser from "phaser";

export class HouseWallFrontGraphic {
  static readonly TEXTURE_KEY = "house-wall-texture-front";
  private static readonly BASE_SIZE = { width: 64, height: 64 };
  private static readonly COLLISION_SIZE = { width: 32, height: 32 }; // Match MountainGraphic
  private static readonly TEXTURE_PATH = "assets/tiles/wall/wall-front.png";

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
      //    return this.createDebugWall(scene, x, y, width, height);
    }

    // Create visual sprite
    const sprite = scene.add.sprite(x, y, this.TEXTURE_KEY);
    // sprite.setDisplaySize(width, height);
    // sprite.setOrigin(0.5, 0.75);

    // Advanced depth system

    sprite.setDepth(2);

    // Configure physics body for collision (TileRegistry will enable physics)
    if (scene.physics.world) {
      scene.physics.add.existing(sprite, true); // Make sprite static
      const body = sprite.body as Phaser.Physics.Arcade.StaticBody;

      body.debugShowBody = true; // Visualize hitbox
      body.debugBodyColor = 0xff0000;
    }

    return sprite;
  }
}
