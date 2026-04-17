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

  function buildLevel(overrides) {
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

  const level0 = buildLevel([
    ["sdn", 8, 8],
    ["hol", 9, 8],
    ["grs", 10, 8],
    ["grs", 11, 8],
  ]);

  const levelMinus1 = buildLevel([
    ["sup", 8, 8],
    ["grs", 9, 8],
    ["wal", 10, 8],
  ]);

  fs.writeFileSync(
    path.join(ROOT_DIR, "public", "maps", "smoke_test_0.bin"),
    level0,
  );
  fs.writeFileSync(
    path.join(ROOT_DIR, "public", "maps", "smoke_test_-1.bin"),
    levelMinus1,
  );

  console.log("[SMOKE] Generated smoke_test_0.bin and smoke_test_-1.bin");
}

main();
