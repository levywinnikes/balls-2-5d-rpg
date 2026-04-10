import Phaser from "phaser";

export class GenericWallGraphic {
  constructor(
    private readonly textureKey: string,
    private readonly texturePath: string,
    private readonly isCollidable: boolean = true,
    private readonly baseDepth: number = 2,
    private readonly targetSize = { width: 128, height: 128 }, // Tamanho desejado na tela
    private readonly collisionSize = { width: 128, height: 128 }, // Tamanho fixo da colisão
    private readonly collisionOffset = { x: 0, y: 0 }, // Offset fixo da colisão
    private readonly origin = { x: 0.5, y: 0.75 }
  ) {}

  preload(scene: Phaser.Scene): void {
    if (!scene.textures.exists(this.textureKey)) {
      scene.load.image(this.textureKey, this.texturePath);
    }
  }

  create(scene: Phaser.Scene, x: number, y: number, pool?: Phaser.GameObjects.Sprite[]): Phaser.GameObjects.Sprite {
    if (!scene.textures.exists(this.textureKey)) {
      return this.createDebugWall(scene, x, y);
    }

    const sprite = scene.add.sprite(x, y, this.textureKey);
    sprite.setDisplaySize(this.targetSize.width * 2, this.targetSize.height * 2);
    sprite.setOrigin(this.origin.x, this.origin.y);
    sprite.setDepth(this.baseDepth);

    if (this.isCollidable && scene.physics.world) {
      scene.physics.add.existing(sprite, true);
      const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(this.collisionSize.width, this.collisionSize.height);
      body.setOffset(this.collisionOffset.x, this.collisionOffset.y);
      body.debugShowBody = true;
      body.debugBodyColor = 0xff0000;
    }

    return sprite;
  }

  private createDebugWall(
    scene: Phaser.Scene,
    x: number,
    y: number
  ): Phaser.GameObjects.Sprite {
    const graphics = scene.add.graphics();
    graphics.fillStyle(0x8b4513, 0.8);
    graphics.fillRect(
      x - this.targetSize.width / 2,
      y - this.targetSize.height,
      this.targetSize.width,
      this.targetSize.height
    );

    const sprite = scene.add.sprite(x, y, "__DEBUG");
    sprite.setDisplaySize(this.targetSize.width, this.targetSize.height);
    sprite.setOrigin(this.origin.x, this.origin.y);
    sprite.setDepth(1000 + this.baseDepth);

    if (this.isCollidable && scene.physics.world) {
      scene.physics.add.existing(sprite, true);
      const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(this.collisionSize.width, this.collisionSize.height);
      body.setOffset(this.collisionOffset.x, this.collisionOffset.y);
    }

    return sprite;
  }
}
