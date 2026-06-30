export type GridPoint = { x: number; y: number };

/**
 * Bresenham walk on a blocking grid; returns the first blocking tile between two cells.
 * Grid uses [y][x] indexing (same as navigationGrid in the slice runtime).
 */
export function findFirstBlockingTileOnGridLine(
  grid: number[][],
  gridSize: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  options?: { skipStart?: boolean; skipEnd?: boolean },
): GridPoint | null {
  if (
    fromX < 0 ||
    fromY < 0 ||
    toX < 0 ||
    toY < 0 ||
    fromX >= gridSize ||
    fromY >= gridSize ||
    toX >= gridSize ||
    toY >= gridSize
  ) {
    return null;
  }

  let currentX = fromX;
  let currentY = fromY;
  const deltaX = Math.abs(toX - fromX);
  const deltaY = Math.abs(toY - fromY);
  const stepX = fromX < toX ? 1 : -1;
  const stepY = fromY < toY ? 1 : -1;
  let error = deltaX - deltaY;

  while (currentX !== toX || currentY !== toY) {
    const isStart = currentX === fromX && currentY === fromY;
    if (!isStart || !options?.skipStart) {
      const isEnd = currentX === toX && currentY === toY;
      if (!isEnd || !options?.skipEnd) {
        if (grid[currentY]?.[currentX] === 1) {
          return { x: currentX, y: currentY };
        }
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

export function hasClearGridLineOfSight(
  grid: number[][],
  gridSize: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): boolean {
  return (
    findFirstBlockingTileOnGridLine(
      grid,
      gridSize,
      fromX,
      fromY,
      toX,
      toY,
      { skipStart: true },
    ) === null
  );
}
