export enum TileType {
  GRASS = "grass",
  CONCRETE_WALL = "concrete-wall",
  WATER = "water",
}

export type TileConfig = {
  textureKey: string;
  color: number;
  size?: { width: number; height: number };
};
