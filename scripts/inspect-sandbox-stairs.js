const fs = require("fs");
const path = require("path");

const json = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../public/maps/debug_sandbox.json"), "utf8"),
);
const atlas = json.tileAtlas;
const stu = atlas.indexOf("stu");
const std = atlas.indexOf("std");
const cob = atlas.indexOf("cob");
const wal = atlas.indexOf("wal");
const w = json.width;
const h = json.height;

function loadLevel(levelKey) {
  const buf = fs.readFileSync(
    path.join(__dirname, `../public/maps/debug_sandbox_${levelKey}.bin`),
  );
  return buf;
}

function getTile(buf, x, y) {
  if (x < 0 || y < 0 || x >= w || y >= h) {
    return null;
  }
  return buf[y * w + x];
}

function scanLevel(levelKey) {
  const buf = loadLevel(levelKey);
  const stairs = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const v = getTile(buf, x, y);
      if (v === stu || v === std) {
        stairs.push({ x, y, s: atlas[v] });
      }
    }
  }
  return { buf, stairs };
}

function parseLevel(levelKey) {
  const n = Number(levelKey);
  return Number.isFinite(n) ? n : 0;
}

function isStairSymbol(idx) {
  return idx === stu || idx === std;
}

function isWalkableLanding(idx) {
  if (idx == null || idx === atlas.indexOf("...")) {
    return false;
  }
  const sym = atlas[idx];
  return sym === "cob" || sym === "flr" || sym === "dfn";
}

function validateShaftRules(levelKeys) {
  const violations = [];
  const levels = levelKeys
    .map((key) => ({ key, n: parseLevel(key), ...scanLevel(key) }))
    .sort((a, b) => a.n - b.n);

  for (const level of levels) {
    for (const stair of level.stairs) {
      const north = getTile(level.buf, stair.x, stair.y - 1);
      if (north === wal || north == null) {
        violations.push(
          `M4: ${stair.s} @ (${stair.x},${stair.y}) L${level.key} — tile north (${stair.x},${stair.y - 1}) is ${north == null ? "void/edge" : atlas[north]} (need walkable floor)`,
        );
      }

      if (stair.s !== "stu") {
        continue;
      }
      const upper = levels.find((entry) => entry.n === level.n + 1);
      if (!upper) {
        continue;
      }
      const above = getTile(upper.buf, stair.x, stair.y);
      if (isStairSymbol(above)) {
        violations.push(
          `M2: ${stair.s} @ (${stair.x},${stair.y}) on L${level.key} — L${upper.key} same tile is ${atlas[above]} (expected floor)`,
        );
      } else if (
        above !== cob &&
        above != null &&
        atlas[above] !== "..."
      ) {
        const sym = atlas[above] ?? "?";
        if (!isWalkableLanding(above)) {
          violations.push(
            `M2: stu landing L${upper.key} @ (${stair.x},${stair.y}) is ${sym} (expected walkable floor)`,
          );
        }
      }
    }
  }

  return violations;
}

const levelKeys = ["-2", "-1", "0", "1", "2", "3"];

for (const lv of levelKeys) {
  const { stairs } = scanLevel(lv);
  console.log(`\n=== Level ${lv} (${stairs.length} stair tiles) ===`);
  stairs.forEach((t) => console.log(`  ${t.s} @ (${t.x},${t.y})`));
}

const hub = scanLevel("0").stairs.filter((t) => t.y < 22);
console.log("\n=== Hub L0 stairs (y<22) — use these for playtest ===");
hub.forEach((t) => console.log(`  ${t.s} @ (${t.x},${t.y})`));
const hubStu = hub.find((t) => t.s === "stu");
const hubStd = hub.find((t) => t.s === "std");
if (hubStu) {
  console.log(
    `  Torre (Leste): stu @ (${hubStu.x},${hubStu.y}) — entre pelo sul, caminhe NORTE nos degraus.`,
  );
}
if (hubStd) {
  console.log(
    `  Porão (Oeste): std @ (${hubStd.x},${hubStd.y}) — entre pelo sul, caminhe NORTE para descer.`,
  );
}

const violations = validateShaftRules(levelKeys);
console.log("\n=== Shaft rule validation (M2 + M4) ===");
if (violations.length === 0) {
  console.log("  OK — landings and north clearance valid.");
} else {
  violations.forEach((v) => console.log(`  FAIL: ${v}`));
  process.exitCode = 1;
}
