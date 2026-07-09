export type NavigationSystemConfig = {
  getCurrentLevel: () => string;
  getPlayerPosition: () => { x: number; z: number };
  getMapData: () => { width?: number; height?: number } | null;
  isTileBlocked: (tileX: number, tileY: number) => boolean;
  onGridUpdate: (grid: number[][], size: number, origin: number) => void;
  NAV_WINDOW_RADIUS: number;
};

export class NavigationSystem {
  private cfg: NavigationSystemConfig;
  grid: number[][] = [];
  gridSize = 48;
  gridOrigin = 0;
  level: string | null = null;
  minTileX = 0;
  minTileY = 0;
  private windowTimer = 0;

  constructor(config: NavigationSystemConfig) {
    this.cfg = config;
    this.gridSize = config.NAV_WINDOW_RADIUS * 2;
    this.grid = Array.from({ length: this.gridSize }, () =>
      Array(this.gridSize).fill(0),
    );
  }

  rebuildWindow(level: string, force = false): void {
    const { getMapData, getPlayerPosition, isTileBlocked, onGridUpdate, NAV_WINDOW_RADIUS } = this.cfg;
    const mapData = getMapData();
    if (!mapData?.width || !mapData.height) return;

    const pos = getPlayerPosition();
    const centerX = Math.floor(pos.x);
    const centerZ = Math.floor(pos.z);
    const winSize = NAV_WINDOW_RADIUS * 2;

    if (
      !force &&
      this.level === level &&
      Math.abs(centerX - (this.minTileX + NAV_WINDOW_RADIUS)) < 18 &&
      Math.abs(centerZ - (this.minTileY + NAV_WINDOW_RADIUS)) < 18
    ) {
      return;
    }

    this.minTileX = Math.max(0, Math.min(centerX - NAV_WINDOW_RADIUS, mapData.width - winSize));
    this.minTileY = Math.max(0, Math.min(centerZ - NAV_WINDOW_RADIUS, mapData.height - winSize));
    this.level = level;
    this.gridSize = winSize;
    this.gridOrigin = -this.minTileX;

    this.grid = Array.from({ length: winSize }, () => Array(winSize).fill(0));
    for (let ly = 0; ly < winSize; ly++) {
      for (let lx = 0; lx < winSize; lx++) {
        if (isTileBlocked(this.minTileX + lx, this.minTileY + ly)) {
          this.grid[ly][lx] = 1;
        }
      }
    }

    onGridUpdate(this.grid, this.gridSize, this.gridOrigin);
  }

  rebuildGrid(level: string): void {
    this.rebuildWindow(level, true);
  }

  worldToGridX(worldX: number): number {
    return Math.floor(worldX) - this.minTileX;
  }

  worldToGridZ(worldZ: number): number {
    return Math.floor(worldZ) - this.minTileY;
  }

  gridToWorldX(gridX: number): number {
    return gridX + this.minTileX + 0.5;
  }

  gridToWorldZ(gridY: number): number {
    return gridY + this.minTileY + 0.5;
  }

  tick(deltaSeconds: number): void {
    this.windowTimer += deltaSeconds;
    if (this.windowTimer >= 0.45) {
      this.windowTimer = 0;
      this.rebuildWindow(this.cfg.getCurrentLevel());
    }
  }
}
