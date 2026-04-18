const fs = require("fs");
const path = require("path");

const ROOT_DIR = process.cwd();
const MAP_NAME = "smoke_test";
const MAP_PATH = path.join(ROOT_DIR, "public", "maps", `${MAP_NAME}.json`);

function main() {
  if (!fs.existsSync(MAP_PATH)) {
    throw new Error(`Map file not found: ${path.relative(ROOT_DIR, MAP_PATH)}`);
  }

  const mapData = JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
  const atlas = mapData.tileAtlas;
  const width = mapData.width;
  const height = mapData.height;

  const indexOf = (symbol) => atlas.indexOf(symbol);

  /**
   * Build a ground-level floor: grass everywhere, walls on border, then overrides.
   * Used for level 0 and basement (levels that have actual terrain the player walks on).
   */
  function buildGroundLevel(overrides) {
    const buffer = Buffer.alloc(width * height, indexOf("grs"));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
          buffer[y * width + x] = indexOf("wal");
        }
      }
    }

    overrides.forEach(([symbol, x, y]) => {
      buffer[y * width + x] = indexOf(symbol);
    });

    return buffer;
  }

  /**
   * Build an upper/sky level: everything is "..." (void/sky) by default.
   * Only the explicitly listed tiles are solid — these represent a building's
   * walls or roof on that floor. This is the correct 3D structure:
   * upper floors are open sky except where a structure occupies them.
   */
  function buildSkyLevel(overrides) {
    const buffer = Buffer.alloc(width * height, indexOf("..."));

    overrides.forEach(([symbol, x, y]) => {
      buffer[y * width + x] = indexOf(symbol);
    });

    return buffer;
  }

  // ---------------------------------------------------------------------------
  // HOUSE footprint — 4x4 interior at (14,10)→(17,13), walls on the perimeter.
  // Level 0 = ground floor walls + floor inside + stair up at (15,11) inside house.
  // Level 1 = same perimeter walls + red-roof filling the interior (no floor tile,
  //           roof is flat from above). Everything else = "...".
  // ---------------------------------------------------------------------------
  //
  // House layout (cols 13–18, rows 9–14):
  //   W W W W W W
  //   W . . . . W
  //   W . S . . W    S = stair_up to level 1 (visible from ground)
  //   W . . . . W
  //   W . . . . W
  //   W W W W W W
  //
  // Tower layout (cols 20–22, rows 10–12) — visible on level 1+2 as upper floors.

  const HOUSE_WALLS = [
    // Top row
    ["wal", 13, 9],
    ["wal", 14, 9],
    ["wal", 15, 9],
    ["wal", 16, 9],
    ["wal", 17, 9],
    ["wal", 18, 9],
    // Left col
    ["wal", 13, 10],
    ["wal", 13, 11],
    ["wal", 13, 12],
    ["wal", 13, 13],
    // Right col
    ["wal", 18, 10],
    ["wal", 18, 11],
    ["wal", 18, 12],
    ["wal", 18, 13],
    // Bottom row
    ["wal", 13, 14],
    ["wal", 14, 14],
    ["wal", 15, 14],
    ["wal", 16, 14],
    ["wal", 17, 14],
    ["wal", 18, 14],
  ];

  const HOUSE_FLOOR_INTERIOR = [
    ["flr", 14, 10],
    ["flr", 15, 10],
    ["flr", 16, 10],
    ["flr", 17, 10],
    ["flr", 14, 11],
    ["flr", 16, 11],
    ["flr", 17, 11],
    ["flr", 14, 12],
    ["flr", 15, 12],
    ["flr", 16, 12],
    ["flr", 17, 12],
    ["flr", 14, 13],
    ["flr", 15, 13],
    ["flr", 16, 13],
    ["flr", 17, 13],
  ];

  const HOUSE_ROOF = [
    ["rof", 14, 10],
    ["rof", 15, 10],
    ["rof", 16, 10],
    ["rof", 17, 10],
    ["rof", 14, 11],
    ["rof", 15, 11],
    ["rof", 16, 11],
    ["rof", 17, 11],
    ["rof", 14, 12],
    ["rof", 15, 12],
    ["rof", 16, 12],
    ["rof", 17, 12],
    ["rof", 14, 13],
    ["rof", 15, 13],
    ["rof", 16, 13],
    ["rof", 17, 13],
  ];

  const TOWER_WALLS = [
    ["wal", 20, 10],
    ["wal", 21, 10],
    ["wal", 22, 10],
    ["wal", 20, 11],
    ["wal", 22, 11],
    ["wal", 20, 12],
    ["wal", 21, 12],
    ["wal", 22, 12],
  ];

  const TOWER_ROOF = [["rof", 21, 11]];

  // Level 0 — ground floor. Player spawns here.
  // Has the house walls + wooden floor inside + stair_up at (15,11) inside the house.
  // Plus the original stair_down and hole for basement access.
  const level0 = buildGroundLevel([
    ["sdn", 8, 8], // stair down to basement
    ["hol", 9, 8], // hole
    ["sup", 6, 6], // stair up (to level 1, outside the house — for benchmark step)
    ...HOUSE_WALLS,
    ...HOUSE_FLOOR_INTERIOR,
    ["sup", 15, 11], // stair up inside the house
    // Tower base on ground floor (solid walls, no roof here)
    ...TOWER_WALLS,
  ]);

  // Level -1 — basement: nearly identical to before, fully enclosed.
  const levelMinus1 = buildGroundLevel([
    ["sup", 8, 8],
    ["grs", 9, 8],
    ["wal", 10, 8],
  ]);

  // Level 1 — sky level. Everything is "..." except:
  //   - The house walls still exist at the same XY (structural columns)
  //   - The house interior is now RED ROOF (seen from above on level 0)
  //   - The tower also has walls here (it's taller than the house)
  //   - Stair down at (6,6) for the benchmark "transition up" test
  //   - Stair down at (15,11) inside the house to go back to level 0
  const level1 = buildSkyLevel([
    ["sdn", 6, 6], // back to level 0 (benchmark step)
    ["sup", 7, 6], // up to level 2 (benchmark step)
    ...HOUSE_WALLS,
    ...HOUSE_ROOF,
    ["sdn", 15, 11], // stair down inside house back to level 0
    ...TOWER_WALLS,
    ...TOWER_ROOF,
  ]);

  // Level 2 — sky level. House is gone (only 1 floor tall).
  // Only the tower top remains with a roof.
  const level2 = buildSkyLevel([
    ["sdn", 7, 6], // back to level 1 (benchmark)
    ["sup", 8, 6], // up to level 3 (benchmark)
    ...TOWER_WALLS,
    ...TOWER_ROOF,
  ]);

  // Level 3 — sky level. Only stair down, nothing else.
  const level3 = buildSkyLevel([
    ["sdn", 8, 6], // back to level 2 (benchmark)
  ]);

  const binDir = path.join(ROOT_DIR, "public", "maps");
  fs.writeFileSync(path.join(binDir, "smoke_test_0.bin"), level0);
  fs.writeFileSync(path.join(binDir, "smoke_test_-1.bin"), levelMinus1);
  fs.writeFileSync(path.join(binDir, "smoke_test_1.bin"), level1);
  fs.writeFileSync(path.join(binDir, "smoke_test_2.bin"), level2);
  fs.writeFileSync(path.join(binDir, "smoke_test_3.bin"), level3);

  console.log(
    "[SMOKE] Generated smoke_test_0.bin, smoke_test_-1.bin, smoke_test_1.bin, smoke_test_2.bin, smoke_test_3.bin",
  );
}

main();
