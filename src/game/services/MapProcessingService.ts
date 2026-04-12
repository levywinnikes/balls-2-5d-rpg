import { TileRegistry } from "../graphics/tiles/TileRegistry";

export interface ProcessedMapData {
  spawnInfo: { x: number; y: number; level: string };
  pathfindingGrids: Record<string, number[][]>;
  normalizedMapData: any;
}

export class MapProcessingService {
  /**
   * Scans the map matrix for the player starting position.
   */
  public static findSpawn(mapData: any): { x: number; y: number; level: string } {
    const fallback = { x: 4096, y: 4096, level: "0" };

    if (!mapData || !mapData.levels) return fallback;

    // Check level "0" first as it's the standard entry point
    if (mapData.levels["0"] && mapData.levels["0"].playerPos) {
      return {
        x: mapData.levels["0"].playerPos.x,
        y: mapData.levels["0"].playerPos.y,
        level: "0",
      };
    }

    // Identify player symbol from entities table
    let playerSymbol = "ply";
    if (mapData.entities) {
      const foundKey = Object.keys(mapData.entities).find(
        (key) => mapData.entities[key].type === "player"
      );
      if (foundKey) playerSymbol = foundKey;
    }

    const tileSize = mapData.tileSize || 32;
    const levelKeys = Object.keys(mapData.levels);
    
    // Scan levels starting from 0
    const orderedLevels = ["0", ...levelKeys.filter((k) => k !== "0")];

    for (const level of orderedLevels) {
      const g = mapData.levels[level].map;
      if (!g) continue;
      for (let y = 0; y < g.length; y++) {
        for (let x = 0; x < g[y].length; x++) {
          if (g[y][x] === playerSymbol) {
            return {
              x: x * tileSize + tileSize / 2,
              y: y * tileSize + tileSize / 2,
              level: level,
            };
          }
        }
      }
    }

    return fallback;
  }

  /**
   * Normalizes map data: 
   * 1. Converts [string] map to [[string]]
   * 2. Pads floors to same max dimensions
   */
  public static normalizeMap(data: any): { normalizedData: any, needsNormalization: boolean } {
    // 1. Basic preprocessing (convert shorthand string list to grid)
    const baseNormalized: any = {
      ...data,
      levels: {},
    };
    
    let maxRows = 0;
    let maxCols = 0;

    for (const levelKey in data.levels) {
        const levelData = data.levels[levelKey];
        let grid: string[][];
        
        // Convert array of space-separated strings to 2D array
        if (levelData.map.length > 0 && typeof levelData.map[0] === "string") {
             grid = levelData.map.map((row: string) => row.trim().split(/\s+/));
        } else {
             grid = levelData.map;
        }
        
        baseNormalized.levels[levelKey] = { ...levelData, map: grid };
        
        // Track max dimensions for point 2
        maxRows = Math.max(maxRows, grid.length);
        maxCols = Math.max(maxCols, grid[0]?.length || 0);
    }

    // 2. Padding to same size (Critical for 2.5D rendering transparency alignment)
    let needsNormalization = false;
    for (const levelKey in baseNormalized.levels) {
        const grid = baseNormalized.levels[levelKey].map;
        if (grid.length !== maxRows || (grid[0]?.length || 0) !== maxCols) {
            needsNormalization = true;
            break;
        }
    }

    if (!needsNormalization) {
        return { normalizedData: baseNormalized, needsNormalization: false };
    }

    // Perform actual padding
    const finalLevels: Record<string, any> = {};
    for (const levelKey in baseNormalized.levels) {
        const levelData = baseNormalized.levels[levelKey];
        const currentRows = levelData.map.length;
        const currentCols = levelData.map[0]?.length || 0;
        const fillTile = levelKey === "0" ? "wat" : "...";
        
        const newMap: string[][] = [];
        for (let y = 0; y < maxRows; y++) {
            const row: string[] = [];
            for (let x = 0; x < maxCols; x++) {
                if (y < currentRows && x < currentCols) {
                    row.push(levelData.map[y][x]);
                } else {
                    row.push(fillTile);
                }
            }
            newMap.push(row);
        }
        finalLevels[levelKey] = { ...levelData, map: newMap };
    }

    return { 
        normalizedData: { ...baseNormalized, levels: finalLevels }, 
        needsNormalization: true 
    };
  }

  /**
   * Builds the collision grid for a specific level.
   */
  public static buildPathfindingGrid(levelKey: string, mapData: any): number[][] {
    const levelData = mapData.levels[levelKey];
    if (!levelData || !levelData.map) return [];

    const rows = levelData.map.length;
    const cols = levelData.map[0].length;
    const grid: number[][] = Array(rows).fill(0).map(() => Array(cols).fill(0));

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const symbol = levelData.map[y][x];
        const tileDef = mapData.tiles[symbol] || (mapData.entities ? mapData.entities[symbol] : null);

        // 1 = Blocked, 0 = Walkable
        if (symbol === "..." || (tileDef && (tileDef.block || tileDef.type === "wall"))) {
          grid[y][x] = 1;
        } else {
          grid[y][x] = 0;
        }
      }
    }

    return grid;
  }
}
