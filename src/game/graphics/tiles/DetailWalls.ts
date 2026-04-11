import { TileDefinition } from "./TileRegistry";
import { GenericWallGraphic } from "./WallGraphic";

// All detail wall definitions — IDs only, no PNG paths.
// Textures are generated procedurally by GenericWallGraphic.
const definitions: { id: string; isCollidable?: boolean }[] = [
  { id: "brick-wall-corner-detail" },
  { id: "house-wall-corner-detail" },
  { id: "cave-wall-corner-detail" },
];

export const DetailWalls: TileDefinition[] = definitions.map((entry) => {
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
