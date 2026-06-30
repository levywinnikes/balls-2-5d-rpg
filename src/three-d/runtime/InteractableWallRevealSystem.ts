import {
  Color3,
  DynamicTexture,
  Material,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { hasClearGridLineOfSight } from "./WallRevealLos";

export type InteractableRevealKind = "enemy" | "door";

export type InteractableRevealTarget = {
  id: string;
  kind: InteractableRevealKind;
  level: string;
  position: Vector3;
  /** Invisible pick volume (enemy pick-proxy size). */
  pickWidth: number;
  pickHeight: number;
  pickCenterY: number;
  pickMetadata: Record<string, string>;
};

type InteractableWallRevealOptions = {
  revealRadiusTiles?: number;
  floorRingRadius?: number;
  gridOrigin?: number;
};

/** Draw over walls — floor ring only, never a vertical sprite on the wall face. */
const DEPTH_ALWAYS = 519;

const RING_TINT: Record<InteractableRevealKind, Color3> = {
  enemy: Color3.FromHexString("#f59e0b"),
  door: Color3.FromHexString("#60a5fa"),
};

function worldToGrid(value: number, gridOrigin: number): number {
  return Math.floor(value + gridOrigin);
}

function createFloorRingMaterial(
  scene: Scene,
  kind: InteractableRevealKind,
): StandardMaterial {
  const tint = RING_TINT[kind];
  const size = 128;
  const texture = new DynamicTexture(
    `occluded-floor-ring-${kind}`,
    size,
    scene,
    false,
  );
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  const cx = size / 2;
  const gradient = ctx.createRadialGradient(cx, cx, 4, cx, cx, cx);
  gradient.addColorStop(
    0,
    `rgba(${Math.round(tint.r * 255)}, ${Math.round(tint.g * 255)}, ${Math.round(tint.b * 255)}, 0.05)`,
  );
  gradient.addColorStop(
    0.55,
    `rgba(${Math.round(tint.r * 255)}, ${Math.round(tint.g * 255)}, ${Math.round(tint.b * 255)}, 0.28)`,
  );
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cx, cx - 2, 0, Math.PI * 2);
  ctx.fill();
  texture.update();

  const material = new StandardMaterial(`occluded-floor-ring-mat-${kind}`, scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  material.opacityTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.emissiveColor = tint;
  material.specularColor = Color3.Black();
  material.disableLighting = true;
  material.disableDepthWrite = true;
  material.backFaceCulling = false;
  material.transparencyMode = Material.MATERIAL_ALPHABLEND;
  material.alpha = 0.75;
  material.depthFunction = DEPTH_ALWAYS;
  return material;
}

type ActiveOccludedTarget = {
  id: string;
  kind: InteractableRevealKind;
  worldX: number;
  worldZ: number;
  pickRadius: number;
  pickMetadata: Record<string, string>;
};

type ProxyRecord = {
  root: TransformNode;
  floorRing: Mesh;
  kind: InteractableRevealKind;
};

/**
 * Occluded interactables: subtle pickable floor ring (no vertical pick mesh — avoids black quads).
 */
export class InteractableWallRevealSystem {
  private readonly revealRadiusTiles: number;

  private readonly floorRingRadius: number;

  private readonly gridOrigin: number;

  private readonly ringMaterials = new Map<InteractableRevealKind, StandardMaterial>();

  private readonly activeProxies = new Map<string, ProxyRecord>();

  private readonly proxyPool: ProxyRecord[] = [];

  private activeOccludedTargets: ActiveOccludedTarget[] = [];

  private pulseT = 0;

  constructor(
    private scene: Scene,
    private parent: TransformNode,
    options?: InteractableWallRevealOptions,
  ) {
    this.revealRadiusTiles = options?.revealRadiusTiles ?? 20;
    this.floorRingRadius = options?.floorRingRadius ?? 0.42;
    this.gridOrigin = options?.gridOrigin ?? 0;
  }

  update(
    enabled: boolean,
    observer: Vector3,
    activeLevel: string,
    targets: InteractableRevealTarget[],
    navigationGrid: number[][],
    navigationGridSize: number,
    deltaSeconds: number,
    floorSurfaceOffset: number,
  ): void {
    if (!enabled) {
      this.hideAllProxies();
      this.activeOccludedTargets = [];
      return;
    }

    this.pulseT += deltaSeconds;
    const pulse = (Math.sin(this.pulseT * Math.PI * 1.2) * 0.5 + 0.5) * 0.1;

    const observerTileX = worldToGrid(observer.x, this.gridOrigin);
    const observerTileY = worldToGrid(observer.z, this.gridOrigin);
    const radiusSq = this.revealRadiusTiles * this.revealRadiusTiles;

    const nextIds = new Set<string>();
    const occludedThisFrame: ActiveOccludedTarget[] = [];

    for (const target of targets) {
      if (target.level !== activeLevel) {
        continue;
      }

      const targetTileX = worldToGrid(target.position.x, this.gridOrigin);
      const targetTileY = worldToGrid(target.position.z, this.gridOrigin);
      const dx = targetTileX - observerTileX;
      const dy = targetTileY - observerTileY;
      if (dx * dx + dy * dy > radiusSq) {
        continue;
      }

      if (
        hasClearGridLineOfSight(
          navigationGrid,
          navigationGridSize,
          observerTileX,
          observerTileY,
          targetTileX,
          targetTileY,
        )
      ) {
        continue;
      }

      nextIds.add(target.id);
      occludedThisFrame.push({
        id: target.id,
        kind: target.kind,
        worldX: target.position.x,
        worldZ: target.position.z,
        pickRadius: Math.max(
          this.floorRingRadius,
          target.pickWidth * 0.45,
        ),
        pickMetadata: target.pickMetadata,
      });

      const record = this.ensureProxy(target);
      const ringScale = (1 + pulse * 0.08) * this.floorRingRadius * 2;

      record.root.position.copyFrom(target.position);
      record.floorRing.position.y = floorSurfaceOffset;
      record.floorRing.scaling.set(ringScale, 1, ringScale);
      record.floorRing.metadata = {
        ...target.pickMetadata,
        sliceRevealProxy: true,
      };
      record.root.setEnabled(true);

      const ringMat = record.floorRing.material as StandardMaterial | null;
      if (ringMat) {
        ringMat.alpha = 0.48 + pulse * 0.2;
      }
    }

    this.activeOccludedTargets = occludedThisFrame;

    this.activeProxies.forEach((record, id) => {
      if (!nextIds.has(id)) {
        record.root.setEnabled(false);
        this.proxyPool.push(record);
        this.activeProxies.delete(id);
      }
    });
  }

  /** Ground-click fallback when the wall mesh wins the first pick ray. */
  findOccludedTargetNear(
    worldX: number,
    worldZ: number,
    maxDistance: number,
  ): ActiveOccludedTarget | null {
    let best: ActiveOccludedTarget | null = null;
    let bestDist = maxDistance + 1;

    for (const target of this.activeOccludedTargets) {
      const dx = target.worldX - worldX;
      const dz = target.worldZ - worldZ;
      const dist = Math.hypot(dx, dz);
      const limit = Math.max(maxDistance, target.pickRadius);
      if (dist <= limit && dist < bestDist) {
        best = target;
        bestDist = dist;
      }
    }

    return best;
  }

  dispose(): void {
    this.activeProxies.forEach((record) => {
      record.floorRing.dispose();
      record.root.dispose();
    });
    this.proxyPool.forEach((record) => {
      record.floorRing.dispose();
      record.root.dispose();
    });
    this.activeProxies.clear();
    this.proxyPool.length = 0;
    this.ringMaterials.forEach((material) => material.dispose());
    this.ringMaterials.clear();
  }

  private hideAllProxies(): void {
    this.activeProxies.forEach((record) => {
      record.root.setEnabled(false);
      this.proxyPool.push(record);
    });
    this.activeProxies.clear();
    this.activeOccludedTargets = [];
  }

  private ensureProxy(target: InteractableRevealTarget): ProxyRecord {
    const existing = this.activeProxies.get(target.id);
    if (existing) {
      return existing;
    }

    const pooled = this.proxyPool.pop();
    if (pooled) {
      this.activeProxies.set(target.id, pooled);
      return pooled;
    }

    const root = new TransformNode(`occluded-proxy-${target.id}`, this.scene);
    root.parent = this.parent;

    const floorRing = MeshBuilder.CreateDisc(
      `occluded-ring-${target.id}`,
      { radius: 0.5, tessellation: 32 },
      this.scene,
    );
    floorRing.parent = root;
    floorRing.rotation.x = Math.PI / 2;
    floorRing.renderingGroupId = 2;
    floorRing.isPickable = true;
    floorRing.material = this.getRingMaterial(target.kind);
    floorRing.metadata = { ...target.pickMetadata, sliceRevealProxy: true };

    const record: ProxyRecord = {
      root,
      floorRing,
      kind: target.kind,
    };
    this.activeProxies.set(target.id, record);
    return record;
  }

  private getRingMaterial(kind: InteractableRevealKind): StandardMaterial {
    const cached = this.ringMaterials.get(kind);
    if (cached) {
      return cached;
    }
    const material = createFloorRingMaterial(this.scene, kind);
    this.ringMaterials.set(kind, material);
    return material;
  }
}
