import Phaser from "phaser";
import { BaseTileGraphic } from "../BaseTileGraphic";

export class BedHeadGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "bed_head";
  public readonly TEXTURE_KEY = BedHeadGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Bed frame color (Wood)
    const frameColor = 0x8b4513; 
    const sheetColor = 0xf5f5dc; 
    const pillowColor = 0xffffff;

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
    
    // Details/Shadows
    graphics.lineStyle(1, 0x000000, 0.2);
    graphics.strokeRect(0, 0, 32, 32);
  }
}

export class BedBodyGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "bed_body";
  public readonly TEXTURE_KEY = BedBodyGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    const frameColor = 0x8b4513; 
    const sheetColor = 0xf5f5dc; 

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

    // Details/Shadows
    graphics.lineStyle(1, 0x000000, 0.2);
    graphics.strokeRect(0, 0, 32, 32);
  }
}

/** @deprecated Use BedHeadGraphic or BedBodyGraphic directly. Kept for minimal compatibility during refactor. */
export class BedGraphic {
    static preload(scene: Phaser.Scene) {
        BedHeadGraphic.preload(scene);
        BedBodyGraphic.preload(scene);
    }
    static create(scene: Phaser.Scene, x: number, y: number, part: "head" | "body", pool?: Phaser.GameObjects.Sprite[]) {
        if (part === "head") return BedHeadGraphic.create(scene, x, y, pool);
        return BedBodyGraphic.create(scene, x, y, pool);
    }
}
