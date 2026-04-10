import { TileDefinition } from "./TileRegistry";
import { GenericWallGraphic } from "./WallGraphic";

// Helper to generate ID from path: "assets/tiles/wall/wood-house/wall-side.png" -> "wood-house-wall-side"
function getIdFromPath(path: string): string {
  const parts = path.split('/');
  const filename = parts.pop()?.replace(/\.[^/.]+$/, "") || ""; // remove extension
  const folder = parts.pop() || "";
  return `${folder}-${filename}`;
}

type WallEntry = string | { id: string; path: string; isCollidable?: boolean };

// Add new Side Walls here
const definitions: WallEntry[] = [
  { id: "brick-wall-texture-side", path: "assets/tiles/wall/brick-wall/wall-side.png" },
  { id: "house-wall-side", path: "assets/tiles/wall/wood-house/wall-side.png" },
  { 
    id: "house-wall-window-side", 
    path: "assets/tiles/wall/wood-house/wall-window-side.png",
  },
  "assets/tiles/wall/cave-wall/wall-side.png"
];


export const SideWalls: TileDefinition[] = definitions.map((entry) => {
    const path = typeof entry === 'string' ? entry : entry.path;
    const id = typeof entry === 'string' ? getIdFromPath(path) : entry.id;
    const isCollidable = typeof entry === 'object' && entry.isCollidable !== undefined ? entry.isCollidable : true;

    return {
      id,
      graphic: new GenericWallGraphic(
        id,
        path,
        false,
        2,
        { width: 128, height: 128 },
        { width: 32, height: 128 }
      ),
      isCollidable,
      blocksRanged: true,
      baseDepth: 2,
      origin: { x: 0.5, y: 0.75 },
      bodySize: { width: 64, height: 128 },
      bodyOffset: { x: 194, y: 128 },
    };
});
