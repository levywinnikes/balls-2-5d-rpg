import { type Scene, Color3, StandardMaterial } from "@babylonjs/core";

export function createMaterial(
  scene: Scene,
  name: string,
  diffuseColor: Color3,
): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = diffuseColor;
  material.specularColor = new Color3(0.08, 0.08, 0.08);
  return material;
}

export function worldToSliceCoord(value: number): number {
  return value / 32;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function worldToGrid(value: number, gridOrigin: number): number {
  return Math.floor(value + gridOrigin);
}

export function gridToWorld(tile: number, gridOrigin: number): number {
  return tile - gridOrigin + 0.5;
}
