import { CollisionWorld, isGradedWalkTile } from "./CollisionWorld";
import { evaluateVoidSafety, isStandingOnVoidAtLevel } from "./FallSafetySystem";
import { probeHoleTransition } from "./LevelTransitionSystem";
import {
  type PlayerContext,
  type PhysicsInput,
  HERO_BODY_HEIGHT,
  CEILING_BODY_CLEARANCE,
  JUMP_FULL_HEADROOM,
  GRAVITY,
  FALL_GRAVITY,
  JUMP_IMPULSE,
  STEP_UP_LIMIT,
  MAP_BORDER_MARGIN,
  PLAYER_RADIUS,
  levelToWorldY,
  inferLevelFromFootY,
} from "./PlayerContext";
import { LEVEL_HEIGHT } from "../../constants/World";
const SUBSTEP_MAX_SIZE = 0.1;

/** Pure callbacks for world queries — no side effects. */
export interface PhysicsWorldQueries {
  getMapTileAt: (level: string, tx: number, tz: number) => string | null;
  getTileDef: (symbol: string | null) => Record<string, unknown> | null | undefined;
  hasLevel: (level: string) => boolean;
  allLevels: () => string[];
  getMapWidth: () => number;
  getMapHeight: () => number;
  parseLevelNumber: (level: string) => number;
}

/** Events emitted so the orchestration layer can react (streaming, rendering, UI). */
export interface PhysicsEvents {
  onFallSafetyActive?: (ctx: PlayerContext) => void;
  onHoleTransition?: (fromLevel: string, toLevel: string, transition: { tileX: number; tileZ: number; landingLocalZ: number; guardMs: number }) => void;
  onNaturalLevelTransition?: (toLevel: string) => void;
  onGrounded?: (ctx: PlayerContext, impactSpeed: number) => void;
  onJump?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function relevantLevelKeys(footY: number, headY: number, all: string[]): string[] {
  return all.filter((l) => {
    const b = levelToWorldY(l);
    return headY > b && footY < b + LEVEL_HEIGHT;
  });
}

function currentLevelFrom(footY: number, all: string[]): string {
  return inferLevelFromFootY(footY, all);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry — one physics tick; returns updated ctx (pure-ish, mutates in place)
// ─────────────────────────────────────────────────────────────────────────────

export function tickPhysics(
  ctx: PlayerContext,
  input: PhysicsInput,
  cw: CollisionWorld,
  q: PhysicsWorldQueries,
  events?: PhysicsEvents,
): PlayerContext {
  const dt = input.deltaSeconds;
  if (dt <= 0) return ctx;

  const allLevels = q.allLevels();
  const mapW = q.getMapWidth();
  const mapH = q.getMapHeight();
  const mapMin = MAP_BORDER_MARGIN;
  const mapMaxX = Math.max(0.5, mapW - 0.5);
  const mapMaxZ = Math.max(0.5, mapH - 0.5);

  // Decay cooldown early so canAttemptTransition uses the up-to-date value
  ctx.levelTransitionCooldown = Math.max(0, ctx.levelTransitionCooldown - dt);

  // ── 1. Movement (substepped) ──────────────────────────────────────────
  const baseSpeed = input.sprintHeld ? 7.0 : 4.5;
  const speed = baseSpeed * input.speedMultiplier;
  let dx = 0;
  let dz = 0;
  if (input.moveX !== 0 || input.moveZ !== 0) {
    const len = Math.hypot(input.moveX, input.moveZ);
    dx = (input.moveX / len) * speed * dt;
    dz = (input.moveZ / len) * speed * dt;
  }

  let px = ctx.position.x;
  let pz = ctx.position.z;
  const footY = ctx.position.y;
  const headY = footY + HERO_BODY_HEIGHT;
  const lvlKeys = relevantLevelKeys(footY, headY, allLevels);

  // Substepping
  const total = Math.hypot(dx, dz);
  if (total > 0) {
    const steps = Math.ceil(total / SUBSTEP_MAX_SIZE);
    const sx = dx / steps;
    const sz = dz / steps;

    for (let i = 0; i < steps; i++) {
      const nx = px + sx;
      const nz = pz + sz;

      if (!blocked(nx, pz, footY, cw, lvlKeys, q, ctx, input.isFallSafetyEnabled)) px = nx;
      if (!blocked(px, nz, footY, cw, lvlKeys, q, ctx, input.isFallSafetyEnabled)) pz = nz;

      // Ground snap during movement
      if (ctx.isGrounded && !ctx.holeFallLandingLevel && !overVoid(px, pz, footY, cw, allLevels)) {
        const sy = snapY(px, pz, ctx.position.y, cw, allLevels);
        if (sy !== null) ctx.position.y = sy;
      }
    }
  }

  // Boundary clamp
  px = clamp(px, mapMin, mapMaxX);
  pz = clamp(pz, mapMin, mapMaxZ);

  // Pushout
  const push = cw.resolvePushout(px, pz, footY, headY, PLAYER_RADIUS, lvlKeys);
  if (push) {
    px = clamp(px + push[0], mapMin, mapMaxX);
    pz = clamp(pz + push[1], mapMin, mapMaxZ);
  }

  ctx.position.x = px;
  ctx.position.z = pz;

  // ── 2. Jump ───────────────────────────────────────────────────────────
  if (input.jumpPressed && ctx.isGrounded && !ctx.holeFallLandingLevel) {
    const impulse = resolveJumpHeadroom(px, pz, footY, cw, allLevels, q);
    if (impulse > 0) {
      ctx.verticalVelocity = impulse;
      ctx.isGrounded = false;
      events?.onJump?.();
    }
  }

  // ── 3. Void / fall-safety ─────────────────────────────────────────────
  {
    const voidAction = evaluateVoidSafety(ctx, px, pz, footY, {
      collisionWorld: cw,
      allLevels: () => allLevels,
      getMapTileAt: q.getMapTileAt,
      getTileDef: q.getTileDef,
      hasLevel: q.hasLevel,
      parseLevelNumber: q.parseLevelNumber,
    }, input.isFallSafetyEnabled);

    if (voidAction.type === "teleport_to_safe") {
      events?.onFallSafetyActive?.(ctx);
      ctx.position.x = voidAction.safeX;
      ctx.position.z = voidAction.safeZ;
      ctx.verticalVelocity = 0;
      ctx.isGrounded = true;
      return ctx;
    }

    if (voidAction.type === "begin_void_fall") {
      beginHoleFall(ctx, voidAction.landingLevel, voidAction.floors);
    }
  }

  // ── 4. Hole transition probe ──────────────────────────────────────────
  {
    const holeAction = probeHoleTransition(ctx, px, pz, footY, {
      getMapTileAt: q.getMapTileAt,
      getTileDef: q.getTileDef,
      hasLevel: q.hasLevel,
      parseLevelNumber: q.parseLevelNumber,
      allLevels: () => allLevels,
    });

    if (holeAction.type === "begin_fall") {
      beginHoleFall(ctx, holeAction.targetLevel, holeAction.floors);
      ctx.levelTransitionCooldown = holeAction.cooldown;
    }
  }

  // ── 5. Gravity & falling ──────────────────────────────────────────────
  if (!ctx.isGrounded) {
    const g = ctx.holeFallLandingLevel ? FALL_GRAVITY : GRAVITY;
    ctx.verticalVelocity += g * dt;
    ctx.position.y += ctx.verticalVelocity * dt;

    const floor = cw.queryFloor(px, pz, -999, ctx.position.y + HERO_BODY_HEIGHT, allLevels);
    if (floor && ctx.position.y <= floor.footY) {
      const impact = Math.abs(ctx.verticalVelocity);
      ctx.position.y = floor.footY;
      ctx.verticalVelocity = 0;
      ctx.isGrounded = true;
      ctx.lastGroundedFootY = floor.footY;

      const landedLevel = floor.level;
      if (landedLevel !== currentLevelFrom(floor.footY, allLevels)) {
        events?.onNaturalLevelTransition?.(landedLevel);
      }
      events?.onGrounded?.(ctx, impact);
      ctx.holeFallLandingLevel = null;
      ctx.holeFallFloorCount = 0;
    }
  }

  // ── 6. Ceiling collision ──────────────────────────────────────────────
  const cur = currentLevelFrom(footY, allLevels);
  const ceilQuery = cw.query(px, pz, footY, headY, allLevels, cur);
  if (ceilQuery.ceiling && !ceilQuery.ceiling.isGraded) {
    const cBot = ceilQuery.ceiling.bottomY;
    const maxFootY = cBot - CEILING_BODY_CLEARANCE - HERO_BODY_HEIGHT;
    if (ctx.position.y > maxFootY) {
      ctx.position.y = maxFootY;
      if (ctx.verticalVelocity > 0) ctx.verticalVelocity = 0;
    }
  }

  // ── 7. Final ground snap ──────────────────────────────────────────────
  if (ctx.isGrounded && !ctx.holeFallLandingLevel) {
    const sy = snapY(px, pz, ctx.position.y, cw, allLevels);
    if (sy !== null) {
      ctx.position.y = sy;
      ctx.lastGroundedFootY = sy;
    }
  }

  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function blocked(
  x: number, z: number, footY: number,
  cw: CollisionWorld, keys: string[], q: PhysicsWorldQueries,
  ctx: PlayerContext,
  isFallSafetyEnabled: boolean,
): boolean {
  if (cw.isHorizontalBlocked(x, z, footY, footY + HERO_BODY_HEIGHT, PLAYER_RADIUS, keys)) return true;

  if (isFallSafetyEnabled) {
    const tx = Math.floor(x);
    const tz = Math.floor(z);
    const lvlNum = Math.floor(footY / LEVEL_HEIGHT);
    const sym = q.getMapTileAt(String(lvlNum), tx, tz);
    if (!sym || sym === "...") {
      const belowSym = q.getMapTileAt(String(lvlNum - 1), tx, tz);
      const belowDef = belowSym && belowSym !== "..." ? q.getTileDef(belowSym) : undefined;
      if (!(belowDef && isGradedWalkTile(belowDef, LEVEL_HEIGHT))) return true;
    }
  }

  return false;
}

function overVoid(x: number, z: number, footY: number, cw: CollisionWorld, all: string[]): boolean {
  return isStandingOnVoidAtLevel(cw, x, z, footY, all);
}

function snapY(x: number, z: number, footY: number, cw: CollisionWorld, all: string[]): number | null {
  const f = cw.queryFloor(x, z, footY - STEP_UP_LIMIT, footY + HERO_BODY_HEIGHT, all, footY + STEP_UP_LIMIT);
  return f && f.footY <= footY + STEP_UP_LIMIT ? f.footY : null;
}

function beginHoleFall(ctx: PlayerContext, landing: string, floors: number): void {
  if (ctx.holeFallLandingLevel) return;
  ctx.fallOriginFootY = ctx.position.y;
  ctx.isGrounded = false;
  ctx.verticalVelocity = Math.min(ctx.verticalVelocity, 0);
  ctx.holeFallLandingLevel = landing;
  ctx.holeFallFloorCount = floors;
}

/** Check headroom and return adjusted jump impulse (0 if blocked). */
function resolveJumpHeadroom(
  x: number, z: number, footY: number,
  cw: CollisionWorld, all: string[], q: PhysicsWorldQueries,
): number {
  const cur = currentLevelFrom(footY, all);
  const headY = footY + HERO_BODY_HEIGHT;
  const result = cw.query(x, z, footY, headY, all, cur);
  if (result.ceiling && !result.ceiling.isGraded) {
    const headRoom = result.ceiling.bottomY - CEILING_BODY_CLEARANCE - footY;
    if (headRoom < 0.35) return 0;
    if (headRoom < JUMP_FULL_HEADROOM) return JUMP_IMPULSE * (headRoom / JUMP_FULL_HEADROOM);
  }
  return JUMP_IMPULSE;
}
