import spriteDirectionMeta from "./sprite-direction-meta.json";

type DirectionMetaEntry = {
  swapEastWestAssets?: boolean;
};

type DirectionMetaFile = {
  version: number;
  entities: Record<string, DirectionMetaEntry>;
};

const metaFile = spriteDirectionMeta as DirectionMetaFile;

/** Runtime E/W folder swap — driven by audit output, not hardcoded entity ids. */
export function shouldSwapGeneratedEastWestAssets(entityId: string): boolean {
  return metaFile.entities[entityId]?.swapEastWestAssets === true;
}
