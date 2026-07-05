import {
  DynamicTexture,
  Scene,
  StandardMaterial,
  Texture,
  Color3,
} from "@babylonjs/core";
import {
  normalizeVisualProfile,
  type CharacterVisualProfile,
} from "./CharacterVisualProfile";
import { configureBillboardSpriteMaterial } from "./BillboardDepthConfig";
import { shouldSwapGeneratedEastWestAssets } from "./GeneratedSpriteDirectionMeta";
import {
  acquirePooledSpriteTexture,
  releasePooledSpriteTextures,
} from "./SpriteTexturePool";

// Entities that have pre-generated PNG sprites under public/assets/sprites/generated/{id}/
const GENERATED_SPRITE_ENTITIES = new Set<string>([
  "goblin_lanceiro",
  "skeleton",
  "bear",
  "rat",
  "orc",
  "dragon",
  "demon",
  "red_wizard",
  "god",
]);

/** Until each enemy has its own folder, reuse generated assets. */
const GENERATED_SPRITE_ALIASES: Record<string, string> = {
  goblin: "goblin_lanceiro",
};

export type GeneratedSpriteDirection = "south" | "north" | "east" | "west";
export type GeneratedSpriteState = "idle" | "walk" | "attack" | "death";

type GeneratedAnimDef = {
  state: GeneratedSpriteState;
  direction: GeneratedSpriteDirection;
  frameCount: number;
};

const GENERATED_DIRECTIONS: GeneratedSpriteDirection[] = [
  "south",
  "north",
  "east",
  "west",
];

function buildDirectionalAnimDefs(
  states: Array<{ state: GeneratedSpriteState; frameCount: number }>,
): GeneratedAnimDef[] {
  const defs: GeneratedAnimDef[] = [];
  for (const direction of GENERATED_DIRECTIONS) {
    for (const entry of states) {
      defs.push({
        state: entry.state,
        direction,
        frameCount: entry.frameCount,
      });
    }
  }
  return defs;
}

const GENERATED_ANIM_DEFS: Record<string, GeneratedAnimDef[]> = {
  goblin_lanceiro: [
    ...buildDirectionalAnimDefs([
      { state: "idle", frameCount: 4 },
      { state: "walk", frameCount: 4 },
      { state: "attack", frameCount: 3 },
    ]),
    { state: "death", direction: "south", frameCount: 9 },
  ],
  skeleton: [
    ...buildDirectionalAnimDefs([
      { state: "idle", frameCount: 4 },
      { state: "walk", frameCount: 4 },
      { state: "attack", frameCount: 3 },
    ]),
    { state: "death", direction: "south", frameCount: 9 },
  ],
  bear: [
    ...buildDirectionalAnimDefs([
      { state: "idle", frameCount: 4 },
      { state: "walk", frameCount: 3 },
      { state: "attack", frameCount: 3 },
    ]),
    { state: "death", direction: "south", frameCount: 9 },
  ],
  rat: [
    ...buildDirectionalAnimDefs([
      { state: "idle", frameCount: 8 },
      { state: "walk", frameCount: 4 },
      { state: "attack", frameCount: 5 },
    ]),
    { state: "death", direction: "south", frameCount: 9 },
  ],
  orc: [
    ...buildDirectionalAnimDefs([
      { state: "idle", frameCount: 4 },
      { state: "walk", frameCount: 4 },
      { state: "attack", frameCount: 3 },
    ]),
    { state: "death", direction: "south", frameCount: 9 },
  ],
  dragon: [
    ...buildDirectionalAnimDefs([
      { state: "idle", frameCount: 9 },
      { state: "walk", frameCount: 4 },
      { state: "attack", frameCount: 7 },
    ]),
    { state: "death", direction: "south", frameCount: 9 },
  ],
  demon: [
    ...buildDirectionalAnimDefs([
      { state: "idle", frameCount: 4 },
      { state: "walk", frameCount: 4 },
      { state: "attack", frameCount: 9 },
    ]),
    { state: "death", direction: "south", frameCount: 9 },
  ],
  red_wizard: [
    ...buildDirectionalAnimDefs([
      { state: "idle", frameCount: 4 },
      { state: "walk", frameCount: 4 },
      { state: "attack", frameCount: 9 },
    ]),
    { state: "death", direction: "south", frameCount: 9 },
  ],
  god: [
    ...buildDirectionalAnimDefs([
      { state: "idle", frameCount: 4 },
      { state: "walk", frameCount: 4 },
      { state: "attack", frameCount: 9 },
    ]),
    { state: "death", direction: "south", frameCount: 9 },
  ],
};

/** Feet row in generated enemy PNGs (PixelLab canvas is 92×92). */
const GENERATED_ENEMY_FEET_Y: Record<string, number> = {
  goblin_lanceiro: 77,
  skeleton: 76,
  bear: 78,
  rat: 65,
  orc: 78,
  dragon: 67,
  demon: 78,
  red_wizard: 79,
  god: 79,
};
const GENERATED_ENEMY_CANVAS_SIZE = 92;

export function getGeneratedEnemyAnchorY(
  entityId: string,
  billboardHeight: number,
): number {
  const feetY = GENERATED_ENEMY_FEET_Y[entityId] ?? 58;
  const feetFromBottom =
    (GENERATED_ENEMY_CANVAS_SIZE - feetY) / GENERATED_ENEMY_CANVAS_SIZE;
  return billboardHeight * 0.5 - feetFromBottom * billboardHeight;
}

const GENERATED_FRAME_INTERVAL_MS: Record<GeneratedSpriteState, number> = {
  idle: 1000 / 6,
  walk: 1000 / 10,
  attack: 1000 / 14,
  death: 1000 / 12,
};

/** Hold last death frame on the ground before fade-out. */
const GENERATED_DEATH_CORPSE_HOLD_MS = 2500;
const GENERATED_DEATH_FADE_MS = 1500;

/** Fallback when only character_rotations/ exist (no frame_XX folders). */
const GENERATED_SPRITE_PROFILES: Record<
  string,
  { mode: "animated" | "rotations" }
> = {};

/**
 * Some PixelLab batches label east/west folders inverted vs hero_base.
 * Source of truth: src/three-d/runtime/sprite-direction-meta.json (npm run audit:sprite-directions).
 */
function resolveGeneratedAssetDirection(
  entityId: string,
  direction: GeneratedSpriteDirection,
): GeneratedSpriteDirection {
  if (!shouldSwapGeneratedEastWestAssets(entityId)) {
    return direction;
  }
  if (direction === "east") {
    return "west";
  }
  if (direction === "west") {
    return "east";
  }
  return direction;
}

export function resolveGeneratedSpriteEntityId(
  enemyId: string,
): string | null {
  if (GENERATED_SPRITE_ENTITIES.has(enemyId)) {
    return enemyId;
  }
  const alias = GENERATED_SPRITE_ALIASES[enemyId];
  if (alias && GENERATED_SPRITE_ENTITIES.has(alias)) {
    return alias;
  }
  return null;
}

export function getGeneratedDeathDurationMs(entityId: string): number {
  const resolved = resolveGeneratedSpriteEntityId(entityId) ?? entityId;
  const defs = GENERATED_ANIM_DEFS[resolved];
  if (!defs) {
    return 750;
  }
  const deathDef = defs.find((def) => def.state === "death");
  if (!deathDef) {
    return 750 + GENERATED_DEATH_CORPSE_HOLD_MS + GENERATED_DEATH_FADE_MS;
  }
  const animMs = Math.ceil(
    deathDef.frameCount * GENERATED_FRAME_INTERVAL_MS.death,
  );
  return animMs + GENERATED_DEATH_CORPSE_HOLD_MS + GENERATED_DEATH_FADE_MS;
}

export function getGeneratedAttackDurationMs(entityId: string): number {
  const resolved = resolveGeneratedSpriteEntityId(entityId) ?? entityId;
  const defs = GENERATED_ANIM_DEFS[resolved];
  if (!defs) {
    return 320;
  }
  const attackDef = defs.find((def) => def.state === "attack");
  if (!attackDef) {
    return 320;
  }
  return Math.ceil(attackDef.frameCount * GENERATED_FRAME_INTERVAL_MS.attack);
}

/**
 * @deprecated Use resolveBmsDirectionFromWorldDelta with active camera context.
 * Kept for unit tests (top-down α=π/2 only).
 */
export function resolveWorldBmsDirection(
  deltaX: number,
  deltaZ: number,
  fallback: GeneratedSpriteDirection,
): GeneratedSpriteDirection {
  if (Math.abs(deltaX) < 0.001 && Math.abs(deltaZ) < 0.001) {
    return fallback;
  }
  const screenRight = -deltaX;
  const screenUp = -deltaZ;
  if (Math.abs(screenUp) >= Math.abs(screenRight)) {
    return screenUp > 0 ? "north" : "south";
  }
  return screenRight > 0 ? "east" : "west";
}

// Re-export canonical resolver (camera-aware).
export { resolveBmsDirectionFromWorldDelta } from "./BmsDirectionResolver";

function buildGeneratedFrameUrls(
  entityId: string,
  anim: GeneratedAnimDef,
): string[] {
  const folderDirection = resolveGeneratedAssetDirection(
    entityId,
    anim.direction,
  );
  const base = `/assets/sprites/generated/${entityId}/${anim.state}_${folderDirection}`;
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
  const profile = GENERATED_SPRITE_PROFILES[entityId];
  if (profile?.mode === "rotations") {
    return createGeneratedRotationSpriteMaterial(scene, keyPrefix, entityId);
  }

  const animDefs =
    GENERATED_ANIM_DEFS[entityId] ?? GENERATED_ANIM_DEFS["goblin_lanceiro"];

  const textureMap = new Map<string, Texture[]>();
  const pooledUrls: string[] = [];
  for (const def of animDefs) {
    const urls = buildGeneratedFrameUrls(entityId, def);
    pooledUrls.push(...urls);
    const textures = urls.map((url) => acquirePooledSpriteTexture(scene, url));
    textureMap.set(`${def.state}:${def.direction}`, textures);
  }

  const fallbackFrames = textureMap.values().next().value as
    | Texture[]
    | undefined;
  const idleFrames =
    textureMap.get("idle:south") ??
    textureMap.get("idle:north") ??
    fallbackFrames ??
    [];
  if (idleFrames.length === 0) {
    throw new Error(`No animation frames loaded for ${entityId}`);
  }

  const mat = new StandardMaterial(`${keyPrefix}-mat`, scene);
  mat.backFaceCulling = false;
  mat.specularColor = Color3.Black();
  mat.useAlphaFromDiffuseTexture = true;
  mat.disableLighting = true;
  mat.emissiveColor = Color3.White();
  mat.diffuseTexture = idleFrames[0];
  mat.opacityTexture = idleFrames[0];
  configureBillboardSpriteMaterial(mat);

  let currentState: GeneratedSpriteState = "idle";
  let currentDirection: GeneratedSpriteDirection = "south";
  let frame = 0;
  let lastFrameAt = 0;
  let deathPhase: "none" | "playing" | "hold" | "fade" = "none";
  let deathHoldStartedAt = 0;
  let deathFadeStartedAt = 0;
  let animPaused = false;
  let animIntervalScale = 1;

  const applyFrame = () => {
    const direction =
      currentState === "death" ? "south" : currentDirection;
    const frames =
      textureMap.get(`${currentState}:${direction}`) ??
      textureMap.get("idle:south");
    if (!frames || frames.length === 0) {
      return;
    }
    const index = Math.min(frame, frames.length - 1);
    mat.diffuseTexture = frames[index];
    mat.opacityTexture = frames[index];
  };

  const obs = scene.onBeforeRenderObservable.add(() => {
    if (animPaused) {
      return;
    }

    const now = Date.now();

    if (currentState === "death" && deathPhase === "hold") {
      mat.emissiveColor = Color3.White();
      mat.alpha = 1;
      if (now - deathHoldStartedAt >= GENERATED_DEATH_CORPSE_HOLD_MS) {
        deathPhase = "fade";
        deathFadeStartedAt = now;
      }
      return;
    }

    if (currentState === "death" && deathPhase === "fade") {
      mat.emissiveColor = Color3.White();
      const fadeT = Math.min(
        1,
        (now - deathFadeStartedAt) / GENERATED_DEATH_FADE_MS,
      );
      mat.alpha = 1 - fadeT;
      return;
    }

    const interval =
      GENERATED_FRAME_INTERVAL_MS[currentState] * animIntervalScale;
    if (now - lastFrameAt < interval) {
      return;
    }
    lastFrameAt = now;

    const direction =
      currentState === "death" ? "south" : currentDirection;
    const frames =
      textureMap.get(`${currentState}:${direction}`) ??
      textureMap.get("idle:south");
    if (!frames || frames.length === 0) {
      return;
    }

    if (currentState === "attack" || currentState === "death") {
      frame = Math.min(frame + 1, frames.length - 1);
      if (
        currentState === "death" &&
        frame >= frames.length - 1 &&
        deathPhase === "playing"
      ) {
        deathPhase = "hold";
        deathHoldStartedAt = now;
      }
    } else {
      frame = (frame + 1) % frames.length;
    }
    applyFrame();
  });

  (mat as any)._setAnimState = (
    state: GeneratedSpriteState,
    restart = false,
  ) => {
    if (state === currentState && !restart) {
      return;
    }
    currentState = state;
    frame = 0;
    lastFrameAt = 0;
    if (state === "death") {
      deathPhase = "playing";
      deathHoldStartedAt = 0;
      deathFadeStartedAt = 0;
      mat.alpha = 1;
      mat.emissiveColor = Color3.White();
    } else {
      deathPhase = "none";
      mat.alpha = 1;
    }
    applyFrame();
  };

  (mat as any)._setDirection = (direction: GeneratedSpriteDirection) => {
    if (direction === currentDirection) {
      return;
    }
    currentDirection = direction;
    if (currentState !== "death") {
      frame = 0;
      lastFrameAt = 0;
      applyFrame();
    }
  };

  (mat as any)._setAnimPaused = (paused: boolean) => {
    animPaused = paused;
  };

  (mat as any)._setAnimIntervalScale = (scale: number) => {
    animIntervalScale = Math.max(0.25, Math.min(4, scale));
  };

  mat.onDisposeObservable.add(() => {
    scene.onBeforeRenderObservable.remove(obs);
    releasePooledSpriteTextures(scene, pooledUrls);
  });

  return mat;
}

/** Static 4-dir sprites (character_rotations/) until full animation folders exist. */
function createGeneratedRotationSpriteMaterial(
  scene: Scene,
  keyPrefix: string,
  entityId: string,
): StandardMaterial {
  const textureByDirection = new Map<GeneratedSpriteDirection, Texture>();
  const pooledUrls: string[] = [];
  for (const direction of GENERATED_DIRECTIONS) {
    const assetDirection = resolveGeneratedAssetDirection(entityId, direction);
    const url = `/assets/sprites/generated/${entityId}/character_rotations/${assetDirection}.png`;
    pooledUrls.push(url);
    textureByDirection.set(
      direction,
      acquirePooledSpriteTexture(scene, url),
    );
  }

  const defaultTexture = textureByDirection.get("south");
  if (!defaultTexture) {
    throw new Error(`Missing south rotation sprite for ${entityId}`);
  }

  const mat = new StandardMaterial(`${keyPrefix}-mat`, scene);
  mat.backFaceCulling = false;
  mat.specularColor = Color3.Black();
  mat.useAlphaFromDiffuseTexture = true;
  mat.disableLighting = true;
  mat.emissiveColor = Color3.White();
  mat.diffuseTexture = defaultTexture;
  mat.opacityTexture = defaultTexture;
  configureBillboardSpriteMaterial(mat);

  let currentState: GeneratedSpriteState = "idle";
  let currentDirection: GeneratedSpriteDirection = "south";
  let deathStartedAt = 0;

  const applyDirection = () => {
    const direction =
      currentState === "death" ? "south" : currentDirection;
    const texture = textureByDirection.get(direction);
    if (!texture) {
      return;
    }
    mat.diffuseTexture = texture;
    mat.opacityTexture = texture;
  };

  const obs = scene.onBeforeRenderObservable.add(() => {
    if (currentState !== "death" || deathStartedAt === 0) {
      return;
    }
    const elapsed = Date.now() - deathStartedAt;
    const animMs = getGeneratedDeathDurationMs(entityId) -
      GENERATED_DEATH_CORPSE_HOLD_MS -
      GENERATED_DEATH_FADE_MS;
    if (elapsed <= animMs) {
      mat.emissiveColor = Color3.White();
      mat.alpha = 1;
      return;
    }
    const holdElapsed = elapsed - animMs;
    if (holdElapsed <= GENERATED_DEATH_CORPSE_HOLD_MS) {
      mat.emissiveColor = Color3.White();
      mat.alpha = 1;
      return;
    }
    const fadeElapsed = holdElapsed - GENERATED_DEATH_CORPSE_HOLD_MS;
    mat.emissiveColor = Color3.White();
    mat.alpha = 1 - Math.min(1, fadeElapsed / GENERATED_DEATH_FADE_MS);
  });

  (mat as any)._setAnimState = (state: GeneratedSpriteState) => {
    if (state === currentState) {
      return;
    }
    currentState = state;
    if (state === "death") {
      deathStartedAt = Date.now();
      mat.alpha = 1;
    } else {
      deathStartedAt = 0;
      mat.alpha = 1;
    }
    applyDirection();
  };

  (mat as any)._setDirection = (direction: GeneratedSpriteDirection) => {
    if (direction === currentDirection || currentState === "death") {
      return;
    }
    currentDirection = direction;
    applyDirection();
  };

  mat.onDisposeObservable.add(() => {
    scene.onBeforeRenderObservable.remove(obs);
    releasePooledSpriteTextures(scene, pooledUrls);
  });

  return mat;
}

type EnemySpriteId =
  | "rat"
  | "bear"
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
  configureBillboardSpriteMaterial(material);
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
  if (enemyId.includes("bear")) {
    return "bear";
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
      drawEllipse(ctx, 16, 22, 14, 7);
      ctx.fillStyle = hexToCss(0xffc0cb);
      drawCircle(ctx, 10, 14, 3);
      drawCircle(ctx, 22, 14, 3);
      ctx.fillStyle = hexToCss(0x666666);
      drawEllipse(ctx, 16, 10, 5, 4);
      ctx.fillStyle = hexToCss(0x000000);
      drawCircle(ctx, 14, 10, 1);
      drawCircle(ctx, 18, 10, 1);
      ctx.fillStyle = hexToCss(0x555555);
      drawCircle(ctx, 8, 24, 2);
      drawCircle(ctx, 12, 26, 2);
      drawCircle(ctx, 20, 26, 2);
      drawCircle(ctx, 24, 24, 2);
      ctx.strokeStyle = hexToCss(0xffc0cb);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(28, 22);
      ctx.lineTo(31, 24);
      ctx.stroke();
      return;
    }
    case "bear": {
      ctx.fillStyle = hexToCss(0x6b4423);
      drawEllipse(ctx, 16, 22, 14, 10);
      ctx.fillStyle = hexToCss(0x8b5a2b);
      drawCircle(ctx, 16, 12, 7);
      ctx.fillStyle = hexToCss(0x000000);
      drawCircle(ctx, 13, 11, 1.5);
      drawCircle(ctx, 19, 11, 1.5);
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

// ─── Hero modular sprite (visual profile body + optional hair overlay) ────────

export type HeroBmsDirection = "south" | "north" | "east" | "west";
export type HeroAnimState = "idle" | "walk" | "attack" | "death";

export const HERO_MODULAR_SPRITE_ENABLED = true;
const HERO_SOURCE_SIZE = 92;
/** Feet row in generated hero PNGs (see scratch/audit-hero-base.js). */
const HERO_FEET_Y = 77;

export const HERO_BILLBOARD_LAYOUT = {
  canvasSize: HERO_SOURCE_SIZE,
  feetY: HERO_FEET_Y,
  width: 1.15,
  height: 1.78,
  /** Local Y so sprite feet sit on the player ground plane (plane pivot = center). */
  get anchorY(): number {
    const feetFromBottom =
      (this.canvasSize - this.feetY) / this.canvasSize;
    return this.height * 0.5 - feetFromBottom * this.height;
  },
};

/** Visible body height from feet to sprite top (world units). */
export function getHeroVisibleBodyHeight(): number {
  return (
    (HERO_BILLBOARD_LAYOUT.feetY / HERO_BILLBOARD_LAYOUT.canvasSize) *
    HERO_BILLBOARD_LAYOUT.height
  );
}

/**
 * Height of the hero's collision volume (smaller than the visible sprite to
 * leave headroom for ramps, stairs, and ceiling clearance).
 */
export const HERO_COLLISION_HEIGHT = 1.2;

/** Nominal humanoid reference in PROFILE_BY_ENEMY_ID — maps to hero billboard height. */
export const GENERATED_ENEMY_PROFILE_BASE_HEIGHT = 1.2;

/** World billboard size for PixelLab enemies (same canvas scale as hero_base). */
export function getGeneratedEnemyBillboardDimensions(profile: {
  height: number;
}): { width: number; height: number } {
  const scale = profile.height / GENERATED_ENEMY_PROFILE_BASE_HEIGHT;
  return {
    width: HERO_BILLBOARD_LAYOUT.width * scale,
    height: HERO_BILLBOARD_LAYOUT.height * scale,
  };
}

/** Fraction of visible body height used for first-person eye line (lower = more grounded view). */
export const HERO_FIRST_PERSON_EYE_BODY_RATIO = 0.58;

/** First-person eye height from feet — chest-level view aligned with NPC billboards in FP. */
export function getHeroFirstPersonEyeHeight(): number {
  return getHeroVisibleBodyHeight() * HERO_FIRST_PERSON_EYE_BODY_RATIO;
}

type HeroBodyAnimDef = {
  state: HeroAnimState;
  directions: HeroBmsDirection[];
  frameCount: number;
};

const HERO_BODY_ANIMS: HeroBodyAnimDef[] = [
  {
    state: "idle",
    directions: ["south", "north", "east", "west"],
    frameCount: 4,
  },
  {
    state: "walk",
    directions: ["south", "north", "east", "west"],
    frameCount: 4,
  },
  {
    state: "attack",
    directions: ["south", "north", "east", "west"],
    frameCount: 3,
  },
  { state: "death", directions: ["south"], frameCount: 9 },
];

/** Per-body overrides — bad frames in generated batches (see bear walk_south). */
const HERO_BODY_FRAME_COUNT: Record<
  string,
  Partial<Record<HeroAnimState, number>>
> = {
  bear: { walk: 3 },
};

const HERO_FRAME_INTERVAL_MS: Record<HeroAnimState, number> = {
  idle: 1000 / 6,
  walk: 1000 / 10,
  attack: 1000 / 14,
  death: 1000 / 12,
};

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function getHeadAnchor(img: HTMLImageElement): { x: number; y: number } {
  const canvas = document.createElement("canvas");
  canvas.width = HERO_SOURCE_SIZE;
  canvas.height = HERO_SOURCE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { x: HERO_SOURCE_SIZE / 2, y: HERO_SOURCE_SIZE * 0.2 };
  }
  ctx.drawImage(img, 0, 0, HERO_SOURCE_SIZE, HERO_SOURCE_SIZE);
  const data = ctx.getImageData(0, 0, HERO_SOURCE_SIZE, HERO_SOURCE_SIZE).data;

  let minX = HERO_SOURCE_SIZE;
  let maxX = -1;
  let minY = HERO_SOURCE_SIZE;
  let maxY = -1;

  for (let y = 0; y < HERO_SOURCE_SIZE; y += 1) {
    for (let x = 0; x < HERO_SOURCE_SIZE; x += 1) {
      const alpha = data[(y * HERO_SOURCE_SIZE + x) * 4 + 3];
      if (alpha > 20) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxY < minY) {
    return { x: HERO_SOURCE_SIZE / 2, y: HERO_SOURCE_SIZE * 0.2 };
  }

  const headMaxY = minY + Math.round((maxY - minY) * 0.34);
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = minY; y <= headMaxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const alpha = data[(y * HERO_SOURCE_SIZE + x) * 4 + 3];
      if (alpha > 20) {
        sumX += x;
        sumY += y;
        count += 1;
      }
    }
  }

  if (count === 0) {
    return { x: (minX + maxX) / 2, y: minY + (headMaxY - minY) / 2 };
  }

  return { x: sumX / count, y: sumY / count };
}

interface Socket {
  x: number;
  y: number;
}

// Sockets for weapon (MAIN_HAND) - Left hand
const WEAPON_SOCKETS: Record<string, Record<string, Socket[]>> = {
  idle: {
    south: [{ x: 58, y: 61 }, { x: 58, y: 62 }, { x: 58, y: 61 }, { x: 58, y: 60 }],
    north: [{ x: 40, y: 61 }, { x: 40, y: 62 }, { x: 40, y: 61 }, { x: 40, y: 60 }],
    east: [{ x: 44, y: 66 }, { x: 44, y: 67 }, { x: 44, y: 66 }, { x: 44, y: 65 }],
    west: [{ x: 49, y: 66 }, { x: 49, y: 67 }, { x: 49, y: 66 }, { x: 49, y: 65 }]
  },
  walk: {
    south: [{ x: 58, y: 57 }, { x: 57, y: 61 }, { x: 58, y: 61 }, { x: 58, y: 66 }],
    north: [{ x: 40, y: 61 }, { x: 41, y: 66 }, { x: 40, y: 61 }, { x: 40, y: 57 }],
    east: [{ x: 44, y: 66 }, { x: 40, y: 64 }, { x: 44, y: 66 }, { x: 58, y: 64 }],
    west: [{ x: 49, y: 66 }, { x: 58, y: 64 }, { x: 49, y: 66 }, { x: 40, y: 64 }]
  },
  attack: {
    south: [{ x: 64, y: 55 }, { x: 53, y: 56 }, { x: 64, y: 54 }],
    north: [{ x: 37, y: 55 }, { x: 42, y: 56 }, { x: 37, y: 54 }],
    east: [{ x: 44, y: 54 }, { x: 51, y: 48 }, { x: 49, y: 48 }],
    west: [{ x: 51, y: 54 }, { x: 41, y: 48 }, { x: 43, y: 48 }]
  }
};

// Sockets for shield (OFF_HAND) - Right hand
const SHIELD_SOCKETS: Record<string, Record<string, Socket[]>> = {
  idle: {
    south: [{ x: 40, y: 61 }, { x: 40, y: 62 }, { x: 40, y: 61 }, { x: 40, y: 60 }],
    north: [{ x: 58, y: 61 }, { x: 58, y: 62 }, { x: 58, y: 61 }, { x: 58, y: 60 }],
    east: [{ x: 49, y: 66 }, { x: 49, y: 67 }, { x: 49, y: 66 }, { x: 49, y: 65 }],
    west: [{ x: 44, y: 66 }, { x: 44, y: 67 }, { x: 44, y: 66 }, { x: 44, y: 65 }]
  },
  walk: {
    south: [{ x: 40, y: 61 }, { x: 41, y: 66 }, { x: 40, y: 61 }, { x: 40, y: 57 }],
    north: [{ x: 58, y: 57 }, { x: 57, y: 61 }, { x: 58, y: 61 }, { x: 58, y: 66 }],
    east: [{ x: 49, y: 66 }, { x: 58, y: 64 }, { x: 49, y: 66 }, { x: 40, y: 64 }],
    west: [{ x: 44, y: 66 }, { x: 40, y: 64 }, { x: 44, y: 66 }, { x: 58, y: 64 }]
  },
  attack: {
    south: [{ x: 41, y: 54 }, { x: 42, y: 49 }, { x: 42, y: 49 }],
    north: [{ x: 54, y: 54 }, { x: 53, y: 49 }, { x: 53, y: 49 }],
    east: [{ x: 51, y: 54 }, { x: 73, y: 44 }, { x: 67, y: 44 }],
    west: [{ x: 44, y: 54 }, { x: 19, y: 44 }, { x: 25, y: 44 }]
  }
};

function getWeaponSocket(state: HeroAnimState, direction: HeroBmsDirection, frameIndex: number): Socket {
  const dirMap = WEAPON_SOCKETS[state] || WEAPON_SOCKETS["idle"];
  const list = dirMap[direction] || dirMap["south"];
  return list[frameIndex % list.length] || { x: 58, y: 61 };
}

function getShieldSocket(state: HeroAnimState, direction: HeroBmsDirection, frameIndex: number): Socket {
  const dirMap = SHIELD_SOCKETS[state] || SHIELD_SOCKETS["idle"];
  const list = dirMap[direction] || dirMap["south"];
  return list[frameIndex % list.length] || { x: 40, y: 61 };
}

function compositeHeroFrame(
  bodyImg: HTMLImageElement,
  hairImg: HTMLImageElement | null,
  refHeadAnchor: { x: number; y: number } | null,
  bodyHeadAnchor: { x: number; y: number } | null,
  weaponImg: HTMLImageElement | null,
  shieldImg: HTMLImageElement | null,
  state: HeroAnimState,
  direction: HeroBmsDirection,
  frameIndex: number,
  weaponId: string | null = null,
  shieldId: string | null = null,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = HERO_SOURCE_SIZE;
  canvas.height = HERO_SOURCE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable.");
  }
  ctx.clearRect(0, 0, HERO_SOURCE_SIZE, HERO_SOURCE_SIZE);

  const drawShield = () => {
    if (!shieldImg || state === "death") return;
    const socket = getShieldSocket(state, direction, frameIndex);
    if (socket) {
      ctx.save();
      ctx.translate(socket.x, socket.y);

      // Classify/scale shield
      const sId = shieldId?.toLowerCase() || "";
      let sizeX = 28; // slightly smaller than 32 for better proportion
      let sizeY = 28;
      let pivotOffsetX = -14;
      let pivotOffsetY = -14;

      if (sId.includes("tower")) {
        sizeX = 30;
        sizeY = 32;
        pivotOffsetX = -15;
        pivotOffsetY = -16;
      }

      let rot = 0;
      if (direction === "east") rot = -Math.PI / 8;
      if (direction === "west") rot = Math.PI / 8;

      if (state === "walk") {
        rot += Math.sin(frameIndex * Math.PI) * 0.05;
      }

      ctx.rotate(rot);
      ctx.drawImage(shieldImg, pivotOffsetX, pivotOffsetY, sizeX, sizeY);
      ctx.restore();
    }
  };

  const drawWeapon = () => {
    if (!weaponImg || state === "death") return;
    const socket = getWeaponSocket(state, direction, frameIndex);
    if (socket) {
      ctx.save();
      ctx.translate(socket.x, socket.y);

      // Classify weapon type
      const wId = weaponId?.toLowerCase() || "";
      const isSword = wId.includes("sword");
      const isAxe = wId.includes("axe");
      const isBow = wId.includes("bow");
      const isTorch = wId.includes("torch");
      const isStar = wId.includes("star");

      // Custom pivot offsets and drawing size based on type
      let sizeX = 32;
      let sizeY = 32;
      let pivotOffsetX = -16;
      let pivotOffsetY = -24;

      if (isBow) {
        // Bows are held at the center grid point
        sizeX = 28;
        sizeY = 32;
        pivotOffsetX = -14;
        pivotOffsetY = -16; // pivot in the center
      } else if (isSword) {
        sizeX = 30;
        sizeY = 30;
        pivotOffsetX = -15;
        pivotOffsetY = -23;
      } else if (isTorch) {
        sizeX = 28;
        sizeY = 28;
        pivotOffsetX = -14;
        pivotOffsetY = -22;
      } else if (isStar) {
        sizeX = 24;
        sizeY = 24;
        pivotOffsetX = -12;
        pivotOffsetY = -12; // centered
      }

      // Base rotation based on direction
      let rot = 0;
      if (direction === "south") {
        rot = 0;
      } else if (direction === "north") {
        rot = -Math.PI / 2;
      } else if (direction === "east") {
        rot = 0;
      } else if (direction === "west") {
        rot = -Math.PI / 2;
      }

      // Apply dynamic rotation & swing animations based on type
      if (state === "attack") {
        if (isBow) {
          // Bow attack: held stable, slight recoil on frames
          // Pulling recoil offset
          if (frameIndex === 1) {
            if (direction === "south") pivotOffsetY -= 3;
            else if (direction === "north") pivotOffsetY += 3;
            else if (direction === "east") pivotOffsetX -= 3;
            else if (direction === "west") pivotOffsetX += 3;
          }
        } else {
          // Sword / Axe / Torch swing animation frame by frame
          if (frameIndex === 0) {
            if (direction === "south") rot -= Math.PI / 6;
            else if (direction === "north") rot -= Math.PI / 6;
            else if (direction === "east") rot -= Math.PI / 6;
            else if (direction === "west") rot += Math.PI / 6;
          } else if (frameIndex === 1) {
            if (direction === "south") rot += Math.PI / 6;
            else if (direction === "north") rot += Math.PI / 6;
            else if (direction === "east") rot += Math.PI / 4;
            else if (direction === "west") rot -= Math.PI / 4;
          } else {
            if (direction === "south") rot += Math.PI / 3;
            else if (direction === "north") rot += Math.PI / 3;
            else if (direction === "east") rot += Math.PI / 2;
            else if (direction === "west") rot -= Math.PI / 2;
          }
        }
      } else {
        // Idle / walk subtle variations
        if (isSword || isAxe) {
          if (direction === "south") rot += 0.2;
          else if (direction === "east") rot += 0.3;
          else if (direction === "west") rot -= 0.3;
        }
      }

      ctx.rotate(rot);
      ctx.drawImage(weaponImg, pivotOffsetX, pivotOffsetY, sizeX, sizeY);
      ctx.restore();
    }
  };

  const drawBody = () => {
    ctx.drawImage(bodyImg, 0, 0, HERO_SOURCE_SIZE, HERO_SOURCE_SIZE);
  };

  const drawHair = () => {
    if (hairImg) {
      if (refHeadAnchor && bodyHeadAnchor) {
        const dx = Math.round(bodyHeadAnchor.x - refHeadAnchor.x);
        const dy = Math.round(bodyHeadAnchor.y - refHeadAnchor.y);
        ctx.drawImage(hairImg, dx, dy, HERO_SOURCE_SIZE, HERO_SOURCE_SIZE);
      } else {
        ctx.drawImage(hairImg, 0, 0, HERO_SOURCE_SIZE, HERO_SOURCE_SIZE);
      }
    }
  };

  // Determine drawing order based on direction
  if (direction === "north") {
    // Weapon and Shield are behind the body
    drawShield();
    drawWeapon();
    drawBody();
    drawHair();
  } else if (direction === "east") {
    // Weapon (left hand, far side) is behind body. Shield (right hand, near side) is in front.
    drawWeapon();
    drawBody();
    drawHair();
    drawShield();
  } else if (direction === "west") {
    // Weapon (left hand, near side) is in front. Shield (right hand, far side) is behind body.
    drawShield();
    drawBody();
    drawHair();
    drawWeapon();
  } else {
    // south (facing camera): both in front of body
    drawBody();
    drawHair();
    drawShield();
    drawWeapon();
  }

  return canvas;
}

function canvasToSpriteTexture(
  scene: Scene,
  name: string,
  canvas: HTMLCanvasElement,
): Texture {
  // Same path as goblin_lanceiro PNGs — no vScale flip needed.
  const texture = new Texture(
    canvas.toDataURL("image/png"),
    scene,
    false,
    true,
    Texture.NEAREST_NEAREST,
  );
  texture.name = name;
  texture.hasAlpha = true;
  return texture;
}

function getHairOverlayUrl(
  hairEntityId: string,
  direction: HeroBmsDirection,
): string {
  return `/assets/sprites/generated/${hairEntityId}/character_rotations/${direction}.png`;
}

async function buildHeroModularTextureMap(
  scene: Scene,
  keyPrefix: string,
  profile: CharacterVisualProfile,
): Promise<Map<string, Texture[]>> {
  const textureMap = new Map<string, Texture[]>();
  const headOverlayByDirection = new Map<HeroBmsDirection, HTMLImageElement>();
  const { bodyEntityId, hairOverlayEntityId, weaponId, shieldId, hideEquipmentOverlays } =
    profile;
  const overlayHairId = hideEquipmentOverlays ? null : hairOverlayEntityId;
  const overlayWeaponId = hideEquipmentOverlays ? null : weaponId;
  const overlayShieldId = hideEquipmentOverlays ? null : shieldId;

  if (overlayHairId) {
    await Promise.all(
      (["south", "north", "east", "west"] as HeroBmsDirection[]).map(
        async (direction) => {
          const overlayImg = await loadImageElement(
            getHairOverlayUrl(overlayHairId, direction),
          );
          headOverlayByDirection.set(direction, overlayImg);
        },
      ),
    );
  }

  let weaponImg: HTMLImageElement | null = null;
  if (overlayWeaponId) {
    try {
      weaponImg = await loadImageElement(`/assets/items/${overlayWeaponId}.png`);
    } catch (e) {
      console.warn(`Failed to load weapon image: ${weaponId}`, e);
    }
  }

  let shieldImg: HTMLImageElement | null = null;
  if (overlayShieldId) {
    try {
      shieldImg = await loadImageElement(`/assets/items/${overlayShieldId}.png`);
    } catch (e) {
      console.warn(`Failed to load shield image: ${shieldId}`, e);
    }
  }

  const refHeadAnchorByDirection = new Map<
    HeroBmsDirection,
    { x: number; y: number }
  >();
  await Promise.all(
    (["south", "north", "east", "west"] as HeroBmsDirection[]).map(
      async (direction) => {
        const idleRefUrl = `/assets/sprites/generated/${bodyEntityId}/idle_${direction}/frame_00.png`;
        const idleRefImg = await loadImageElement(idleRefUrl);
        refHeadAnchorByDirection.set(direction, getHeadAnchor(idleRefImg));
      },
    ),
  );

  for (const anim of HERO_BODY_ANIMS) {
    for (const direction of anim.directions) {
      const refHeadAnchor =
        refHeadAnchorByDirection.get(direction) ?? null;
      const frames: Texture[] = [];
      const frameCount =
        HERO_BODY_FRAME_COUNT[bodyEntityId]?.[anim.state] ?? anim.frameCount;

      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const bodyUrl = `/assets/sprites/generated/${bodyEntityId}/${anim.state}_${direction}/frame_${String(frameIndex).padStart(2, "0")}.png`;
        const bodyImg = await loadImageElement(bodyUrl);
        const bodyHeadAnchor = getHeadAnchor(bodyImg);
        const canvas = compositeHeroFrame(
          bodyImg,
          headOverlayByDirection.get(direction) ?? null,
          refHeadAnchor,
          bodyHeadAnchor,
          weaponImg,
          shieldImg,
          anim.state,
          direction,
          frameIndex,
          overlayWeaponId,
          overlayShieldId,
        );
        frames.push(
          canvasToSpriteTexture(
            scene,
            `${keyPrefix}-${anim.state}-${direction}-${frameIndex}`,
            canvas,
          ),
        );
      }

      textureMap.set(`${anim.state}:${direction}`, frames);
    }
  }

  return textureMap;
}

export function resolveHeroBmsDirection(
  moveForward: number,
  moveRight: number,
  fallback: HeroBmsDirection,
): HeroBmsDirection {
  if (moveForward === 0 && moveRight === 0) {
    return fallback;
  }
  if (Math.abs(moveForward) >= Math.abs(moveRight)) {
    return moveForward > 0 ? "north" : "south";
  }
  return moveRight > 0 ? "east" : "west";
}

/**
 * Animated hero material from a visual profile (body folder + optional hair overlay).
 * Exposes `_setAnimState`, `_setDirection`, `_setVisualProfile`, and `_onReady`.
 */
export function createHeroModularSpriteMaterial(
  scene: Scene,
  keyPrefix: string,
  profile: CharacterVisualProfile | string | null = "hair_classic",
): StandardMaterial {
  const placeholder = createHeroParitySpriteMaterial(scene, keyPrefix);
  if (!HERO_MODULAR_SPRITE_ENABLED) {
    return placeholder;
  }

  const mat = new StandardMaterial(`${keyPrefix}-modular-mat`, scene);
  mat.backFaceCulling = false;
  mat.specularColor = Color3.Black();
  mat.useAlphaFromDiffuseTexture = true;
  mat.disableLighting = true;
  mat.emissiveColor = Color3.White();
  mat.diffuseTexture = placeholder.diffuseTexture;
  mat.opacityTexture = placeholder.opacityTexture;
  configureBillboardSpriteMaterial(mat);

  let textureMap = new Map<string, Texture[]>();
  let ready = false;
  let loadGeneration = 0;
  let visualProfile = normalizeVisualProfile(profile);
  let currentState: HeroAnimState = "idle";
  let currentDirection: HeroBmsDirection = "south";
  let frame = 0;
  let lastFrameAt = 0;
  let pendingFootstep = false;

  const disposeTextureMap = (map: Map<string, Texture[]>) => {
    map.forEach((frames) => frames.forEach((texture) => texture.dispose()));
  };

  const loadVisualProfile = (nextProfile: CharacterVisualProfile) => {
    visualProfile = nextProfile;
    const generation = ++loadGeneration;
    ready = false;

    return buildHeroModularTextureMap(scene, keyPrefix, nextProfile)
      .then((loaded) => {
        if (generation !== loadGeneration) {
          disposeTextureMap(loaded);
          return;
        }
        disposeTextureMap(textureMap);
        textureMap = loaded;
        ready = true;
        frame = 0;
        lastFrameAt = 0;
        applyFrame();
      })
      .catch((error) => {
        if (generation !== loadGeneration) {
          return;
        }
        console.warn(
          "[HeroModular3D] Failed to load visual profile; keeping previous textures if any.",
          error,
        );
        ready = textureMap.size > 0;
        applyFrame();
      });
  };

  const applyFrame = () => {
    if (!ready) {
      return;
    }
    const direction =
      currentState === "death" ? "south" : currentDirection;
    const frames =
      textureMap.get(`${currentState}:${direction}`) ??
      textureMap.get("idle:south");
    if (!frames || frames.length === 0) {
      return;
    }
    const index = Math.min(frame, frames.length - 1);
    mat.diffuseTexture = frames[index];
    mat.opacityTexture = frames[index];
  };

  const obs = scene.onBeforeRenderObservable.add(() => {
    if (!ready) {
      return;
    }
    const now = Date.now();
    const interval = HERO_FRAME_INTERVAL_MS[currentState];
    if (now - lastFrameAt < interval) {
      return;
    }
    lastFrameAt = now;

    const direction =
      currentState === "death" ? "south" : currentDirection;
    const frames =
      textureMap.get(`${currentState}:${direction}`) ??
      textureMap.get("idle:south");
    if (!frames || frames.length === 0) {
      return;
    }

    if (currentState === "attack" || currentState === "death") {
      frame = Math.min(frame + 1, frames.length - 1);
    } else {
      const prevFrame = frame;
      frame = (frame + 1) % frames.length;
      if (
        currentState === "walk" &&
        (frame === 0 || frame === 2) &&
        frame !== prevFrame
      ) {
        pendingFootstep = true;
      }
    }
    applyFrame();
  });

  (mat as any)._consumeFootstepTick = (): boolean => {
    if (!pendingFootstep) {
      return false;
    }
    pendingFootstep = false;
    return true;
  };

  (mat as any)._setAnimState = (state: HeroAnimState) => {
    if (state === currentState) {
      return;
    }
    currentState = state;
    frame = 0;
    lastFrameAt = 0;
    pendingFootstep = state === "walk";
    applyFrame();
  };

  (mat as any)._setDirection = (direction: HeroBmsDirection) => {
    if (direction === currentDirection) {
      return;
    }
    currentDirection = direction;
    frame = 0;
    lastFrameAt = 0;
    pendingFootstep = false;
    applyFrame();
  };

  (mat as any)._setVisualProfile = (nextProfile: CharacterVisualProfile) => {
    void loadVisualProfile(nextProfile);
  };

  mat.onDisposeObservable.add(() => {
    scene.onBeforeRenderObservable.remove(obs);
    disposeTextureMap(textureMap);
    placeholder.dispose();
  });

  void loadVisualProfile(visualProfile).then(() => {
    const onReady = (mat as any)._onReady;
    if (typeof onReady === "function") {
      onReady();
    }
  });

  return mat;
}

export function createEnemyParitySpriteMaterial(
  scene: Scene,
  keyPrefix: string,
  enemyId: string,
): StandardMaterial {
  const generatedId = resolveGeneratedSpriteEntityId(enemyId);
  if (generatedId) {
    return createGeneratedSpriteAnimatedMaterial(scene, keyPrefix, generatedId);
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
