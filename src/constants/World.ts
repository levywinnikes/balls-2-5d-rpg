/** Height of one level (floor to floor base). */
export const LEVEL_HEIGHT = 2.0;

/** Thickness of floor slabs and walk surface offset from level base. */
export const FLOOR_THICKNESS = 0.32;

/** Shorthand alias for FLOOR_THICKNESS. */
export const WALK_SURFACE = FLOOR_THICKNESS;

/** Clearance added to surface Y for actor foot placement. */
export const FEET_CLEARANCE = 0.02;

/** Default wall/block height clamped to leave a gap between stacked levels. */
export const WALL_HEIGHT = LEVEL_HEIGHT - 0.001;
