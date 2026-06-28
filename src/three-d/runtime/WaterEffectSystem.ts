import {
  Color3,
  DynamicTexture,
  Effect,
  Material,
  Mesh,
  Observer,
  Scene,
  ShaderMaterial,
  Texture,
  TransformNode,
  VertexData,
} from "@babylonjs/core";
import { isWaterTileId } from "./WaterProfile";
import { WATER_SURFACE_RENDERING_GROUP } from "./BillboardDepthConfig";

export type WaterEffectTileDesc = {
  x: number;
  y: number;
  tileId: string;
  levelKey: string;
  levelOffsetY: number;
};

const SHADER_NAME = "waterEffectRipple";

let shadersRegistered = false;

function registerWaterShaders() {
  if (shadersRegistered) {
    return;
  }
  shadersRegistered = true;

  Effect.ShadersStore[`${SHADER_NAME}VertexShader`] = `
    precision highp float;
    attribute vec3 position;
    attribute vec2 uv;
    uniform mat4 worldViewProjection;
    uniform float time;
    varying vec2 vUV;
    varying float vWave;

    void main(void) {
      vec3 p = position;
      float w1 = sin(p.x * 5.5 + time * 2.1) * 0.016;
      float w2 = sin(p.z * 4.8 + time * 1.7) * 0.013;
      float w3 = sin((p.x + p.z) * 3.2 + time * 2.8) * 0.009;
      float w4 = sin(p.x * 2.4 - p.z * 2.1 + time * 1.3) * 0.006;
      float wave = w1 + w2 + w3 + w4;
      p.y += wave;
      vWave = wave;
      vUV = uv;
      gl_Position = worldViewProjection * vec4(p, 1.0);
    }
  `;

  Effect.ShadersStore[`${SHADER_NAME}FragmentShader`] = `
    precision highp float;
    varying vec2 vUV;
    varying float vWave;
    uniform float time;
    uniform sampler2D waterTex;
    uniform vec3 waterTint;
    uniform float waterAlpha;

    void main(void) {
      vec2 uvA = vUV * 0.85 + vec2(time * 0.07, time * 0.05);
      vec2 uvB = vUV * 1.15 + vec2(-time * 0.05, time * 0.08);
      vec4 sampleA = texture2D(waterTex, fract(uvA));
      vec4 sampleB = texture2D(waterTex, fract(uvB));
      vec3 caustic = mix(sampleA.rgb, sampleB.rgb, 0.5);
      float highlight = 0.5 + vWave * 14.0;
      vec3 color = waterTint * (0.76 + caustic.g * 0.24) + vec3(highlight * 0.1);
      float alpha = waterAlpha * (0.58 + (sampleA.a + sampleB.a) * 0.18 + abs(vWave) * 6.0);
      gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.78));
    }
  `;
}

function drawCausticTile(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = "rgba(28, 88, 118, 0.82)";
  ctx.fillRect(0, 0, size, size);

  for (let band = 0; band < 8; band += 1) {
    const y = 4 + band * 16;
    ctx.strokeStyle = `rgba(${72 + band * 6}, ${140 + band * 4}, ${168 + band * 3}, 0.35)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 4) {
      ctx.lineTo(x, y + Math.sin(x * 0.28 + band * 0.9) * 3);
    }
    ctx.stroke();
  }

  for (let spot = 0; spot < 24; spot += 1) {
    const sx = (spot * 17 + 11) % size;
    const sy = (spot * 23 + 7) % size;
    const r = 2 + (spot % 3);
    ctx.fillStyle = `rgba(160, 220, 240, ${0.08 + (spot % 5) * 0.03})`;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function buildMergedLayer(
  tiles: WaterEffectTileDesc[],
  layerY: number,
): { positions: number[]; indices: number[]; uvs: number[] } {
  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  let base = 0;

  for (const tile of tiles) {
    const x0 = tile.x;
    const x1 = tile.x + 1;
    const z0 = tile.y;
    const z1 = tile.y + 1;

    positions.push(x0, layerY, z0, x0, layerY, z1, x1, layerY, z1, x1, layerY, z0);
    uvs.push(x0, z0, x0, z1, x1, z1, x1, z0);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }

  return { positions, indices, uvs };
}

function applyGeometry(mesh: Mesh, geom: ReturnType<typeof buildMergedLayer>) {
  const normals = new Array<number>(geom.positions.length).fill(0);
  VertexData.ComputeNormals(geom.positions, geom.indices, normals);
  const vd = new VertexData();
  vd.positions = geom.positions;
  vd.indices = geom.indices;
  vd.normals = normals;
  vd.uvs = geom.uvs;
  vd.applyToMesh(mesh);
}

/**
 * Water is NOT a flat terrain sticker.
 *
 * - `wat` / `wtr` carve a pit in the worker (`water-hole` profile).
 * - This system draws only the animated liquid surface at the pit rim.
 */
export class WaterEffectSystem {
  private chunkMeshes = new Map<string, Mesh[]>();

  private surfaceMaterial: ShaderMaterial;

  private waterTexture: DynamicTexture;

  private animObserver: Observer<Scene> | null = null;

  private timeSec = 0;

  constructor(
    private scene: Scene,
    private parent: TransformNode,
    private floorOffsetY: number,
  ) {
    registerWaterShaders();

    this.waterTexture = new DynamicTexture(
      "water-caustic-tex",
      { width: 128, height: 128 },
      scene,
      false,
    );
    this.waterTexture.hasAlpha = true;
    this.waterTexture.wrapU = Texture.WRAP_ADDRESSMODE;
    this.waterTexture.wrapV = Texture.WRAP_ADDRESSMODE;
    this.waterTexture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
    const ctx = this.waterTexture.getContext() as unknown as CanvasRenderingContext2D;
    drawCausticTile(ctx, 128);
    this.waterTexture.update(false);

    this.surfaceMaterial = new ShaderMaterial(
      "water-effect-mat",
      scene,
      { vertex: SHADER_NAME, fragment: SHADER_NAME },
      {
        attributes: ["position", "uv"],
        uniforms: ["worldViewProjection", "time", "waterTint", "waterAlpha"],
        samplers: ["waterTex"],
        needAlphaBlending: true,
      },
    );
    this.surfaceMaterial.setTexture("waterTex", this.waterTexture);
    this.surfaceMaterial.setColor3("waterTint", Color3.FromHexString("#2d8cb0"));
    this.surfaceMaterial.setFloat("waterAlpha", 0.48);
    this.surfaceMaterial.backFaceCulling = false;
    this.surfaceMaterial.disableDepthWrite = true;
    this.surfaceMaterial.transparencyMode = Material.MATERIAL_ALPHABLEND;

    this.animObserver = scene.onBeforeRenderObservable.add(() => {
      this.timeSec += scene.getEngine().getDeltaTime() / 1000;
      this.surfaceMaterial.setFloat("time", this.timeSec);
    });
  }

  syncChunk(
    chunkKey: string,
    tiles: WaterEffectTileDesc[],
    occlusionStartLevel: number | null,
  ) {
    this.clearChunk(chunkKey);
    if (tiles.length === 0) {
      return;
    }

    const byLevel = new Map<string, WaterEffectTileDesc[]>();
    tiles.forEach((tile) => {
      const list = byLevel.get(tile.levelKey) ?? [];
      list.push(tile);
      byLevel.set(tile.levelKey, list);
    });

    const meshes: Mesh[] = [];

    byLevel.forEach((levelTiles, levelKey) => {
      const levelNum = Number.parseInt(levelKey, 10) || 0;
      const rimY = levelTiles[0].levelOffsetY + this.floorOffsetY;
      const surfaceY = rimY + 0.002;

      const surfaceGeom = buildMergedLayer(levelTiles, surfaceY);
      if (surfaceGeom.positions.length > 0) {
        const surface = new Mesh(`water-surface-${chunkKey}-${levelKey}`, this.scene);
        applyGeometry(surface, surfaceGeom);
        surface.material = this.surfaceMaterial;
        surface.parent = this.parent;
        surface.isPickable = false;
        surface.renderingGroupId = WATER_SURFACE_RENDERING_GROUP;
        surface.alphaIndex = 1;
        surface.metadata = { waterLevelNum: levelNum, role: "surface" };
        meshes.push(surface);
      }

      const shouldHide =
        occlusionStartLevel !== null && levelNum >= occlusionStartLevel;
      if (shouldHide) {
        meshes.forEach((mesh) => {
          mesh.visibility = 0;
          mesh.setEnabled(false);
        });
      }
    });

    this.chunkMeshes.set(chunkKey, meshes);
  }

  updateOcclusion(occlusionStartLevel: number | null, deltaSeconds: number) {
    const lerpFactor = Math.min(1, deltaSeconds * 8);

    this.chunkMeshes.forEach((meshes) => {
      meshes.forEach((mesh) => {
        if (!mesh || mesh.isDisposed()) {
          return;
        }
        const levelNum =
          typeof mesh.metadata?.waterLevelNum === "number"
            ? mesh.metadata.waterLevelNum
            : 0;
        const shouldHide =
          occlusionStartLevel !== null && levelNum >= occlusionStartLevel;
        const target = shouldHide ? 0 : 1;

        if (target >= 1) {
          mesh.visibility = 1;
          mesh.setEnabled(true);
          return;
        }

        const next = mesh.visibility + (target - mesh.visibility) * lerpFactor;
        mesh.visibility = next;
        if (next <= 0.01) {
          mesh.visibility = 0;
          mesh.setEnabled(false);
        }
      });
    });
  }

  clearChunk(chunkKey: string) {
    const meshes = this.chunkMeshes.get(chunkKey);
    if (!meshes) {
      return;
    }
    meshes.forEach((mesh) => mesh.dispose());
    this.chunkMeshes.delete(chunkKey);
  }

  dispose() {
    if (this.animObserver) {
      this.scene.onBeforeRenderObservable.remove(this.animObserver);
      this.animObserver = null;
    }
    this.chunkMeshes.forEach((meshes) => meshes.forEach((mesh) => mesh.dispose()));
    this.chunkMeshes.clear();
    this.surfaceMaterial.dispose();
    this.waterTexture.dispose();
  }
}

export function collectWaterEffectTiles(
  tiles: Array<{
    x: number;
    y: number;
    tileId: string;
    levelOffsetY: number;
    levelKey: string;
  }>,
  levelHeightUnits: number,
): WaterEffectTileDesc[] {
  return tiles
    .filter((tile) => isWaterTileId(tile.tileId))
    .map((tile) => ({
      x: tile.x,
      y: tile.y,
      tileId: tile.tileId,
      levelKey:
        tile.levelKey ||
        String(Math.round(tile.levelOffsetY / levelHeightUnits)),
      levelOffsetY: tile.levelOffsetY,
    }));
}
