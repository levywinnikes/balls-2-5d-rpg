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

// Add new Corner Walls here
const definitions: WallEntry[] = [
  { id: "brick-wall-corner-right", path: "assets/tiles/wall/brick-wall/wall-corner.png" },
  { id: "house-wall-corner-right", path: "assets/tiles/wall/wood-house/wall-corner.png" },
  "assets/tiles/wall/cave-wall/wall-corner.png"
];


export const CornerWalls: TileDefinition[] = definitions.map((entry) => {
    const path = typeof entry === 'string' ? entry : entry.path;
    const id = typeof entry === 'string' ? getIdFromPath(path) : entry.id;
    const isCollidable = typeof entry === 'object' && entry.isCollidable !== undefined ? entry.isCollidable : false;

    return {
      id,
      graphic: new GenericWallGraphic(
        id,
        path,
        false,
        2,
        { width: 128, height: 128 },
        { width: 128, height: 128 }
      ),
      isCollidable,
      blocksRanged: true,
      baseDepth: 2,
      bodySize: { width: 128, height: 128 },
      bodyOffset: { x: 128, y: 128 },
    };
});
