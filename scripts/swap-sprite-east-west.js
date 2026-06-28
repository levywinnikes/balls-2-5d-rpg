/**
 * Swap mislabeled east/west sprite folders on disk (folder rename, not mirror).
 * Use when character_rotations/east.png matches hero_base west and vice versa.
 *
 * Usage: npm run fix:sprite-east-west -- --entity goblin_lanceiro
 *
 * @see docs/sprites/DIRECTION_CONVENTION.md §5
 */
const fs = require("fs");
const path = require("path");

const ANIM_STATES = ["idle", "walk", "attack"];

function swapPaths(pathA, pathB) {
  if (!fs.existsSync(pathA) || !fs.existsSync(pathB)) {
    console.warn(`  [skip] missing: ${pathA} or ${pathB}`);
    return false;
  }
  const tmp = `${pathA}.__east_west_swap__`;
  fs.renameSync(pathA, tmp);
  fs.renameSync(pathB, pathA);
  fs.renameSync(tmp, pathB);
  return true;
}

function fixMetaDirection(dirPath, direction) {
  const metaPath = path.join(dirPath, "meta.json");
  if (!fs.existsSync(metaPath)) {
    return;
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  meta.direction = direction;
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
}

function swapEntityEastWest(entityId) {
  const base = path.join(
    process.cwd(),
    "public",
    "assets",
    "sprites",
    "generated",
    entityId,
  );
  if (!fs.existsSync(base)) {
    throw new Error(`Entity folder not found: ${base}`);
  }

  console.log(`[swap-east-west] ${entityId}`);

  if (
    swapPaths(
      path.join(base, "character_rotations", "east.png"),
      path.join(base, "character_rotations", "west.png"),
    )
  ) {
    console.log("  character_rotations/east.png <-> west.png");
  }

  for (const state of ANIM_STATES) {
    const eastDir = path.join(base, `${state}_east`);
    const westDir = path.join(base, `${state}_west`);
    if (!swapPaths(eastDir, westDir)) {
      continue;
    }
    fixMetaDirection(eastDir, "east");
    fixMetaDirection(westDir, "west");
    console.log(`  ${state}_east/ <-> ${state}_west/`);
  }

  console.log("[swap-east-west] done — validate vs hero_base before merge.");
}

function main() {
  const args = process.argv.slice(2);
  const entityIdx = args.indexOf("--entity");
  const entity = entityIdx >= 0 ? args[entityIdx + 1] : null;
  if (!entity) {
    console.error("Usage: node scripts/swap-sprite-east-west.js --entity <entityId>");
    process.exit(1);
  }
  swapEntityEastWest(entity);
}

main();
