/**
 * generate-giant-3d-map.js
 * Generates a giant 3D BMS map (200x200 tiles) for stress testing the 3D runtime.
 * Layout: walled city with street grid, city blocks, houses, plazas, market, park.
 * Run: node scripts/generate-giant-3d-map.js
 */

const fs = require("fs");
const path = require("path");

const MAP_NAME = "giant_city_3d";
const W = 200;
const H = 200;
const OUTPUT_DIR = path.join(__dirname, "../public/maps");

// ─── Tile atlas ──────────────────────────────────────────────────────────────
// Index 0 is always "..." (void / empty ground)
const ATLAS = [
  "...", // 0 – empty
  "cob", // 1 – cobblestone street
  "wal", // 2 – outer city wall (tall, grey)
  "bwl", // 3 – building wall (inner)
  "flr", // 4 – interior wooden floor
  "rof", // 5 – red tile roof (flat floor)
  "grs", // 6 – grass / park ground
  "stn", // 7 – stone path (plaza)
  "mkt", // 8 – market floor (ochre)
  "pil", // 9 – pillar / column
  "fnt", // 10 – fountain base (water)
  "tre", // 11 – tree trunk (blocking round)
  "dwl", // 12 – dark building wall variant
  "arc", // 13 – archway wall (gate)
  "sdw", // 14 – stone dark wall (watchtower)
];

// Gable roof tile symbols (added at indices 15-19).
// All have "roof" in their tile definition id → isRoofTile=true in the 3D runtime.
ATLAS.push(
  "rsn", // 15 – roof slope north (eave at north, high at south)
  "rss", // 16 – roof slope south (eave at south, high at north)
  "rse", // 17 – roof slope east  (eave at east,  high at west)
  "rsw", // 18 – roof slope west  (eave at west,  high at east)
  "rrd", // 19 – roof ridge cap   (flat at ridge height)
);

// ─── Tile definitions ─────────────────────────────────────────────────────────
const TILE_DEFS = {
  "...": { id: "void", color: "#6a9f36", height: 0.02, renderAs: "floor" },
  cob: { id: "cobblestone", color: "#64748b", height: 0.06, renderAs: "floor" },
  wal: {
    id: "city-wall",
    color: "#78716c",
    block: true,
    height: 4.0,
    renderAs: "block",
  },
  bwl: {
    id: "building-wall",
    color: "#94a3b8",
    block: true,
    height: 2.6,
    renderAs: "block",
  },
  flr: { id: "wood-floor", color: "#92400e", height: 0.08, renderAs: "floor" },
  rof: { id: "roof-tile", color: "#b91c1c", height: 0.12, renderAs: "floor" },
  rsn: { id: "roof-slope-n", color: "#c1440e", height: 0.8, block: false },
  rss: { id: "roof-slope-s", color: "#c1440e", height: 0.8, block: false },
  rse: { id: "roof-slope-e", color: "#c1440e", height: 0.8, block: false },
  rsw: { id: "roof-slope-w", color: "#c1440e", height: 0.8, block: false },
  rrd: { id: "roof-ridge", color: "#8c3008", height: 0.8, block: false },
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
    height: 3.0,
    renderAs: "block",
  },
  fnt: {
    id: "fountain",
    color: "#38bdf8",
    block: true,
    height: 0.8,
    renderAs: "block",
  },
  tre: {
    id: "tree",
    color: "#15803d",
    block: true,
    height: 3.2,
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
    height: 5.0,
    renderAs: "block",
  },
};

const IDX = {};
ATLAS.forEach((sym, i) => {
  IDX[sym] = i;
});

// ─── Grid helpers ─────────────────────────────────────────────────────────────
// ─── Gable roof helper ───────────────────────────────────────────────────────
// Fills a rectangle on `grid` with directional slope tiles so that the building
// gets a proper gable (cumeeira) roof:
//   – If the building is wider (W≥D): ridge runs E-W, north+south slope panels.
//   – If the building is deeper (D>W): ridge runs N-S, east+west slope panels.
//
// The slope tile at the eave row has its LOW edge at the eave and HIGH edge at
// the centre; the geometry worker (buildRoofSlopePanelVerts) uses ROOF_EAVE_H
// and ROOF_RIDGE_H constants — not the height field — so all panels are uniform.
function fillGableRoof(grid, x0, y0, x1, y1) {
  const w = x1 - x0 + 1; // tile count E-W
  const d = y1 - y0 + 1; // tile count N-S

  if (w >= d) {
    // E-W ridge: north half = rsn, south half = rss, centre (odd d) = rrd
    const halfD = Math.floor(d / 2);
    for (let dy = 0; dy < d; dy++) {
      const sym = dy < halfD ? "rsn" : dy > d - 1 - halfD ? "rss" : "rrd";
      for (let dx = 0; dx < w; dx++) {
        set(grid, x0 + dx, y0 + dy, sym);
      }
    }
  } else {
    // N-S ridge: west half = rsw, east half = rse, centre (odd w) = rrd
    const halfW = Math.floor(w / 2);
    for (let dx = 0; dx < w; dx++) {
      const sym = dx < halfW ? "rsw" : dx > w - 1 - halfW ? "rse" : "rrd";
      for (let dy = 0; dy < d; dy++) {
        set(grid, x0 + dx, y0 + dy, sym);
      }
    }
  }
}

function makeGrid(w, h, fill = 0) {
  return Array.from({ length: h }, () => new Uint8Array(w).fill(fill));
}

function set(grid, x, y, sym) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  grid[y][x] = IDX[sym];
}

function fill(grid, x0, y0, x1, y1, sym) {
  const idx = IDX[sym];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x >= 0 && y >= 0 && x < W && y < H) grid[y][x] = idx;
    }
  }
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

// ─── Seeded pseudo-random ─────────────────────────────────────────────────────
function makePRNG(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

// ─── Map generation ───────────────────────────────────────────────────────────
function generate() {
  const rng = makePRNG(42);
  const grid = makeGrid(W, H, IDX["cob"]); // cobblestone as default street
  // Collect all placed building footprints so we can build roofs on level 1.
  const allBuildingRects = [];

  // === 1. Outer border grass ===
  fill(grid, 0, 0, W - 1, H - 1, "cob");

  // === 2. Outer city wall (2 tiles thick) ===
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

  // Watchtower corners (5x5 sdw)
  const towers = [
    [2, 2],
    [W - 7, 2],
    [2, H - 7],
    [W - 7, H - 7],
  ];
  for (const [tx, ty] of towers) fill(grid, tx, ty, tx + 4, ty + 4, "sdw");

  // Gates (arch opening in wall): North, South, East, West
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

  // === 3. Main avenues (4 tiles wide) ===
  // Horizontal main road at y=mid, y=mid+50, y=mid-50
  // Vertical main road at x=mid, etc.
  const roads = [
    // Horizontal avenues
    { horiz: true, pos: 40, thick: 4 },
    { horiz: true, pos: 80, thick: 4 },
    { horiz: true, pos: 100, thick: 6 }, // main central
    { horiz: true, pos: 120, thick: 4 },
    { horiz: true, pos: 160, thick: 4 },
    // Vertical avenues
    { horiz: false, pos: 40, thick: 4 },
    { horiz: false, pos: 80, thick: 4 },
    { horiz: false, pos: 100, thick: 6 }, // main central
    { horiz: false, pos: 120, thick: 4 },
    { horiz: false, pos: 160, thick: 4 },
  ];

  for (const road of roads) {
    const half = Math.floor(road.thick / 2);
    if (road.horiz) {
      fill(grid, 2, road.pos - half, W - 3, road.pos + half, "cob");
    } else {
      fill(grid, road.pos - half, 2, road.pos + half, H - 3, "cob");
    }
  }

  // === 4. Helper: place a city block with buildings ===
  function placeBlock(bx, by, bw, bh) {
    if (bw < 6 || bh < 6) return;
    // Outer footpath (stone)
    fill(grid, bx, by, bx + bw - 1, by + bh - 1, "stn");

    const numHouses = 2 + Math.floor(rng() * 3); // 2-4 houses per block
    const placed = [];

    for (let h = 0; h < numHouses; h++) {
      const hw = 5 + Math.floor(rng() * 6); // 5-10 wide
      const hh = 5 + Math.floor(rng() * 6); // 5-10 deep
      const hx = bx + 1 + Math.floor(rng() * Math.max(1, bw - hw - 2));
      const hy = by + 1 + Math.floor(rng() * Math.max(1, bh - hh - 2));

      if (hx + hw > bx + bw - 1 || hy + hh > by + bh - 1) continue;
      // Avoid overlap with existing houses
      const overlap = placed.some(
        ([px, py, pw, ph]) =>
          hx < px + pw && hx + hw > px && hy < py + ph && hy + hh > py,
      );
      if (overlap) continue;

      placed.push([hx, hy, hw, hh]);

      // Choose wall style by random
      const wallStyle = rng() < 0.3 ? "dwl" : "bwl";
      const roofStyle = rng() < 0.4 ? "rof" : "flr";
      rect(grid, hx, hy, hx + hw - 1, hy + hh - 1, wallStyle, roofStyle);

      // Record footprint for level-1 roof generation
      allBuildingRects.push({
        x0: hx,
        y0: hy,
        x1: hx + hw - 1,
        y1: hy + hh - 1,
      });

      // Door (1 tile opening in wall)
      const doorSide = Math.floor(rng() * 4);
      if (doorSide === 0) set(grid, hx + Math.floor(hw / 2), hy, "flr");
      else if (doorSide === 1)
        set(grid, hx + Math.floor(hw / 2), hy + hh - 1, "flr");
      else if (doorSide === 2) set(grid, hx, hy + Math.floor(hh / 2), "flr");
      else set(grid, hx + hw - 1, hy + Math.floor(hh / 2), "flr");
    }
  }

  // === 5. Fill city blocks (between roads) ===
  // Collect street boundaries to define blocks
  const hRoads = [
    2,
    ...roads.filter((r) => r.horiz).map((r) => r.pos),
    H - 3,
  ].sort((a, b) => a - b);
  const vRoads = [
    2,
    ...roads.filter((r) => !r.horiz).map((r) => r.pos),
    W - 3,
  ].sort((a, b) => a - b);

  for (let bi = 0; bi < hRoads.length - 1; bi++) {
    for (let bj = 0; bj < vRoads.length - 1; bj++) {
      const bx = vRoads[bj] + 3;
      const by = hRoads[bi] + 3;
      const bw = vRoads[bj + 1] - 3 - bx;
      const bh = hRoads[bi + 1] - 3 - by;

      if (bw < 6 || bh < 6) continue;

      // Central area: special zones
      const isCentral =
        bj === Math.floor(vRoads.length / 2) - 1 &&
        bi === Math.floor(hRoads.length / 2) - 1;
      const isMarket = !isCentral && rng() < 0.15;
      const isPark = !isCentral && !isMarket && rng() < 0.15;

      if (isCentral) {
        // Central plaza with fountain and pillars
        fill(grid, bx, by, bx + bw - 1, by + bh - 1, "stn");
        const cx = bx + Math.floor(bw / 2);
        const cy = by + Math.floor(bh / 2);
        fill(grid, cx - 2, cy - 2, cx + 2, cy + 2, "fnt");
        // 4 corner pillars
        set(grid, bx + 2, by + 2, "pil");
        set(grid, bx + bw - 3, by + 2, "pil");
        set(grid, bx + 2, by + bh - 3, "pil");
        set(grid, bx + bw - 3, by + bh - 3, "pil");
      } else if (isMarket) {
        fill(grid, bx, by, bx + bw - 1, by + bh - 1, "mkt");
        // Market stalls (small bwl boxes)
        for (let ms = 0; ms < 4; ms++) {
          const sx = bx + 2 + Math.floor(rng() * Math.max(1, bw - 6));
          const sy = by + 2 + Math.floor(rng() * Math.max(1, bh - 4));
          fill(grid, sx, sy, sx + 2, sy + 1, "bwl");
        }
      } else if (isPark) {
        fill(grid, bx, by, bx + bw - 1, by + bh - 1, "grs");
        // Scatter trees
        for (let t = 0; t < 3 + Math.floor(rng() * 5); t++) {
          const tx = bx + 1 + Math.floor(rng() * (bw - 2));
          const ty = by + 1 + Math.floor(rng() * (bh - 2));
          set(grid, tx, ty, "tre");
        }
        // Small stone path through park
        const px = bx + Math.floor(bw / 2);
        fill(grid, px - 1, by, px + 1, by + bh - 1, "stn");
      } else {
        placeBlock(bx, by, bw, bh);
      }
    }
  }

  // === 6. Add trees along main roads ===
  for (let x = 10; x < W - 10; x += 8) {
    if (rng() < 0.6) set(grid, x, 97, "tre");
    if (rng() < 0.6) set(grid, x, 103, "tre");
  }
  for (let y = 10; y < H - 10; y += 8) {
    if (rng() < 0.6) set(grid, 97, y, "tre");
    if (rng() < 0.6) set(grid, 103, y, "tre");
  }

  return { grid, allBuildingRects };
}

// ─── Build and write output ───────────────────────────────────────────────────
function buildOutput() {
  const { grid, allBuildingRects } = generate();

  // Level 0
  const binData = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) binData[y * W + x] = grid[y][x];

  const binFile = MAP_NAME + "_0.bin";
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, binFile), binData);
  console.log("[generate-giant-3d-map] Written " + binFile);

  // Level 1 — void-sky default + gable rooftops (MAP_SYSTEM_CONTRACT upper-floors)
  const grid1 = makeGrid(W, H, IDX["..."]);
  for (const { x0, y0, x1, y1 } of allBuildingRects)
    fillGableRoof(grid1, x0, y0, x1, y1);

  const binData1 = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) binData1[y * W + x] = grid1[y][x];

  const binFile1 = MAP_NAME + "_1.bin";
  fs.writeFileSync(path.join(OUTPUT_DIR, binFile1), binData1);
  const roofCount = allBuildingRects.length;
  console.log(
    "[generate-giant-3d-map] Written " +
      binFile1 +
      " (" +
      roofCount +
      " gable rooftops)",
  );

  // Player spawn — first cobblestone tile found
  let playerX = 100 * 32,
    playerY = 100 * 32;
  outer: for (let y = 10; y < H - 10; y++) {
    for (let x = 10; x < W - 10; x++) {
      if (grid[y][x] === IDX["cob"]) {
        playerX = x * 32 + 16;
        playerY = y * 32 + 16;
        break outer;
      }
    }
  }

  const meta = {
    mapName: MAP_NAME,
    tileSize: 32,
    width: W,
    height: H,
    config: { startLevel: "0", mapName: "Giant City 3D" },
    tileAtlas: ATLAS,
    tileDefinitions: TILE_DEFS,
    entityTemplates: {
      gob: { type: "enemy", id: "goblin" },
      orc: { type: "enemy", id: "orc" },
      swd: { type: "item", id: "wooden_sword" },
    },
    levels: {
      0: {
        binFile,
        playerPos: { x: playerX, y: playerY },
        entities: Array.from({ length: 40 }, (_, i) => ({
          symbol: i % 3 === 0 ? "orc" : "gob",
          x: 10 + Math.floor((i * 131 + 37) % (W - 20)),
          y: 10 + Math.floor((i * 97 + 53) % (H - 20)),
        })),
      },
      1: { binFile: binFile1 },
    },
  };

  const jsonFile = MAP_NAME + ".json";
  fs.writeFileSync(
    path.join(OUTPUT_DIR, jsonFile),
    JSON.stringify(meta, null, 2),
  );
  console.log("[generate-giant-3d-map] Written " + jsonFile);
  console.log(
    "[generate-giant-3d-map] Player spawn: x=" + playerX + " y=" + playerY,
  );
  console.log(
    "[generate-giant-3d-map] Done. Open with ?slice3d=1&map=" +
      MAP_NAME +
      "&fp=1",
  );
}

buildOutput();
