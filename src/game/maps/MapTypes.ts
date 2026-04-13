/**
 * BINARY MAP SYSTEM TYPES
 * Interface definitions for the BMS metadata and level structures.
 * DOCUMENTATION: See /docs/SYSTEM_BMS.md
 */
export interface LevelData {
  binFile: string;
  entities: any[];
  playerPos?: { x: number; y: number };
}

export interface MultiLevelMapData {
  mapName?: string;
  tileSize: number;
  width: number;
  height: number;
  tileAtlas: string[];
  levels: { [level: string]: LevelData };
  config?: {
    startLevel?: string;
    [key: string]: any;
  };
  tileDefinitions: Record<
    string,
    {
      id: string;
      type?: string; 
      block?: boolean;
      isCollidable?: boolean;
      under?: string;
      color?: string;
      isFrontWall?: boolean;
      blockUnder?: boolean;
      category?: string;
    }
  >;
  entityTemplates: Record<
    string,
    {
      type: string;
      id?: string;
      block?: boolean;
      under?: string;
      respawn?: number;
      uuid?: string;
      contents?: { id: string; count: number }[];
      category?: string;
    }
  >;
}
