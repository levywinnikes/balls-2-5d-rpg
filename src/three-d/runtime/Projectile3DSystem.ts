import {
  Color3,
  Material,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core";
import {
  ARROW_PROJECTILE_DEF,
  arrowFlightYawRad,
  pickArrowFlightAnimation3D,
  projectileFramePath,
} from "../../game/graphics/projectiles/ProjectileSpriteRegistry";
import {
  configureBillboardSpriteMesh,
} from "./BillboardDepthConfig";
import { findFirstBlockingTileOnGridLine, findFirstBlockingTileOnWorldLine } from "./WallRevealLos";

export type ProjectileVisualProfile = "arrow" | "throwing_star";

export interface Projectile3DProfile {
  visual: ProjectileVisualProfile;
  speed: number;
  hitRadius: number;
}

export interface ProjectileEnemyTarget {
  uid: string;
  worldPos: Vector3;
  isDead: boolean;
}

export interface Projectile3DFireOptions {
  origin: Vector3;
  direction: Vector3;
  maxRange: number;
  profile: Projectile3DProfile;
  enemies: ProjectileEnemyTarget[];
  onEnemyHit: (enemy: ProjectileEnemyTarget) => void;
  onWallHit?: (position: Vector3) => void;
}

interface ActiveProjectile3D {
  mesh: Mesh;
  material: StandardMaterial;
  direction: Vector3;
  profile: Projectile3DProfile;
  origin: Vector3;
  maxRange: number;
  traveled: number;
  spin: number;
  enemies: ProjectileEnemyTarget[];
  onEnemyHit: (enemy: ProjectileEnemyTarget) => void;
  onWallHit?: (position: Vector3) => void;
  lastPosition: Vector3;
  spriteFrames?: Texture[];
  spriteFrameIndex: number;
  spriteFrameTimer: number;
  spriteFrameRate: number;
  usesSpriteBillboard: boolean;
}

export interface Projectile3DGridContext {
  grid: number[][];
  gridSize: number;
  gridOrigin: number;
  worldToGrid: (value: number, origin: number) => number;
  /** When set, used instead of the numeric grid (world tile coordinates). */
  isTileBlocked?: (tileX: number, tileY: number) => boolean;
}

const MAX_LIFETIME_SEC = 4;
/** ~half a tile — smaller than hero (1.15w) but readable in top-down. */
const ARROW_WORLD_SIZE = 0.5;
const STAR_WORLD_SIZE = 0.42;
const PROJECTILE_SPAWN_AHEAD = 0.38;

function applyProjectileSpriteMaterial(
  material: StandardMaterial,
  texture: Texture,
): void {
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.specularColor = Color3.Black();
  material.emissiveColor = Color3.White();
  material.diffuseTexture = texture;
  material.opacityTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.transparencyMode = Material.MATERIAL_ALPHATEST;
  material.alphaCutOff = 0.08;
}

function applyProjectileSpriteFrame(
  material: StandardMaterial,
  texture: Texture,
): void {
  material.diffuseTexture = texture;
  material.opacityTexture = texture;
}

function createArrowSpriteVisual(
  scene: Scene,
  id: number,
  _speed: number,
): {
  mesh: Mesh;
  material: StandardMaterial;
  spriteFrames: Texture[];
  spriteFrameRate: number;
} {
  const animation = pickArrowFlightAnimation3D(_speed);
  const animDef = ARROW_PROJECTILE_DEF.animations[animation];
  const direction = ARROW_PROJECTILE_DEF.direction;
  const spriteFrames = Array.from({ length: animDef.frameCount }, (_, index) => {
    const texture = new Texture(
      projectileFramePath(ARROW_PROJECTILE_DEF.id, animation, direction, index),
      scene,
      false,
      true,
      Texture.NEAREST_NEAREST,
    );
    texture.hasAlpha = true;
    return texture;
  });

  const material = new StandardMaterial(`proj3d_arrow_mat_${id}`, scene);
  applyProjectileSpriteMaterial(material, spriteFrames[0]);

  const mesh = MeshBuilder.CreatePlane(
    `proj3d_arrow_sprite_${id}`,
    { width: ARROW_WORLD_SIZE, height: ARROW_WORLD_SIZE },
    scene,
  );
  mesh.billboardMode = Mesh.BILLBOARDMODE_Y;
  configureBillboardSpriteMesh(mesh);
  mesh.material = material;
  mesh.isPickable = false;

  return {
    mesh,
    material,
    spriteFrames,
    spriteFrameRate: animDef.frameRate,
  };
}

function createThrowingStarSpriteVisual(
  scene: Scene,
  id: number,
): {
  mesh: Mesh;
  material: StandardMaterial;
} {
  const texture = new Texture(
    "/assets/items/throwing_star.png",
    scene,
    false,
    true,
    Texture.NEAREST_NEAREST,
  );
  texture.hasAlpha = true;

  const material = new StandardMaterial(`proj3d_star_mat_${id}`, scene);
  applyProjectileSpriteMaterial(material, texture);

  const mesh = MeshBuilder.CreatePlane(
    `proj3d_star_sprite_${id}`,
    { width: STAR_WORLD_SIZE, height: STAR_WORLD_SIZE },
    scene,
  );
  mesh.billboardMode = Mesh.BILLBOARDMODE_Y;
  configureBillboardSpriteMesh(mesh);
  mesh.material = material;
  mesh.isPickable = false;

  return { mesh, material };
}

function createProjectileVisual(
  scene: Scene,
  profile: ProjectileVisualProfile,
  id: number,
  speed: number,
): {
  mesh: Mesh;
  material: StandardMaterial;
  spriteFrames?: Texture[];
  spriteFrameRate?: number;
  usesSpriteBillboard?: boolean;
} {
  if (profile === "arrow") {
    try {
      return {
        ...createArrowSpriteVisual(scene, id, speed),
        usesSpriteBillboard: true,
      };
    } catch {
      // Fall through to procedural placeholder.
    }
  }

  if (profile === "throwing_star") {
    try {
      return {
        ...createThrowingStarSpriteVisual(scene, id),
        usesSpriteBillboard: true,
      };
    } catch {
      // Fall through to procedural placeholder.
    }
  }

  const material = new StandardMaterial(`proj3d_mat_${id}`, scene);
  material.disableLighting = true;
  material.emissiveColor = Color3.FromHexString("#FFD700");

  let mesh: Mesh;
  if (profile === "throwing_star") {
    mesh = MeshBuilder.CreateBox(
      `proj3d_star_${id}`,
      { width: 0.22, height: 0.04, depth: 0.22 },
      scene,
    );
    mesh.rotation.x = Math.PI / 2;
  } else {
    material.emissiveColor = Color3.FromHexString("#8B4513");
    mesh = MeshBuilder.CreateBox(
      `proj3d_arrow_${id}`,
      { width: 0.07, height: 0.05, depth: 0.48 },
      scene,
    );
  }

  mesh.material = material;
  mesh.isPickable = false;
  return { mesh, material };
}

function alignArrowToFlight(mesh: Mesh, direction: Vector3): void {
  mesh.rotation.y = arrowFlightYawRad(direction.x, direction.z);
  mesh.rotation.z = 0;
}

function isGridBlocked(
  ctx: Projectile3DGridContext,
  worldPos: Vector3,
): boolean {
  const tileX = Math.floor(worldPos.x);
  const tileY = Math.floor(worldPos.z);
  if (ctx.isTileBlocked) {
    return ctx.isTileBlocked(tileX, tileY);
  }

  const gx = ctx.worldToGrid(worldPos.x, ctx.gridOrigin);
  const gy = ctx.worldToGrid(worldPos.z, ctx.gridOrigin);
  if (
    gx < 0 ||
    gy < 0 ||
    gx >= ctx.gridSize ||
    gy >= ctx.gridSize
  ) {
    return false;
  }
  return ctx.grid[gy]?.[gx] === 1;
}

function segmentCrossesWall(
  ctx: Projectile3DGridContext,
  from: Vector3,
  to: Vector3,
): Vector3 | null {
  if (ctx.isTileBlocked) {
    const block = findFirstBlockingTileOnWorldLine(
      from.x,
      from.z,
      to.x,
      to.z,
      ctx.isTileBlocked,
      { skipStart: true },
    );
    if (!block) {
      return null;
    }
    return new Vector3(block.x + 0.5, to.y, block.y + 0.5);
  }

  const x0 = ctx.worldToGrid(from.x, ctx.gridOrigin);
  const y0 = ctx.worldToGrid(from.z, ctx.gridOrigin);
  const x1 = ctx.worldToGrid(to.x, ctx.gridOrigin);
  const y1 = ctx.worldToGrid(to.z, ctx.gridOrigin);

  const block = findFirstBlockingTileOnGridLine(
    ctx.grid,
    ctx.gridSize,
    x0,
    y0,
    x1,
    y1,
    { skipStart: true },
  );
  if (!block) {
    return null;
  }

  const wx = block.x - ctx.gridOrigin + 0.5;
  const wz = block.y - ctx.gridOrigin + 0.5;
  return new Vector3(wx, to.y, wz);
}

function findEnemyHit(
  position: Vector3,
  hitRadius: number,
  enemies: ProjectileEnemyTarget[],
): ProjectileEnemyTarget | null {
  let best: ProjectileEnemyTarget | null = null;
  let bestDist = hitRadius;

  for (const enemy of enemies) {
    if (enemy.isDead) {
      continue;
    }
    const dx = position.x - enemy.worldPos.x;
    const dz = position.z - enemy.worldPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= bestDist) {
      bestDist = dist;
      best = enemy;
    }
  }

  return best;
}

export class Projectile3DSystem {
  private readonly scene: Scene;
  private readonly gridContext: Projectile3DGridContext;
  private readonly active: ActiveProjectile3D[] = [];
  private nextId = 0;

  constructor(scene: Scene, gridContext: Projectile3DGridContext) {
    this.scene = scene;
    this.gridContext = gridContext;
  }

  /** @deprecated Camera mode no longer affects projectile billboards. */
  setFirstPersonMode(_firstPerson: boolean): void {}

  get activeCount(): number {
    return this.active.length;
  }

  fire(options: Projectile3DFireOptions): boolean {
    const direction = options.direction.clone();
    if (direction.lengthSquared() < 0.0001) {
      return false;
    }
    direction.normalize();

    const id = this.nextId++;
    const visual = createProjectileVisual(
      this.scene,
      options.profile.visual,
      id,
      options.profile.speed,
    );

    const origin = options.origin.clone();
    origin.addInPlace(direction.scale(PROJECTILE_SPAWN_AHEAD));
    visual.mesh.position.copyFrom(origin);

    const spin = Math.random() * Math.PI * 2;
    if (options.profile.visual === "arrow") {
      alignArrowToFlight(visual.mesh, direction);
    } else if (options.profile.visual === "throwing_star") {
      visual.mesh.rotation.y = spin;
    }

    this.active.push({
      mesh: visual.mesh,
      material: visual.material,
      direction,
      profile: options.profile,
      origin,
      maxRange: Math.max(0.5, options.maxRange),
      traveled: 0,
      spin,
      enemies: options.enemies,
      onEnemyHit: options.onEnemyHit,
      onWallHit: options.onWallHit,
      lastPosition: origin.clone(),
      spriteFrames: visual.spriteFrames,
      spriteFrameIndex: 0,
      spriteFrameTimer: 0,
      spriteFrameRate: visual.spriteFrameRate ?? 0,
      usesSpriteBillboard: visual.usesSpriteBillboard ?? false,
    });

    return true;
  }

  update(deltaSeconds: number): void {
    if (this.active.length === 0 || deltaSeconds <= 0) {
      return;
    }

    const dt = Math.min(deltaSeconds, 0.05);

    for (let i = this.active.length - 1; i >= 0; i--) {
      const proj = this.active[i];
      if (!proj.mesh.isDisposed()) {
        this.stepProjectile(proj, dt);
      } else {
        this.disposeProjectile(proj, i);
      }
    }
  }

  disposeAll(): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      this.disposeProjectile(this.active[i], i);
    }
  }

  private stepProjectile(proj: ActiveProjectile3D, dt: number): void {
    proj.traveled += proj.profile.speed * dt;
    if (proj.traveled > proj.maxRange || proj.traveled / proj.profile.speed > MAX_LIFETIME_SEC) {
      this.removeByReference(proj);
      return;
    }

    const step = proj.profile.speed * dt;
    const next = proj.mesh.position.add(proj.direction.scale(step));

    const substeps = Math.max(1, Math.ceil(step / 0.12));
    for (let s = 1; s <= substeps; s++) {
      const t = s / substeps;
      const sample = Vector3.Lerp(
        proj.lastPosition,
        next,
        t,
      );

      const wallHit = segmentCrossesWall(
        this.gridContext,
        proj.lastPosition,
        sample,
      );
      if (wallHit) {
        proj.onWallHit?.(wallHit.clone());
        this.removeByReference(proj);
        return;
      }

      if (isGridBlocked(this.gridContext, sample)) {
        proj.onWallHit?.(sample.clone());
        this.removeByReference(proj);
        return;
      }

      const enemy = findEnemyHit(
        sample,
        proj.profile.hitRadius,
        proj.enemies,
      );
      if (enemy) {
        proj.onEnemyHit(enemy);
        this.removeByReference(proj);
        return;
      }
    }

    proj.mesh.position.copyFrom(next);
    proj.lastPosition.copyFrom(next);

    if (proj.spriteFrames && proj.spriteFrames.length > 0 && proj.spriteFrameRate > 0) {
      proj.spriteFrameTimer += dt;
      const frameDuration = 1 / proj.spriteFrameRate;
      while (proj.spriteFrameTimer >= frameDuration) {
        proj.spriteFrameTimer -= frameDuration;
        proj.spriteFrameIndex =
          (proj.spriteFrameIndex + 1) % proj.spriteFrames.length;
        const frame = proj.spriteFrames[proj.spriteFrameIndex];
        applyProjectileSpriteFrame(proj.material, frame);
      }
    }

    this.applyProjectileOrientation(proj, dt);
  }

  private applyProjectileOrientation(proj: ActiveProjectile3D, dt: number): void {
    if (proj.profile.visual === "arrow") {
      alignArrowToFlight(proj.mesh, proj.direction);
      return;
    }
    if (proj.profile.visual === "throwing_star") {
      proj.spin += dt * 14;
      proj.mesh.rotation.y = proj.spin;
    }
  }

  private removeByReference(proj: ActiveProjectile3D): void {
    const index = this.active.indexOf(proj);
    if (index >= 0) {
      this.disposeProjectile(proj, index);
    }
  }

  private disposeProjectile(proj: ActiveProjectile3D, index: number): void {
    proj.spriteFrames?.forEach((texture) => texture.dispose());
    proj.mesh.dispose();
    proj.material.dispose();
    this.active.splice(index, 1);
  }
}

export function resolveProjectile3DProfile(
  weaponId: string,
): Projectile3DProfile {
  if (weaponId === "throwing_star") {
    return {
      visual: "throwing_star",
      speed: 16,
      hitRadius: 0.34,
    };
  }
  return {
    visual: "arrow",
    speed: 20,
    hitRadius: 0.3,
  };
}
