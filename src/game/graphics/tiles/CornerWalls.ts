import { TileDefinition } from "./TileRegistry";
import { GenericWallGraphic } from "./WallGraphic";

// All corner wall definitions — IDs only, no PNG paths.
// Textures are generated procedurally by GenericWallGraphic.
const definitions: { id: string; isCollidable?: boolean }[] = [
  { id: "brick-wall-corner-right" },
  { id: "house-wall-corner-right" },
  { id: "cave-wall-corner" },
];

export const CornerWalls: TileDefinition[] = definitions.map((entry) => {
    const { id, isCollidable = false } = entry;

    return {
      id,
      graphic: new GenericWallGraphic(
        id,
        false,
        2,
        { width: 32, height: 32 },
        { width: 32, height: 32 }
      ),
      isCollidable,
      blocksRanged: true,
      baseDepth: 2,
      bodySize: { width: 32, height: 32 },
      bodyOffset: { x: 0, y: 0 },
    };
});
