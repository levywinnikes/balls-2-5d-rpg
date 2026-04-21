/**
 * generate-dungeons-terreo-v1.js
 *
 * Sprint 14 — Dungeons térreo v1.
 * Gera 7 mapas BMS de dungeons ao nivel do solo (terreo):
 *
 *   dungeon_t01 — Ruinas Antigas        (ruinas circulares, grama exterior)
 *   dungeon_t02 — Fortaleza Abandonada  (muros quadrados, torres nos cantos)
 *   dungeon_t03 — Acampamento Goblin    (cabanas distribuidas, fogueiras)
 *   dungeon_t04 — Forte de Pedra        (keep central, patio interno)
 *   dungeon_t05 — Templo Maldito        (cruz central, altares)
 *   dungeon_t06 — Covil de Bandidos     (corredor principal, salas laterais)
 *   dungeon_t07 — Mansao Assombrada     (planta em L, jardim morto)
 *
 * Cada mapa:
 *   Nivel 0 — terreo: grama exterior + estrutura da dungeon
 *   Nivel 1 — alto: plataformas superiores / telhados (default "...")
 *
 * Acesso BMS exclusivamente via MapLoader.getTileAt(x, y, level).
 * Tile size: 32px fixo. Default abismo: "..." para nivel 1.
 *
 * Uso: node scripts/generate-dungeons-terreo-v1.js
 * Saida: public/maps/dungeon_t01.json + _0.bin + _1.bin ... (x7)
 */

"use strict";

const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "..", "public", "maps");

// ─── Tile Atlas ───────────────────────────────────────────────────────────────
const ATLAS = [
  "...", // 0  void/abismo
  "cob", // 1  cobblestone (caminho)
  "wal", // 2  parede externa
  "bwl", // 3  parede de tijolo
  "flr", // 4  chao de pedra interno
  "rof", // 5  telhado
  "grs", // 6  grama
  "stn", // 7  plataforma de pedra
  "mkt", // 8  mercado/altar
  "pil", // 9  pilar
  "fnt", // 10 fonte/agua benta
  "tre", // 11 arvore morta
  "dwl", // 12 habitacao/cabana
  "arc", // 13 arco/portao
  "sdw", // 14 sombra/decoracao
  "stu", // 15 escada para cima
  "std", // 16 escada para baixo
  "swl", // 17 parede de pedra grossa
  "sfl", // 18 chao de pedra subterranea
  "cfl", // 19 chao de caverna
  "cwl", // 20 parede de caverna
  "wtr", // 21 agua
  "bal", // 22 varanda/passarela
];

// ─── Tile Definitions ─────────────────────────────────────────────────────────
const TILE_DEFS = {
  "...": { color: 0x000000, height: 0,    renderAs: "empty", block: false },
  cob:   { color: 0x888880, height: 0.15, renderAs: "floor", block: false },
  wal:   { color: 0x706050, height: 2.0,  renderAs: "wall",  block: true  },
  bwl:   { color: 0x8b4513, height: 2.0,  renderAs: "wall",  block: true  },
  flr:   { color: 0x999090, height: 0.15, renderAs: "floor", block: false },
  rof:   { color: 0x5a3e28, height: 0.3,  renderAs: "roof",  block: false },
  grs:   { color: 0x4a7c3f, height: 0.2,  renderAs: "floor", block: false },
  stn:   { color: 0x808080, height: 0.25, renderAs: "floor", block: false },
  mkt:   { color: 0xd4a017, height: 0.2,  renderAs: "floor", block: false },
  pil:   { color: 0x606060, height: 2.5,  renderAs: "wall",  block: true  },
  fnt:   { color: 0x4090c0, height: 0.5,  renderAs: "floor", block: false },
  tre:   { color: 0x226622, height: 2.0,  renderAs: "wall",  block: true  },
  dwl:   { color: 0xa07050, height: 2.0,  renderAs: "wall",  block: true  },
  arc:   { color: 0x909090, height: 2.2,  renderAs: "wall",  block: true  },
  sdw:   { color: 0x404040, height: 0.05, renderAs: "floor", block: false },
  stu:   { color: 0xc8b040, height: 0.5,  renderAs: "floor", block: false, stairDir: "up"   },
  std:   { color: 0xc89040, height: 0.5,  renderAs: "floor", block: false, stairDir: "down" },
  swl:   { color: 0x505060, height: 2.0,  renderAs: "wall",  block: true  },
  sfl:   { color: 0x606878, height: 0.15, renderAs: "floor", block: false },
  cfl:   { color: 0x554444, height: 0.15, renderAs: "floor", block: false },
  cwl:   { color: 0x443333, height: 2.0,  renderAs: "wall",  block: true  },
  wtr:   { color: 0x2060a0, height: 0.1,  renderAs: "floor", block: false },
  bal:   { color: 0x907060, height: 0.2,  renderAs: "floor", block: false },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeIDX() {
  const idx = {};
  ATLAS.forEach((s, i) => { idx[s] = i; });
  return idx;
}
const IDX = makeIDX();

function makePRNG(seed) {
  let state = seed >>> 0;
  return function random() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function makeGrid(W, H, fillSymbol = "grs") {
  const fi = IDX[fillSymbol];
  return Array.from({ length: H }, () => new Uint8Array(W).fill(fi));
}

function set(grid, x, y, W, H, symbol) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  grid[y][x] = IDX[symbol];
}

function fill(grid, x0, y0, x1, y1, W, H, symbol) {
  const fi = IDX[symbol];
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++)
      grid[y][x] = fi;
}

function rect(grid, x0, y0, x1, y1, W, H, wallSym, floorSym) {
  fill(grid, x0, y0, x1, y1, W, H, floorSym);
  fill(grid, x0, y0, x1, y0, W, H, wallSym);
  fill(grid, x0, y1, x1, y1, W, H, wallSym);
  fill(grid, x0, y0, x0, y1, W, H, wallSym);
  fill(grid, x1, y0, x1, y1, W, H, wallSym);
}

function disc(grid, cx, cy, r, W, H, symbol) {
  const fi = IDX[symbol];
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++)
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r)
        if (x >= 0 && y >= 0 && x < W && y < H)
          grid[y][x] = fi;
}

function ring(grid, cx, cy, r, thick, W, H, symbol) {
  const fi = IDX[symbol];
  const ir = Math.max(0, r - thick);
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d <= r * r && d >= ir * ir)
        if (x >= 0 && y >= 0 && x < W && y < H)
          grid[y][x] = fi;
    }
}

function line(grid, x0, y0, x1, y1, hw, W, H, symbol) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    fill(grid, x - hw, y - hw, x + hw, y + hw, W, H, symbol);
  }
}

function buildEntities(grid, W, H, random, count, floors, levelIndex) {
  const entities = [];
  const floorSet = new Set(floors.map(s => IDX[s]));
  let attempts = 0;
  while (entities.length < count && attempts < count * 60) {
    attempts++;
    const x = 1 + Math.floor(random() * (W - 2));
    const y = 1 + Math.floor(random() * (H - 2));
    if (floorSet.has(grid[y][x])) {
      const roll = random();
      const sym = roll < 0.25 ? "orc" : "gob";
      entities.push({ symbol: sym, x, y });
    }
  }
  return entities;
}

function writeMap(mapName, W, H, grids, playerPos, entityCounts, random) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const levels = {};
  const floorTiles = ["flr", "sfl", "cfl", "stn", "cob", "grs", "mkt", "sdw"];

  grids.forEach((grid, levelIndex) => {
    const binData = new Uint8Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        binData[y * W + x] = grid[y][x];

    const binFile = `${mapName}_${levelIndex}.bin`;
    fs.writeFileSync(path.join(OUTPUT_DIR, binFile), binData);

    const count = entityCounts[levelIndex] || 0;
    levels[levelIndex] = {
      binFile,
      playerPos,
      entities: count > 0 ? buildEntities(grid, W, H, random, count, floorTiles, levelIndex) : [],
    };
  });

  const metadata = {
    mapName,
    tileSize: 32,
    width: W,
    height: H,
    config: {
      startLevel: "0",
      mapName,
    },
    tileAtlas: ATLAS,
    tileDefinitions: TILE_DEFS,
    entityTemplates: {
      gob: { type: "enemy", id: "goblin" },
      orc: { type: "enemy", id: "orc" },
    },
    levels,
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${mapName}.json`),
    JSON.stringify(metadata, null, 2),
  );
  console.log(`  [OK] ${mapName} (${W}x${H}, ${grids.length} niveis)`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUNGEON T01 — Ruinas Antigas (60×60)
// Ruinas circulares no centro, grama em volta, algumas arvores e agua
// ═══════════════════════════════════════════════════════════════════════════════
function generateT01(random) {
  const W = 60, H = 60;
  const cx = 30, cy = 30;

  // ─── Nivel 0: terreo ─────────────────────────────────────────────────────
  const g0 = makeGrid(W, H, "grs");

  // Zona exterior: algumas arvores e agua
  for (let i = 0; i < 20; i++) {
    const x = 2 + Math.floor(random() * (W - 4));
    const y = 2 + Math.floor(random() * (H - 4));
    const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
    if (d > 22 * 22) set(g0, x, y, W, H, random() < 0.4 ? "tre" : "sdw");
  }

  // Poça de agua no canto
  disc(g0, 8, 8, 4, W, H, "wtr");
  disc(g0, 52, 52, 3, W, H, "wtr");

  // Ruinas externas: muros fragmentados
  ring(g0, cx, cy, 20, 2, W, H, "swl");
  // Aberturas nos 4 pontos cardeais
  for (let i = -2; i <= 2; i++) {
    set(g0, cx + i, cy - 20, W, H, "cob");
    set(g0, cx + i, cy + 20, W, H, "cob");
    set(g0, cx - 20, cy + i, W, H, "cob");
    set(g0, cx + 20, cy + i, W, H, "cob");
  }

  // Caminho de entrada (norte)
  line(g0, cx, 2, cx, cy - 20, 1, W, H, "cob");
  // Caminho interno (cruzeta)
  line(g0, cx - 18, cy, cx + 18, cy, 0, W, H, "cob");
  line(g0, cx, cy - 18, cx, cy + 18, 0, W, H, "cob");

  // Patio central
  disc(g0, cx, cy, 8, W, H, "stn");
  ring(g0, cx, cy, 8, 1, W, H, "wal");
  set(g0, cx, cy - 8, W, H, "arc");
  set(g0, cx, cy + 8, W, H, "arc");
  set(g0, cx - 8, cy, W, H, "arc");
  set(g0, cx + 8, cy, W, H, "arc");

  // Altar central e pilares
  set(g0, cx, cy, W, H, "mkt");
  set(g0, cx - 3, cy - 3, W, H, "pil");
  set(g0, cx + 3, cy - 3, W, H, "pil");
  set(g0, cx - 3, cy + 3, W, H, "pil");
  set(g0, cx + 3, cy + 3, W, H, "pil");

  // Salas laterais fragmentadas
  rect(g0, cx - 17, cy - 14, cx - 10, cy - 7, W, H, "wal", "flr");
  set(g0, cx - 13, cy - 14, W, H, "flr"); // porta norte
  rect(g0, cx + 10, cy + 7, cx + 17, cy + 14, W, H, "wal", "flr");
  set(g0, cx + 13, cy + 7, W, H, "flr");  // porta sul

  // Escadas para nivel 1 (dentro do patio)
  set(g0, cx - 2, cy - 2, W, H, "stu");

  // ─── Nivel 1: topo das ruinas ──────────────────────────────────────────────
  const g1 = makeGrid(W, H, "...");

  // Plataforma central no alto
  disc(g1, cx, cy, 6, W, H, "stn");
  ring(g1, cx, cy, 6, 1, W, H, "swl");
  set(g1, cx, cy, W, H, "mkt"); // altar superior
  set(g1, cx - 2, cy - 2, W, H, "std");
  set(g1, cx - 1, cy - 1, W, H, "pil");
  set(g1, cx + 1, cy - 1, W, H, "pil");

  // Fragmentos de muro espalhados
  rect(g1, cx - 17, cy - 14, cx - 12, cy - 10, W, H, "wal", "rof");
  rect(g1, cx + 12, cy + 10, cx + 17, cy + 14, W, H, "wal", "rof");

  const playerPos = { x: cx * 32 + 16, y: 3 * 32 + 16 };
  return { W, H, grids: [g0, g1], playerPos, entityCounts: [10, 3] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUNGEON T02 — Fortaleza Abandonada (80×80)
// Muros quadrados, 4 torres nos cantos, patio central, ala interna
// ═══════════════════════════════════════════════════════════════════════════════
function generateT02(random) {
  const W = 80, H = 80;
  const cx = 40, cy = 40;

  // ─── Nivel 0 ──────────────────────────────────────────────────────────────
  const g0 = makeGrid(W, H, "grs");

  // Parede externa da fortaleza
  rect(g0, 10, 10, 70, 70, W, H, "swl", "cob");

  // Torres nos 4 cantos (5x5)
  const towerPositions = [[10, 10], [65, 10], [10, 65], [65, 65]];
  towerPositions.forEach(([tx, ty]) => {
    rect(g0, tx, ty, tx + 5, ty + 5, W, H, "swl", "sfl");
    set(g0, tx + 2, ty + 2, W, H, "stu"); // escada para nivel 1 em cada torre
  });

  // Portao principal (sul)
  fill(g0, cx - 3, 69, cx + 3, 70, W, H, "arc");
  line(g0, cx, 72, cx, 78, 1, W, H, "cob"); // caminho de entrada

  // Patio interno (centro)
  fill(g0, 20, 20, 60, 60, W, H, "cob");

  // Keep central
  rect(g0, 30, 28, 50, 52, W, H, "bwl", "flr");
  // Porta do keep
  set(g0, cx, 52, W, H, "flr");
  set(g0, cx - 1, 52, W, H, "flr");
  set(g0, cx + 1, 52, W, H, "flr");
  // Interior do keep
  fill(g0, 32, 30, 48, 50, W, H, "sfl");
  rect(g0, 34, 32, 46, 48, W, H, "bwl", "sfl");
  set(g0, cx, 32, W, H, "sfl"); // porta norte interna
  set(g0, cx - 1, 32, W, H, "sfl");
  set(g0, cx, 48, W, H, "sfl"); // porta sul interna

  // Sala do trono
  fill(g0, 36, 34, 44, 40, W, H, "mkt");
  set(g0, cx, 35, W, H, "arc");
  set(g0, cx - 3, 36, W, H, "pil");
  set(g0, cx + 3, 36, W, H, "pil");
  set(g0, cx, 37, W, H, "fnt");

  // Alas laterais (leste/oeste)
  rect(g0, 15, 25, 28, 55, W, H, "wal", "flr");
  set(g0, 28, cy, W, H, "flr"); // porta oeste
  rect(g0, 52, 25, 65, 55, W, H, "wal", "flr");
  set(g0, 52, cy, W, H, "flr"); // porta leste

  // Decoracao
  set(g0, 17, 27, W, H, "pil");
  set(g0, 26, 27, W, H, "pil");
  set(g0, 17, 53, W, H, "pil");
  set(g0, 26, 53, W, H, "pil");
  set(g0, 54, 27, W, H, "pil");
  set(g0, 63, 27, W, H, "pil");
  set(g0, 54, 53, W, H, "pil");
  set(g0, 63, 53, W, H, "pil");

  // ─── Nivel 1: muralhas e torres ────────────────────────────────────────────
  const g1 = makeGrid(W, H, "...");

  // Caminho nas muralhas (anel)
  line(g1, 10, 10, 70, 10, 0, W, H, "stn");
  line(g1, 10, 70, 70, 70, 0, W, H, "stn");
  line(g1, 10, 10, 10, 70, 0, W, H, "stn");
  line(g1, 70, 10, 70, 70, 0, W, H, "stn");

  // Topos das torres
  towerPositions.forEach(([tx, ty]) => {
    fill(g1, tx, ty, tx + 5, ty + 5, W, H, "stn");
    set(g1, tx + 2, ty + 2, W, H, "std"); // escada de volta
    set(g1, tx + 1, ty + 1, W, H, "swl");
    set(g1, tx + 3, ty + 1, W, H, "swl");
    set(g1, tx + 1, ty + 3, W, H, "swl");
    set(g1, tx + 3, ty + 3, W, H, "swl");
  });

  // Topo do keep
  fill(g1, 30, 28, 50, 52, W, H, "rof");
  set(g1, cx, cy - 2, W, H, "pil");
  set(g1, cx, cy + 2, W, H, "pil");

  const playerPos = { x: cx * 32 + 16, y: 76 * 32 + 16 };
  return { W, H, grids: [g0, g1], playerPos, entityCounts: [16, 6] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUNGEON T03 — Acampamento Goblin (70×70)
// Cabanas distribuidas, fogueiras centrais, palissadas de madeira
// ═══════════════════════════════════════════════════════════════════════════════
function generateT03(random) {
  const W = 70, H = 70;
  const cx = 35, cy = 35;

  // ─── Nivel 0 ──────────────────────────────────────────────────────────────
  const g0 = makeGrid(W, H, "grs");

  // Palissada externa (quadrado irregular)
  rect(g0, 8, 8, 62, 62, W, H, "bwl", "grs");
  // Entradas (N/S/L/O)
  fill(g0, cx - 2, 8, cx + 2, 8, W, H, "cob");
  fill(g0, cx - 2, 62, cx + 2, 62, W, H, "cob");
  fill(g0, 8, cy - 2, 8, cy + 2, W, H, "cob");
  fill(g0, 62, cy - 2, 62, cy + 2, W, H, "cob");

  // Caminhos internos
  line(g0, 8, cy, 62, cy, 0, W, H, "cob");
  line(g0, cx, 8, cx, 62, 0, W, H, "cob");

  // Praca central
  disc(g0, cx, cy, 7, W, H, "stn");
  set(g0, cx, cy, W, H, "fnt"); // fogueira central (representada como fnt)
  set(g0, cx - 2, cy - 2, W, H, "sdw");
  set(g0, cx + 2, cy - 2, W, H, "sdw");
  set(g0, cx - 2, cy + 2, W, H, "sdw");
  set(g0, cx + 2, cy + 2, W, H, "sdw");

  // Cabanas goblins nos 4 quadrantes
  const huts = [
    [14, 14], [22, 14], [14, 22], [22, 22],
    [44, 14], [52, 14], [44, 22], [52, 22],
    [14, 44], [22, 44], [14, 52], [22, 52],
    [44, 44], [52, 44], [44, 52], [52, 52],
  ];
  huts.forEach(([hx, hy], i) => {
    if (random() < 0.75) {
      rect(g0, hx, hy, hx + 4, hy + 4, W, H, "dwl", "flr");
      const doorSide = i % 2 === 0 ? [hx + 2, hy + 4] : [hx + 2, hy];
      set(g0, doorSide[0], doorSide[1], W, H, "flr");
      set(g0, hx + 1, hy + 1, W, H, random() < 0.3 ? "sdw" : "flr");
    }
  });

  // Arvores nos cantos
  [[10, 10], [58, 10], [10, 58], [58, 58]].forEach(([tx, ty]) => {
    set(g0, tx, ty, W, H, "tre");
    set(g0, tx + 1, ty, W, H, "tre");
    set(g0, tx, ty + 1, W, H, "tre");
  });

  // Deposito goblin (nordeste)
  rect(g0, 46, 12, 58, 20, W, H, "bwl", "mkt");
  set(g0, 52, 20, W, H, "flr"); // porta

  // Tenda do chefe (centro-norte)
  rect(g0, cx - 4, cy - 16, cx + 4, cy - 10, W, H, "swl", "sfl");
  set(g0, cx, cy - 10, W, H, "sfl"); // porta
  set(g0, cx, cy - 13, W, H, "arc");
  set(g0, cx - 2, cy - 15, W, H, "pil");
  set(g0, cx + 2, cy - 15, W, H, "pil");

  // ─── Nivel 1: plataforma de vigia ─────────────────────────────────────────
  const g1 = makeGrid(W, H, "...");

  // Torres de vigia (nos 4 cantos da palissada)
  [[8, 8], [57, 8], [8, 57], [57, 57]].forEach(([tx, ty]) => {
    fill(g1, tx, ty, tx + 5, ty + 5, W, H, "stn");
    ring(g1, tx, ty, 3, 1, W, H, "swl");
    set(g1, tx + 2, ty + 2, W, H, "std");
  });

  const playerPos = { x: cx * 32 + 16, y: 6 * 32 + 16 };
  return { W, H, grids: [g0, g1], playerPos, entityCounts: [20, 4] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUNGEON T04 — Forte de Pedra (65×65)
// Keep central robusto, fosso (agua), patio com pilares
// ═══════════════════════════════════════════════════════════════════════════════
function generateT04(random) {
  const W = 65, H = 65;
  const cx = 32, cy = 32;

  // ─── Nivel 0 ──────────────────────────────────────────────────────────────
  const g0 = makeGrid(W, H, "grs");

  // Fosso (agua circular)
  ring(g0, cx, cy, 22, 3, W, H, "wtr");
  // Pontes
  line(g0, cx, cy - 25, cx, cy - 19, 1, W, H, "cob"); // norte
  line(g0, cx, cy + 19, cx, cy + 25, 1, W, H, "cob"); // sul

  // Caminho de entrada (norte, fora do fosso)
  line(g0, cx, 2, cx, cy - 25, 1, W, H, "cob");

  // Patio externo (entre fosso e muros)
  disc(g0, cx, cy, 19, W, H, "cob");
  // Muros do forte (anel)
  ring(g0, cx, cy, 15, 2, W, H, "swl");
  // Portoes
  for (let i = -2; i <= 2; i++) {
    set(g0, cx + i, cy - 15, W, H, "arc");
    set(g0, cx + i, cy + 15, W, H, "arc");
  }

  // Patio interno
  disc(g0, cx, cy, 13, W, H, "sfl");
  // Pilares internos
  [[cx - 8, cy - 8], [cx + 8, cy - 8], [cx - 8, cy + 8], [cx + 8, cy + 8]].forEach(([px, py]) => {
    set(g0, px, py, W, H, "pil");
  });

  // Keep central (keep quadrado)
  rect(g0, cx - 6, cy - 6, cx + 6, cy + 6, W, H, "swl", "sfl");
  set(g0, cx - 1, cy + 6, W, H, "sfl"); // porta sul
  set(g0, cx, cy + 6, W, H, "sfl");
  set(g0, cx + 1, cy + 6, W, H, "sfl");

  // Interior do keep
  fill(g0, cx - 4, cy - 4, cx + 4, cy + 4, W, H, "mkt");
  set(g0, cx, cy, W, H, "arc");
  set(g0, cx - 3, cy - 3, W, H, "pil");
  set(g0, cx + 3, cy - 3, W, H, "pil");
  set(g0, cx - 3, cy + 3, W, H, "pil");
  set(g0, cx + 3, cy + 3, W, H, "pil");

  // Escada para nivel 1 (topo do keep)
  set(g0, cx - 1, cy - 1, W, H, "stu");

  // Guaritas nas 4 posicoes cardeais dentro do forte
  const guardPosts = [[cx, cy - 11], [cx, cy + 11], [cx - 11, cy], [cx + 11, cy]];
  guardPosts.forEach(([gpx, gpy]) => {
    set(g0, gpx, gpy, W, H, "swl");
    set(g0, gpx - 1, gpy, W, H, "sfl");
    set(g0, gpx + 1, gpy, W, H, "sfl");
  });

  // ─── Nivel 1: topo do keep ────────────────────────────────────────────────
  const g1 = makeGrid(W, H, "...");

  fill(g1, cx - 6, cy - 6, cx + 6, cy + 6, W, H, "stn");
  ring(g1, cx, cy, 7, 1, W, H, "swl");
  set(g1, cx - 1, cy - 1, W, H, "std");
  set(g1, cx, cy, W, H, "fnt");
  set(g1, cx - 4, cy - 4, W, H, "pil");
  set(g1, cx + 4, cy - 4, W, H, "pil");
  set(g1, cx - 4, cy + 4, W, H, "pil");
  set(g1, cx + 4, cy + 4, W, H, "pil");

  const playerPos = { x: cx * 32 + 16, y: 3 * 32 + 16 };
  return { W, H, grids: [g0, g1], playerPos, entityCounts: [12, 4] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUNGEON T05 — Templo Maldito (75×75)
// Planta em cruz, altares nos 4 bracos, cripta subterranea no centro
// ═══════════════════════════════════════════════════════════════════════════════
function generateT05(random) {
  const W = 75, H = 75;
  const cx = 37, cy = 37;

  // ─── Nivel 0 ──────────────────────────────────────────────────────────────
  const g0 = makeGrid(W, H, "grs");

  // Arvores mortas espalhadas
  for (let i = 0; i < 15; i++) {
    const tx = 3 + Math.floor(random() * (W - 6));
    const ty = 3 + Math.floor(random() * (H - 6));
    const d = (tx - cx) * (tx - cx) + (ty - cy) * (ty - cy);
    if (d > 25 * 25) set(g0, tx, ty, W, H, "tre");
  }

  // Cruz central (corpo do templo)
  // Nave principal (horizontal)
  rect(g0, cx - 20, cy - 5, cx + 20, cy + 5, W, H, "bwl", "sfl");
  // Transept (vertical)
  rect(g0, cx - 5, cy - 20, cx + 5, cy + 20, W, H, "bwl", "sfl");

  // Portoes nos 4 bracos
  // Norte
  set(g0, cx - 1, cy - 20, W, H, "arc");
  set(g0, cx, cy - 20, W, H, "arc");
  set(g0, cx + 1, cy - 20, W, H, "arc");
  // Sul
  set(g0, cx - 1, cy + 20, W, H, "arc");
  set(g0, cx, cy + 20, W, H, "arc");
  set(g0, cx + 1, cy + 20, W, H, "arc");
  // Leste
  set(g0, cx + 20, cy - 1, W, H, "arc");
  set(g0, cx + 20, cy, W, H, "arc");
  set(g0, cx + 20, cy + 1, W, H, "arc");
  // Oeste
  set(g0, cx - 20, cy - 1, W, H, "arc");
  set(g0, cx - 20, cy, W, H, "arc");
  set(g0, cx - 20, cy + 1, W, H, "arc");

  // Caminhos de entrada
  line(g0, cx, cy - 20, cx, 3, 0, W, H, "cob"); // norte
  line(g0, cx, cy + 20, cx, H - 4, 0, W, H, "cob"); // sul

  // Altares nos 4 bracos
  // Norte
  fill(g0, cx - 3, cy - 18, cx + 3, cy - 14, W, H, "mkt");
  set(g0, cx, cy - 17, W, H, "fnt");
  set(g0, cx - 2, cy - 18, W, H, "pil");
  set(g0, cx + 2, cy - 18, W, H, "pil");
  // Sul
  fill(g0, cx - 3, cy + 14, cx + 3, cy + 18, W, H, "mkt");
  set(g0, cx, cy + 17, W, H, "fnt");
  set(g0, cx - 2, cy + 18, W, H, "pil");
  set(g0, cx + 2, cy + 18, W, H, "pil");
  // Leste
  fill(g0, cx + 14, cy - 3, cx + 18, cy + 3, W, H, "mkt");
  set(g0, cx + 17, cy, W, H, "fnt");
  set(g0, cx + 18, cy - 2, W, H, "pil");
  set(g0, cx + 18, cy + 2, W, H, "pil");
  // Oeste
  fill(g0, cx - 18, cy - 3, cx - 14, cy + 3, W, H, "mkt");
  set(g0, cx - 17, cy, W, H, "fnt");
  set(g0, cx - 18, cy - 2, W, H, "pil");
  set(g0, cx - 18, cy + 2, W, H, "pil");

  // Cruzamento central (sanctum)
  disc(g0, cx, cy, 7, W, H, "sfl");
  ring(g0, cx, cy, 7, 1, W, H, "cwl");
  set(g0, cx, cy, W, H, "mkt");
  set(g0, cx - 4, cy - 4, W, H, "pil");
  set(g0, cx + 4, cy - 4, W, H, "pil");
  set(g0, cx - 4, cy + 4, W, H, "pil");
  set(g0, cx + 4, cy + 4, W, H, "pil");

  // Escada para nivel 1 (sino do templo)
  set(g0, cx + 2, cy - 2, W, H, "stu");

  // ─── Nivel 1: sino e campanario ───────────────────────────────────────────
  const g1 = makeGrid(W, H, "...");

  // Torre do campanario
  disc(g1, cx, cy, 5, W, H, "stn");
  ring(g1, cx, cy, 5, 1, W, H, "cwl");
  set(g1, cx, cy, W, H, "arc");
  set(g1, cx + 2, cy - 2, W, H, "std");
  set(g1, cx - 2, cy - 2, W, H, "pil");
  set(g1, cx + 2, cy + 2, W, H, "pil");

  // Telhados dos bracos
  fill(g1, cx - 19, cy - 4, cx + 19, cy + 4, W, H, "rof");
  fill(g1, cx - 4, cy - 19, cx + 4, cy + 19, W, H, "rof");
  // Remover sobre o sanctum
  disc(g1, cx, cy, 5, W, H, "...");
  // Restaurar topo do campanario
  disc(g1, cx, cy, 5, W, H, "stn");
  ring(g1, cx, cy, 5, 1, W, H, "cwl");
  set(g1, cx, cy, W, H, "arc");
  set(g1, cx + 2, cy - 2, W, H, "std");

  const playerPos = { x: cx * 32 + 16, y: 4 * 32 + 16 };
  return { W, H, grids: [g0, g1], playerPos, entityCounts: [14, 3] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUNGEON T06 — Covil de Bandidos (60×50)
// Corredor principal com salas laterais, entrada disfarçada
// ═══════════════════════════════════════════════════════════════════════════════
function generateT06(random) {
  const W = 60, H = 50;
  const cx = 30, cy = 25;

  // ─── Nivel 0 ──────────────────────────────────────────────────────────────
  const g0 = makeGrid(W, H, "grs");

  // Mato externo (arvores camuflagem)
  for (let i = 0; i < 25; i++) {
    const tx = 2 + Math.floor(random() * (W - 4));
    const ty = 2 + Math.floor(random() * (H - 4));
    if (random() < 0.4) set(g0, tx, ty, W, H, "tre");
  }

  // Entrada dissimulada (caminho de terra)
  line(g0, cx, 2, cx, 10, 0, W, H, "grs");

  // Corredor principal (horizontal)
  rect(g0, 8, cy - 4, 52, cy + 4, W, H, "bwl", "cfl");

  // Sala de entrada (oeste)
  rect(g0, 8, cy - 7, 18, cy + 7, W, H, "wal", "cfl");
  set(g0, cx - 12, cy, W, H, "cfl"); // entrada secreta
  set(g0, cx - 13, cy, W, H, "cfl");

  // Sala do tesouro (leste)
  rect(g0, 42, cy - 7, 52, cy + 7, W, H, "swl", "mkt");
  fill(g0, 43, cy - 5, 51, cy + 5, W, H, "mkt");
  set(g0, cx + 12, cy, W, H, "mkt"); // entrada cofre

  // Salas laterais norte
  rect(g0, 16, 6, 26, cy - 4, W, H, "wal", "cfl");
  set(g0, 21, cy - 4, W, H, "cfl");
  rect(g0, 32, 6, 42, cy - 4, W, H, "wal", "cfl");
  set(g0, 37, cy - 4, W, H, "cfl");

  // Salas laterais sul
  rect(g0, 16, cy + 4, 26, H - 6, W, H, "wal", "flr");
  set(g0, 21, cy + 4, W, H, "flr");
  rect(g0, 32, cy + 4, 42, H - 6, W, H, "wal", "flr");
  set(g0, 37, cy + 4, W, H, "flr");

  // Pilares no corredor
  for (let px = 13; px <= 47; px += 6) {
    set(g0, px, cy - 2, W, H, "pil");
    set(g0, px, cy + 2, W, H, "pil");
  }

  // Decoracao: agua contaminada na sala SW
  fill(g0, 17, cy + 5, 25, H - 7, W, H, "wtr");

  // Saida secreta (norte)
  set(g0, cx, 6, W, H, "cob");
  line(g0, cx, 2, cx, 6, 0, W, H, "cob");

  // Escada para nivel 1
  set(g0, 44, 8, W, H, "stu");
  fill(g0, 42, 6, 52, 14, W, H, "cfl");
  ring(g0, 47, 10, 4, 1, W, H, "wal");

  // ─── Nivel 1: mirante de vigia ────────────────────────────────────────────
  const g1 = makeGrid(W, H, "...");

  disc(g1, 47, 10, 5, W, H, "stn");
  ring(g1, 47, 10, 5, 1, W, H, "swl");
  set(g1, 44, 8, W, H, "std");
  set(g1, 47, 10, W, H, "sdw"); // fogueira do guarda
  set(g1, 45, 8, W, H, "pil");
  set(g1, 49, 8, W, H, "pil");

  const playerPos = { x: cx * 32 + 16, y: 3 * 32 + 16 };
  return { W, H, grids: [g0, g1], playerPos, entityCounts: [12, 2] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUNGEON T07 — Mansao Assombrada (70×65)
// Planta em L, jardim morto, celeiro abandonado, cripta
// ═══════════════════════════════════════════════════════════════════════════════
function generateT07(random) {
  const W = 70, H = 65;
  const cx = 35, cy = 32;

  // ─── Nivel 0 ──────────────────────────────────────────────────────────────
  const g0 = makeGrid(W, H, "grs");

  // Jardim morto (arvores espalhadas, solo deteriorado)
  for (let i = 0; i < 18; i++) {
    const tx = 3 + Math.floor(random() * (W - 6));
    const ty = 3 + Math.floor(random() * (H - 6));
    if (random() < 0.45) set(g0, tx, ty, W, H, random() < 0.5 ? "tre" : "sdw");
  }

  // Poça de agua podre
  disc(g0, 8, 55, 5, W, H, "wtr");
  disc(g0, 60, 10, 4, W, H, "wtr");

  // Mansao principal (ala norte-oeste, L superior)
  rect(g0, 10, 8, 45, 32, W, H, "bwl", "flr");

  // Ala leste (L inferior)
  rect(g0, 30, 32, 60, 55, W, H, "bwl", "flr");

  // Conexao L (canto superior-direito de cada ala)
  fill(g0, 30, 8, 60, 32, W, H, "flr");
  fill(g0, 32, 10, 58, 30, W, H, "flr");
  // Muro no canto interno do L
  fill(g0, 10, 32, 28, 55, W, H, "grs"); // jardim interno no recuo do L
  fill(g0, 12, 34, 26, 53, W, H, "stn"); // patio de pedra

  // Entrada principal (sul da ala leste)
  fill(g0, cx - 2, 55, cx + 2, 56, W, H, "bwl"); // portao
  fill(g0, cx - 1, 55, cx + 1, 55, W, H, "flr"); // abertura
  line(g0, cx, 57, cx, H - 2, 1, W, H, "cob");   // caminho

  // Hall de entrada
  fill(g0, cx - 5, 44, cx + 5, 54, W, H, "sfl");
  set(g0, cx, 44, W, H, "arc");
  set(g0, cx - 4, 54, W, H, "pil");
  set(g0, cx + 4, 54, W, H, "pil");

  // Sala de jantar (centro-norte)
  fill(g0, 15, 12, 40, 22, W, H, "mkt");
  set(g0, 27, 17, W, H, "fnt"); // mesa grande
  for (let px = 17; px <= 38; px += 5) {
    set(g0, px, 12, W, H, "arc");
  }

  // Biblioteca (canto NO)
  fill(g0, 11, 9, 25, 22, W, H, "cfl");
  set(g0, 18, 10, W, H, "pil");
  set(g0, 24, 10, W, H, "pil");

  // Cripta (ala SO, jardim interno)
  rect(g0, 14, 36, 24, 50, W, H, "cwl", "cfl");
  set(g0, 19, 36, W, H, "cfl"); // entrada
  set(g0, 19, 43, W, H, "mkt"); // sarcofago
  set(g0, 16, 38, W, H, "pil");
  set(g0, 22, 38, W, H, "pil");
  set(g0, 16, 48, W, H, "pil");
  set(g0, 22, 48, W, H, "pil");

  // Celeiro (NE)
  rect(g0, 50, 9, 62, 25, W, H, "wal", "sfl");
  set(g0, 56, 25, W, H, "sfl"); // porta
  fill(g0, 52, 11, 60, 23, W, H, "sdw");

  // Escada para nivel 1 (ala principal)
  set(g0, 20, 25, W, H, "stu");

  // ─── Nivel 1: andar superior ──────────────────────────────────────────────
  const g1 = makeGrid(W, H, "...");

  // Andar superior da ala principal
  fill(g1, 10, 8, 45, 32, W, H, "rof");
  fill(g1, 30, 8, 60, 32, W, H, "rof");
  // Corredor acessivel
  fill(g1, 12, 10, 43, 30, W, H, "sfl");
  fill(g1, 32, 10, 58, 30, W, H, "sfl");
  // Paredes internas do andar
  ring(g1, 27, 20, 9, 1, W, H, "wal");
  set(g1, 20, 25, W, H, "std"); // escada de volta
  set(g1, 27, 20, W, H, "fnt"); // janela/varanda
  // Pilares
  set(g1, 15, 12, W, H, "pil");
  set(g1, 40, 12, W, H, "pil");
  set(g1, 15, 28, W, H, "pil");
  set(g1, 40, 28, W, H, "pil");
  set(g1, 55, 12, W, H, "pil");
  set(g1, 55, 28, W, H, "pil");

  const playerPos = { x: cx * 32 + 16, y: (H - 3) * 32 + 16 };
  return { W, H, grids: [g0, g1], playerPos, entityCounts: [12, 4] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
function main() {
  console.log("[generate-dungeons-terreo-v1] Gerando 7 dungeons terreo (Sprint 14)...\n");

  const dungeons = [
    { name: "dungeon_t01", label: "Ruinas Antigas",       seed: 14001, gen: generateT01 },
    { name: "dungeon_t02", label: "Fortaleza Abandonada", seed: 14002, gen: generateT02 },
    { name: "dungeon_t03", label: "Acampamento Goblin",   seed: 14003, gen: generateT03 },
    { name: "dungeon_t04", label: "Forte de Pedra",       seed: 14004, gen: generateT04 },
    { name: "dungeon_t05", label: "Templo Maldito",       seed: 14005, gen: generateT05 },
    { name: "dungeon_t06", label: "Covil de Bandidos",    seed: 14006, gen: generateT06 },
    { name: "dungeon_t07", label: "Mansao Assombrada",    seed: 14007, gen: generateT07 },
  ];

  dungeons.forEach(({ name, label, seed, gen }) => {
    console.log(`  Gerando ${name} — ${label}...`);
    const random = makePRNG(seed);
    const { W, H, grids, playerPos, entityCounts } = gen(random);
    writeMap(name, W, H, grids, playerPos, entityCounts, makePRNG(seed + 999));
  });

  console.log("\n[generate-dungeons-terreo-v1] Concluido: 7 dungeons, 14 arquivos .bin gerados.");
  console.log("  Testavel em: ?slice3d=1&map=dungeon_t01 ... dungeon_t07");
}

main();
