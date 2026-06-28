export type AquaticMode = "dry" | "wading" | "swimming";

export type WaterProfile = {
  mode: Exclude<AquaticMode, "dry">;
  /** 0–1 from tile floor to top — used by future surface shader (P1). */
  surfaceLevel: number;
  /** 0–1 of billboard height covered below water line (P1). */
  bodyCover: number;
  speedMultiplier: number;
  /** World-units Y offset from standard ground feet (negative = sink). */
  sinkOffset: number;
};

export type AquaticSample = {
  mode: AquaticMode;
  speedMultiplier: number;
  sinkOffset: number;
  surfaceLevel: number;
  bodyCover: number;
};

export type TileWaterSource = {
  id?: string;
  waterProfile?: Partial<WaterProfile> & { mode?: AquaticMode };
};

export const DRY_AQUATIC_SAMPLE: AquaticSample = {
  mode: "dry",
  speedMultiplier: 1,
  sinkOffset: 0,
  surfaceLevel: 0,
  bodyCover: 0,
};

const WADING_PROFILE: WaterProfile = {
  mode: "wading",
  surfaceLevel: 0.3,
  bodyCover: 0.4,
  speedMultiplier: 0.65,
  sinkOffset: -0.05,
};

const SWIMMING_PROFILE: WaterProfile = {
  mode: "swimming",
  surfaceLevel: 0.58,
  bodyCover: 0.82,
  speedMultiplier: 0.45,
  sinkOffset: -0.26,
};

const PROFILE_BY_TILE_ID: Record<string, WaterProfile> = {
  "water-shallow": WADING_PROFILE,
  water: SWIMMING_PROFILE,
  "toxic-water": {
    ...SWIMMING_PROFILE,
    speedMultiplier: 0.35,
  },
};

export function isWaterTileId(tileId: string | null | undefined): boolean {
  if (!tileId) return false;
  const id = tileId.toLowerCase();
  return (
    id === "water" ||
    id === "water-shallow" ||
    id === "toxic-water" ||
    id.includes("water-shallow") ||
    (id.includes("water") &&
      !id.includes("waterfall") &&
      !id.includes("watermelon"))
  );
}

export function resolveWaterProfile(
  tileId: string | null | undefined,
  tileDef?: TileWaterSource | null,
): WaterProfile | null {
  const resolvedId = (tileDef?.id || tileId || "").toLowerCase();
  if (!isWaterTileId(resolvedId)) {
    return null;
  }

  const base =
    PROFILE_BY_TILE_ID[resolvedId] ??
    (resolvedId.includes("shallow") ? WADING_PROFILE : SWIMMING_PROFILE);

  const override = tileDef?.waterProfile;
  if (!override) {
    return base;
  }

  return {
    ...base,
    ...override,
    mode:
      override.mode === "wading" || override.mode === "swimming"
        ? override.mode
        : base.mode,
  };
}

export function sampleAquaticFromTile(
  tileId: string | null | undefined,
  tileDef?: TileWaterSource | null,
): AquaticSample {
  const profile = resolveWaterProfile(tileId, tileDef);
  if (!profile) {
    return DRY_AQUATIC_SAMPLE;
  }

  return {
    mode: profile.mode,
    speedMultiplier: profile.speedMultiplier,
    sinkOffset: profile.sinkOffset,
    surfaceLevel: profile.surfaceLevel,
    bodyCover: profile.bodyCover,
  };
}
