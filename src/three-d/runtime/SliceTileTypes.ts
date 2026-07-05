export type SliceTileDefinition = {
  id?: string;
  color?: string;
  block?: boolean;
  height?: number;
  rampRise?: number;
  renderAs?: "floor" | "block";
  stairDir?: "up" | "down";
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
