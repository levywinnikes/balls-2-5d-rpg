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
  type GeneratedSpriteMaterial,
} from "./TwoDParitySpriteFactory";
import { attachAquaticShaderTint, type AquaticShaderHandle } from "./AquaticSpriteShader";
import {
  resolveAnimLodIntervalScale,
  setSpriteAnimIntervalScale,
  setSpriteAnimPaused,
} from "./SpriteAnimLod";
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

type TargetMarkerMaterial = StandardMaterial & {
  _markerTexture: DynamicTexture;
  _markerLastRatio: number;
  _updateMarkerHealth: (ratio: number) => void;
};

export type EnemyVisualRoot = TransformNode & {
  _setAnimState?: (state: EnemyVisualAnimState, restart?: boolean) => void;
  _setDirection?: (direction: GeneratedSpriteDirection) => void;
  _aquaticTint?: AquaticShaderHandle | null;
};

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

const TARGET_MARKER_CANVAS = 64;

const TARGET_MARKER_TRIANGLE = {
  leftX: TARGET_MARKER_CANVAS * 0.12,
  rightX: TARGET_MARKER_CANVAS * 0.88,
  topY: TARGET_MARKER_CANVAS * 0.28,
  bottomY: TARGET_MARKER_CANVAS * 0.78,
  centerX: TARGET_MARKER_CANVAS * 0.5,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function mixChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function mixHexColor(from: string, to: string, t: number): string {
  const parse = (hex: string) => {
    const value = hex.replace("#", "");
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const u = clamp01(t);
  const r = mixChannel(r1, r2, u);
  const g = mixChannel(g1, g2, u);
  const b = mixChannel(b1, b2, u);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Full HP = green, mid = yellow, critical = red. */
export function targetMarkerHealthFillColor(ratio: number): string {
  const t = clamp01(ratio);
  if (t >= 0.55) {
    return mixHexColor("#eab308", "#22c55e", (t - 0.55) / 0.45);
  }
  if (t >= 0.25) {
    return mixHexColor("#ef4444", "#eab308", (t - 0.25) / 0.3);
  }
  return "#ef4444";
}

function traceTargetMarkerTriangle(ctx: CanvasRenderingContext2D): void {
  const { leftX, rightX, topY, bottomY, centerX } = TARGET_MARKER_TRIANGLE;
  ctx.beginPath();
  ctx.moveTo(leftX, topY);
  ctx.lineTo(centerX, bottomY);
  ctx.lineTo(rightX, topY);
  ctx.closePath();
}

function drawTargetMarkerTexture(
  ctx: CanvasRenderingContext2D,
  healthRatio: number,
): void {
  const size = TARGET_MARKER_CANVAS;
  const { topY, bottomY } = TARGET_MARKER_TRIANGLE;
  const ratio = clamp01(healthRatio);

  ctx.clearRect(0, 0, size, size);

  traceTargetMarkerTriangle(ctx);
  ctx.fillStyle = "rgba(24, 16, 10, 0.72)";
  ctx.fill();

  if (ratio > 0.001) {
    ctx.save();
    traceTargetMarkerTriangle(ctx);
    ctx.clip();
    const fillTop = bottomY - (bottomY - topY) * ratio;
    ctx.fillStyle = targetMarkerHealthFillColor(ratio);
    ctx.fillRect(0, fillTop, size, bottomY - fillTop + 1);
    ctx.restore();
  }

  traceTargetMarkerTriangle(ctx);
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 4;
  ctx.stroke();

  traceTargetMarkerTriangle(ctx);
  ctx.strokeStyle = "rgba(251, 191, 36, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function createTargetHeadMarkerMaterial(
  scene: Scene,
  key: string,
): StandardMaterial {
  const canvasSize = TARGET_MARKER_CANVAS;
  const texture = new DynamicTexture(
    `${key}-target-marker-tex`,
    canvasSize,
    scene,
    false,
  );
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  drawTargetMarkerTexture(ctx, 1);
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

  (material as TargetMarkerMaterial)._markerTexture = texture;
  (material as TargetMarkerMaterial)._markerLastRatio = 1;
  (material as TargetMarkerMaterial)._updateMarkerHealth = (ratio: number) => {
    const clamped = clamp01(ratio);
    const last = (material as TargetMarkerMaterial)._markerLastRatio;
    if (Math.abs(last - clamped) < 0.004) {
      return;
    }
    (material as TargetMarkerMaterial)._markerLastRatio = clamped;
    drawTargetMarkerTexture(ctx, clamped);
    texture.update();
  };

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
  const spriteAnimSetter = (spriteMat as GeneratedSpriteMaterial)._setAnimState;
  const spriteDirSetter = (spriteMat as GeneratedSpriteMaterial)._setDirection;
  if (typeof spriteAnimSetter === "function") {
    (root as EnemyVisualRoot)._setAnimState = (
      state: EnemyVisualAnimState,
      restart?: boolean,
    ) => {
      spriteAnimSetter(state, restart);
    };
  }
  if (typeof spriteDirSetter === "function") {
    (root as EnemyVisualRoot)._setDirection = (direction: GeneratedSpriteDirection) => {
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

  (root as EnemyVisualRoot)._aquaticTint = attachAquaticShaderTint(spriteMat);

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
      const updater = (markerMat as TargetMarkerMaterial)._updateMarkerHealth;
      if (typeof updater === "function") {
        updater(1);
      }
    }
  }
}

export type EnemyTargetHealth = {
  current: number;
  max: number;
};

/** Target highlight: warm sprite tint + amber floor spot + HP chevron above head. */
export function applyEnemyTargetVisual(
  enemyRoot: TransformNode,
  pulse: number,
  health?: EnemyTargetHealth,
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
      markerMat.emissiveColor = Color3.White();
      const updater = (markerMat as TargetMarkerMaterial)._updateMarkerHealth;
      if (typeof updater === "function") {
        const max = Math.max(1, health?.max ?? 1);
        const current = Math.max(0, health?.current ?? max);
        updater(current / max);
      }
    }
  }
}

export function setEnemyVisualAnimState(
  enemyRoot: TransformNode,
  state: EnemyVisualAnimState,
  restart = false,
): void {
  const setter = (enemyRoot as EnemyVisualRoot)._setAnimState;
  if (typeof setter === "function") {
    setter(state, restart);
  }
}

export function setEnemyVisualDirection(
  enemyRoot: TransformNode,
  direction: GeneratedSpriteDirection,
): void {
  const setter = (enemyRoot as EnemyVisualRoot)._setDirection;
  if (typeof setter === "function") {
    setter(direction);
  }
}

export function applyEnemyAnimLod(
  enemyRoot: TransformNode,
  distanceUnits: number,
  visible: boolean,
  nearRadius = 14,
  midRadius = 22,
): void {
  const mat = getEnemySpriteMaterial(enemyRoot);
  setSpriteAnimPaused(mat, !visible);
  if (!visible) {
    return;
  }
  setSpriteAnimIntervalScale(
    mat,
    resolveAnimLodIntervalScale(distanceUnits, nearRadius, midRadius),
  );
}
