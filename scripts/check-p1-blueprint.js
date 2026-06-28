const fs = require("fs");
const path = require("path");

const blueprintPath = path.join("docs", "MAP_MUNDI_3D_P1_BLUEPRINT_512.json");
const outPath = path.join("docs", "MAP_MUNDI_3D_P1_VALIDATION.json");

function fail(message) {
  console.error(`[check:p1-blueprint] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(blueprintPath)) {
  fail(`Arquivo nao encontrado: ${blueprintPath}`);
}

const data = JSON.parse(fs.readFileSync(blueprintPath, "utf8"));
const errors = [];
const warnings = [];

const width = data?.mapSize?.width;
const height = data?.mapSize?.height;
const seaBorderMin = data?.globalRules?.seaBorderMinTiles;
const macrozones = data?.macrozones || [];

if (width !== 512 || height !== 512) {
  errors.push(`Tamanho invalido: esperado 512x512, recebeu ${width}x${height}`);
}
if (!Number.isInteger(seaBorderMin) || seaBorderMin < 20) {
  errors.push(`seaBorderMinTiles invalido: ${seaBorderMin}`);
}

const requiredZones = data?.p1AcceptanceTargets?.requiredMacrozoneCount;
if (requiredZones && macrozones.length < requiredZones) {
  errors.push(`Quantidade de macrozonas insuficiente: ${macrozones.length} < ${requiredZones}`);
}

const insideSeaBorder = (bbox) => {
  return (
    bbox.x0 >= seaBorderMin &&
    bbox.y0 >= seaBorderMin &&
    bbox.x1 <= width - seaBorderMin - 1 &&
    bbox.y1 <= height - seaBorderMin - 1
  );
};

for (const zone of macrozones) {
  if (!zone?.bbox) {
    errors.push(`Macrozone sem bbox: ${zone?.id || "unknown"}`);
    continue;
  }
  const { x0, y0, x1, y1 } = zone.bbox;
  if (!(x0 < x1 && y0 < y1)) {
    errors.push(`BBox invalido em ${zone.id}: [${x0},${y0}]..[${x1},${y1}]`);
  }
  if (!insideSeaBorder(zone.bbox)) {
    errors.push(`Macrozone invade borda maritima minima: ${zone.id}`);
  }
}

for (let i = 0; i < macrozones.length; i += 1) {
  for (let j = i + 1; j < macrozones.length; j += 1) {
    const a = macrozones[i].bbox;
    const b = macrozones[j].bbox;
    if (!a || !b) continue;

    const ix0 = Math.max(a.x0, b.x0);
    const iy0 = Math.max(a.y0, b.y0);
    const ix1 = Math.min(a.x1, b.x1);
    const iy1 = Math.min(a.y1, b.y1);
    const overlapW = ix1 - ix0 + 1;
    const overlapH = iy1 - iy0 + 1;

    if (overlapW > 0 && overlapH > 0) {
      const overlapArea = overlapW * overlapH;
      if (overlapArea > 1800) {
        warnings.push(
          `Sobreposicao relevante entre ${macrozones[i].id} e ${macrozones[j].id}: area=${overlapArea}`,
        );
      }
    }
  }
}

const minBand = data?.transitionPolicy?.minBandTiles;
if (!Number.isInteger(minBand) || minBand < 6) {
  errors.push(`transitionPolicy.minBandTiles invalido: ${minBand}`);
}

const requiredMainRoutes = data?.p1AcceptanceTargets?.requiredMainRoutes || 0;
const mainRoutes = data?.progressionRoutes?.main || [];
if (mainRoutes.length < requiredMainRoutes) {
  errors.push(`Rotas principais insuficientes: ${mainRoutes.length} < ${requiredMainRoutes}`);
}

const report = {
  blueprintFile: blueprintPath,
  checkedAt: new Date().toISOString(),
  dimensions: { width, height },
  seaBorderMinTiles: seaBorderMin,
  macrozoneCount: macrozones.length,
  mainRouteCount: mainRoutes.length,
  warnings,
  errors,
  pass: errors.length === 0,
};

fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (errors.length > 0) {
  console.error("[check:p1-blueprint] FAIL");
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log("[check:p1-blueprint] PASS");
console.log(JSON.stringify(report, null, 2));
