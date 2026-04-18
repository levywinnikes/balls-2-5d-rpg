export interface ProjectionSettings {
  levelScaleStep: number;
  floorHeightPx: number;
  depthStride: number;
  minScale: number;
  subPixelStep: number;
}

export interface ContainerProjection {
  levelDiff: number;
  scale: number;
  x: number;
  y: number;
  depth: number;
}

export const DEFAULT_PROJECTION_SETTINGS: ProjectionSettings = {
  // Slightly taller floor height makes wall faces more visible per level.
  // Smaller scale step keeps distant floors readable without vanishing.
  levelScaleStep: 0.025,
  floorHeightPx: 40,
  depthStride: 100000,
  minScale: 0.62,
  subPixelStep: 0.25,
};

function snapToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

export function getLevelDiff(
  targetLevel: number,
  currentLevel: number,
): number {
  return targetLevel - currentLevel;
}

export function getDepthOffset(
  targetLevel: number,
  currentLevel: number,
  settings: ProjectionSettings = DEFAULT_PROJECTION_SETTINGS,
): number {
  return getLevelDiff(targetLevel, currentLevel) * settings.depthStride;
}

export function getContainerProjection(
  playerX: number,
  playerY: number,
  targetLevel: number,
  currentLevel: number,
  perspectiveFactor: number,
  settings: ProjectionSettings = DEFAULT_PROJECTION_SETTINGS,
): ContainerProjection {
  const levelDiff = getLevelDiff(targetLevel, currentLevel);
  const rawScale = 1 + levelDiff * settings.levelScaleStep * perspectiveFactor;
  const scale = Math.max(settings.minScale, rawScale);
  const yShift = levelDiff * -settings.floorHeightPx * perspectiveFactor;
  const x = playerX * (1 - scale);
  const y = playerY * (1 - scale) + yShift;

  return {
    levelDiff,
    scale,
    x: snapToStep(x, settings.subPixelStep),
    y: snapToStep(y, settings.subPixelStep),
    depth: levelDiff * settings.depthStride,
  };
}
