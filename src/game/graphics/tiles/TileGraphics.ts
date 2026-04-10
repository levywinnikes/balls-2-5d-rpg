// graphics/tiles/TileGraphics.ts
import Phaser from "phaser";
import { TileType, TileConfig } from "./TileTypes";

export class TileGraphics {
  private static readonly SIZE = { width: 32, height: 32 };
  private static readonly TILE_CONFIGS: Record<TileType, TileConfig> = {
    [TileType.GRASS]: {
      textureKey: "grass-tile",
      color: 0x4caf50,
    },
    [TileType.CONCRETE_WALL]: {
      textureKey: "concrete-wall-tile",
      color: 0x9e9e9e,
    },
    [TileType.WATER]: {
      textureKey: "water-tile",
      color: 0x2196f3,
    },
  };

  static preload(scene: Phaser.Scene): void {
    Object.values(TileType).forEach((type) => {
      if (!scene.textures.exists(this.TILE_CONFIGS[type].textureKey)) {
        this.createTileTexture(scene, type);
      }
    });
  }

  static create(
    scene: Phaser.Scene,
    type: TileType,
    x: number,
    y: number
  ): Phaser.GameObjects.Sprite {
    const textureKey = this.TILE_CONFIGS[type].textureKey;
    return scene.add.sprite(x, y, textureKey);
  }

  private static createTileTexture(scene: Phaser.Scene, type: TileType): void {
    const graphics = scene.add.graphics();
    const config = this.TILE_CONFIGS[type];

    // Base do tile
    graphics.fillStyle(config.color, 1);
    graphics.fillRect(0, 0, this.SIZE.width, this.SIZE.height);

    // Detalhes específicos por tipo
    switch (type) {
      case TileType.GRASS:
        this.addGrassDetails(graphics);
        break;
      case TileType.CONCRETE_WALL:
        this.addWallDetails(graphics);
        break;
      case TileType.WATER:
        this.addWaterDetails(graphics);
        break;
    }

    graphics.generateTexture(
      config.textureKey,
      this.SIZE.width,
      this.SIZE.height
    );
    graphics.destroy();
  }

  private static addGrassDetails(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x388e3c, 1);
    for (let i = 0; i < 5; i++) {
      graphics.fillRect(i * 6 + 3, 0, 2, this.SIZE.height);
    }
  }

  private static addWallDetails(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x757575, 1);
    for (let y = 0; y < this.SIZE.height; y += 8) {
      for (let x = 0; x < this.SIZE.width; x += 8) {
        if ((x + y) % 16 === 0) {
          graphics.fillRect(x, y, 4, 4);
        }
      }
    }
  }

  private static addWaterDetails(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(2, 0x1976d2, 0.7);
    for (let y = 4; y < this.SIZE.height; y += 8) {
      graphics.beginPath();
      graphics.moveTo(0, y);
      // Implementação alternativa sem bezierCurveTo
      graphics.lineTo(8, y + 3);
      graphics.lineTo(24, y - 3);
      graphics.lineTo(this.SIZE.width, y);
      graphics.strokePath();
    }
  }
}
