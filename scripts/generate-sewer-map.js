/**
 * generate-sewer-map.js
 *
 * Gera o mapa "esgoto_v1" — esgoto subterraneo conectado ao nivel 0 da cidade:
 *   Nivel 0: ruas da cidade (plano de conexao com escadas-para-baixo)
 *   Nivel -1: esgoto principal — tuneis, canais de agua, ratos A/B, mini-boss
 *
 * Usa simplex-noise (ja instalado) para gerar a forma organica dos tuneis.
 *
 * Uso: node scripts/generate-sewer-map.js
 * Saida: public/maps/esgoto_v1.json + esgoto_v1_0.bin + esgoto_v1_m1.bin
 */

"use strict";

const fs = require("fs");
const path = require("path");

// simplex-noise ESM → CommonJS workaround (o pacote usa export nomeado)
let createNoise2D;
try {
  // versao 4.x expoe named export; require() nao funciona diretamente com ESM
  // Usamos dynamic import via eval para suportar tanto CJS quanto ESM builds
  const { createNoise2D: fn } = require("simplex-noise");
  createNoise2D = fn;
} catch {
  // fallback: funcao deterministica de ruido pseudo-aleatorio se simplex nao disponivel
  createNoise2D = () => {
    return (x, y) => {
      const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return (n - Math.floor(n)) * 2 - 1;
    };
  };
}

// ─── Config ──────────────────────────────────────────────────────────────────
const MAP_NAME = "esgoto_v1";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "maps");
const W = 120;
const H = 120;

// ─── Tile Atlas (compativel com runtime) ─────────────────────────────────────
const ATLAS = [
  "...", // 0  void
  "cob", // 1  cobblestone (rua nivel 0)
  "wal", // 2  parede
  "bwl", // 3  tijolo
  "flr", // 4  chao
  "rof", // 5  telhado
  "grs", // 6  grama
  "stn", // 7  pedra
  "mkt", // 8  mercado
  "pil", // 9  pilar
  "fnt", // 10 fonte
  "tre", // 11 arvore
  "dwl", // 12 habitacao
  "arc", // 13 arco
  "sdw", // 14 sombra
  "stu", // 15 escada para cima
  "std", // 16 escada para baixo
  "swl", // 17 parede de pedra subterranea
  "sfl", // 18 chao de pedra subterraneo
  "cfl", // 19 chao de caverna
  "cwl", // 20 parede de caverna
  "wtr", // 21 agua
  "bal", // 22 varanda
];

const TILE_DEFS = {
  "...": { color: 0x000000, height: 0, renderAs: "empty", block: false },
  cob: { color: 0x888880, height: 0.15, renderAs: "floor", block: false },
  wal: { color: 0x706050, height: 2.0, renderAs: "wall", block: true },
  bwl: { color: 0x8b4513, height: 2.0, renderAs: "wall", block: true },
  flr: { color: 0x999090, height: 0.15, renderAs: "floor", block: false },
  rof: { color: 0x5a3e28, height: 0.3, renderAs: "roof", block: false },
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

const IDX = {};
ATLAS.forEach((sym, i) => (IDX[sym] = i));

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

function makePRNG(seed) {
  let s = seed >>> 0;
  return function () {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

// ─── Nivel 0: Rua de conexao (entrada do esgoto) ────────────────────────────
// Ruas simples de cobblestone com escadas-para-baixo espalhadas.
function generateLevel0(rng) {
  const grid = makeGrid(W, H, "...");
  const stairDownPositions = [];

  // Area central de rua pavimentada
  fill(grid, 20, 20, W - 20, H - 20, "cob");

  // Calcadas de borda
  fill(grid, 20, 20, W - 20, 22, "stn");
  fill(grid, 20, H - 22, W - 20, H - 20, "stn");
  fill(grid, 20, 20, 22, H - 20, "stn");
  fill(grid, W - 22, 20, W - 20, H - 20, "stn");

  // Edificios com paredes
  const buildingCoords = [
    [25, 25, 40, 40],
    [50, 25, 70, 40],
    [80, 25, 95, 40],
    [25, 50, 40, 70],
    [80, 50, 95, 70],
    [25, 80, 40, 95],
    [50, 75, 70, 90],
    [80, 80, 95, 95],
  ];
  buildingCoords.forEach(([x0, y0, x1, y1]) => {
    fill(grid, x0, y0, x1, y1, "flr");
    fill(grid, x0, y0, x1, y0, "wal");
    fill(grid, x0, y1, x1, y1, "wal");
    fill(grid, x0, y0, x0, y1, "wal");
    fill(grid, x1, y0, x1, y1, "wal");
    // porta
    const mx = Math.floor((x0 + x1) / 2);
    set(grid, mx, y0, "flr");
  });

  // Escadas para baixo (entradas do esgoto) — distribuidas pelo mapa
  const stairPositions = [
    [30, 48],
    [60, 30],
    [90, 45],
    [35, 75],
    [60, 60],
    [85, 75],
    [45, 95],
    [75, 95],
  ];
  stairPositions.forEach(([x, y]) => {
    if (grid[y]?.[x] !== undefined && grid[y][x] === IDX["cob"]) {
      set(grid, x, y, "std");
      stairDownPositions.push({ x, y });
    }
  });

  // Player spawn no centro
  const playerX = 60 * 32 + 16;
  const playerY = 60 * 32 + 16;

  return { grid, stairDownPositions, playerX, playerY };
}

// ─── Nivel -1: Esgoto subterraneo ────────────────────────────────────────────
// Tuneis organicos via simplex-noise, canais de agua centrais, ratos A/B, mini-boss.
function generateLevelMinus1(rng, stairDownPositions) {
  const grid = makeGrid(W, H, "cwl"); // tudo parede de caverna por padrao

  const noise2D = createNoise2D ? createNoise2D() : createNoise2D;

  // Usar simplex noise para gerar areas abertas (tuneis)
  // Threshold: se noise > 0 = tunel aberto (sfl), caso contrario = parede (cwl)
  const SCALE = 0.12;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const n = noise2D(x * SCALE, y * SCALE);
      if (n > -0.05) {
        set(grid, x, y, "sfl");
      }
    }
  }

  // Canal de agua central horizontal e vertical
  const midY = Math.floor(H / 2);
  const midX = Math.floor(W / 2);
  // Canal horizontal
  for (let x = 5; x < W - 5; x++) {
    set(grid, x, midY, "wtr");
    set(grid, x, midY - 1, "wtr");
    // margens de pedra ao lado do canal
    if (grid[midY - 2]?.[x] === IDX["sfl"]) set(grid, x, midY - 2, "sfl");
    if (grid[midY + 1]?.[x] === IDX["sfl"]) set(grid, x, midY + 1, "wtr");
    if (grid[midY + 2]?.[x] === IDX["sfl"]) set(grid, x, midY + 2, "sfl");
  }
  // Canal vertical
  for (let y = 5; y < H - 5; y++) {
    set(grid, midX, y, "wtr");
    if (grid[y]?.[midX - 1] === IDX["sfl"]) set(grid, midX - 1, y, "wtr");
  }

  // Pontes sobre o canal horizontal
  const bridgeXs = [30, 50, 70, 90];
  bridgeXs.forEach((bx) => {
    set(grid, bx, midY, "sfl");
    set(grid, bx, midY - 1, "sfl");
    set(grid, bx, midY + 1, "sfl");
  });

  // Sala do mini-boss no canto inferior-direito
  const bossX0 = 85,
    bossY0 = 85,
    bossX1 = 105,
    bossY1 = 105;
  fill(grid, bossX0, bossY0, bossX1, bossY1, "sfl");
  fill(grid, bossX0, bossY0, bossX1, bossY0, "swl");
  fill(grid, bossX0, bossY1, bossX1, bossY1, "swl");
  fill(grid, bossX0, bossY0, bossX0, bossY1, "swl");
  fill(grid, bossX1, bossY0, bossX1, bossY1, "swl");
  // Entrada da sala do boss
  set(grid, Math.floor((bossX0 + bossX1) / 2), bossY0, "sfl");
  // Pilares na sala
  set(grid, bossX0 + 3, bossY0 + 3, "swl");
  set(grid, bossX1 - 3, bossY0 + 3, "swl");
  set(grid, bossX0 + 3, bossY1 - 3, "swl");
  set(grid, bossX1 - 3, bossY1 - 3, "swl");

  // Escadas-para-cima: uma sob cada entrada de escada do nivel 0
  stairDownPositions.forEach(({ x, y }) => {
    set(grid, x, y, "stu");
  });

  // Garantir que as escadas tenham piso acessivel ao redor
  stairDownPositions.forEach(({ x, y }) => {
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++)
        if (
          grid[y + dy]?.[x + dx] !== undefined &&
          grid[y + dy][x + dx] === IDX["cwl"]
        )
          set(grid, x + dx, y + dy, "sfl");
  });

  return grid;
}

// ─── Build e escrita ──────────────────────────────────────────────────────────
function buildOutput() {
  const rng = makePRNG(1337);
  const {
    grid: grid0,
    stairDownPositions,
    playerX,
    playerY,
  } = generateLevel0(rng);
  const gridM1 = generateLevelMinus1(rng, stairDownPositions);

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
  const binFileM1 = writeLevel("m1", gridM1);

  // Entidades — ratos A/B no nivel -1, mini-boss unico
  const mkRats = (grid) => {
    const result = [];
    let placed = 0;
    const targets = 35;
    for (
      let attempt = 0;
      attempt < targets * 40 && placed < targets;
      attempt++
    ) {
      const ex = 5 + Math.floor(Math.random() * (W - 10));
      const ey = 5 + Math.floor(Math.random() * (H - 10));
      const sym = grid[ey]?.[ex];
      if (sym === IDX["sfl"] || sym === IDX["cfl"]) {
        const isBossRoom = ex >= 82 && ex <= 108 && ey >= 82 && ey <= 108;
        if (!isBossRoom) {
          // Alterna rato_a e rato_b (60/40)
          result.push({
            symbol: placed % 5 < 3 ? "rat_a" : "rat_b",
            x: ex,
            y: ey,
          });
          placed++;
        }
      }
    }
    // Mini-boss no centro da sala
    const bossCX = Math.floor((85 + 105) / 2);
    const bossCY = Math.floor((85 + 105) / 2);
    result.push({ symbol: "rat_boss", x: bossCX, y: bossCY });
    return result;
  };

  // Alguns inimigos basicos no nivel 0 (goblins guardando entradas)
  const mkCityGuards = (grid) => {
    const result = [];
    let placed = 0;
    for (let attempt = 0; attempt < 200 && placed < 10; attempt++) {
      const ex = 20 + Math.floor(Math.random() * 80);
      const ey = 20 + Math.floor(Math.random() * 80);
      const sym = grid[ey]?.[ex];
      if (sym === IDX["cob"]) {
        result.push({ symbol: "gob", x: ex, y: ey });
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
      mapName: "Esgoto v1",
    },
    tileAtlas: ATLAS,
    tileDefinitions: TILE_DEFS,
    entityTemplates: {
      gob: { type: "enemy", id: "goblin" },
      orc: { type: "enemy", id: "orc" },
      rat_a: { type: "enemy", id: "rat" },
      rat_b: { type: "enemy", id: "rat" },
      rat_boss: { type: "enemy", id: "rat" },
    },
    levels: {
      0: {
        binFile: binFile0,
        playerPos: { x: playerX, y: playerY },
        entities: mkCityGuards(grid0),
      },
      "-1": {
        binFile: binFileM1,
        playerPos: { x: playerX, y: playerY },
        entities: mkRats(gridM1),
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
  console.log(`  Stairs-down (nivel 0 -> -1): ${stairDownPositions.length}`);
  console.log(`  Open: ?slice3d=1&map=${MAP_NAME}&fp=1`);
}

console.log(
  `[generate-sewer-map] Generating ${MAP_NAME} (${W}x${H}, 2 levels: 0 + -1)...`,
);
buildOutput();
console.log("[generate-sewer-map] Done.");
