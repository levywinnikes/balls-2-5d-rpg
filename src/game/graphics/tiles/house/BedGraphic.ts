import Phaser from "phaser";

export class BedGraphic {
  public static readonly HEAD_TEXTURE = "bed_head";
  public static readonly BODY_TEXTURE = "bed_body";

  static preload(scene: Phaser.Scene): void {
    if (!scene.textures.exists(this.HEAD_TEXTURE)) {
      this.createGenericTexture(scene, this.HEAD_TEXTURE, "head");
    }
    if (!scene.textures.exists(this.BODY_TEXTURE)) {
      this.createGenericTexture(scene, this.BODY_TEXTURE, "body");
    }
  }

  private static createGenericTexture(scene: Phaser.Scene, key: string, part: "head" | "body") {
    const graphics = scene.add.graphics();
    const instance = new BedGraphic(part);
    instance.drawTile(graphics);
    graphics.generateTexture(key, 32, 32);
    graphics.destroy();
  }

  constructor(private part: "head" | "body") {}

  static create(scene: Phaser.Scene, x: number, y: number, part: "head" | "body"): Phaser.GameObjects.Sprite {
    const key = part === "head" ? this.HEAD_TEXTURE : this.BODY_TEXTURE;
    if (!scene.textures.exists(key)) {
        this.createGenericTexture(scene, key, part);
    }
    const sprite = scene.add.sprite(x, y, key);
    sprite.setDisplaySize(32, 32);
    return sprite;
  }

  public drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Bed frame color (Wood)
    const frameColor = 0x8b4513; 
    const sheetColor = 0xf5f5dc; 
    const pillowColor = 0xffffff;

    if (this.part === "head") {
      // Headboard
      graphics.fillStyle(frameColor, 1);
      graphics.fillRect(2, 0, 28, 6); // Headboard top
      
      // Main mattress part
      graphics.fillStyle(sheetColor, 1);
      graphics.fillRect(4, 6, 24, 26);
      
      // Pillow
      graphics.fillStyle(pillowColor, 1);
      graphics.fillRect(8, 8, 16, 10);
      graphics.lineStyle(1, 0xcccccc, 1);
      graphics.strokeRect(8, 8, 16, 10);
      
      // Side rails
      graphics.fillStyle(frameColor, 1);
      graphics.fillRect(2, 0, 4, 32);
      graphics.fillRect(26, 0, 4, 32);
      
    } else {
      // Footboard / Body
      // Main mattress part
      graphics.fillStyle(sheetColor, 1);
      graphics.fillRect(4, 0, 24, 28);
      
      // Blanket detail
      graphics.fillStyle(0x4682b4, 1); // Steel blue blanket
      graphics.fillRect(4, 10, 24, 18);
      
      // Footboard
      graphics.fillStyle(frameColor, 1);
      graphics.fillRect(2, 28, 28, 4);
      
      // Side rails
      graphics.fillStyle(frameColor, 1);
      graphics.fillRect(2, 0, 4, 32);
      graphics.fillRect(26, 0, 4, 32);
    }

    // Details/Shadows
    graphics.lineStyle(1, 0x000000, 0.2);
    graphics.strokeRect(0, 0, 32, 32);
  }
}
