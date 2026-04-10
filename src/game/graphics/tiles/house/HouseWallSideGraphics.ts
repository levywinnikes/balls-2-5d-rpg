import Phaser from "phaser";

export class HouseWallSideGraphic {
  static readonly TEXTURE_KEY = "house-wall-side-texture";
  private static readonly BASE_SIZE = { width: 64, height: 64 };
  private static readonly COLLISION_SIZE = { width: 32, height: 32 }; // Match MountainGraphic
  private static readonly TEXTURE_PATH = "assets/tiles/wall/wall-side.png";

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
      return this.createDebugWall(scene, x, y, width, height);
    }

    // Create visual sprite
    const sprite = scene.add.sprite(x, y, this.TEXTURE_KEY);
    sprite.setDisplaySize(width, height);

    // Advanced depth system

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

  private static createDebugWall(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number
  ): Phaser.GameObjects.Sprite {
    const graphics = scene.add.graphics();
    graphics.fillStyle(0x8b4513, 0.8);
    graphics.fillRect(x - width / 2, y - height, width, height);
    graphics.lineStyle(3, 0xffff00);
    graphics.lineBetween(
      x - width / 2,
      y - height * 0.2,
      x + width / 2,
      y - height * 0.2
    );

    const sprite = scene.add.sprite(x, y, "__DEBUG");
    sprite.setDisplaySize(width, height);
    sprite.setOrigin(0.5, 0.75);
    sprite.setDepth(1000 + y + height * 0.25);

    if (scene.physics.world) {
      scene.physics.add.existing(sprite, true);
      const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(this.COLLISION_SIZE.width, this.COLLISION_SIZE.height); // 32x32 hitbox
      body.setOffset(0, height * 0.5);
      body.debugShowBody = true;
      body.debugBodyColor = 0xff0000;
    }

    return sprite;
  }
}
