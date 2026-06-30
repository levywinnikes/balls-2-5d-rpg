/**
 * generate-world-p1-macro-map.js
 *
 * Traduz o blueprint P1 (macrozonas) em um mapa gerado 512x512 para validacao
 * da fase macro do mundi, sem substituir o city_3d_multi atual.
 *
 * Run:
 *   node scripts/generate-world-p1-macro-map.js
 */

const fs = require("fs");
const path = require("path");

const BLUEPRINT_PATH = path.join(
  __dirname,
  "../docs/MAP_MUNDI_3D_P1_BLUEPRINT_512.json",
);
const OUTPUT_DIR = path.join(__dirname, "../public/maps");
const MAP_NAME = "city_3d_mundi_p1_before";

const ATLAS = [
  "...",
  "grs",
  "cob",
  "stn",
  "pav",
  "snd",
  "mud",
  "pat",
  "flr",
  "sfl",
  "cfl",
  "bal",
  "wat",
  "wtr",
  "wal",
  "bwl",
  "dwl",
  "swl",
  "cwl",
  "sdw",
  "rof",
  "arc",
  "pil",
  "fnt",
  "tre",
  "rok",
  "stu",
  "std",
  "hol",
  "dfn",
];

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
  wat: { id: "water", color: "#1d4ed8", height: 0.12, renderAs: "block", block: true },
  wtr: { id: "water-shallow", color: "#60a5fa", height: 0.04, renderAs: "floor" },
  wal: { id: "city-wall", color: "#78716c", height: 4.5, renderAs: "block", block: true },
  bwl: { id: "building-wall", color: "#94a3b8", height: 2.8, renderAs: "block", block: true },
  dwl: { id: "dungeon-wall", color: "#374151", height: 2.8, renderAs: "block", block: true },
  swl: { id: "sewer-wall", color: "#1e293b", height: 2.5, renderAs: "block", block: true },
  cwl: { id: "cave-wall", color: "#292524", height: 2.6, renderAs: "block", block: true },
  sdw: { id: "stone-dark-wall", color: "#44403c", height: 5.2, renderAs: "block", block: true },
  rof: { id: "roof-tile", color: "#c2622d", height: 0.45, renderAs: "floor" },
  arc: { id: "archway", color: "#a8a29e", height: 3.8, renderAs: "block", block: true },
  pil: { id: "pillar", color: "#d1d5db", height: 3.2, renderAs: "block", block: true },
  fnt: { id: "fountain", color: "#38bdf8", height: 0.9, renderAs: "block", block: true },
  tre: { id: "tree", color: "#15803d", height: 3.4, renderAs: "block", block: true },
  rok: { id: "rock", color: "#78716c", height: 1.2, renderAs: "block", block: true },
  stu: { id: "stairs-up", color: "#e2c87d", height: 0.12, renderAs: "floor", stairDir: "up" },
  std: { id: "stairs-down", color: "#a07040", height: 0.12, renderAs: "floor", stairDir: "down" },
  hol: { id: "hole", color: "#111827", height: 0.02, renderAs: "floor", transition: "down" },
  dfn: { id: "dungeon-floor", color: "#1e293b", height: 0.06, renderAs: "floor" },
};

const IDX = {};
ATLAS.forEach((sym, index) => {
  IDX[sym] = index;
});

function makePRNG(seed) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

function buildGrid(width, height, fillSym) {
  const value = IDX[fillSym];
  return Array.from({ length: height }, () => new Uint8Array(width).fill(value));
}

function set(grid, width, height, x, y, sym) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  grid[y][x] = IDX[sym];
}

function fill(grid, width, height, x0, y0, x1, y1, sym) {
  const value = IDX[sym];
  const minX = Math.max(0, x0);
  const maxX = Math.min(width - 1, x1);
  const minY = Math.max(0, y0);
  const maxY = Math.min(height - 1, y1);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      grid[y][x] = value;
    }
  }
}

function border(grid, width, height, x0, y0, x1, y1, sym) {
  fill(grid, width, height, x0, y0, x1, y0, sym);
  fill(grid, width, height, x0, y1, x1, y1, sym);
  fill(grid, width, height, x0, y0, x0, y1, sym);
  fill(grid, width, height, x1, y0, x1, y1, sym);
}

function room(grid, width, height, x0, y0, x1, y1, wallSym, floorSym) {
  fill(grid, width, height, x0, y0, x1, y1, floorSym);
  border(grid, width, height, x0, y0, x1, y1, wallSym);
}

function paintRoute(grid, width, height, from, to, sym) {
  let x = from.x;
  let y = from.y;
  while (x !== to.x) {
    set(grid, width, height, x, y, sym);
    x += x < to.x ? 1 : -1;
    set(grid, width, height, x, y, sym);
  }
  while (y !== to.y) {
    set(grid, width, height, x, y, sym);
    y += y < to.y ? 1 : -1;
    set(grid, width, height, x, y, sym);
  }
}

function symbolAt(grid, x, y) {
  return ATLAS[grid[y][x]] || "...";
}

function softenTransitions(grid, width, height, pairA, pairB, replacement, passes = 1) {
  for (let pass = 0; pass < passes; pass += 1) {
    const patches = [];
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const s = symbolAt(grid, x, y);
        if (s !== pairA && s !== pairB) continue;
        const n1 = symbolAt(grid, x + 1, y);
        const n2 = symbolAt(grid, x - 1, y);
        const n3 = symbolAt(grid, x, y + 1);
        const n4 = symbolAt(grid, x, y - 1);
        const hasA = n1 === pairA || n2 === pairA || n3 === pairA || n4 === pairA;
        const hasB = n1 === pairB || n2 === pairB || n3 === pairB || n4 === pairB;
        if (hasA && hasB) patches.push([x, y]);
      }
    }
    for (const [x, y] of patches) {
      grid[y][x] = IDX[replacement];
    }
  }
}

function toBin(grid, width, height) {
  const buffer = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      buffer[y * width + x] = grid[y][x];
    }
  }
  return buffer;
}

function centerOf(bbox) {
  return {
    x: Math.floor((bbox.x0 + bbox.x1) / 2),
    y: Math.floor((bbox.y0 + bbox.y1) / 2),
  };
}

function findZoneByName(zones, token) {
  const t = token.toLowerCase();
  return zones.find((z) => {
    const id = String(z.id || "").toLowerCase();
    const name = String(z.name || "").toLowerCase();
    return id.includes(t) || name.includes(t);
  });
}

function buildLevel0(blueprint) {
  const width = blueprint.mapSize.width;
  const height = blueprint.mapSize.height;
  const sea = blueprint.globalRules.seaBorderMinTiles;
  const zones = blueprint.macrozones;
  const rng = makePRNG(0x4f31bcdd);

  const grid = buildGrid(width, height, "wat");
  fill(grid, width, height, sea, sea, width - sea - 1, height - sea - 1, "grs");

  for (let t = 0; t < 4; t += 1) {
    border(
      grid,
      width,
      height,
      sea + t,
      sea + t,
      width - sea - 1 - t,
      height - sea - 1 - t,
      "snd",
    );
  }

  for (const zone of zones) {
    const [corePrimary, coreSecondary] = zone.biomeCore;
    fill(
      grid,
      width,
      height,
      zone.bbox.x0,
      zone.bbox.y0,
      zone.bbox.x1,
      zone.bbox.y1,
      corePrimary || "grs",
    );

    // Apply a few compact blobs instead of pixel-noise to reduce biome fragmentation.
    if (coreSecondary && coreSecondary !== corePrimary) {
      for (let i = 0; i < 10; i += 1) {
        const cx = zone.bbox.x0 + Math.floor(rng() * (zone.bbox.x1 - zone.bbox.x0 + 1));
        const cy = zone.bbox.y0 + Math.floor(rng() * (zone.bbox.y1 - zone.bbox.y0 + 1));
        const rx = 3 + Math.floor(rng() * 7);
        const ry = 3 + Math.floor(rng() * 7);
        fill(grid, width, height, cx - rx, cy - ry, cx + rx, cy + ry, coreSecondary);
      }
    }
  }

  // Targeted smoothing: avoid abrupt mud<->sand contact lines.
  softenTransitions(grid, width, height, "mud", "snd", "pat", 2);

  const urban = zones.find((z) => String(z.id).includes("URBAN"));
  if (urban) {
    const c = centerOf(urban.bbox);
    fill(grid, width, height, c.x - 8, c.y - 8, c.x + 8, c.y + 8, "stn");
    set(grid, width, height, c.x, c.y, "fnt");
    fill(grid, width, height, urban.bbox.x0, c.y - 2, urban.bbox.x1, c.y + 2, "cob");
    fill(grid, width, height, c.x - 2, urban.bbox.y0, c.x + 2, urban.bbox.y1, "cob");
  }

  const routeAliases = {
    capital_norte: "Z2-NORTH-URBAN",
    planicie_cardinal: "Z4-CENTRAL-PLAINS",
    costa_rubra: "Z7-SOUTH-COAST",
    marisma_verde: "Z3-NE-SWAMP",
    dunas_ember: "Z6-SE-DESERT",
    floresta_umbra: "Z1-NW-FOREST",
    serra_ferrugem: "Z5-WEST-HIGHLANDS",
    porto_quebrado: "Z7-SOUTH-COAST",
    arco_urbano: "Z2-NORTH-URBAN",
    passagem_fenda_oeste: "Z5-WEST-HIGHLANDS",
    necropole_areia: "Z6-SE-DESERT",
    gruta_marinha: "Z7-SOUTH-COAST",
    ruina_afundada: "Z3-NE-SWAMP",
  };

  const allRoutes = [
    ...(blueprint.progressionRoutes.main || []),
    ...(blueprint.progressionRoutes.secondary || []),
    ...(blueprint.progressionRoutes.lateGameShortcuts || []),
  ];

  for (const route of allRoutes) {
    const segments = String(route)
      .split("->")
      .map((s) => s.trim())
      .filter(Boolean);

    for (let i = 0; i < segments.length - 1; i += 1) {
      const fromAlias = routeAliases[segments[i]];
      const toAlias = routeAliases[segments[i + 1]];
      if (!fromAlias || !toAlias) continue;
      const fromZone = zones.find((z) => z.id === fromAlias);
      const toZone = zones.find((z) => z.id === toAlias);
      if (!fromZone || !toZone) continue;
      paintRoute(
        grid,
        width,
        height,
        centerOf(fromZone.bbox),
        centerOf(toZone.bbox),
        "pat",
      );
    }
  }

  for (const zone of zones) {
    if (String(zone.id).includes("SWAMP")) {
      for (let i = 0; i < 260; i += 1) {
        const x = zone.bbox.x0 + Math.floor(rng() * (zone.bbox.x1 - zone.bbox.x0 + 1));
        const y = zone.bbox.y0 + Math.floor(rng() * (zone.bbox.y1 - zone.bbox.y0 + 1));
        set(grid, width, height, x, y, "wtr");
      }
    }
    if (String(zone.id).includes("FOREST")) {
      for (let i = 0; i < 90; i += 1) {
        const cx = zone.bbox.x0 + Math.floor(rng() * (zone.bbox.x1 - zone.bbox.x0 + 1));
        const cy = zone.bbox.y0 + Math.floor(rng() * (zone.bbox.y1 - zone.bbox.y0 + 1));
        const r = 1 + Math.floor(rng() * 2);
        for (let y = cy - r; y <= cy + r; y += 1) {
          for (let x = cx - r; x <= cx + r; x += 1) {
            if (x < zone.bbox.x0 || y < zone.bbox.y0 || x > zone.bbox.x1 || y > zone.bbox.y1) continue;
            if (rng() < 0.5) set(grid, width, height, x, y, "tre");
          }
        }
      }
    }
    if (String(zone.id).includes("DESERT") || String(zone.id).includes("HIGHLANDS")) {
      for (let i = 0; i < 360; i += 1) {
        const x = zone.bbox.x0 + Math.floor(rng() * (zone.bbox.x1 - zone.bbox.x0 + 1));
        const y = zone.bbox.y0 + Math.floor(rng() * (zone.bbox.y1 - zone.bbox.y0 + 1));
        if (rng() < 0.45) set(grid, width, height, x, y, "rok");
      }
    }
  }

  return grid;
}

function buildUpperVoid(width, height) {
  return buildGrid(width, height, "...");
}

function buildUnderground(width, height, wallSym) {
  return buildGrid(width, height, wallSym);
}

function buildPoiAnchors(blueprint) {
  const zones = blueprint.macrozones;
  const urban = findZoneByName(zones, "urban") || zones[0];
  const forest = findZoneByName(zones, "forest") || zones[0];
  const swamp = findZoneByName(zones, "swamp") || zones[0];
  const desert = findZoneByName(zones, "desert") || zones[0];
  const coast = findZoneByName(zones, "coast") || zones[0];
  const high = findZoneByName(zones, "highlands") || zones[0];
  return {
    urban: centerOf(urban.bbox),
    forest: centerOf(forest.bbox),
    swamp: centerOf(swamp.bbox),
    desert: centerOf(desert.bbox),
    coast: centerOf(coast.bbox),
    high: centerOf(high.bbox),
  };
}

function addP1Structures(levels, blueprint) {
  const l0 = levels["0"];
  const l1 = levels["1"];
  const l2 = levels["2"];
  const l3 = levels["3"];
  const lm1 = levels["-1"];
  const lm2 = levels["-2"];
  const width = blueprint.mapSize.width;
  const height = blueprint.mapSize.height;

  const p = buildPoiAnchors(blueprint);

  // Urban core: wall, plaza, houses and one 3-floor tower.
  {
    const cx = p.urban.x;
    const cy = p.urban.y;
    border(l0, width, height, cx - 30, cy - 24, cx + 30, cy + 24, "wal");
    fill(l0, width, height, cx - 10, cy - 10, cx + 10, cy + 10, "stn");
    set(l0, width, height, cx, cy, "fnt");
    fill(l0, width, height, cx - 30, cy - 1, cx + 30, cy + 1, "cob");
    fill(l0, width, height, cx - 1, cy - 24, cx + 1, cy + 24, "cob");
    set(l0, width, height, cx, cy - 24, "arc");
    set(l0, width, height, cx, cy + 24, "arc");
    set(l0, width, height, cx - 30, cy, "arc");
    set(l0, width, height, cx + 30, cy, "arc");

    const houses = [
      { x: cx - 18, y: cy - 16, w: 7, h: 7, floors: 2 },
      { x: cx + 12, y: cy - 16, w: 7, h: 7, floors: 2 },
      { x: cx - 18, y: cy + 9, w: 7, h: 7, floors: 1 },
      { x: cx + 12, y: cy + 9, w: 7, h: 7, floors: 1 },
    ];
    for (const h of houses) {
      const x1 = h.x + h.w - 1;
      const y1 = h.y + h.h - 1;
      border(l0, width, height, h.x, h.y, x1, y1, "bwl");
      fill(l0, width, height, h.x + 1, h.y + 1, x1 - 1, y1 - 1, "flr");
      const sx = h.x + Math.floor(h.w / 2);
      const sy = y1 - 2;
      set(l0, width, height, sx, y1, "cob");
      if (h.floors > 1) {
        set(l0, width, height, sx, sy, "stu");
        border(l1, width, height, h.x, h.y, x1, y1, "bwl");
        fill(l1, width, height, h.x + 1, h.y + 1, x1 - 1, y1 - 1, "flr");
        set(l1, width, height, sx, sy, "std");
        fill(l2, width, height, h.x, h.y, x1, y1, "rof");
      } else {
        fill(l1, width, height, h.x, h.y, x1, y1, "rof");
      }
    }

    const tx = cx + 20;
    const ty = cy - 2;
    const tx1 = tx + 5;
    const ty1 = ty + 5;
    border(l0, width, height, tx, ty, tx1, ty1, "bwl");
    fill(l0, width, height, tx + 1, ty + 1, tx1 - 1, ty1 - 1, "flr");
    set(l0, width, height, tx + 2, ty1, "cob");
    set(l0, width, height, tx + 2, ty1 - 1, "stu");
    border(l1, width, height, tx, ty, tx1, ty1, "bwl");
    fill(l1, width, height, tx + 1, ty + 1, tx1 - 1, ty1 - 1, "flr");
    set(l1, width, height, tx + 2, ty + 1, "stu");
    set(l1, width, height, tx + 2, ty1 - 1, "std");
    border(l2, width, height, tx, ty, tx1, ty1, "bwl");
    fill(l2, width, height, tx + 1, ty + 1, tx1 - 1, ty1 - 1, "flr");
    set(l2, width, height, tx + 2, ty + 1, "std");
    fill(l3, width, height, tx, ty, tx1, ty1, "rof");
  }

  // Forest: natural cave entry and connected underground cave.
  {
    const x = p.forest.x;
    const y = p.forest.y;
    fill(l0, width, height, x - 2, y - 2, x + 2, y + 2, "rok");
    set(l0, width, height, x, y, "std");
    room(lm1, width, height, x - 10, y - 8, x + 10, y + 8, "cwl", "cfl");
    set(lm1, width, height, x, y, "stu");
    fill(lm1, width, height, x + 11, y - 1, x + 20, y + 1, "cfl");
    room(lm1, width, height, x + 20, y - 5, x + 30, y + 5, "cwl", "cfl");
    set(lm1, width, height, x + 26, y, "std");
    room(lm2, width, height, x + 18, y - 10, x + 34, y + 10, "cwl", "cfl");
    set(lm2, width, height, x + 26, y, "stu");
  }

  // Swamp: ruined stone circle and hidden drop.
  {
    const x = p.swamp.x;
    const y = p.swamp.y;
    border(l0, width, height, x - 8, y - 6, x + 8, y + 6, "dwl");
    fill(l0, width, height, x - 7, y - 5, x + 7, y + 5, "mud");
    set(l0, width, height, x, y, "hol");
    room(lm1, width, height, x - 9, y - 7, x + 9, y + 7, "swl", "sfl");
    set(lm1, width, height, x, y, "stu");
  }

  // Desert: necropolis entrance and deep dungeon chain.
  {
    const x = p.desert.x;
    const y = p.desert.y;
    border(l0, width, height, x - 9, y - 9, x + 9, y + 9, "dwl");
    set(l0, width, height, x - 2, y - 2, "pil");
    set(l0, width, height, x + 2, y - 2, "pil");
    set(l0, width, height, x, y - 2, "arc");
    set(l0, width, height, x, y, "std");
    room(lm1, width, height, x - 14, y - 12, x + 14, y + 12, "dwl", "dfn");
    set(lm1, width, height, x, y, "stu");
    set(lm1, width, height, x, y - 8, "std");
    room(lm2, width, height, x - 10, y - 20, x + 10, y - 4, "dwl", "dfn");
    set(lm2, width, height, x, y - 8, "stu");
  }

  // Coast: port district and pier.
  {
    const x = p.coast.x;
    const y = p.coast.y;
    fill(l0, width, height, x - 14, y - 6, x + 8, y + 6, "pav");
    room(l0, width, height, x - 12, y - 5, x - 2, y + 3, "bwl", "flr");
    set(l0, width, height, x - 7, y + 3, "cob");
    for (let i = 0; i < 18; i += 1) {
      set(l0, width, height, x + i, y, "bal");
      if (i % 4 === 0) set(l0, width, height, x + i, y - 1, "pil");
    }
  }

  // Highlands outpost with watch walls.
  {
    const x = p.high.x;
    const y = p.high.y;
    border(l0, width, height, x - 10, y - 8, x + 10, y + 8, "wal");
    fill(l0, width, height, x - 9, y - 7, x + 9, y + 7, "grs");
    room(l0, width, height, x - 4, y - 3, x + 4, y + 3, "bwl", "flr");
    set(l0, width, height, x, y + 3, "cob");
  }

  // Secondary POIs: increase density without changing macro biome layout.
  {
    const cx = p.urban.x;
    const cy = p.urban.y;
    const urbanBlocks = [
      { x0: cx - 46, y0: cy - 12, x1: cx - 38, y1: cy - 4, floors: 1 },
      { x0: cx + 36, y0: cy - 12, x1: cx + 44, y1: cy - 4, floors: 1 },
      { x0: cx - 46, y0: cy + 4, x1: cx - 38, y1: cy + 12, floors: 2 },
      { x0: cx + 36, y0: cy + 4, x1: cx + 44, y1: cy + 12, floors: 2 },
    ];
    for (const b of urbanBlocks) {
      room(l0, width, height, b.x0, b.y0, b.x1, b.y1, "bwl", "flr");
      const sx = Math.floor((b.x0 + b.x1) / 2);
      set(l0, width, height, sx, b.y1, "cob");
      if (b.floors === 2) {
        set(l0, width, height, sx, b.y1 - 2, "stu");
        room(l1, width, height, b.x0, b.y0, b.x1, b.y1, "bwl", "flr");
        set(l1, width, height, sx, b.y1 - 2, "std");
        fill(l2, width, height, b.x0, b.y0, b.x1, b.y1, "rof");
      } else {
        fill(l1, width, height, b.x0, b.y0, b.x1, b.y1, "rof");
      }
    }
  }

  {
    const x = p.forest.x - 18;
    const y = p.forest.y + 14;
    room(l0, width, height, x - 4, y - 4, x + 4, y + 4, "bwl", "flr");
    set(l0, width, height, x, y + 4, "pat");
    set(l0, width, height, x, y + 2, "stu");
    room(l1, width, height, x - 4, y - 4, x + 4, y + 4, "bwl", "flr");
    set(l1, width, height, x, y + 2, "std");
    fill(l2, width, height, x - 4, y - 4, x + 4, y + 4, "rof");
    fill(l0, width, height, x + 8, y - 1, x + 16, y + 1, "pat");
  }

  {
    const x = p.swamp.x + 14;
    const y = p.swamp.y - 10;
    fill(l0, width, height, x - 8, y, x + 8, y, "bal");
    fill(l0, width, height, x, y - 6, x, y + 6, "bal");
    room(l0, width, height, x - 4, y - 4, x + 2, y + 2, "swl", "sfl");
    set(l0, width, height, x - 1, y + 2, "bal");
    set(l0, width, height, x + 4, y - 4, "hol");
    room(lm1, width, height, x - 6, y - 8, x + 8, y + 6, "swl", "sfl");
    set(lm1, width, height, x + 4, y - 4, "stu");
  }

  {
    const x = p.desert.x + 22;
    const y = p.desert.y + 16;
    room(l0, width, height, x - 8, y - 6, x + 8, y + 6, "dwl", "dfn");
    set(l0, width, height, x, y + 6, "snd");
    set(l0, width, height, x, y + 2, "std");
    room(lm1, width, height, x - 10, y - 8, x + 10, y + 8, "dwl", "dfn");
    set(lm1, width, height, x, y + 2, "stu");
    fill(l0, width, height, x - 22, y - 2, x - 14, y + 2, "wtr");
    set(l0, width, height, x - 18, y - 4, "pil");
    set(l0, width, height, x - 16, y + 4, "pil");
  }

  {
    const x = p.coast.x + 24;
    const y = p.coast.y - 10;
    room(l0, width, height, x - 2, y - 2, x + 2, y + 2, "bwl", "flr");
    set(l0, width, height, x, y + 2, "bal");
    set(l0, width, height, x, y + 1, "stu");
    room(l1, width, height, x - 2, y - 2, x + 2, y + 2, "bwl", "flr");
    set(l1, width, height, x, y + 1, "std");
    set(l1, width, height, x, y - 1, "stu");
    room(l2, width, height, x - 2, y - 2, x + 2, y + 2, "bwl", "flr");
    set(l2, width, height, x, y - 1, "std");
    fill(l3, width, height, x - 2, y - 2, x + 2, y + 2, "rof");
    fill(l0, width, height, x - 14, y + 10, x + 8, y + 12, "pav");
  }

  {
    const x = p.high.x + 14;
    const y = p.high.y - 10;
    room(l0, width, height, x - 3, y - 3, x + 3, y + 3, "sdw", "flr");
    set(l0, width, height, x, y + 3, "pat");
    set(l0, width, height, x, y + 1, "stu");
    room(l1, width, height, x - 3, y - 3, x + 3, y + 3, "sdw", "flr");
    set(l1, width, height, x, y + 1, "std");
    fill(l2, width, height, x - 3, y - 3, x + 3, y + 3, "rof");

    const bx = p.high.x - 12;
    const by = p.high.y + 10;
    set(l0, width, height, bx, by, "std");
    room(lm1, width, height, bx - 7, by - 5, bx + 7, by + 5, "cwl", "cfl");
    set(lm1, width, height, bx, by, "stu");
  }

  return p;
}

function buildEntitiesFromAnchors(a) {
  return {
    "-2": [
      { symbol: "orc", x: a.desert.x, y: a.desert.y - 14 },
      { symbol: "orc", x: a.desert.x + 4, y: a.desert.y - 12 },
    ],
    "-1": [
      { symbol: "rat", x: a.forest.x + 7, y: a.forest.y + 1 },
      { symbol: "rat", x: a.forest.x + 22, y: a.forest.y },
      { symbol: "rat", x: a.forest.x - 19, y: a.forest.y + 15 },
      { symbol: "gob", x: a.swamp.x + 3, y: a.swamp.y + 2 },
      { symbol: "gob", x: a.swamp.x + 16, y: a.swamp.y - 8 },
      { symbol: "orc", x: a.desert.x - 6, y: a.desert.y - 2 },
      { symbol: "orc", x: a.desert.x + 22, y: a.desert.y + 15 },
      { symbol: "rat", x: a.high.x - 11, y: a.high.y + 9 },
    ],
    "0": [
      { symbol: "gob", x: a.urban.x - 12, y: a.urban.y - 13 },
      { symbol: "gla", x: a.urban.x + 16, y: a.urban.y - 13 },
      { symbol: "orc", x: a.urban.x + 22, y: a.urban.y + 2 },
      { symbol: "gob", x: a.urban.x - 42, y: a.urban.y - 8 },
      { symbol: "gla", x: a.urban.x + 40, y: a.urban.y + 8 },
      { symbol: "gob", x: a.forest.x - 10, y: a.forest.y - 8 },
      { symbol: "rat", x: a.forest.x - 17, y: a.forest.y + 14 },
      { symbol: "rat", x: a.swamp.x + 4, y: a.swamp.y - 4 },
      { symbol: "gob", x: a.swamp.x + 14, y: a.swamp.y - 10 },
      { symbol: "orc", x: a.desert.x - 9, y: a.desert.y + 8 },
      { symbol: "orc", x: a.desert.x + 24, y: a.desert.y + 16 },
      { symbol: "gob", x: a.coast.x - 6, y: a.coast.y - 3 },
      { symbol: "gla", x: a.coast.x + 24, y: a.coast.y - 10 },
      { symbol: "gla", x: a.high.x + 6, y: a.high.y - 1 },
      { symbol: "orc", x: a.high.x + 14, y: a.high.y - 10 },
    ],
    "1": [
      { symbol: "gob", x: a.urban.x - 15, y: a.urban.y - 14 },
      { symbol: "gob", x: a.urban.x + 14, y: a.urban.y - 14 },
      { symbol: "gla", x: a.coast.x + 24, y: a.coast.y - 10 },
      { symbol: "gob", x: a.high.x + 14, y: a.high.y - 10 },
    ],
    "2": [
      { symbol: "orc", x: a.urban.x + 23, y: a.urban.y + 1 },
      { symbol: "orc", x: a.coast.x + 24, y: a.coast.y - 11 },
    ],
    "3": [],
  };
}

function writeMap(levels, blueprint, entities) {
  const width = blueprint.mapSize.width;
  const height = blueprint.mapSize.height;

  const urbanZone = blueprint.macrozones.find((z) => String(z.id).includes("URBAN"));
  const spawn = urbanZone ? centerOf(urbanZone.bbox) : { x: Math.floor(width / 2), y: Math.floor(height / 2) };

  const mapJson = {
    mapName: MAP_NAME,
    tileSize: 32,
    width,
    height,
    config: {
      startLevel: "0",
      mapName: "World P1 Macro 512x512",
      smokeTests: [{ id: "spawn-point", type: "spawn", level: "0" }],
    },
    tileAtlas: ATLAS,
    tileDefinitions: TILE_DEFS,
    entityTemplates: {
      gob: { type: "enemy", id: "goblin" },
      gla: { type: "enemy", id: "goblin_lanceiro" },
      orc: { type: "enemy", id: "orc" },
      rat: { type: "enemy", id: "rat" },
    },
    levels: Object.fromEntries(
      Object.keys(levels).map((lv) => [
        lv,
        {
          binFile: `${MAP_NAME}_${lv}.bin`,
          playerPos: lv === "0" ? { x: spawn.x * 32, y: spawn.y * 32 } : { x: 0, y: 0 },
          entities: entities[lv] || [],
        },
      ]),
    ),
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, `${MAP_NAME}.json`), JSON.stringify(mapJson, null, 2));
  console.log(`[world-p1] Wrote ${MAP_NAME}.json`);

  for (const [level, grid] of Object.entries(levels)) {
    fs.writeFileSync(path.join(OUTPUT_DIR, `${MAP_NAME}_${level}.bin`), toBin(grid, width, height));
    console.log(`[world-p1] Wrote ${MAP_NAME}_${level}.bin (${width}x${height})`);
  }
}

function main() {
  if (!fs.existsSync(BLUEPRINT_PATH)) {
    throw new Error(`Blueprint not found: ${BLUEPRINT_PATH}`);
  }
  if (!fs.existsSync(OUTPUT_DIR)) {
    throw new Error(`Maps directory not found: ${OUTPUT_DIR}`);
  }

  const blueprint = JSON.parse(fs.readFileSync(BLUEPRINT_PATH, "utf8"));
  const width = blueprint.mapSize.width;
  const height = blueprint.mapSize.height;

  const l0 = buildLevel0(blueprint);
  const l1 = buildUpperVoid(width, height);
  const l2 = buildUpperVoid(width, height);
  const l3 = buildUpperVoid(width, height);
  const lm1 = buildUnderground(width, height, "cwl");
  const lm2 = buildUnderground(width, height, "dwl");

  const levels = { "-2": lm2, "-1": lm1, 0: l0, 1: l1, 2: l2, 3: l3 };
  const anchors = addP1Structures(levels, blueprint);
  const entities = buildEntitiesFromAnchors(anchors);

  writeMap(levels, blueprint, entities);

  console.log("[world-p1] Done. Next: npm run check:bms && npm run check:world-mundi");
}

main();
