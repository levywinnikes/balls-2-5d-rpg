import { type Scene, Mesh, MeshBuilder, StandardMaterial, DynamicTexture, Color3, Vector3 } from "@babylonjs/core";
import type { SliceEnemy } from "./EnemyStreamSystem";

export type ActiveSlash = {
  mesh: Mesh;
  material: StandardMaterial;
  texture: DynamicTexture;
  elapsed: number;
  duration: number;
  startScale: number;
  endScale: number;
};

export function getDeterministicRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return (Math.abs(hash) % 360) * (Math.PI / 180);
}

export function getWeaponSlashColor(weaponId: string | null): Color3 {
  if (!weaponId) return Color3.FromHexString("#ffffff");
  const wId = weaponId.toLowerCase();
  if (wId.includes("dragon") || wId.includes("fire") || wId.includes("light_torch")) {
    return Color3.FromHexString("#ff6b35");
  }
  if (wId.includes("poison") || wId.includes("venom") || wId.includes("decay")) {
    return Color3.FromHexString("#06d6a0");
  }
  if (wId.includes("ice") || wId.includes("cold") || wId.includes("frost")) {
    return Color3.FromHexString("#87ceeb");
  }
  if (wId.includes("shadow") || wId.includes("dark") || wId.includes("void") || wId.includes("death")) {
    return Color3.FromHexString("#b366ff");
  }
  if (wId.includes("lightning") || wId.includes("electric") || wId.includes("storm")) {
    return Color3.FromHexString("#ffd700");
  }
  return Color3.FromHexString("#ffffff");
}

export interface SlashTrailConfig {
  player: { position: Vector3 };
  scene: Scene;
  getEquippedWeaponId: () => string | null;
  activeSlashtrails: ActiveSlash[];
  getWeaponColor: (weaponId: string | null) => Color3;
}

export function triggerPlayerAttackSlashEffect(cfg: SlashTrailConfig, enemy: SliceEnemy): void {
  const { player, scene, getEquippedWeaponId, activeSlashtrails, getWeaponColor } = cfg;
  const delta = enemy.worldPos.subtract(player.position);
  delta.y = 0;
  if (delta.lengthSquared() < 0.001) return;

  const dir = delta.normalize();
  const slashPos = player.position.clone();
  slashPos.y = player.position.y + 0.05;
  slashPos.addInPlace(dir.scale(0.5));

  const slashMesh = MeshBuilder.CreatePlane(
    `player-slash-trail-${performance.now()}`,
    { width: 0.8, height: 0.4 },
    scene,
  );
  slashMesh.position.copyFrom(slashPos);
  slashMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;

  const angle = Math.atan2(dir.x, dir.z);
  slashMesh.rotation.z = -angle - Math.PI / 2;

  const canvasWidth = 128;
  const canvasHeight = 64;
  const dynTex = new DynamicTexture(
    `slash-trail-tex-${performance.now()}`,
    { width: canvasWidth, height: canvasHeight },
    scene,
    false,
  );
  const texCtx = dynTex.getContext();
  texCtx.clearRect(0, 0, canvasWidth, canvasHeight);

  const weaponId = getEquippedWeaponId();
  const slashColor = getWeaponColor(weaponId);

  const grad = texCtx.createLinearGradient(0, 0, canvasWidth, 0);
  grad.addColorStop(0, "rgba(255, 255, 255, 0)");
  const r = Math.round(slashColor.r * 255);
  const g = Math.round(slashColor.g * 255);
  const b = Math.round(slashColor.b * 255);
  grad.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.8)`);
  grad.addColorStop(0.5, "rgba(255, 255, 255, 1.0)");
  grad.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.8)`);
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");

  texCtx.fillStyle = grad;
  texCtx.beginPath();
  texCtx.moveTo(10, canvasHeight - 10);
  texCtx.quadraticCurveTo(canvasWidth / 2, 8, canvasWidth - 10, canvasHeight - 10);
  texCtx.quadraticCurveTo(canvasWidth / 2, 22, 10, canvasHeight - 10);
  texCtx.closePath();
  texCtx.fill();
  dynTex.update();

  const slashMat = new StandardMaterial(`slash-trail-mat-${performance.now()}`, scene);
  slashMat.diffuseTexture = dynTex;
  slashMat.opacityTexture = dynTex;
  slashMat.useAlphaFromDiffuseTexture = true;
  slashMat.backFaceCulling = false;
  slashMat.disableLighting = true;
  slashMat.emissiveColor = Color3.White();
  slashMesh.material = slashMat;
  slashMesh.isPickable = false;

  activeSlashtrails.push({
    mesh: slashMesh,
    material: slashMat,
    texture: dynTex,
    elapsed: 0,
    duration: 250,
    startScale: 0.8,
    endScale: 1.1,
  });
}
