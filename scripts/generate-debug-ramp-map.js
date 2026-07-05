/**
 * debug_ramp — minimal map with a single ramp for testing.
 *
 * Ramp-s: low at north (z=5, entry), high at south (z=6, exit to L1).
 * Spawn north of the ramp → walk south to climb (enter at low end).
 *
 * Levels: 0 (ground), +1 (upper)
 * Run: node scripts/generate-debug-ramp-map.js
 * Play: ?slice3d=1&map=debug_ramp&autostart=1&log=1&overlay=1
 */

const fs = require("fs");
const path = require("path");

const MAP_NAME = "debug_ramp";
const W = 12;
const H = 12;
const TILE_SIZE = 32;
const OUT = path.join(__dirname, "../public/maps");

const ATLAS = ["...", "stn", "ramp"];
const IDX = Object.fromEntries(ATLAS.map((s, i) => [s, i]));

const TILE_DEFS = {
  "...": { id: "void", color: "#1e293b", height: 0.02, renderAs: "floor" },
  stn:  { id: "stone-plaza", color: "#94a3b8", height: 0.07, renderAs: "floor" },
  ramp: {
    id: "stairs-down",
    color: "#a8845c",
    height: 2.32,
    rampRise: 2.0,
    renderAs: "floor",
    geometryProfile: "ramp-s",
  },
};

function grid(buf) {
  return Array.from({ length: H }, () => Array(W).fill(buf));
}

function set(g, x, y, sym) {
  if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = sym;
}

function toBuf(g) {
  const b = Buffer.alloc(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      b[y * W + x] = IDX[g[y][x]] ?? 0;
  return b;
}

// Level 0: stone floor + ramp at (5,5), (6,5)
// ramp-s: low at north (z=5), high at south (z=6)
// Walk south from spawn (y=3) to enter ramp at low end
const L0 = grid("...");
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    L0[y][x] = "stn";
// Two ramp tiles side by side
set(L0, 5, 5, "ramp");
set(L0, 6, 5, "ramp");

// Level 1: landing platform at south (ramp exit)
const L1 = grid("...");
// Voids above ramp tiles
set(L1, 5, 5, "...");
set(L1, 6, 5, "...");
// Landing south of ramp (adjacent to ramp high end at z=6)
for (let x = 4; x <= 7; x++) {
  set(L1, x, 6, "stn");
  set(L1, x, 7, "stn");
}

const mapData = {
  mapName: MAP_NAME,
  tileSize: TILE_SIZE,
  width: W,
  height: H,
  config: {
    startLevel: "0",
    mapName: "Debug Ramp",
    debugRamp: true,
    zones: {
      spawn: { x: 6, y: 3, level: "0", note: "north of ramp — walk south to climb" },
      ramp: { x: 5, y: 5, level: "0", note: "ramp-s: walk south to climb" },
      landingL1: { x: 6, y: 6, level: "1" },
    },
  },
  tileAtlas: ATLAS,
  tileDefinitions: TILE_DEFS,
  entityTemplates: {},
  levels: {},
};

const levels = { 0: L0, 1: L1 };

fs.mkdirSync(OUT, { recursive: true });
Object.entries(levels).forEach(([lk, g]) => {
  const bin = `${MAP_NAME}_${lk}.bin`;
  mapData.levels[lk] = { binFile: bin, entities: [] };
  fs.writeFileSync(path.join(OUT, bin), toBuf(g));
});
fs.writeFileSync(path.join(OUT, `${MAP_NAME}.json`), JSON.stringify(mapData, null, 2) + "\n");

console.log(`[debug-ramp] map=${MAP_NAME} size=${W}x${H}`);
console.log("[debug-ramp] spawn at (6,3), ramp at (5..6,5), landing at L1(4..7,6..7)");
console.log("[debug-ramp] play: ?slice3d=1&map=debug_ramp&autostart=1&log=1&overlay=1");
