import {
  computeStreamRadiiUnits,
  resolveQualityStreamConfig,
  type SliceQualityStreamConfig,
} from "./SliceQualityRuntime";
import type { StreamOrchestrator } from "./StreamOrchestrator";

export type QualityPreset = "low" | "mid" | "high";

export class QualitySystem {
  topDownDrawRadiusChunks!: number;
  firstPersonDrawRadiusChunks!: number;
  topDownChunkBuildBudgetPerTick!: number;
  firstPersonChunkBuildBudgetPerTick!: number;

  private CHUNK_SIZE: number;
  private currentConfig!: SliceQualityStreamConfig;
  private _orchestrator: StreamOrchestrator | null = null;

  constructor(config: { CHUNK_SIZE: number; initialPreset: QualityPreset }) {
    this.CHUNK_SIZE = config.CHUNK_SIZE;
    this.applyConfig(config.initialPreset);
  }

  set orchestrator(o: StreamOrchestrator | null) {
    this._orchestrator = o;
  }

  applyConfig(preset: QualityPreset): void {
    this.currentConfig = resolveQualityStreamConfig(preset);
    this.topDownDrawRadiusChunks = this.currentConfig.topDownDrawRadiusChunks;
    this.firstPersonDrawRadiusChunks = this.currentConfig.firstPersonDrawRadiusChunks;
    this.topDownChunkBuildBudgetPerTick = this.currentConfig.topDownChunkBuildBudgetPerTick;
    this.firstPersonChunkBuildBudgetPerTick = this.currentConfig.firstPersonChunkBuildBudgetPerTick;

    if (this._orchestrator) {
      const radii = computeStreamRadiiUnits(this.CHUNK_SIZE, this.currentConfig);
      this._orchestrator.setStreamRadii(radii);
    }
  }

  getStreamRadii(): ReturnType<typeof computeStreamRadiiUnits> {
    return computeStreamRadiiUnits(this.CHUNK_SIZE, this.currentConfig);
  }
}
