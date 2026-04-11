import { TileDefinition } from "./TileRegistry";
import { GenericWallGraphic } from "./WallGraphic";

// All front wall definitions — IDs only, no PNG paths.
// Textures are generated procedurally by GenericWallGraphic.
const definitions: { id: string; isCollidable?: boolean }[] = [
  { id: "brick-wall-texture-front" },
  { id: "house-wall" },             // Front wall of wooden house
  { id: "house-wall-window-front" }, // Front wall with window
  { id: "house-wall-texture-front", isCollidable: false }, // Decorative only
  { id: "cave-wall-front" },
];

export const FrontWalls: TileDefinition[] = definitions.map((entry) => {
    const { id, isCollidable = true } = entry;

    return {
      id,
      graphic: new GenericWallGraphic(
        id,
        true, // Front walls are usually collidable
        2,
        { width: 32, height: 32 },
        { width: 32, height: 8 } // Narrow collision for front walls
      ),
      isCollidable,
      blocksRanged: true,
      baseDepth: 2,
      origin: { x: 0.5, y: 0.75 },
      bodySize: { width: 32, height: 32 },
      bodyOffset: { x: 0, y: 0 },
    };
});
