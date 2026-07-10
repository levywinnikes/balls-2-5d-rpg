import type { Engine, Scene } from "@babylonjs/core";

export type SliceRuntime = {
  engine: Engine;
  scene: Scene;
  save: () => Promise<boolean>;
  whenWorldReady: () => Promise<void>;
  dispose: () => void;
};

export type Slice3DLogSample = {
  ts: number;
  elapsedSec: number;
  currentLevel: string;
  player: {
    x: number;
    y: number;
    z: number;
    tileX: number;
    tileZ: number;
    chunkX: number;
    chunkZ: number;
  };
  perf: {
    fps: number;
    frameMs: number;
    drawCalls: number;
    activeMeshes: number;
    totalMeshes: number;
    totalTextures: number;
    totalVertices: number;
    jsHeapUsedMb?: number;
    jsHeapTotalMb?: number;
    heapDeltaMb?: number;
  };
  chunks: {
    loaded: number;
    loading: number;
    pendingCandidates: number;
    pendingUnloads: number;
    builtThisTick: number;
    unloadedThisTick: number;
  };
  enemies: {
    activeOnLevel: number;
    visibleOnLevel: number;
    aiActiveOnLevel: number;
    selectedEnemyUid: string | null;
  };
  items: {
    streamedDroppedItems: number;
    hasRealDroppedItems: boolean;
  };
  pathfinding: {
    requests: number;
    success: number;
    failed: number;
    errors: number;
    inFlight: number;
    avgMs: number;
    maxMs: number;
    lastMs: number;
    lastPathLen: number;
  };
};

export type Slice3DLogEvent = {
  ts: number;
  elapsedSec: number;
  type: string;
  payload?: Record<string, unknown>;
};

export type Slice3DSessionLog = {
  version: 1;
  mapName: string;
  startedAt: string;
  sessionId: string;
  samples: Slice3DLogSample[];
  events: Slice3DLogEvent[];
  counters: {
    samplesDropped: number;
    eventsDropped: number;
    exportCount: number;
  };
};

export type Slice3DHotspot = {
  key: string;
  level: string;
  chunkX: number;
  chunkZ: number;
  samples: number;
  avgFrameMs: number;
  avgDrawCalls: number;
  avgActiveMeshes: number;
  avgVertices: number;
  maxHeapUsedMb: number;
  maxPathMs: number;
  score: number;
};

export type Slice3DSummary = {
  sampleCount: number;
  eventCount: number;
  uptimeSec: number;
  frameMs: {
    p50: number;
    p95: number;
    p99: number;
  };
  pathMs: {
    p50: number;
    p95: number;
    p99: number;
  };
  heap: {
    currentMb?: number;
    slopeMbPerSec?: number;
    unloadRecoveryFailures: number;
  };
  chunk: {
    avgPendingCandidates: number;
    avgPendingUnloads: number;
  };
  leakRisk: {
    level: "low" | "medium" | "high";
    reasons: string[];
  };
  sessionHealthScore: number;
};

declare global {
  interface Window {
    __slice3dLogs?: {
      get: () => unknown;
      getSummary: () => unknown;
      getHotspots: (limit: number) => unknown;
      download: () => void;
      clear: () => void;
      mark: (label: string, extra?: Record<string, unknown>) => void;
      setEnabled: (value: boolean) => void;
      isEnabled: () => boolean;
      getLastFilePath: () => string | null;
      flushToFile: () => Promise<void>;
      storageKey: string;
    };
    __slice3dVerticalVisibility?: {
      currentLevel: string;
      visibleLevels: string[];
      occludedFromLevel: number | null;
      occlusionScanRadius: number;
      verticalStackRadiusTiles: number;
      firstPersonCeilingLevel: string | null;
      totalLevels: number;
      columnRadius: number;
      playerTile: { x: number; y: number };
      ts: number;
    };
    __slice3dChunkStreaming?: {
      playerChunk?: { x: number; y: number };
      loadedChunks?: number;
      loadingChunks?: number;
      builtThisTick?: number;
      drawRadiusChunks?: number;
      chunkBuildBudgetPerTick?: number;
      firstPersonLod?: boolean;
      pendingCandidates?: number;
      unloadedThisTick?: number;
      pendingUnloads?: number;
      visibleLevels?: string[];
      ts?: number;
    };
    __slice3dPerfDiagnostics?: Record<string, unknown>;
    __slice3dPerf?: Record<string, unknown>;
    __slice3dLogsData?: { latestSample: unknown; totalSamples: number; totalEvents: number; counters: unknown; summary: unknown; topHotspots: unknown };
  }
  interface Performance {
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    };
  }
}

export type TopDownCameraPreset = "safe" | "cinematic";
