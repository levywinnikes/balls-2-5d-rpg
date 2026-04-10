export interface LevelData {
  map: string[][];
  playerPos?: { x: number; y: number };
}

export interface MultiLevelMapData {
  mapName?: string; // Optional name
  tileSize: number;
  levels: { [level: string]: LevelData };
  tiles: Record<
    string,
    {
      id: string;
      block?: boolean;
      under?: string;
      color?: string;
      isFrontWall?: boolean;
      blockUnder?: boolean;
    }
  >;
  entities: Record<
    string,
    {
      type: string;
      id: string; // Made required as per usage, or optional? DynamicLevelRenderer checks .under, editor-ui checks id/type
      under?: string;
    }
  >;
}
