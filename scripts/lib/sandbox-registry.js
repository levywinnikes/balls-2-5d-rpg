const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

/** All enemy ids from EnemyRegistry.ts (gameplay source of truth). */
function scanEnemyIds() {
  const src = readText("src/game/entities/EnemyRegistry.ts");
  const ids = [];
  const re = /^\s+id:\s*"([^"]+)"/gm;
  let match = re.exec(src);
  while (match) {
    ids.push(match[1]);
    match = re.exec(src);
  }
  return [...new Set(ids)].sort();
}

/** Item ids from item icon catalog + leather_helmet (always in WeaponRegistry). */
function scanItemIds() {
  const catalogPath = path.join(ROOT, "docs/sprites/items/catalog.json");
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const ids = new Set(Object.keys(catalog.items || {}));
  Object.values(catalog.groups || {}).forEach((group) => {
    group.forEach((id) => ids.add(id));
  });
  ids.add("leather_helmet");
  return [...ids].sort();
}

function assignSymbols(ids, prefix) {
  const symbols = {};
  ids.forEach((id, index) => {
    const suffix = String(index).padStart(2, "0");
    symbols[id] = `${prefix}${suffix}`;
  });
  return symbols;
}

function mergeSymbolMap(existing, ids, prefix) {
  const next = { ...(existing || {}) };
  const used = new Set(Object.values(next));
  ids.forEach((id) => {
    if (next[id]) {
      used.add(next[id]);
      return;
    }
    let index = 0;
    let candidate;
    do {
      candidate = `${prefix}${String(index).padStart(2, "0")}`;
      index += 1;
    } while (used.has(candidate));
    next[id] = candidate;
    used.add(candidate);
  });
  return next;
}

module.exports = {
  ROOT,
  scanEnemyIds,
  scanItemIds,
  assignSymbols,
  mergeSymbolMap,
};
