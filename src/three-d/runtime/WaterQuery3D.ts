import {
  AquaticSample,
  DRY_AQUATIC_SAMPLE,
  sampleAquaticFromTile,
  TileWaterSource,
} from "./WaterProfile";

export type MapTileLookup = (
  level: string,
  tileX: number,
  tileY: number,
) => string | null;

export type TileDefinitionLookup = (
  symbol: string | null,
) => TileWaterSource | null | undefined;

export function sampleAquaticAtGrid(
  level: string,
  tileX: number,
  tileY: number,
  getTile: MapTileLookup,
  getTileDef: TileDefinitionLookup,
): AquaticSample {
  const symbol = getTile(level, tileX, tileY);
  const tileDef = getTileDef(symbol);
  const tileId = tileDef?.id ?? symbol;
  return sampleAquaticFromTile(tileId, tileDef ?? undefined);
}

export function sampleAquaticAtWorld(
  worldX: number,
  worldZ: number,
  level: string,
  getTile: MapTileLookup,
  getTileDef: TileDefinitionLookup,
): AquaticSample {
  const tileX = Math.floor(worldX);
  const tileZ = Math.floor(worldZ);
  return sampleAquaticAtGrid(level, tileX, tileZ, getTile, getTileDef);
}

export function mergeAquaticSamples(samples: AquaticSample[]): AquaticSample {
  if (samples.length === 0) {
    return DRY_AQUATIC_SAMPLE;
  }

  let best = DRY_AQUATIC_SAMPLE;
  let bestRank = 0;
  for (const sample of samples) {
    const rank =
      sample.mode === "swimming" ? 2 : sample.mode === "wading" ? 1 : 0;
    if (rank > bestRank) {
      best = sample;
      bestRank = rank;
    }
  }
  return best;
}

/** Sample center + corners so wide actors partially in water get the deepest state. */
export function sampleAquaticAtWorldFootprint(
  worldX: number,
  worldZ: number,
  level: string,
  getTile: MapTileLookup,
  getTileDef: TileDefinitionLookup,
  radius = 0.28,
): AquaticSample {
  const points: Array<[number, number]> = [
    [worldX, worldZ],
    [worldX - radius, worldZ],
    [worldX + radius, worldZ],
    [worldX, worldZ - radius],
    [worldX, worldZ + radius],
  ];

  const samples = points.map(([x, z]) =>
    sampleAquaticAtWorld(x, z, level, getTile, getTileDef),
  );
  return mergeAquaticSamples(samples);
}

export function aquaticGroundY(
  levelWorldY: number,
  groundOffset: number,
  sample: AquaticSample,
): number {
  return levelWorldY + groundOffset + sample.sinkOffset;
}
