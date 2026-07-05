/**
 * debug_vertical — showcase map for multi-floor 3D (towers, pits, dungeon, lake).
 *
 * Levels: -2 (deep cavern), -1 (dungeon), 0 (surface), +1 (tower mid), +2 (tower top)
 *
 * Run: npm run generate:debug-vertical
 * Play: ?slice3d=1&map=debug_vertical&autostart=1
 */

const fs = require("fs");
const path = require("path");

const MAP_NAME = "debug_vertical";
const WIDTH = 56;
const HEIGHT = 56;
const TILE_SIZE = 32;
const OUTPUT_DIR = path.join(__dirname, "../public/maps");

const CX = Math.floor(WIDTH / 2);
const CY = Math.floor(HEIGHT / 2);

/** Tower stack (east) — up/down stairs separated by landing tiles on each floor. */
const TOWER_X = CX + 4;
const TOWER_UP_Y = 14;
const TOWER_DOWN_Y_L1 = CY + 5;
const TOWER_UP_Y_L1 = CY - 5;
const TOWER_DOWN_Y_L2 = CY + 3;

/** Dungeon stack (south) — separate from tower. */
const DUNGEON_X = CX;
const DUNGEON_MOUTH_Y = HEIGHT - 19;
const DUNGEON_UP_Y_L1 = 11;

const ATLAS = [
  "...",
  "cob",
  "wal",
  "grs",
  "stu",
  "std",
  "rfu",
  "wat",
  "wtr",
  "sfl",
  "swl",
  "cfl",
  "cwl",
  "bal",
  "stn",
];

const IDX = Object.fromEntries(ATLAS.map((sym, i) => [sym, i]));

const TILE_DEFS = {
  "...": { id: "void", color: "#1e293b", height: 0.02, renderAs: "floor" },
  cob: { id: "cobblestone", color: "#64748b", height: 0.06, renderAs: "floor" },
  grs: { id: "grass", color: "#4ade80", height: 0.05, renderAs: "floor" },
  stn: { id: "stone-plaza", color: "#94a3b8", height: 0.07, renderAs: "floor" },
  wal: {
    id: "wall",
    block: true,
    color: "#475569",
    height: 2.4,
    renderAs: "block",
  },
  stu: {
    id: "stairs-up",
    color: "#c4a07a",
    height: 0.5,
    renderAs: "floor",
    geometryProfile: "stair",
    stairDir: "up",
  },
  std: {
    id: "stairs-down",
    color: "#a8845c",
    height: 0.5,
    renderAs: "floor",
    geometryProfile: "stair",
    stairDir: "down",
  },
  rfu: {
    id: "ramp-floor-up",
    color: "#ca8a04",
    height: 2.0,
    rampRise: 2.0,
    levelTransition: "up",
    renderAs: "floor",
    geometryProfile: "ramp-n",
  },
  wat: {
    id: "water",
    color: "#1d4ed8",
    height: 0.08,
    renderAs: "floor",
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
  sfl: { id: "sewer-floor", color: "#57534e", height: 0.08, renderAs: "floor" },
  swl: {
    id: "sewer-wall",
    block: true,
    color: "#44403c",
    height: 2.2,
    renderAs: "block",
  },
  cfl: { id: "cave-floor", color: "#78716c", height: 0.08, renderAs: "floor" },
  cwl: {
    id: "cave-wall",
    block: true,
    color: "#57534e",
    height: 2.4,
    renderAs: "block",
  },
  bal: { id: "balcony", color: "#cbd5e1", height: 0.08, renderAs: "floor" },
};

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

function carveRoom(grid, x, y, w, h, floorSym, wallSym) {
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      const border =
        dx === 0 || dy === 0 || dx === w - 1 || dy === h - 1;
      set(grid, x + dx, y + dy, border ? wallSym : floorSym);
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

function buildLevel0() {
  const grid = makeGrid("...");
  fillRect(grid, 4, 4, WIDTH - 8, HEIGHT - 8, "grs");
  fillRect(grid, 10, 10, WIDTH - 20, HEIGHT - 20, "stn");

  // North-east tower base (up only on surface)
  carveRoom(grid, CX - 2, 8, 15, 12, "cob", "wal");
  set(grid, TOWER_X, TOWER_UP_Y, "stu");

  // South dungeon mouth (down only — separate shaft from tower)
  carveRoom(grid, CX - 5, HEIGHT - 18, 11, 9, "cob", "wal");
  set(grid, DUNGEON_X, DUNGEON_MOUTH_Y, "std");

  // West ramp to mid tower (walk south on gold tile)
  set(grid, CX - 12, CY, "rfu");

  // East lake
  carveWaterLake(grid, WIDTH - 18, CY - 3, 6, 6);

  // Central pit shaft to dungeon / cavern (void — not stairs)
  fillRect(grid, CX - 1, CY - 1, 3, 3, "...");

  return grid;
}

function buildLevel1() {
  const grid = makeGrid("...");
  carveRoom(grid, CX - 8, CY - 8, 17, 17, "cob", "wal");
  // Landing from tower up-stair (level 0)
  set(grid, TOWER_X, TOWER_UP_Y, "cob");
  // Descend tower — south side, 5+ tiles from landing
  set(grid, TOWER_X, TOWER_DOWN_Y_L1, "std");
  // Ascend to roof — north-west, away from down stair
  set(grid, TOWER_X - 8, TOWER_UP_Y_L1, "stu");
  // Balcony south — ledge fall test
  set(grid, TOWER_X, TOWER_DOWN_Y_L1 + 3, "bal");
  set(grid, TOWER_X, TOWER_DOWN_Y_L1 + 4, "...");

  // West ramp landing and bridge connecting to the main Level 1 room (doorway at x: 20)
  for (let x = 16; x <= 20; x++) {
    set(grid, x, 29, "cob");
    set(grid, x, 30, "cob");
  }

  return grid;
}

function buildLevel2() {
  const grid = makeGrid("...");
  carveRoom(grid, CX - 6, CY - 6, 13, 13, "bal", "wal");
  // Landing from mid-tower up-stair
  set(grid, TOWER_X - 8, TOWER_UP_Y_L1, "bal");
  // Descend to mid floor
  set(grid, TOWER_X - 8, TOWER_DOWN_Y_L2, "std");
  fillRect(grid, TOWER_X - 9, TOWER_DOWN_Y_L2 + 1, 3, 2, "...");
  return grid;
}

function buildLevelMinus1() {
  const grid = makeGrid("...");
  carveRoom(grid, 8, 8, WIDTH - 16, HEIGHT - 16, "sfl", "swl");
  carveRoom(grid, CX - 6, CY - 6, 13, 13, "sfl", "swl");
  // Up from dungeon mouth (level 0) — dedicated south shaft only
  set(grid, DUNGEON_X, DUNGEON_UP_Y_L1, "stu");
  fillRect(grid, CX - 1, CY - 1, 3, 3, "...");
  return grid;
}

function buildLevelMinus2() {
  const grid = makeGrid("...");
  carveRoom(grid, 6, 6, WIDTH - 12, HEIGHT - 12, "cfl", "cwl");
  carveWaterLake(grid, CX - 4, CY + 2, 8, 6);
  set(grid, CX, 8, "stu");
  fillRect(grid, CX - 1, CY - 1, 3, 3, "...");
  return grid;
}

function main() {
  const levels = {
    "-2": buildLevelMinus2(),
    "-1": buildLevelMinus1(),
    0: buildLevel0(),
    1: buildLevel1(),
    2: buildLevel2(),
  };

  const playerPos = {
    x: CX * TILE_SIZE + TILE_SIZE / 2,
    y: CY * TILE_SIZE + TILE_SIZE / 2,
  };

  const mapData = {
    mapName: MAP_NAME,
    tileSize: TILE_SIZE,
    width: WIDTH,
    height: HEIGHT,
    config: {
      startLevel: "0",
      mapName: "Debug Vertical World",
      debugVertical: true,
      zones: {
        spawn: { x: CX, y: CY },
        tower: {
          upL0: { x: TOWER_X, y: TOWER_UP_Y, level: "0" },
          landingL1: { x: TOWER_X, y: TOWER_UP_Y, level: "1" },
          downL1: { x: TOWER_X, y: TOWER_DOWN_Y_L1, level: "1" },
          upL1: { x: TOWER_X - 8, y: TOWER_UP_Y_L1, level: "1" },
          downL2: { x: TOWER_X - 8, y: TOWER_DOWN_Y_L2, level: "2" },
        },
        dungeon: {
          downL0: { x: DUNGEON_X, y: DUNGEON_MOUTH_Y, level: "0" },
          upL1: { x: DUNGEON_X, y: DUNGEON_UP_Y_L1, level: "-1" },
        },
        lake: { x: WIDTH - 15, y: CY, level: "0" },
        pit: { x: CX, y: CY, levels: ["0", "-1", "-2"] },
        ramp: { x: CX - 12, y: CY, level: "0", note: "walk south" },
        balconyFall: { x: TOWER_X, y: TOWER_DOWN_Y_L1 + 4, level: "1" },
      },
    },
    tileAtlas: ATLAS,
    tileDefinitions: TILE_DEFS,
    entityTemplates: {},
    levels: {},
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  Object.entries(levels).forEach(([levelKey, grid]) => {
    const binName = `${MAP_NAME}_${levelKey}.bin`;
    mapData.levels[levelKey] = {
      binFile: binName,
      playerPos,
      entities: [],
    };
    fs.writeFileSync(path.join(OUTPUT_DIR, binName), gridToBuffer(grid));
  });

  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${MAP_NAME}.json`),
    `${JSON.stringify(mapData, null, 2)}\n`,
  );

  console.log(`[debug-vertical] map=${MAP_NAME} size=${WIDTH}x${HEIGHT}`);
  console.log("[debug-vertical] levels: -2, -1, 0, +1, +2");
  console.log(`[debug-vertical] wrote public/maps/${MAP_NAME}.json`);
  console.log("[debug-vertical] play: ?slice3d=1&map=debug_vertical&autostart=1");
}

main();
