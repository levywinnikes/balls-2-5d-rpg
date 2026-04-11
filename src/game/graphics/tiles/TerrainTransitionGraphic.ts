import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export type TransitionDirection = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

export class TerrainTransitionGraphic extends BaseTileGraphic {
  private primaryColor: number;
  private secondaryColor: number;
  private direction: TransitionDirection;
  public readonly TEXTURE_KEY: string;

  constructor(primaryColor: number, secondaryColor: number, direction: TransitionDirection, textureKey: string) {
    super();
    this.primaryColor = primaryColor;
    this.secondaryColor = secondaryColor;
    this.direction = direction;
    this.TEXTURE_KEY = textureKey;
  }

  public preload(scene: Phaser.Scene): void {
    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      this.createTextureInstance(scene);
    }
  }

  public create(
    scene: Phaser.Scene,
    x: number,
    y: number,
    _pool?: Phaser.GameObjects.Sprite[]
  ): Phaser.GameObjects.Sprite {
    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      this.createTextureInstance(scene);
    }
    const sprite = scene.add.sprite(x, y, this.TEXTURE_KEY);
    sprite.setDisplaySize(32, 32);
    return sprite;
  }

  private createTextureInstance(scene: Phaser.Scene): void {
    const graphics = scene.add.graphics();
    this.drawTile(graphics);
    graphics.generateTexture(this.TEXTURE_KEY, 32, 32);
    graphics.destroy();
  }

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    const size = 32;
    const mid = 16;
    
    // 1. FILL BACKGROUND (Secondary - usually Water)
    graphics.fillStyle(this.secondaryColor, 1);
    graphics.fillRect(0, 0, size, size);

    // 2. DRAW 50% GEOMETRIC PRIMARY (Primary - usually Grass)
    graphics.fillStyle(this.primaryColor, 1);
    graphics.beginPath();
    
    switch (this.direction) {
        // CARDINALS: Perfect 50% Rectangle Splits
        case 'n':
            graphics.fillRect(0, 0, size, mid);
            break;
        case 's':
            graphics.fillRect(0, mid, size, mid);
            break;
        case 'e':
            graphics.fillRect(mid, 0, mid, size);
            break;
        case 'w':
            graphics.fillRect(0, 0, mid, size);
            break;

        // CORNERS: Perfect 50% Diagonal Triangle Splits (Corner-to-Corner)
        case 'nw':
            graphics.moveTo(0, 0);
            graphics.lineTo(size, 0);
            graphics.lineTo(0, size);
            break;
        case 'ne':
            graphics.moveTo(0, 0);
            graphics.lineTo(size, 0);
            graphics.lineTo(size, size);
            break;
        case 'sw':
            graphics.moveTo(0, 0);
            graphics.lineTo(size, size);
            graphics.lineTo(0, size);
            break;
        case 'se':
            graphics.moveTo(size, 0);
            graphics.lineTo(size, size);
            graphics.lineTo(0, size);
            break;
    }
    
    graphics.closePath();
    graphics.fillPath();

    // 3. Subtle internal noise (fixed patterns to avoid flickering)
    graphics.fillStyle(this.primaryColor, 0.4);
    graphics.fillRect(2, 2, 1, 1);
    graphics.fillRect(28, 28, 1, 1);
  }
}
