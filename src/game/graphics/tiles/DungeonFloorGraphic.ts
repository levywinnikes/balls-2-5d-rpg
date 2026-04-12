import Phaser from "phaser";
import { BaseTileGraphic } from "./BaseTileGraphic";

export class DungeonFloorGraphic extends BaseTileGraphic {
  public static readonly TEXTURE_KEY = "dungeon-floor-texture";
  public readonly TEXTURE_KEY = DungeonFloorGraphic.TEXTURE_KEY;

  protected drawTile(graphics: Phaser.GameObjects.Graphics): void {
    // Base Stone Color (Deep Slate)
    graphics.fillStyle(0x334155, 1);
    graphics.fillRect(0, 0, 32, 32);
    
    // Irregular Slab Outlines
    graphics.lineStyle(1, 0x1e293b, 0.4);
    
    // Procedural "Stone Slabs"
    graphics.beginPath();
    graphics.moveTo(0, 16);
    graphics.lineTo(12, 10);
    graphics.lineTo(24, 16);
    graphics.lineTo(32, 12);
    
    graphics.moveTo(14, 0);
    graphics.lineTo(12, 10);
    graphics.lineTo(16, 20);
    graphics.lineTo(14, 32);
    
    graphics.moveTo(24, 16);
    graphics.lineTo(26, 32);
    graphics.strokePath();

    // Subtle Surface Noise / Cracks
    graphics.lineStyle(1, 0x475569, 0.2);
    for(let i=0; i<5; i++) {
        const rx = Math.random() * 32;
        const ry = Math.random() * 32;
        graphics.strokeRect(rx, ry, 2, 1);
    }
  }
}
