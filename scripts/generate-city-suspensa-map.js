/**
 * generate-city-suspensa-map.js
 *
 * Gera o mapa "cidade_suspensa" — uma cidade flutuante no ar com:
 *   Nivel 0: ilha principal de pedra com ruas, edificios, escadas para nivel 1
 *   Nivel 1: torres e passarelas no alto (default sky/void)
 *
 * Default de TODOS os niveis: "..." (vazio/abismo). Apenas tiles explicitamente
 * colocados existem — tudo ao redor e abaixo e queda livre.
 *
 * Uso: node scripts/generate-city-suspensa-map.js
 * Saida: public/maps/cidade_suspensa.json + public/maps/cidade_suspensa_0.bin + _1.bin
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ─── Config ──────────────────────────────────────────────────────────────────
const MAP_NAME = "cidade_suspensa";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "maps");
const W = 100;
const H = 100;

// ─── Tile Atlas (compativel com o runtime existente) ─────────────────────────
// Mesmos 23 simbolos do generate-multilevel-3d-map.js — runtime ja conhece todos.
const ATLAS = [
  "...", // 0  void/sky/abismo
  "cob", // 1  cobblestone (rua)
  "wal", // 2  parede externa
  "bwl", // 3  parede de tijolo
  "flr", // 4  chao de pedra interno
  "rof", // 5  telhado
  "grs", // 6  grama (nao usado aqui, mas mantido para paridade)
  "stn", // 7  plataforma de pedra (base da ilha)
  "mkt", // 8  mercado
  "pil", // 9  pilar
  "fnt", // 10 fonte
  "tre", // 11 arvore
  "dwl", // 12 habitacao
  "arc", // 13 arco
  "sdw", // 14 sombra/decoracao
  "stu", // 15 escada para cima
  "std", // 16 escada para baixo
  "swl", // 17 parede de pedra subterranea
  "sfl", // 18 chao de pedra subterraneo
  "cfl", // 19 chao de caverna
  "cwl", // 20 parede de caverna
  "wtr", // 21 agua
  "bal", // 22 varanda/passarela
];

// Gable roof tiles (indices 23-27). All ids contain "roof" → isRoofTile=true.
ATLAS.push(
  "rsn", // 23 – roof slope north
  "rss", // 24 – roof slope south
  "rse", // 25 – roof slope east
  "rsw", // 26 – roof slope west
  "rrd", // 27 – roof ridge cap
);

// ─── Tile Definitions ─────────────────────────────────────────────────────────
const TILE_DEFS = {
  "...": { color: 0x000000, height: 0, renderAs: "empty", block: false },
  cob: { color: 0x888880, height: 0.15, renderAs: "floor", block: false },
  wal: { color: 0x706050, height: 2.0, renderAs: "wall", block: true },
  bwl: { color: 0x8b4513, height: 2.0, renderAs: "wall", block: true },
  flr: { color: 0x999090, height: 0.15, renderAs: "floor", block: false },
  rof: { color: 0x5a3e28, height: 0.3, renderAs: "roof", block: false },
  rsn: { id: "roof-slope-n", color: 0xb84c18, height: 0.8, block: false },
  rss: { id: "roof-slope-s", color: 0xb84c18, height: 0.8, block: false },
  rse: { id: "roof-slope-e", color: 0xb84c18, height: 0.8, block: false },
  rsw: { id: "roof-slope-w", color: 0xb84c18, height: 0.8, block: false },
  rrd: { id: "roof-ridge", color: 0x7a3010, height: 0.8, block: false },
  grs: { color: 0x4a7c3f, height: 0.2, renderAs: "floor", block: false },
  stn: { color: 0x808080, height: 0.25, renderAs: "floor", block: false },
  mkt: { color: 0xd4a017, height: 0.2, renderAs: "floor", block: false },
  pil: { color: 0x606060, height: 2.5, renderAs: "wall", block: true },
  fnt: { color: 0x4090c0, height: 0.5, renderAs: "floor", block: false },
  tre: { color: 0x226622, height: 2.0, renderAs: "wall", block: true },
  dwl: { color: 0xa07050, height: 2.0, renderAs: "wall", block: true },
  arc: { color: 0x909090, height: 2.2, renderAs: "wall", block: true },
  sdw: { color: 0x404040, height: 0.05, renderAs: "floor", block: false },
  stu: {
    color: 0xc8b040,
    height: 0.5,
    renderAs: "floor",
    block: false,
    stairDir: "up",
  },
  std: {
    color: 0xc89040,
    height: 0.5,
    renderAs: "floor",
    block: false,
    stairDir: "down",
  },
  swl: { color: 0x505060, height: 2.0, renderAs: "wall", block: true },
  sfl: { color: 0x606878, height: 0.15, renderAs: "floor", block: false },
  cfl: { color: 0x554444, height: 0.15, renderAs: "floor", block: false },
  cwl: { color: 0x443333, height: 2.0, renderAs: "wall", block: true },
  wtr: { color: 0x2060a0, height: 0.1, renderAs: "floor", block: false },
  bal: { color: 0x907060, height: 0.2, renderAs: "floor", block: false },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
// ─── Gable roof helper ───────────────────────────────────────────────────────
// Fills a rectangle on `grid` with directional slope tiles for a proper gable.
// See generate-giant-3d-map.js for full documentation.
function fillGableRoof(grid, x0, y0, x1, y1) {
  const w = x1 - x0 + 1;
  const d = y1 - y0 + 1;
  if (w >= d) {
    const halfD = Math.floor(d / 2);
    for (let dy = 0; dy < d; dy++) {
      const sym = dy < halfD ? "rsn" : dy > d - 1 - halfD ? "rss" : "rrd";
      for (let dx = 0; dx < w; dx++) set(grid, x0 + dx, y0 + dy, sym);
    }
  } else {
    const halfW = Math.floor(w / 2);
    for (let dx = 0; dx < w; dx++) {
      const sym = dx < halfW ? "rsw" : dx > w - 1 - halfW ? "rse" : "rrd";
      for (let dy = 0; dy < d; dy++) set(grid, x0 + dx, y0 + dy, sym);
    }
  }
}

const IDX = {};
ATLAS.forEach((sym, i) => (IDX[sym] = i));

function makeGrid(w, h, fillSym = "...") {
  const idx = IDX[fillSym];
  return Array.from({ length: h }, () => new Uint8Array(w).fill(idx));
}

function set(grid, x, y, sym) {
  if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = IDX[sym];
}

function fill(grid, x0, y0, x1, y1, sym) {
  const idx = IDX[sym];
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++)
      grid[y][x] = idx;
}

function rect(grid, x0, y0, x1, y1, wallSym, floorSym) {
  fill(grid, x0, y0, x1, y1, floorSym);
  fill(grid, x0, y0, x1, y0, wallSym);
  fill(grid, x0, y1, x1, y1, wallSym);
  fill(grid, x0, y0, x0, y1, wallSym);
  fill(grid, x1, y0, x1, y1, wallSym);
}

function makePRNG(seed) {
  let s = seed >>> 0;
  return function () {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

// ─── Nivel 0: Ilha principal flutuante ────────────────────────────────────────
// A ilha ocupa ~60x60 tiles no centro, rodeada de void (abismo).
// Layout: ruas de pedra (cob), quarteiroes com edificios (wal+flr), mercado
// central, escadas-para-cima (stu) nas extremidades dos quarteiroes.
function generateLevel0(rng) {
  const grid = makeGrid(W, H, "..."); // tudo vazio por padrao
  const roofRects = [];

  // Raio da ilha principal
  const cx = 50,
    cy = 50,
    radius = 28;

  // Preencher base da ilha com stone
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - cx,
        dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) set(grid, x, y, "stn");
    }

  // Borda da ilha — cobblestone como calçada de beira
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - cx,
        dy = y - cy;
      const r2 = dx * dx + dy * dy;
      if (r2 <= radius * radius && r2 >= (radius - 2) * (radius - 2))
        set(grid, x, y, "cob");
    }

  // Rua principal horizontal (centro)
  fill(grid, cx - radius + 2, cy - 1, cx + radius - 2, cy + 1, "cob");
  // Rua principal vertical (centro)
  fill(grid, cx - 1, cy - radius + 2, cx + 1, cy + radius - 2, "cob");

  // Ruas secundarias
  const streets = [cy - 12, cy + 12, cx - 12, cx + 12];
  fill(grid, cx - radius + 2, cy - 12, cx + radius - 2, cy - 11, "cob");
  fill(grid, cx - radius + 2, cy + 11, cx + radius - 2, cy + 12, "cob");
  fill(grid, cx - 12, cy - radius + 2, cx - 11, cy + radius - 2, "cob");
  fill(grid, cx + 11, cy - radius + 2, cx + 12, cy + radius - 2, "cob");

  // Quarteiroes — grade 3x3 de blocos construtivos
  const blocks = [
    [cx - 26, cy - 26, cx - 14, cy - 14],
    [cx - 10, cy - 26, cx + 10, cy - 14],
    [cx + 14, cy - 26, cx + 26, cy - 14],
    [cx - 26, cy - 10, cx - 14, cy + 10],
    // centro: praca publica
    [cx + 14, cy - 10, cx + 26, cy + 10],
    [cx - 26, cy + 14, cx - 14, cy + 26],
    [cx - 10, cy + 14, cx + 10, cy + 26],
    [cx + 14, cy + 14, cx + 26, cy + 26],
  ];

  const wallTypes = ["wal", "bwl", "dwl"];
  const stairUpPositions = [];

  blocks.forEach((b, i) => {
    const [x0, y0, x1, y1] = b;
    // Verifica que o bloco esta dentro da ilha
    const midX = Math.floor((x0 + x1) / 2);
    const midY = Math.floor((y0 + y1) / 2);
    const dx = midX - cx,
      dy = midY - cy;
    if (dx * dx + dy * dy > (radius - 3) * (radius - 3)) return;

    const wallSym = wallTypes[i % wallTypes.length];
    rect(grid, x0, y0, x1, y1, wallSym, "flr");
    roofRects.push({ x0, y0, x1, y1 });

    // Porta (abertura numa parede)
    const midWallX = Math.floor((x0 + x1) / 2);
    const midWallY = Math.floor((y0 + y1) / 2);
    set(grid, midWallX, y0, "flr"); // abertura norte
    set(grid, midWallX, y1, "flr"); // abertura sul

    // Escada para cima em alguns edificios
    if (rng() < 0.6) {
      const sx = x0 + 1 + Math.floor(rng() * (x1 - x0 - 2));
      const sy = y0 + 1 + Math.floor(rng() * (y1 - y0 - 2));
      set(grid, sx, sy, "stu");
      stairUpPositions.push({ x: sx, y: sy });
    }

    // Decoracao interna
    if (rng() < 0.4) {
      const px = x0 + 1 + Math.floor(rng() * (x1 - x0 - 2));
      const py = y0 + 1 + Math.floor(rng() * (y1 - y0 - 2));
      set(grid, px, py, "pil");
    }
  });

  // Praca central — fonte + arvores
  const plazaR = 5;
  for (let dy = -plazaR; dy <= plazaR; dy++)
    for (let dx = -plazaR; dx <= plazaR; dx++)
      if (dx * dx + dy * dy <= plazaR * plazaR)
        set(grid, cx + dx, cy + dy, "cob");
  set(grid, cx, cy, "fnt");
  [
    [-3, -3],
    [3, -3],
    [-3, 3],
    [3, 3],
  ].forEach(([dx, dy]) => set(grid, cx + dx, cy + dy, "tre"));

  // Mercado no quadrante nordeste
  fill(grid, cx + 3, cy - 10, cx + 10, cy - 3, "mkt");

  // Arcos na entrada da praca
  [
    [cx - 6, cy],
    [cx + 6, cy],
    [cx, cy - 6],
    [cx, cy + 6],
  ].forEach(([ax, ay]) => set(grid, ax, ay, "arc"));

  return { grid, stairUpPositions, roofRects };
}

// ─── Nivel 1: Torres e passarelas no alto ─────────────────────────────────────
// Padrao: void (sky). Apenas plataformas sobre as escadas-para-cima do nivel 0.
function generateLevel1(rng, stairUpPositions, roofRects) {
  const grid = makeGrid(W, H, "..."); // tudo sky/vazio

  // Telhados dos edificios do nivel 0 para manter estruturas completas
  for (const { x0, y0, x1, y1 } of roofRects) {
    // Gable roof spanning the full building footprint (including wall tiles)
    fillGableRoof(grid, x0, y0, x1, y1);
  }

  for (const { x, y } of stairUpPositions) {
    // Cada escada-para-cima no nivel 0 gera uma torre/plataforma aqui
    const towerR = 3 + Math.floor(rng() * 3);

    // Piso da torre
    for (let dy = -towerR; dy <= towerR; dy++)
      for (let dx = -towerR; dx <= towerR; dx++)
        if (dx * dx + dy * dy <= towerR * towerR)
          set(grid, x + dx, y + dy, "stn");

    // Paredes da torre
    for (let dy = -towerR; dy <= towerR; dy++)
      for (let dx = -towerR; dx <= towerR; dx++) {
        const r2 = dx * dx + dy * dy;
        if (r2 <= towerR * towerR && r2 >= (towerR - 1) * (towerR - 1))
          set(grid, x + dx, y + dy, "swl");
      }

    // Abertura (porta)
    set(grid, x, y - towerR, "stn");

    // Escada-para-baixo de volta ao nivel 0
    set(grid, x, y, "std");

    // Passarela conectando torres proximas
    if (rng() < 0.5 && stairUpPositions.length > 1) {
      const other =
        stairUpPositions[Math.floor(rng() * stairUpPositions.length)];
      if (other.x !== x || other.y !== y) {
        // Passarela horizontal depois vertical
        const px0 = Math.min(x, other.x),
          px1 = Math.max(x, other.x);
        const py0 = Math.min(y, other.y),
          py1 = Math.max(y, other.y);
        fill(grid, px0, y - 0, px1, y + 0, "bal");
        fill(grid, other.x, py0, other.x, py1, "bal");
      }
    }

    // Decoracao no topo
    if (rng() < 0.5) set(grid, x - 1, y - 1, "pil");
    if (rng() < 0.5) set(grid, x + 1, y - 1, "pil");
  }

  return grid;
}

// ─── Build e escrita ──────────────────────────────────────────────────────────
function buildOutput() {
  const rng = makePRNG(4242);
  const { grid: grid0, stairUpPositions, roofRects } = generateLevel0(rng);
  const grid1 = generateLevel1(rng, stairUpPositions, roofRects);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const writeLevel = (levelKey, grid) => {
    const binData = new Uint8Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) binData[y * W + x] = grid[y][x];
    const binFile = `${MAP_NAME}_${levelKey}.bin`;
    fs.writeFileSync(path.join(OUTPUT_DIR, binFile), binData);
    console.log(`  Written ${binFile} (${W}x${H} = ${binData.length} bytes)`);
    return binFile;
  };

  const binFile0 = writeLevel("0", grid0);
  const binFile1 = writeLevel("1", grid1);

  // Spawn do jogador no cobblestone da praca central
  const cx = 50,
    cy = 50;
  let playerX = cx * 32 + 16;
  let playerY = cy * 32 + 16;
  outer: for (let r = 0; r < 10; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (grid0[cy + dy]?.[cx + dx] === IDX["cob"]) {
          playerX = (cx + dx) * 32 + 16;
          playerY = (cy + dy) * 32 + 16;
          break outer;
        }

  // Entidades — inimigos nos blocos da cidade
  const mkEnemies = (count, g) => {
    const result = [];
    let placed = 0;
    for (let attempt = 0; attempt < count * 30 && placed < count; attempt++) {
      const ex = 20 + Math.floor(Math.random() * 60);
      const ey = 20 + Math.floor(Math.random() * 60);
      const sym = g[ey]?.[ex];
      if (sym === IDX["flr"] || sym === IDX["stn"] || sym === IDX["mkt"]) {
        result.push({ symbol: placed % 4 === 0 ? "orc" : "gob", x: ex, y: ey });
        placed++;
      }
    }
    return result;
  };

  const meta = {
    mapName: MAP_NAME,
    tileSize: 32,
    width: W,
    height: H,
    config: {
      startLevel: "0",
      mapName: "Cidade Suspensa",
    },
    tileAtlas: ATLAS,
    tileDefinitions: TILE_DEFS,
    entityTemplates: {
      gob: { type: "enemy", id: "goblin" },
      orc: { type: "enemy", id: "orc" },
    },
    levels: {
      0: {
        binFile: binFile0,
        playerPos: { x: playerX, y: playerY },
        entities: mkEnemies(20, grid0),
      },
      1: {
        binFile: binFile1,
        playerPos: { x: playerX, y: playerY },
        entities: mkEnemies(8, grid1),
      },
    },
  };

  const jsonFile = `${MAP_NAME}.json`;
  fs.writeFileSync(
    path.join(OUTPUT_DIR, jsonFile),
    JSON.stringify(meta, null, 2),
  );
  console.log(`  Written ${jsonFile}`);
  console.log(`  Player spawn: x=${playerX} y=${playerY}`);
  console.log(`  Stairs-up: ${stairUpPositions.length}`);
  console.log(`  Open: ?slice3d=1&map=${MAP_NAME}&fp=1`);
}

console.log(
  `[generate-city-suspensa] Generating ${MAP_NAME} (${W}x${H}, 2 levels)...`,
);
buildOutput();
console.log("[generate-city-suspensa] Done.");
