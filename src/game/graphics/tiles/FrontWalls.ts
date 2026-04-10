import { TileDefinition } from "./TileRegistry";
import { GenericWallGraphic } from "./WallGraphic";

// Helper to generate ID from path
function getIdFromPath(path: string): string {
  const parts = path.split('/');
  const filename = parts.pop()?.replace(/\.[^/.]+$/, "") || ""; 
  const folder = parts.pop() || "";
  return `${folder}-${filename}`;
}

type WallEntry = string | { id: string; path: string; isCollidable?: boolean };

// Add new Front Walls here
const definitions: WallEntry[] = [
  { id: "brick-wall-texture-front", path: "assets/tiles/wall/brick-wall/wall-front.png" },
  { id: "house-wall", path: "assets/tiles/wall/wood-house/wall-front.png" }, // Note: ID is 'house-wall' not 'house-wall-front'
  { id: "house-wall-window-front", path: "assets/tiles/wall/wood-house/wall-window-front.png" },
  { id: "house-wall-texture-front", path: "assets/tiles/wall/wall-front.png", isCollidable: false }, // Special case
  "assets/tiles/wall/cave-wall/wall-front.png"
];


export const FrontWalls: TileDefinition[] = definitions.map((entry) => {
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
        { width: 128, height: 32 }
      ),
      isCollidable,
      blocksRanged: true,
      baseDepth: 2,
      origin: { x: 0.5, y: 0.75 },
      bodySize: { width: 128, height: 32 },
      bodyOffset: { x: 128, y: 226 },
      texturePath: path 
    };
});
