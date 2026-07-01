const FP_CAMERA_FOV = 1.1;
const FP_CAMERA_FOV_COMBAT_MAX = 1.22;
const FP_PULLBACK_MAX = 0.38;
const FP_PULLBACK_NEAR = 1.05;
const FP_PULLBACK_FAR = 2.35;
const FP_ENEMY_SCALE_MIN = 0.68;
const FP_ENEMY_SCALE_NEAR = 1.1;
const FP_ENEMY_SCALE_FAR = 2.5;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lerp(a, b, t) {
  return a + (b - a) * clamp01(t);
}

function getFirstPersonEnemyProximityScale(distanceToPlayer) {
  if (distanceToPlayer >= FP_ENEMY_SCALE_FAR) return 1;
  if (distanceToPlayer <= FP_ENEMY_SCALE_NEAR) return FP_ENEMY_SCALE_MIN;
  const t =
    (distanceToPlayer - FP_ENEMY_SCALE_NEAR) /
    (FP_ENEMY_SCALE_FAR - FP_ENEMY_SCALE_NEAR);
  return lerp(FP_ENEMY_SCALE_MIN, 1, t);
}

function computeCombatPullback(distanceToTarget) {
  if (distanceToTarget === null) return 0;
  if (distanceToTarget >= FP_PULLBACK_FAR) return 0;
  if (distanceToTarget <= FP_PULLBACK_NEAR) return FP_PULLBACK_MAX;
  const t =
    (FP_PULLBACK_FAR - distanceToTarget) /
    (FP_PULLBACK_FAR - FP_PULLBACK_NEAR);
  return FP_PULLBACK_MAX * clamp01(t);
}

let failed = 0;

const closeScale = getFirstPersonEnemyProximityScale(1);
if (closeScale >= 1 || closeScale > 0.75) {
  failed += 1;
  console.error("FP enemy scale should shrink when close", closeScale);
}

const farScale = getFirstPersonEnemyProximityScale(3);
if (farScale !== 1) {
  failed += 1;
  console.error("FP enemy scale should be 1 when far", farScale);
}

const pullBack = computeCombatPullback(1.2);
if (pullBack <= 0) {
  failed += 1;
  console.error("combat pullback should activate near target", pullBack);
}

if (failed) {
  process.exit(1);
}
console.log("[test-fp-combat-presentation] ok");
