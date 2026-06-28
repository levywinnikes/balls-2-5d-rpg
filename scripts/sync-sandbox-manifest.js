const fs = require("fs");
const path = require("path");
const {
  ROOT,
  scanEnemyIds,
  scanItemIds,
  mergeSymbolMap,
} = require("./lib/sandbox-registry");

const MANIFEST_PATH = path.join(ROOT, "docs/debug/sandbox-manifest.json");

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const registryEnemies = scanEnemyIds();
  const registryItems = scanItemIds();

  const prevEnemies = new Set(manifest.enemies || []);
  const prevItems = new Set(manifest.items || []);
  const excludeEnemies = new Set(manifest.excludeEnemies || []);

  manifest.enemies = registryEnemies.filter((id) => !excludeEnemies.has(id));
  manifest.items = registryItems;
  manifest.symbols = manifest.symbols || { enemies: {}, items: {} };
  manifest.symbols.enemies = mergeSymbolMap(
    manifest.symbols.enemies,
    registryEnemies,
    "en",
  );
  manifest.symbols.items = mergeSymbolMap(
    manifest.symbols.items,
    registryItems,
    "it",
  );

  const addedEnemies = registryEnemies.filter((id) => !prevEnemies.has(id));
  const addedItems = registryItems.filter((id) => !prevItems.has(id));
  const removedEnemies = [...prevEnemies].filter((id) => !registryEnemies.includes(id));
  const removedItems = [...prevItems].filter((id) => !registryItems.includes(id));

  manifest.generatedAt = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");

  console.log("[sync-sandbox] enemies:", registryEnemies.length);
  console.log("[sync-sandbox] items:", registryItems.length);
  if (addedEnemies.length) {
    console.log("[sync-sandbox] +enemies:", addedEnemies.join(", "));
  }
  if (addedItems.length) {
    console.log("[sync-sandbox] +items:", addedItems.join(", "));
  }
  if (removedEnemies.length) {
    console.log("[sync-sandbox] -enemies:", removedEnemies.join(", "));
  }
  if (removedItems.length) {
    console.log("[sync-sandbox] -items:", removedItems.join(", "));
  }
}

main();
