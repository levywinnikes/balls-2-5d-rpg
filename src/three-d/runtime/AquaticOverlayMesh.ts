import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
} from "@babylonjs/core";
import {
  computeBillboardWaterLineUv,
  getAquaticVisualPreset,
} from "./AquaticVisualConfig";
import {
  configureBillboardOverlayMaterial,
  configureBillboardSpriteMesh,
} from "./BillboardDepthConfig";
import { DRY_AQUATIC_SAMPLE, type AquaticSample } from "./WaterProfile";

export type AquaticSpriteLayout = {
  width: number;
  height: number;
  anchorY: number;
};

export type AquaticOverlayHandle = {
  mesh: Mesh;
  update: (sample: AquaticSample) => void;
  dispose: () => void;
};

function drawOverlayGradient(
  texture: DynamicTexture,
  colorHex: string,
  alpha: number,
  waterLineUv: number,
) {
  const size = 64;
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, size, size);

  const r = parseInt(colorHex.slice(1, 3), 16);
  const g = parseInt(colorHex.slice(3, 5), 16);
  const b = parseInt(colorHex.slice(5, 7), 16);
  const lineY = Math.max(4, Math.round(size * (1 - waterLineUv)));

  const grad = ctx.createLinearGradient(0, size, 0, lineY);
  grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
  grad.addColorStop(0.7, `rgba(${r},${g},${b},${alpha * 0.35})`);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  texture.update(false);
}

export function attachAquaticOverlay(
  scene: Scene,
  parent: TransformNode,
  spriteMesh: Mesh,
  layout: AquaticSpriteLayout,
): AquaticOverlayHandle {
  const texture = new DynamicTexture(
    `${parent.name}-aquatic-overlay-tex`,
    { width: 64, height: 64 },
    scene,
    false,
  );
  texture.hasAlpha = true;
  texture.vScale = -1;

  const material = new StandardMaterial(`${parent.name}-aquatic-overlay-mat`, scene);
  material.diffuseTexture = texture;
  material.opacityTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.backFaceCulling = false;
  material.disableLighting = true;
  material.emissiveColor = Color3.White();
  material.specularColor = Color3.Black();
  material.alpha = 1;
  configureBillboardOverlayMaterial(material);

  const mesh = MeshBuilder.CreatePlane(
    `${parent.name}-aquatic-overlay`,
    { width: layout.width, height: layout.height },
    scene,
  );
  mesh.material = material;
  mesh.parent = parent;
  mesh.position.copyFrom(spriteMesh.position);
  mesh.billboardMode = Mesh.BILLBOARDMODE_Y;
  mesh.isPickable = false;
  configureBillboardSpriteMesh(mesh);
  mesh.setEnabled(false);

  let lastKey = "";

  const update = (sample: AquaticSample) => {
    if (sample.mode === "dry") {
      mesh.setEnabled(false);
      return;
    }

    const preset = getAquaticVisualPreset(sample.mode);
    if (!preset) {
      mesh.setEnabled(false);
      return;
    }

    const waterLineUv = computeBillboardWaterLineUv(sample);
    const overlayHeight = layout.height * waterLineUv;
    const spriteBottomY = layout.anchorY - layout.height * 0.5;
    const overlayCenterY = spriteBottomY + overlayHeight * 0.5;

    mesh.setEnabled(true);
    mesh.scaling.y = Math.max(0.12, waterLineUv);
    mesh.position.y = overlayCenterY;

    const key = `${sample.mode}:${waterLineUv.toFixed(2)}:${preset.overlayColor}:${preset.overlayAlpha}`;
    if (key !== lastKey) {
      drawOverlayGradient(
        texture,
        preset.overlayColor,
        preset.overlayAlpha,
        waterLineUv,
      );
      lastKey = key;
    }
  };

  update(DRY_AQUATIC_SAMPLE);

  return {
    mesh,
    update,
    dispose: () => {
      mesh.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
