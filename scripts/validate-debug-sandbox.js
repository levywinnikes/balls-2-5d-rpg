const fs = require("fs");
const path = require("path");
const {
  ROOT,
  scanEnemyIds,
  scanItemIds,
} = require("./lib/sandbox-registry");

const MANIFEST_PATH = path.join(ROOT, "docs/debug/sandbox-manifest.json");
const MAP_JSON = path.join(ROOT, "public/maps/debug_sandbox.json");

function main() {
  let failed = false;

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("[validate-debug-sandbox] ❌ missing manifest");
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const registryEnemies = scanEnemyIds();
  const registryItems = scanItemIds();

  const manifestEnemies = manifest.enemies || [];
  const manifestItems = manifest.items || [];
  const manifestProps = manifest.props || [];
  const excludeEnemies = new Set(manifest.excludeEnemies || []);
  const expectedRegistryEnemies = registryEnemies.filter(
    (id) => !excludeEnemies.has(id),
  );

  const missingEnemies = expectedRegistryEnemies.filter(
    (id) => !manifestEnemies.includes(id),
  );
  const missingItems = registryItems.filter((id) => !manifestItems.includes(id));
  const extraEnemies = manifestEnemies.filter((id) => !registryEnemies.includes(id));
  const extraItems = manifestItems.filter((id) => !registryItems.includes(id));

  if (missingEnemies.length) {
    failed = true;
    console.error("[validate-debug-sandbox] ❌ enemies in registry but not manifest:", missingEnemies.join(", "));
    console.error("  → run: npm run sync:debug-sandbox && npm run generate:debug-sandbox");
  }
  if (missingItems.length) {
    failed = true;
    console.error("[validate-debug-sandbox] ❌ items in catalog but not manifest:", missingItems.join(", "));
  }
  if (extraEnemies.length) {
    failed = true;
    console.error("[validate-debug-sandbox] ❌ stale enemies in manifest:", extraEnemies.join(", "));
  }
  if (extraItems.length) {
    failed = true;
    console.error("[validate-debug-sandbox] ❌ stale items in manifest:", extraItems.join(", "));
  }

  if (!fs.existsSync(MAP_JSON)) {
    failed = true;
    console.error("[validate-debug-sandbox] ❌ missing public/maps/debug_sandbox.json");
  } else {
    const mapData = JSON.parse(fs.readFileSync(MAP_JSON, "utf8"));
    const entityCount = mapData.levels?.["0"]?.entities?.length || 0;
    const doorsEnabled = manifest.layout?.enableDoors === true;
    const propSymbols = new Set(
      Object.values(manifest.symbols?.props || {}),
    );
    const propEntityCount = (mapData.levels?.["0"]?.entities || []).filter(
      (entry) => propSymbols.has(entry.symbol),
    ).length;
    const expected =
      manifestEnemies.length +
      manifestItems.length +
      propEntityCount +
      (doorsEnabled ? manifestEnemies.length : 0);
    if (entityCount !== expected) {
      failed = true;
      console.error(
        `[validate-debug-sandbox] ❌ map entity count ${entityCount} != ${expected} (run generate:debug-sandbox)`,
      );
    }
  }

  if (failed) {
    process.exit(1);
  }

  console.log(
    `[validate-debug-sandbox] ✅ ok — ${manifestEnemies.length} enemies, ${manifestItems.length} items`,
  );
}

main();
