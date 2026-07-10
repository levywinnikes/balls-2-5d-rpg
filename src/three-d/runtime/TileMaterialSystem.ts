import type { Scene } from "@babylonjs/core";
import { Color3, DynamicTexture, StandardMaterial } from "@babylonjs/core";
import type { SliceTileDefinition } from "./SliceTileTypes";

export const safeTileColor = (hexColor: string | undefined, fallback: string) => {
  const color = (hexColor || fallback).trim();
  try {
    return Color3.FromHexString(color);
  } catch {
    return Color3.FromHexString(fallback);
  }
};

const normalizeTileHexColor = (
  colorValue: string | number | undefined,
  fallback: string,
) => {
  if (typeof colorValue === "number" && Number.isFinite(colorValue)) {
    return `#${(colorValue >>> 0)
      .toString(16)
      .padStart(6, "0")
      .slice(-6)}`.toLowerCase();
  }

  if (typeof colorValue === "string") {
    const trimmed = colorValue.trim();
    if (!trimmed) {
      return fallback.toLowerCase();
    }

    if (trimmed.startsWith("#")) {
      return trimmed.toLowerCase();
    }

    if (/^0x[0-9a-f]{6}$/i.test(trimmed)) {
      return `#${trimmed.slice(2)}`.toLowerCase();
    }

    if (/^[0-9a-f]{6}$/i.test(trimmed)) {
      return `#${trimmed}`.toLowerCase();
    }

    return trimmed.toLowerCase();
  }

  return fallback.toLowerCase();
};

const color3ToCss = (color: Color3) => {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgb(${r}, ${g}, ${b})`;
};

const shadeColor = (color: Color3, factor: number) => {
  const next = new Color3(
    Math.max(0, Math.min(1, color.r * factor)),
    Math.max(0, Math.min(1, color.g * factor)),
    Math.max(0, Math.min(1, color.b * factor)),
  );
  return color3ToCss(next);
};

const inferTileMaterialKind = (
  symbol: string | null,
  tileDef?: SliceTileDefinition,
) => {
  const tileId = (tileDef?.id || symbol || "").toLowerCase();
  if (tileId.includes("sewer")) return "sewer";
  if (tileId.includes("roof")) return "roof";
  if (
    tileId.includes("cob") ||
    tileId.includes("stone") ||
    tileId.includes("pave") ||
    tileId.includes("plaza") ||
    tileId.includes("dungeon") ||
    tileId.includes("cave")
  ) {
    return "cobblestone";
  }
  if (tileId.includes("grass") || tileId.includes("park")) return "grass";
  if (tileId.includes("water")) return "water";
  if (tileId.includes("wood") || tileId.includes("floor")) return "wood";
  if (tileDef?.renderAs === "block" || tileDef?.block) return "wall";
  return "plain";
};

const drawProceduralTileTexture = (
  texture: DynamicTexture,
  kind: string,
  baseColor: Color3,
) => {
  const size = 64;
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = color3ToCss(baseColor);
  ctx.fillRect(0, 0, size, size);

  if (kind === "grass") {
    ctx.fillStyle = shadeColor(baseColor, 0.8);
    for (let index = 0; index < 24; index += 1) {
      const x = (index * 13) % size;
      const y = (index * 29) % size;
      ctx.beginPath();
      ctx.arc(x + 4, y + 4, 3 + (index % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = shadeColor(baseColor, 1.15);
    for (let index = 0; index < 18; index += 1) {
      const x = (index * 19 + 7) % size;
      const y = (index * 11 + 5) % size;
      ctx.fillRect(x, y, 3, 2);
    }
  } else if (kind === "cobblestone") {
    const stones = [
      [4, 4, 22, 18, 1.18],
      [30, 6, 24, 16, 0.72],
      [6, 30, 18, 24, 0.78],
      [30, 32, 26, 20, 1.16],
    ];
    stones.forEach(([sx, sy, width, height, tone]) => {
      ctx.fillStyle = shadeColor(baseColor, tone as number);
      ctx.fillRect(
        sx as number,
        sy as number,
        width as number,
        height as number,
      );
      ctx.strokeStyle = shadeColor(baseColor, 0.45);
      ctx.lineWidth = 2;
      ctx.strokeRect(
        sx as number,
        sy as number,
        width as number,
        height as number,
      );
    });
  } else if (kind === "wet-cobble") {
    const stones = [
      [4, 4, 22, 18, 0.62],
      [30, 6, 24, 16, 0.48],
      [6, 30, 18, 24, 0.52],
      [30, 32, 26, 20, 0.58],
    ];
    stones.forEach(([sx, sy, width, height, tone]) => {
      ctx.fillStyle = shadeColor(baseColor, tone as number);
      ctx.fillRect(
        sx as number,
        sy as number,
        width as number,
        height as number,
      );
    });
    ctx.fillStyle = "rgba(120,180,220,0.22)";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(10, 8, 20, 3);
    ctx.fillRect(36, 28, 14, 2);
  } else if (kind === "roof") {
    const tileW = 20;
    const tileH = 14;
    const overlap = 4;
    for (let row = 0; row * (tileH - overlap) < size + tileH; row++) {
      const rowY = row * (tileH - overlap);
      const offsetX = (row % 2) * (tileW / 2);
      for (let col = -1; col * tileW < size + tileW; col++) {
        const tx = col * tileW + offsetX;
        ctx.fillStyle = shadeColor(baseColor, 0.9 + ((row + col) % 3) * 0.07);
        ctx.fillRect(tx + 1, rowY + 1, tileW - 2, tileH - 1);
        ctx.fillStyle = shadeColor(baseColor, 0.55);
        ctx.fillRect(tx + 1, rowY + tileH - 2, tileW - 2, 2);
        ctx.fillStyle = shadeColor(baseColor, 1.18);
        ctx.fillRect(tx + 1, rowY + 1, tileW - 2, 2);
        ctx.fillStyle = shadeColor(baseColor, 0.48);
        ctx.fillRect(tx, rowY, 1, tileH);
      }
    }
    ctx.fillStyle = shadeColor(baseColor, 0.55);
    ctx.fillRect(0, 0, size, 2);
    ctx.fillRect(0, size - 2, size, 2);
    ctx.fillRect(0, 0, 2, size);
    ctx.fillRect(size - 2, 0, 2, size);
  } else if (kind === "wood") {
    ctx.strokeStyle = shadeColor(baseColor, 0.55);
    ctx.lineWidth = 2;
    for (let x = 0; x <= size; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    ctx.strokeStyle = shadeColor(baseColor, 1.12);
    ctx.lineWidth = 1;
    for (let row = 0; row < size; row += 8) {
      const knotX = (row * 7) % (size - 8);
      ctx.beginPath();
      ctx.moveTo(0, row + 1);
      ctx.lineTo(size, row + 1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(knotX + 4, row + 4, 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (kind === "sewer") {
    ctx.strokeStyle = shadeColor(baseColor, 0.52);
    ctx.lineWidth = 1.5;
    for (let y = 0; y <= size; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
      const offset = y % 24 === 0 ? 0 : 6;
      for (let x = offset; x <= size; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 12);
        ctx.stroke();
      }
    }
    ctx.fillStyle = shadeColor(baseColor, 1.18);
    ctx.fillRect(6, 6, 8, 2);
    ctx.fillRect(34, 20, 7, 2);
    ctx.fillRect(20, 44, 10, 2);
  } else if (kind === "water") {
    ctx.fillStyle = shadeColor(baseColor, 0.88);
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1.5;
    for (let wave = 0; wave < 3; wave += 1) {
      const y = 12 + wave * 16;
      ctx.beginPath();
      ctx.moveTo(4, y);
      ctx.quadraticCurveTo(16, y + 3, 28, y);
      ctx.quadraticCurveTo(40, y - 3, 60, y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(8, 6, 14, 4);
  } else if (kind === "wall") {
    ctx.strokeStyle = shadeColor(baseColor, 0.48);
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);
    ctx.lineWidth = 1.5;
    for (let y = 0; y <= size; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
      const offset = y % 32 === 0 ? 0 : 8;
      for (let x = offset; x <= size; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 16);
        ctx.stroke();
      }
    }
    ctx.fillStyle = shadeColor(baseColor, 1.08);
    for (let index = 0; index < 10; index += 1) {
      const x = (index * 17 + 9) % (size - 6);
      const y = (index * 13 + 5) % (size - 6);
      ctx.fillRect(x, y, 3, 3);
    }
  } else {
    ctx.fillStyle = shadeColor(baseColor, 0.96);
    for (let index = 0; index < 16; index += 1) {
      const x = (index * 9) % size;
      const y = (index * 21) % size;
      ctx.fillRect(x, y, 4, 4);
    }
  }

  texture.update(false);
};

const createProceduralTileMaterial = (
  materialKey: string,
  kind: string,
  baseColor: Color3,
  scene: Scene,
) => {
  const material = new StandardMaterial(materialKey, scene);
  const texture = new DynamicTexture(
    `${materialKey}-texture`,
    { width: 64, height: 64 },
    scene,
    false,
  );
  drawProceduralTileTexture(texture, kind, baseColor);
  texture.wrapU = 1;
  texture.wrapV = 1;
  material.diffuseTexture = texture;
  material.diffuseColor = Color3.White();
  material.specularColor = new Color3(0.06, 0.06, 0.06);
  material.ambientColor = baseColor.scale(0.35);
  material.backFaceCulling = false;
  return material;
};

export class TileMaterialSystem {
  readonly tileMaterials = new Map<string, StandardMaterial>();
  readonly tileMaterialLRU: string[] = [];

  private static readonly CACHE_LIMIT = 256;

  constructor(private readonly scene: Scene) {}

  getTileMaterial(
    symbol: string | null,
    tileDef?: SliceTileDefinition,
    fallbackHexColor = "#6a9f36",
  ): StandardMaterial {
    const baseHex = normalizeTileHexColor(
      tileDef?.color as string | number | undefined,
      fallbackHexColor,
    );
    const kind = inferTileMaterialKind(symbol, tileDef);
    const materialKey = `${kind}:${baseHex}`;
    const existing = this.tileMaterials.get(materialKey);
    if (existing) {
      const idx = this.tileMaterialLRU.indexOf(materialKey);
      if (idx !== -1) this.tileMaterialLRU.splice(idx, 1);
      this.tileMaterialLRU.push(materialKey);
      return existing;
    }

    if (this.tileMaterials.size >= TileMaterialSystem.CACHE_LIMIT) {
      const oldest = this.tileMaterialLRU.shift();
      if (oldest) {
        this.tileMaterials.delete(oldest);
      }
    }

    const material = createProceduralTileMaterial(
      `slice-tile-${materialKey.replace(/[^a-z0-9:]/gi, "-")}`,
      kind,
      safeTileColor(baseHex, fallbackHexColor),
      this.scene,
    );
    this.tileMaterials.set(materialKey, material);
    this.tileMaterialLRU.push(materialKey);
    return material;
  }

  dispose(): void {
    this.tileMaterials.forEach((material) => material.dispose());
    this.tileMaterials.clear();
    this.tileMaterialLRU.length = 0;
  }
}
