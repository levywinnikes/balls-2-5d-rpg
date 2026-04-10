import Phaser from "phaser";

export class HouseWallCornerLeftGraphic {
  static readonly TEXTURE_KEY = "house-wall-corner-texture";
  private static readonly BASE_SIZE = { width: 64, height: 64 };
  private static readonly COLLISION_SIZE = { width: 32, height: 32 }; // Match MountainGraphic
  private static readonly TEXTURE_PATH = "assets/tiles/wall/wall-corner.png";

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

    // Create visual sprite
    const sprite = scene.add.sprite(x, y, this.TEXTURE_KEY);
    sprite.setDisplaySize(width, height);

    sprite.setDepth(2);

    // Configure physics body for collision (TileRegistry will enable physics)
    if (scene.physics.world) {
      scene.physics.add.existing(sprite, true); // Make sprite static
      const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(this.COLLISION_SIZE.width, this.COLLISION_SIZE.height); // 32x32 hitbox
      body.setOffset(0, height * 0.5); // Align hitbox with base of sprite
      body.debugShowBody = true; // Visualize hitbox
      body.debugBodyColor = 0xff0000;
    }

    return sprite;
  }
}
