export type SliceQualityPreset = "low" | "mid" | "high";

export interface SliceQualityStreamConfig {
  topDownDrawRadiusChunks: number;
  firstPersonDrawRadiusChunks: number;
  topDownChunkBuildBudgetPerTick: number;
  firstPersonChunkBuildBudgetPerTick: number;
  /** Added to draw radius (in chunks) for enemy mesh streaming. */
  enemyStreamExtraChunks: number;
  /** Added to draw radius (in chunks) for prop mesh streaming. */
  propStreamExtraChunks: number;
  /** Added to draw radius (in chunks) for dropped-item streaming. */
  droppedItemStreamExtraChunks: number;
}

const QUALITY_STREAM_CONFIG: Record<SliceQualityPreset, SliceQualityStreamConfig> =
  {
    low: {
      topDownDrawRadiusChunks: 2,
      firstPersonDrawRadiusChunks: 3,
      topDownChunkBuildBudgetPerTick: 1,
      firstPersonChunkBuildBudgetPerTick: 2,
      enemyStreamExtraChunks: 0.5,
      propStreamExtraChunks: 0.5,
      droppedItemStreamExtraChunks: 1,
    },
    mid: {
      topDownDrawRadiusChunks: 3,
      firstPersonDrawRadiusChunks: 4,
      topDownChunkBuildBudgetPerTick: 2,
      firstPersonChunkBuildBudgetPerTick: 3,
      enemyStreamExtraChunks: 1,
      propStreamExtraChunks: 0.75,
      droppedItemStreamExtraChunks: 2,
    },
    high: {
      topDownDrawRadiusChunks: 3,
      firstPersonDrawRadiusChunks: 4,
      topDownChunkBuildBudgetPerTick: 2,
      firstPersonChunkBuildBudgetPerTick: 3,
      enemyStreamExtraChunks: 1,
      propStreamExtraChunks: 0.75,
      droppedItemStreamExtraChunks: 2,
    },
  };

export function resolveQualityStreamConfig(
  preset: SliceQualityPreset | string | undefined,
): SliceQualityStreamConfig {
  if (preset === "low" || preset === "mid" || preset === "high") {
    return QUALITY_STREAM_CONFIG[preset];
  }
  return QUALITY_STREAM_CONFIG.high;
}

export function computeStreamRadiiUnits(
  chunkSize: number,
  config: SliceQualityStreamConfig,
): {
  propStreamRadiusUnits: number;
  propStreamRadiusUnitsFirstPerson: number;
  propDespawnRadiusUnits: number;
  enemyStreamRadiusUnits: number;
  enemyDespawnRadiusUnits: number;
  droppedItemStreamRadiusUnits: number;
} {
  const propStreamRadiusUnits =
    chunkSize * (config.topDownDrawRadiusChunks + config.propStreamExtraChunks);
  const propStreamRadiusUnitsFirstPerson =
    chunkSize * (config.firstPersonDrawRadiusChunks + config.propStreamExtraChunks);
  const enemyStreamRadiusUnits =
    chunkSize * (config.topDownDrawRadiusChunks + config.enemyStreamExtraChunks);
  const droppedItemStreamRadiusUnits =
    chunkSize *
    (config.topDownDrawRadiusChunks + config.droppedItemStreamExtraChunks);

  return {
    propStreamRadiusUnits,
    propStreamRadiusUnitsFirstPerson,
    propDespawnRadiusUnits: propStreamRadiusUnits + 10,
    enemyStreamRadiusUnits,
    enemyDespawnRadiusUnits: enemyStreamRadiusUnits + 12,
    droppedItemStreamRadiusUnits,
  };
}
