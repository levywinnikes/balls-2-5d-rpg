const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ITEMS_DIR = path.join(ROOT, "public/assets/items");
const CATALOG_PATH = path.join(ROOT, "docs/sprites/items/catalog.json");
const MAX_BYTES = 50000;

function loadRegistryIds() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const fromGroups = Object.values(catalog.groups).flat();
  const fromItems = Object.keys(catalog.items);
  return [...new Set([...fromGroups, ...fromItems, "leather_helmet"])];
}

function main() {
  const ids = loadRegistryIds().sort();
  const rows = [];

  for (const id of ids) {
    const png = path.join(ITEMS_DIR, `${id}.png`);
    if (!fs.existsSync(png)) {
      rows.push({ id, status: "missing", bytes: 0 });
      continue;
    }
    const bytes = fs.statSync(png).size;
    rows.push({
      id,
      status: bytes < MAX_BYTES ? "ok" : "oversized",
      bytes,
    });
  }

  const ok = rows.filter((r) => r.status === "ok");
  const oversized = rows.filter((r) => r.status === "oversized");
  const missing = rows.filter((r) => r.status === "missing");

  console.log("# Item icon audit (<50KB = proper 32x32 pipeline)\n");
  console.log(`OK (${ok.length}):`, ok.map((r) => r.id).join(", ") || "(none)");
  console.log(`OVERSIZED (${oversized.length}):`, oversized.map((r) => r.id).join(", ") || "(none)");
  console.log(`MISSING (${missing.length}):`, missing.map((r) => r.id).join(", ") || "(none)");
}

main();
