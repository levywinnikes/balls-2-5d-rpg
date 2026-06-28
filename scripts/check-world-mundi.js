const fs = require("fs");
const path = require("path");

const MAP_NAME = process.argv[2] || "city_3d_multi";
const mapPath = path.join("public", "maps", `${MAP_NAME}.json`);
const outPath = path.join("docs", "MAP_MUNDI_3D_P0_VALIDATION.json");

function fail(message) {
  console.error(`[check:world-mundi] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(mapPath)) {
  fail(`Mapa nao encontrado: ${mapPath}`);
}

const mapData = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const { width, height, levels, tileAtlas } = mapData;
if (!width || !height || !levels || !tileAtlas) {
  fail("Mapa invalido: faltam width/height/levels/tileAtlas");
}

const level0Meta = levels[0] || levels["0"];
if (!level0Meta || !level0Meta.binFile) {
  fail("Mapa invalido: level 0 binario nao encontrado");
}

const level0Bin = path.join(path.dirname(mapPath), level0Meta.binFile);
if (!fs.existsSync(level0Bin)) {
  fail(`Binario do level 0 nao encontrado: ${level0Bin}`);
}

const tiles = new Uint8Array(fs.readFileSync(level0Bin));
if (tiles.length !== width * height) {
  fail(`Binario inconsistente: esperado ${width * height} bytes, recebeu ${tiles.length}`);
}

const symbolAt = (idx) => tileAtlas[idx] || "unk";
const tileAt = (x, y) => symbolAt(tiles[y * width + x]);

const counts = {};
for (let i = 0; i < tiles.length; i += 1) {
  const s = symbolAt(tiles[i]);
  counts[s] = (counts[s] || 0) + 1;
}

let edgeWat = 0;
let totalEdge = 0;
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
      totalEdge += 1;
      if (tileAt(x, y) === "wat") edgeWat += 1;
    }
  }
}
const edgeWaterRatio = totalEdge > 0 ? edgeWat / totalEdge : 0;

const biomes = ["grs", "snd", "mud", "wat", "pat", "wtr", "cob", "stn", "pav", "tre", "rok"];
const transitions = {};
for (let i = 0; i < biomes.length; i += 1) {
  for (let j = i + 1; j < biomes.length; j += 1) {
    const pair = `${biomes[i]}-${biomes[j]}`;
    transitions[pair] = 0;
  }
}

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const s1 = tileAt(x, y);
    if (x < width - 1) {
      const s2 = tileAt(x + 1, y);
      if (s1 !== s2 && biomes.includes(s1) && biomes.includes(s2)) {
        const pair = [s1, s2].sort().join("-");
        transitions[pair] = (transitions[pair] || 0) + 1;
      }
    }
    if (y < height - 1) {
      const s2 = tileAt(x, y + 1);
      if (s1 !== s2 && biomes.includes(s1) && biomes.includes(s2)) {
        const pair = [s1, s2].sort().join("-");
        transitions[pair] = (transitions[pair] || 0) + 1;
      }
    }
  }
}

function componentCount(targetSymbol) {
  const visited = new Uint8Array(tiles.length);
  let components = 0;
  for (let i = 0; i < tiles.length; i += 1) {
    if (visited[i]) continue;
    if (symbolAt(tiles[i]) !== targetSymbol) continue;
    components += 1;
    const queue = [i];
    visited[i] = 1;
    while (queue.length > 0) {
      const idx = queue.pop();
      const x = idx % width;
      const y = Math.floor(idx / width);
      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (visited[nIdx]) continue;
        if (symbolAt(tiles[nIdx]) !== targetSymbol) continue;
        visited[nIdx] = 1;
        queue.push(nIdx);
      }
    }
  }
  return components;
}

const fragmentation = {
  grs: componentCount("grs"),
  snd: componentCount("snd"),
  mud: componentCount("mud"),
  wat: componentCount("wat"),
  pat: componentCount("pat"),
};

const windowSize = 4;
const signatureFrequency = new Map();
let totalWindows = 0;
const structuralSymbols = new Set([
  "cob",
  "stn",
  "pav",
  "wal",
  "bwl",
  "flr",
  "arc",
  "pil",
  "fnt",
  "stu",
  "std",
  "hol",
]);
for (let y = 0; y <= height - windowSize; y += 1) {
  for (let x = 0; x <= width - windowSize; x += 1) {
    const parts = [];
    let hasStructural = false;
    for (let wy = 0; wy < windowSize; wy += 1) {
      for (let wx = 0; wx < windowSize; wx += 1) {
        const s = tileAt(x + wx, y + wy);
        parts.push(s);
        if (structuralSymbols.has(s)) hasStructural = true;
      }
    }
    // Ignore purely natural windows (sea/grass/sand etc.).
    if (!hasStructural) continue;
    const unique = new Set(parts);
    // Ignore trivial structural windows (flat roads/plazas) and focus on mixed layouts.
    if (unique.size < 3) continue;
    const sig = parts.join(",");
    signatureFrequency.set(sig, (signatureFrequency.get(sig) || 0) + 1);
    totalWindows += 1;
  }
}

let maxSignatureCount = 0;
for (const count of signatureFrequency.values()) {
  if (count > maxSignatureCount) maxSignatureCount = count;
}
const repetitionRatio = totalWindows > 0 ? maxSignatureCount / totalWindows : 0;

const errors = [];
const warnings = [];

if (edgeWaterRatio < 0.95) {
  errors.push(`Borda maritima insuficiente: ${(edgeWaterRatio * 100).toFixed(2)}% < 95%`);
}

const softLimits = {
  "grs-wat": 250,
  "mud-snd": 80,
  "pav-grs": 500,
};

for (const [pair, soft] of Object.entries(softLimits)) {
  const observed = transitions[pair] || 0;
  if (observed > soft * 3) {
    errors.push(`Transicao abrupta critica em ${pair}: ${observed} > ${soft * 3}`);
  } else if (observed > soft) {
    warnings.push(`Transicao alta em ${pair}: ${observed} > ${soft}`);
  }
}

if (fragmentation.grs > 600) {
  errors.push(`Fragmentacao critica de grs: ${fragmentation.grs} > 600`);
} else if (fragmentation.grs > 400) {
  warnings.push(`Fragmentacao alta de grs: ${fragmentation.grs} > 400`);
}

if (repetitionRatio > 0.35) {
  errors.push(`Repeticao critica estrutural 4x4: ${repetitionRatio.toFixed(4)} > 0.35`);
} else if (repetitionRatio > 0.22) {
  warnings.push(`Repeticao alta estrutural 4x4: ${repetitionRatio.toFixed(4)} > 0.22`);
}

const report = {
  map: MAP_NAME,
  dimensions: { width, height, levels: Object.keys(levels).length },
  edgeWaterRatio,
  tileCounts: counts,
  topTransitions: Object.entries(transitions)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15),
  fragmentation,
  repetitionRatio,
  warnings,
  errors,
  pass: errors.length === 0,
};

fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (errors.length > 0) {
  console.error("[check:world-mundi] FAIL");
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log("[check:world-mundi] PASS");
console.log(JSON.stringify(report, null, 2));
