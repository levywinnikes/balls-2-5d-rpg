import type { StandardMaterial } from "@babylonjs/core";

export function setSpriteAnimPaused(
  mat: StandardMaterial | null | undefined,
  paused: boolean,
): void {
  const setter = (mat as { _setAnimPaused?: (value: boolean) => void } | null)
    ?._setAnimPaused;
  if (typeof setter === "function") {
    setter(paused);
  }
}

export function setSpriteAnimIntervalScale(
  mat: StandardMaterial | null | undefined,
  scale: number,
): void {
  const setter = (
    mat as { _setAnimIntervalScale?: (value: number) => void } | null
  )?._setAnimIntervalScale;
  if (typeof setter === "function") {
    setter(scale);
  }
}

/** full = 1.0, half = ~0.5 FPS, low = ~0.3 FPS */
export function resolveAnimLodIntervalScale(
  distanceUnits: number,
  nearRadius: number,
  midRadius: number,
): number {
  if (distanceUnits <= nearRadius) {
    return 1;
  }
  if (distanceUnits <= midRadius) {
    return 0.55;
  }
  return 0.3;
}
