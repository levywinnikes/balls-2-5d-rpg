/**
 * debug_forest — floresta com props animados PixelLab (oak_tree, wild_flower) para teste 3D.
 *
 * Run: npm run generate:debug-forest
 * Play: ?map=debug_forest&autostart=1  (ou play-debug-forest.bat)
 */

const fs = require("fs");
const path = require("path");

const MAP_NAME = "debug_forest";
const WIDTH = 64;
const HEIGHT = 64;
const TILE_SIZE = 32;
const OUTPUT_DIR = path.join(__dirname, "../public/maps");
const SPAWN_X = 32;
const SPAWN_Y = 32;

const ATLAS = [
  "...",
  "grs",
  "pat",
  "stn",
  "hlm",
  "rpn",
  "rps",
  "wat",
  "wtr",
  "wal",
  "pr00",
  "pr01",
];

const IDX = Object.fromEntries(ATLAS.map((sym, i) => [sym, i]));

const TILE_DEFS = {
  "...": { id: "void", color: "#1e293b", height: 0.02, renderAs: "floor" },
  grs: { id: "grass", color: "#4ade80", height: 0.05, renderAs: "floor" },
  pat: { id: "path", color: "#a8a29e", height: 0.05, renderAs: "floor" },
  stn: { id: "stone-plaza", color: "#94a3b8", height: 0.07, renderAs: "floor" },
  hlm: {
    id: "hill-mound",
    color: "#65a30d",
    height: 0.22,
    renderAs: "floor",
    geometryProfile: "slab",
  },
  rpn: {
    id: "ramp-n",
    color: "#84cc16",
    height: 0.32,
    rampRise: 0.32,
    renderAs: "floor",
    geometryProfile: "ramp-n",
  },
  rps: {
    id: "plateau-high",
    color: "#4d7c0f",
    height: 0.38,
    renderAs: "floor",
    geometryProfile: "slab",
  },
  wal: {
    id: "wall",
    block: true,
    color: "#365314",
    height: 2.4,
    renderAs: "block",
  },
  wat: {
    id: "water",
    color: "#1d4ed8",
    height: 0.08,
    renderAs: "floor",
    block: true,
    waterProfile: {
      mode: "swimming",
      surfaceLevel: 0.58,
      bodyCover: 0.82,
      speedMultiplier: 0.45,
      sinkOffset: -0.26,
    },
  },
  wtr: {
    id: "water-shallow",
    color: "#60a5fa",
    height: 0.04,
    renderAs: "floor",
    waterProfile: {
      mode: "wading",
      surfaceLevel: 0.3,
      bodyCover: 0.4,
      speedMultiplier: 0.65,
      sinkOffset: -0.05,
    },
  },
  pr00: {
    type: "decoration",
    id: "oak_tree",
    isCollidable: true,
  },
  pr01: {
    type: "decoration",
    id: "wild_flower",
    isCollidable: false,
  },
};

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGrid(fill = "...") {
  return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(fill));
}

function set(grid, x, y, sym) {
  if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
    grid[y][x] = sym;
  }
}

function fillRect(grid, x, y, w, h, sym) {
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      set(grid, x + dx, y + dy, sym);
    }
  }
}

function carveWaterLake(grid, x, y, w, h) {
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      const edge =
        dx === 0 || dy === 0 || dx === w - 1 || dy === h - 1;
      set(grid, x + dx, y + dy, edge ? "wtr" : "wat");
    }
  }
}

function gridToBuffer(grid) {
  const buffer = Buffer.alloc(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const sym = grid[y][x];
      const idx = IDX[sym];
      if (idx === undefined) {
        throw new Error(`Unknown symbol ${sym} at ${x},${y}`);
      }
      buffer[y * WIDTH + x] = idx;
    }
  }
  return buffer;
}

function isPropFloor(sym) {
  return sym === "grs";
}

function buildForest() {
  const grid = makeGrid("...");
  const rng = mulberry32(0xf0ae573d);

  fillRect(grid, 2, 2, WIDTH - 4, HEIGHT - 4, "grs");

  // Trilhas em cruz + anel interno
  for (let x = 6; x < WIDTH - 6; x += 1) {
    if (grid[SPAWN_Y][x] === "grs") set(grid, x, SPAWN_Y, "pat");
  }
  for (let y = 6; y < HEIGHT - 6; y += 1) {
    if (grid[y][SPAWN_X] === "grs") set(grid, SPAWN_X, y, "pat");
  }
  fillRect(grid, 14, 14, WIDTH - 28, HEIGHT - 28, "pat");

  // Clareira de spawn
  fillRect(grid, SPAWN_X - 3, SPAWN_Y - 3, 7, 7, "stn");

  // Morros (floresta com relevo leve)
  const hillSpots = [
    [12, 10],
    [48, 12],
    [10, 48],
    [50, 46],
    [28, 8],
    [40, 52],
  ];
  hillSpots.forEach(([hx, hy]) => {
    set(grid, hx, hy, "hlm");
    set(grid, hx + 1, hy, "rpn");
    set(grid, hx + 2, hy, "rps");
  });

  // Lago nordeste
  carveWaterLake(grid, WIDTH - 16, 8, 7, 6);

  const occupied = new Set();
  const mark = (x, y) => occupied.add(`${x},${y}`);
  const isFree = (x, y) => !occupied.has(`${x},${y}`);

  for (let y = SPAWN_Y - 2; y <= SPAWN_Y + 2; y += 1) {
    for (let x = SPAWN_X - 2; x <= SPAWN_X + 2; x += 1) {
      mark(x, y);
    }
  }

  const entities = [];

  const tryPlaceTree = (x, y) => {
    if (!isPropFloor(grid[y][x]) || !isFree(x, y)) return false;
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const key = `${x + dx},${y + dy}`;
        if (occupied.has(key)) return false;
      }
    }
    mark(x, y);
    entities.push({ x, y, symbol: "pr00" });
    return true;
  };

  const tryPlaceFlower = (x, y) => {
    if (!isPropFloor(grid[y][x]) || !isFree(x, y)) return false;
    mark(x, y);
    entities.push({ x, y, symbol: "pr01" });
    return true;
  };

  let trees = 0;
  for (let y = 4; y < HEIGHT - 4; y += 1) {
    for (let x = 4; x < WIDTH - 4; x += 1) {
      if (rng() < 0.045 && tryPlaceTree(x, y)) {
        trees += 1;
      }
    }
  }

  let flowers = 0;
  for (let y = 4; y < HEIGHT - 4; y += 1) {
    for (let x = 4; x < WIDTH - 4; x += 1) {
      if (rng() < 0.08 && tryPlaceFlower(x, y)) {
        flowers += 1;
      }
    }
  }

  return { grid, entities, trees, flowers };
}

function main() {
  const { grid, entities, trees, flowers } = buildForest();
  const playerPos = {
    x: SPAWN_X * TILE_SIZE + TILE_SIZE / 2,
    y: SPAWN_Y * TILE_SIZE + TILE_SIZE / 2,
  };

  const mapData = {
    mapName: MAP_NAME,
    tileSize: TILE_SIZE,
    width: WIDTH,
    height: HEIGHT,
    config: {
      startLevel: "0",
      mapName: "Debug Forest",
      debugForest: true,
      props: {
        oak_tree: trees,
        wild_flower: flowers,
      },
    },
    tileAtlas: ATLAS,
    tileDefinitions: TILE_DEFS,
    entityTemplates: {
      pr00: { type: "decoration", id: "oak_tree", isCollidable: true },
      pr01: { type: "decoration", id: "wild_flower", isCollidable: false },
    },
    levels: {
      0: {
        binFile: `${MAP_NAME}_0.bin`,
        playerPos,
        entities,
      },
    },
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${MAP_NAME}_0.bin`),
    gridToBuffer(grid),
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${MAP_NAME}.json`),
    `${JSON.stringify(mapData, null, 2)}\n`,
  );

  console.log(`[debug-forest] map=${MAP_NAME} size=${WIDTH}x${HEIGHT}`);
  console.log(`[debug-forest] props: ${trees} oak_tree, ${flowers} wild_flower`);
  console.log(`[debug-forest] wrote public/maps/${MAP_NAME}.json`);
  console.log("[debug-forest] play: ?map=debug_forest&autostart=1");
}

main();
