/**
 * generate-world-v1-map.js
 * Gera o mapa mundo principal (city_3d_multi) — 256×256 tiles, 5 levels.
 *
 * Conforma WORLD_MAP_CONTRACT.md:
 *   - Ilha cercada por mar (20 tiles de wat nas bordas)
 *   - Biomas contíguos com transições graduais
 *   - Layers contextuais (modelo Tibia)
 *   - Regra do telhado: rof NO MESMO level das paredes
 *   - Escadas com corredor de abordagem (2 tiles livres em frente)
 *   - Entradas de caverna/dungeon conforme anatomia documentada
 *
 * Layout (256×256):
 *   Norte: Floresta + Pântano
 *   Centro: Campo → Cidade (spawn 128,128)
 *   Sul: Deserto (W) + Litoral (E)
 *   Bordas: Mar (20 tiles)
 *
 * Run: node scripts/generate-world-v1-map.js
 */

const fs = require("fs");
const path = require("path");

const MAP_NAME = "city_3d_multi";
const W = 256;
const H = 256;
const OUTPUT_DIR = path.join(__dirname, "../public/maps");

// ─── Tile Atlas (conforme §6 WORLD_MAP_CONTRACT) ──────────────────────────────
const ATLAS = [
  "...", //  0 void/sky — default para levels superiores
  "grs", //  1 grass
  "cob", //  2 cobblestone
  "stn", //  3 stone plaza
  "pav", //  4 pavement
  "snd", //  5 sand (praia / deserto)
  "mud", //  6 mud (pântano)
  "pat", //  7 path (trilha de terra)
  "flr", //  8 wood floor (interior)
  "sfl", //  9 sewer floor
  "cfl", // 10 cave floor
  "bal", // 11 balcony
  "wat", // 12 water (mar — blocking)
  "wtr", // 13 water shallow (pântano / poças)
  "wal", // 14 city wall (alto)
  "bwl", // 15 building wall
  "dwl", // 16 dungeon wall
  "swl", // 17 sewer wall
  "cwl", // 18 cave wall
  "sdw", // 19 stone dark wall (torre vigia)
  "rof", // 20 roof tile
  "arc", // 21 archway
  "pil", // 22 pillar
  "fnt", // 23 fountain
  "tre", // 24 tree
  "rok", // 25 rock/boulder
  "stu", // 26 stairs up
  "std", // 27 stairs down
  "hol", // 28 hole (queda automática)
  "dfn", // 29 dungeon floor (pedra fria)
];

const IDX = {};
ATLAS.forEach((sym, i) => {
  IDX[sym] = i;
});

const TILE_DEFS = {
  "...": { id: "void", color: "#7ec8e3", height: 0.02, renderAs: "floor" },
  grs: { id: "grass", color: "#4ade80", height: 0.05, renderAs: "floor" },
  cob: { id: "cobblestone", color: "#64748b", height: 0.06, renderAs: "floor" },
  stn: { id: "stone-plaza", color: "#9ca3af", height: 0.07, renderAs: "floor" },
  pav: { id: "pavement", color: "#6b7280", height: 0.06, renderAs: "floor" },
  snd: { id: "sand", color: "#fbbf24", height: 0.05, renderAs: "floor" },
  mud: { id: "mud", color: "#92400e", height: 0.05, renderAs: "floor" },
  pat: { id: "path", color: "#a16207", height: 0.04, renderAs: "floor" },
  flr: { id: "wood-floor", color: "#92400e", height: 0.08, renderAs: "floor" },
  sfl: { id: "sewer-floor", color: "#334155", height: 0.06, renderAs: "floor" },
  cfl: { id: "cave-floor", color: "#57534e", height: 0.07, renderAs: "floor" },
  bal: { id: "balcony", color: "#c4b5a0", height: 0.08, renderAs: "floor" },
  wat: {
    id: "water",
    color: "#1d4ed8",
    height: 0.12,
    renderAs: "block",
    block: true,
  },
  wtr: {
    id: "water-shallow",
    color: "#60a5fa",
    height: 0.04,
    renderAs: "floor",
  },
  wal: {
    id: "city-wall",
    color: "#78716c",
    height: 4.5,
    renderAs: "block",
    block: true,
  },
  bwl: {
    id: "building-wall",
    color: "#94a3b8",
    height: 2.8,
    renderAs: "block",
    block: true,
  },
  dwl: {
    id: "dungeon-wall",
    color: "#374151",
    height: 2.8,
    renderAs: "block",
    block: true,
  },
  swl: {
    id: "sewer-wall",
    color: "#1e293b",
    height: 2.5,
    renderAs: "block",
    block: true,
  },
  cwl: {
    id: "cave-wall",
    color: "#292524",
    height: 2.6,
    renderAs: "block",
    block: true,
  },
  sdw: {
    id: "stone-dark-wall",
    color: "#44403c",
    height: 5.2,
    renderAs: "block",
    block: true,
  },
  rof: { id: "roof-tile", color: "#c2622d", height: 0.45, renderAs: "floor" },
  arc: {
    id: "archway",
    color: "#a8a29e",
    height: 3.8,
    renderAs: "block",
    block: false,
  },
  pil: {
    id: "pillar",
    color: "#d1d5db",
    height: 3.2,
    renderAs: "block",
    block: true,
  },
  fnt: {
    id: "fountain",
    color: "#38bdf8",
    height: 0.9,
    renderAs: "block",
    block: false,
  },
  tre: {
    id: "tree",
    color: "#15803d",
    height: 3.4,
    renderAs: "block",
    block: true,
  },
  rok: {
    id: "rock",
    color: "#78716c",
    height: 1.2,
    renderAs: "block",
    block: true,
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
  hol: {
    id: "hole",
    color: "#111827",
    height: 0.02,
    renderAs: "floor",
    transition: "down",
  },
  dfn: {
    id: "dungeon-floor",
    color: "#1e293b",
    height: 0.06,
    renderAs: "floor",
  },
};

// ─── Grid helpers ─────────────────────────────────────────────────────────────
function makeGrid(fillSym) {
  const v = IDX[fillSym];
  return Array.from({ length: H }, () => new Uint8Array(W).fill(v));
}

function set(g, x, y, sym) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  g[y][x] = IDX[sym];
}

function fill(g, x0, y0, x1, y1, sym) {
  const v = IDX[sym];
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) g[y][x] = v;
}

function fillRow(g, y, x0, x1, sym) {
  fill(g, x0, y, x1, y, sym);
}
function fillCol(g, x, y0, y1, sym) {
  fill(g, x, y0, x, y1, sym);
}

// Border of a rectangle (wall only)
function border(g, x0, y0, x1, y1, sym) {
  fillRow(g, y0, x0, x1, sym);
  fillRow(g, y1, x0, x1, sym);
  fillCol(g, x0, y0, y1, sym);
  fillCol(g, x1, y0, y1, sym);
}

// Filled rectangle with optional wall+floor
function room(g, x0, y0, x1, y1, wallSym, floorSym) {
  fill(g, x0, y0, x1, y1, floorSym);
  border(g, x0, y0, x1, y1, wallSym);
}

function get(g, x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return IDX["..."];
  return g[y][x];
}

function sym(g, x, y) {
  return ATLAS[get(g, x, y)] ?? "...";
}

// Deterministic PRNG (xorshift32)
function makePRNG(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

// toBinaryBuffer: grid is array of Uint8Array rows
function toBin(grid) {
  const buf = Buffer.alloc(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) buf[y * W + x] = grid[y][x];
  return buf;
}

// ─── Biome zones (pixel bounds on 256×256) ────────────────────────────────────
// Sea border: 20 tiles on all sides → island = tiles 20..235
const SEA = 20;
const ISLAND_X0 = SEA,
  ISLAND_X1 = W - 1 - SEA;
const ISLAND_Y0 = SEA,
  ISLAND_Y1 = H - 1 - SEA;

// Rough biome boundaries (Y increases south)
// Norte (Y 20..90):  Floresta W(20..130), Pântano E(131..235)
// Meio  (Y 91..165): Campo + Cidade (centro 100..155 × 90..165)
// Sul   (Y 166..235): Deserto W(20..130), Litoral E(131..235)

const FOREST_Y0 = 20,
  FOREST_Y1 = 90;
const SWAMP_Y0 = 20,
  SWAMP_Y1 = 90;
const BIOME_EW = 130; // X divider between west/east biomes
const MID_Y0 = 91,
  MID_Y1 = 165;
const CITY_X0 = 100,
  CITY_X1 = 155,
  CITY_Y0 = 91,
  CITY_Y1 = 160;
const SOUTH_Y0 = 166,
  SOUTH_Y1 = 235;
const COAST_X0 = 131;

// ─── Level 0 (surface) ────────────────────────────────────────────────────────
function buildLevel0(rng) {
  const g = makeGrid("grs");

  // ── Sea + beach border ─────────────────────────────────────────────────────
  // Full map sea
  fill(g, 0, 0, W - 1, H - 1, "wat");
  // Island base (grass)
  fill(g, ISLAND_X0, ISLAND_Y0, ISLAND_X1, ISLAND_Y1, "grs");
  // Beach ring: 4 tiles of sand between island and sea
  for (let t = 0; t < 4; t++) {
    border(
      g,
      ISLAND_X0 + t,
      ISLAND_Y0 + t,
      ISLAND_X1 - t,
      ISLAND_Y1 - t,
      "snd",
    );
  }
  // Overwrite beach interior with grass (border only painted sand, not fill)
  fill(g, ISLAND_X0 + 4, ISLAND_Y0 + 4, ISLAND_X1 - 4, ISLAND_Y1 - 4, "grs");

  // ── Biome fills ────────────────────────────────────────────────────────────

  // Floresta (NW)
  fill(g, ISLAND_X0 + 4, FOREST_Y0 + 4, BIOME_EW, FOREST_Y1, "grs");

  // Pântano (NE)
  fill(g, BIOME_EW + 1, SWAMP_Y0 + 4, ISLAND_X1 - 4, SWAMP_Y1, "mud");
  // Poças de água no pântano
  for (let i = 0; i < 18; i++) {
    const px = Math.floor(BIOME_EW + 5 + rng() * (ISLAND_X1 - 14 - BIOME_EW));
    const py = Math.floor(SWAMP_Y0 + 5 + rng() * (SWAMP_Y1 - SWAMP_Y0 - 10));
    const pr = 1 + Math.floor(rng() * 2);
    fill(g, px - pr, py - pr, px + pr, py + pr, "wtr");
  }

  // Deserto (SW)
  fill(g, ISLAND_X0 + 4, SOUTH_Y0, BIOME_EW, SOUTH_Y1 - 4, "snd");

  // Litoral (SE) — areia fina perto da água
  fill(g, COAST_X0, SOUTH_Y0, ISLAND_X1 - 4, SOUTH_Y1 - 4, "snd");
  // Gradiente de água rasa para o mar sul
  fill(g, COAST_X0, SOUTH_Y1 - 6, ISLAND_X1 - 4, SOUTH_Y1 - 4, "wtr");

  // Bioma transitions (campo → biomas): gradual 6-tile pat strips
  // Floresta/Campo norte
  for (let ty = MID_Y0; ty < MID_Y0 + 6; ty++) {
    const alpha = (ty - MID_Y0) / 6;
    const xEnd = Math.floor(BIOME_EW - rng() * 4);
    if (alpha < 0.4) fillRow(g, ty, ISLAND_X0 + 4, xEnd, "pat");
  }
  // Deserto/Campo sul
  for (let ty = MID_Y1 - 5; ty <= MID_Y1; ty++) {
    const xEnd = Math.floor(BIOME_EW - rng() * 4);
    fillRow(g, ty, ISLAND_X0 + 4, xEnd, "pat");
  }
  // Pântano/Campo
  for (let ty = SWAMP_Y1 - 3; ty <= SWAMP_Y1 + 3; ty++) {
    fillRow(g, ty, BIOME_EW + 1, ISLAND_X1 - 4, "pat");
  }
  // Pântano/Floresta divider
  fillCol(g, BIOME_EW, FOREST_Y0 + 4, FOREST_Y1, "pat");

  // ── Floresta (NW): grama + oak_tree props (scatterFieldLife) — sem tile `tre`
  // (tile tre = bloco 3D alto; no slice 3D vira "paredes" verdes, não sprite)
  for (let ty = FOREST_Y0 + 5; ty <= FOREST_Y1 - 2; ty++) {
    for (let tx = ISLAND_X0 + 5; tx <= BIOME_EW - 2; tx++) {
      if (rng() < 0.04 && sym(g, tx, ty) === "grs") {
        set(g, tx, ty, "rok");
      }
    }
  }
  // Trilha diagonal NW→centro da floresta (pat)
  {
    const tx0 = ISLAND_X0 + 6,
      ty0 = FOREST_Y0 + 6;
    const tx1 = 100,
      ty1 = FOREST_Y1 - 5;
    const steps = 40;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = Math.round(tx0 + (tx1 - tx0) * t);
      const y = Math.round(ty0 + (ty1 - ty0) * t);
      for (let d = -1; d <= 1; d++) {
        set(g, x + d, y, "pat");
        set(g, x, y + d, "pat");
      }
    }
  }

  // ── Pântano: rochas e árvores mortas ──────────────────────────────────────
  for (let i = 0; i < 30; i++) {
    const px = Math.floor(BIOME_EW + 4 + rng() * (ISLAND_X1 - 8 - BIOME_EW));
    const py = Math.floor(SWAMP_Y0 + 5 + rng() * (SWAMP_Y1 - SWAMP_Y0 - 10));
    if (sym(g, px, py) === "mud") set(g, px, py, "rok");
  }

  // ── Deserto: rochas e dunas ────────────────────────────────────────────────
  for (let i = 0; i < 20; i++) {
    const px = Math.floor(ISLAND_X0 + 5 + rng() * (BIOME_EW - ISLAND_X0 - 10));
    const py = Math.floor(SOUTH_Y0 + 3 + rng() * (SOUTH_Y1 - SOUTH_Y0 - 8));
    if (sym(g, px, py) === "snd") set(g, px, py, "rok");
  }

  // ── Litoral: costão rochoso ────────────────────────────────────────────────
  for (let i = 0; i < 12; i++) {
    const px = Math.floor(COAST_X0 + 3 + rng() * (ISLAND_X1 - 6 - COAST_X0));
    const py = Math.floor(SOUTH_Y0 + 2 + rng() * (SOUTH_Y1 - SOUTH_Y0 - 8));
    set(g, px, py, "rok");
  }

  // ── Cidade (centro) ────────────────────────────────────────────────────────
  buildCity(g, rng);

  // ── Entrada de caverna (floresta, NW) ─────────────────────────────────────
  // Posição fixa: 70,55  (floresta, afastado das bordas)
  const caveX = 70,
    caveY = 55;
  buildCaveEntrance(g, caveX, caveY);

  // ── Entrada de dungeon (deserto, SW) ──────────────────────────────────────
  const dungX = 60,
    dungY = 190;
  buildDungeonEntrance(g, dungX, dungY);

  // ── Manhole de esgoto (cidade) ─────────────────────────────────────────────
  // Na rua ao norte do mercado
  set(g, 128, 107, "hol");

  return g;
}

// ─── Cidade (city block, center of island) ────────────────────────────────────
function buildCity(g, rng) {
  const cx = 128,
    cy = 128; // spawn center

  // Muralha da cidade
  border(g, CITY_X0, CITY_Y0, CITY_X1, CITY_Y1, "wal");

  // Avenidas principais (cobblestone) formando cruz
  fill(g, CITY_X0, cy - 2, CITY_X1, cy + 2, "cob"); // horizontal
  fill(g, cx - 2, CITY_Y0, cx + 2, CITY_Y1, "cob"); // vertical

  // Praça central (spawn livre no centro)
  fill(g, cx - 5, cy - 5, cx + 5, cy + 5, "stn");
  set(g, cx, cy, "stn");
  set(g, cx + 3, cy - 2, "fnt");

  // Portões passáveis (cob na muralha)
  for (let d = -1; d <= 1; d++) {
    set(g, cx + d, CITY_Y0, "cob");
    set(g, cx + d, CITY_Y1, "cob");
    set(g, CITY_X0, cy + d, "cob");
    set(g, CITY_X1, cy + d, "cob");
  }

  // Caminhos dos portões até a cruz de avenidas
  fill(g, cx - 1, CITY_Y0 + 1, cx + 1, cy - 6, "cob");
  fill(g, cx - 1, cy + 6, cx + 1, CITY_Y1 - 1, "cob");
  fill(g, CITY_X0 + 1, cy - 1, cx - 6, cy + 1, "cob");
  fill(g, cx + 6, cy - 1, CITY_X1 - 1, cy + 1, "cob");

  // Casas nos 4 quadrantes
  const houses = [
    // Quadrante NW
    { x: 104, y: 96, w: 7, h: 7, floors: 2 },
    { x: 114, y: 96, w: 5, h: 5, floors: 1 },
    { x: 104, y: 106, w: 5, h: 5, floors: 1 },
    // Quadrante NE
    { x: 133, y: 96, w: 7, h: 7, floors: 2 },
    { x: 143, y: 96, w: 5, h: 5, floors: 1 },
    // Quadrante SW
    { x: 104, y: 135, w: 7, h: 7, floors: 2 },
    { x: 114, y: 135, w: 5, h: 5, floors: 1 },
    // Quadrante SE
    { x: 133, y: 135, w: 7, h: 7, floors: 2 },
    { x: 143, y: 135, w: 5, h: 5, floors: 1 },
    // Torre central NE
    { x: 148, y: 93, w: 5, h: 5, floors: 3, isTower: true },
  ];

  return houses; // returned for use in upper levels
}

// NOTE: buildCity only places ground-level tiles for now.
// Upper floors are handled separately in buildLevel1/2.
// Houses are referenced by their footprint coordinates directly in those functions.

// ─── Cave entrance (level 0) ───────────────────────────────────────────────────
function buildCaveEntrance(g, cx, cy) {
  // Rocky frame around the hole
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++)
      if (
        sym(g, cx + dx, cy + dy) !== "..." &&
        sym(g, cx + dx, cy + dy) !== "wat"
      )
        set(g, cx + dx, cy + dy, "rok");
  // Cave mouth — open north approach
  set(g, cx - 1, cy, "cwl");
  set(g, cx + 1, cy, "cwl");
  set(g, cx - 1, cy - 1, "rok");
  set(g, cx + 1, cy - 1, "rok");
  fill(g, cx - 1, cy - 2, cx + 1, cy - 1, "pat");
  // std on approach (walk north to descend)
  set(g, cx, cy - 1, "std");
}

// ─── Dungeon entrance (level 0) ───────────────────────────────────────────────
function buildDungeonEntrance(g, cx, cy) {
  // Approach: clear sand
  fill(g, cx - 3, cy - 3, cx + 3, cy + 3, "snd");
  // Flanking pillars (passable sides)
  set(g, cx - 2, cy - 1, "pil");
  set(g, cx + 2, cy - 1, "pil");
  // Arch opening (passable cob, not blocking arc)
  fill(g, cx - 1, cy - 2, cx + 1, cy - 1, "cob");
  // Short side walls — leave center open for descent
  set(g, cx - 2, cy, "dwl");
  set(g, cx + 2, cy, "dwl");
  // std on approach tile (2 tiles north of anchor — walk north to descend)
  set(g, cx, cy - 1, "std");
}

// ─── Level 1 (upper floors — 2nd floor of houses + tower) ────────────────────
function buildLevel1() {
  const g = makeGrid("...");

  // Houses 2-floor: same footprint as city houses
  const twoFloorHouses = [
    { x: 104, y: 96, w: 7, h: 7 },
    { x: 133, y: 96, w: 7, h: 7 },
    { x: 104, y: 135, w: 7, h: 7 },
    { x: 133, y: 135, w: 7, h: 7 },
  ];

  for (const h of twoFloorHouses) {
    const x1 = h.x + h.w - 1,
      y1 = h.y + h.h - 1;
    // Walls same XZ as ground floor
    border(g, h.x, h.y, x1, y1, "bwl");
    fill(g, h.x + 1, h.y + 1, x1 - 1, y1 - 1, "flr");
    // std at same position as stu in level 0 (inside, 1 from south wall, center X)
    const stairX = h.x + Math.floor(h.w / 2);
    const stairY = y1 - 2;
    set(g, stairX, stairY, "std");
    // Upper structure is represented by regular tiles in level 2.
    // Keep the stair marker for transitions after the roof paint pass.
    set(g, stairX, stairY, "std");
  }

  // Tower (3 floors): level 1 = 2nd floor, no roof yet
  {
    const tx = 148,
      ty = 93,
      tw = 5,
      th = 5;
    const tx1 = tx + tw - 1,
      ty1 = ty + th - 1;
    border(g, tx, ty, tx1, ty1, "bwl");
    fill(g, tx + 1, ty + 1, tx1 - 1, ty1 - 1, "flr");
    // std (same pos as stu in level 0)
    set(g, tx + 2, ty1 - 1, "std");
    // stu to level 2
    set(g, tx + 2, ty + 1, "stu");
  }

  // 1-floor houses: thin cap over the full building footprint at this level.
  // rof (height=0.15, renderAs=floor) sits flush on top of the level-0 walls.
  const oneFloorHouses = [
    { x: 114, y: 96, w: 5, h: 5 },
    { x: 104, y: 106, w: 5, h: 5 },
    { x: 143, y: 96, w: 5, h: 5 },
    { x: 114, y: 135, w: 5, h: 5 },
    { x: 143, y: 135, w: 5, h: 5 },
  ];

  for (const h of oneFloorHouses) {
    const x1 = h.x + h.w - 1,
      y1 = h.y + h.h - 1;
    // Cover walls AND interior (full footprint) with flat cap tile.
    fill(g, h.x, h.y, x1, y1, "rof");
  }

  return g;
}

// ─── Level 2 (top floor / rooftops) ──────────────────────────────────────────
function buildLevel2() {
  const g = makeGrid("...");

  // Tower top floor (no roof marked here)
  {
    const tx = 148,
      ty = 93,
      tw = 5,
      th = 5;
    const tx1 = tx + tw - 1,
      ty1 = ty + th - 1;
    border(g, tx, ty, tx1, ty1, "bwl");
    fill(g, tx + 1, ty + 1, tx1 - 1, ty1 - 1, "flr");
    set(g, tx + 2, ty1 - 1, "std"); // std same pos as stu from level 1
    // stu to level 3 (tower roof)
    set(g, tx + 2, ty + 1, "stu");
  }

  // 2-floor houses: thin cap over the full building footprint at this level.
  const twoFloorHouses = [
    { x: 104, y: 96, w: 7, h: 7 },
    { x: 133, y: 96, w: 7, h: 7 },
    { x: 104, y: 135, w: 7, h: 7 },
    { x: 133, y: 135, w: 7, h: 7 },
  ];

  for (const h of twoFloorHouses) {
    const x1 = h.x + h.w - 1,
      y1 = h.y + h.h - 1;
    fill(g, h.x, h.y, x1, y1, "rof");
  }

  return g;
}

// ─── Level 3 (tower roof) ────────────────────────────────────────────────────
function buildLevel3() {
  const g = makeGrid("...");

  // Tower: thin cap over full tower footprint.
  {
    const tx = 148,
      ty = 93,
      tw = 5,
      th = 5;
    const tx1 = tx + tw - 1,
      ty1 = ty + th - 1;
    fill(g, tx, ty, tx1, ty1, "rof");
  }

  return g;
}

// ─── Level -1 (underground: cave + dungeon + sewer) ──────────────────────────
function buildLevelMinus1(rng) {
  const g = makeGrid("cwl"); // default = cave wall

  // ── Cave interior (below floresta NW) ──────────────────────────────────────
  // Center roughly below caveEntrance std at 70,54
  const caveCX = 70,
    caveCY = 54;
  // Main room
  room(g, caveCX - 8, caveCY - 8, caveCX + 8, caveCY + 8, "cwl", "cfl");
  // stu back up (same X/Z as std on level 0)
  set(g, caveCX, caveCY, "stu");
  // Corridor going east
  fill(g, caveCX + 9, caveCY - 1, caveCX + 20, caveCY + 1, "cfl");
  // Side room
  room(g, caveCX + 18, caveCY - 5, caveCX + 28, caveCY + 5, "cwl", "cfl");
  // Poças
  set(g, caveCX - 4, caveCY - 4, "wtr");
  set(g, caveCX + 3, caveCY + 3, "wtr");
  set(g, caveCX + 22, caveCY, "wtr");
  // Passagem para -2
  set(g, caveCX + 23, caveCY - 3, "std");

  // ── Dungeon interior (below deserto SW, std at 60,189) ─────────────────────
  const dCX = 60,
    dCY = 189;
  // stu back up
  set(g, dCX, dCY, "stu");
  // Entry corridor going north
  fill(g, dCX - 1, dCY - 12, dCX + 1, dCY - 1, "dfn");
  // Large dungeon room
  room(g, dCX - 10, dCY - 25, dCX + 10, dCY - 13, "dwl", "dfn");
  // Guard rooms branching E/W
  room(g, dCX - 22, dCY - 22, dCX - 12, dCY - 16, "dwl", "dfn");
  fill(g, dCX - 12, dCY - 20, dCX - 11, dCY - 18, "dfn"); // corridor connection
  room(g, dCX + 12, dCY - 22, dCX + 22, dCY - 16, "dwl", "dfn");
  fill(g, dCX + 11, dCY - 20, dCX + 12, dCY - 18, "dfn");
  // Deeper stair
  set(g, dCX, dCY - 14, "std");

  // ── Sewer tunnels (below cidade, horizontal corridors) ────────────────────
  // Main E-W tunnel at Y=107 (below manhole at 128,107)
  fill(g, 103, 105, 153, 109, "sfl");
  border(g, 103, 105, 153, 109, "swl");
  fill(g, 104, 106, 152, 108, "sfl");
  // stu back up at manhole position
  set(g, 128, 107, "stu");
  // Cross tunnel N-S
  fill(g, 126, 93, 130, 105, "sfl");
  border(g, 126, 93, 130, 105, "swl");
  fill(g, 127, 94, 129, 104, "sfl");
  // Sewer rooms
  room(g, 104, 100, 112, 108, "swl", "sfl");
  room(g, 144, 100, 152, 108, "swl", "sfl");

  // ── Extra dungeon wings (procedural grid east of main dungeon) ────────────
  for (let wing = 0; wing < 4; wing += 1) {
    const wx = 78 + wing * 14;
    const wy = 168 - wing * 6;
    room(g, wx - 5, wy - 5, wx + 5, wy + 5, "dwl", "dfn");
    fill(g, wx - 1, wy + 6, wx + 1, wy + 8, "dfn");
    if (wing === 0) {
      fill(g, 70, wy + 7, wx - 2, wy + 8, "dfn");
    }
  }

  // ── Caverna extra sul da floresta ─────────────────────────────────────────
  room(g, 48, 72, 62, 86, "cwl", "cfl");
  set(g, 55, 86, "std");
  fill(g, 54, 87, 56, 90, "cfl");
  room(g, 50, 91, 60, 100, "cwl", "cfl");

  // ── Scattered rocks (underground atmosphere) ──────────────────────────────
  for (let i = 0; i < 40; i++) {
    const rx = Math.floor(rng() * W);
    const ry = Math.floor(rng() * H);
    if (ATLAS[g[ry][rx]] === "cwl") {
      /* wall stays */
    }
  }

  return g;
}

// ─── Level -2 (deep underground) ─────────────────────────────────────────────
function buildLevelMinus2(rng) {
  const g = makeGrid("dwl"); // default = dungeon wall

  // Deep cave (below cave -1 side room)
  const dCX2 = 93,
    dCY2 = 55; // approx below std in level -1
  room(g, dCX2 - 10, dCY2 - 10, dCX2 + 10, dCY2 + 10, "cwl", "cfl");
  set(g, dCX2, dCY2 - 3, "stu"); // stu to level -1

  // Deep dungeon (below dungeon -1)
  const dDX = 60,
    dDY = 190;
  set(g, dDX, dDY - 14, "stu"); // stu back to level -1
  room(g, dDX - 12, dDY - 30, dDX + 12, dDY - 16, "dwl", "dfn");
  fill(g, dDX - 1, dDY - 16, dDX + 1, dDY - 15, "dfn"); // corridor connector
  // Boss chamber
  room(g, dDX - 8, dDY - 42, dDX + 8, dDY - 32, "dwl", "dfn");
  fill(g, dDX - 1, dDY - 32, dDX + 1, dDY - 31, "dfn");

  return g;
}

// ─── Place stu tiles on level 0 (for city houses and tower) ──────────────────
// Called after buildLevel0 to inject stu into the ground floor.
function injectStairsLevel0(g) {
  const twoFloorHouses = [
    { x: 104, y: 96, w: 7, h: 7 },
    { x: 133, y: 96, w: 7, h: 7 },
    { x: 104, y: 135, w: 7, h: 7 },
    { x: 133, y: 135, w: 7, h: 7 },
  ];

  for (const h of twoFloorHouses) {
    const x1 = h.x + h.w - 1,
      y1 = h.y + h.h - 1;
    const stairX = h.x + Math.floor(h.w / 2);
    const stairY = y1 - 2;
    // Place walls + floor for house (build house on level 0)
    border(g, h.x, h.y, x1, y1, "bwl");
    fill(g, h.x + 1, h.y + 1, x1 - 1, y1 - 1, "flr");
    // Door (south wall center tile → cob)
    set(g, stairX, y1, "cob");
    // Stair up (inside, 1 tile from south wall, center X)
    set(g, stairX, stairY, "stu");
  }

  // Tower (3 floors)
  {
    const tx = 148,
      ty = 93,
      tw = 5,
      th = 5;
    const tx1 = tx + tw - 1,
      ty1 = ty + th - 1;
    border(g, tx, ty, tx1, ty1, "bwl");
    fill(g, tx + 1, ty + 1, tx1 - 1, ty1 - 1, "flr");
    set(g, tx + 2, ty1, "cob"); // door
    set(g, tx + 2, ty1 - 1, "stu"); // stairs up (2 tiles from south wall)
  }

  // 1-floor houses (walls + floor only, no stairs)
  const oneFloorHouses = [
    { x: 114, y: 96, w: 5, h: 5 },
    { x: 104, y: 106, w: 5, h: 5 },
    { x: 143, y: 96, w: 5, h: 5 },
    { x: 114, y: 135, w: 5, h: 5 },
    { x: 143, y: 135, w: 5, h: 5 },
  ];

  for (const h of oneFloorHouses) {
    const x1 = h.x + h.w - 1,
      y1 = h.y + h.h - 1;
    border(g, h.x, h.y, x1, y1, "bwl");
    fill(g, h.x + 1, h.y + 1, x1 - 1, y1 - 1, "flr");
    // Door
    set(g, h.x + Math.floor(h.w / 2), y1, "cob");
    // Upper structure is represented by regular tiles in level 1.
  }
}

// ─── Entities (spawn table) ───────────────────────────────────────────────────
const ENTITY_TEMPLATES = {
  gob: { type: "enemy", id: "goblin" },
  gla: { type: "enemy", id: "goblin_lanceiro" },
  orc: { type: "enemy", id: "orc" },
  rat: { type: "enemy", id: "rat" },
  skl: { type: "enemy", id: "skeleton" },
  pr00: { type: "decoration", id: "oak_tree", isCollidable: true },
  pr01: { type: "decoration", id: "wild_flower", isCollidable: false },
};

const CAMPO_MINI_BURROWS = [
  { x: 92, y: 118 },
  { x: 168, y: 112 },
  { x: 86, y: 152 },
  { x: 175, y: 148 },
];

function isTooClose(positions, x, y, minDist) {
  const minDistSq = minDist * minDist;
  return positions.some((p) => {
    const dx = p.x - x;
    const dy = p.y - y;
    return dx * dx + dy * dy < minDistSq;
  });
}

function isInsideCity(x, y, padding = 0) {
  return (
    x >= CITY_X0 - padding &&
    x <= CITY_X1 + padding &&
    y >= CITY_Y0 - padding &&
    y <= CITY_Y1 + padding
  );
}

/** PixelLab oak trees + wild flowers on open grass (campo, trilhas, floresta). */
function scatterFieldLife(surface, rng, outEntities) {
  const treePositions = [];
  const flowerPositions = [];
  const walkable = new Set(["grs", "pat"]);
  const MAX_TREES = 150;
  const MAX_FLOWERS = 200;
  let treeCount = 0;
  let flowerCount = 0;

  const tryTree = (x, y) => {
    if (treeCount >= MAX_TREES) {
      return false;
    }
    if (isTooClose(treePositions, x, y, 3)) {
      return false;
    }
    treePositions.push({ x, y });
    outEntities.push({ symbol: "pr00", x, y });
    treeCount += 1;
    return true;
  };

  const tryFlower = (x, y) => {
    if (flowerCount >= MAX_FLOWERS) {
      return false;
    }
    if (isTooClose(flowerPositions, x, y, 2)) {
      return false;
    }
    if (isTooClose(treePositions, x, y, 1)) {
      return false;
    }
    flowerPositions.push({ x, y });
    outEntities.push({ symbol: "pr01", x, y });
    flowerCount += 1;
    return true;
  };

  // Floresta NW — densidade maior de carvalhos sprite
  for (let y = FOREST_Y0 + 5; y <= FOREST_Y1 - 2; y += 1) {
    for (let x = ISLAND_X0 + 5; x <= BIOME_EW - 2; x += 1) {
      if (sym(surface, x, y) !== "grs") {
        continue;
      }
      if (rng() < 0.19) {
        tryTree(x, y);
      } else if (rng() < 0.05) {
        tryFlower(x, y);
      }
    }
  }

  for (let y = ISLAND_Y0 + 8; y <= ISLAND_Y1 - 8; y += 1) {
    for (let x = ISLAND_X0 + 8; x <= ISLAND_X1 - 8; x += 1) {
      if (isInsideCity(x, y, 4)) {
        continue;
      }
      if (y >= FOREST_Y0 + 5 && y <= FOREST_Y1 - 2 && x <= BIOME_EW - 2) {
        continue;
      }
      const tile = sym(surface, x, y);
      if (!walkable.has(tile)) {
        continue;
      }

      if (rng() < 0.028) {
        tryFlower(x, y);
      }

      const inOpenCampo =
        y >= MID_Y0 && y <= MID_Y1 && (x < CITY_X0 - 6 || x > CITY_X1 + 6);
      const treeChance = inOpenCampo ? 0.014 : 0.006;

      if (rng() < treeChance) {
        tryTree(x, y);
      }
    }
  }
}

/** Small hole + underground room for quick critter hunts in the campo. */
function buildMiniBurrow(surface, underground, cx, cy, rng, entitiesByLevel) {
  const walkable = new Set(["grs", "pat"]);
  if (!walkable.has(sym(surface, cx, cy))) {
    return false;
  }

  set(surface, cx, cy, "hol");
  set(surface, cx - 1, cy, "rok");
  set(surface, cx + 1, cy, "rok");
  set(surface, cx, cy - 1, "rok");

  room(underground, cx - 4, cy - 4, cx + 4, cy + 4, "dwl", "dfn");
  set(underground, cx, cy, "stu");

  const enemyPool = ["rat", "rat", "gob", "skl"];
  const count = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i += 1) {
    const ex = cx - 3 + Math.floor(rng() * 7);
    const ey = cy - 3 + Math.floor(rng() * 7);
    if (sym(underground, ex, ey) === "dfn") {
      entitiesByLevel["-1"].push({
        symbol: enemyPool[Math.floor(rng() * enemyPool.length)],
        x: ex,
        y: ey,
      });
    }
  }

  for (let i = 0; i < 2; i += 1) {
    const sx = cx + (rng() < 0.5 ? -2 : 2);
    const sy = cy + (rng() < 0.5 ? -1 : 1);
    if (walkable.has(sym(surface, sx, sy))) {
      entitiesByLevel["0"].push({
        symbol: rng() < 0.7 ? "rat" : "gob",
        x: sx,
        y: sy,
      });
    }
  }

  return true;
}

function scatterWorldEnemies(surface, rng) {
  const out = [];
  const positions = [];
  const pickEnemy = (tile) => {
    const pools = {
      grs: ["rat", "gob", "gob", "orc", "skl"],
      pat: ["rat", "gob", "gla", "skl"],
      snd: ["orc", "gob", "rat", "gob"],
      mud: ["rat", "rat", "gob", "rat"],
    };
    const pool = pools[tile] || pools.grs;
    return pool[Math.floor(rng() * pool.length)];
  };

  for (let y = ISLAND_Y0 + 8; y <= ISLAND_Y1 - 8; y += 1) {
    for (let x = ISLAND_X0 + 8; x <= ISLAND_X1 - 8; x += 1) {
      if (isInsideCity(x, y, 3)) {
        continue;
      }
      const tile = sym(surface, x, y);
      if (tile !== "grs" && tile !== "pat" && tile !== "snd" && tile !== "mud") {
        continue;
      }

      let chance = 0.012;
      if (y >= FOREST_Y0 && y <= FOREST_Y1 && x <= BIOME_EW) {
        chance = 0.022;
      } else if (y >= SWAMP_Y0 && x > BIOME_EW) {
        chance = 0.018;
      } else if (y >= SOUTH_Y0 && x <= BIOME_EW) {
        chance = 0.016;
      } else if (x >= COAST_X0) {
        chance = 0.014;
      }

      if (rng() > chance) {
        continue;
      }
      if (isTooClose(positions, x, y, 5)) {
        continue;
      }
      positions.push({ x, y });
      out.push({ symbol: pickEnemy(tile), x, y });
    }
  }
  return out;
}

function scatterUndergroundHoles(surface, underground, deep, rng, entities) {
  const walkable = new Set(["grs", "pat", "snd", "mud"]);
  const placed = [];
  const targetCount = 12;
  let attempts = 0;
  const enemyPool = ["rat", "rat", "gob", "skl", "orc"];

  while (placed.length < targetCount && attempts < targetCount * 60) {
    attempts += 1;
    const x = Math.floor(
      ISLAND_X0 + 14 + rng() * (ISLAND_X1 - ISLAND_X0 - 28),
    );
    const y = Math.floor(
      ISLAND_Y0 + 14 + rng() * (ISLAND_Y1 - ISLAND_Y0 - 28),
    );
    if (isInsideCity(x, y, 10)) {
      continue;
    }
    if (!walkable.has(sym(surface, x, y))) {
      continue;
    }
    if (isTooClose(placed, x, y, 14)) {
      continue;
    }
    if (isTooClose(CAMPO_MINI_BURROWS, x, y, 8)) {
      continue;
    }

    const size = 4 + Math.floor(rng() * 4);
    room(underground, x - size, y - size, x + size, y + size, "dwl", "dfn");
    set(surface, x, y, "hol");
    set(underground, x, y, "stu");

    const mobCount = 2 + Math.floor(rng() * 4);
    for (let i = 0; i < mobCount; i += 1) {
      const ex = x - size + 1 + Math.floor(rng() * (size * 2 - 1));
      const ey = y - size + 1 + Math.floor(rng() * (size * 2 - 1));
      if (sym(underground, ex, ey) === "dfn") {
        entities["-1"].push({
          symbol: enemyPool[Math.floor(rng() * enemyPool.length)],
          x: ex,
          y: ey,
        });
      }
    }

    if (rng() < 0.45) {
      const sx = x + Math.floor(rng() * 3) - 1;
      const sy = y - size + 1;
      set(underground, sx, sy, "std");
      room(deep, sx - 6, sy - 10, sx + 6, sy - 2, "dwl", "dfn");
      set(deep, sx, sy, "stu");
      for (let i = 0; i < 2 + Math.floor(rng() * 2); i += 1) {
        const ex = sx - 4 + Math.floor(rng() * 9);
        const ey = sy - 8 + Math.floor(rng() * 6);
        if (sym(deep, ex, ey) === "dfn") {
          entities["-2"].push({
            symbol: enemyPool[Math.floor(rng() * enemyPool.length)],
            x: ex,
            y: ey,
          });
        }
      }
    }

    placed.push({ x, y });
  }

  return placed.length;
}

function mergeEntities(base, extra) {
  const merged = { ...base };
  for (const [level, list] of Object.entries(extra)) {
    merged[level] = [...(merged[level] ?? []), ...list];
  }
  return merged;
}

function buildEntities() {
  return {
    "-2": [
      { symbol: "orc", x: 60, y: 175 },
      { symbol: "orc", x: 50, y: 170 },
    ],
    "-1": [
      { symbol: "rat", x: 72, y: 54 },
      { symbol: "rat", x: 78, y: 58 },
      { symbol: "skl", x: 68, y: 56 },
      { symbol: "gob", x: 62, y: 187 },
      { symbol: "orc", x: 55, y: 177 },
      { symbol: "rat", x: 128, y: 107 },
      { symbol: "skl", x: 108, y: 104 },
      { symbol: "rat", x: 148, y: 104 },
    ],
    0: [
      { symbol: "gob", x: 115, y: 92 },
      { symbol: "gla", x: 119, y: 92 },
      { symbol: "orc", x: 140, y: 92 },
      { symbol: "gob", x: 110, y: 140 },
      { symbol: "orc", x: 140, y: 140 },
      // Floresta
      { symbol: "gob", x: 65, y: 50 },
      { symbol: "gob", x: 75, y: 65 },
      { symbol: "rat", x: 58, y: 72 },
      { symbol: "skl", x: 82, y: 48 },
      // Deserto
      { symbol: "orc", x: 60, y: 200 },
      { symbol: "gob", x: 50, y: 210 },
      { symbol: "rat", x: 72, y: 205 },
      // Pântano
      { symbol: "rat", x: 190, y: 55 },
      { symbol: "gob", x: 205, y: 68 },
    ],
    1: [],
    2: [],
  };
}

// ─── Write files ───────────────────────────────────────────────────────────────
function writeMap(levels, extraEntities = {}) {
  const entities = mergeEntities(buildEntities(), extraEntities);

  const mapJson = {
    mapName: MAP_NAME,
    tileSize: 32,
    width: W,
    height: H,
    config: {
      startLevel: "0",
      mapName: "World v1 — Ilha Principal",
      smokeTests: [{ id: "spawn-point", type: "spawn", level: "0" }],
    },
    tileAtlas: ATLAS,
    tileDefinitions: TILE_DEFS,
    entityTemplates: ENTITY_TEMPLATES,
    levels: Object.fromEntries(
      Object.keys(levels).map((lv) => [
        lv,
        {
          binFile: `${MAP_NAME}_${lv}.bin`,
          playerPos: lv === "0" ? { x: 128 * 32, y: 128 * 32 } : { x: 0, y: 0 },
          entities: entities[lv] ?? [],
        },
      ]),
    ),
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${MAP_NAME}.json`),
    JSON.stringify(mapJson, null, 2),
  );
  console.log(`[world-v1] Wrote ${MAP_NAME}.json`);

  for (const [lv, grid] of Object.entries(levels)) {
    const outPath = path.join(OUTPUT_DIR, `${MAP_NAME}_${lv}.bin`);
    fs.writeFileSync(outPath, toBin(grid));
    console.log(`[world-v1] Wrote ${MAP_NAME}_${lv}.bin  (${W}×${H})`);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    throw new Error(`Maps directory not found: ${OUTPUT_DIR}`);
  }

  const rng = makePRNG(0x5e4d1a2b);

  const l0 = buildLevel0(rng);
  injectStairsLevel0(l0); // house walls + stairs on top of biome tiles
  const l1 = buildLevel1();
  const l2 = buildLevel2();
  const l3 = buildLevel3();
  const lm1 = buildLevelMinus1(rng);
  const lm2 = buildLevelMinus2(rng);

  const extraEntities = {
    0: [],
    "-1": [],
    "-2": [],
  };

  scatterFieldLife(l0, rng, extraEntities["0"]);
  extraEntities["0"].push(...scatterWorldEnemies(l0, rng));

  let burrowsPlaced = 0;
  for (const burrow of CAMPO_MINI_BURROWS) {
    if (
      buildMiniBurrow(l0, lm1, burrow.x, burrow.y, rng, extraEntities)
    ) {
      burrowsPlaced += 1;
    }
  }

  const randomHoles = scatterUndergroundHoles(
    l0,
    lm1,
    lm2,
    rng,
    extraEntities,
  );

  writeMap({ "-2": lm2, "-1": lm1, 0: l0, 1: l1, 2: l2, 3: l3 }, extraEntities);

  console.log(
    `\n[world-v1] Done. Spawn: tile 128,128 (world coords ${128 * 32},${128 * 32})`,
  );
  console.log(
    `[world-v1] Field props: ${extraEntities["0"].filter((e) => e.symbol?.startsWith("pr")).length}, mini-burrows: ${burrowsPlaced}, random-holes: ${randomHoles}`,
  );
  console.log(
    `[world-v1] Surface enemies: ${extraEntities["0"].filter((e) => !e.symbol?.startsWith("pr")).length}, underground: ${(extraEntities["-1"]?.length ?? 0) + (extraEntities["-2"]?.length ?? 0)}`,
  );
  console.log("[world-v1] Validation: npm run check:bms");
}

main();
