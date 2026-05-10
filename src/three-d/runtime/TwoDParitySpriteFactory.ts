import {
  DynamicTexture,
  Scene,
  StandardMaterial,
  Texture,
  Color3,
} from "@babylonjs/core";

// Entities that have pre-generated PNG sprites under public/assets/sprites/generated/{id}/
const GENERATED_SPRITE_ENTITIES = new Set<string>(["goblin_lanceiro"]);

type GeneratedAnimDef = {
  state: "idle" | "walk" | "attack" | "death";
  direction: "south" | "north" | "east" | "west";
  frameCount: number;
};

const GENERATED_ANIM_DEFS: Record<string, GeneratedAnimDef[]> = {
  goblin_lanceiro: [
    { state: "idle", direction: "south", frameCount: 4 },
    { state: "walk", direction: "south", frameCount: 4 },
    { state: "attack", direction: "south", frameCount: 3 },
    { state: "death", direction: "south", frameCount: 9 },
  ],
};

const FPS_GENERATED = 8;

function buildGeneratedFrameUrls(
  entityId: string,
  anim: GeneratedAnimDef,
): string[] {
  const base = `/assets/sprites/generated/${entityId}/${anim.state}_${anim.direction}`;
  return Array.from(
    { length: anim.frameCount },
    (_, i) => `${base}/frame_${String(i).padStart(2, "0")}.png`,
  );
}

/**
 * Creates a StandardMaterial that animates through PNG sprite frames.
 * For generated-sprite entities (e.g. goblin_lanceiro). Starts with idle animation.
 * The caller can update `mesh.metadata.animState` ("idle"|"walk"|"attack"|"death")
 * and this function's observer will swap frames accordingly.
 */
export function createGeneratedSpriteAnimatedMaterial(
  scene: Scene,
  keyPrefix: string,
  entityId: string,
): StandardMaterial {
  const animDefs =
    GENERATED_ANIM_DEFS[entityId] ?? GENERATED_ANIM_DEFS["goblin_lanceiro"];
  const interval = 1000 / FPS_GENERATED;

  // Pre-load all textures grouped by state
  const textureMap = new Map<string, Texture[]>();
  for (const def of animDefs) {
    const urls = buildGeneratedFrameUrls(entityId, def);
    const textures = urls.map((url) => {
      const t = new Texture(url, scene, false, true, Texture.NEAREST_NEAREST);
      t.hasAlpha = true;
      return t;
    });
    textureMap.set(def.state, textures);
  }

  const idleFrames = textureMap.get("idle") ?? textureMap.values().next().value;

  const mat = new StandardMaterial(`${keyPrefix}-mat`, scene);
  mat.backFaceCulling = false;
  mat.specularColor = Color3.Black();
  mat.useAlphaFromDiffuseTexture = true;
  mat.diffuseTexture = idleFrames[0];
  mat.opacityTexture = idleFrames[0];

  let currentState = "idle";
  let frame = 0;
  let lastFrameAt = 0;

  const obs = scene.onBeforeRenderObservable.add(() => {
    const now = Date.now();
    if (now - lastFrameAt < interval) return;
    lastFrameAt = now;

    const frames = textureMap.get(currentState) ?? idleFrames;
    frame = (frame + 1) % frames.length;
    mat.diffuseTexture = frames[frame];
    mat.opacityTexture = frames[frame];
  });

  // Expose state setter on metadata so external code can drive animation
  (mat as any)._setAnimState = (state: string) => {
    if (state !== currentState) {
      currentState = state;
      frame = 0;
      lastFrameAt = 0;
    }
  };

  mat.onDisposeObservable.add(() => {
    scene.onBeforeRenderObservable.remove(obs);
    textureMap.forEach((frames) => frames.forEach((t) => t.dispose()));
  });

  return mat;
}

type EnemySpriteId =
  | "rat"
  | "skeleton"
  | "goblin"
  | "orc"
  | "demon"
  | "dragon"
  | "god"
  | "red_wizard";

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function createSpriteMaterialFromDraw(
  scene: Scene,
  materialName: string,
  textureName: string,
  size: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): StandardMaterial {
  const texture = new DynamicTexture(
    textureName,
    { width: size, height: size },
    scene,
    false,
  );
  texture.hasAlpha = true;
  // Babylon's dynamic texture UV origin differs from canvas; flip vertically.
  texture.vScale = -1;
  texture.updateSamplingMode(Texture.NEAREST_NEAREST);

  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, size, size);
  draw(ctx);
  texture.update(false);

  const material = new StandardMaterial(materialName, scene);
  material.diffuseTexture = texture;
  material.opacityTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.backFaceCulling = false;
  material.specularColor = Color3.Black();
  material.disableLighting = true;
  material.emissiveColor = Color3.White();
  return material;
}

function normalizeEnemyId(enemyId: string): EnemySpriteId {
  if (enemyId.includes("red_wizard") || enemyId.includes("wizard")) {
    return "red_wizard";
  }
  if (enemyId.includes("dragon")) {
    return "dragon";
  }
  if (enemyId.includes("demon")) {
    return "demon";
  }
  if (enemyId.includes("skeleton")) {
    return "skeleton";
  }
  if (enemyId.includes("rat")) {
    return "rat";
  }
  if (enemyId.includes("goblin")) {
    return "goblin";
  }
  if (enemyId.includes("god")) {
    return "god";
  }
  return "orc";
}

function drawHeroFrame(ctx: CanvasRenderingContext2D): void {
  // Parity with PlayerGraphic idle/down frame (2D runtime).
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  drawEllipse(ctx, 16, 27, 7, 3);

  ctx.fillStyle = hexToCss(0x4caf50);
  drawEllipse(ctx, 16, 17, 10, 13);

  ctx.fillStyle = hexToCss(0x81c784);
  drawCircle(ctx, 16, 8, 5);

  ctx.fillStyle = "rgba(27,27,27,0.85)";
  drawCircle(ctx, 14, 7, 1);
  drawCircle(ctx, 18, 7, 1);

  ctx.strokeStyle = hexToCss(0x2e7d32);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(9, 15);
  ctx.lineTo(7, 19);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(23, 15);
  ctx.lineTo(25, 19);
  ctx.stroke();

  ctx.strokeStyle = hexToCss(0x1b5e20);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(13, 24);
  ctx.lineTo(12, 29);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(19, 24);
  ctx.lineTo(20, 29);
  ctx.stroke();
}

function drawEnemyFrame(
  ctx: CanvasRenderingContext2D,
  enemyId: EnemySpriteId,
): void {
  switch (enemyId) {
    case "rat": {
      ctx.fillStyle = hexToCss(0x808080);
      drawEllipse(ctx, 16, 20, 12, 8);
      ctx.fillStyle = hexToCss(0xffc0cb);
      drawCircle(ctx, 10, 12, 4);
      drawCircle(ctx, 22, 12, 4);
      ctx.fillStyle = hexToCss(0x000000);
      drawCircle(ctx, 12, 18, 2);
      drawCircle(ctx, 20, 18, 2);
      ctx.strokeStyle = hexToCss(0xffc0cb);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(16, 28);
      ctx.lineTo(16, 32);
      ctx.stroke();
      return;
    }
    case "skeleton": {
      ctx.fillStyle = hexToCss(0xaaaaaa);
      drawCircle(ctx, 16, 16, 12);
      ctx.fillStyle = hexToCss(0xff0000);
      drawCircle(ctx, 10, 10, 3);
      drawCircle(ctx, 22, 10, 3);
      ctx.fillStyle = hexToCss(0x000000);
      ctx.fillRect(10, 20, 12, 2);
      return;
    }
    case "goblin": {
      ctx.fillStyle = hexToCss(0x228b22);
      drawEllipse(ctx, 16, 20, 4, 5);
      ctx.fillStyle = hexToCss(0x32cd32);
      drawCircle(ctx, 16, 10, 6);
      ctx.fillStyle = hexToCss(0xff0000);
      drawCircle(ctx, 14, 8, 1.5);
      drawCircle(ctx, 18, 8, 1.5);
      ctx.strokeStyle = hexToCss(0x8b0000);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(16, 12, 3, 0, Math.PI);
      ctx.stroke();
      ctx.fillStyle = hexToCss(0x32cd32);
      ctx.beginPath();
      ctx.moveTo(10, 6);
      ctx.lineTo(6, 2);
      ctx.lineTo(10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(22, 6);
      ctx.lineTo(26, 2);
      ctx.lineTo(22, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hexToCss(0x8b4513);
      ctx.fillRect(22, 18, 6, 2);
      drawCircle(ctx, 28, 19, 3);
      return;
    }
    case "orc": {
      ctx.fillStyle = hexToCss(0x32cd32);
      ctx.fillRect(6, 6, 20, 24);
      ctx.fillStyle = hexToCss(0x000000);
      ctx.fillRect(10, 10, 4, 4);
      ctx.fillRect(18, 10, 4, 4);
      ctx.fillStyle = hexToCss(0xffffff);
      ctx.fillRect(12, 18, 2, 4);
      ctx.fillRect(18, 18, 2, 4);
      return;
    }
    case "demon": {
      ctx.fillStyle = hexToCss(0x8b0000);
      ctx.fillRect(10, 10, 12, 18);
      ctx.fillStyle = hexToCss(0x660000);
      drawCircle(ctx, 16, 8, 8);
      ctx.fillStyle = hexToCss(0x333333);
      ctx.beginPath();
      ctx.moveTo(8, 4);
      ctx.lineTo(12, 0);
      ctx.lineTo(16, 4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(24, 4);
      ctx.lineTo(20, 0);
      ctx.lineTo(16, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hexToCss(0xff4500);
      drawCircle(ctx, 13, 7, 2);
      drawCircle(ctx, 19, 7, 2);
      ctx.fillRect(14, 12, 4, 4);
      ctx.fillStyle = hexToCss(0xffffff);
      ctx.beginPath();
      ctx.moveTo(14, 12);
      ctx.lineTo(16, 14);
      ctx.lineTo(18, 12);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(14, 16);
      ctx.lineTo(16, 14);
      ctx.lineTo(18, 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hexToCss(0x4d0000);
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(10, 10);
      ctx.lineTo(5, 20);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(32, 10);
      ctx.lineTo(22, 10);
      ctx.lineTo(27, 20);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hexToCss(0x333333);
      ctx.beginPath();
      ctx.moveTo(8, 28);
      ctx.lineTo(10, 24);
      ctx.lineTo(12, 28);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(20, 28);
      ctx.lineTo(22, 24);
      ctx.lineTo(24, 28);
      ctx.closePath();
      ctx.fill();
      return;
    }
    case "dragon": {
      ctx.fillStyle = hexToCss(0x4b0082);
      drawCircle(ctx, 32, 32, 30);
      ctx.fillStyle = hexToCss(0xffff00);
      drawCircle(ctx, 22, 25, 6);
      drawCircle(ctx, 42, 25, 6);
      ctx.fillStyle = hexToCss(0xff0000);
      drawCircle(ctx, 22, 25, 2);
      drawCircle(ctx, 42, 25, 2);
      ctx.fillStyle = hexToCss(0x2a004a);
      ctx.beginPath();
      ctx.moveTo(32, 2);
      ctx.lineTo(22, 12);
      ctx.lineTo(42, 12);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(60, 20);
      ctx.lineTo(50, 32);
      ctx.lineTo(62, 32);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(4, 20);
      ctx.lineTo(14, 32);
      ctx.lineTo(2, 32);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(128,128,128,0.5)";
      drawCircle(ctx, 32, 45, 5);
      return;
    }
    case "god": {
      ctx.fillStyle = "rgba(255,255,0,0.4)";
      drawCircle(ctx, 16, 16, 14);
      ctx.fillStyle = hexToCss(0xffd700);
      drawCircle(ctx, 16, 16, 10);
      ctx.fillStyle = hexToCss(0xffffff);
      drawCircle(ctx, 12, 14, 2);
      drawCircle(ctx, 20, 14, 2);
      ctx.fillStyle = hexToCss(0xffa500);
      ctx.beginPath();
      ctx.moveTo(16, 2);
      ctx.lineTo(12, 8);
      ctx.lineTo(20, 8);
      ctx.closePath();
      ctx.fill();
      return;
    }
    case "red_wizard": {
      ctx.fillStyle = hexToCss(0x8b0000);
      ctx.fillRect(6, 12, 20, 18);
      ctx.fillStyle = hexToCss(0xff0000);
      ctx.beginPath();
      ctx.moveTo(16, 2);
      ctx.lineTo(6, 14);
      ctx.lineTo(26, 14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hexToCss(0x1a1a1a);
      ctx.fillRect(10, 14, 12, 6);
      ctx.fillStyle = hexToCss(0xfff000);
      ctx.fillRect(12, 16, 2, 2);
      ctx.fillRect(18, 16, 2, 2);
      ctx.fillStyle = hexToCss(0x4b2d00);
      ctx.fillRect(24, 8, 4, 22);
      ctx.fillStyle = hexToCss(0x00ffff);
      drawCircle(ctx, 26, 8, 3);
      return;
    }
  }
}

export function createHeroParitySpriteMaterial(
  scene: Scene,
  keyPrefix: string,
): StandardMaterial {
  return createSpriteMaterialFromDraw(
    scene,
    `${keyPrefix}-mat`,
    `${keyPrefix}-tex`,
    32,
    drawHeroFrame,
  );
}

export function createEnemyParitySpriteMaterial(
  scene: Scene,
  keyPrefix: string,
  enemyId: string,
): StandardMaterial {
  if (GENERATED_SPRITE_ENTITIES.has(enemyId)) {
    return createGeneratedSpriteAnimatedMaterial(scene, keyPrefix, enemyId);
  }

  const normalized = normalizeEnemyId(enemyId);
  const size = normalized === "dragon" ? 64 : 32;

  return createSpriteMaterialFromDraw(
    scene,
    `${keyPrefix}-mat`,
    `${keyPrefix}-tex`,
    size,
    (ctx) => drawEnemyFrame(ctx, normalized),
  );
}
