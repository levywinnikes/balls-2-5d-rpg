import {
  Color3,
  Material,
  MaterialDefines,
  type AbstractMesh,
  type Scene,
  type StandardMaterial,
  type SubMesh,
  type UniformBuffer,
} from "@babylonjs/core";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import {
  computeBillboardWaterLineUv,
  getAquaticVisualPreset,
} from "./AquaticVisualConfig";
import { DRY_AQUATIC_SAMPLE, type AquaticSample } from "./WaterProfile";

const PLUGIN_NAME = "AquaticTint";

class AquaticTintPlugin extends MaterialPluginBase {
  private waterLine = 0;

  private tintColor = Color3.Black();

  private tintStrength = 0;

  private active = false;

  constructor(material: Material) {
    super(material, PLUGIN_NAME, 220, { AQUATIC_TINT: false });
  }

  isCompatible(): boolean {
    return true;
  }

  getClassName(): string {
    return "AquaticTintPlugin";
  }

  prepareDefines(
    defines: MaterialDefines,
    _scene: Scene,
    _mesh?: AbstractMesh,
  ): void {
    defines.AQUATIC_TINT = this.active;
  }

  getUniforms() {
    return {
      ubo: [
        { name: "aquaticWaterLine", size: 1, type: "float" },
        { name: "aquaticTintStrength", size: 1, type: "float" },
        { name: "aquaticTintColor", size: 3, type: "vec3" },
      ],
    };
  }

  getCustomCode(shaderType: string) {
    if (shaderType !== "fragment") {
      return null;
    }

    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `
#ifdef AQUATIC_TINT
varying vec2 vDiffuseUV;
#endif
`,
      CUSTOM_FRAGMENT_MAIN_END: `
#ifdef AQUATIC_TINT
  float submerged = 1.0 - smoothstep(aquaticWaterLine - 0.04, aquaticWaterLine + 0.07, vDiffuseUV.y);
  submerged = clamp(submerged, 0.0, 1.0) * aquaticTintStrength;
  color.rgb = mix(color.rgb, aquaticTintColor, submerged * 0.72);
#endif
`,
    };
  }

  bindForSubMesh(
    uniformBuffer: UniformBuffer,
    _scene: Scene,
    _engine: unknown,
    _subMesh: SubMesh,
  ): void {
    uniformBuffer.updateFloat("aquaticWaterLine", this.waterLine);
    uniformBuffer.updateFloat("aquaticTintStrength", this.tintStrength);
    uniformBuffer.updateColor3("aquaticTintColor", this.tintColor);
  }

  getSamplers() {
    return [];
  }

  setAquaticState(sample: AquaticSample): void {
    if (sample.mode === "dry") {
      this.active = false;
      this.waterLine = 0;
      this.tintStrength = 0;
      this.markAllDefinesAsDirty();
      return;
    }

    const preset = getAquaticVisualPreset(sample.mode);
    if (!preset) {
      this.active = false;
      this.tintStrength = 0;
      this.markAllDefinesAsDirty();
      return;
    }

    this.active = true;
    this.waterLine = computeBillboardWaterLineUv(sample);
    this.tintStrength = preset.overlayAlpha;
    this.tintColor = Color3.FromHexString(preset.overlayColor);
    this.markAllDefinesAsDirty();
  }

  dispose(): void {
    this.active = false;
    super.dispose();
  }
}

export type AquaticShaderHandle = {
  update: (sample: AquaticSample) => void;
  dispose: () => void;
};

const pluginByMaterial = new WeakMap<StandardMaterial, AquaticTintPlugin>();

export function attachAquaticShaderTint(
  material: StandardMaterial,
): AquaticShaderHandle {
  let plugin = pluginByMaterial.get(material);
  if (!plugin) {
    plugin = new AquaticTintPlugin(material);
    pluginByMaterial.set(material, plugin);
  }

  const boundPlugin = plugin;

  return {
    update(sample: AquaticSample) {
      boundPlugin.setAquaticState(sample);
    },
    dispose() {
      boundPlugin.setAquaticState(DRY_AQUATIC_SAMPLE);
      boundPlugin.dispose();
      pluginByMaterial.delete(material);
    },
  };
}
