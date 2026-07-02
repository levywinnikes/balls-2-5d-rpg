import { Scene, Texture } from "@babylonjs/core";

type PoolEntry = {
  texture: Texture;
  refs: number;
};

const poolByScene = new WeakMap<Scene, Map<string, PoolEntry>>();

function getScenePool(scene: Scene): Map<string, PoolEntry> {
  let pool = poolByScene.get(scene);
  if (!pool) {
    pool = new Map();
    poolByScene.set(scene, pool);
  }
  return pool;
}

function poolKey(url: string): string {
  return url;
}

/**
 * Returns a shared NEAREST_NEAREST sprite texture for `url`.
 * Call {@link releasePooledSpriteTexture} once per acquire when the consumer is disposed.
 */
export function acquirePooledSpriteTexture(scene: Scene, url: string): Texture {
  const pool = getScenePool(scene);
  const key = poolKey(url);
  const existing = pool.get(key);
  if (existing) {
    existing.refs += 1;
    return existing.texture;
  }

  const texture = new Texture(
    url,
    scene,
    false,
    true,
    Texture.NEAREST_NEAREST,
  );
  texture.hasAlpha = true;
  pool.set(key, { texture, refs: 1 });
  return texture;
}

/** Decrements ref count; disposes the GPU texture when nothing references it. */
export function releasePooledSpriteTexture(scene: Scene, url: string): void {
  const pool = poolByScene.get(scene);
  if (!pool) {
    return;
  }
  const key = poolKey(url);
  const entry = pool.get(key);
  if (!entry) {
    return;
  }
  entry.refs -= 1;
  if (entry.refs <= 0) {
    entry.texture.dispose();
    pool.delete(key);
  }
}

export function releasePooledSpriteTextures(
  scene: Scene,
  urls: readonly string[],
): void {
  for (let i = 0; i < urls.length; i += 1) {
    releasePooledSpriteTexture(scene, urls[i]!);
  }
}

/** Clears every pooled texture still held for a scene (call on slice dispose). */
export function disposeAllPooledSpriteTexturesForScene(scene: Scene): void {
  const pool = poolByScene.get(scene);
  if (!pool) {
    return;
  }
  pool.forEach((entry) => entry.texture.dispose());
  pool.clear();
}
