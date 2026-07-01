export type ProjectileAnimationDef = {
  frameCount: number;
  frameRate: number;
};

export type ProjectileSpriteDef = {
  id: string;
  size: { width: number; height: number };
  direction: string;
  animations: Record<string, ProjectileAnimationDef>;
  defaultAnimation: string;
  idleAnimation: string;
};

export const ARROW_PROJECTILE_DEF: ProjectileSpriteDef = {
  id: "arrow",
  size: { width: 32, height: 32 },
  direction: "east",
  animations: {
    feather_sway_gentle: { frameCount: 5, frameRate: 10 },
    feather_sway: { frameCount: 5, frameRate: 12 },
    fly_loop: { frameCount: 5, frameRate: 14 },
  },
  defaultAnimation: "fly_loop",
  idleAnimation: "feather_sway_gentle",
};

/**
 * In `*_east` frame_00, the tip points toward the bottom-left of the canvas.
 * Phaser flight angle: 0 = east (+X), increasing clockwise (Y/Z down-south).
 */
export const ARROW_EAST_FRAME_HEADING_PHASER = (3 * Math.PI) / 4;

/** Horizontal flight angle — same convention as Phaser Angle.Between (Z ≈ Y). */
export function projectileFlightAngleRad(dx: number, dz: number): number {
  return Math.atan2(dz, dx);
}

/** Y rotation so a Y-billboard arrow tip tracks horizontal velocity (Babylon Y is CCW). */
export function arrowFlightYawRad(dx: number, dz: number): number {
  const flightAngle = projectileFlightAngleRad(dx, dz);
  return -flightAngle + ARROW_EAST_FRAME_HEADING_PHASER;
}

export function projectileFramePath(
  projectileId: string,
  animation: string,
  direction: string,
  frameIndex: number,
): string {
  const frame = String(frameIndex).padStart(2, "0");
  return `/assets/sprites/generated/${projectileId}/${animation}_${direction}/frame_${frame}.png`;
}

export function projectileTextureKey(
  projectileId: string,
  animation: string,
  frameIndex: number,
): string {
  return `proj-${projectileId}-${animation}-${frameIndex}`;
}

export function projectileAnimKey(
  projectileId: string,
  animation: string,
): string {
  return `proj-${projectileId}-${animation}`;
}

export function pickArrowFlightAnimation(speed: number): string {
  if (speed >= 18) {
    return "fly_loop";
  }
  if (speed >= 14) {
    return "feather_sway";
  }
  return "feather_sway_gentle";
}

/** 3D billboards: avoid fly_loop motion-blur frames — they read as a red streak. */
export function pickArrowFlightAnimation3D(_speed: number): string {
  return "feather_sway_gentle";
}
