/**
 * generate-multilevel-3d-map.js
 * Generates a 3-level BMS map for the 3D runtime:
 *   level "-1"  — underground sewer / cave network
 *   level "0"   — surface city with houses, streets, plazas
 *   level "1"   — upper floors above tall buildings (balconies + rooftops)
 *
 * Stairs connect all three layers:
 *   "stu" = climb up    "std" = descend down
 *
 * Run: node scripts/generate-multilevel-3d-map.js
 */

const fs = require("fs");
const path = require("path");

const MAP_NAME = "city_3d_multi";
const W = 120;
const H = 120;
const OUTPUT_DIR = path.join(__dirname, "../public/maps");

// ─── Tile atlas ───────────────────────────────────────────────────────────────
const ATLAS = [
  "...", //  0 – void / sky  (upper-floor default)
  "cob", //  1 – cobblestone street
  "wal", //  2 – outer city wall  (tall)
  "bwl", //  3 – building wall
  "flr", //  4 – wooden floor (interior)
  "rof", //  5 – red roof tile
  "grs", //  6 – grass
  "stn", //  7 – stone plaza
  "mkt", //  8 – market floor
  "pil", //  9 – pillar
  "fnt", // 10 – fountain
  "tre", // 11 – tree
  "dwl", // 12 – dark wall
  "arc", // 13 – archway
  "sdw", // 14 – stone dark wall (watchtower)
  "stu", // 15 – stairs up
  "std", // 16 – stairs down
  "swl", // 17 – sewer brick wall
  "sfl", // 18 – sewer wet floor
  "cfl", // 19 – cave floor (dirt/rock)
  "cwl", // 20 – cave wall (rough rock)
  "wtr", // 21 – water / drain pool
  "bal", // 22 – balcony floor (upper level)
];

const TILE_DEFS = {
  "...": { id: "void", color: "#7ec8e3", height: 0.02, renderAs: "floor" },
  cob: { id: "cobblestone", color: "#64748b", height: 0.06, renderAs: "floor" },
  wal: {
    id: "city-wall",
    color: "#78716c",
    block: true,
    height: 4.5,
    renderAs: "block",
  },
  bwl: {
    id: "building-wall",
    color: "#94a3b8",
    block: true,
    height: 2.8,
    renderAs: "block",
  },
  flr: { id: "wood-floor", color: "#92400e", height: 0.08, renderAs: "floor" },
  rof: { id: "roof-tile", color: "#b91c1c", height: 2.8, renderAs: "floor" },
  grs: { id: "grass", color: "#4ade80", height: 0.05, renderAs: "floor" },
  stn: { id: "stone-plaza", color: "#9ca3af", height: 0.07, renderAs: "floor" },
  mkt: {
    id: "market-floor",
    color: "#ca8a04",
    height: 0.07,
    renderAs: "floor",
  },
  pil: {
    id: "pillar",
    color: "#d1d5db",
    block: true,
    height: 3.2,
    renderAs: "block",
  },
  fnt: {
    id: "fountain",
    color: "#38bdf8",
    block: true,
    height: 0.9,
    renderAs: "block",
  },
  tre: {
    id: "tree",
    color: "#15803d",
    block: true,
    height: 3.4,
    renderAs: "block",
  },
  dwl: {
    id: "dark-wall",
    color: "#374151",
    block: true,
    height: 2.8,
    renderAs: "block",
  },
  arc: {
    id: "archway",
    color: "#a8a29e",
    block: true,
    height: 3.8,
    renderAs: "block",
  },
  sdw: {
    id: "stone-dark-wall",
    color: "#44403c",
    block: true,
    height: 5.2,
    renderAs: "block",
  },
  stu: {
    id: "stairs-up",
    color: "#e2c87d",
    height: 0.12,
    renderAs: "floor",
    stairDir: "up",
  },
  std: {
    id: "stairs-down",
    color: "#a07040",
    height: 0.12,
    renderAs: "floor",
    stairDir: "down",
  },
  swl: {
    id: "sewer-wall",
    color: "#1e293b",
    block: true,
    height: 2.5,
    renderAs: "block",
  },
  sfl: { id: "sewer-floor", color: "#334155", height: 0.06, renderAs: "floor" },
  cfl: { id: "cave-floor", color: "#78350f", height: 0.08, renderAs: "floor" },
  cwl: {
    id: "cave-wall",
    color: "#292524",
    block: true,
    height: 2.6,
    renderAs: "block",
  },
  wtr: { id: "water", color: "#1d4ed8", height: 0.04, renderAs: "floor" },
  bal: { id: "balcony", color: "#c4b5a0", height: 0.08, renderAs: "floor" },
};

const IDX = {};
ATLAS.forEach((sym, i) => {
  IDX[sym] = i;
});

// ─── Grid helpers ─────────────────────────────────────────────────────────────
function makeGrid(w, h, fillSym) {
  const idx = IDX[fillSym];
  return Array.from({ length: h }, () => new Uint8Array(w).fill(idx));
}

function set(grid, x, y, sym) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  grid[y][x] = IDX[sym];
}

function fill(grid, x0, y0, x1, y1, sym) {
  const idx = IDX[sym];
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++)
      grid[y][x] = idx;
}

function rect(grid, x0, y0, x1, y1, wallSym, floorSym) {
  fill(grid, x0, y0, x1, y1, floorSym);
  for (let x = x0; x <= x1; x++) {
    set(grid, x, y0, wallSym);
    set(grid, x, y1, wallSym);
  }
  for (let y = y0; y <= y1; y++) {
    set(grid, x0, y, wallSym);
    set(grid, x1, y, wallSym);
  }
}

function makePRNG(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

// ─── Surface level (0) ───────────────────────────────────────────────────────
/**
 * Returns { grid, houses, stairDownPositions, stairUpPositions }
 * houses: Array of {x, y, w, h} footprints used to mirror upper floor
 * stairDownPositions: [{x, y}] placed on level 0
 * stairUpPositions:   [{x, y}] placed on level 0
 */
function generateLevel0(rng) {
  const grid = makeGrid(W, H, "cob");

  // Outer walls
  for (let i = 0; i < W; i++) {
    set(grid, i, 0, "wal");
    set(grid, i, 1, "wal");
    set(grid, i, H - 1, "wal");
    set(grid, i, H - 2, "wal");
  }
  for (let j = 0; j < H; j++) {
    set(grid, 0, j, "wal");
    set(grid, 1, j, "wal");
    set(grid, W - 1, j, "wal");
    set(grid, W - 2, j, "wal");
  }

  // Corner watchtowers
  for (const [tx, ty] of [
    [2, 2],
    [W - 7, 2],
    [2, H - 7],
    [W - 7, H - 7],
  ])
    fill(grid, tx, ty, tx + 4, ty + 4, "sdw");

  // Gates N/S/E/W
  const mid = Math.floor(W / 2);
  for (let dx = -2; dx <= 2; dx++) {
    set(grid, mid + dx, 0, "arc");
    set(grid, mid + dx, 1, "cob");
    set(grid, mid + dx, H - 1, "arc");
    set(grid, mid + dx, H - 2, "cob");
  }
  const midH = Math.floor(H / 2);
  for (let dy = -2; dy <= 2; dy++) {
    set(grid, 0, midH + dy, "arc");
    set(grid, 1, midH + dy, "cob");
    set(grid, W - 1, midH + dy, "arc");
    set(grid, W - 2, midH + dy, "cob");
  }

  // Roads
  const hRoadPositions = [35, 60, 85];
  const vRoadPositions = [35, 60, 85];
  for (const rp of hRoadPositions) fill(grid, 2, rp - 2, W - 3, rp + 2, "cob");
  for (const rp of vRoadPositions) fill(grid, rp - 2, 2, rp + 2, H - 3, "cob");

  // Tree-lined avenues
  for (let x = 8; x < W - 8; x += 6) {
    if (rng() < 0.55) {
      set(grid, x, 57, "tre");
      set(grid, x, 63, "tre");
    }
    if (rng() < 0.55) {
      set(grid, 57, x, "tre");
      set(grid, 63, x, "tre");
    }
  }

  // Build city blocks between roads
  const hBounds = [2, ...hRoadPositions, H - 3].sort((a, b) => a - b);
  const vBounds = [2, ...vRoadPositions, W - 3].sort((a, b) => a - b);

  const houses = [];
  const stairDownPositions = [];

  for (let bi = 0; bi < hBounds.length - 1; bi++) {
    for (let bj = 0; bj < vBounds.length - 1; bj++) {
      const bx = vBounds[bj] + 3;
      const by = hBounds[bi] + 3;
      const bw = vBounds[bj + 1] - 3 - bx;
      const bh = hBounds[bi + 1] - 3 - by;
      if (bw < 6 || bh < 6) continue;

      const isCentral = bj === 1 && bi === 1;
      const isMarket = !isCentral && rng() < 0.18;
      const isPark = !isCentral && !isMarket && rng() < 0.18;

      if (isCentral) {
        fill(grid, bx, by, bx + bw - 1, by + bh - 1, "stn");
        const cx = bx + Math.floor(bw / 2);
        const cy = by + Math.floor(bh / 2);
        fill(grid, cx - 2, cy - 2, cx + 2, cy + 2, "fnt");
        for (const [ox, oy] of [
          [2, 2],
          [bw - 3, 2],
          [2, bh - 3],
          [bw - 3, bh - 3],
        ])
          set(grid, bx + ox, by + oy, "pil");
        // Stairs down in the central plaza corner
        set(grid, bx + 2, by + bh - 2, "std");
        stairDownPositions.push({ x: bx + 2, y: by + bh - 2 });
      } else if (isMarket) {
        fill(grid, bx, by, bx + bw - 1, by + bh - 1, "mkt");
        for (let ms = 0; ms < 3; ms++) {
          const sx = bx + 2 + Math.floor(rng() * Math.max(1, bw - 6));
          const sy = by + 2 + Math.floor(rng() * Math.max(1, bh - 4));
          fill(grid, sx, sy, sx + 2, sy + 1, "bwl");
        }
        // Stair down in market corners
        if (rng() < 0.5) {
          set(grid, bx + 1, by + 1, "std");
          stairDownPositions.push({ x: bx + 1, y: by + 1 });
        }
      } else if (isPark) {
        fill(grid, bx, by, bx + bw - 1, by + bh - 1, "grs");
        for (let t = 0; t < 3 + Math.floor(rng() * 4); t++) {
          const tx = bx + 1 + Math.floor(rng() * (bw - 2));
          const ty = by + 1 + Math.floor(rng() * (bh - 2));
          set(grid, tx, ty, "tre");
        }
        fill(
          grid,
          bx + Math.floor(bw / 2) - 1,
          by,
          bx + Math.floor(bw / 2) + 1,
          by + bh - 1,
          "stn",
        );
      } else {
        // Houses
        const numHouses = 2 + Math.floor(rng() * 3);
        const placed = [];
        for (let hi = 0; hi < numHouses; hi++) {
          const hw = 5 + Math.floor(rng() * 7);
          const hh = 5 + Math.floor(rng() * 7);
          const hx = bx + 1 + Math.floor(rng() * Math.max(1, bw - hw - 2));
          const hy = by + 1 + Math.floor(rng() * Math.max(1, bh - hh - 2));
          if (hx + hw > bx + bw - 1 || hy + hh > by + bh - 1) continue;
          const overlap = placed.some(
            ([px, py, pw, ph]) =>
              hx < px + pw && hx + hw > px && hy < py + ph && hy + hh > py,
          );
          if (overlap) continue;
          placed.push([hx, hy, hw, hh]);

          const wallSym = rng() < 0.35 ? "dwl" : "bwl";
          rect(grid, hx, hy, hx + hw - 1, hy + hh - 1, wallSym, "rof");
          houses.push({ x: hx, y: hy, w: hw, h: hh });

          // Door opening
          const side = Math.floor(rng() * 4);
          if (side === 0) set(grid, hx + Math.floor(hw / 2), hy, "flr");
          else if (side === 1)
            set(grid, hx + Math.floor(hw / 2), hy + hh - 1, "flr");
          else if (side === 2) set(grid, hx, hy + Math.floor(hh / 2), "flr");
          else set(grid, hx + hw - 1, hy + Math.floor(hh / 2), "flr");

          // Stairs up inside large houses (≥7 wide)
          if (hw >= 7 && hh >= 7 && rng() < 0.6) {
            set(grid, hx + 1, hy + 1, "stu");
          }
        }
      }
    }
  }

  // Collect stair-up positions from grid
  const stairUpPositions = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (grid[y][x] === IDX["stu"]) stairUpPositions.push({ x, y });

  return { grid, houses, stairDownPositions, stairUpPositions };
}

// ─── Upper level (1): rooftops + balconies ────────────────────────────────────
function generateLevel1(rng, houses) {
  // Default is "..." (void/sky)
  const grid = makeGrid(W, H, "...");

  for (const house of houses) {
    const { x: hx, y: hy, w: hw, h: hh } = house;
    // Upper floor walls match the footprint
    rect(grid, hx, hy, hx + hw - 1, hy + hh - 1, "bwl", "flr");

    // Add stairs-down to return to ground
    set(grid, hx + 1, hy + 1, "std");

    // Roof tile cover over upper floor
    fill(grid, hx + 1, hy + 1, hx + hw - 2, hy + hh - 2, "rof");

    // Some balconies outside wall
    if (hw >= 8 && rng() < 0.5) {
      fill(grid, hx + 2, hy - 1, hx + hw - 3, hy - 1, "bal");
    }
  }

  return grid;
}

// ─── Underground level (-1): sewers + caves ───────────────────────────────────
function generateLevelMinus1(rng, stairDownPositions) {
  // Default cave floor everywhere
  const grid = makeGrid(W, H, "cfl");

  // Outer boundary walls
  for (let i = 0; i < W; i++) {
    set(grid, i, 0, "cwl");
    set(grid, i, H - 1, "cwl");
  }
  for (let j = 0; j < H; j++) {
    set(grid, 0, j, "cwl");
    set(grid, W - 1, j, "cwl");
  }

  // Main sewer channels (wide corridors)
  const hChannels = [30, 50, 70, 90];
  const vChannels = [30, 50, 70, 90];

  for (const rp of hChannels) {
    fill(grid, 1, rp - 1, W - 2, rp + 1, "sfl");
    // Occasional water pools
    for (let x = 5; x < W - 5; x += 12)
      if (rng() < 0.3) fill(grid, x, rp - 1, x + 3, rp + 1, "wtr");
  }
  for (const rp of vChannels) {
    fill(grid, rp - 1, 1, rp + 1, H - 2, "sfl");
  }

  // Sewer chambers at intersections
  for (const hy of hChannels) {
    for (const vx of vChannels) {
      fill(grid, vx - 3, hy - 3, vx + 3, hy + 3, "sfl");
      // Stone walls around chambers
      for (let dx = -3; dx <= 3; dx++) {
        set(grid, vx + dx, hy - 3, "swl");
        set(grid, vx + dx, hy + 3, "swl");
      }
      for (let dy = -3; dy <= 3; dy++) {
        set(grid, vx - 3, hy + dy, "swl");
        set(grid, vx + 3, hy + dy, "swl");
      }
    }
  }

  // Cave branch tunnels (wider organic corridors)
  const branchOffsets = [
    [15, 15],
    [W - 15, 15],
    [15, H - 15],
    [W - 15, H - 15],
    [Math.floor(W / 2), 15],
    [15, Math.floor(H / 2)],
  ];
  for (const [bx, by] of branchOffsets) {
    const radius = 5 + Math.floor(rng() * 5);
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++)
        if (dx * dx + dy * dy <= radius * radius)
          set(grid, bx + dx, by + dy, "cfl");
    // Connect to nearest channel
    const nearH = hChannels.reduce((prev, curr) =>
      Math.abs(curr - by) < Math.abs(prev - by) ? curr : prev,
    );
    if (by < nearH) fill(grid, bx - 1, by, bx + 1, nearH, "cfl");
    else fill(grid, bx - 1, nearH, bx + 1, by, "cfl");
  }

  // Stair connections: place stair-up under each stair-down in level 0
  for (const { x, y } of stairDownPositions) {
    set(grid, x, y, "stu");
  }

  // Add a few extra stair-up positions near the channel intersections
  for (const hy of hChannels.slice(0, 2)) {
    for (const vx of vChannels.slice(0, 2)) {
      if (rng() < 0.4) set(grid, vx + 2, hy + 2, "stu");
    }
  }

  return grid;
}

// ─── Build and write output ───────────────────────────────────────────────────
function buildOutput() {
  const rng = makePRNG(7331);

  const { grid: grid0, houses, stairDownPositions } = generateLevel0(rng);
  const grid1 = generateLevel1(rng, houses);
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
  const binFile1 = writeLevel("1", grid1);
  const binFileM1 = writeLevel("m1", gridM1); // "-1" level stored as "m1" file

  // Find player spawn on cobblestone
  let playerX = 60 * 32,
    playerY = 60 * 32;
  outer: for (let y = 10; y < H - 10; y++)
    for (let x = 10; x < W - 10; x++)
      if (grid0[y][x] === IDX["cob"]) {
        playerX = x * 32 + 16;
        playerY = y * 32 + 16;
        break outer;
      }

  // Entities for each level
  const mkEnemies = (count, g) => {
    const result = [];
    let placed = 0;
    for (let attempt = 0; attempt < count * 20 && placed < count; attempt++) {
      const ex = 4 + Math.floor(Math.random() * (W - 8));
      const ey = 4 + Math.floor(Math.random() * (H - 8));
      const sym = g[ey]?.[ex];
      if (
        sym === IDX["cob"] ||
        sym === IDX["sfl"] ||
        sym === IDX["cfl"] ||
        sym === IDX["stn"] ||
        sym === IDX["flr"]
      ) {
        result.push({ symbol: placed % 3 === 0 ? "orc" : "gob", x: ex, y: ey });
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
      mapName: "City Multi-Level 3D",
    },
    tileAtlas: ATLAS,
    tileDefinitions: TILE_DEFS,
    entityTemplates: {
      gob: { type: "enemy", id: "goblin" },
      orc: { type: "enemy", id: "orc" },
      swd: { type: "item", id: "wooden_sword" },
    },
    levels: {
      0: {
        binFile: binFile0,
        playerPos: { x: playerX, y: playerY },
        entities: mkEnemies(25, grid0),
      },
      1: {
        binFile: binFile1,
        playerPos: { x: playerX, y: playerY },
        entities: mkEnemies(8, grid1),
      },
      "-1": {
        binFile: binFileM1,
        playerPos: { x: playerX, y: playerY },
        entities: mkEnemies(20, gridM1),
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
  console.log(
    `  Houses: ${houses.length}  Stairs-down: ${stairDownPositions.length}`,
  );
  console.log(`  Open: ?slice3d=1&map=${MAP_NAME}&fp=1`);
}

console.log(
  `[generate-multilevel-3d-map] Generating ${MAP_NAME} (${W}x${H}, 3 levels)...`,
);
buildOutput();
console.log("[generate-multilevel-3d-map] Done.");
