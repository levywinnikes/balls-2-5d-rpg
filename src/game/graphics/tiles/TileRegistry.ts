import Phaser from "phaser";
import { GrassGraphic } from "./GrassGraphic";
import { WaterGraphic } from "./WaterGraphic";
import { ConcreteWallGraphic } from "./ConcreteWallGraphic";
import { TreeGraphic } from "./TreeGraphic";
import { RockGraphic } from "./RockGraphic";
import { MountainGraphic } from "./MountainGraphic";
import { DirtyGraphic } from "./DirtyGraphic";
import { DirtyFloorGraphic } from "./DirtyFloorGraphic";
import { StairUpGraphic } from "./stairs/StairUpGraphic";
import { StairDownGraphic } from "./stairs/StairDownGraphic";
import { SandGraphic } from "./SandGraphic";
import { WoodenFloorGraphic } from "./floor/WoodenFloorGraphic";
import { RedRoofGraphic } from "./roof/RedRoofGraphic";
import { RedRoofRightGraphic } from "./roof/RedRoofGraphicRight";
import { RedRoofLeftGraphic } from "./roof/RedRoofGraphicLeft";
import { RedRoofTopGraphic } from "./roof/RedRoofGraphicTop";
import { RedRoofBottomGraphic } from "./roof/RedRoofGraphicBottom";
import { GenericWallGraphic } from "./WallGraphic";

// Import Wall Categories
import { SideWalls } from "./SideWalls";
import { FrontWalls } from "./FrontWalls";
import { CornerWalls } from "./CornerWalls";
import { DetailWalls } from "./DetailWalls";

import { GrassGraphicTop } from "./GrassGraphicTop";
import { GrassGraphicPath } from "./GrassPath";

type TileGraphic = {
  preload: (scene: Phaser.Scene) => void;
  create: (
    scene: Phaser.Scene,
    x: number,
    y: number,
    pool?: Phaser.GameObjects.Sprite[]
  ) =>
    | Phaser.GameObjects.Sprite
    | {
        main: Phaser.GameObjects.Sprite;
        additional?: Phaser.GameObjects.Sprite[];
      }
    | {
        blockingPart: Phaser.GameObjects.Sprite;
        upperPart: Phaser.GameObjects.Sprite;
      };
};
export type TileDefinition = {
  id: string;
  graphic: TileGraphic;
  isCollidable: boolean;
  blocksRanged: boolean;
  baseDepth?: number;
  origin?: { x: number; y: number };
  bodySize?: { width: number; height: number };
  bodyOffset?: { x: number; y: number };
  texturePath?: string;
};

export class TileRegistry {
  public static tiles: Map<string, TileDefinition> = new Map();
  private static initialized = false;

  static initialize() {
    if (this.initialized) return;

    this.registerTiles([
      {
        id: "red-roof-bottom",
        graphic: RedRoofBottomGraphic,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
        origin: { x: 0.3, y: 0.5 },
        texturePath: "assets/tiles/roof/redroofbottom.png"
      },

      {
        id: "red-roof-top",
        graphic: RedRoofTopGraphic,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
        origin: { x: 0.3, y: 0.5 },
        texturePath: "assets/tiles/roof/redrooftop.png" 
      },

      {
        id: "red-roof-left",
        graphic: RedRoofLeftGraphic,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
        origin: { x: 0.3, y: 0.5 },
        texturePath: "assets/tiles/roof/redroofleft.png"
      },

      {
        id: "red-roof-right",
        graphic: RedRoofRightGraphic,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
        origin: { x: 0.3, y: 0.5 },
        texturePath: "assets/tiles/roof/redroofright.png"
      },

      {
        id: "red-roof",
        graphic: RedRoofGraphic,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
        origin: { x: 0.3, y: 0.5 },
        texturePath: "assets/tiles/roof/redroofbottom.png" // Fallback
      },

      // --- Categorized Wall Sets ---
      ...SideWalls,
      ...FrontWalls,
      ...CornerWalls,
      ...DetailWalls,

      {
        id: "cute-wall",
        graphic: new GenericWallGraphic(
          "cute-wall",
          "assets/tiles/wall/cute-wall.png",
          true,
          2,
          { width: 128, height: 192 },
          { width: 128, height: 128 },
          { x: 0, y: 64 }, // Offset physics box down to align with floor
          { x: 0.5, y: 0.75 }
        ),
        isCollidable: true,
        blocksRanged: true,
        baseDepth: 2,
        origin: { x: 0.5, y: 0.75 }, 
      },

      {
        id: "sand",
        graphic: SandGraphic,
        isCollidable: false,
        blocksRanged: false,

        baseDepth: 0,
        texturePath: "assets/tiles/floor/sand.png"
      },
      {
        id: "grass",
        graphic: GrassGraphic,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
        texturePath: "assets/tiles/grass/cute-grass.png"
      },
      {
        id: "grass-top",
        graphic: GrassGraphicTop,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
        texturePath: "assets/tiles/grass/cute-grass-top.png"
      },
      {
        id: "grass-path",
        graphic: GrassGraphicPath,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "water",
        graphic: WaterGraphic,
        isCollidable: true,
        blocksRanged: false,
        baseDepth: 0,
        bodySize: { width: 128, height: 128 },
        // texturePath: "assets/tiles/water/water.png" // Missing
      },
      {
        id: "wall",
        graphic: ConcreteWallGraphic,
        isCollidable: true,
        blocksRanged: true,
        baseDepth: 2,
        bodySize: { width: 128, height: 128 },
        // texturePath: "assets/tiles/wall/concrete_wall.png" // Missing
      },
      {
        id: "floor",
        graphic: WoodenFloorGraphic,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
        texturePath: "assets/tiles/floor/wooden-floor.png"
      },
      {
        id: "tree",
        graphic: TreeGraphic,
        isCollidable: true,
        baseDepth: 2,
        blocksRanged: true,

        // Tree is 32x32 scaled 4x = 128x128.
        // Trunk is approx 16px wide at bottom center.
        // Let's set a small base collision.
        bodySize: { width: 32, height: 32 },
        bodyOffset: { x: 48, y: 80 }, // Centered bottom
      },
      {
        id: "rock",
        graphic: RockGraphic,
        isCollidable: true,
        blocksRanged: false, // Low object

        baseDepth: 1,
        // Rock is small centered object.
        bodySize: { width: 64, height: 64 },
        bodyOffset: { x: 32, y: 32 },
      },
      {
        id: "mountain",
        graphic: MountainGraphic,
        isCollidable: true,
        blocksRanged: true,

        baseDepth: 2,
      },
      {
        id: "dirty",
        graphic: DirtyGraphic,
        isCollidable: false,
        blocksRanged: false,

        baseDepth: 0,
        texturePath: "assets/tiles/floor/dirty.png"
      },
      {
        id: "dirty_floor",
        graphic: DirtyFloorGraphic,
        isCollidable: false,
        blocksRanged: false,

        baseDepth: 0,
        texturePath: "assets/tiles/floor/dirty_floor.png"
      },
      {
        id: "stair_up",
        graphic: StairUpGraphic,
        isCollidable: false,
        blocksRanged: false,

        baseDepth: 1,
      },
      {
        id: "stair_down",
        graphic: StairDownGraphic,
        isCollidable: false,
        blocksRanged: false,

        baseDepth: 1,
      },
      {
        id: "wooden_chest",
        graphic: new GenericWallGraphic(
          "wooden_chest",
          "assets/tiles/chests/wooden-chest.png",
          false, // Is Transparent? No.
          1,     // Base Depth
          { width: 64, height: 64 }, // TargetSize: 64 * 2 = 128px Final
          { width: 128, height: 128 } // CollisionSize
        ),
        isCollidable: true,
        blocksRanged: false, // Low object
        baseDepth: 1, 
      },
    ]);

    this.initialized = true;
  }

  static preloadAll(scene: Phaser.Scene): void {
    this.initialize();
    this.tiles.forEach((tile) => {
      tile.graphic.preload(scene);
    });
  }

  static getDepthForTile(
    tileId: string,
    targetLevel: number,
    currentLevel: number
  ): number {
    const baseDepth = this.getBaseDepth(tileId);
    const levelDiff = currentLevel - targetLevel;
    return baseDepth - levelDiff * 100; // -100 por nível abaixo
  }

  static isCollidable(tileId: string): boolean {
    return this.tiles.get(tileId)?.isCollidable ?? false;
  }

  static createTile(
    scene: Phaser.Scene,
    tileId: string,
    x: number,
    y: number,
    options: {
      levelOffset?: number;
      isUnderTile?: boolean;
      customDepth?: number;
    } = {},
    pool?: Phaser.GameObjects.Sprite[]
  ): {
    sprite: Phaser.GameObjects.Sprite;
    isCollidable: boolean;
  } {
    this.initialize();
    const tileDef = this.tiles.get(tileId);
    if (!tileDef) throw new Error(`Tile ${tileId} not registered`);

    const created = tileDef.graphic.create(scene, x, y, pool);

    let mainSprite: Phaser.GameObjects.Sprite;
    let additionalSprites: Phaser.GameObjects.Sprite[] = [];

    // Handle different return types
    if (created instanceof Phaser.GameObjects.Sprite) {
      mainSprite = created;
    } else if ("main" in created) {
      mainSprite = created.main;
      additionalSprites = created.additional || [];
    } else if ("blockingPart" in created) {
      // Special handling for SideWallGraphic
      mainSprite = created.blockingPart;
      additionalSprites = [created.upperPart];
    } else {
      throw new Error(`Invalid tile graphic return type for ${tileId}`);
    }

    // Configurações comuns para o sprite principal
    if (tileDef.origin) {
      mainSprite.setOrigin(tileDef.origin.x, tileDef.origin.y);
    }

    // Calular Depth Baseado em Y-Sorting + Level Offset
    // Se levelOffset for muito grande (ex: 10000), ele separa os andares.
    // Dentro do andar, usamos Y.
    // BaseDepth ainda serve como ajuste fino (ex: chão sempre abaixo de tudo no mesmo Y).
    // Mas para Y-sort real, items devem ter depth = y.
    
    // FORMULA: LevelOffset + Y + BaseAdjustment
    // LevelOffset já vem multiplicado por 10000 do DynamicLevelRenderer
    
    let depth = (options.levelOffset || 0) + y;

    // Ajustes específicos:
    // Chão (Floor/Water) deve ficar sempre no fundo, independente do Y, para não cobrir pés
    if (tileDef.baseDepth === 0) {
        // Força chão para uma camada "fundo" dentro do nível
        // Se Y vai de 0 a 10000 (mapa grande), chão deve estar abaixo de 0?
        // Ou simplesmente: depth = levelOffset - 1000;
        depth = (options.levelOffset || 0) - 1000; 
    } else {
        // Paredes e Objetos altos usam Y.
        // Adiciona baseDepth para ajustes finos em conflitos
        depth += (tileDef.baseDepth || 0);
    }

    if (options.isUnderTile) {
        depth -= 1; // Levemente abaixo da camada principal
    }

    mainSprite.setDepth(depth);

    // Configurar física se for colidível
    if (tileDef.isCollidable && scene.physics.world) {
      scene.physics.add.existing(mainSprite, true);
      const body = mainSprite.body as Phaser.Physics.Arcade.Body;

      if (tileDef.bodySize) {
        body.setSize(tileDef.bodySize.width, tileDef.bodySize.height, false);
      }

      if (tileDef.bodyOffset) {
        body.setOffset(tileDef.bodyOffset.x, tileDef.bodyOffset.y);
      }
      
      // Update body to match changes
      // body.updateFromGameObject(); // REMOVED: This resets size to texture size!

      // Debug
      (body as any).debugShowBody = true;
      (body as any).debugBodyColor = 0x0000ff; // Blue for Registry overrides

      body.immovable = true;
    }

    // Configurações para sprites adicionais
    additionalSprites.forEach((sprite) => {
      if (tileDef.origin) {
        sprite.setOrigin(tileDef.origin.x, tileDef.origin.y);
      }
      sprite.setDepth(depth + 0.1); // Pequeno ajuste para garantir ordem
    });

    return {
      sprite: mainSprite,
      isCollidable: tileDef.isCollidable,
    };
  }

  static registerTile(tile: TileDefinition): void {
    this.tiles.set(tile.id, tile);
  }

  static registerTiles(tiles: TileDefinition[]): void {
    tiles.forEach((tile) => this.registerTile(tile));
  }

  static getBaseDepth(tileId: string): number {
    this.initialize();
    return this.tiles.get(tileId)?.baseDepth ?? 1;
  }

  static getTileDefinition(tileId: string): TileDefinition | undefined {
    this.initialize();
    return this.tiles.get(tileId);
  }

  static doesTileBlockRanged(tileId: string): boolean {
    this.initialize();
    const tileDef = this.tiles.get(tileId);
    return tileDef?.blocksRanged ?? false;
  }

  static getRegisteredTiles(): TileDefinition[] {
      this.initialize();
      return Array.from(this.tiles.values());
  }
}
