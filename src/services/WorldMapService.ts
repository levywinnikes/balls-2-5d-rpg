/**
 * WORLD MAP SERVICE
 * Manages pre-rendered map buffers for UI components.
 * DOCUMENTATION: See /docs/SYSTEM_BMS.md
 */
import { TERRAIN_COLORS } from "../constants/TerrainColors";
import { EventEmitter } from "events";

export class WorldMapService {
  private static mapDataCache: any = null;
  private static bufferCache: Record<string, HTMLCanvasElement> = {};
  private static colorCache: Record<string, string> = {};
  private static activeMapKey = "";
  public static emitter = new EventEmitter();

  private static getMapKey(data: any): string {
    const mapName = data?.mapName || data?.config?.mapName || "unknown";
    const width = data?.width || 0;
    const height = data?.height || 0;
    const levels = Object.keys(data?.levels || {})
      .sort()
      .join(",");
    return `${mapName}:${width}x${height}:${levels}`;
  }

  private static clearCaches(): void {
    this.bufferCache = {};
    this.colorCache = {};
  }

  public static setMapData(data: any): void {
    const nextMapKey = this.getMapKey(data);
    if (this.activeMapKey !== nextMapKey) {
      this.activeMapKey = nextMapKey;
      this.clearCaches();
    }
    this.mapDataCache = data;
    this.emitter.emit("mapDataUpdated", data);
  }

  public static getMapData(): any {
    return this.mapDataCache;
  }

  public static getBuffer(level: string): HTMLCanvasElement | null {
    return this.bufferCache[level] || null;
  }

  public static preRenderAll(
    data: any,
    binaryLevels: Map<string, Uint8Array>,
  ): void {
    if (!data || !data.levels) return;
    this.setMapData(data);

    console.log("WorldMapService: Starting pre-render of all levels (BMS)...");
    const start = performance.now();

    Object.keys(data.levels).forEach((levelKey) => {
      const binData = binaryLevels.get(levelKey);
      if (binData) {
        this.renderLevelToBuffer(levelKey, data, binData);
      }
    });

    const end = performance.now();
    console.log(
      `WorldMapService: Pre-render complete in ${Math.round(end - start)}ms`,
    );
    this.emitter.emit("buffersReady");
  }

  public static renderLevelToBuffer(
    viewLevel: string,
    mapData: any,
    binData: Uint8Array,
  ): void {
    if (this.bufferCache[viewLevel]) return;

    const width = mapData.width;
    const height = mapData.height;
    const atlas = mapData.tileAtlas;
    const definitions = {
      ...mapData.tileDefinitions,
      ...mapData.entityTemplates,
    };

    const buffer = document.createElement("canvas");
    buffer.width = width;
    buffer.height = height;

    const bCtx = buffer.getContext("2d");
    if (!bCtx) return;

    bCtx.fillStyle = "#111";
    bCtx.fillRect(0, 0, buffer.width, buffer.height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const symbolIdx = binData[y * width + x];
        const symbol = atlas[symbolIdx];
        if (!symbol || symbol === "...") continue;

        const color = this.getTileColor(symbol, definitions);
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
