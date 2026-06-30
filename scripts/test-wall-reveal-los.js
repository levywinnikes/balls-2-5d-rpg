/** Grid LOS regression for top-down wall reveal markers. */
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

const grid = [
  [0, 0, 1, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
];
const size = 5;

const blocked = findBlocking(grid, size, 0, 0, 4, 0, { skipStart: true });
if (!blocked || blocked.x !== 2 || blocked.y !== 0) {
  failed += 1;
  console.error("expected wall at (2,0)", blocked);
}

const clear = findBlocking(grid, size, 0, 4, 4, 4, { skipStart: true });
if (clear !== null) {
  failed += 1;
  console.error("expected clear line", clear);
}

if (failed) {
  process.exit(1);
}
console.log("[test-wall-reveal-los] ok");
