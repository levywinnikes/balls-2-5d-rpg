export type SliceTileDefinition = {
  id?: string;
  color?: string;
  block?: boolean;
  height?: number;
  rampRise?: number;
  renderAs?: "floor" | "block";
  stairDir?: "up" | "down";
  transition?: "down" | "dwn" | "up" | string;
  waterProfile?: {
    mode?: "wading" | "swimming";
    surfaceLevel?: number;
    bodyCover?: number;
    speedMultiplier?: number;
    sinkOffset?: number;
  };
  geometryProfile?:
    | "box"
    | "stair"
    | "slab"
    | "water-hole"
    | "ramp-n"
    | "ramp-s"
    | "ramp-e"
    | "ramp-w";
};

export type MapEntity = {
  x: number;
  y: number;
  symbol: string;
  uuid?: string;
  contents?: Array<{ id: string; count: number }>;
  locked?: boolean;
  keyId?: string | null;
};

export type SliceLevelData = {
  binFile?: string;
  entities?: MapEntity[];
  playerPos?: { x: number; y: number };
};

export type SliceMapData = {
  width?: number;
  height?: number;
  tileSize?: number;
  config?: {
    debugSandbox?: boolean;
    startLevel?: string;
  };
  tileAtlas?: string[];
  tileDefinitions?: Record<string, SliceTileDefinition>;
  entityTemplates?: Record<string, any>;
  levels?: Record<string, SliceLevelData>;
};
