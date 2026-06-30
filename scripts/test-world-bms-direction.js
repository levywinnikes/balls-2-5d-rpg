/**
 * Regression: inverse of hero WASD screen→world mapping (top-down basis math).
 * Run: node scripts/test-world-bms-direction.js
 */
function resolveFromBasis(deltaX, deltaZ, basisX, basisZ) {
  const moveRight = basisX.x * deltaX + basisZ.x * deltaZ;
  const moveForward = -(basisX.y * deltaX + basisZ.y * deltaZ);

  if (moveForward === 0 && moveRight === 0) {
    return "south";
  }
  if (Math.abs(moveForward) >= Math.abs(moveRight)) {
    return moveForward > 0 ? "north" : "south";
  }
  return moveRight > 0 ? "east" : "west";
}

function forwardToWorld(moveRight, moveForward, basisX, basisZ, det) {
  const desiredScreenX = moveRight;
  const desiredScreenY = -moveForward;
  const worldDX =
    (desiredScreenX * basisZ.y - desiredScreenY * basisZ.x) / det;
  const worldDZ =
    (basisX.x * desiredScreenY - basisX.y * desiredScreenX) / det;
  return { worldDX, worldDZ };
}

// Typical top-down α=π/2: +worldX → screen left, +worldZ → screen down
const basisX = { x: -1, y: 0 };
const basisZ = { x: 0, y: 1 };
const det = basisX.x * basisZ.y - basisX.y * basisZ.x;

let failed = 0;

// Round-trip: screen input → world → direction must restore east/west
[
  { mr: 1, mf: 0, want: "east" },
  { mr: -1, mf: 0, want: "west" },
  { mr: 0, mf: 1, want: "north" },
  { mr: 0, mf: -1, want: "south" },
].forEach(({ mr, mf, want }) => {
  const { worldDX, worldDZ } = forwardToWorld(mr, mf, basisX, basisZ, det);
  const got = resolveFromBasis(worldDX, worldDZ, basisX, basisZ);
  if (got !== want) {
    failed += 1;
    console.error(
      `round-trip FAIL mr=${mr} mf=${mf} world=(${worldDX},${worldDZ}) got=${got} want=${want}`,
    );
  }
});

// Orc faces hero on screen right: hero has lower world X → dx < 0 → east
const faceEast = resolveFromBasis(-1, 0, basisX, basisZ);
if (faceEast !== "east") {
  failed += 1;
  console.error(`face hero on screen-right FAIL got=${faceEast} want=east`);
}

// Hero on screen left of orc: dx > 0 → west
const faceWest = resolveFromBasis(1, 0, basisX, basisZ);
if (faceWest !== "west") {
  failed += 1;
  console.error(`face hero on screen-left FAIL got=${faceWest} want=west`);
}

if (failed) {
  process.exit(1);
}

// FP yaw ↔ BMS facing round-trip (createDebugSliceScene setCameraMode)
const YAW_BY_BMS = { south: 0, north: Math.PI, east: -Math.PI / 2, west: Math.PI / 2 };
function yawToBms(yaw) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const screenRight = -fx;
  const screenUp = -fz;
  if (Math.abs(screenUp) >= Math.abs(screenRight)) {
    return screenUp > 0 ? "north" : "south";
  }
  return screenRight > 0 ? "east" : "west";
}
for (const dir of ["south", "north", "east", "west"]) {
  const yaw = YAW_BY_BMS[dir];
  const got = yawToBms(yaw);
  if (got !== dir) {
    failed += 1;
    console.error(`yaw round-trip FAIL dir=${dir} yaw=${yaw} got=${got}`);
  }
}

if (failed) {
  process.exit(1);
}
console.log("[test-world-bms-direction] ok");
