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
import { BedHeadGraphic, BedBodyGraphic } from "./house/BedGraphic";
import { PavementGraphic } from "./floor/PavementGraphic";
import { ProceduralTransition, TransitionDirection } from "./ProceduralTransition";
import { DungeonFloorGraphic } from "./DungeonFloorGraphic";
import { DungeonWallGraphic } from "./DungeonWallGraphic";
import { CrackedEarthGraphic } from "./CrackedEarthGraphic";
import { MudGraphic } from "./MudGraphic";
import { CorruptedGrassGraphic } from "./CorruptedGrassGraphic";
import { ToxicWaterGraphic } from "./ToxicWaterGraphic";
import { IceCaveFloorGraphic } from "./IceCaveFloorGraphic";
import { CrystalSpikeGraphic } from "./CrystalSpikeGraphic";
import { ObsidianFloorGraphic } from "./ObsidianFloorGraphic";
import { CobblestoneGraphic } from "./CobblestoneGraphic";
import { RuinedPathGraphic } from "./RuinedPathGraphic";
import { SewerBrickGraphic } from "./floor/SewerBrickGraphic";
import { ManholeGraphic } from "./floor/ManholeGraphic";
import { GothicWallGraphic } from "./wall/GothicWallGraphic";
import { FoundationWallGraphic } from "./wall/FoundationWallGraphic";
import { StoneWallGraphic } from "./wall/StoneWallGraphic";
import { StoneStatueGraphic } from "./decoration/StoneStatueGraphic";
import { WoodenRoofGraphic } from "./roof/WoodenRoofGraphic";

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
/**
 * ⚠️ MANDATORY TILE CONTRACT ⚠️
 * When creating or modifying floor/walkable tiles, you MUST:
 * 1. Define 'stepSound': Mapping to AudioManager keys (grass, sand, dirty, water, mountain, floor).
 * 2. Define 'speedModifier': Float value (1.0 = full speed, 0.5 = half speed).
 * 3. Define 'color': Hex string for Minimap/WorldMap support.
 */
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
  stepSound?: string;      // Key for AudioManager footstep
  speedModifier?: number;  // Velocity multiplier (default 1.0)
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
        stepSound: "sand",
        speedModifier: 0.7,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "grass",
        graphic: GrassGraphic,
        color: "#4ade80",
        stepSound: "grass",
        speedModifier: 0.8,
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
        stepSound: "dirty",
        speedModifier: 0.9,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "water",
        graphic: WaterGraphic,
        color: "#3b82f6",
        stepSound: "water",
        speedModifier: 0.4,
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
        stepSound: "floor",
        speedModifier: 1.0,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "sewer-brick",
        graphic: SewerBrickGraphic,
        color: "#1e293b",
        stepSound: "mountain",
        speedModifier: 1.0,
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
        stepSound: "mountain",
        speedModifier: 0.6,
        isCollidable: true,
        blocksRanged: true,
        baseDepth: 2,
        bodySize: { width: 32, height: 32 },
      },
      {
        id: "mountain-edge",
        graphic: MountainGraphic,
        color: "#64748b",
        stepSound: "mountain",
        speedModifier: 0.8, // Slightly easier to walk on
        isCollidable: true,
        blocksRanged: true,
        baseDepth: 2,
        bodySize: { width: 32, height: 32 },
      },
      {
        id: "dirty",
        graphic: DirtyGraphic,
        color: "#451a03",
        stepSound: "dirty",
        speedModifier: 0.9,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "dirty_floor",
        graphic: DirtyFloorGraphic,
        stepSound: "dirty",
        speedModifier: 0.9,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "stair_up",
        graphic: StairUpGraphic,
        color: "#daa520",
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 1,
      },
      // MANDATORY: Ensure 'color' is defined for Minimap/WorldMap support.
      {
        id: "pavement",
        graphic: PavementGraphic,
        color: "#808080",
        stepSound: "floor",
        speedModifier: 1.0,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "stair_down",
        graphic: StairDownGraphic,
        color: "#daa520",
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 1,
      },
      {
        id: "hole",
        graphic: ManholeGraphic, 
        color: "#171717",
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "manhole",
        graphic: ManholeGraphic,
        color: "#171717",
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
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
        color: "#8b4513",
        isCollidable: true,
        blocksRanged: false,
        baseDepth: 1, 
      },
      {
        id: "snow",
        graphic: SnowGraphic,
        color: "#ffffff",
        stepSound: "sand", // Deep crunchy snow
        speedModifier: 0.7,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "lava",
        graphic: LavaGraphic,
        color: "#ff4500",
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
        color: "#e0f2fe",
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
        color: "#ffffff",
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "basalt",
        graphic: BasaltGraphic,
        color: "#262626",
        stepSound: "mountain",
        speedModifier: 1.0,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "bed_head",
        graphic: BedHeadGraphic,
        isCollidable: true,
        blocksRanged: false,
        baseDepth: 1,
        color: "#f5f5dc",
      },
      {
        id: "bed_foot",
        graphic: BedBodyGraphic,
        isCollidable: true,
        blocksRanged: false,
        baseDepth: 1,
        color: "#4682b4",
      },
      {
        id: "dungeon-floor",
        graphic: DungeonFloorGraphic,
        color: "#334155",
        stepSound: "mountain", // Stone sound
        speedModifier: 1.0,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "dungeon-wall",
        graphic: DungeonWallGraphic,
        color: "#1e293b",
        isCollidable: true,
        blocksRanged: true,
        baseDepth: 2,
        bodySize: { width: 32, height: 32 },
      },
      {
        id: "cracked-earth",
        graphic: CrackedEarthGraphic,
        color: "#d2b48c",
        stepSound: "sand",
        speedModifier: 0.8,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "mud",
        graphic: MudGraphic,
        color: "#451a03",
        stepSound: "water",
        speedModifier: 0.5,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "corrupted-grass",
        graphic: CorruptedGrassGraphic,
        color: "#312e81",
        stepSound: "grass",
        speedModifier: 0.8,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "toxic-water",
        graphic: ToxicWaterGraphic,
        color: "#064e3b",
        stepSound: "water",
        speedModifier: 0.4,
        isCollidable: true,
        blocksRanged: false,
        baseDepth: 0,
        bodySize: { width: 32, height: 32 },
      },
      {
        id: "ice-cave-floor",
        graphic: IceCaveFloorGraphic,
        color: "#0c4a6e",
        stepSound: "floor",
        speedModifier: 1.0,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "crystal-spike",
        graphic: CrystalSpikeGraphic,
        color: "#38bdf8",
        isCollidable: true,
        blocksRanged: true,
        baseDepth: 1,
        bodySize: { width: 24, height: 24 },
        bodyOffset: { x: 4, y: 4 },
      },
      {
        id: "obsidian-floor",
        graphic: ObsidianFloorGraphic,
        color: "#0a0a0a",
        stepSound: "mountain",
        speedModifier: 1.0,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "cobblestone",
        graphic: CobblestoneGraphic,
        color: "#64748b",
        stepSound: "floor",
        speedModifier: 1.0,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "ruined-path",
        graphic: RuinedPathGraphic,
        color: "#78350f",
        stepSound: "dirty",
        speedModifier: 1.0,
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
      },
      {
        id: "gothic-wall",
        graphic: GothicWallGraphic,
        color: "#78716c",
        isCollidable: true,
        blocksRanged: true,
        baseDepth: 2,
        bodySize: { width: 32, height: 32 },
      },
      {
        id: "foundation-brick",
        graphic: FoundationWallGraphic,
        color: "#262626",
        isCollidable: true,
        blocksRanged: true,
        baseDepth: 2,
        bodySize: { width: 32, height: 32 },
      },
      {
        id: "stone-wall",
        graphic: StoneWallGraphic,
        color: "#4b5563",
        isCollidable: true,
        blocksRanged: true,
        baseDepth: 2,
        bodySize: { width: 32, height: 32 },
      },
      {
        id: "stone-statue",
        graphic: StoneStatueGraphic,
        color: "#6b7280",
        isCollidable: true,
        blocksRanged: true,
        baseDepth: 3,
        bodySize: { width: 24, height: 24 },
        bodyOffset: { x: 4, y: 4 },
      },
      {
        id: "wooden-roof",
        graphic: WoodenRoofGraphic,
        color: "#78350f",
        isCollidable: false,
        blocksRanged: false,
        baseDepth: 0,
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
      reusableSprite?: Phaser.GameObjects.Sprite;
    } = {},
    pool?: Phaser.GameObjects.Sprite[]
  ): {
    sprite: Phaser.GameObjects.Sprite;
    additionalSprites: Phaser.GameObjects.Sprite[];
    isCollidable: boolean;
  } {
    this.initialize();
    const tileDef = this.tiles.get(tileId);
    if (!tileDef) throw new Error(`Tile ${tileId} not registered`);

    const created = tileDef.graphic.create(
        scene, 
        x, 
        y, 
        options.reusableSprite ? [options.reusableSprite] : pool
    );

    let mainSprite: Phaser.GameObjects.Sprite;
    let additionalSprites: Phaser.GameObjects.Sprite[] = [];

    // Handle different return types
    if (created instanceof Phaser.GameObjects.Sprite) {
      mainSprite = created;
    } else if ("main" in created) {
      mainSprite = created.main;
      additionalSprites = created.additional || [];
    } else if ("blockingPart" in created) {
      mainSprite = created.blockingPart;
      additionalSprites = [created.upperPart];
    } else {
      throw new Error(`Invalid tile graphic return type for ${tileId}`);
    }

    // Reuse or Init Main Sprite
    if (tileDef.origin) {
      mainSprite.setOrigin(tileDef.origin.x, tileDef.origin.y);
    }
    
    // ... logic for depth ...
    let depth = (options.levelOffset || 0) + y;
    if (tileDef.baseDepth === 0) {
        depth = (options.levelOffset || 0) - 1000; 
    } else {
        depth += (tileDef.baseDepth || 0);
    }
    if (options.isUnderTile) depth -= 1;
    mainSprite.setDepth(depth);

    // Physics
    if (tileDef.isCollidable && scene.physics.world) {
      scene.physics.add.existing(mainSprite, true);
      const body = mainSprite.body as Phaser.Physics.Arcade.StaticBody;
      if (tileDef.bodySize) body.setSize(tileDef.bodySize.width, tileDef.bodySize.height, false);
      if (tileDef.bodyOffset) body.setOffset(tileDef.bodyOffset.x, tileDef.bodyOffset.y);
      body.enable = true; // Ensure re-enabled
      body.immovable = true;
    }

    // Additional Sprites
    additionalSprites.forEach((sprite) => {
      if (tileDef.origin) sprite.setOrigin(tileDef.origin.x, tileDef.origin.y);
      sprite.setDepth(depth + 0.1);
      sprite.setVisible(true); // Ensure re-visible if from pool
      sprite.setActive(true);
    });

    return {
      sprite: mainSprite,
      additionalSprites,
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
