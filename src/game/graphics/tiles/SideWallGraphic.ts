import Phaser from "phaser";

export class SideWallGraphic {
  constructor(
    private readonly textureKey: string,
    private readonly blockingPartPath: string,
    private readonly upperPartPath: string,
    private readonly baseDepth: number = 2,
    private readonly targetSize = { width: 128, height: 128 },
    private readonly blockingSize = { width: 128, height: 128 },
    private readonly blockingOffset = { x: 16, y: 0 },
    private readonly origin = { x: 0.5, y: 0.75 }
  ) {}

  preload(scene: Phaser.Scene): void {
    if (!scene.textures.exists(`${this.textureKey}_blocking`)) {
      scene.load.image(`${this.textureKey}_blocking`, this.blockingPartPath);
    }
    if (!scene.textures.exists(`${this.textureKey}_upper`)) {
      scene.load.image(`${this.textureKey}_upper`, this.upperPartPath);
    }
  }

  create(
    scene: Phaser.Scene,
    x: number,
    y: number,
    pool?: Phaser.GameObjects.Sprite[]
  ): {
    blockingPart: Phaser.GameObjects.Sprite;
    upperPart: Phaser.GameObjects.Sprite;
  } {
    // Parte que bloqueia (direita)
    const blockingPart = this.createBlockingPart(scene, x, y);

    // Parte visual superior (esquerda)
    const upperPart = this.createUpperPart(scene, x, y);

    return { blockingPart, upperPart };
  }

  private createBlockingPart(
    scene: Phaser.Scene,
    x: number,
    y: number
  ): Phaser.GameObjects.Sprite {
    if (!scene.textures.exists(`${this.textureKey}_blocking`)) {
      return this.createDebugPart(scene, x, y, 0xff0000, this.baseDepth, true);
    }

    const sprite = scene.add.sprite(x, y, `${this.textureKey}_blocking`);
    sprite.setDisplaySize(this.blockingSize.width, this.targetSize.height);
    sprite.setOrigin(this.origin.x, this.origin.y);
    sprite.setDepth(this.baseDepth);

    // Configuração física para bloqueio
    scene.physics.add.existing(sprite, true);
    const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(this.blockingSize.width, this.blockingSize.height);
    body.setOffset(this.blockingOffset.x, this.blockingOffset.y);
    body.debugShowBody = true;
    body.debugBodyColor = 0xff0000;

    return sprite;
  }

  private createUpperPart(
    scene: Phaser.Scene,
    x: number,
    y: number
  ): Phaser.GameObjects.Sprite {
    if (!scene.textures.exists(`${this.textureKey}_upper`)) {
      return this.createDebugPart(
        scene,
        x,
        y,
        0x8b4513,
        this.baseDepth + 10,
        false
      );
    }

    const sprite = scene.add.sprite(
      x, // Removido offset X pois o PNG já está posicionado
      y, // Removido offset Y
      `${this.textureKey}_upper`
    );
    sprite.setDisplaySize(
      this.targetSize.width, // Tamanho completo agora
      this.targetSize.height
    );
    sprite.setOrigin(this.origin.x, this.origin.y);

    sprite.setDepth(this.baseDepth + 10); // Depth maior para ficar sobre o jogador

    return sprite;
  }

  private createDebugPart(
    scene: Phaser.Scene,
    x: number,
    y: number,
    color: number,
    depth: number,
    isBlocking: boolean
  ): Phaser.GameObjects.Sprite {
    const graphics = scene.add.graphics();
    graphics.fillStyle(color, 0.8);
    graphics.fillRect(
      x - this.targetSize.width / 2,
      y - this.targetSize.height,
      this.targetSize.width,
      this.targetSize.height
    );

    const sprite = scene.add.sprite(x, y, "__DEBUG");
    sprite.setDisplaySize(this.targetSize.width, this.targetSize.height);
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(depth);

    if (isBlocking && scene.physics.world) {
      scene.physics.add.existing(sprite, true);
      const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(this.blockingSize.width, this.blockingSize.height);
      body.setOffset(this.blockingOffset.x, this.blockingOffset.y);
    }

    return sprite;
  }
}
