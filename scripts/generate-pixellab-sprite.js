const fs = require("fs");
const path = require("path");

const {
  resolveConfig,
  ensureApiKey,
  createJob,
  resolveGeneration,
  downloadImageToFile,
  writeBase64ToFile,
} = require("./pixellab-client");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
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

function readJsonSpec(specPath) {
  const absolutePath = path.resolve(specPath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  const json = JSON.parse(raw);

  const model = json?.pipeline?.model_primary || json?.pipeline?.model || "pixflux";
  const prompt = json?.production_prompts?.base_generation_prompt || json?.prompt || "";
  const negativePrompt = json?.production_prompts?.negative_prompt || json?.negativePrompt || "";
  const width = json?.sprite_sheet?.source_canvas?.width || 64;
  const height = json?.sprite_sheet?.source_canvas?.height || 64;
  const entityId = json?.id || "sprite_generated";

  return {
    model,
    prompt,
    negativePrompt,
    width,
    height,
    entityId,
    source: absolutePath,
  };
}

function ensureRequired(input) {
  if (!input.prompt || !input.prompt.trim()) {
    throw new Error("Missing prompt. Use --prompt or --spec with production_prompts.base_generation_prompt.");
  }
}

function outputPathFromArgs(args, entityId) {
  if (args.output) {
    return path.resolve(args.output);
  }
  const outDir = path.resolve(args.outDir || path.join("public", "assets", "sprites", "generated"));
  return path.join(outDir, `${entityId}.png`);
}

function buildMetaPath(imagePath) {
  return `${imagePath}.meta.json`;
}

async function main() {
  const args = parseArgs(process.argv);
  const spec = args.spec ? readJsonSpec(args.spec) : {};

  const entityId = args.entity || spec.entityId || "sprite_generated";
  const input = {
    model: args.model || spec.model || "pixflux",
    prompt: args.prompt || spec.prompt || "",
    negativePrompt: args.negative || spec.negativePrompt || "",
    width: args.width || spec.width || 64,
    height: args.height || spec.height || 64,
    seed: args.seed,
    inputImageUrl: args.inputImage,
  };

  ensureRequired(input);

  const config = resolveConfig({
    pollMs: args.pollMs ? Number(args.pollMs) : undefined,
    timeoutMs: args.timeoutMs ? Number(args.timeoutMs) : undefined,
  });

  ensureApiKey(config);

  const targetImagePath = outputPathFromArgs(args, entityId);
  const targetMetaPath = buildMetaPath(targetImagePath);

  console.log(`[pixellab] model=${input.model} entity=${entityId}`);
  console.log(`[pixellab] createPath=${config.createPath} statusPath=${config.statusPath}`);

  const createResponse = await createJob(config, input);
  const result = await resolveGeneration(config, createResponse);

  if (result.imageBase64) {
    writeBase64ToFile(result.imageBase64, targetImagePath);
  } else if (result.imageUrl) {
    await downloadImageToFile(result.imageUrl, targetImagePath);
  } else {
    throw new Error("Generation finished without image data (url/base64).");
  }

  const meta = {
    entityId,
    generatedAt: new Date().toISOString(),
    model: input.model,
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    sourceSpec: spec.source || null,
    outputImage: targetImagePath,
    pixelLab: {
      baseUrl: config.baseUrl,
      createPath: config.createPath,
      statusPath: config.statusPath,
      jobId: result.jobId || null,
      finalStatus: result.status,
    },
  };

  fs.mkdirSync(path.dirname(targetMetaPath), { recursive: true });
  fs.writeFileSync(targetMetaPath, JSON.stringify(meta, null, 2));

  console.log(`[pixellab] generated ${targetImagePath}`);
  console.log(`[pixellab] generated ${targetMetaPath}`);
}

main().catch((error) => {
  console.error(`[pixellab] error: ${error.message}`);
  process.exitCode = 1;
});
