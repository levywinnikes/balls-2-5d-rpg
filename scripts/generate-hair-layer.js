const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");
const {
  resolveConfig,
  ensureApiKey,
  waitForJob,
  createCharacterState,
  getCharacter,
  downloadToFile,
  writeBase64ToFile,
} = require("./pixellab-client");

const DIRECTIONS = ["south", "north", "east", "west"];
const GENERATED_ROOT = path.join(
  process.cwd(),
  "public",
  "assets",
  "sprites",
  "generated",
);
const COLOR_DIFF_THRESHOLD = 42;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function readHairSpec(specPath) {
  const absolutePath = path.resolve(specPath);
  const raw = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  const editDescription = raw?.production_prompts?.edit_description?.trim();
  const sourceEntity = raw?.pipeline?.source_entity || "hero_base";
  const sourceCharacterId = raw?.pipeline?.source_character_id || null;
  const entityId = raw?.id;

  if (!entityId) throw new Error("Spec missing id.");
  if (!editDescription) {
    throw new Error("Spec missing production_prompts.edit_description.");
  }

  return {
    absolutePath,
    entityId,
    editDescription,
    sourceEntity,
    sourceCharacterId,
    raw,
  };
}

function loadSourceCharacterId(spec) {
  if (spec.sourceCharacterId) return spec.sourceCharacterId;

  const sidecarPath = path.join(
    GENERATED_ROOT,
    spec.sourceEntity,
    "character.json",
  );
  if (!fs.existsSync(sidecarPath)) {
    throw new Error(
      `Missing source sidecar ${sidecarPath}. Generate ${spec.sourceEntity} first.`,
    );
  }
  const sidecar = JSON.parse(fs.readFileSync(sidecarPath, "utf8"));
  if (!sidecar.characterId) {
    throw new Error(`Sidecar ${sidecarPath} has no characterId.`);
  }
  return sidecar.characterId;
}

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function writePng(png, filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

function colorDistance(a, b) {
  return (
    Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
  );
}

function pixelAt(data, width, x, y) {
  const idx = (width * y + x) << 2;
  return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
}

function setPixelTransparent(data, width, x, y) {
  const idx = (width * y + x) << 2;
  data[idx] = 0;
  data[idx + 1] = 0;
  data[idx + 2] = 0;
  data[idx + 3] = 0;
}

function bboxFromPng(png) {
  let minX = Infinity;
  let maxX = -1;
  let minY = Infinity;
  let maxY = -1;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const px = pixelAt(png.data, png.width, x, y);
      if (px[3] < 20) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  return { minX, maxX, minY, maxY };
}

function headMaxY(basePng) {
  const bb = bboxFromPng(basePng);
  const bodyHeight = bb.maxY - bb.minY;
  return bb.minY + Math.round(bodyHeight * 0.34);
}

function extractHairLayer(basePng, variantPng) {
  if (basePng.width !== variantPng.width || basePng.height !== variantPng.height) {
    throw new Error(
      `Canvas size mismatch: base ${basePng.width}x${basePng.height}, variant ${variantPng.width}x${variantPng.height}`,
    );
  }

  const maxHeadY = headMaxY(basePng);
  const out = new PNG({ width: basePng.width, height: basePng.height });
  let kept = 0;

  for (let y = 0; y < basePng.height; y += 1) {
    for (let x = 0; x < basePng.width; x += 1) {
      const idx = (basePng.width * y + x) << 2;
      const basePx = pixelAt(basePng.data, basePng.width, x, y);
      const variantPx = pixelAt(variantPng.data, variantPng.width, x, y);

      if (y > maxHeadY || variantPx[3] < 20) {
        setPixelTransparent(out.data, basePng.width, x, y);
        continue;
      }

      const isNewPixel = basePx[3] < 20;
      const isChangedPixel =
        basePx[3] >= 20 &&
        colorDistance(basePx, variantPx) >= COLOR_DIFF_THRESHOLD;

      if (isNewPixel || isChangedPixel) {
        out.data[idx] = variantPx[0];
        out.data[idx + 1] = variantPx[1];
        out.data[idx + 2] = variantPx[2];
        out.data[idx + 3] = variantPx[3];
        kept += 1;
      } else {
        setPixelTransparent(out.data, basePng.width, x, y);
      }
    }
  }

  return { png: out, keptPixels: kept, maxHeadY };
}

async function saveRotationImage(urlOrData, targetPath) {
  if (typeof urlOrData === "string" && urlOrData.startsWith("http")) {
    await downloadToFile(urlOrData, targetPath);
    return;
  }
  if (typeof urlOrData === "string") {
    writeBase64ToFile(urlOrData, targetPath);
    return;
  }
  if (urlOrData?.base64) {
    writeBase64ToFile(urlOrData.base64, targetPath);
  }
}

async function downloadRotations(character, targetDir) {
  const rotationData =
    character.rotation_urls || character.images || character.rotations || {};
  const saved = {};

  for (const dir of DIRECTIONS) {
    const source = rotationData[dir];
    if (!source) {
      console.warn(`[hair] Missing rotation '${dir}' in character response`);
      continue;
    }
    const imgPath = path.join(targetDir, `${dir}.png`);
    await saveRotationImage(source, imgPath);
    saved[dir] = imgPath;
    console.log(`[hair] ✓ downloaded ${dir} → ${imgPath}`);
  }

  return saved;
}

async function phaseGenerateState(config, spec, sourceCharacterId, stateDir) {
  console.log("\n[hair] ═══ Phase A — create-character-state ═══");
  console.log(`[hair]   source character : ${sourceCharacterId}`);
  console.log(`[hair]   edit description : ${spec.editDescription}`);

  const { characterId, backgroundJobId } = await createCharacterState(config, {
    character_id: sourceCharacterId,
    edit_description: spec.editDescription,
    no_background: true,
    use_color_palette_from_reference: true,
  });

  console.log(`[hair]   state character  : ${characterId}`);
  console.log(`[hair]   job id           : ${backgroundJobId}`);

  await waitForJob(config, backgroundJobId, "character state");
  process.stdout.write("\n");

  const character = await getCharacter(config, characterId);
  fs.mkdirSync(stateDir, { recursive: true });
  const savedRotations = await downloadRotations(
    character,
    path.join(stateDir, "character_rotations"),
  );

  const sidecar = {
    characterId,
    sourceCharacterId,
    createdAt: new Date().toISOString(),
    entityId: spec.entityId,
    editDescription: spec.editDescription,
    rotations: savedRotations,
  };
  fs.writeFileSync(
    path.join(stateDir, "character.json"),
    JSON.stringify(sidecar, null, 2),
  );

  return { characterId, savedRotations };
}

function phaseExtractDiff(spec, sourceEntity, stateDir, outDir) {
  console.log("\n[hair] ═══ Phase B — pixel diff extract ═══");

  const baseRotDir = path.join(
    GENERATED_ROOT,
    sourceEntity,
    "character_rotations",
  );
  const variantRotDir = path.join(stateDir, "character_rotations");
  const outRotDir = path.join(outDir, "character_rotations");
  fs.mkdirSync(outRotDir, { recursive: true });

  const summary = {};

  for (const dir of DIRECTIONS) {
    const basePath = path.join(baseRotDir, `${dir}.png`);
    const variantPath = path.join(variantRotDir, `${dir}.png`);
    const outPath = path.join(outRotDir, `${dir}.png`);

    if (!fs.existsSync(basePath)) {
      throw new Error(`Missing base rotation: ${basePath}`);
    }
    if (!fs.existsSync(variantPath)) {
      throw new Error(`Missing state rotation: ${variantPath}`);
    }

    const basePng = readPng(basePath);
    const variantPng = readPng(variantPath);
    const { png, keptPixels, maxHeadY } = extractHairLayer(basePng, variantPng);
    writePng(png, outPath);
    summary[dir] = keptPixels;
    console.log(
      `[hair] ✓ ${dir}: ${keptPixels} hair pixels (head y<=${maxHeadY}) → ${outPath}`,
    );
  }

  const sidecar = {
    entityId: spec.entityId,
    category: "hair",
    pipeline: {
      method: "create-character-state",
      extract: "pixel-diff",
      sourceEntity,
    },
    editDescription: spec.editDescription,
    extractedAt: new Date().toISOString(),
    keptPixels: summary,
    spec: spec.absolutePath,
  };
  fs.writeFileSync(
    path.join(outDir, "character.json"),
    JSON.stringify(sidecar, null, 2),
  );

  return summary;
}

async function main() {
  const args = parseArgs(process.argv);
  const specPath =
    args.spec || "docs/sprites/hero/hair-classic.spec.json";
  const spec = readHairSpec(specPath);
  const sourceCharacterId = loadSourceCharacterId(spec);
  const outDir = path.join(GENERATED_ROOT, spec.entityId);
  const stateDir = path.join(outDir, "_state");
  const skipGenerate = args["skip-generate"] === "true";
  const extractOnly = args["extract-only"] === "true";

  if (!extractOnly) {
    const config = resolveConfig();
    ensureApiKey(config);
    await phaseGenerateState(config, spec, sourceCharacterId, stateDir);
  } else if (!fs.existsSync(path.join(stateDir, "character.json"))) {
    throw new Error(
      `No cached state in ${stateDir}. Run without --extract-only first.`,
    );
  }

  if (skipGenerate && !extractOnly) {
    console.log("[hair] --skip-generate ignored unless combined with --extract-only");
  }

  const summary = phaseExtractDiff(
    spec,
    spec.sourceEntity,
    stateDir,
    outDir,
  );
  const total = Object.values(summary).reduce((a, b) => a + b, 0);
  console.log(`\n[hair] ✓ Done. Total hair pixels kept: ${total}`);
  console.log(`[hair]   Output: ${outDir}`);
}

main().catch((error) => {
  console.error(`\n[hair] ERROR: ${error.message}`);
  if (process.env.DEBUG) console.error(error.stack);
  process.exitCode = 1;
});
