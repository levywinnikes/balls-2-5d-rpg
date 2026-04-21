import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
} from "@babylonjs/core";

export type EnemyVisualProfile = {
  baseColor: string;
  accentColor: string;
  radius: number;
  height: number;
  headScale: number;
  hasHorns?: boolean;
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

const BILLBOARD_SPRITE_BY_ENEMY_ID: Record<string, string> = {
  rat: "/assets/enemies/rat.png",
  orc: "/assets/enemies/orc.png",
  dragon: "/assets/enemies/dragon.png",
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

  const spritePath = BILLBOARD_SPRITE_BY_ENEMY_ID[enemyId];
  if (spritePath) {
    const spriteMat = new StandardMaterial(`${nodeName}-sprite-mat`, scene);
    const spriteTex = new Texture(spritePath, scene, true, false);
    spriteTex.hasAlpha = true;
    spriteTex.updateSamplingMode(Texture.NEAREST_NEAREST);
    spriteMat.diffuseTexture = spriteTex;
    spriteMat.opacityTexture = spriteTex;
    spriteMat.useAlphaFromDiffuseTexture = true;
    spriteMat.backFaceCulling = false;
    spriteMat.specularColor = Color3.Black();

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

  const bodyMaterial = createLitMaterial(
    scene,
    `${nodeName}-body-mat`,
    profile.baseColor,
  );
  const accentMaterial = createLitMaterial(
    scene,
    `${nodeName}-accent-mat`,
    profile.accentColor,
  );

  const body = MeshBuilder.CreateCapsule(
    `${nodeName}-body`,
    {
      radius: profile.radius,
      height: profile.height,
      tessellation: 8,
    },
    scene,
  );
  body.material = bodyMaterial;
  body.parent = root;
  body.position.y = profile.height * 0.5;

  const head = MeshBuilder.CreateSphere(
    `${nodeName}-head`,
    {
      diameter: Math.max(0.28, profile.radius * 2 * profile.headScale),
      segments: 10,
    },
    scene,
  );
  head.material = accentMaterial;
  head.parent = root;
  head.position.y = profile.height + profile.radius * 0.28;

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
  marker.material = accentMaterial;
  marker.parent = root;
  marker.position.y = 0.03;

  if (profile.hasHorns) {
    const leftHorn = MeshBuilder.CreateCylinder(
      `${nodeName}-horn-left`,
      { diameterTop: 0.01, diameterBottom: 0.1, height: 0.24, tessellation: 6 },
      scene,
    );
    leftHorn.material = bodyMaterial;
    leftHorn.parent = root;
    leftHorn.position = new Vector3(
      -profile.radius * 0.46,
      profile.height + 0.05,
      0.06,
    );
    leftHorn.rotation.z = Math.PI / 5;

    const rightHorn = leftHorn.clone(`${nodeName}-horn-right`) as Mesh;
    rightHorn.parent = root;
    rightHorn.position.x = profile.radius * 0.46;
    rightHorn.rotation.z = -Math.PI / 5;
  }

  return root;
}
