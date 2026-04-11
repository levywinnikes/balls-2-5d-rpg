import Phaser from "phaser";

export class GenericWallGraphic {
  constructor(
    private readonly textureKey: string,
    private readonly isCollidable: boolean = true,
    private readonly baseDepth: number = 2,
    private readonly targetSize = { width: 32, height: 32 },
    private readonly collisionSize = { width: 32, height: 32 },
    private readonly baseColor: number = 0x808080,
    private readonly borderColor: number = 0x404040,
    private readonly collisionOffset = { x: 0, y: 0 },
    private readonly origin = { x: 0.5, y: 0.5 }
  ) {}

  preload(scene: Phaser.Scene): void {
    if (!scene.textures.exists(this.textureKey)) {
      this.createProceduralTexture(scene);
    }
  }

  private createProceduralTexture(scene: Phaser.Scene): void {
    const graphics = scene.add.graphics();
    
    // Draw a stylized stone/brick wall block
    graphics.fillStyle(this.baseColor, 1);
    graphics.fillRect(0, 0, 32, 32);
    
    graphics.lineStyle(2, this.borderColor, 1); // Border
    graphics.strokeRect(0, 0, 32, 32);
    
    // Add some "brick/texture" lines
    graphics.lineStyle(1, this.borderColor, 0.5);
    graphics.strokeLineShape(new Phaser.Geom.Line(0, 16, 32, 16));
    graphics.strokeLineShape(new Phaser.Geom.Line(16, 0, 16, 16));
    graphics.strokeLineShape(new Phaser.Geom.Line(8, 16, 8, 32));
    graphics.strokeLineShape(new Phaser.Geom.Line(24, 16, 24, 32));

    graphics.generateTexture(this.textureKey, 32, 32);
    graphics.destroy();
  }

  create(scene: Phaser.Scene, x: number, y: number, pool?: Phaser.GameObjects.Sprite[]): Phaser.GameObjects.Sprite {
    if (!scene.textures.exists(this.textureKey)) {
      this.createProceduralTexture(scene);
    }

    const sprite = scene.add.sprite(x, y, this.textureKey);
    sprite.setDisplaySize(this.targetSize.width, this.targetSize.height);
    sprite.setOrigin(this.origin.x, this.origin.y);
    sprite.setDepth(this.baseDepth);

    if (this.isCollidable && scene.physics.world) {
      scene.physics.add.existing(sprite, true);
      const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(this.collisionSize.width, this.collisionSize.height);
      body.setOffset(this.collisionOffset.x, this.collisionOffset.y);
    }

    return sprite;
  }
}
