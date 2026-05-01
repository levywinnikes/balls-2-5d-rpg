const fs = require("fs");
const path = require("path");

const {
  resolveConfig,
  ensureApiKey,
  generateImage,
  animateWithText,
  getBalance,
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

function outputPathFromArgs(args, entityId, suffix) {
  if (args.output && !suffix) {
    return path.resolve(args.output);
  }
  const outDir = path.resolve(args.outDir || path.join("public", "assets", "sprites", "generated"));
  const filename = suffix ? `${entityId}_${suffix}.png` : `${entityId}.png`;
  return path.join(outDir, filename);
}

function buildMetaPath(imagePath) {
  return `${imagePath}.meta.json`;
}

// Phase A: generate reference image (static pose)
async function generateReferenceImage(config, spec, args) {
  const targetPath = outputPathFromArgs(args, spec.entityId, "reference");

  console.log(`[pixellab] Phase A — generating reference image`);
  console.log(`[pixellab]   entity  : ${spec.entityId}`);
  console.log(`[pixellab]   prompt  : ${spec.prompt}`);
  console.log(`[pixellab]   size    : ${spec.width}x${spec.height}`);
  console.log(`[pixellab]   output  : ${targetPath}`);

  const result = await generateImage(config, {
    description: spec.prompt,
    image_size: { width: spec.width, height: spec.height },
    no_background: true,
    negative_description: spec.negativePrompt || undefined,
    view: spec.rawSpec?.production_prompts?.view || undefined,
    direction: spec.rawSpec?.production_prompts?.direction || undefined,
    seed: args.seed ? Number(args.seed) : undefined,
  });

  writeBase64ToFile(result.base64, targetPath);

  const meta = {
    phase: "reference",
    entityId: spec.entityId,
    generatedAt: new Date().toISOString(),
    prompt: spec.prompt,
    negativePrompt: spec.negativePrompt || null,
    imageSize: { width: spec.width, height: spec.height },
    sourceSpec: spec.source || null,
    tier: spec.tier || null,
    usdCost: result.usdCost,
    outputImage: targetPath,
    endpoint: `${config.baseUrl}/v1/generate-image-pixflux`,
  };

  const metaPath = buildMetaPath(targetPath);
  fs.mkdirSync(path.dirname(metaPath), { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  const cost = result.usdCost != null ? `$${result.usdCost.toFixed(4)}` : "unknown";
  console.log(`[pixellab] ✓ reference image saved → ${targetPath}`);
  console.log(`[pixellab] ✓ meta saved            → ${metaPath}`);
  console.log(`[pixellab] ✓ cost                  → ${cost}`);

  return { imagePath: targetPath, base64: result.base64, usdCost: result.usdCost };
}

// Phase B: animate reference image for one action×direction combo
async function generateAnimation(config, spec, referenceBase64, action, direction, args) {
  const suffix = `${action}_${direction}`;
  const outDir = path.resolve(args.outDir || path.join("public", "assets", "sprites", "generated"));
  const frameDir = path.join(outDir, spec.entityId, suffix);
  fs.mkdirSync(frameDir, { recursive: true });

  const nFrames = spec.frameTargets?.[action] || 4;
  const view = spec.rawSpec?.production_prompts?.view || "high top-down";

  console.log(`[pixellab] Phase B — ${action} / ${direction} (${nFrames} frames)`);

  const result = await animateWithText(config, {
    description: spec.rawSpec?.production_prompts?.animation_description || spec.prompt,
    action,
    reference_image: { type: "base64", base64: referenceBase64 },
    view,
    direction,
    n_frames: nFrames,
    seed: args.seed ? Number(args.seed) : undefined,
  });

  const savedPaths = result.frames.map((frameBase64, i) => {
    const framePath = path.join(frameDir, `frame_${String(i).padStart(2, "0")}.png`);
    writeBase64ToFile(frameBase64, framePath);
    return framePath;
  });

  const meta = {
    phase: "animation",
    entityId: spec.entityId,
    action,
    direction,
    nFrames: result.frames.length,
    generatedAt: new Date().toISOString(),
    usdCost: result.usdCost,
    frames: savedPaths,
    endpoint: `${config.baseUrl}/v1/animate-with-text`,
  };

  const metaPath = path.join(frameDir, "meta.json");
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  const cost = result.usdCost != null ? `$${result.usdCost.toFixed(4)}` : "unknown";
  console.log(`[pixellab] ✓ ${suffix}: ${result.frames.length} frames saved → ${frameDir} (${cost})`);

  return { savedPaths, usdCost: result.usdCost };
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.balance) {
    const config = resolveConfig();
    ensureApiKey(config);
    const { usd } = await getBalance(config);
    console.log(`[pixellab] Account balance: $${usd.toFixed(4)} USD`);
    return;
  }

  const spec = args.spec ? readJsonSpec(args.spec) : {};

  const entityId = args.entity || spec.entityId || "sprite_generated";
  if (!spec.entityId) {
    spec.entityId = entityId;
  }
  if (!spec.prompt && args.prompt) {
    spec.prompt = args.prompt;
  }

  ensureRequired(spec);

  const config = resolveConfig();
  ensureApiKey(config);

  const phase = args.phase || "reference";

  if (phase === "reference" || phase === "all") {
    const ref = await generateReferenceImage(config, spec, args);

    if (phase === "all") {
      const directions = ["south", "north", "east", "west"];
      const actions = ["walk", "attack", "idle"];
      let totalCost = ref.usdCost || 0;

      for (const action of actions) {
        for (const dir of directions) {
          const anim = await generateAnimation(config, spec, ref.base64, action, dir, args);
          totalCost += anim.usdCost || 0;
        }
      }
      // death uses only south (or override)
      const deathDir = spec.deathDirection || "south";
      const deathAnim = await generateAnimation(config, spec, ref.base64, "death", deathDir, args);
      totalCost += deathAnim.usdCost || 0;

      console.log(`\n[pixellab] ✓ All phases complete. Estimated total cost: $${totalCost.toFixed(4)} USD`);
    }
  } else if (phase === "animate") {
    // Animate only — requires --ref-image and --action + --direction
    if (!args["ref-image"]) {
      throw new Error("--ref-image <path> is required for phase=animate");
    }
    if (!args.action) {
      throw new Error("--action <action> is required for phase=animate");
    }
    const refRaw = fs.readFileSync(path.resolve(args["ref-image"]));
    const refBase64 = `data:image/png;base64,${refRaw.toString("base64")}`;
    const directions = args.direction ? [args.direction] : ["south", "north", "east", "west"];
    for (const dir of directions) {
      await generateAnimation(config, spec, refBase64, args.action, dir, args);
    }
  } else {
    throw new Error(`Unknown --phase value: ${phase}. Use: reference | animate | all`);
  }
}

main().catch((error) => {
  console.error(`[pixellab] error: ${error.message}`);
  process.exitCode = 1;
});
