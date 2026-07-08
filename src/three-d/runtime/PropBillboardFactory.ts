import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
} from "@babylonjs/core";
import {
  getPropDef,
  pickPropAnimation,
  propFramePath,
} from "../../game/graphics/props/PropRegistry";
import {
  configureBillboardSpriteMaterial,
  configureBillboardSpriteMesh,
} from "./BillboardDepthConfig";
import {
  acquirePooledSpriteTexture,
  releasePooledSpriteTextures,
} from "./SpriteTexturePool";

export type PropAnimRoot = TransformNode & {
  _propAnimObserver: unknown;
  _setAnimIntervalScale: (scale: number) => void;
};

const KNOWN_PROP_IDS = new Set<string>(["oak_tree", "wild_flower"]);

/** Plane local Y so prop feet (opaque base row) sit on the ground plane. */
function getPropBillboardAnchorY(def: ReturnType<typeof getPropDef>): number {
  const worldH = def.size.height / 32;
  const canvasH = def.size.height;
  const feetY =
    def.feetY ?? Math.round(def.origin.y * Math.max(0, canvasH - 1));
  const feetFromBottom = (canvasH - feetY) / canvasH;
  return worldH * 0.5 - feetFromBottom * worldH;
}

export function isKnownPropId(propId: string): boolean {
  return KNOWN_PROP_IDS.has(propId);
}

/**
 * PixelLab prop billboard — south-facing sway loop, 2D parity sizing (32px = 1 tile).
 */
export function createPropBillboard(
  scene: Scene,
  propId: string,
  nodeName: string,
  tileX: number,
  tileZ: number,
): TransformNode | null {
  if (!isKnownPropId(propId)) {
    return null;
  }

  const def = getPropDef(propId);
  const animationName = pickPropAnimation(propId, tileX, tileZ);
  const animDef = def.animations[animationName];
  if (!animDef) {
    return null;
  }

  const frameUrls = Array.from({ length: animDef.frameCount }, (_, index) =>
    propFramePath(propId, animationName, def.direction, index),
  );

  const textures = frameUrls.map((url) =>
    acquirePooledSpriteTexture(scene, url),
  );

  if (textures.length === 0) {
    return null;
  }

  const root = new TransformNode(nodeName, scene);
  const worldW = def.size.width / 32;
  const worldH = def.size.height / 32;

  const mat = new StandardMaterial(`${nodeName}-mat`, scene);
  mat.backFaceCulling = false;
  mat.specularColor = Color3.Black();
  mat.useAlphaFromDiffuseTexture = true;
  mat.disableLighting = true;
  mat.emissiveColor = Color3.White();
  mat.diffuseTexture = textures[0];
  mat.opacityTexture = textures[0];
  configureBillboardSpriteMaterial(mat);

  const plane = MeshBuilder.CreatePlane(
    `${nodeName}-sprite`,
    { width: worldW, height: worldH },
    scene,
  );
  plane.material = mat;
  plane.parent = root;
  plane.position.y = getPropBillboardAnchorY(def);
  plane.billboardMode = Mesh.BILLBOARDMODE_Y;
  plane.isPickable = false;
  configureBillboardSpriteMesh(plane);

  let frame = 0;
  let lastFrameAt = 0;
  let animIntervalScale = 1;
  const frameIntervalMs = Math.max(16, Math.round(1000 / animDef.frameRate));

  const applyFrame = () => {
    const texture = textures[Math.min(frame, textures.length - 1)];
    mat.diffuseTexture = texture;
    mat.opacityTexture = texture;
  };

  textures[0].onLoadObservable.add(() => {
    applyFrame();
  });

  const animObserver = scene.onBeforeRenderObservable.add(() => {
    if (!root.isEnabled()) {
      return;
    }
    const now = Date.now();
    const interval = frameIntervalMs * animIntervalScale;
    if (now - lastFrameAt < interval) {
      return;
    }
    lastFrameAt = now;
    frame = (frame + 1) % textures.length;
    applyFrame();
  });
  (root as PropAnimRoot)._propAnimObserver = animObserver;
  (root as PropAnimRoot)._setAnimIntervalScale = (scale: number) => {
    animIntervalScale = Math.max(0.25, Math.min(4, scale));
  };

  mat.onDisposeObservable.add(() => {
    scene.onBeforeRenderObservable.remove(animObserver);
    releasePooledSpriteTextures(scene, frameUrls);
  });

  return root;
}
