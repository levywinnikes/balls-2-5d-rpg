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
import { RedRoofGraphicRight } from "./roof/RedRoofGraphicRight";
import { RedRoofGraphicLeft } from "./roof/RedRoofGraphicLeft";
import { RedRoofGraphicTop } from "./roof/RedRoofGraphicTop";
import { RedRoofGraphicBottom } from "./roof/RedRoofGraphicBottom";
import { GenericWallGraphic } from "./WallGraphic";

// All wall tiles are now unified in WallTiles.ts (no directional distinction in 32x32 grid)
import { SideWalls, FrontWalls, CornerWalls, DetailWalls } from "./WallTiles";

import { GrassGraphicTop } from "./GrassGraphicTop";
import { GrassGraphicPath } from "./GrassPath";
import { SnowGraphic } from "./SnowGraphic";
import { LavaGraphic } from "./LavaGraphic";
import { CactusGraphic } from "./CactusGraphic";
import { IceGraphic } from "./IceGraphic";
import { FrozenTreeGraphic } from "./FrozenTreeGraphic";
import { CloudGraphic } from "./CloudGraphic";
import { BasaltGraphic } from "./BasaltGraphic";
import { BedGraphic } from "./house/BedGraphic";
import { ProceduralTransition, TransitionDirection } from "./ProceduralTransition";

// Central registry for all game tiles
const COLORS = {
    grass: 0x4ade80,
    water: 0x00bfff,
    sand: 0xf4e1a1
};

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
  color?: string;
};

export class TileRegistry {
  public static tiles: Map<string, TileDefinition> = new Map();
  private static initialized = false;

  static initialize() {
    if (this.initialized) return;

    this.registerTiles([
      {
        id: "red-roof-bottom",
        graphic: RedRoofGraphicBottom,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
        origin: { x: 0.5, y: 0.5 },
      },
      {
        id: "red-roof-top",
        graphic: RedRoofGraphicTop,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
        origin: { x: 0.5, y: 0.5 },
      },
      {
        id: "red-roof-left",
        graphic: RedRoofGraphicLeft,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
        origin: { x: 0.5, y: 0.5 },
      },
      {
        id: "red-roof-right",
        graphic: RedRoofGraphicRight,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
        origin: { x: 0.5, y: 0.5 },
      },
      {
        id: "red-roof",
        graphic: RedRoofGraphic,
        color: "#ef4444",
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
        origin: { x: 0.5, y: 0.5 },
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
          true,
          2,
          { width: 32, height: 32 },
          { width: 32, height: 32 }
        ),
        isCollidable: true,
        blocksRanged: true,
        baseDepth: 2,
        origin: { x: 0.5, y: 0.5 }, 
      },

      {
        id: "sand",
        graphic: SandGraphic,
        color: "#fde047",
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "grass",
        graphic: GrassGraphic,
        color: "#4ade80",
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "grass-top",
        graphic: GrassGraphicTop,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "grass-path",
        graphic: GrassGraphicPath,
        color: "#a3e635",
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "water",
        graphic: WaterGraphic,
        color: "#3b82f6",
        isCollidable: true,
        blocksRanged: false,
        baseDepth: 0,
        bodySize: { width: 32, height: 32 },
      },
      {
        id: "wall",
        graphic: ConcreteWallGraphic,
        color: "#94a3b8",
        isCollidable: true,
        blocksRanged: true,
        baseDepth: 2,
        bodySize: { width: 32, height: 32 },
      },
      {
        id: "floor",
        graphic: WoodenFloorGraphic,
        color: "#78350f",
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "tree",
        graphic: TreeGraphic,
        color: "#166534",
        isCollidable: true,
        baseDepth: 2,
        blocksRanged: true,
        bodySize: { width: 32, height: 32 },
        bodyOffset: { x: 0, y: 0 },
      },
      {
        id: "rock",
        graphic: RockGraphic,
        isCollidable: true,
        blocksRanged: false,
        baseDepth: 1,
        bodySize: { width: 32, height: 32 },
        bodyOffset: { x: 0, y: 0 },
      },
      {
        id: "mountain",
        graphic: MountainGraphic,
        color: "#475569",
        isCollidable: true,
        blocksRanged: true,
        baseDepth: 2,
        bodySize: { width: 32, height: 32 },
      },
      {
        id: "dirty",
        graphic: DirtyGraphic,
        color: "#451a03",
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "dirty_floor",
        graphic: DirtyFloorGraphic,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
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
          true,
          1,
          { width: 32, height: 32 },
          { width: 32, height: 32 }
        ),
        isCollidable: true,
        blocksRanged: false,
        baseDepth: 1, 
      },
      {
        id: "snow",
        graphic: SnowGraphic,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "lava",
        graphic: LavaGraphic,
        isCollidable: true,
        blocksRanged: false,
        baseDepth: 0,
        bodySize: { width: 32, height: 32 },
      },
      {
        id: "cactus",
        graphic: CactusGraphic,
        isCollidable: true,
        blocksRanged: true,
        baseDepth: 1,
        bodySize: { width: 24, height: 24 },
        bodyOffset: { x: 4, y: 4 },
      },
      {
        id: "ice",
        graphic: IceGraphic,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "frozen-tree",
        graphic: FrozenTreeGraphic,
        isCollidable: true,
        blocksRanged: true,
        baseDepth: 2,
        bodySize: { width: 32, height: 32 },
        bodyOffset: { x: 0, y: 0 },
      },
      {
        id: "cloud",
        graphic: CloudGraphic,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "basalt",
        graphic: BasaltGraphic,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "bed_head",
        graphic: {
          preload: (scene: Phaser.Scene) => BedGraphic.preload(scene),
          create: (scene: Phaser.Scene, x: number, y: number) => BedGraphic.create(scene, x, y, "head")
        },
        isCollidable: true,
        blocksRanged: false,
        baseDepth: 1,
        color: "#f5f5dc",
      },
      {
        id: "bed_foot",
        graphic: {
          preload: (scene: Phaser.Scene) => BedGraphic.preload(scene),
          create: (scene: Phaser.Scene, x: number, y: number) => BedGraphic.create(scene, x, y, "body")
        },
        isCollidable: true,
        blocksRanged: false,
        baseDepth: 1,
        color: "#4682b4",
      },
    ]);

    // --- Dynamic Registration for Terrain Transitions ---
    const directions: TransitionDirection[] = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];
    
    // 1. Grass / Water Hybrids
    directions.forEach(dir => {
        this.registerTile({
            id: `grs_wat_${dir}`,
            graphic: new ProceduralTransition(COLORS.grass, COLORS.water, dir, `grs_wat_${dir}`),
            isCollidable: false,
            blocksRanged: false,
            baseDepth: 0
        });
    });

    // 2. Grass / Sand Hybrids
    directions.forEach(dir => {
        this.registerTile({
            id: `grs_snd_${dir}`,
            graphic: new ProceduralTransition(COLORS.grass, COLORS.sand, dir, `grs_snd_${dir}`),
            isCollidable: false,
            blocksRanged: false,
            baseDepth: 0
        });
    });

    // 3. Path / Water Hybrids
    directions.forEach(dir => {
        this.registerTile({
            id: `pth_wat_${dir}`,
            graphic: new ProceduralTransition(COLORS.grass, COLORS.water, dir, `pth_wat_${dir}`),
            isCollidable: false,
            blocksRanged: false,
            baseDepth: 0
        });
    });

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
