import { TileDefinition } from "./TileRegistry";
import { GenericWallGraphic } from "./WallGraphic";

// All side wall definitions — IDs only, no PNG paths.
// Textures are generated procedurally by GenericWallGraphic.
const definitions: { id: string; isCollidable?: boolean }[] = [
  { id: "brick-wall-texture-side" },
  { id: "house-wall-side" },
  { id: "house-wall-window-side" },
  { id: "cave-wall-side" },
];

export const SideWalls: TileDefinition[] = definitions.map((entry) => {
    const { id, isCollidable = true } = entry;

    return {
      id,
      graphic: new GenericWallGraphic(
        id,
        false, // Side parts are non-colliding wrappers; the main body handles it
        2,
        { width: 32, height: 32 },
        { width: 8, height: 32 } // Narrow collision for side walls
      ),
      isCollidable,
      blocksRanged: true,
      baseDepth: 2,
      origin: { x: 0.5, y: 0.75 },
      bodySize: { width: 32, height: 32 },
      bodyOffset: { x: 0, y: 0 },
    };
});
