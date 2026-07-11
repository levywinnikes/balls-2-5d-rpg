import type { SliceTileDefinition } from "./SliceTileTypes";
import { isWaterTileId } from "./WaterProfile";
import { isWaterHoleTile } from "./WaterHoleConfig";
import { resolveRampRise, isFloorLevelRamp } from "./TileWorldY";
import { LEVEL_HEIGHT, WALK_SURFACE, FEET_CLEARANCE } from "../../constants/World";

// ---------------------------------------------------------------------------
// Guard helpers
// ---------------------------------------------------------------------------

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function guardFinite(...values: number[]): boolean {
  for (const v of values) {
    if (!isFiniteNumber(v)) return true;
  }
  return false;
}

function guardLevelKeys(keys: string[]): boolean {
  return !Array.isArray(keys) || keys.length === 0;
}

// ---------------------------------------------------------------------------
// Volume types
// ---------------------------------------------------------------------------

export interface AABBVolume {
  kind: "aabb";
  x1: number;
  y1: number;
  z1: number;
  x2: number;
  y2: number;
  z2: number;
  /** Walkable top surface Y (same as y2 for boxes, y1+thickness for slabs). */
  surfaceY: number;
  level: string;
  isWalkable: boolean;
}

export interface WedgeVolume {
  kind: "wedge";
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  /** Low Y at the shallow end (the thin edge). */
  baseY: number;
  /** High Y at the tall end (the thick edge). */
  highY: number;
  /** Direction of the rise: the surface goes from low (unit=0) to high (unit=1) along this axis. */
  direction: "n" | "s" | "e" | "w";
  level: string;
  isWalkable: boolean;
  /** Ramp rise (highY - baseY). */
  rise: number;
}

export type CollisionVolume = AABBVolume | WedgeVolume;

// ---------------------------------------------------------------------------
// Surface samples from volumes
// ---------------------------------------------------------------------------

/** Surface Y of a volume at world (x, z). */
function volumeSurfaceY(v: CollisionVolume, x: number, z: number): number {
  if (v.kind === "aabb") return v.surfaceY;
  // Wedge: linear gradient
  const lx = x - v.x1;
  const lz = z - v.z1;
  let t: number;
  if (v.direction === "n") t = Math.max(0, Math.min(1, lz));
  else if (v.direction === "s") t = Math.max(0, Math.min(1, 1 - lz));
  else if (v.direction === "e") t = Math.max(0, Math.min(1, 1 - lx));
  else t = Math.max(0, Math.min(1, lx));
  return v.baseY + v.rise * t;
}

/** Y-range of solid volume at world (x, z). Returns null if outside the volume footprint. */
function volumeSolidYRange(
  v: CollisionVolume,
  x: number,
  z: number,
): [number, number] | null {
  if (v.kind === "aabb") {
    if (x < v.x1 || x >= v.x2 || z < v.z1 || z >= v.z2) return null;
    return [v.y1, v.y2];
  }
  // Wedge
  if (x < v.x1 || x >= v.x2 || z < v.z1 || z >= v.z2) return null;
  const sy = volumeSurfaceY(v, x, z);
  return [Math.min(v.baseY, sy), sy];
}

/** Check if a vertical line segment [yLow, yHigh] at (x, z) overlaps a volume. */
function volumeOverlapsSegment(
  v: CollisionVolume,
  x: number,
  z: number,
  yLow: number,
  yHigh: number,
): boolean {
  const yr = volumeSolidYRange(v, x, z);
  if (!yr) return false;
  return yLow < yr[1] && yHigh > yr[0];
}

// ---------------------------------------------------------------------------
// Volume builder
// ---------------------------------------------------------------------------

export type CWGetTile = (level: string, tx: number, tz: number) => string | null;
export type CWGetTileDef = (s: string | null) => SliceTileDefinition | null | undefined;
export type CWLevelY = (level: string) => number;
export type CWParseLevel = (l: string) => number;

export type CollisionWorldOptions = {
  levelHeight?: number;
  floorSurfaceY?: number;
  feetClearance?: number;
};

/**
 * Pre-built collision volumes for all tiles in the loaded map.
 * No tile-definition lookups at query time — pure geometry collision.
 */
export class CollisionWorld {
  public volumes: CollisionVolume[] = [];
  private levelHeight: number;
  private floorSurfaceY: number;
  private feetClearance: number;
  private levelToWorldY: CWLevelY;
  private getTile: CWGetTile;
  private getTileDef: CWGetTileDef;
  private parseLevelNum: CWParseLevel;

  constructor(
    levelToWorldY: CWLevelY,
    getTile: CWGetTile,
    getTileDef: CWGetTileDef,
    parseLevelNum: CWParseLevel,
    opts?: CollisionWorldOptions,
  ) {
    this.levelToWorldY = levelToWorldY;
    this.getTile = getTile;
    this.getTileDef = getTileDef;
    this.parseLevelNum = parseLevelNum;
    this.levelHeight = opts?.levelHeight ?? LEVEL_HEIGHT;
    this.floorSurfaceY = opts?.floorSurfaceY ?? WALK_SURFACE;
    this.feetClearance = opts?.feetClearance ?? FEET_CLEARANCE;
  }

  /** Rebuild all volumes from the given level keys. Call whenever map data changes. */
  rebuild(levelKeys: string[], mapWidth: number, mapHeight: number): void {
    if (guardLevelKeys(levelKeys) || guardFinite(mapWidth, mapHeight) || mapWidth <= 0 || mapHeight <= 0) {
      this.volumes = [];
      return;
    }
    this.volumes = [];
    for (const level of levelKeys) {
      const baseY = this.levelToWorldY(level);
      for (let tz = 0; tz < mapHeight; tz++) {
        for (let tx = 0; tx < mapWidth; tx++) {
          this.buildTileVolume(level, baseY, tx, tz);
        }
      }
    }
  }

  /**
   * Build volumes for a specific chunk region. Used during chunk streaming.
   * tileX/tileZ are chunk-aligned tile coordinates.
   */
  buildChunk(level: string, chunkTileX: number, chunkTileZ: number, chunkSize: number): void {
    if (!level || guardFinite(chunkTileX, chunkTileZ, chunkSize) || chunkSize <= 0) return;
    const baseY = this.levelToWorldY(level);
    if (!isFiniteNumber(baseY)) return;
    for (let dz = 0; dz < chunkSize; dz++) {
      for (let dx = 0; dx < chunkSize; dx++) {
        const tx = chunkTileX + dx;
        const tz = chunkTileZ + dz;
        this.buildTileVolume(level, baseY, tx, tz);
      }
    }
  }

  /** Build and add collision volume(s) for a single tile. */
  private buildTileVolume(level: string, baseY: number, tx: number, tz: number): void {
    if (!level || guardFinite(baseY, tx, tz) || tx < 0 || tz < 0) return;
    const symbol = this.getTile(level, tx, tz);
    if (!symbol || symbol === "...") {
      // Void: no volume. A floor-level ramp on the level below will
      // naturally fill this space because its wedge extends into this level's Y range.
      return;
    }
    const def = this.getTileDef(symbol);
    if (!def) {
      // Tiles without a definition entry still exist in the map — treat as a basic
      // walkable floor (consistent with isGradedWalkTile defaults).
      this.buildFloorVolume(level, baseY, tx, tz, def);
      return;
    }

    const isHole = def.id === "hole" || def.transition === "down" || def.transition === "dwn";
    if (isHole) {
      return;
    }

    // Water holes and water tiles
    if (isWaterTileId(def.id) || isWaterHoleTile(symbol, def)) {
      this.buildWaterVolume(level, baseY, tx, tz, def, symbol);
      return;
    }

    const profile = def.geometryProfile;

    if (profile === "stair" || def.stairDir) {
      this.buildStairVolume(level, baseY, tx, tz, def);
      return;
    }

    if (profile?.startsWith("ramp-")) {
      this.buildRampVolume(level, baseY, tx, tz, def, profile);
      return;
    }

    if (profile === "slab" || profile === undefined || def.renderAs === "floor") {
      this.buildFloorVolume(level, baseY, tx, tz, def);
      return;
    }

    if (profile === "box" || def.renderAs === "block" || def.block) {
      this.buildBoxVolume(level, baseY, tx, tz, def);
      return;
    }

    // Fallback: generic floor
    this.buildFloorVolume(level, baseY, tx, tz, def);
  }

  private buildFloorVolume(level: string, baseY: number, tx: number, tz: number, def?: SliceTileDefinition | null): void {
    const h = Math.max(0.03, def?.height ?? this.floorSurfaceY);
    const thickness = Math.max(h, this.floorSurfaceY);
    this.volumes.push({
      kind: "aabb",
      x1: tx, y1: baseY, z1: tz,
      x2: tx + 1, y2: baseY + thickness, z2: tz + 1,
      surfaceY: baseY + thickness,
      level,
      isWalkable: true,
    });
  }

  private buildBoxVolume(level: string, baseY: number, tx: number, tz: number, def?: SliceTileDefinition | null): void {
    const y1 = baseY + this.floorSurfaceY;
    const rawTop = baseY + (def?.height ?? this.levelHeight);
    const y2 = Math.min(rawTop, baseY + this.levelHeight);
    this.volumes.push({
      kind: "aabb",
      x1: tx, y1, z1: tz,
      x2: tx + 1, y2, z2: tz + 1,
      surfaceY: y2,
      level,
      isWalkable: false,
    });
    // True 3D: add walkable floor on top of wall so player can stand on it
    this.volumes.push({
      kind: "aabb",
      x1: tx, y1: y2, z1: tz,
      x2: tx + 1, y2: y2 + this.floorSurfaceY, z2: tz + 1,
      surfaceY: y2 + this.floorSurfaceY,
      level,
      isWalkable: true,
    });
  }

  private buildRampVolume(level: string, baseY: number, tx: number, tz: number, def: SliceTileDefinition, profile: string): void {
    const rise = resolveRampRise(def);
    const isFloorRamp = isFloorLevelRamp(def, this.levelHeight);
    const surfaceBaseY = isFloorRamp ? baseY + this.floorSurfaceY : baseY;
    const actualRise = isFloorRamp ? rise - this.floorSurfaceY : rise;
    const dir = profile.split("-")[1] as "n" | "s" | "e" | "w";

    // The wedge volume occupies [surfaceBaseY, surfaceBaseY + actualRise] at the high end,
    // and [surfaceBaseY, surfaceBaseY] (just a line) at the low end.
    // For floor-level ramps, the volume starts at surfaceBaseY = baseY + WALK_SURFACE.
    // For local ramps, it starts at baseY = level base.
    const lowY = surfaceBaseY;
    const highY = surfaceBaseY + actualRise;

    this.volumes.push({
      kind: "wedge",
      x1: tx, z1: tz,
      x2: tx + 1, z2: tz + 1,
      baseY: lowY,
      highY,
      direction: dir,
      rise: actualRise,
      level,
      isWalkable: true,
    });

    // Solid fill below the wedge from level base to wedge bottom.
    // For floor-level ramps this fills [baseY, surfaceBaseY] so the thin edge
    // (where the wedge converges to zero thickness) still has collision mass.
    if (surfaceBaseY > baseY) {
      this.volumes.push({
        kind: "aabb",
        x1: tx, y1: baseY, z1: tz,
        x2: tx + 1, y2: surfaceBaseY, z2: tz + 1,
        surfaceY: surfaceBaseY,
        level,
        isWalkable: false,
      });
    }
  }

  private buildStairVolume(level: string, baseY: number, tx: number, tz: number, def: SliceTileDefinition): void {
    const stairDir = def.stairDir === "down" ? "down" : "up";
    const stepCount = 8;
    const stepRise = this.levelHeight / stepCount;
    // Stairs step from north (low) to south (high).
    // If stairDir === "up", physical bottom is baseY (south low, north high).
    // If stairDir === "down", physical bottom is baseY - this.levelHeight (north low, south high).
    const offset = stairDir === "down" ? -this.levelHeight : 0;
    const stepDepth = 1.0 / stepCount;

    for (let i = 0; i < stepCount; i++) {
      const zIndex = stairDir === "up" ? (stepCount - 1 - i) : i;
      const stepLowZ = tz + zIndex * stepDepth;
      const stepHighZ = tz + (zIndex + 1) * stepDepth;
      const stepBaseY = baseY + offset + WALK_SURFACE + i * stepRise;
      const stepTopY = stepBaseY + stepRise;

      this.volumes.push({
        kind: "aabb",
        x1: tx, y1: stepBaseY, z1: stepLowZ,
        x2: tx + 1, y2: stepTopY, z2: stepHighZ,
        surfaceY: stepTopY,
        level,
        isWalkable: true,
      });
    }

    // Fill the space below the stairs with solid volume
    const stairBottom = baseY + offset + WALK_SURFACE;
    this.volumes.push({
      kind: "aabb",
      x1: tx, y1: baseY + (offset < 0 ? this.levelHeight + offset : 0), z1: tz,
      x2: tx + 1, y2: stairBottom, z2: tz + 1,
      surfaceY: stairBottom,
      level,
      isWalkable: false,
    });
  }

  private buildWaterVolume(level: string, baseY: number, tx: number, tz: number, def: SliceTileDefinition, symbol: string): void {
    const rimY = baseY + this.floorSurfaceY;
    this.volumes.push({
      kind: "aabb",
      x1: tx, y1: rimY, z1: tz,
      x2: tx + 1, y2: rimY + 0.01, z2: tz + 1, // thin walkable surface
      surfaceY: rimY,
      level,
      isWalkable: true,
    });
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /**
   * Query floor and ceiling contacts for a capsule at (x, y, z) with given bodyHeight.
   */
  query(
    x: number, z: number,
    footY: number, headY: number,
    levelKeys: string[],
    currentLevel?: string,
    maxFootY?: number,
  ): { floor: { surfaceY: number; footY: number; level: string; isGraded: boolean } | null;
        ceiling: { bottomY: number; level: string; isGraded: boolean } | null } {
    if (guardFinite(x, z, footY, headY) || guardLevelKeys(levelKeys)) {
      return { floor: null, ceiling: null };
    }
    let bestFloor: { surfaceY: number; footY: number; level: string; isGraded: boolean } | null = null;
    let bestCeiling: { bottomY: number; level: string; isGraded: boolean } | null = null;

    // Filter volumes by level
    const levelSet = new Set(levelKeys);

    // Quick pass to check if the player's center overlaps any wedge (ramp) on the current level.
    let onRamp = false;
    for (const v of this.volumes) {
      if (!levelSet.has(v.level)) continue;
      if (v.kind === "wedge" && x >= v.x1 && x < v.x2 && z >= v.z1 && z < v.z2) {
        onRamp = true;
        break;
      }
    }

    for (const v of this.volumes) {
      if (!levelSet.has(v.level)) continue;

      // Broad-phase AABB cull
      if (v.kind === "aabb") {
        if (x < v.x1 || x >= v.x2 || z < v.z1 || z >= v.z2) continue;
        if (v.y2 < footY - 0.5) continue;
        if (v.y1 > headY + 0.5) continue;
      } else {
        // Wedge: check footprint + Y range
        if (x < v.x1 || x >= v.x2 || z < v.z1 || z >= v.z2) continue;
        if (v.highY < footY - 0.5) continue;
        if (v.baseY > headY + 0.5) continue;
      }

      // --- Floor ---
      if (v.isWalkable) {
        const sy = volumeSurfaceY(v, x, z);
        const fY = sy + this.feetClearance;
        if (fY <= headY + 0.01) {
          if (maxFootY !== undefined && fY > maxFootY) {
            continue;
          }
          const isGraded = v.kind === "wedge";
          if (!bestFloor || fY > bestFloor.footY) {
            bestFloor = { surfaceY: sy, footY: fY, level: v.level, isGraded };
          }
        }
      }

      // --- Ceiling ---
      // Walkable volumes (floors/ramps) on or below the player's currentLevel cannot be ceilings.
      if (v.isWalkable && currentLevel !== undefined) {
        const playerLvlNum = this.parseLevelNum(currentLevel);
        const vLvlNum = this.parseLevelNum(v.level);
        if (vLvlNum <= playerLvlNum) {
          continue;
        }
        // If the player is standing on a ramp, the floor slabs of the level immediately
        // above (which they are transitioning to) should not act as ceilings.
        if (onRamp && vLvlNum === playerLvlNum + 1) {
          continue;
        }
      }

      // A volume creates a ceiling when the player's body is below the volume's bottom.
      // Only consider ceilings within 0.04 units of the player's head.
      // The bottom of the ceiling must be at least 0.45 units above the player's feet.
      const cY = v.kind === "aabb" ? v.y1 : Math.min(v.baseY, v.highY);
      if (cY > footY + 0.45 && headY > cY - 0.04) {
        const isGraded = v.kind === "wedge";
        if (!bestCeiling || cY < bestCeiling.bottomY) {
          bestCeiling = { bottomY: cY, level: v.level, isGraded };
        }
      }
    }

    return { floor: bestFloor, ceiling: bestCeiling };
  }

  queryFloor(
    x: number, z: number,
    footY: number, headY: number,
    levelKeys: string[],
    maxFootY?: number,
  ): { surfaceY: number; footY: number; level: string; isGraded: boolean } | null {
    return this.query(x, z, footY, headY, levelKeys, undefined, maxFootY).floor;
  }

  /**
   * Check if the capsule at (x, z) with Y-range [footY, headY] overlaps any solid volume.
   * Uses proper circle-vs-AABB 2D overlap instead of discrete probe points so that
   * wedge/ramp volumes are detected from all directions (not just cardinal approach).
   */
  isHorizontalBlocked(
    x: number, z: number,
    footY: number, headY: number,
    radius: number,
    levelKeys: string[],
  ): boolean {
    if (guardFinite(x, z, footY, headY, radius) || guardLevelKeys(levelKeys)) {
      return false;
    }
    const radiusSq = radius * radius;
    const levelSet = new Set(levelKeys);

    for (const v of this.volumes) {
      if (!levelSet.has(v.level)) continue;

      // Circle-vs-AABB 2D overlap: closest point on volume footprint to capsule center
      const closestX = Math.max(v.x1, Math.min(x, v.x2));
      const closestZ = Math.max(v.z1, Math.min(z, v.z2));
      const dx = x - closestX;
      const dz = z - closestZ;
      if (dx * dx + dz * dz >= radiusSq) continue;

      if (volumeOverlapsSegment(v, closestX, closestZ, footY, headY)) {
        if (v.isWalkable) {
          // If the walkable volume is above the player's feet (e.g. ceiling/upper floor),
          // it shouldn't block them horizontally.
          if (v.kind === "aabb" && footY < v.y1) continue;
          if (v.kind === "wedge" && footY < v.baseY) continue;

          // Wedges (ramps) are graded surfaces: check if the player is ON the wedge
          // by comparing the surface at the player's actual position, not the closest point.
          // This allows walking up a ramp without being blocked by the rising surface ahead.
          if (v.kind === "wedge") {
            const syAtPlayer = volumeSurfaceY(v, x, z);
            if (syAtPlayer <= footY + 0.45) continue;
          }

          const sy = volumeSurfaceY(v, closestX, closestZ);
          if (sy > footY + 0.45) {
            return true;
          }
        } else {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Resolve depenetration pushout for non-walkable volumes at (x,z).
   * Returns `[dx, dz]` pushout vector that should be applied to the player position,
   * or null if no pushout is needed.
   */
  resolvePushout(
    x: number, z: number,
    footY: number, headY: number,
    radius: number,
    levelKeys: string[],
  ): [number, number] | null {
    if (guardFinite(x, z, footY, headY, radius) || guardLevelKeys(levelKeys)) {
      return null;
    }
    const radiusSq = radius * radius;
    const epsilon = 0.01;
    const levelSet = new Set(levelKeys);
    let pushX = 0;
    let pushZ = 0;

    for (const v of this.volumes) {
      if (!levelSet.has(v.level)) continue;
      if (v.isWalkable) continue; // Only non-walkable volumes push out

      // Circle-vs-AABB 2D overlap
      const closestX = Math.max(v.x1, Math.min(x, v.x2));
      const closestZ = Math.max(v.z1, Math.min(z, v.z2));
      const diffX = x - closestX;
      const diffZ = z - closestZ;
      const distSq = diffX * diffX + diffZ * diffZ;
      if (distSq >= radiusSq) continue;

      // Vertical overlap
      if (!volumeOverlapsSegment(v, closestX, closestZ, footY, headY)) continue;

      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const penDepth = radius - dist;
        pushX += (diffX / dist) * (penDepth + epsilon);
        pushZ += (diffZ / dist) * (penDepth + epsilon);
      } else {
        // Center exactly inside — push to closest edge
        const dLeft = x - v.x1;
        const dRight = v.x2 - x;
        const dTop = z - v.z1;
        const dBottom = v.z2 - z;
        const minDist = Math.min(dLeft, dRight, dTop, dBottom);
        if (minDist === dLeft) pushX -= radius + epsilon;
        else if (minDist === dRight) pushX += radius + epsilon;
        else if (minDist === dTop) pushZ -= radius + epsilon;
        else pushZ += radius + epsilon;
      }
    }

    if (pushX === 0 && pushZ === 0) return null;
    return [pushX, pushZ];
  }
}

/** Stairs and ramps change foot Y gradually — never treat as a void ledge. */
export function isGradedWalkTile(
  tileDef?: SliceTileDefinition | null,
  levelHeightUnits = LEVEL_HEIGHT,
): boolean {
  if (!tileDef) {
    return false;
  }
  if (tileDef.stairDir || tileDef.geometryProfile === "stair") {
    return true;
  }
  if (isFloorLevelRamp(tileDef, levelHeightUnits)) {
    return true;
  }
  return Boolean(tileDef.geometryProfile?.startsWith("ramp-"));
}
