const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const CATALOG_PATH = path.join(ROOT, "docs/sprites/items/catalog.json");
const SPECS_DIR = path.join(ROOT, "docs/sprites/items");

function parseArgs(argv) {
  const args = { group: "starter", ids: null, "write-specs-only": false, force: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function loadCatalog() {
  return JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
}

function writeSpec(catalog, id) {
  const entry = catalog.items[id];
  if (!entry || !entry.description) {
    throw new Error(`Catalog missing item: ${id}`);
  }

  const spec = {
    version: 1,
    id,
    registry_id: id,
    name: entry.name || id,
    category: "item_icon",
    item_type: entry.item_type || "misc",
    links: {
      weapon_registry_id: id,
    },
    canvas: { width: 32, height: 32 },
    output: {
      path: `public/assets/items/${id}.png`,
      public_url: `assets/items/${id}.png`,
    },
    production_prompts: {
      description: entry.description,
      negative_prompt:
        entry.negative_prompt || catalog.style_defaults.negative_prompt,
    },
    style: {
      outline: catalog.style_defaults.outline,
      shading: catalog.style_defaults.shading,
      detail: catalog.style_defaults.detail,
      view: catalog.style_defaults.view,
    },
    pipeline: {
      method: "create-image-pixflux",
      no_background: true,
    },
  };

  const specPath = path.join(SPECS_DIR, `${id.replace(/_/g, "-")}.spec.json`);
  fs.mkdirSync(SPECS_DIR, { recursive: true });
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2) + "\n");
  return specPath;
}

function resolveIds(catalog, args) {
  if (args.ids) {
    return args.ids.split(",").map((s) => s.trim()).filter(Boolean);
  }
  const group = args.group || "starter";
  const ids = catalog.groups[group];
  if (!ids) {
    throw new Error(`Unknown group "${group}". Available: ${Object.keys(catalog.groups).join(", ")}`);
  }
  return ids;
}

function isProperIcon(id) {
  const pngPath = path.join(ROOT, "public/assets/items", `${id}.png`);
  if (!fs.existsSync(pngPath)) return false;
  const size = fs.statSync(pngPath).size;
  return size > 0 && size < 50000;
}

function main() {
  const args = parseArgs(process.argv);
  const catalog = loadCatalog();
  const ids = resolveIds(catalog, args);

  console.log(`[item-icons-batch] group=${args.group || "custom"} count=${ids.length}`);

  for (const id of ids) {
    const specPath = writeSpec(catalog, id);
    console.log(`[item-icons-batch] spec → ${path.relative(ROOT, specPath)}`);

    if (args["write-specs-only"]) {
      continue;
    }

    if (!args.force && isProperIcon(id)) {
      console.log(`[item-icons-batch] skip ${id} (already small PNG, use --force)`);
      continue;
    }

    console.log(`[item-icons-batch] generating ${id}...`);
    const result = spawnSync(
      process.execPath,
      [path.join(__dirname, "generate-item-icon.js"), "--spec", specPath],
      { cwd: ROOT, stdio: "inherit" },
    );
    if (result.status !== 0) {
      process.exit(result.status || 1);
    }
  }

  console.log("[item-icons-batch] ✅ done");
}

main();
