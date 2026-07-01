export type VfxAnimationDef = {
  frameCount: number;
  frameRate: number;
  loop: boolean;
};

export type VfxDef = {
  id: string;
  size: { width: number; height: number };
  /** Lowest opaque pixel row (0-indexed) for ground anchor. */
  feetY: number;
  direction: "south";
  animations: Record<string, VfxAnimationDef>;
};

export const VFX_DEFS: Record<string, VfxDef> = {
  respawn_glow: {
    id: "respawn_glow",
    size: { width: 48, height: 48 },
    feetY: 40,
    direction: "south",
    animations: {
      respawn_burst: { frameCount: 9, frameRate: 12, loop: false },
    },
  },
};

export function getVfxDef(vfxId: string): VfxDef {
  const def = VFX_DEFS[vfxId];
  if (!def) {
    throw new Error(`Unknown VFX '${vfxId}'.`);
  }
  return def;
}

export function vfxFramePath(
  vfxId: string,
  animation: string,
  direction: string,
  frameIndex: number,
): string {
  const frame = String(frameIndex).padStart(2, "0");
  return `/assets/sprites/generated/${vfxId}/${animation}_${direction}/frame_${frame}.png`;
}
