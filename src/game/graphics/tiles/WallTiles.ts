/**
 * WallTiles — Consolidated Wall Registry
 * 
 * In the 32x32 procedural system, all walls are rendered as flat colored squares.
 * There is no visual distinction between "side", "front", or "corner" walls.
 * All directional variants are preserved here as IDs for map compatibility,
 * but they all use the same GenericWallGraphic renderer.
 */
import { TileDefinition } from "./TileRegistry";
import { GenericWallGraphic } from "./WallGraphic";

const wallIds: { id: string; isCollidable?: boolean }[] = [
  // --- Brick walls (all directions merged) ---
  { id: "brick-wall-texture-side" },
  { id: "brick-wall-texture-front" },
  { id: "brick-wall-corner-right" },
  { id: "brick-wall-corner-detail" },

  // --- Wooden house walls (all directions merged) ---
  { id: "house-wall" },
  { id: "house-wall-side" },
  { id: "house-wall-window-front" },
  { id: "house-wall-window-side" },
  { id: "house-wall-corner-right" },
  { id: "house-wall-corner-left" },
  { id: "house-wall-corner-detail" },
  { id: "house-wall-texture-front", isCollidable: false }, // Decorative only
  { id: "house-wall-corner-detail" },

  // --- Cave walls ---
  { id: "cave-wall-side" },
  { id: "cave-wall-front" },
  { id: "cave-wall-corner" },
  { id: "cave-wall-corner-detail" },
];

// Deduplicate by ID (in case same ID appears twice)
const seen = new Set<string>();
const uniqueWalls = wallIds.filter(w => {
  if (seen.has(w.id)) return false;
  seen.add(w.id);
  return true;
});

export const WallTiles: TileDefinition[] = uniqueWalls.map((entry) => {
  const { id, isCollidable = true } = entry;

  // Determine colors based on ID
  let baseColor = 0x808080; // Gray default
  let borderColor = 0x404040;

  if (id.includes("house")) {
    baseColor = 0x5a3825; // Wooden brown
    borderColor = 0x3d2619; // Darker brown
  }

  return {
    id,
    graphic: new GenericWallGraphic(
      id,
      isCollidable,
      2,
      { width: 32, height: 32 },
      { width: 32, height: 32 },
      baseColor,
      borderColor
    ),
    isCollidable,
    blocksRanged: true,
    baseDepth: 2,
    bodySize: { width: 32, height: 32 },
    bodyOffset: { x: 0, y: 0 },
  };
});

// Re-export old names for backward compatibility during migration
// (TileRegistry still imports these; they now all resolve to WallTiles)
export const SideWalls = WallTiles;
export const FrontWalls = WallTiles;
export const CornerWalls = WallTiles;
export const DetailWalls = WallTiles;
