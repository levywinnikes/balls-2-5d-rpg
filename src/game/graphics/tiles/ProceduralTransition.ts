import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export type TransitionDirection = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

export class ProceduralTransition extends BaseTileGraphic {
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
    pool?: Phaser.GameObjects.Sprite[]
  ): Phaser.GameObjects.Sprite {
    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      this.createTextureInstance(scene);
    }
    
    let sprite: Phaser.GameObjects.Sprite;
    // RECLAIM logic
    if (pool && pool.length > 0) {
        sprite = pool[0];
        sprite.setTexture(this.TEXTURE_KEY);
        sprite.setPosition(x, y);
        sprite.setActive(true);
        sprite.setVisible(true);
        sprite.setAlpha(1);
        sprite.setTint(0xffffff);
        if (sprite.body) {
            (sprite.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody).enable = true;
        }
    } else {
        sprite = scene.add.sprite(x, y, this.TEXTURE_KEY);
    }
    
    sprite.setDisplaySize(32, 32);
    return sprite;
  }

  private createTextureInstance(scene: Phaser.Scene): void {
    const size = 32;
    const canvasTexture = scene.textures.createCanvas(this.TEXTURE_KEY, size, size);
    if (!canvasTexture) return;
    
    const ctx = canvasTexture.getContext();
    const mid = 16;
    
    // Helper to convert hex to CSS color
    const toCSS = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;

    // 1. Background (Water/Sand)
    ctx.fillStyle = toCSS(this.secondaryColor);
    ctx.fillRect(0, 0, size, size);

    // 1.1 Waves (Subtle white lines for water only)
    if (this.TEXTURE_KEY.includes("wat")) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(5, 10); ctx.lineTo(15, 12); ctx.lineTo(25, 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, 22); ctx.lineTo(18, 24); ctx.lineTo(28, 22);
        ctx.stroke();
    }

    // 2. Geometric Primary (Grass/Path)
    ctx.fillStyle = toCSS(this.primaryColor);
    ctx.beginPath();
    
    switch (this.direction) {
        case 'n': ctx.rect(0, 0, size, mid); break;
        case 's': ctx.rect(0, mid, size, mid); break;
        case 'e': ctx.rect(mid, 0, mid, size); break;
        case 'w': ctx.rect(0, 0, mid, size); break;
        
        case 'nw':
            ctx.moveTo(0, 0); ctx.lineTo(size, 0); ctx.lineTo(0, size);
            break;
        case 'ne':
            ctx.moveTo(0, 0); ctx.lineTo(size, 0); ctx.lineTo(size, size);
            break;
        case 'sw':
            ctx.moveTo(0, 0); ctx.lineTo(size, size); ctx.lineTo(0, size);
            break;
        case 'se':
            ctx.moveTo(size, 0); ctx.lineTo(size, size); ctx.lineTo(0, size);
            break;
    }
    ctx.fill();

    // 3. Noise (Blades/Grit)
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    for(let i=0; i<6; i++) {
        const rx = Math.floor(Math.random() * 30) + 1;
        const ry = Math.floor(Math.random() * 30) + 1;
        ctx.fillRect(rx, ry, 1, 1);
    }

    canvasTexture.refresh();
  }

  protected drawTile(_graphics: Phaser.GameObjects.Graphics): void {}
}
