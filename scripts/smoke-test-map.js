const fs = require("fs");
const path = require("path");

const ROOT_DIR = process.cwd();
const MAP_NAME = process.argv[2] || "smoke_test";
const MAP_PATH = path.join(ROOT_DIR, "public", "maps", `${MAP_NAME}.json`);

function fail(message) {
  console.error(`[SMOKE] FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`[SMOKE] PASS ${message}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  if (!fs.existsSync(MAP_PATH)) {
    fail(`Map file not found: ${path.relative(ROOT_DIR, MAP_PATH)}`);
    return;
  }

  const mapData = readJson(MAP_PATH);
  const relMap = path.relative(ROOT_DIR, MAP_PATH).replace(/\\/g, "/");
  console.log(`[SMOKE] Map: ${relMap}`);

  const requiredFields = ["tileSize", "width", "height", "tileAtlas", "tileDefinitions", "entityTemplates", "levels"];
  for (const field of requiredFields) {
    if (mapData[field] === undefined || mapData[field] === null) {
      fail(`Missing required field '${field}'`);
      return;
    }
  }

  if (!Array.isArray(mapData.tileAtlas) || mapData.tileAtlas.length === 0) {
    fail("tileAtlas must be a non-empty array");
    return;
  }

  const smokeTests = Array.isArray(mapData.config?.smokeTests) ? mapData.config.smokeTests : [];
  if (smokeTests.length === 0) {
    fail("config.smokeTests is missing or empty");
    return;
  }

  let failureCount = 0;
  const width = Number(mapData.width);
  const height = Number(mapData.height);
  const expectedBytes = width * height;

  const levelEntries = Object.entries(mapData.levels);
  for (const [level, levelData] of levelEntries) {
    const binPath = path.join(ROOT_DIR, "public", "maps", levelData.binFile || "");
    const relBin = path.relative(ROOT_DIR, binPath).replace(/\\/g, "/");

    if (!fs.existsSync(binPath)) {
      failureCount += 1;
      fail(`Missing binary for level ${level}: ${relBin}`);
      continue;
    }

    const size = fs.statSync(binPath).size;
    if (size !== expectedBytes) {
      failureCount += 1;
      fail(`Binary size mismatch for level ${level}: expected ${expectedBytes}, got ${size}`);
    } else {
      pass(`Binary size OK for level ${level} (${size} bytes)`);
    }
  }

  for (const testCase of smokeTests) {
    const label = `${testCase.id} (${testCase.type})`;
    const levelData = mapData.levels[testCase.level];

    if (!levelData) {
      failureCount += 1;
      fail(`Test '${label}' references missing level '${testCase.level}'`);
      continue;
    }

    if (testCase.type === "spawn") {
      if (levelData.playerPos && typeof levelData.playerPos.x === "number" && typeof levelData.playerPos.y === "number") {
        pass(`Spawn checkpoint OK: ${label}`);
      } else {
        failureCount += 1;
        fail(`Spawn checkpoint missing playerPos: ${label}`);
      }
      continue;
    }

    if (testCase.type === "entity") {
      const matches = Array.isArray(levelData.entities)
        ? levelData.entities.filter((entity) => {
            if (entity.symbol !== testCase.symbol) return false;
            if (testCase.x !== undefined && entity.x !== testCase.x) return false;
            if (testCase.y !== undefined && entity.y !== testCase.y) return false;
            return true;
          })
        : [];

      if (matches.length > 0) {
        pass(`Entity checkpoint OK: ${label}`);
      } else {
        failureCount += 1;
        fail(`Entity checkpoint not found: ${label}`);
      }
      continue;
    }

    if (testCase.type === "tile") {
      const binPath = path.join(ROOT_DIR, "public", "maps", levelData.binFile || "");
      const bytes = fs.readFileSync(binPath);
      const index = testCase.y * width + testCase.x;
      const symbolIndex = bytes[index];
      const symbol = mapData.tileAtlas[symbolIndex];

      if (symbol === testCase.symbol) {
        pass(`Tile checkpoint OK: ${label}`);
      } else {
        failureCount += 1;
        fail(`Tile checkpoint mismatch for ${label}: expected '${testCase.symbol}', got '${symbol || "<missing>"}'`);
      }
      continue;
    }

    failureCount += 1;
    fail(`Unknown smoke test type '${testCase.type}' for '${label}'`);
  }

  if (failureCount === 0) {
    console.log(`[SMOKE] OK - ${smokeTests.length} checkpoints validated successfully.`);
  } else {
    console.error(`[SMOKE] Completed with ${failureCount} failure(s).`);
    process.exitCode = 1;
  }
}

main();