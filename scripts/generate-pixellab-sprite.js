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

const TIER_FRAME_PROFILES = {
  trash: {
    idle: { min: 4, max: 4, target: 4 },
    walk: { min: 6, max: 6, target: 6 },
    attack: { min: 6, max: 6, target: 6 },
    death: { min: 4, max: 6, target: 6 },
  },
  elite: {
    idle: { min: 4, max: 4, target: 4 },
    walk: { min: 6, max: 6, target: 6 },
    attack: { min: 6, max: 8, target: 7 },
    death: { min: 6, max: 8, target: 7 },
  },
  boss: {
    idle: { min: 4, max: 6, target: 4 },
    walk: { min: 6, max: 8, target: 6 },
    attack: { min: 8, max: 12, target: 8 },
    death: { min: 8, max: 12, target: 8 },
  },
};

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

function asPositiveInt(value, fieldName, errors) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    errors.push(`${fieldName} must be a positive integer.`);
    return null;
  }
  return n;
}

function asNonEmptyString(value, fieldName, errors) {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${fieldName} must be a non-empty string.`);
    return "";
  }
  return value.trim();
}

function validateFrameTargetsByTier(frameTargets, tier, errors) {
  const profile = TIER_FRAME_PROFILES[tier];
  const states = ["idle", "walk", "attack", "death"];
  const normalized = {};

  states.forEach((state) => {
    const expected = profile[state];
    const candidate = asPositiveInt(frameTargets?.[state], `animation_profile.frame_targets.${state}`, errors);
    if (candidate == null) {
      return;
    }
    if (candidate < expected.min || candidate > expected.max) {
      errors.push(
        `animation_profile.frame_targets.${state}=${candidate} is outside tier '${tier}' range ${expected.min}-${expected.max}.`,
      );
      return;
    }
    normalized[state] = candidate;
  });

  return normalized;
}

function validateSpecSchema(spec, specPath) {
  const errors = [];

  const entityId = asNonEmptyString(spec?.id, "id", errors);
  const model = asNonEmptyString(spec?.pipeline?.model_primary, "pipeline.model_primary", errors);
  const prompt = asNonEmptyString(
    spec?.production_prompts?.base_generation_prompt,
    "production_prompts.base_generation_prompt",
    errors,
  );

  const width = asPositiveInt(spec?.sprite_sheet?.source_canvas?.width, "sprite_sheet.source_canvas.width", errors);
  const height = asPositiveInt(spec?.sprite_sheet?.source_canvas?.height, "sprite_sheet.source_canvas.height", errors);

  const tier = asNonEmptyString(spec?.animation_profile?.tier, "animation_profile.tier", errors).toLowerCase();
  if (tier && !TIER_FRAME_PROFILES[tier]) {
    errors.push("animation_profile.tier must be one of: trash, elite, boss.");
  }

  const frameTargets = TIER_FRAME_PROFILES[tier]
    ? validateFrameTargetsByTier(spec?.animation_profile?.frame_targets, tier, errors)
    : null;

  const deathDirection = asNonEmptyString(
    spec?.sprite_sheet?.directions?.death_shared_direction,
    "sprite_sheet.directions.death_shared_direction",
    errors,
  ).toLowerCase();

  const overrideReason = typeof spec?.sprite_sheet?.directions?.death_direction_override_reason === "string"
    ? spec.sprite_sheet.directions.death_direction_override_reason.trim()
    : "";

  if (deathDirection !== "south" && !overrideReason) {
    errors.push("sprite_sheet.directions.death_direction_override_reason is required when death_shared_direction is not south.");
  }

  if (errors.length > 0) {
    throw new Error(`Invalid sprite spec '${specPath}':\n- ${errors.join("\n- ")}`);
  }

  return {
    entityId,
    model,
    prompt,
    width,
    height,
    tier,
    frameTargets,
    tierProfile: TIER_FRAME_PROFILES[tier],
    deathDirection,
    deathDirectionOverrideReason: overrideReason,
  };
}

function readJsonSpec(specPath) {
  const absolutePath = path.resolve(specPath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  const json = JSON.parse(raw);
  const validated = validateSpecSchema(json, absolutePath);

  const negativePrompt = json?.production_prompts?.negative_prompt || "";

  return {
    model: validated.model,
    prompt: validated.prompt,
    negativePrompt,
    width: validated.width,
    height: validated.height,
    entityId: validated.entityId,
    tier: validated.tier,
    frameTargets: validated.frameTargets,
    tierProfile: validated.tierProfile,
    deathDirection: validated.deathDirection,
    deathDirectionOverrideReason: validated.deathDirectionOverrideReason,
    rawSpec: json,
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
    tier: spec.tier || null,
    animationProfile: spec.tier
      ? {
          tier: spec.tier,
          frameTargets: spec.frameTargets,
          allowedRanges: spec.tierProfile,
          deathSharedDirection: spec.deathDirection,
          deathDirectionOverrideReason: spec.deathDirectionOverrideReason,
        }
      : null,
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
