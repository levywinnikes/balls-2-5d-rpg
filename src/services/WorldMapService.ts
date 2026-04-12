import { TERRAIN_COLORS } from "../constants/TerrainColors";

export class WorldMapService {
  private static mapDataCache: any = null;
  private static bufferCache: Record<string, HTMLCanvasElement> = {};
  private static colorCache: Record<string, string> = {};

  public static setMapData(data: any): void {
    this.mapDataCache = data;
  }

  public static getMapData(): any {
    return this.mapDataCache;
  }

  public static getBuffer(level: string): HTMLCanvasElement | null {
    return this.bufferCache[level] || null;
  }

  public static preRenderAll(data: any): void {
    if (!data || !data.levels) return;
    this.mapDataCache = data;
    
    console.log("WorldMapService: Starting pre-render of all levels...");
    const start = performance.now();
    
    Object.keys(data.levels).forEach((levelKey) => {
      this.renderLevelToBuffer(levelKey, data);
    });
    
    const end = performance.now();
    console.log(`WorldMapService: Pre-render complete in ${Math.round(end - start)}ms`);
  }

  private static renderLevelToBuffer(viewLevel: string, mapData: any): void {
    if (this.bufferCache[viewLevel]) return;

    const levelData = mapData.levels[viewLevel];
    if (!levelData) return;
    
    const mapGrid = levelData.map;
    const rows = mapGrid.length;
    const cols = mapGrid[0].length;
    const definitions = { ...mapData.tiles, ...mapData.entities };

    const buffer = document.createElement("canvas");
    buffer.width = cols;
    buffer.height = rows;

    const bCtx = buffer.getContext("2d");
    if (!bCtx) return;

    bCtx.fillStyle = "#111";
    bCtx.fillRect(0, 0, buffer.width, buffer.height);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const tile = mapGrid[y][x];
        if (tile === "...") continue;
        const color = this.getTileColor(tile, definitions);
        bCtx.fillStyle = color;
        bCtx.fillRect(x, y, 1, 1);
      }
    }
    
    this.bufferCache[viewLevel] = buffer;
  }

  private static getTileColor(tileId: string, defs: any): string {
    if (this.colorCache[tileId]) return this.colorCache[tileId];
    const def = defs[tileId];
    if (!def) return "#000";

    if (def.color) {
      this.colorCache[tileId] = def.color;
      return def.color;
    }

    if (TERRAIN_COLORS[def.id]) {
      this.colorCache[tileId] = TERRAIN_COLORS[def.id];
      return TERRAIN_COLORS[def.id];
    }

    if (def.under) {
      const c = this.getTileColor(def.under, defs);
      this.colorCache[tileId] = c;
      return c;
    }

    return TERRAIN_COLORS.default;
  }
}
