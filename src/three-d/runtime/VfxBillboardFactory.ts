import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import {
  getVfxDef,
  vfxFramePath,
} from "../../game/graphics/vfx/VfxRegistry";
import {
  configureBillboardSpriteMaterial,
  configureBillboardSpriteMesh,
} from "./BillboardDepthConfig";

function getVfxBillboardAnchorY(def: ReturnType<typeof getVfxDef>): number {
  const worldH = def.size.height / 32;
  const feetFromBottom = (def.size.height - def.feetY) / def.size.height;
  return worldH * 0.5 - feetFromBottom * worldH;
}

function createProceduralRespawnGlow(
  scene: Scene,
  nodeName: string,
  frameCount: number,
  frameRate: number,
): {
  root: TransformNode;
  play: (onComplete?: () => void) => void;
  dispose: () => void;
} {
  const root = new TransformNode(nodeName, scene);
  const worldW = 48 / 32;
  const worldH = 48 / 32;

  const textures: DynamicTexture[] = [];
  for (let i = 0; i < frameCount; i += 1) {
    const t =  i / Math.max(1, frameCount - 1);
    const pulse = Math.sin(t * Math.PI);
    const size = 48;
    const tex = new DynamicTexture(
      `${nodeName}-proc-${i}`,
      { width: size, height: size },
      scene,
      false,
    );
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;
    const outer = 6 + pulse * 14;
    const inner = 2 + pulse * 6;
    const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
    grad.addColorStop(0, `rgba(186, 230, 253, ${0.35 + pulse * 0.55})`);
    grad.addColorStop(0.45, `rgba(56, 189, 248, ${0.25 + pulse * 0.45})`);
    grad.addColorStop(1, "rgba(14, 116, 214, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, outer, 0, Math.PI * 2);
    ctx.fill();
    for (let s = 0; s < 6; s += 1) {
      const angle = (s / 6) * Math.PI * 2 + t * Math.PI * 2;
      const dist = 4 + pulse * 10;
      const sx = cx + Math.cos(angle) * dist;
      const sy = cy + Math.sin(angle) * dist * 0.55;
      ctx.fillStyle = `rgba(224, 242, 254, ${0.4 + pulse * 0.5})`;
      ctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 2);
    }
    tex.update();
    textures.push(tex);
  }

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
  plane.position.y = getVfxBillboardAnchorY(getVfxDef("respawn_glow"));
  plane.billboardMode = Mesh.BILLBOARDMODE_Y;
  plane.isPickable = false;
  configureBillboardSpriteMesh(plane);

  let observer: { remove: () => void } | null = null;

  const dispose = () => {
    observer?.remove();
    observer = null;
    plane.dispose();
    mat.dispose();
    textures.forEach((texture) => texture.dispose());
    root.dispose();
  };

  const play = (onComplete?: () => void) => {
    let frame = 0;
    let lastFrameAt = 0;
    const frameIntervalMs = Math.max(16, Math.round(1000 / frameRate));

    observer?.remove();
    observer = scene.onBeforeRenderObservable.add(() => {
      const now = Date.now();
      if (now - lastFrameAt < frameIntervalMs) {
        return;
      }
      lastFrameAt = now;
      mat.diffuseTexture = textures[frame];
      mat.opacityTexture = textures[frame];
      frame += 1;
      if (frame >= textures.length) {
        observer?.remove();
        observer = null;
        onComplete?.();
        dispose();
      }
    });
  };

  return { root, play, dispose };
}

export type RespawnGlowPlayback = {
  root: TransformNode;
  play: (onComplete?: () => void) => void;
  dispose: () => void;
};

/**
 * One-shot blue respawn burst at world position. Uses PixelLab frames when present;
 * falls back to a procedural cyan glow.
 */
export function createRespawnGlowVfx(
  scene: Scene,
  nodeName: string,
): RespawnGlowPlayback {
  const vfxId = "respawn_glow";
  const def = getVfxDef(vfxId);
  const animName = "respawn_burst";
  const animDef = def.animations[animName];
  const frameUrls = Array.from({ length: animDef.frameCount }, (_, index) =>
    vfxFramePath(vfxId, animName, def.direction, index),
  );

  const textures = frameUrls.map(
    (url) =>
      new Texture(url, scene, false, true, Texture.NEAREST_NEAREST),
  );
  textures.forEach((texture) => {
    texture.hasAlpha = true;
  });

  let usingProcedural = false;
  let procedural: ReturnType<typeof createProceduralRespawnGlow> | null = null;
  let observer: { remove: () => void } | null = null;
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
  plane.position.y = getVfxBillboardAnchorY(def);
  plane.billboardMode = Mesh.BILLBOARDMODE_Y;
  plane.isPickable = false;
  configureBillboardSpriteMesh(plane);

  const disposeSprite = () => {
    observer?.remove();
    observer = null;
    plane.dispose();
    mat.dispose();
    textures.forEach((texture) => texture.dispose());
    procedural?.dispose();
    root.dispose();
  };

  const playSprite = (onComplete?: () => void) => {
    const readyFrames = textures.filter((texture) => texture.isReady());
    if (readyFrames.length === 0) {
      const savedPos = root.position.clone();
      root.dispose();
      procedural = createProceduralRespawnGlow(
        scene,
        `${nodeName}-fallback`,
        animDef.frameCount,
        animDef.frameRate,
      );
      usingProcedural = true;
      procedural.root.position = savedPos;
      procedural.play(onComplete);
      return;
    }

    let frame = 0;
    let lastFrameAt = 0;
    const frameIntervalMs = Math.max(16, Math.round(1000 / animDef.frameRate));

    observer?.remove();
    observer = scene.onBeforeRenderObservable.add(() => {
      const now = Date.now();
      if (now - lastFrameAt < frameIntervalMs) {
        return;
      }
      lastFrameAt = now;
      const texture = textures[Math.min(frame, textures.length - 1)];
      mat.diffuseTexture = texture;
      mat.opacityTexture = texture;
      frame += 1;
      if (frame >= textures.length) {
        observer?.remove();
        observer = null;
        onComplete?.();
        disposeSprite();
      }
    });
  };

  return {
    root,
    play: playSprite,
    dispose: () => {
      if (!usingProcedural) {
        disposeSprite();
      } else {
        procedural?.dispose();
      }
    },
  };
}

export function preloadRespawnGlowTextures(scene: Scene): void {
  const def = getVfxDef("respawn_glow");
  const anim = def.animations.respawn_burst;
  for (let i = 0; i < anim.frameCount; i += 1) {
    const texture = new Texture(
      vfxFramePath("respawn_glow", "respawn_burst", def.direction, i),
      scene,
      false,
      true,
      Texture.NEAREST_NEAREST,
    );
    texture.hasAlpha = true;
  }
}

export function playRespawnGlowAt(
  scene: Scene,
  worldPos: Vector3,
  level: string,
  onComplete?: () => void,
): void {
  const vfx = createRespawnGlowVfx(
    scene,
    `respawn-glow-${Date.now().toString(36)}`,
  );
  vfx.root.position = worldPos.clone();
  // Show VFX regardless of level — it's positioned at worldPos and visible briefly
  vfx.root.setEnabled(true);
  vfx.play(onComplete);
}
