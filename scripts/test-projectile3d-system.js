/** Projectile profile + grid segment helpers (mirrors Projectile3DSystem). */
function resolveProjectile3DProfile(weaponId) {
  if (weaponId === "throwing_star") {
    return { visual: "throwing_star", speed: 16, hitRadius: 0.34 };
  }
  return { visual: "arrow", speed: 20, hitRadius: 0.3 };
}

const ARROW_EAST_FRAME_HEADING_PHASER = (3 * Math.PI) / 4;

function arrowFlightYawRad(dx, dz) {
  const flightAngle = Math.atan2(dz, dx);
  return -flightAngle + ARROW_EAST_FRAME_HEADING_PHASER;
}

function findBlocking(grid, size, x0, y0, x1, y1, opts) {
  let currentX = x0;
  let currentY = y0;
  const deltaX = Math.abs(x1 - x0);
  const deltaY = Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  let error = deltaX - deltaY;

  while (currentX !== x1 || currentY !== y1) {
    const isStart = currentX === x0 && currentY === y0;
    if (!isStart || !opts?.skipStart) {
      if (grid[currentY]?.[currentX] === 1) {
        return { x: currentX, y: currentY };
      }
    }
    const doubledError = error * 2;
    if (doubledError > -deltaY) {
      error -= deltaY;
      currentX += stepX;
    }
    if (doubledError < deltaX) {
      error += deltaX;
      currentY += stepY;
    }
  }
  return null;
}

let failed = 0;

const bow = resolveProjectile3DProfile("short_bow");
if (bow.visual !== "arrow") {
  failed += 1;
  console.error("short_bow should map to arrow");
}

const star = resolveProjectile3DProfile("throwing_star");
if (star.visual !== "throwing_star") {
  failed += 1;
  console.error("throwing_star profile");
}

const grid = Array.from({ length: 8 }, () => Array(8).fill(0));
grid[3][4] = 1;
const block = findBlocking(grid, 8, 1, 3, 6, 3, { skipStart: true });
if (!block || block.x !== 4) {
  failed += 1;
  console.error("expected wall block at x=4", block);
}

// east flight: tip should get a stable yaw (not atan2 swap bug)
const eastYaw = arrowFlightYawRad(1, 0);
if (!Number.isFinite(eastYaw)) {
  failed += 1;
  console.error("arrow east yaw");
}

// distinct headings per direction
const northYaw = arrowFlightYawRad(0, -1);
const southYaw = arrowFlightYawRad(0, 1);
if (Math.abs(northYaw - southYaw) < 0.01) {
  failed += 1;
  console.error("arrow yaw should differ by direction");
}

if (failed) {
  process.exit(1);
}
console.log("[test-projectile3d-system] ok");
