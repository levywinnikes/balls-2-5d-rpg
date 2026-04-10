import Phaser from "phaser";

export class StairUpGraphic {
  static readonly TEXTURE_KEY = "stair-up-texture";
  private static readonly TEXTURE_PATH = "assets/tiles/stairs/wooden-stairs-up.png";

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
    const sprite = scene.add.sprite(x, y, this.TEXTURE_KEY);
    sprite.setDisplaySize(128, 128); // Force standard tile size
    sprite.setOrigin(0.5, 0.75); // Standard origin for floor/stairs (checking TileRegistry usually uses 0.5, 0.75)
    // No explicit scale needed if image is 128x128
    return sprite;
  }
}
