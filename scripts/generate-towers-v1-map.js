"use strict";

const fs = require("fs");
const path = require("path");

const MAP_NAME = "torres_v1";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "maps");
const W = 150;
const H = 120;

const ATLAS = [
  "...",
  "cob",
  "wal",
  "bwl",
  "flr",
  "rof",
  "grs",
  "stn",
  "mkt",
  "pil",
  "fnt",
  "tre",
  "dwl",
  "arc",
  "sdw",
  "stu",
  "std",
  "swl",
  "sfl",
  "cfl",
  "cwl",
  "wtr",
  "bal",
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
  stu: { color: 0xc8b040, height: 0.5, renderAs: "floor", block: false, stairDir: "up" },
  std: { color: 0xc89040, height: 0.5, renderAs: "floor", block: false, stairDir: "down" },
  swl: { color: 0x505060, height: 2.0, renderAs: "wall", block: true },
  sfl: { color: 0x606878, height: 0.15, renderAs: "floor", block: false },
  cfl: { color: 0x554444, height: 0.15, renderAs: "floor", block: false },
  cwl: { color: 0x443333, height: 2.0, renderAs: "wall", block: true },
  wtr: { color: 0x2060a0, height: 0.1, renderAs: "floor", block: false },
  bal: { color: 0x907060, height: 0.2, renderAs: "floor", block: false },
};

const IDX = {};
ATLAS.forEach((symbol, index) => {
  IDX[symbol] = index;
});

function makeGrid(fillSymbol = "...") {
  const fillIndex = IDX[fillSymbol];
  return Array.from({ length: H }, () => new Uint8Array(W).fill(fillIndex));
}

function set(grid, x, y, symbol) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  grid[y][x] = IDX[symbol];
}

function fill(grid, x0, y0, x1, y1, symbol) {
  const fillIndex = IDX[symbol];
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      grid[y][x] = fillIndex;
    }
  }
}

function drawDisc(grid, centerX, centerY, radius, symbol) {
  for (let y = centerY - radius; y <= centerY + radius; y++) {
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radius * radius) {
        set(grid, x, y, symbol);
      }
    }
  }
}

function drawRing(grid, centerX, centerY, radius, thickness, symbol) {
  const outer = radius * radius;
  const innerRadius = Math.max(0, radius - thickness);
  const inner = innerRadius * innerRadius;
  for (let y = centerY - radius; y <= centerY + radius; y++) {
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = dx * dx + dy * dy;
      if (distance <= outer && distance >= inner) {
        set(grid, x, y, symbol);
      }
    }
  }
}

function drawPath(grid, x0, y0, x1, y1, halfWidth, symbol) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let step = 0; step <= steps; step++) {
    const t = steps === 0 ? 0 : step / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    fill(grid, x - halfWidth, y - halfWidth, x + halfWidth, y + halfWidth, symbol);
  }
}

function makePRNG(seed) {
  let state = seed >>> 0;
  return function random() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function carveTowerLevel(grid, tower, outerRadius, wallThickness, floorSymbol, wallSymbol) {
  drawDisc(grid, tower.cx, tower.cy, outerRadius, floorSymbol);
  drawRing(grid, tower.cx, tower.cy, outerRadius, wallThickness, wallSymbol);
}

function decorateTowerBase(grid, tower, random) {
  carveTowerLevel(grid, tower, tower.baseRadius, 2, "stn", "swl");

  set(grid, tower.cx, tower.cy, "stu");
  set(grid, tower.cx - 2, tower.cy - 2, "pil");
  set(grid, tower.cx + 2, tower.cy - 2, "pil");

  // Portao principal voltado para a praca
  drawPath(grid, tower.cx, tower.cy + tower.baseRadius, tower.cx, tower.cy + tower.baseRadius + 3, 1, "cob");
  set(grid, tower.cx, tower.cy + tower.baseRadius, "arc");

  // Pequenas salas laterais na base
  fill(grid, tower.cx - 5, tower.cy - 1, tower.cx - 3, tower.cy + 1, "flr");
  fill(grid, tower.cx + 3, tower.cy - 1, tower.cx + 5, tower.cy + 1, "flr");

  if (random() < 0.7) {
    set(grid, tower.cx - 4, tower.cy, "mkt");
  }
  if (random() < 0.7) {
    set(grid, tower.cx + 4, tower.cy, "fnt");
  }
}

function decorateTowerMid(grid, tower, random) {
  carveTowerLevel(grid, tower, tower.midRadius, 1, "sfl", "wal");
  set(grid, tower.cx, tower.cy, "std");

  // Sala do meio com altar/pilares
  fill(grid, tower.cx - 2, tower.cy - 2, tower.cx + 2, tower.cy + 2, "mkt");
  set(grid, tower.cx - 3, tower.cy - 3, "pil");
  set(grid, tower.cx + 3, tower.cy - 3, "pil");

  if (random() < 0.5) {
    set(grid, tower.cx, tower.cy - 4, "arc");
  }
}

function decorateTowerTop(grid, tower, random) {
  carveTowerLevel(grid, tower, tower.topRadius, 1, "stn", "swl");
  set(grid, tower.cx, tower.cy, "std");

  // Mirante no topo
  set(grid, tower.cx, tower.cy - 2, "fnt");
  set(grid, tower.cx - 2, tower.cy, "pil");
  set(grid, tower.cx + 2, tower.cy, "pil");

  if (random() < 0.6) {
    set(grid, tower.cx, tower.cy + 2, "mkt");
  }
}

function generateLevel0(random) {
  const grid = makeGrid("grs");
  const towers = [
    { id: "west", cx: 30, cy: 66, baseRadius: 12, midRadius: 9, topRadius: 7 },
    { id: "north", cx: 75, cy: 34, baseRadius: 13, midRadius: 10, topRadius: 8 },
    { id: "east", cx: 120, cy: 68, baseRadius: 12, midRadius: 9, topRadius: 7 },
  ];

  // Praca central conectando as torres
  drawDisc(grid, 75, 56, 10, "cob");
  set(grid, 75, 56, "fnt");

  towers.forEach((tower) => decorateTowerBase(grid, tower, random));

  drawPath(grid, towers[0].cx + 10, towers[0].cy - 6, 75, 56, 1, "cob");
  drawPath(grid, 75, 56, towers[1].cx, towers[1].cy + 12, 1, "cob");
  drawPath(grid, 75, 56, towers[2].cx - 10, towers[2].cy - 8, 1, "cob");

  // Canal decorativo
  drawPath(grid, 50, 96, 102, 96, 1, "wtr");
  set(grid, 76, 96, "bal");
  set(grid, 75, 96, "bal");

  // Vegetacao leve
  for (let i = 0; i < 28; i++) {
    const x = 5 + Math.floor(random() * (W - 10));
    const y = 5 + Math.floor(random() * (H - 10));
    if (grid[y][x] === IDX.grs && random() < 0.45) {
      set(grid, x, y, "tre");
    }
  }

  return { grid, towers };
}

function generateLevel1(random, towers) {
  const grid = makeGrid("...");

  towers.forEach((tower) => {
    decorateTowerMid(grid, tower, random);
  });

  // Pontes altas entre torres
  drawPath(grid, towers[0].cx + towers[0].midRadius - 1, towers[0].cy - 2, towers[1].cx - towers[1].midRadius + 1, towers[1].cy + 5, 0, "bal");
  drawPath(grid, towers[1].cx + towers[1].midRadius - 1, towers[1].cy + 5, towers[2].cx - towers[2].midRadius + 1, towers[2].cy - 2, 0, "bal");

  // Escada para o topo na torre norte (v1 simplificado)
  set(grid, towers[1].cx + 2, towers[1].cy, "stu");

  return grid;
}

function generateLevel2(random, towers) {
  const grid = makeGrid("...");

  towers.forEach((tower) => {
    decorateTowerTop(grid, tower, random);
  });

  // Skybridge curta conectando topo norte ao oeste e ao leste
  drawPath(grid, towers[1].cx - towers[1].topRadius + 1, towers[1].cy + 1, towers[0].cx + towers[0].topRadius - 1, towers[0].cy + 1, 0, "bal");
  drawPath(grid, towers[1].cx + towers[1].topRadius - 1, towers[1].cy + 1, towers[2].cx - towers[2].topRadius + 1, towers[2].cy + 1, 0, "bal");

  // Escada de volta para nivel 1
  set(grid, towers[1].cx + 2, towers[1].cy, "std");

  return grid;
}

function buildEntities(levelIndex, grid, random, count) {
  const entities = [];
  let attempts = 0;
  while (entities.length < count && attempts < count * 60) {
    attempts += 1;
    const x = 8 + Math.floor(random() * (W - 16));
    const y = 8 + Math.floor(random() * (H - 16));
    const tile = grid[y] && grid[y][x];
    if (
      tile === IDX.stn ||
      tile === IDX.cob ||
      tile === IDX.mkt ||
      tile === IDX.bal ||
      tile === IDX.flr ||
      tile === IDX.sfl
    ) {
      entities.push({
        symbol: levelIndex === 2 ? (entities.length % 3 === 0 ? "orc" : "gob") : entities.length % 4 === 0 ? "orc" : "gob",
        x,
        y,
      });
    }
  }
  return entities;
}

function writeLevel(levelKey, grid) {
  const binData = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      binData[y * W + x] = grid[y][x];
    }
  }

  const binFile = `${MAP_NAME}_${levelKey}.bin`;
  fs.writeFileSync(path.join(OUTPUT_DIR, binFile), binData);
  return binFile;
}

function main() {
  const random = makePRNG(16001);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const { grid: grid0, towers } = generateLevel0(random);
  const grid1 = generateLevel1(random, towers);
  const grid2 = generateLevel2(random, towers);

  const binFile0 = writeLevel("0", grid0);
  const binFile1 = writeLevel("1", grid1);
  const binFile2 = writeLevel("2", grid2);

  const spawn = { x: 75, y: 56 };
  const playerPos = { x: spawn.x * 32 + 16, y: spawn.y * 32 + 16 };

  const metadata = {
    mapName: MAP_NAME,
    tileSize: 32,
    width: W,
    height: H,
    config: {
      startLevel: "0",
      mapName: "Torres V1",
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
        playerPos,
        entities: buildEntities(0, grid0, random, 18),
      },
      1: {
        binFile: binFile1,
        playerPos,
        entities: buildEntities(1, grid1, random, 10),
      },
      2: {
        binFile: binFile2,
        playerPos,
        entities: buildEntities(2, grid2, random, 6),
      },
    },
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, `${MAP_NAME}.json`), JSON.stringify(metadata, null, 2));

  console.log("[generate-towers-v1-map] Generated torres_v1 with 3 connected towers.");
}

main();
