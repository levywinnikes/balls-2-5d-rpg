import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
} from "@babylonjs/core";
import { createEnemyParitySpriteMaterial } from "./TwoDParitySpriteFactory";

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
    radius: 0.24,
    height: 0.65,
    headScale: 0.5,
  },
  skeleton: {
    baseColor: "#d6d3d1",
    accentColor: "#f5f5f4",
    radius: 0.33,
    height: 1.2,
    headScale: 0.58,
  },
  goblin: {
    baseColor: "#3f8f44",
    accentColor: "#8bd38f",
    radius: 0.34,
    height: 1.2,
    headScale: 0.58,
  },
  goblin_lanceiro: {
    baseColor: "#3f8f44",
    accentColor: "#8bd38f",
    radius: 0.34,
    height: 1.2,
    headScale: 0.58,
  },
  orc: {
    baseColor: "#5f7c31",
    accentColor: "#a3be6f",
    radius: 0.41,
    height: 1.45,
    headScale: 0.62,
    hasHorns: true,
  },
  demon: {
    baseColor: "#7f1d1d",
    accentColor: "#dc2626",
    radius: 0.52,
    height: 1.75,
    headScale: 0.66,
    hasHorns: true,
  },
  dragon: {
    baseColor: "#8b1f1f",
    accentColor: "#f97316",
    radius: 0.62,
    height: 2.1,
    headScale: 0.75,
    hasHorns: true,
  },
  red_wizard: {
    baseColor: "#7f1d1d",
    accentColor: "#fca5a5",
    radius: 0.34,
    height: 1.35,
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

function createLitMaterial(
  scene: Scene,
  name: string,
  hexColor: string,
): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = Color3.FromHexString(hexColor);
  material.specularColor = new Color3(0.06, 0.06, 0.06);
  return material;
}

export function getEnemyVisualProfile(enemyId: string): EnemyVisualProfile {
  return PROFILE_BY_ENEMY_ID[enemyId] || DEFAULT_PROFILE;
}

export function createEnemyVisual(
  scene: Scene,
  enemyId: string,
  nodeName: string,
): TransformNode {
  const profile = getEnemyVisualProfile(enemyId);
  const root = new TransformNode(nodeName, scene);

  const spriteMat = createEnemyParitySpriteMaterial(
    scene,
    `${nodeName}-sprite`,
    enemyId,
  );
  const spriteAnimSetter = (spriteMat as any)._setAnimState;
  if (typeof spriteAnimSetter === "function") {
    (root as any)._setAnimState = (state: EnemyVisualAnimState) => {
      spriteAnimSetter(state);
    };
  }

  const sprite = MeshBuilder.CreatePlane(
    `${nodeName}-sprite`,
    {
      width: Math.max(0.8, profile.radius * 3.2),
      height: Math.max(1.0, profile.height * 1.35),
    },
    scene,
  );
  sprite.material = spriteMat;
  sprite.parent = root;
  sprite.position.y = Math.max(0.45, profile.height * 0.55);
  sprite.billboardMode = Mesh.BILLBOARDMODE_Y;

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

  const selectionRingMat = new StandardMaterial(
    `${nodeName}-selection-ring-mat`,
    scene,
  );
  selectionRingMat.diffuseColor = Color3.FromHexString("#ffd54a");
  selectionRingMat.emissiveColor = Color3.FromHexString("#f59e0b").scale(0.5);
  selectionRingMat.specularColor = Color3.Black();
  selectionRingMat.alpha = 0.95;

  const selectionRing = MeshBuilder.CreateTorus(
    `${nodeName}-selection-ring`,
    {
      diameter: Math.max(0.6, profile.radius * 2.9),
      thickness: 0.05,
      tessellation: 24,
    },
    scene,
  );
  selectionRing.material = selectionRingMat;
  selectionRing.parent = root;
  selectionRing.position.y = 0.04;
  selectionRing.rotation.x = Math.PI / 2;
  selectionRing.isPickable = false;
  selectionRing.setEnabled(false);

  const pickProxy = MeshBuilder.CreatePlane(
    `${nodeName}-pick-proxy`,
    {
      width: Math.max(1.2, profile.radius * 3.8),
      height: Math.max(1.15, profile.height * 1.55),
    },
    scene,
  );
  const pickProxyMat = new StandardMaterial(`${nodeName}-pick-proxy-mat`, scene);
  pickProxyMat.alpha = 0;
  pickProxyMat.backFaceCulling = false;
  pickProxyMat.disableLighting = true;
  pickProxy.material = pickProxyMat;
  pickProxy.parent = root;
  pickProxy.position.y = Math.max(0.52, profile.height * 0.58);
  pickProxy.billboardMode = Mesh.BILLBOARDMODE_Y;
  pickProxy.isPickable = true;

  const markerMat = createLitMaterial(
    scene,
    `${nodeName}-marker-mat`,
    profile.accentColor,
  );
  const marker = MeshBuilder.CreateCylinder(
    `${nodeName}-marker`,
    {
      diameterTop: Math.max(0.08, profile.radius * 0.4),
      diameterBottom: Math.max(0.08, profile.radius * 0.4),
      height: 0.06,
      tessellation: 8,
    },
    scene,
  );
  marker.material = markerMat;
  marker.parent = root;
  marker.position.y = 0.03;

  return root;
}

export function setEnemyVisualAnimState(
  enemyRoot: TransformNode,
  state: EnemyVisualAnimState,
): void {
  const setter = (enemyRoot as any)._setAnimState;
  if (typeof setter === "function") {
    setter(state);
  }
}
