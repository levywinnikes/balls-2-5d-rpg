import { Engine, Scene, HemisphericLight } from "@babylonjs/core";
import type { QualitySystem } from "./QualitySystem";
import type { RenderSystem } from "./RenderSystem";

export function applyDisplaySettings(
  deps: {
    engine: Engine;
    qualitySystem: QualitySystem;
    hemiLight: HemisphericLight;
    scene: Scene;
    renderSystem: RenderSystem;
  },
  settings: { renderScale?: number; qualityPreset?: string },
): void {
  const { engine, qualitySystem, hemiLight, scene, renderSystem } = deps;
  const preset = settings.qualityPreset ?? "balanced";

  try {
    const scale = Math.max(0.5, Math.min(1.0, settings.renderScale || 1));
    engine.setHardwareScalingLevel(1 / scale);
  } catch (err) {
    console.warn("[3D] Failed to apply renderScale", err);
  }

  qualitySystem.applyConfig(preset as any);

  try {
    if (preset === "performance") {
      hemiLight.intensity = 0.7;
      scene.fogMode = Scene.FOGMODE_NONE;
    } else if (preset === "quality") {
      hemiLight.intensity = 1.2;
      scene.fogMode = Scene.FOGMODE_EXP;
      scene.fogDensity = 0.004;
    } else {
      hemiLight.intensity = 1.0;
      scene.fogMode = Scene.FOGMODE_EXP;
      scene.fogDensity = 0.006;
    }
  } catch (err) {
    console.warn("[3D] Failed to apply quality lighting/fog", err);
  }

  try {
    renderSystem.fpsTargetMinFrameMs = preset === "performance" ? 1000 / 30 : preset === "quality" ? 0 : 1000 / 60;
  } catch (err) {
    console.warn("[3D] Failed to apply FPS target", err);
  }
}
