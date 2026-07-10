import type { Slice3DSessionLog, Slice3DLogSample, Slice3DLogEvent, Slice3DHotspot, Slice3DSummary } from "./createDebugSliceScene";

// ── Constants ───────────────────────────────────────────────────────────────

const LOG_STORAGE_KEY = "slice3d.runtime.logs.latest";
const LOG_FRAME_WINDOW_MAX = 600;
const LOG_PATH_WINDOW_MAX = 600;
const LOG_HEAP_WINDOW_SECONDS = 300;
const LOG_UNLOAD_RECOVERY_GRACE_SECONDS = 25;
const LOG_MAX_EVENTS = 3000;

// ── Config ──────────────────────────────────────────────────────────────────

export interface TelemetryLoggerConfig {
  sliceMapName: string;
  telemetryEnabledRef: { value: boolean };
  getCurrentLevel: () => string;
  getElapsedSec: () => number;
  getIsFirstPerson: () => boolean;
}

// ── Data structures moved into class fields ────────────────────────────────

export class TelemetryLogger {
  telemetryFileFlushInFlight = false;
  lastRuntimeLogFilePath: string | null = null;
  readonly runtimeStartedAt = Date.now();
  previousHeapUsedMb: number | undefined;
  prevDrawCallsTotal = 0;

  readonly frameMsWindow: number[] = [];
  readonly pathMsWindow: number[] = [];
  readonly heapHistory: Array<{ elapsedSec: number; usedMb: number }> = [];
  readonly chunkHotspots = new Map<string, {
    level: string; chunkX: number; chunkZ: number; samples: number;
    frameMsAcc: number; drawCallsAcc: number; activeMeshesAcc: number;
    verticesAcc: number; maxHeapUsedMb: number; maxPathMs: number;
  }>();
  readonly unloadCheckpoints: Array<{
    atSec: number; heapMb: number; resolved: boolean; succeeded: boolean;
  }> = [];
  chunkUnloadRecoveryFailures = 0;

  readonly pathMetrics = {
    requests: 0, success: 0, failed: 0, errors: 0, totalMs: 0,
    maxMs: 0, lastMs: 0, lastPathLen: 0, inFlight: 0,
  };

  readonly runtimeLog: Slice3DSessionLog;

  constructor(private readonly cfg: TelemetryLoggerConfig) {
    const now = this.runtimeStartedAt;
    this.runtimeLog = {
      version: 1,
      mapName: cfg.sliceMapName,
      startedAt: new Date(now).toISOString(),
      sessionId: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      samples: [],
      events: [],
      counters: { samplesDropped: 0, eventsDropped: 0, exportCount: 0 },
    };

    this.setupWindowApi();
    this.pushLogEvent("session.start", {
      map: cfg.sliceMapName,
      level: cfg.getCurrentLevel(),
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────

  get telemetryEnabledRef(): { value: boolean } {
    return this.cfg.telemetryEnabledRef;
  }

  get td() {
    return {
      previousHeapUsedMb: this.previousHeapUsedMb,
      frameMsWindow: this.frameMsWindow,
      pathMsWindow: this.pathMsWindow,
      heapHistory: this.heapHistory,
      chunkHotspots: this.chunkHotspots,
      unloadCheckpoints: this.unloadCheckpoints,
      chunkUnloadRecoveryFailures: this.chunkUnloadRecoveryFailures,
      pathMetrics: this.pathMetrics,
    };
  }

  // ── Elapsed seconds ─────────────────────────────────────────────────────

  getElapsedSec(): number {
    return this.cfg.getElapsedSec();
  }

  // ── Push bounded ────────────────────────────────────────────────────────

  pushBounded(arr: number[], value: number, maxSize: number): void {
    arr.push(value);
    if (arr.length > maxSize) {
      arr.shift();
    }
  }

  // ── Event logging ──────────────────────────────────────────────────────

  pushLogEvent(type: string, payload?: Record<string, unknown>): void {
    if (!this.cfg.telemetryEnabledRef.value) return;
    if (this.runtimeLog.events.length >= LOG_MAX_EVENTS) {
      this.runtimeLog.events.shift();
      this.runtimeLog.counters.eventsDropped += 1;
    }
    this.runtimeLog.events.push({
      ts: Date.now(),
      elapsedSec: this.cfg.getElapsedSec(),
      type,
      payload,
    });
  }

  // ── Persist ─────────────────────────────────────────────────────────────

  persistRuntimeLogs(): void {
    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.runtimeLog));
    } catch {
      // Ignore storage errors (quota/private mode); in-memory logs remain available.
    }
  }

  // ── Export / summary ────────────────────────────────────────────────────

  private getPercentile(arr: number[], percentile: number): number {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const rank = (percentile / 100) * (sorted.length - 1);
    const low = Math.floor(rank);
    const high = Math.ceil(rank);
    if (low === high) {
      return sorted[low];
    }
    const weight = rank - low;
    return sorted[low] * (1 - weight) + sorted[high] * weight;
  }

  private clampScore(value: number, min = 0, max = 100): number {
    return Math.max(min, Math.min(max, value));
  }

  private getHeapSlopeMbPerSec(): number | undefined {
    const points = this.heapHistory;
    if (points.length < 6) {
      return undefined;
    }

    const n = points.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    points.forEach((point) => {
      const x = point.elapsedSec;
      const y = point.usedMb;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const denominator = n * sumX2 - sumX * sumX;
    if (Math.abs(denominator) < 1e-6) {
      return undefined;
    }

    return (n * sumXY - sumX * sumY) / denominator;
  }

  buildHotspots(limit = 10): Slice3DHotspot[] {
    const list: Slice3DHotspot[] = [];

    this.chunkHotspots.forEach((entry, key) => {
      if (entry.samples <= 0) {
        return;
      }

      const avgFrameMs = entry.frameMsAcc / entry.samples;
      const avgDrawCalls = entry.drawCallsAcc / entry.samples;
      const avgActiveMeshes = entry.activeMeshesAcc / entry.samples;
      const avgVertices = entry.verticesAcc / entry.samples;
      const score =
        avgFrameMs * 2.3 +
        avgDrawCalls * 0.08 +
        avgActiveMeshes * 0.06 +
        avgVertices / 50000 +
        entry.maxHeapUsedMb * 0.12 +
        entry.maxPathMs * 0.25;

      list.push({
        key,
        level: entry.level,
        chunkX: entry.chunkX,
        chunkZ: entry.chunkZ,
        samples: entry.samples,
        avgFrameMs: Math.round(avgFrameMs * 100) / 100,
        avgDrawCalls: Math.round(avgDrawCalls * 100) / 100,
        avgActiveMeshes: Math.round(avgActiveMeshes * 100) / 100,
        avgVertices: Math.round(avgVertices * 100) / 100,
        maxHeapUsedMb: Math.round(entry.maxHeapUsedMb * 100) / 100,
        maxPathMs: Math.round(entry.maxPathMs * 100) / 100,
        score: Math.round(score * 100) / 100,
      });
    });

    return list.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  buildSummary(): Slice3DSummary {
    const frameP50 = this.getPercentile(this.frameMsWindow, 50);
    const frameP95 = this.getPercentile(this.frameMsWindow, 95);
    const frameP99 = this.getPercentile(this.frameMsWindow, 99);
    const pathP50 = this.getPercentile(this.pathMsWindow, 50);
    const pathP95 = this.getPercentile(this.pathMsWindow, 95);
    const pathP99 = this.getPercentile(this.pathMsWindow, 99);
    const heapSlope = this.getHeapSlopeMbPerSec();
    const currentHeap = this.heapHistory.length
      ? this.heapHistory[this.heapHistory.length - 1].usedMb
      : undefined;

    const recentSamples = this.runtimeLog.samples.slice(-60);
    const avgPendingCandidates = recentSamples.length
      ? recentSamples.reduce((acc, s) => acc + s.chunks.pendingCandidates, 0) /
        recentSamples.length
      : 0;
    const avgPendingUnloads = recentSamples.length
      ? recentSamples.reduce((acc, s) => acc + s.chunks.pendingUnloads, 0) /
        recentSamples.length
      : 0;

    const leakReasons: string[] = [];
    if (heapSlope !== undefined && heapSlope > 0.03) {
      leakReasons.push(`heap slope positive (${heapSlope.toFixed(3)} MB/s)`);
    }
    if (this.chunkUnloadRecoveryFailures >= 2) {
      leakReasons.push(
        `chunk unload recovery failed ${this.chunkUnloadRecoveryFailures}x`,
      );
    }

    let leakRisk: "low" | "medium" | "high" = "low";
    if (leakReasons.length >= 2) {
      leakRisk = "high";
    } else if (leakReasons.length === 1) {
      leakRisk = "medium";
    }

    const frameScore = this.clampScore(100 - (frameP95 - 16.7) * 3.2);
    const stabilityScore = this.clampScore(
      100 - Math.max(0, frameP99 - frameP50) * 2.1,
    );
    const pathScore = this.clampScore(100 - Math.max(0, pathP95 - 25) * 1.8);
    const backlogScore = this.clampScore(
      100 - avgPendingCandidates * 2.2 - avgPendingUnloads * 1.2,
    );
    const leakPenalty =
      leakRisk === "high" ? 30 : leakRisk === "medium" ? 15 : 0;

    const sessionHealthScore = this.clampScore(
      frameScore * 0.35 +
        stabilityScore * 0.2 +
        pathScore * 0.25 +
        backlogScore * 0.2 -
        leakPenalty,
    );

    return {
      sampleCount: this.runtimeLog.samples.length,
      eventCount: this.runtimeLog.events.length,
      uptimeSec: Math.round(this.cfg.getElapsedSec() * 100) / 100,
      frameMs: {
        p50: Math.round(frameP50 * 100) / 100,
        p95: Math.round(frameP95 * 100) / 100,
        p99: Math.round(frameP99 * 100) / 100,
      },
      pathMs: {
        p50: Math.round(pathP50 * 100) / 100,
        p95: Math.round(pathP95 * 100) / 100,
        p99: Math.round(pathP99 * 100) / 100,
      },
      heap: {
        currentMb: currentHeap,
        slopeMbPerSec:
          heapSlope !== undefined
            ? Math.round(heapSlope * 10000) / 10000
            : undefined,
        unloadRecoveryFailures: this.chunkUnloadRecoveryFailures,
      },
      chunk: {
        avgPendingCandidates: Math.round(avgPendingCandidates * 100) / 100,
        avgPendingUnloads: Math.round(avgPendingUnloads * 100) / 100,
      },
      leakRisk: {
        level: leakRisk,
        reasons: leakReasons,
      },
      sessionHealthScore: Math.round(sessionHealthScore * 100) / 100,
    };
  }

  exportRuntimeLogs(): any {
    this.runtimeLog.counters.exportCount += 1;
    const summary = this.buildSummary();
    const hotspots = this.buildHotspots(20);
    return {
      ...this.runtimeLog,
      exportedAt: new Date().toISOString(),
      runtime: {
        currentLevel: this.cfg.getCurrentLevel(),
        isFirstPerson: this.cfg.getIsFirstPerson(),
      },
      summary,
      hotspots,
    };
  }

  // ── File flush ─────────────────────────────────────────────────────────

  async flushRuntimeLogsToFile(force = false): Promise<void> {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.writeRuntimeLog) {
      return;
    }
    if (!force && this.telemetryFileFlushInFlight) {
      return;
    }

    this.telemetryFileFlushInFlight = true;
    try {
      const result = await electronAPI.writeRuntimeLog(this.exportRuntimeLogs());
      if (result?.success && result.path) {
        if (this.lastRuntimeLogFilePath !== result.path) {
          this.pushLogEvent("log.file-path", { path: result.path });
        }
        this.lastRuntimeLogFilePath = result.path;
      } else if (result?.error) {
        this.pushLogEvent("log.file-write-error", { error: result.error });
      }
    } catch (error) {
      this.pushLogEvent("log.file-write-error", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.telemetryFileFlushInFlight = false;
    }
  }

  // ── Download ────────────────────────────────────────────────────────────

  downloadRuntimeLogs(): void {
    const payload = JSON.stringify(this.exportRuntimeLogs(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `slice3d-runtime-log-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    this.pushLogEvent("log.download");
  }

  // ── Window API ─────────────────────────────────────────────────────────

  private setupWindowApi(): void {
    const logger = this;
    (window as any).__slice3dLogs = {
      get: () => logger.exportRuntimeLogs(),
      getSummary: () => logger.buildSummary(),
      getHotspots: (limit: number) =>
        logger.buildHotspots(Math.max(1, Number(limit) || 10)),
      download: () => logger.downloadRuntimeLogs(),
      clear: () => {
        logger.runtimeLog.samples = [];
        logger.runtimeLog.events = [];
        logger.runtimeLog.counters.samplesDropped = 0;
        logger.runtimeLog.counters.eventsDropped = 0;
        logger.previousHeapUsedMb = undefined;
        logger.frameMsWindow.length = 0;
        logger.pathMsWindow.length = 0;
        logger.heapHistory.length = 0;
        logger.chunkHotspots.clear();
        logger.unloadCheckpoints.length = 0;
        logger.chunkUnloadRecoveryFailures = 0;
        logger.pushLogEvent("log.clear");
        logger.persistRuntimeLogs();
      },
      mark: (label: string, extra?: Record<string, unknown>) => {
        logger.pushLogEvent("user.mark", {
          label,
          ...(extra || {}),
        });
      },
      setEnabled: (value: boolean) => {
        logger.cfg.telemetryEnabledRef.value = !!value;
        logger.pushLogEvent("log.enabled", { value: logger.cfg.telemetryEnabledRef.value });
      },
      isEnabled: () => logger.cfg.telemetryEnabledRef.value,
      getLastFilePath: () => logger.lastRuntimeLogFilePath,
      flushToFile: () => logger.flushRuntimeLogsToFile(true),
      storageKey: LOG_STORAGE_KEY,
    };
  }

  // ── Dispose ────────────────────────────────────────────────────────────

  dispose(): void {
    this.pushLogEvent("session.dispose", {
      samples: this.runtimeLog.samples.length,
      events: this.runtimeLog.events.length,
    });
    this.persistRuntimeLogs();
    void this.flushRuntimeLogsToFile(true);
    delete (window as any).__slice3dLogs;
  }
}
