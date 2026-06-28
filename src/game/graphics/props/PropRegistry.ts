export type PropAnimationDef = {
  frameCount: number;
  frameRate: number;
};

export type PropDef = {
  id: string;
  size: { width: number; height: number };
  origin: { x: number; y: number };
  /** Lowest opaque pixel row (0-indexed) for 3D billboard feet anchor. */
  feetY?: number;
  direction: "south";
  animations: Record<string, PropAnimationDef>;
  defaultAnimation: string;
  strongAnimation?: string;
  strongWindChance: number;
  isCollidable: boolean;
  blocksRanged: boolean;
  baseDepth: number;
  bodySize?: { width: number; height: number };
  bodyOffset?: { x: number; y: number };
};

export const PROP_DEFS: Record<string, PropDef> = {
  oak_tree: {
    id: "oak_tree",
    size: { width: 64, height: 96 },
    origin: { x: 0.5, y: 1 },
    direction: "south",
    animations: {
      sway_gentle: { frameCount: 5, frameRate: 6 },
      sway_strong: { frameCount: 5, frameRate: 8 },
    },
    defaultAnimation: "sway_gentle",
    strongAnimation: "sway_strong",
    strongWindChance: 0.25,
    isCollidable: true,
    blocksRanged: true,
    baseDepth: 2,
    bodySize: { width: 32, height: 32 },
    bodyOffset: { x: 0, y: -16 },
    feetY: 92,
  },
  wild_flower: {
    id: "wild_flower",
    size: { width: 32, height: 32 },
    origin: { x: 0.5, y: 0.85 },
    direction: "south",
    animations: {
      sway_gentle: { frameCount: 5, frameRate: 8 },
      sway_strong: { frameCount: 5, frameRate: 10 },
    },
    defaultAnimation: "sway_gentle",
    strongAnimation: "sway_strong",
    strongWindChance: 0.3,
    isCollidable: false,
    blocksRanged: false,
    baseDepth: 1,
    feetY: 27,
  },
};

export function getPropDef(propId: string): PropDef {
  const def = PROP_DEFS[propId];
  if (!def) {
    throw new Error(`Unknown animated prop '${propId}'.`);
  }
  return def;
}

export function propFramePath(
  propId: string,
  animation: string,
  direction: string,
  frameIndex: number,
): string {
  const frame = String(frameIndex).padStart(2, "0");
  return `/assets/sprites/generated/${propId}/${animation}_${direction}/frame_${frame}.png`;
}

export function propTextureKey(
  propId: string,
  animation: string,
  frameIndex: number,
): string {
  return `prop-${propId}-${animation}-${frameIndex}`;
}

export function propAnimKey(propId: string, animation: string): string {
  return `prop-${propId}-${animation}`;
}

export function pickPropAnimation(
  propId: string,
  worldX: number,
  worldY: number,
): string {
  const def = getPropDef(propId);
  if (!def.strongAnimation || def.strongWindChance <= 0) {
    return def.defaultAnimation;
  }

  const hash =
    Math.abs(Math.floor(worldX) * 73856093 ^ Math.floor(worldY) * 19349663) %
    100;
  if (hash < def.strongWindChance * 100) {
    return def.strongAnimation;
  }
  return def.defaultAnimation;
}
