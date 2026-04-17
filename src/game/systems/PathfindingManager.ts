interface PathfindingCallbacks {
  resolve: (path: { x: number; y: number }[] | null) => void;
  // reject? (optional)
}

export class PathfindingManager {
  private static instance: PathfindingManager;
  private worker: Worker;
  private pendingRequests: Map<number, PathfindingCallbacks> = new Map();
  private nextRequestId: number = 0;

  private constructor() {
    // Initialize Worker
    // Note: CRA/Webpack 5 requires this syntax for workers
    this.worker = new Worker(
      new URL("../../workers/pathfinding.worker.ts", import.meta.url),
    );

    this.worker.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === "PATH_FOUND") {
        const { id, path } = payload;
        const callback = this.pendingRequests.get(id);
        if (callback) {
          callback.resolve(path);
          this.pendingRequests.delete(id);
        }
      }
    };

    this.worker.onerror = (err) => {
      console.error("Pathfinding Worker Error:", err);
    };
  }

  public static getInstance(): PathfindingManager {
    if (!PathfindingManager.instance) {
      PathfindingManager.instance = new PathfindingManager();
    }
    return PathfindingManager.instance;
  }

  public updateGrid(grid: number[][]): void {
    this.worker.postMessage({
      type: "SET_GRID",
      payload: { grid },
    });
  }

  public requestPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): Promise<{ x: number; y: number }[] | null> {
    return new Promise((resolve) => {
      const id = this.nextRequestId++;
      this.pendingRequests.set(id, { resolve });

      this.worker.postMessage({
        type: "FIND_PATH",
        payload: {
          id,
          startX,
          startY,
          endX,
          endY,
        },
      });
    });
  }
}
