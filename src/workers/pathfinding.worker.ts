/* eslint-disable no-restricted-globals */
import * as EasyStar from "easystarjs";

// Valid TypeScript for Web Worker scope
const ctx: Worker = self as any;

const easystar = new EasyStar.js();

// Interfaces matching those in PathfindingManager
interface PathRequest {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface GridUpdate {
  grid: number[][];
}

interface WorkerMessage {
  type: "SET_GRID" | "FIND_PATH";
  payload: any;
}

ctx.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  switch (type) {
    case "SET_GRID":
      const { grid } = payload as GridUpdate;
      easystar.setGrid(grid);
      easystar.setAcceptableTiles([0]);
      easystar.enableDiagonals();
      easystar.disableCornerCutting();
      break;

    case "FIND_PATH":
      const req = payload as PathRequest;
      // Start calculation
      easystar.findPath(req.startX, req.startY, req.endX, req.endY, (path) => {
        // Send result back
        ctx.postMessage({
          type: "PATH_FOUND",
          payload: {
            id: req.id,
            path: path,
          },
        });
      });
      // Force calculation sync in worker (it's async inside easystar but we trigger it now)
      easystar.calculate();
      break;
  }
});
