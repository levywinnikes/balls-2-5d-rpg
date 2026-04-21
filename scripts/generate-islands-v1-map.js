"use strict";

const fs = require("fs");
const path = require("path");

const MAP_NAME = "ilhas_v1";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "maps");
const W = 140;
const H = 110;

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

function rect(grid, x0, y0, x1, y1, wallSymbol, floorSymbol) {
  fill(grid, x0, y0, x1, y1, floorSymbol);
  fill(grid, x0, y0, x1, y0, wallSymbol);
  fill(grid, x0, y1, x1, y1, wallSymbol);
  fill(grid, x0, y0, x0, y1, wallSymbol);
  fill(grid, x1, y0, x1, y1, wallSymbol);
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

function placeRuins(grid, centerX, centerY, radius, random) {
  const blocks = [
    [centerX - radius + 4, centerY - 4, centerX - 2, centerY + 4],
    [centerX + 2, centerY - 4, centerX + radius - 4, centerY + 4],
    [centerX - 4, centerY - radius + 4, centerX + 4, centerY - 2],
    [centerX - 4, centerY + 2, centerX + 4, centerY + radius - 4],
  ];

  blocks.forEach(([x0, y0, x1, y1], index) => {
    rect(grid, x0, y0, x1, y1, index % 2 === 0 ? "wal" : "dwl", "flr");
    const doorX = Math.floor((x0 + x1) / 2);
    set(grid, doorX, y0, "flr");
    set(grid, doorX, y1, "flr");
    if (random() < 0.5) {
      set(grid, x0 + 1, y0 + 1, "pil");
    }
  });
}

function generateLevel0() {
  return makeGrid("...");
}

function generateLevel1(random) {
  const grid = makeGrid("...");
  const islands = [
    { id: "west", cx: 30, cy: 68, radius: 18, stair: { x: 30, y: 68 } },
    { id: "north", cx: 70, cy: 32, radius: 20, stair: { x: 70, y: 32 } },
    { id: "east", cx: 108, cy: 70, radius: 19, stair: { x: 108, y: 70 } },
  ];

  islands.forEach((island, index) => {
    drawDisc(grid, island.cx, island.cy, island.radius, "stn");
    drawRing(grid, island.cx, island.cy, island.radius, 2, "cob");
    placeRuins(grid, island.cx, island.cy, island.radius - 2, random);

    if (index === 1) {
      drawDisc(grid, island.cx, island.cy, 5, "mkt");
      set(grid, island.cx, island.cy, "fnt");
      set(grid, island.cx - 3, island.cy - 3, "tre");
      set(grid, island.cx + 3, island.cy - 3, "tre");
      set(grid, island.cx - 3, island.cy + 3, "tre");
      set(grid, island.cx + 3, island.cy + 3, "tre");
    } else {
      set(grid, island.cx, island.cy, "arc");
    }

    drawPath(grid, island.cx - island.radius + 3, island.cy, island.cx + island.radius - 3, island.cy, 1, "cob");
    drawPath(grid, island.cx, island.cy - island.radius + 3, island.cx, island.cy + island.radius - 3, 1, "cob");
    set(grid, island.stair.x, island.stair.y, "stu");
  });

  drawPath(grid, islands[0].cx + islands[0].radius - 2, islands[0].cy - 1, islands[1].cx - islands[1].radius + 2, islands[1].cy + 6, 1, "bal");
  drawPath(grid, islands[1].cx + islands[1].radius - 2, islands[1].cy + 6, islands[2].cx - islands[2].radius + 2, islands[2].cy - 2, 1, "bal");
  drawPath(grid, islands[0].cx + islands[0].radius - 3, islands[0].cy + 4, islands[2].cx - islands[2].radius + 3, islands[2].cy + 2, 1, "bal");

  return { grid, islands };
}

function generateLevel2(random, islands) {
  const grid = makeGrid("...");

  islands.forEach((island, index) => {
    const lookoutRadius = index === 1 ? 8 : 6;
    drawDisc(grid, island.stair.x, island.stair.y, lookoutRadius, "stn");
    drawRing(grid, island.stair.x, island.stair.y, lookoutRadius, 1, "swl");
    set(grid, island.stair.x, island.stair.y, "std");
    set(grid, island.stair.x, island.stair.y - lookoutRadius + 1, "stn");

    if (index === 1) {
      fill(grid, island.stair.x - 4, island.stair.y - 1, island.stair.x + 4, island.stair.y + 1, "rof");
      set(grid, island.stair.x - 5, island.stair.y, "arc");
      set(grid, island.stair.x + 5, island.stair.y, "arc");
    } else {
      set(grid, island.stair.x - 2, island.stair.y - 1, random() < 0.5 ? "pil" : "sdw");
      set(grid, island.stair.x + 2, island.stair.y - 1, random() < 0.5 ? "pil" : "sdw");
    }
  });

  drawPath(grid, islands[0].stair.x + 6, islands[0].stair.y - 2, islands[1].stair.x - 6, islands[1].stair.y + 4, 0, "bal");
  drawPath(grid, islands[1].stair.x + 6, islands[1].stair.y + 4, islands[2].stair.x - 6, islands[2].stair.y - 1, 0, "bal");

  return grid;
}

function buildEntities(levelIndex, grid, random, count) {
  const entities = [];
  let attempts = 0;
  while (entities.length < count && attempts < count * 50) {
    attempts += 1;
    const x = 10 + Math.floor(random() * (W - 20));
    const y = 10 + Math.floor(random() * (H - 20));
    const tile = grid[y] && grid[y][x];
    if (tile === IDX.stn || tile === IDX.cob || tile === IDX.mkt || tile === IDX.bal || tile === IDX.flr || tile === IDX.rof) {
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
  const random = makePRNG(13001);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const grid0 = generateLevel0();
  const { grid: grid1, islands } = generateLevel1(random);
  const grid2 = generateLevel2(random, islands);

  const binFile0 = writeLevel("0", grid0);
  const binFile1 = writeLevel("1", grid1);
  const binFile2 = writeLevel("2", grid2);

  const spawn = islands[1].stair;
  const playerPos = { x: spawn.x * 32 + 16, y: spawn.y * 32 + 16 };

  const metadata = {
    mapName: MAP_NAME,
    tileSize: 32,
    width: W,
    height: H,
    config: {
      startLevel: "1",
      mapName: "Ilhas V1",
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
        entities: [],
      },
      1: {
        binFile: binFile1,
        playerPos,
        entities: buildEntities(1, grid1, random, 18),
      },
      2: {
        binFile: binFile2,
        playerPos,
        entities: buildEntities(2, grid2, random, 6),
      },
    },
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${MAP_NAME}.json`),
    JSON.stringify(metadata, null, 2),
  );

  console.log(`[generate-islands-v1-map] Generated ${MAP_NAME} with 3 connected islands.`);
}

main();