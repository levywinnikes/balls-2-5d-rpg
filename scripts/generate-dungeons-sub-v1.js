/**
 * generate-dungeons-sub-v1.js
 *
 * Sprint 15 — Dungeons subterrâneas v1.
 * Gera 7 mapas BMS de dungeons subterrâneas (cavernas/minas/catacumbas):
 *
 *   dungeon_s01 — Caverna dos Ratos       (tuneis organicos, sala central, pocos)
 *   dungeon_s02 — Minas Abandonadas       (corredores de mina, trilhos, desabamento)
 *   dungeon_s03 — Catacumbas Antigas      (saloes cruciformes, criptas, ossos)
 *   dungeon_s04 — Gruta Inundada          (caverna parcialmente alagada, ilhas de pedra)
 *   dungeon_s05 — Ninho de Orcs           (saloes circulares, corredor principal)
 *   dungeon_s06 — Abismo dos Magos        (plataformas sobre vazio, pontes estreitas)
 *   dungeon_s07 — Cripta do Lich          (labirinto simetrico, camara central)
 *
 * Cada mapa:
 *   Nivel 0 — entrada/transicao: chao de pedra + escada de descida
 *   Nivel -1 (armazenado como nivel "m1") — subterraneo principal
 *
 * Tile size: 32px fixo. Acesso via MapLoader.getTileAt(x, y, level).
 * Default: "..." (vazio/abismo) para nivel 0 exterior; "cwl" para fill de nivel -1.
 *
 * Uso: node scripts/generate-dungeons-sub-v1.js
 * Saida: public/maps/dungeon_s01.json + _0.bin + _m1.bin ... (x7)
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
  "mkt", // 8  altar/tesouro
  "pil", // 9  pilar/estalagmite
  "fnt", // 10 fonte/poco
  "tre", // 11 fungo/estalagmite grande
  "dwl", // 12 habitacao/madeira
  "arc", // 13 arco/portao
  "sdw", // 14 sombra/decoracao
  "stu", // 15 escada para cima
  "std", // 16 escada para baixo
  "swl", // 17 parede de pedra grossa
  "sfl", // 18 chao de pedra subterraneo
  "cfl", // 19 chao de caverna
  "cwl", // 20 parede de caverna
  "wtr", // 21 agua
  "bal", // 22 ponte/passarela estreita
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

const IDX = {};
ATLAS.forEach((s, i) => { IDX[s] = i; });

function makePRNG(seed) {
  let state = seed >>> 0;
  return function random() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function makeGrid(W, H, fillSymbol) {
  return Array.from({ length: H }, () => new Uint8Array(W).fill(IDX[fillSymbol]));
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

// Tunel organico: escava caminhos com random walk
function tunnelWalk(grid, startX, startY, steps, W, H, floorSym, random) {
  let x = startX, y = startY;
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (let i = 0; i < steps; i++) {
    const hw = random() < 0.15 ? 2 : 1;
    fill(grid, x - hw, y - hw, x + hw, y + hw, W, H, floorSym);
    const dir = dirs[Math.floor(random() * 4)];
    x = Math.max(2, Math.min(W - 3, x + dir[0] * (1 + Math.floor(random() * 3))));
    y = Math.max(2, Math.min(H - 3, y + dir[1] * (1 + Math.floor(random() * 3))));
  }
}

function buildEntities(grid, W, H, random, count, floors) {
  const entities = [];
  const floorSet = new Set(floors.map(s => IDX[s]));
  let attempts = 0;
  while (entities.length < count && attempts < count * 60) {
    attempts++;
    const x = 1 + Math.floor(random() * (W - 2));
    const y = 1 + Math.floor(random() * (H - 2));
    if (floorSet.has(grid[y][x])) {
      entities.push({ symbol: random() < 0.3 ? "orc" : "gob", x, y });
    }
  }
  return entities;
}

// Nivel 0: sala de entrada simples com escada de descida
function makeEntrance(W, H, stairX, stairY, random) {
  const g = makeGrid(W, H, "...");
  // Plataforma de entrada
  disc(g, stairX, stairY, 8, W, H, "sfl");
  ring(g, stairX, stairY, 8, 1, W, H, "swl");
  // Escada para baixo
  set(g, stairX, stairY, W, H, "std");
  // Decoracao
  set(g, stairX - 3, stairY - 3, W, H, "pil");
  set(g, stairX + 3, stairY - 3, W, H, "pil");
  set(g, stairX - 3, stairY + 3, W, H, "pil");
  set(g, stairX + 3, stairY + 3, W, H, "pil");
  return g;
}

function writeMap(mapName, W, H, grids, levelKeys, playerPos, entityCountsPerLevel, random) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const floorTiles = ["cfl", "sfl", "flr", "stn", "cob", "mkt", "sdw", "bal"];
  const levels = {};

  grids.forEach((grid, i) => {
    const key = levelKeys[i];
    const binData = new Uint8Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        binData[y * W + x] = grid[y][x];

    const binFile = `${mapName}_${key}.bin`;
    fs.writeFileSync(path.join(OUTPUT_DIR, binFile), binData);

    const count = entityCountsPerLevel[i] || 0;
    levels[key] = {
      binFile,
      playerPos,
      entities: count > 0 ? buildEntities(grid, W, H, random, count, floorTiles) : [],
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
  console.log(`  [OK] ${mapName} (${W}x${H}, niveis: ${levelKeys.join("/")})`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUNGEON S01 — Caverna dos Ratos (65×65)
// Tuneis organicos com random walk, pocos de agua, sala central
// ═══════════════════════════════════════════════════════════════════════════════
function generateS01(random) {
  const W = 65, H = 65;
  const cx = 32, cy = 32;
  const sx = cx, sy = cy; // posicao da escada no nivel 0

  // Nivel 0: entrada
  const g0 = makeEntrance(W, H, sx, sy, random);

  // Nivel -1: caverna de ratos
  const gm1 = makeGrid(W, H, "cwl");

  // Sala central
  disc(gm1, cx, cy, 10, W, H, "cfl");
  ring(gm1, cx, cy, 10, 1, W, H, "cwl");

  // Tuneis organicos saindo da sala central
  const tunnelStarts = [
    [cx + 10, cy],
    [cx - 10, cy],
    [cx, cy + 10],
    [cx, cy - 10],
    [cx + 7, cy + 7],
    [cx - 7, cy - 7],
  ];
  tunnelStarts.forEach(([tx, ty]) => {
    tunnelWalk(gm1, tx, ty, 40, W, H, "cfl", random);
  });

  // Salas menores no final de alguns tuneis
  disc(gm1, 10, cy, 6, W, H, "cfl");
  disc(gm1, W - 11, cy, 7, W, H, "cfl");
  disc(gm1, cx, H - 11, 6, W, H, "cfl");
  disc(gm1, cx, 10, 5, W, H, "cfl");

  // Pocos de agua
  disc(gm1, 10, cy, 3, W, H, "wtr");
  disc(gm1, W - 11, 10, 3, W, H, "wtr");

  // Estalagmites espalhadas
  for (let i = 0; i < 30; i++) {
    const ex = 3 + Math.floor(random() * (W - 6));
    const ey = 3 + Math.floor(random() * (H - 6));
    if (gm1[ey][ex] === IDX.cfl) set(gm1, ex, ey, W, H, random() < 0.5 ? "pil" : "sdw");
  }

  // Altar no centro
  set(gm1, cx, cy, W, H, "mkt");
  set(gm1, cx - 2, cy - 2, W, H, "pil");
  set(gm1, cx + 2, cy - 2, W, H, "pil");

  // Escada de subida (volta ao nivel 0)
  set(gm1, cx, cy + 3, W, H, "stu");

  const playerPos = { x: sx * 32 + 16, y: sy * 32 + 16 };
  return { W, H, grids: [g0, gm1], levelKeys: ["0", "m1"], playerPos, entityCounts: [0, 18] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUNGEON S02 — Minas Abandonadas (80×55)
// Corredores ortogonais de mina, salas de mineracao, desabamento central
// ═══════════════════════════════════════════════════════════════════════════════
function generateS02(random) {
  const W = 80, H = 55;
  const sx = 40, sy = 10;

  // Nivel 0: entrada com escada
  const g0 = makeEntrance(W, H, sx, sy, random);

  // Nivel -1: minas
  const gm1 = makeGrid(W, H, "swl");

  // Corredor principal (horizontal)
  fill(gm1, 5, 27, W - 6, 29, W, H, "sfl");

  // Corredores secundarios (verticais) a cada 12 tiles
  for (let cx2 = 10; cx2 < W - 10; cx2 += 12) {
    fill(gm1, cx2 - 1, 5, cx2 + 1, H - 6, W, H, "sfl");
  }

  // Salas de mineracao
  const mineRooms = [
    [8, 8, 20, 22],
    [28, 8, 40, 22],
    [48, 8, 62, 22],
    [8, 33, 22, 48],
    [28, 33, 42, 48],
    [50, 33, 64, 48],
  ];
  mineRooms.forEach(([x0, y0, x1, y1]) => {
    rect(gm1, x0, y0, x1, y1, W, H, "swl", "sfl");
    // Veta de minerio (decoracao mkt)
    const midX = Math.floor((x0 + x1) / 2);
    const midY = Math.floor((y0 + y1) / 2);
    fill(gm1, midX - 1, midY - 1, midX + 1, midY + 1, W, H, "mkt");
    set(gm1, midX - 2, y0 + 1, W, H, "pil");
    set(gm1, midX + 2, y0 + 1, W, H, "pil");
  });

  // Desabamento central (entulho de pedra)
  fill(gm1, 35, 20, 50, 35, W, H, "cwl");
  disc(gm1, 42, 27, 4, W, H, "cfl"); // buraco no entulho (saida alternativa)
  set(gm1, 42, 27, W, H, "wtr");     // poco de agua do desabamento

  // Sala do supervisor (leste)
  rect(gm1, W - 18, 10, W - 5, 25, W, H, "bwl", "flr");
  set(gm1, W - 11, 25, W, H, "flr"); // porta
  set(gm1, W - 11, 17, W, H, "arc");
  fill(gm1, W - 16, 12, W - 7, 16, W, H, "mkt");
  set(gm1, W - 11, 13, W, H, "fnt");

  // Escada de retorno (fundo da mina)
  disc(gm1, 68, 42, 5, W, H, "sfl");
  set(gm1, 68, 42, W, H, "stu");
  set(gm1, 66, 40, W, H, "pil");
  set(gm1, 70, 40, W, H, "pil");

  // Conecta escada ao corredor
  line(gm1, 68, 37, 68, 30, 1, W, H, "sfl");

  const playerPos = { x: sx * 32 + 16, y: sy * 32 + 16 };
  return { W, H, grids: [g0, gm1], levelKeys: ["0", "m1"], playerPos, entityCounts: [0, 16] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUNGEON S03 — Catacumbas Antigas (70×70)
// Saloes cruciformes, nichos nas paredes, camara do sacerdote
// ═══════════════════════════════════════════════════════════════════════════════
function generateS03(random) {
  const W = 70, H = 70;
  const cx = 35, cy = 35;

  const g0 = makeEntrance(W, H, cx, cy - 25, random);

  const gm1 = makeGrid(W, H, "cwl");

  // Cruz principal (corredores de catacumba)
  fill(gm1, cx - 25, cy - 3, cx + 25, cy + 3, W, H, "cfl"); // horizontal
  fill(gm1, cx - 3, cy - 25, cx + 3, cy + 25, W, H, "cfl"); // vertical

  // Nichos nas paredes (criptas)
  for (let ox = -20; ox <= 20; ox += 8) {
    if (Math.abs(ox) > 3) {
      set(gm1, cx + ox, cy - 5, W, H, "mkt");
      set(gm1, cx + ox, cy + 5, W, H, "mkt");
    }
  }
  for (let oy = -20; oy <= 20; oy += 8) {
    if (Math.abs(oy) > 3) {
      set(gm1, cx - 5, cy + oy, W, H, "mkt");
      set(gm1, cx + 5, cy + oy, W, H, "mkt");
    }
  }

  // Saloes nos 4 bracos
  const wings = [
    [cx - 25, cy - 8, cx - 15, cy + 8],   // oeste
    [cx + 15, cy - 8, cx + 25, cy + 8],   // leste
    [cx - 8, cy - 25, cx + 8, cy - 15],   // norte
    [cx - 8, cy + 15, cx + 8, cy + 25],   // sul
  ];
  wings.forEach(([x0, y0, x1, y1]) => {
    disc(gm1, Math.floor((x0 + x1) / 2), Math.floor((y0 + y1) / 2), 6, W, H, "cfl");
    ring(gm1, Math.floor((x0 + x1) / 2), Math.floor((y0 + y1) / 2), 6, 1, W, H, "cwl");
  });

  // Camara central (sanctum mortuario)
  disc(gm1, cx, cy, 8, W, H, "sfl");
  ring(gm1, cx, cy, 8, 1, W, H, "swl");
  set(gm1, cx, cy, W, H, "mkt");
  set(gm1, cx - 4, cy - 4, W, H, "pil");
  set(gm1, cx + 4, cy - 4, W, H, "pil");
  set(gm1, cx - 4, cy + 4, W, H, "pil");
  set(gm1, cx + 4, cy + 4, W, H, "pil");
  set(gm1, cx, cy - 2, W, H, "arc");
  set(gm1, cx, cy + 2, W, H, "arc");

  // Estalagmites nos corredores
  for (let i = 0; i < 20; i++) {
    const ex = 3 + Math.floor(random() * (W - 6));
    const ey = 3 + Math.floor(random() * (H - 6));
    if (gm1[ey][ex] === IDX.cfl) set(gm1, ex, ey, W, H, "pil");
  }

  // Escada de retorno (no sanctum)
  set(gm1, cx - 2, cy - 1, W, H, "stu");

  // Agua sagrada (oesto)
  disc(gm1, cx - 20, cy, 3, W, H, "wtr");

  const playerPos = { x: cx * 32 + 16, y: (cy - 25) * 32 + 16 };
  return { W, H, grids: [g0, gm1], levelKeys: ["0", "m1"], playerPos, entityCounts: [0, 14] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUNGEON S04 — Gruta Inundada (75×60)
// Caverna parcialmente alagada, ilhas de pedra conectadas por pontes
// ═══════════════════════════════════════════════════════════════════════════════
function generateS04(random) {
  const W = 75, H = 60;
  const sx = 37, sy = 8;

  const g0 = makeEntrance(W, H, sx, sy, random);

  // Nivel -1: gruta inundada (default: agua!)
  const gm1 = makeGrid(W, H, "wtr");

  // Paredes externas
  fill(gm1, 0, 0, W - 1, 0, W, H, "cwl");
  fill(gm1, 0, H - 1, W - 1, H - 1, W, H, "cwl");
  fill(gm1, 0, 0, 0, H - 1, W, H, "cwl");
  fill(gm1, W - 1, 0, W - 1, H - 1, W, H, "cwl");

  // Ilhas de pedra (plataformas sobre a agua)
  const islands = [
    { cx: 12, cy: 15, r: 7 },
    { cx: 37, cy: 12, r: 8 },
    { cx: 62, cy: 15, r: 7 },
    { cx: 20, cy: 42, r: 8 },
    { cx: 50, cy: 45, r: 8 },
    { cx: 37, cy: 30, r: 6 },   // ilha central
  ];

  islands.forEach((isl) => {
    disc(gm1, isl.cx, isl.cy, isl.r, W, H, "cfl");
    ring(gm1, isl.cx, isl.cy, isl.r, 1, W, H, "cwl");
  });

  // Pontes entre ilhas
  const bridgePairs = [
    [islands[0], islands[5]],
    [islands[1], islands[5]],
    [islands[2], islands[5]],
    [islands[5], islands[3]],
    [islands[5], islands[4]],
    [islands[0], islands[3]],
    [islands[2], islands[4]],
  ];
  bridgePairs.forEach(([a, b]) => {
    line(gm1, a.cx, a.cy, b.cx, b.cy, 0, W, H, "bal");
  });

  // Decoracao nas ilhas
  islands.forEach((isl, i) => {
    if (i === 5) {
      // Ilha central: altar e pilares
      set(gm1, isl.cx, isl.cy, W, H, "mkt");
      set(gm1, isl.cx - 2, isl.cy - 2, W, H, "pil");
      set(gm1, isl.cx + 2, isl.cy - 2, W, H, "pil");
    } else {
      set(gm1, isl.cx, isl.cy, W, H, random() < 0.5 ? "sdw" : "fnt");
      if (random() < 0.5) set(gm1, isl.cx + 1, isl.cy + 1, W, H, "pil");
    }
  });

  // Escada de retorno (ilha central)
  set(gm1, islands[5].cx - 2, islands[5].cy + 2, W, H, "stu");

  // Estalactites (fungos no teto representados como pil no chao)
  for (let i = 0; i < 15; i++) {
    const ex = 2 + Math.floor(random() * (W - 4));
    const ey = 2 + Math.floor(random() * (H - 4));
    if (gm1[ey][ex] === IDX.cfl) set(gm1, ex, ey, W, H, "pil");
  }

  const playerPos = { x: sx * 32 + 16, y: sy * 32 + 16 };
  return { W, H, grids: [g0, gm1], levelKeys: ["0", "m1"], playerPos, entityCounts: [0, 12] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUNGEON S05 — Ninho de Orcs (80×65)
// Saloes circulares grandes, corredor central, sala do chefe
// ═══════════════════════════════════════════════════════════════════════════════
function generateS05(random) {
  const W = 80, H = 65;
  const cx = 40, cy = 32;
  const sx = cx, sy = 8;

  const g0 = makeEntrance(W, H, sx, sy, random);

  const gm1 = makeGrid(W, H, "cwl");

  // Corredor central (horizontal)
  fill(gm1, 5, cy - 3, W - 6, cy + 3, W, H, "cfl");

  // Saloes circulares ao longo do corredor
  const halls = [
    { cx: 15, cy: 20, r: 9 },
    { cx: 40, cy: 15, r: 10 }, // sala central
    { cx: 65, cy: 20, r: 9 },
    { cx: 15, cy: 50, r: 8 },
    { cx: 40, cy: 52, r: 9 },
    { cx: 65, cy: 50, r: 8 },
  ];

  halls.forEach((h) => {
    disc(gm1, h.cx, h.cy, h.r, W, H, "cfl");
    ring(gm1, h.cx, h.cy, h.r, 1, W, H, "cwl");
    // Conecta ao corredor
    line(gm1, h.cx, h.cy, cx, cy, 1, W, H, "cfl");
  });

  // Sala do chefe orc (leste, maior)
  disc(gm1, W - 14, cy, 10, W, H, "sfl");
  ring(gm1, W - 14, cy, 10, 1, W, H, "swl");
  // Trono
  fill(gm1, W - 20, cy - 3, W - 17, cy + 3, W, H, "mkt");
  set(gm1, W - 18, cy, W, H, "arc");
  set(gm1, W - 20, cy - 2, W, H, "pil");
  set(gm1, W - 20, cy + 2, W, H, "pil");
  // Armadilhas (agua no chao — fosso)
  fill(gm1, W - 16, cy - 8, W - 15, cy + 8, W, H, "wtr"); // fosso de entrada
  set(gm1, W - 15, cy, W, H, "sfl"); // ponte estreita
  set(gm1, W - 16, cy, W, H, "sfl");

  // Entrada da sala do chefe
  fill(gm1, W - 7, cy - 2, W - 6, cy + 2, W, H, "swl"); // portao fechado (paredes)
  set(gm1, W - 6, cy, W, H, "arc");

  // Estalagmites
  halls.forEach((h) => {
    set(gm1, h.cx - 3, h.cy - 3, W, H, "pil");
    set(gm1, h.cx + 3, h.cy - 3, W, H, "pil");
    set(gm1, h.cx, h.cy + h.r - 2, W, H, random() < 0.5 ? "sdw" : "fnt");
  });

  // Sala de entrada (inicio do ninho)
  disc(gm1, 8, cy, 7, W, H, "sfl");
  ring(gm1, 8, cy, 7, 1, W, H, "swl");
  set(gm1, 8, cy, W, H, "stu"); // escada de retorno

  const playerPos = { x: sx * 32 + 16, y: sy * 32 + 16 };
  return { W, H, grids: [g0, gm1], levelKeys: ["0", "m1"], playerPos, entityCounts: [0, 22] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUNGEON S06 — Abismo dos Magos (65×65)
// Plataformas de pedra sobre vazio total, pontes estreitas, sala do feiticeiro
// ═══════════════════════════════════════════════════════════════════════════════
function generateS06(random) {
  const W = 65, H = 65;
  const cx = 32, cy = 32;
  const sx = cx, sy = 8;

  const g0 = makeEntrance(W, H, sx, sy, random);

  // Nivel -1: abismo (default vazio!)
  const gm1 = makeGrid(W, H, "...");

  // Plataformas magicas flutuando sobre o abismo
  const platforms = [
    { cx: 32, cy: 8,  r: 6 },   // entrada
    { cx: 10, cy: 20, r: 5 },
    { cx: 55, cy: 20, r: 5 },
    { cx: 20, cy: 40, r: 6 },
    { cx: 45, cy: 42, r: 6 },
    { cx: 32, cy: 32, r: 8 },   // plataforma central
    { cx: 10, cy: 55, r: 5 },
    { cx: 55, cy: 55, r: 5 },
  ];

  platforms.forEach((p) => {
    disc(gm1, p.cx, p.cy, p.r, W, H, "sfl");
    ring(gm1, p.cx, p.cy, p.r, 1, W, H, "swl");
  });

  // Pontes entre plataformas
  const bridgePairs = [
    [platforms[0], platforms[1]],
    [platforms[0], platforms[2]],
    [platforms[1], platforms[3]],
    [platforms[2], platforms[4]],
    [platforms[3], platforms[5]],
    [platforms[4], platforms[5]],
    [platforms[3], platforms[6]],
    [platforms[4], platforms[7]],
  ];
  bridgePairs.forEach(([a, b]) => {
    line(gm1, a.cx, a.cy, b.cx, b.cy, 0, W, H, "bal");
  });

  // Sala central: camara do feiticeiro
  disc(gm1, cx, cy, 8, W, H, "sfl");
  ring(gm1, cx, cy, 8, 1, W, H, "swl");
  set(gm1, cx, cy, W, H, "mkt");
  set(gm1, cx - 4, cy - 4, W, H, "arc");
  set(gm1, cx + 4, cy - 4, W, H, "arc");
  set(gm1, cx - 4, cy + 4, W, H, "pil");
  set(gm1, cx + 4, cy + 4, W, H, "pil");
  fill(gm1, cx - 2, cy - 3, cx + 2, cy - 1, W, H, "mkt"); // altar central

  // Pocos de magma/agua nas plataformas menores
  set(gm1, platforms[1].cx, platforms[1].cy, W, H, "wtr");
  set(gm1, platforms[2].cx, platforms[2].cy, W, H, "wtr");
  set(gm1, platforms[6].cx, platforms[6].cy, W, H, "fnt");
  set(gm1, platforms[7].cx, platforms[7].cy, W, H, "fnt");

  // Escada de retorno (plataforma de entrada)
  set(gm1, platforms[0].cx, platforms[0].cy, W, H, "stu");
  set(gm1, platforms[0].cx - 2, platforms[0].cy - 2, W, H, "pil");
  set(gm1, platforms[0].cx + 2, platforms[0].cy - 2, W, H, "pil");

  const playerPos = { x: sx * 32 + 16, y: sy * 32 + 16 };
  return { W, H, grids: [g0, gm1], levelKeys: ["0", "m1"], playerPos, entityCounts: [0, 10] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUNGEON S07 — Cripta do Lich (75×75)
// Labirinto simetrico, camara central com boss, salas de rituais
// ═══════════════════════════════════════════════════════════════════════════════
function generateS07(random) {
  const W = 75, H = 75;
  const cx = 37, cy = 37;
  const sx = cx, sy = 10;

  const g0 = makeEntrance(W, H, sx, sy, random);

  const gm1 = makeGrid(W, H, "cwl");

  // Labirinto: corredor externo (anel)
  ring(gm1, cx, cy, 28, 2, W, H, "cfl");
  // Corredor intermediario (anel)
  ring(gm1, cx, cy, 20, 2, W, H, "cfl");
  // Corredor interno (anel)
  ring(gm1, cx, cy, 12, 2, W, H, "cfl");

  // Conexoes radiais (4 eixos cardeais + diagonais)
  const radials = [0, 45, 90, 135, 180, 225, 270, 315];
  radials.forEach((deg) => {
    const rad = (deg * Math.PI) / 180;
    for (let r = 10; r <= 30; r++) {
      const x = Math.round(cx + r * Math.cos(rad));
      const y = Math.round(cy + r * Math.sin(rad));
      if (r % 10 < 4) set(gm1, x, y, W, H, "cfl"); // conexao apenas em alguns arcos
    }
  });

  // Passagens de ligacao nos aneis (abertura de 3 tiles nos pontos cardeais)
  const passes = [
    [cx, cy - 28], [cx, cy + 28], [cx - 28, cy], [cx + 28, cy],
    [cx, cy - 20], [cx, cy + 20], [cx - 20, cy], [cx + 20, cy],
    [cx, cy - 12], [cx, cy + 12], [cx - 12, cy], [cx + 12, cy],
  ];
  passes.forEach(([px, py]) => {
    fill(gm1, px - 1, py - 1, px + 1, py + 1, W, H, "cfl");
  });

  // Salas de rituais nas diagonais do anel externo
  const rituais = [
    [cx - 22, cy - 22],
    [cx + 22, cy - 22],
    [cx - 22, cy + 22],
    [cx + 22, cy + 22],
  ];
  rituais.forEach(([rx, ry]) => {
    disc(gm1, rx, ry, 6, W, H, "sfl");
    ring(gm1, rx, ry, 6, 1, W, H, "swl");
    set(gm1, rx, ry, W, H, "mkt");
    set(gm1, rx - 2, ry - 2, W, H, "pil");
    set(gm1, rx + 2, ry - 2, W, H, "pil");
    set(gm1, rx - 2, ry + 2, W, H, "pil");
    set(gm1, rx + 2, ry + 2, W, H, "pil");
    // Conecta sala ao anel externo
    const dx = rx < cx ? 1 : -1;
    const dy = ry < cy ? 1 : -1;
    line(gm1, rx + dx * 6, ry, cx + dx * 28, ry, 0, W, H, "cfl");
    line(gm1, rx, ry + dy * 6, rx, cy + dy * 28, 0, W, H, "cfl");
  });

  // Camara central do Lich
  disc(gm1, cx, cy, 9, W, H, "sfl");
  ring(gm1, cx, cy, 9, 1, W, H, "swl");
  fill(gm1, cx - 3, cy - 3, cx + 3, cy + 3, W, H, "mkt");
  set(gm1, cx, cy, W, H, "arc");      // sarcofago do lich
  set(gm1, cx - 5, cy - 5, W, H, "pil");
  set(gm1, cx + 5, cy - 5, W, H, "pil");
  set(gm1, cx - 5, cy + 5, W, H, "pil");
  set(gm1, cx + 5, cy + 5, W, H, "pil");
  set(gm1, cx - 7, cy, W, H, "fnt");
  set(gm1, cx + 7, cy, W, H, "fnt");

  // Agua sagrada corrompida nos corredores
  for (let i = 0; i < 8; i++) {
    const ex = 5 + Math.floor(random() * (W - 10));
    const ey = 5 + Math.floor(random() * (H - 10));
    if (gm1[ey][ex] === IDX.cfl) set(gm1, ex, ey, W, H, "wtr");
  }

  // Escada de retorno (corredor externo norte)
  set(gm1, cx, cy - 25, W, H, "stu");
  set(gm1, cx - 2, cy - 27, W, H, "pil");
  set(gm1, cx + 2, cy - 27, W, H, "pil");

  const playerPos = { x: sx * 32 + 16, y: sy * 32 + 16 };
  return { W, H, grids: [g0, gm1], levelKeys: ["0", "m1"], playerPos, entityCounts: [0, 16] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
function main() {
  console.log("[generate-dungeons-sub-v1] Gerando 7 dungeons subterraneas (Sprint 15)...\n");

  const dungeons = [
    { name: "dungeon_s01", label: "Caverna dos Ratos",    seed: 15001, gen: generateS01 },
    { name: "dungeon_s02", label: "Minas Abandonadas",    seed: 15002, gen: generateS02 },
    { name: "dungeon_s03", label: "Catacumbas Antigas",   seed: 15003, gen: generateS03 },
    { name: "dungeon_s04", label: "Gruta Inundada",       seed: 15004, gen: generateS04 },
    { name: "dungeon_s05", label: "Ninho de Orcs",        seed: 15005, gen: generateS05 },
    { name: "dungeon_s06", label: "Abismo dos Magos",     seed: 15006, gen: generateS06 },
    { name: "dungeon_s07", label: "Cripta do Lich",       seed: 15007, gen: generateS07 },
  ];

  dungeons.forEach(({ name, label, seed, gen }) => {
    console.log(`  Gerando ${name} — ${label}...`);
    const random = makePRNG(seed);
    const { W, H, grids, levelKeys, playerPos, entityCounts } = gen(random);
    writeMap(name, W, H, grids, levelKeys, playerPos, entityCounts, makePRNG(seed + 999));
  });

  console.log("\n[generate-dungeons-sub-v1] Concluido: 7 dungeons subterraneas, 14 arquivos .bin gerados.");
  console.log("  Total acumulado Sprint 14+15: 14 dungeons.");
  console.log("  Testavel em: ?slice3d=1&map=dungeon_s01 ... dungeon_s07");
}

main();
