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
  createEnemyParitySpriteMaterial,
  getGeneratedEnemyAnchorY,
  getGeneratedEnemyBillboardDimensions,
  resolveGeneratedSpriteEntityId,
  type GeneratedSpriteDirection,
} from "./TwoDParitySpriteFactory";
import { attachAquaticShaderTint } from "./AquaticSpriteShader";
import {
  configureBillboardSpriteMaterial,
  configureBillboardSpriteMesh,
} from "./BillboardDepthConfig";

export type EnemyVisualProfile = {
  baseColor: string;
  accentColor: string;
  radius: number;
  height: number;
  headScale: number;
  hasHorns?: boolean;
};

export type EnemyVisualAnimState = "idle" | "walk" | "attack" | "death";

const DEFAULT_PROFILE: EnemyVisualProfile = {
  baseColor: "#8b5a2b",
  accentColor: "#f2d1a8",
  radius: 0.35,
  height: 1.25,
  headScale: 0.62,
};

const PROFILE_BY_ENEMY_ID: Record<string, EnemyVisualProfile> = {
  rat: {
    baseColor: "#6b7280",
    accentColor: "#d1d5db",
    radius: 0.28,
    height: 0.655,
    headScale: 0.5,
  },
  bear: {
    baseColor: "#6b4423",
    accentColor: "#c4a574",
    radius: 0.46,
    height: 1.2,
    headScale: 0.55,
  },
  skeleton: {
    baseColor: "#d6d3d1",
    accentColor: "#f5f5f4",
    radius: 0.33,
    height: 1.09,
    headScale: 0.58,
  },
  goblin: {
    baseColor: "#3f8f44",
    accentColor: "#8bd38f",
    radius: 0.34,
    height: 1.09,
    headScale: 0.58,
  },
  goblin_lanceiro: {
    baseColor: "#3f8f44",
    accentColor: "#8bd38f",
    radius: 0.34,
    height: 1.09,
    headScale: 0.58,
  },
  orc: {
    baseColor: "#5f7c31",
    accentColor: "#a3be6f",
    radius: 0.41,
    height: 1.32,
    headScale: 0.62,
    hasHorns: true,
  },
  demon: {
    baseColor: "#7f1d1d",
    accentColor: "#dc2626",
    radius: 0.58,
    height: 1.775,
    headScale: 0.68,
    hasHorns: true,
  },
  dragon: {
    baseColor: "#8b1f1f",
    accentColor: "#f97316",
    radius: 0.74,
    height: 2.275,
    headScale: 0.75,
    hasHorns: true,
  },
  red_wizard: {
    baseColor: "#7f1d1d",
    accentColor: "#fca5a5",
    radius: 0.34,
    height: 1.25,
    headScale: 0.6,
  },
  god: {
    baseColor: "#e5e7eb",
    accentColor: "#fde68a",
    radius: 0.5,
    height: 1.9,
    headScale: 0.7,
  },
};

export function getEnemyVisualProfile(enemyId: string): EnemyVisualProfile {
  return PROFILE_BY_ENEMY_ID[enemyId] || DEFAULT_PROFILE;
}

function createTargetHeadMarkerMaterial(
  scene: Scene,
  key: string,
): StandardMaterial {
  const canvasSize = 64;
  const texture = new DynamicTexture(
    `${key}-target-marker-tex`,
    canvasSize,
    scene,
    false,
  );
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.fillStyle = "#fbbf24";
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(canvasSize * 0.12, canvasSize * 0.28);
  ctx.lineTo(canvasSize * 0.5, canvasSize * 0.78);
  ctx.lineTo(canvasSize * 0.88, canvasSize * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  texture.update();

  const material = new StandardMaterial(`${key}-target-marker-mat`, scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  material.opacityTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.emissiveColor = Color3.White();
  material.disableLighting = true;
  material.disableDepthWrite = true;
  configureBillboardSpriteMaterial(material);
  return material;
}

export function getEnemyTargetMarkerMesh(
  enemyRoot: TransformNode,
): Mesh | undefined {
  return enemyRoot
    .getChildMeshes()
    .find((mesh) => mesh.name.endsWith("-target-marker")) as Mesh | undefined;
}

export function createEnemyVisual(
  scene: Scene,
  enemyId: string,
  nodeName: string,
): TransformNode {
  const profile = getEnemyVisualProfile(enemyId);
  const root = new TransformNode(nodeName, scene);
  const generatedId = resolveGeneratedSpriteEntityId(enemyId);

  const spriteMat = createEnemyParitySpriteMaterial(
    scene,
    `${nodeName}-sprite`,
    enemyId,
  );
  const spriteAnimSetter = (spriteMat as any)._setAnimState;
  const spriteDirSetter = (spriteMat as any)._setDirection;
  if (typeof spriteAnimSetter === "function") {
    (root as any)._setAnimState = (
      state: EnemyVisualAnimState,
      restart?: boolean,
    ) => {
      spriteAnimSetter(state, restart);
    };
  }
  if (typeof spriteDirSetter === "function") {
    (root as any)._setDirection = (direction: GeneratedSpriteDirection) => {
      spriteDirSetter(direction);
    };
  }

  const generatedBillboard = generatedId
    ? getGeneratedEnemyBillboardDimensions(profile)
    : null;
  const spriteWidth = generatedBillboard
    ? generatedBillboard.width
    : Math.max(0.8, profile.radius * 3.2);
  const spriteHeight = generatedBillboard
    ? generatedBillboard.height
    : Math.max(1.0, profile.height * 1.35);
  const sprite = MeshBuilder.CreatePlane(
    `${nodeName}-sprite`,
    {
      width: spriteWidth,
      height: spriteHeight,
    },
    scene,
  );
  sprite.material = spriteMat;
  sprite.parent = root;
  const spriteAnchorY = generatedId
    ? getGeneratedEnemyAnchorY(generatedId, spriteHeight)
    : Math.max(0.45, profile.height * 0.55);
  sprite.position.y = spriteAnchorY;
  sprite.billboardMode = Mesh.BILLBOARDMODE_Y;
  configureBillboardSpriteMesh(sprite);

  (root as any)._aquaticTint = attachAquaticShaderTint(spriteMat);

  const shadowMat = new StandardMaterial(`${nodeName}-shadow-mat`, scene);
  shadowMat.diffuseColor = Color3.Black();
  shadowMat.specularColor = Color3.Black();
  shadowMat.alpha = 0.26;
  shadowMat.disableLighting = true;

  const groundShadow = MeshBuilder.CreateDisc(
    `${nodeName}-ground-shadow`,
    { radius: Math.max(0.2, profile.radius * 0.95), tessellation: 20 },
    scene,
  );
  groundShadow.material = shadowMat;
  groundShadow.parent = root;
  groundShadow.position.y = 0.02;
  groundShadow.rotation.x = Math.PI / 2;
  groundShadow.isPickable = false;

  const pickProxy = MeshBuilder.CreatePlane(
    `${nodeName}-pick-proxy`,
    {
      width: Math.max(1.2, profile.radius * 3.8),
      height: Math.max(1.15, profile.height * 1.55),
    },
    scene,
  );
  const pickProxyMat = new StandardMaterial(
    `${nodeName}-pick-proxy-mat`,
    scene,
  );
  pickProxyMat.alpha = 0;
  pickProxyMat.backFaceCulling = false;
  pickProxyMat.disableLighting = true;
  pickProxy.material = pickProxyMat;
  pickProxy.parent = root;
  pickProxy.position.y = Math.max(0.52, profile.height * 0.58);
  pickProxy.billboardMode = Mesh.BILLBOARDMODE_Y;
  pickProxy.isPickable = true;

  const markerWidth = Math.max(0.3, spriteWidth * 0.32);
  const markerHeight = markerWidth * 0.72;
  const headMarkerY = spriteAnchorY + spriteHeight * 0.5 + markerHeight * 0.15;
  const targetMarker = MeshBuilder.CreatePlane(
    `${nodeName}-target-marker`,
    { width: markerWidth, height: markerHeight },
    scene,
  );
  targetMarker.material = createTargetHeadMarkerMaterial(scene, nodeName);
  targetMarker.parent = root;
  targetMarker.position.y = headMarkerY;
  targetMarker.billboardMode = Mesh.BILLBOARDMODE_Y;
  targetMarker.renderingGroupId = 1;
  targetMarker.isPickable = false;
  targetMarker.setEnabled(false);
  targetMarker.metadata = { baseY: headMarkerY };

  return root;
}

export function getEnemySpriteMesh(
  enemyRoot: TransformNode,
): Mesh | undefined {
  return enemyRoot
    .getChildMeshes()
    .find((mesh) => mesh.name.endsWith("-sprite")) as Mesh | undefined;
}

export function getEnemySpriteMaterial(
  enemyRoot: TransformNode,
): StandardMaterial | null {
  const sprite = getEnemySpriteMesh(enemyRoot);
  return (sprite?.material as StandardMaterial | undefined) ?? null;
}

export function getEnemyGroundShadowMesh(
  enemyRoot: TransformNode,
): Mesh | undefined {
  return enemyRoot
    .getChildMeshes()
    .find((mesh) => mesh.name.endsWith("-ground-shadow")) as Mesh | undefined;
}

export function getEnemyGroundShadowMaterial(
  enemyRoot: TransformNode,
): StandardMaterial | null {
  const shadow = getEnemyGroundShadowMesh(enemyRoot);
  return (shadow?.material as StandardMaterial | undefined) ?? null;
}

/** Reset sprite tint, floor shadow, and head marker after target is cleared. */
export function restoreEnemyTargetVisual(enemyRoot: TransformNode): void {
  const spriteMat = getEnemySpriteMaterial(enemyRoot);
  if (spriteMat) {
    spriteMat.emissiveColor = new Color3(1, 1, 1);
  }

  const shadowMat = getEnemyGroundShadowMaterial(enemyRoot);
  if (shadowMat) {
    shadowMat.diffuseColor = Color3.Black();
    shadowMat.emissiveColor = Color3.Black();
    shadowMat.alpha = 0.26;
  }

  const shadow = getEnemyGroundShadowMesh(enemyRoot);
  if (shadow) {
    shadow.scaling.set(1, 1, 1);
  }

  const marker = getEnemyTargetMarkerMesh(enemyRoot);
  if (marker) {
    marker.setEnabled(false);
    const baseY = (marker.metadata as { baseY?: number } | undefined)?.baseY;
    if (baseY !== undefined) {
      marker.position.y = baseY;
    }
    marker.scaling.set(1, 1, 1);
    const markerMat = marker.material as StandardMaterial | undefined;
    if (markerMat) {
      markerMat.emissiveColor = Color3.White();
    }
  }
}

/** Target highlight: warm sprite tint + amber floor spot + chevron above head. */
export function applyEnemyTargetVisual(
  enemyRoot: TransformNode,
  pulse: number,
): void {
  const spriteMat = getEnemySpriteMaterial(enemyRoot);
  if (spriteMat) {
    spriteMat.emissiveColor = new Color3(1, 0.76 + pulse * 0.2, 0.66 + pulse * 0.16);
  }

  const shadowMat = getEnemyGroundShadowMaterial(enemyRoot);
  if (shadowMat) {
    shadowMat.diffuseColor = Color3.FromHexString("#d97706");
    shadowMat.emissiveColor = Color3.FromHexString("#fbbf24").scale(
      0.12 + pulse * 0.12,
    );
    shadowMat.alpha = 0.34 + pulse * 0.2;
  }

  const shadow = getEnemyGroundShadowMesh(enemyRoot);
  if (shadow) {
    const scale = 1.08 + pulse * 0.1;
    shadow.scaling.set(scale, scale, scale);
  }

  const marker = getEnemyTargetMarkerMesh(enemyRoot);
  if (marker) {
    marker.setEnabled(true);
    const baseY = (marker.metadata as { baseY?: number } | undefined)?.baseY;
    if (baseY !== undefined) {
      marker.position.y = baseY + pulse * 0.08;
    }
    const scale = 1 + pulse * 0.18;
    marker.scaling.set(scale, scale, scale);
    const markerMat = marker.material as StandardMaterial | undefined;
    if (markerMat) {
      markerMat.emissiveColor = new Color3(
        1,
        0.82 + pulse * 0.18,
        0.28 + pulse * 0.25,
      );
    }
  }
}

export function setEnemyVisualAnimState(
  enemyRoot: TransformNode,
  state: EnemyVisualAnimState,
  restart = false,
): void {
  const setter = (enemyRoot as any)._setAnimState;
  if (typeof setter === "function") {
    setter(state, restart);
  }
}

export function setEnemyVisualDirection(
  enemyRoot: TransformNode,
  direction: GeneratedSpriteDirection,
): void {
  const setter = (enemyRoot as any)._setDirection;
  if (typeof setter === "function") {
    setter(direction);
  }
}
