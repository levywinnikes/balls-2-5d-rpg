import Phaser from "phaser";

type CornerType = "bottom-left" | "bottom-right" | "top-left" | "top-right";

export class LayeredBrickWallGraphic {
  private combinedTextureKey: string;

  constructor(
    private readonly sideTextureKey: string,
    private readonly sideTexturePath: string,
    private readonly frontTextureKey: string,
    private readonly frontTexturePath: string,
    private readonly cornerType: CornerType = "bottom-left",
    private readonly isCollidable: boolean = false,
    private readonly baseDepth: number = 2,
    private readonly targetSize = { width: 128, height: 128 },
    private readonly collisionSize = { width: 128, height: 128 },
    private readonly collisionOffset = { x: 0, y: 0 },
    private readonly origin = { x: 0.5, y: 0.75 }
  ) {
    this.combinedTextureKey = `combined-${sideTextureKey}-${frontTextureKey}-${cornerType}-${targetSize.width}x${targetSize.height}`;
  }

  preload(scene: Phaser.Scene): void {
    if (!scene.textures.exists(this.sideTextureKey)) {
      scene.load.image(this.sideTextureKey, this.sideTexturePath);
    }

    if (!scene.textures.exists(this.frontTextureKey)) {
      scene.load.image(this.frontTextureKey, this.frontTexturePath);
    }
  }

  create(scene: Phaser.Scene, x: number, y: number, pool?: Phaser.GameObjects.Sprite[]): Phaser.GameObjects.Sprite {
    if (scene.textures.exists(this.combinedTextureKey)) {
      return this.createFinalSprite(scene, x, y);
    }

    if (
      !scene.textures.exists(this.sideTextureKey) ||
      !scene.textures.exists(this.frontTextureKey)
    ) {
      return this.createDebugWall(scene, x, y);
    }

    this.generateCombinedTexture(scene);
    return this.createFinalSprite(scene, x, y);
  }

  private generateCombinedTexture(scene: Phaser.Scene): void {
    const canvas = document.createElement("canvas");
    canvas.width = this.targetSize.width;
    canvas.height = this.targetSize.height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      console.error("Could not get canvas context");
      return;
    }

    const frontImage = scene.textures
      .get(this.frontTextureKey)
      .getSourceImage() as HTMLImageElement;
    const sideImage = scene.textures
      .get(this.sideTextureKey)
      .getSourceImage() as HTMLImageElement;

    // Ajusta o desenho baseado no tipo de canto
    switch (this.cornerType) {
      case "bottom-left":
        // Front na parte inferior
        ctx.drawImage(
          frontImage,
          0,
          0,
          frontImage.width,
          frontImage.height,
          0,
          this.targetSize.height / 2,
          this.targetSize.width,
          this.targetSize.height / 2
        );
        // Side na parte direita
        ctx.drawImage(
          sideImage,
          0,
          0,
          sideImage.width,
          sideImage.height,
          this.targetSize.width / 2,
          0,
          this.targetSize.width / 2,
          this.targetSize.height
        );
        break;

      case "bottom-right":
        // Front na parte inferior direita
        ctx.drawImage(
          frontImage,
          0,
          0,
          frontImage.width,
          frontImage.height,
          this.targetSize.width / 2,
          this.targetSize.height / 2,
          this.targetSize.width / 2,
          this.targetSize.height / 2
        );
        // Side na parte esquerda
        ctx.drawImage(
          sideImage,
          0,
          0,
          sideImage.width,
          sideImage.height,
          0,
          0,
          this.targetSize.width / 2,
          this.targetSize.height
        );
        break;

      case "top-left":
        // Front na parte superior esquerda
        ctx.drawImage(
          frontImage,
          0,
          0,
          frontImage.width,
          frontImage.height,
          0,
          0,
          this.targetSize.width / 2,
          this.targetSize.height / 2
        );
        // Side na parte direita inferior
        ctx.drawImage(
          sideImage,
          0,
          0,
          sideImage.width,
          sideImage.height,
          this.targetSize.width / 2,
          this.targetSize.height / 2,
          this.targetSize.width / 2,
          this.targetSize.height / 2
        );
        break;

      case "top-right":
        // Front na parte superior direita
        ctx.drawImage(
          frontImage,
          0,
          0,
          frontImage.width,
          frontImage.height,
          this.targetSize.width / 2,
          0,
          this.targetSize.width / 2,
          this.targetSize.height / 2
        );
        // Side na parte esquerda inferior
        ctx.drawImage(
          sideImage,
          0,
          0,
          sideImage.width,
          sideImage.height,
          0,
          this.targetSize.height / 2,
          this.targetSize.width / 2,
          this.targetSize.height / 2
        );
        break;
    }

    scene.textures.addCanvas(this.combinedTextureKey, canvas);
  }

  private createFinalSprite(
    scene: Phaser.Scene,
    x: number,
    y: number
  ): Phaser.GameObjects.Sprite {
    const sprite = scene.add.sprite(x, y, this.combinedTextureKey);
    sprite.setDisplaySize(this.targetSize.width, this.targetSize.height);
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
    const sprite = scene.add.sprite(x, y, "__DEBUG");
    sprite.setDisplaySize(this.targetSize.width, this.targetSize.height);
    sprite.setOrigin(this.origin.x, this.origin.y);
    sprite.setDepth(1000 + this.baseDepth);

    const graphics = scene.add.graphics();

    // Cores diferentes para cada tipo de canto
    let frontColor = 0x00ff00; // Verde
    let sideColor = 0xff0000; // Vermelho

    graphics.fillStyle(frontColor, 0.6);

    switch (this.cornerType) {
      case "bottom-left":
        // Front (parte inferior)
        graphics.fillRect(
          x - this.targetSize.width / 2,
          y,
          this.targetSize.width,
          this.targetSize.height / 2
        );
        // Side (parte direita)
        graphics.fillStyle(sideColor, 0.6);
        graphics.fillRect(
          x,
          y - this.targetSize.height / 2,
          this.targetSize.width / 2,
          this.targetSize.height
        );
        break;

      case "bottom-right":
        // Front (parte inferior direita)
        graphics.fillRect(
          x,
          y,
          this.targetSize.width / 2,
          this.targetSize.height / 2
        );
        // Side (parte esquerda)
        graphics.fillStyle(sideColor, 0.6);
        graphics.fillRect(
          x - this.targetSize.width / 2,
          y - this.targetSize.height / 2,
          this.targetSize.width / 2,
          this.targetSize.height
        );
        break;

      case "top-left":
        // Front (parte superior esquerda)
        graphics.fillRect(
          x - this.targetSize.width / 2,
          y - this.targetSize.height / 2,
          this.targetSize.width / 2,
          this.targetSize.height / 2
        );
        // Side (parte direita inferior)
        graphics.fillStyle(sideColor, 0.6);
        graphics.fillRect(
          x,
          y,
          this.targetSize.width / 2,
          this.targetSize.height / 2
        );
        break;

      case "top-right":
        // Front (parte superior direita)
        graphics.fillRect(
          x,
          y - this.targetSize.height / 2,
          this.targetSize.width / 2,
          this.targetSize.height / 2
        );
        // Side (parte esquerda inferior)
        graphics.fillStyle(sideColor, 0.6);
        graphics.fillRect(
          x - this.targetSize.width / 2,
          y,
          this.targetSize.width / 2,
          this.targetSize.height / 2
        );
        break;
    }

    if (this.isCollidable && scene.physics.world) {
      scene.physics.add.existing(sprite, true);
      const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(this.collisionSize.width, this.collisionSize.height);
      body.setOffset(this.collisionOffset.x, this.collisionOffset.y);
    }

    return sprite;
  }
}
