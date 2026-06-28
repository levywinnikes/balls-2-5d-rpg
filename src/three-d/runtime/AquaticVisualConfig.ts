import type { AquaticMode, AquaticSample } from "./WaterProfile";

/**
 * Central tuning for 3D water look — adjust here without touching gameplay code.
 *
 * Libraries: this project already ships Babylon.js (@babylonjs/core). For this
 * top-down/oblique RPG style, procedural planes + gradient overlays are enough.
 * Optional upgrades later (not required now):
 *   - @babylonjs/materials → WaterMaterial (reflective ocean, heavy for mobile)
 *   - @babylonjs/post-processes → SSR (overkill for sprite billboards)
 */
export type AquaticVisualPreset = {
  overlayColor: string;
  overlayAlpha: number;
  surfaceColor: string;
  surfaceAlpha: number;
  volumeColor: string;
  volumeAlpha: number;
  volumeEmissive: number;
  waveSpeed: number;
  shadowScale: number;
};

export const AQUATIC_VISUAL_PRESETS: Record<
  Exclude<AquaticMode, "dry">,
  AquaticVisualPreset
> = {
  wading: {
    overlayColor: "#60a5fa",
    overlayAlpha: 0.42,
    surfaceColor: "#6ec8e8",
    surfaceAlpha: 0.4,
    volumeColor: "#3d8eb5",
    volumeAlpha: 0.14,
    volumeEmissive: 0.12,
    waveSpeed: 0.3,
    shadowScale: 0.85,
  },
  swimming: {
    overlayColor: "#2563eb",
    overlayAlpha: 0.62,
    surfaceColor: "#3a9fd4",
    surfaceAlpha: 0.48,
    volumeColor: "#1a5f8a",
    volumeAlpha: 0.18,
    volumeEmissive: 0.15,
    waveSpeed: 0.42,
    shadowScale: 0.55,
  },
};

export function getAquaticVisualPreset(
  mode: AquaticMode,
): AquaticVisualPreset | null {
  if (mode === "dry") {
    return null;
  }
  return AQUATIC_VISUAL_PRESETS[mode];
}

/** UV line from sprite bottom (0) to top (1) where water reaches on the billboard. */
export function computeBillboardWaterLineUv(sample: AquaticSample): number {
  if (sample.mode === "dry") {
    return 0;
  }
  return Math.max(0.08, Math.min(0.95, sample.bodyCover));
}

export function computeFallDamageMultiplier(sample: AquaticSample): number {
  if (sample.mode === "swimming") {
    return 0.08;
  }
  if (sample.mode === "wading") {
    return 0.45;
  }
  return 1;
}
