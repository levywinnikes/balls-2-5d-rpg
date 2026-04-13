import { TileRegistry } from "../graphics/tiles/TileRegistry";

export interface ProcessedMapData {
  spawnInfo: { x: number; y: number; level: string };
  pathfindingGrids: Record<string, number[][]>;
  normalizedMapData: any;
}

export class MapProcessingService {
  /**
   * Identifies the player starting position from metadata.
   */
  public static findSpawn(mapData: any): { x: number; y: number; level: string } {
    const fallback = { x: 32768, y: 32768, level: "1" }; // Standard continental center

    if (!mapData) return fallback;

    // 1. Check for global config start level (v5.5 strategy)
    const configLevel = mapData.config?.startLevel || "1";
    
    // 2. Priority: metadata playerPos if provided by generator
    if (mapData.levels && mapData.levels[configLevel] && mapData.levels[configLevel].playerPos) {
      return {
        x: mapData.levels[configLevel].playerPos.x,
        y: mapData.levels[configLevel].playerPos.y,
        level: configLevel,
      };
    }

    // 3. Last fallback: Center of the map
    const tileSize = mapData.tileSize || 32;
    const centerX = (mapData.width * tileSize) / 2;
    const centerY = (mapData.height * tileSize) / 2;

    return { x: centerX, y: centerY, level: configLevel };
  }

  /**
   * Normalization is now handled by the BMS generator.
   */
  public static normalizeMap(data: any): { normalizedData: any, needsNormalization: boolean } {
    return { normalizedData: data, needsNormalization: false };
  }

  /**
   * Legacy pathfinding grid builder. 
   * NOTE: For BMS (1024x1024), we recommend dynamic calculation or worker-based grids.
   */
  public static buildPathfindingGrid(levelKey: string, mapData: any): number[][] {
    console.warn("[MapProcessingService] buildPathfindingGrid is deprecated for BMS. Grids should be calculated dynamically via mapLoader.");
    return [];
  }
}
