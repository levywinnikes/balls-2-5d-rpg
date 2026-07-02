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
  private static binaryLevelsCache: Map<string, Uint8Array> | null = null;
  private static backgroundRenderQueue: string[] = [];
  private static backgroundRendering = false;
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
    this.binaryLevelsCache = null;
    this.backgroundRenderQueue = [];
    this.backgroundRendering = false;
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

  public static setBinaryLevels(binaryLevels: Map<string, Uint8Array>): void {
    this.binaryLevelsCache = binaryLevels;
  }

  public static getMapData(): any {
    return this.mapDataCache;
  }

  public static getBuffer(level: string): HTMLCanvasElement | null {
    return this.bufferCache[level] || null;
  }

  public static hasBuffer(level: string): boolean {
    return Boolean(this.bufferCache[level]);
  }

  /**
   * Render one level buffer synchronously if binary data is available.
   * Returns true when the buffer exists after the call.
   */
  public static ensureLevelBuffer(level: string): boolean {
    if (this.bufferCache[level]) {
      return true;
    }
    const mapData = this.mapDataCache;
    const binData = this.binaryLevelsCache?.get(level);
    if (!mapData || !binData) {
      return false;
    }
    this.renderLevelToBuffer(level, mapData, binData);
    this.emitter.emit("levelBufferReady", level);
    return true;
  }

  /**
   * Lazy bootstrap: render the player's floor immediately, queue the rest.
   */
  public static bootstrapMinimap(
    data: any,
    binaryLevels: Map<string, Uint8Array>,
    priorityLevel: string,
  ): void {
    if (!data || !data.levels) {
      return;
    }

    this.setMapData(data);
    this.binaryLevelsCache = binaryLevels;

    const levelKeys = Object.keys(data.levels);
    const resolvedPriority = data.levels[priorityLevel]
      ? priorityLevel
      : levelKeys[0];

    console.log(
      `WorldMapService: Lazy bootstrap — priority level ${resolvedPriority}…`,
    );
    const start = performance.now();

    if (resolvedPriority) {
      this.ensureLevelBuffer(resolvedPriority);
    }

    const end = performance.now();
    console.log(
      `WorldMapService: Priority level ready in ${Math.round(end - start)}ms`,
    );

    this.emitter.emit("buffersReady");

    const deferred = levelKeys.filter(
      (levelKey) => levelKey !== resolvedPriority && !this.bufferCache[levelKey],
    );
    this.queueBackgroundLevels(deferred);
  }

  /** @deprecated Prefer bootstrapMinimap — kept for callers that still batch-render. */
  public static preRenderAll(
    data: any,
    binaryLevels: Map<string, Uint8Array>,
  ): void {
    if (!data || !data.levels) {
      return;
    }
    this.setMapData(data);
    this.binaryLevelsCache = binaryLevels;

    console.log("WorldMapService: Starting pre-render of all levels (BMS)…");
    const start = performance.now();

    Object.keys(data.levels).forEach((levelKey) => {
      this.ensureLevelBuffer(levelKey);
    });

    const end = performance.now();
    console.log(
      `WorldMapService: Pre-render complete in ${Math.round(end - start)}ms`,
    );
    this.emitter.emit("buffersReady");
  }

  private static queueBackgroundLevels(levels: string[]): void {
    for (const level of levels) {
      if (!this.bufferCache[level] && !this.backgroundRenderQueue.includes(level)) {
        this.backgroundRenderQueue.push(level);
      }
    }
    this.drainBackgroundQueue();
  }

  private static drainBackgroundQueue(): void {
    if (this.backgroundRendering || this.backgroundRenderQueue.length === 0) {
      return;
    }
    this.backgroundRendering = true;

    const schedule = (fn: () => void) => {
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(() => fn(), { timeout: 2000 });
      } else {
        setTimeout(fn, 16);
      }
    };

    const renderNext = () => {
      const level = this.backgroundRenderQueue.shift();
      if (!level) {
        this.backgroundRendering = false;
        this.emitter.emit("buffersReady");
        return;
      }

      if (!this.bufferCache[level]) {
        this.ensureLevelBuffer(level);
      }
      schedule(renderNext);
    };

    schedule(renderNext);
  }

  public static renderLevelToBuffer(
    viewLevel: string,
    mapData: any,
    binData: Uint8Array,
  ): void {
    if (this.bufferCache[viewLevel]) {
      return;
    }

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
    if (!bCtx) {
      return;
    }

    bCtx.fillStyle = "#111";
    bCtx.fillRect(0, 0, buffer.width, buffer.height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const symbolIdx = binData[y * width + x];
        const symbol = atlas[symbolIdx];
        if (!symbol || symbol === "...") {
          continue;
        }

        const color = this.getTileColor(symbol, definitions);
        bCtx.fillStyle = color;
        bCtx.fillRect(x, y, 1, 1);
      }
    }

    this.bufferCache[viewLevel] = buffer;
  }

  private static getTileColor(tileId: string, defs: any): string {
    if (this.colorCache[tileId]) {
      return this.colorCache[tileId];
    }
    const def = defs[tileId];
    if (!def) {
      return "#000";
    }

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
