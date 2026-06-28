import { Material, Mesh, StandardMaterial } from "@babylonjs/core";

/** Same group as terrain so the depth buffer can occlude sprites behind walls. */
export const SPRITE_BILLBOARD_RENDERING_GROUP = 0;

/** Same group as terrain/sprites — depth buffer decides draw order (sprites on top). */
export const WATER_SURFACE_RENDERING_GROUP = 0;

/** Pixel-art cutout sprites: write depth so foreground geometry can hide the actor. */
export function configureBillboardSpriteMaterial(
  material: StandardMaterial,
): void {
  material.transparencyMode = Material.MATERIAL_ALPHATEST;
  material.alphaCutOff = 0.35;
}

export function configureBillboardSpriteMesh(mesh: Mesh): void {
  mesh.renderingGroupId = SPRITE_BILLBOARD_RENDERING_GROUP;
  mesh.alphaIndex = 2;
}

/** Soft gradient overlays (water tint) — no depth write, same group as parent sprite. */
export function configureBillboardOverlayMaterial(
  material: StandardMaterial,
): void {
  material.transparencyMode = Material.MATERIAL_ALPHABLEND;
  material.disableDepthWrite = true;
}
