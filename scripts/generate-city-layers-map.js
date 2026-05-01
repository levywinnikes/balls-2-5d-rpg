const fs = require("fs");
const path = require("path");

const ROOT_DIR = process.cwd();
const MAP_NAME = "city_layers_test";
const MAP_DIR = path.join(ROOT_DIR, "public", "maps");
const MAP_PATH = path.join(MAP_DIR, `${MAP_NAME}.json`);

const WIDTH = 64;
const HEIGHT = 64;

const ATLAS = [
  "...",
  "grs",
  "pav",
  "cob",
  "flr",
  "wal",
  "rof",
  "sup",
  "sdn",
  "hol",
  "dfn",
  "dwl",
  "wat",
  "gob",
  "rak",
  "chs",
  "tre",
];

const idx = (symbol) => {
  const i = ATLAS.indexOf(symbol);
  if (i < 0) {
    throw new Error(`Tile symbol not in atlas: ${symbol}`);
  }
  return i;
};

function createGrid(fillSymbol) {
  return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(fillSymbol));
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;
}

function setTile(grid, x, y, symbol) {
  if (!inBounds(x, y)) return;
  grid[y][x] = symbol;
}

function fillRect(grid, x1, y1, x2, y2, symbol) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      setTile(grid, x, y, symbol);
    }
  }
}

function borderRect(grid, x1, y1, x2, y2, symbol) {
  for (let x = x1; x <= x2; x++) {
    setTile(grid, x, y1, symbol);
    setTile(grid, x, y2, symbol);
  }
  for (let y = y1; y <= y2; y++) {
    setTile(grid, x1, y, symbol);
    setTile(grid, x2, y, symbol);
  }
}

function carveDoor(grid, x, y, symbol = "flr") {
  setTile(grid, x, y, symbol);
}

function toBinaryBuffer(grid) {
  const buffer = Buffer.alloc(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      buffer[y * WIDTH + x] = idx(grid[y][x]);
    }
  }
  return buffer;
}

function buildLevelMinusOne() {
  const g = createGrid("dfn");
  borderRect(g, 0, 0, WIDTH - 1, HEIGHT - 1, "dwl");

  // Sewer channels and rooms
  fillRect(g, 6, 6, 57, 9, "wat");
  fillRect(g, 6, 54, 57, 57, "wat");
  fillRect(g, 6, 10, 9, 53, "wat");
  fillRect(g, 54, 10, 57, 53, "wat");

  borderRect(g, 14, 14, 24, 24, "dwl");
  fillRect(g, 15, 15, 23, 23, "dfn");
  carveDoor(g, 19, 24, "dfn");

  borderRect(g, 39, 14, 49, 24, "dwl");
  fillRect(g, 40, 15, 48, 23, "dfn");
  carveDoor(g, 44, 24, "dfn");

  borderRect(g, 26, 34, 37, 47, "dwl");
  fillRect(g, 27, 35, 36, 46, "dfn");
  carveDoor(g, 31, 34, "dfn");

  // Stair up to city center
  setTile(g, 32, 32, "sup");

  return g;
}

function buildLevelZero() {
  const g = createGrid("grs");
  borderRect(g, 0, 0, WIDTH - 1, HEIGHT - 1, "wal");

  // Main avenues
  fillRect(g, 0, 30, WIDTH - 1, 34, "pav");
  fillRect(g, 30, 0, 34, HEIGHT - 1, "pav");

  // City center
  fillRect(g, 24, 24, 40, 40, "cob");
  setTile(g, 32, 32, "sdn"); // Stair down to sewers
  setTile(g, 32, 30, "sup"); // Stair up to upper city (level 1)

  // District plazas
  fillRect(g, 8, 8, 20, 20, "cob");
  fillRect(g, 44, 8, 56, 20, "cob");
  fillRect(g, 8, 44, 20, 56, "cob");
  fillRect(g, 44, 44, 56, 56, "cob");

  // House A (3 floors)
  borderRect(g, 10, 10, 18, 18, "wal");
  fillRect(g, 11, 11, 17, 17, "flr");
  carveDoor(g, 14, 18, "cob");
  setTile(g, 12, 12, "sup");

  // House B (2 floors)
  borderRect(g, 24, 12, 31, 19, "wal");
  fillRect(g, 25, 13, 30, 18, "flr");
  carveDoor(g, 27, 19, "cob");
  setTile(g, 26, 14, "sup");

  // House C (4 floors/tower)
  borderRect(g, 41, 18, 46, 23, "wal");
  fillRect(g, 42, 19, 45, 22, "flr");
  carveDoor(g, 43, 23, "cob");
  setTile(g, 43, 20, "sup");

  // House D (2 floors)
  borderRect(g, 46, 44, 54, 52, "wal");
  fillRect(g, 47, 45, 53, 51, "flr");
  carveDoor(g, 50, 52, "cob");
  setTile(g, 48, 46, "sup");

  return g;
}

function buildLevelOne() {
  const g = createGrid("...");

  // Upper city walkway network
  fillRect(g, 22, 22, 42, 42, "cob");
  fillRect(g, 11, 12, 17, 17, "flr");
  fillRect(g, 25, 13, 30, 18, "flr");
  fillRect(g, 42, 19, 45, 22, "flr");
  fillRect(g, 47, 45, 53, 51, "flr");

  // Keep structural perimeter walls for volumetric readability
  borderRect(g, 10, 10, 18, 18, "wal");
  borderRect(g, 24, 12, 31, 19, "wal");
  borderRect(g, 41, 18, 46, 23, "wal");
  borderRect(g, 46, 44, 54, 52, "wal");

  // Stairs linking level 0 -> 1
  setTile(g, 12, 12, "sdn");
  setTile(g, 26, 14, "sdn");
  setTile(g, 43, 20, "sdn");
  setTile(g, 48, 46, "sdn");

  // Up stairs for higher floors
  setTile(g, 13, 13, "sup"); // House A to level 2
  setTile(g, 43, 21, "sup"); // Tower C to level 2

  // Elevated city access stairs: from level 0 and up to level 2
  setTile(g, 32, 30, "sdn");
  setTile(g, 33, 30, "sup");

  return g;
}

function buildLevelTwo() {
  const g = createGrid("...");

  // House A upper floor / roof deck
  fillRect(g, 11, 11, 17, 17, "rof");
  borderRect(g, 10, 10, 18, 18, "wal");
  setTile(g, 13, 13, "sdn");

  // Tower C level 2
  fillRect(g, 42, 19, 45, 22, "flr");
  borderRect(g, 41, 18, 46, 23, "wal");
  setTile(g, 43, 21, "sdn");
  setTile(g, 44, 21, "sup"); // Tower C to level 3

  // Upper-city continuation from level 1 stair cluster
  fillRect(g, 30, 28, 36, 34, "cob");
  setTile(g, 33, 30, "sdn");

  return g;
}

function buildLevelThree() {
  const g = createGrid("...");

  // Top of tower C
  fillRect(g, 42, 19, 45, 22, "rof");
  borderRect(g, 41, 18, 46, 23, "wal");
  setTile(g, 44, 21, "sdn");

  return g;
}

function writeMapFiles(levelBuffers) {
  const mapJson = {
    mapName: MAP_NAME,
    tileSize: 32,
    width: WIDTH,
    height: HEIGHT,
    config: {
      startLevel: "0",
      mapName: "Layer Stress City",
    },
    tileAtlas: ATLAS,
    tileDefinitions: {
      grs: { id: "grass", color: "#4ade80", height: 0.05, renderAs: "floor" },
      pav: {
        id: "pavement",
        color: "#9ca3af",
        height: 0.06,
        renderAs: "floor",
      },
      cob: {
        id: "cobblestone",
        color: "#64748b",
        height: 0.06,
        renderAs: "floor",
      },
      flr: { id: "floor", color: "#78350f", height: 0.08, renderAs: "floor" },
      wal: {
        id: "wall",
        block: true,
        color: "#4b5563",
        height: 2.6,
        renderAs: "block",
      },
      rof: {
        id: "red-roof",
        color: "#ef4444",
        height: 0.15,
        renderAs: "floor",
      },
      sup: {
        id: "stair_up",
        transition: "up",
        color: "#f59e0b",
        height: 0.08,
        renderAs: "floor",
      },
      sdn: {
        id: "stair_down",
        transition: "down",
        color: "#0ea5e9",
        height: 0.08,
        renderAs: "floor",
      },
      hol: {
        id: "hole",
        transition: "down",
        color: "#111827",
        height: 0.02,
        renderAs: "floor",
      },
      dfn: {
        id: "sewer-floor",
        color: "#1e293b",
        height: 0.06,
        renderAs: "floor",
      },
      dwl: {
        id: "dungeon-wall",
        block: true,
        color: "#0f172a",
        height: 2.4,
        renderAs: "block",
      },
      wat: {
        id: "water",
        block: true,
        color: "#0ea5e9",
        height: 0.12,
        renderAs: "block",
      },
    },
    entityTemplates: {
      gob: { type: "enemy", id: "goblin" },
      rak: { type: "enemy", id: "rat" },
      chs: {
        type: "item",
        id: "light_torch",
        contents: [
          { id: "light_torch", count: 3 },
          { id: "wooden_sword", count: 1 },
        ],
      },
      tre: { type: "decoration", id: "tree" },
    },
    levels: {
      "-1": {
        binFile: `${MAP_NAME}_-1.bin`,
        playerPos: { x: 1024, y: 1024 },
        entities: [
          { x: 19, y: 19, symbol: "rak" },
          { x: 44, y: 19, symbol: "rak" },
        ],
      },
      0: {
        binFile: `${MAP_NAME}_0.bin`,
        playerPos: { x: 1024, y: 1024 },
        entities: [
          { x: 33, y: 26, symbol: "gob" },
          { x: 50, y: 49, symbol: "chs" },
          { x: 8, y: 8, symbol: "tre" },
          { x: 55, y: 8, symbol: "tre" },
        ],
      },
      1: {
        binFile: `${MAP_NAME}_1.bin`,
        playerPos: { x: 1024, y: 960 },
        entities: [],
      },
      2: {
        binFile: `${MAP_NAME}_2.bin`,
        playerPos: { x: 1024, y: 960 },
        entities: [],
      },
      3: {
        binFile: `${MAP_NAME}_3.bin`,
        playerPos: { x: 1408, y: 672 },
        entities: [],
      },
    },
  };

  fs.writeFileSync(MAP_PATH, JSON.stringify(mapJson, null, 2));

  Object.entries(levelBuffers).forEach(([level, buffer]) => {
    fs.writeFileSync(path.join(MAP_DIR, `${MAP_NAME}_${level}.bin`), buffer);
  });
}

function main() {
  if (!fs.existsSync(MAP_DIR)) {
    throw new Error(`Maps directory not found: ${MAP_DIR}`);
  }

  const levelMinusOne = buildLevelMinusOne();
  const levelZero = buildLevelZero();
  const levelOne = buildLevelOne();
  const levelTwo = buildLevelTwo();
  const levelThree = buildLevelThree();

  const levelBuffers = {
    "-1": toBinaryBuffer(levelMinusOne),
    0: toBinaryBuffer(levelZero),
    1: toBinaryBuffer(levelOne),
    2: toBinaryBuffer(levelTwo),
    3: toBinaryBuffer(levelThree),
  };

  writeMapFiles(levelBuffers);

  console.log(
    `[CITY] Generated ${MAP_NAME}.json and ${MAP_NAME}_{-1,0,1,2,3}.bin in public/maps`,
  );
}

main();
