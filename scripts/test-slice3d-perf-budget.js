/**
 * Static + map budget checks for 3D slice performance guardrails.
 *
 * Run: node scripts/test-slice3d-perf-budget.js [mapName]
 *
 * In-browser manual probe (while playing):
 *   window.__slice3dPerf
 *   window.__slice3dChunkStreaming
 *   window.__slice3dVerticalVisibility
 */

const fs = require("fs");
const path = require("path");

const mapName = process.argv[2] || "city_3d_multi";
const repoRoot = path.join(__dirname, "..");
const mapJsonPath = path.join(repoRoot, "public", "maps", `${mapName}.json`);
const runtimePath = path.join(
  repoRoot,
  "src",
  "three-d",
  "runtime",
  "createDebugSliceScene.ts",
);
const stairPath = path.join(
  repoRoot,
  "src",
  "three-d",
  "runtime",
  "StairConfig3D.ts",
);

const BUDGETS = {
  surfaceEnemiesLevel0: 420,
  undergroundEnemiesTotal: 120,
  propsLevel0: 500,
};

function fail(msg) {
  console.error(`[slice3d-perf] FAIL ${msg}`);
  process.exitCode = 1;
}

function pass(msg) {
  console.log(`[slice3d-perf] PASS ${msg}`);
}

function readRuntimeGuards() {
  const src = fs.readFileSync(runtimePath, "utf8");
  const required = [
    "ENEMY_STREAM_RADIUS_UNITS",
    "ENEMY_DESPAWN_RADIUS_UNITS",
    "syncEnemyStream",
    "syncPropStream",
    "PROP_DESPAWN_RADIUS_UNITS",
    "NAV_WINDOW_RADIUS",
    "STAIR_LANDING_LOCAL_Z",
    "verticalTransitionGuard",
    "applyEnemyAnimLod",
    "findFirstBlockingTileOnWorldLine",
    "clearAllChunks",
    "getRenderableLevels",
    "activeLevelNumber < 0",
  ];
  required.forEach((token) => {
    if (!src.includes(token)) {
      fail(`runtime missing guard: ${token}`);
    } else {
      pass(`runtime defines ${token}`);
    }
  });

  const stairSrc = fs.readFileSync(stairPath, "utf8");
  ["STAIR_LANDING_LOCAL_Z", "HOLE_DESCEND_EDGE_Z", "landingLocalZ"].forEach(
    (token) => {
      if (!stairSrc.includes(token)) {
        fail(`StairConfig3D missing: ${token}`);
      } else {
        pass(`StairConfig3D defines ${token}`);
      }
    },
  );
}

function countEntities(map) {
  const counts = {};
  for (const [level, data] of Object.entries(map.levels || {})) {
    const enemies = (data.entities || []).filter((entity) => {
      const template = map.entityTemplates?.[entity.symbol];
      return template?.type === "enemy";
    }).length;
    const props = (data.entities || []).filter((entity) => {
      const template = map.entityTemplates?.[entity.symbol];
      return template?.type === "decoration";
    }).length;
    counts[level] = { enemies, props };
  }
  return counts;
}

function main() {
  console.log(`[slice3d-perf] Map: ${mapName}`);

  if (!fs.existsSync(mapJsonPath)) {
    fail(`map not found: ${mapJsonPath}`);
    return;
  }

  readRuntimeGuards();

  const map = JSON.parse(fs.readFileSync(mapJsonPath, "utf8"));
  const counts = countEntities(map);
  const surface = counts["0"]?.enemies ?? 0;
  const underground =
    (counts["-1"]?.enemies ?? 0) + (counts["-2"]?.enemies ?? 0);
  const props = counts["0"]?.props ?? 0;

  console.log(
    `[slice3d-perf] Catalog — surface enemies: ${surface}, underground: ${underground}, props L0: ${props}`,
  );

  if (surface > BUDGETS.surfaceEnemiesLevel0) {
    fail(
      `too many surface enemies (${surface} > ${BUDGETS.surfaceEnemiesLevel0}). Regenerate map or lower scatter density.`,
    );
  } else {
    pass(`surface enemy catalog within budget (${surface})`);
  }

  if (underground > BUDGETS.undergroundEnemiesTotal) {
    fail(
      `too many underground enemies (${underground} > ${BUDGETS.undergroundEnemiesTotal})`,
    );
  } else {
    pass(`underground enemy catalog within budget (${underground})`);
  }

  if (props > BUDGETS.propsLevel0) {
    fail(`too many props on L0 (${props} > ${BUDGETS.propsLevel0})`);
  } else {
    pass(`prop count within budget (${props})`);
  }

  console.log(`
[slice3d-perf] Manual playtest checklist:
  1. Walk 2 min — window.__slice3dPerf.streamedEnemies should stay < 60
  2. Enter/exit a hole — walls visible underground; brief hitch OK, no freeze > 3s
  3. After 5 min — heap delta in __slice3dPerf should not climb without bound
  4. Compare chunkLoaded before/after walking away — should not grow forever
`);
}

main();
