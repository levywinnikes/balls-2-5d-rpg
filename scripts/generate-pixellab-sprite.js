const fs = require("fs");
const path = require("path");

const {
  resolveConfig,
  ensureApiKey,
  waitForJob,
  createCharacter,
  getCharacter,
  animateCharacter,
  getBalance,
  downloadToFile,
  writeBase64ToFile,
} = require("./pixellab-client");

// ─────────────────────────────────────────────
// ANIMATION TEMPLATES
// Consistency strategy:
//   - template mode: uses stored skeleton on same character_id → max consistency, 1 gen/direction
//   - v3 mode (action_description): free text, 4-16 frames — used for death (no standard template)
// ─────────────────────────────────────────────
const ANIMATION_PLAN = [
  // template mode (skeleton-based, guaranteed consistent with stored character)
  {
    name: "walk",
    mode: "template",
    templateId: "walking-4-frames",
    directions: ["south", "north", "east", "west"],
  },
  {
    name: "idle",
    mode: "template",
    templateId: "breathing-idle",
    directions: ["south", "north", "east", "west"],
  },
  {
    name: "attack",
    mode: "template",
    templateId: "lead-jab",
    directions: ["south", "north", "east", "west"],
  },
  // v3 mode — no official template for death; frame_count gives sequential frames
  {
    name: "death",
    mode: "v3",
    actionDescription: "dying, collapsing to the ground, death fall",
    frameCount: 8,
    directions: ["south"],
  },
];

// ─────────────────────────────────────────────
// TIER FRAME PROFILES — spec validation only (not sent to API)
// ─────────────────────────────────────────────
const TIER_FRAME_PROFILES = {
  trash: {
    idle: { min: 2, max: 6, target: 4 },
    walk: { min: 4, max: 8, target: 6 },
    attack: { min: 4, max: 8, target: 6 },
    death: { min: 4, max: 8, target: 6 },
  },
  elite: {
    idle: { min: 4, max: 8, target: 6 },
    walk: { min: 6, max: 10, target: 8 },
    attack: { min: 6, max: 10, target: 8 },
    death: { min: 6, max: 10, target: 8 },
  },
  boss: {
    idle: { min: 6, max: 12, target: 8 },
    walk: { min: 8, max: 12, target: 8 },
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
    const candidate = asPositiveInt(
      frameTargets?.[state],
      `animation_profile.frame_targets.${state}`,
      errors,
    );
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
  const prompt = asNonEmptyString(
    spec?.production_prompts?.base_generation_prompt,
    "production_prompts.base_generation_prompt",
    errors,
  );

  const width = asPositiveInt(
    spec?.sprite_sheet?.source_canvas?.width,
    "sprite_sheet.source_canvas.width",
    errors,
  );
  const height = asPositiveInt(
    spec?.sprite_sheet?.source_canvas?.height,
    "sprite_sheet.source_canvas.height",
    errors,
  );

  const tier = asNonEmptyString(
    spec?.animation_profile?.tier,
    "animation_profile.tier",
    errors,
  ).toLowerCase();
  if (tier && !TIER_FRAME_PROFILES[tier]) {
    errors.push("animation_profile.tier must be one of: trash, elite, boss.");
  }

  const frameTargets = TIER_FRAME_PROFILES[tier]
    ? validateFrameTargetsByTier(
        spec?.animation_profile?.frame_targets,
        tier,
        errors,
      )
    : null;

  const deathDirection = asNonEmptyString(
    spec?.sprite_sheet?.directions?.death_shared_direction,
    "sprite_sheet.directions.death_shared_direction",
    errors,
  ).toLowerCase();

  const overrideReason =
    typeof spec?.sprite_sheet?.directions?.death_direction_override_reason ===
    "string"
      ? spec.sprite_sheet.directions.death_direction_override_reason.trim()
      : "";

  if (deathDirection !== "south" && !overrideReason) {
    errors.push(
      "sprite_sheet.directions.death_direction_override_reason is required when death_shared_direction is not south.",
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid sprite spec '${specPath}':\n- ${errors.join("\n- ")}`,
    );
  }

  return {
    entityId,
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

function ensureRequired(spec) {
  if (!spec.prompt || !spec.prompt.trim()) {
    throw new Error(
      "Missing prompt. Use --prompt or --spec with production_prompts.base_generation_prompt.",
    );
  }
}

// ─────────────────────────────────────────────
// FRAME EXTRACTION
// Handles both URL-based and base64-based last_response from background jobs.
// ─────────────────────────────────────────────
function extractFrames(lastResponse) {
  if (!lastResponse) return [];

  const raw =
    lastResponse.images ||
    lastResponse.frames ||
    lastResponse.data ||
    lastResponse.results ||
    [];

  if (!Array.isArray(raw) || raw.length === 0) {
    console.warn(
      `[pixellab] ⚠️  extractFrames: no frames array found. Response keys: ${Object.keys(lastResponse).join(", ")}`,
    );
    return [];
  }

  return raw
    .map((f) => {
      if (!f) return null;
      if (typeof f === "string") {
        return f.startsWith("http")
          ? { type: "url", value: f }
          : { type: "base64", value: f };
      }
      if (f.url) return { type: "url", value: f.url };
      if (f.image?.base64) return { type: "base64", value: f.image.base64 };
      if (f.base64) return { type: "base64", value: f.base64 };
      return null;
    })
    .filter(Boolean);
}

async function saveFrameToPath(frame, filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (frame.type === "url") {
    await downloadToFile(frame.value, filePath);
  } else {
    writeBase64ToFile(frame.value, filePath);
  }
}

// ─────────────────────────────────────────────
// PHASE A — Create character (persistent character_id)
// ─────────────────────────────────────────────
async function phaseA(config, spec, outBaseDir) {
  console.log("\n[pixellab] ═══ Phase A — Create Character ═══");
  console.log(`[pixellab]   entity      : ${spec.entityId}`);
  console.log(`[pixellab]   description : ${spec.prompt}`);
  console.log(`[pixellab]   size        : ${spec.width}×${spec.height}`);

  const view = spec.rawSpec?.production_prompts?.view || "low top-down";

  const { characterId, backgroundJobId } = await createCharacter(config, {
    description: spec.prompt,
    image_size: { width: spec.width, height: spec.height },
    view,
    outline: "single color black outline",
    shading: "basic shading",
    detail: "medium detail",
  });

  console.log(`[pixellab]   character_id : ${characterId}`);
  console.log(`[pixellab]   job_id       : ${backgroundJobId}`);

  const creationJob = await waitForJob(
    config,
    backgroundJobId,
    "character creation",
  );
  process.stdout.write("\n");
  console.log(`[pixellab] ✓ Character creation job completed`);

  // Fetch full character details to get rotation images
  const character = await getCharacter(config, characterId);
  console.log(
    `[pixellab]   Character response keys: ${Object.keys(character).join(", ")}`,
  );

  // Extract rotation images — field name may vary (rotation_urls, images, rotations)
  const rotationData =
    character.rotation_urls ||
    character.images ||
    character.rotations ||
    creationJob.last_response?.rotation_urls ||
    {};

  const charDir = path.join(outBaseDir, spec.entityId, "character_rotations");
  fs.mkdirSync(charDir, { recursive: true });

  const savedRotations = {};
  for (const [dir, urlOrData] of Object.entries(rotationData)) {
    if (!urlOrData) continue;
    const imgPath = path.join(charDir, `${dir}.png`);
    if (typeof urlOrData === "string" && urlOrData.startsWith("http")) {
      await downloadToFile(urlOrData, imgPath);
    } else if (typeof urlOrData === "string") {
      writeBase64ToFile(urlOrData, imgPath);
    } else if (urlOrData.base64) {
      writeBase64ToFile(urlOrData.base64, imgPath);
    } else {
      console.warn(
        `[pixellab] ⚠️  Unknown format for rotation '${dir}': ${JSON.stringify(urlOrData).slice(0, 80)}`,
      );
      continue;
    }
    savedRotations[dir] = imgPath;
    console.log(`[pixellab] ✓ rotation saved: ${dir} → ${imgPath}`);
  }

  if (Object.keys(savedRotations).length === 0) {
    console.warn(
      "[pixellab] ⚠️  No rotation images extracted. Raw last_response (first 600 chars):\n" +
        JSON.stringify(creationJob.last_response, null, 2).slice(0, 600),
    );
  }

  // Persist character_id to sidecar so phase=animate can resume later
  const sidecar = {
    characterId,
    createdAt: new Date().toISOString(),
    entityId: spec.entityId,
    description: spec.prompt,
    view,
    imageSize: { width: spec.width, height: spec.height },
    rotations: savedRotations,
  };
  const sidecarPath = path.join(outBaseDir, spec.entityId, "character.json");
  fs.mkdirSync(path.dirname(sidecarPath), { recursive: true });
  fs.writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2));
  console.log(`[pixellab] ✓ character sidecar saved → ${sidecarPath}`);

  return { characterId, sidecarPath, rotations: savedRotations };
}

// ─────────────────────────────────────────────
// PHASE B — Animate (one ANIMATION_PLAN entry)
// ─────────────────────────────────────────────
async function phaseBAnimation(
  config,
  spec,
  characterId,
  animEntry,
  outBaseDir,
) {
  const { name, mode, templateId, actionDescription, frameCount, directions } =
    animEntry;
  console.log(`\n[pixellab] ─── Animation: ${name} (mode: ${mode}) ───`);

  const animArgs = {
    character_id: characterId,
    animation_name: name,
    mode,
    directions,
  };
  if (mode === "template") {
    animArgs.template_animation_id = templateId;
  } else {
    animArgs.action_description = actionDescription;
    if (frameCount) animArgs.frame_count = frameCount;
  }

  const { backgroundJobIds, directions: returnedDirs } = await animateCharacter(
    config,
    animArgs,
  );
  console.log(`[pixellab]   Submitted ${backgroundJobIds.length} job(s)`);

  for (let i = 0; i < backgroundJobIds.length; i++) {
    const jobId = backgroundJobIds[i];
    const dir = returnedDirs?.[i] || directions[i] || "south";

    const job = await waitForJob(config, jobId, `${name}/${dir}`);
    process.stdout.write("\n");

    const frames = extractFrames(job.last_response);
    if (frames.length === 0) {
      console.warn(
        `[pixellab] ⚠️  No frames found for ${name}/${dir}. Skipping.`,
      );
      if (job.last_response) {
        console.warn("  Raw last_response (first 600 chars):");
        console.warn(JSON.stringify(job.last_response, null, 2).slice(0, 600));
      }
      continue;
    }

    const frameDir = path.join(outBaseDir, spec.entityId, `${name}_${dir}`);
    fs.mkdirSync(frameDir, { recursive: true });

    for (let fi = 0; fi < frames.length; fi++) {
      const framePath = path.join(
        frameDir,
        `frame_${String(fi).padStart(2, "0")}.png`,
      );
      await saveFrameToPath(frames[fi], framePath);
    }

    const meta = {
      animation: name,
      direction: dir,
      mode,
      templateId: templateId || null,
      actionDescription: actionDescription || null,
      frameCount: frames.length,
      generatedAt: new Date().toISOString(),
      characterId,
    };
    fs.writeFileSync(
      path.join(frameDir, "meta.json"),
      JSON.stringify(meta, null, 2),
    );
    console.log(
      `[pixellab] ✓ ${name}/${dir}: ${frames.length} frames → ${frameDir}`,
    );
  }
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

  let spec;
  if (args.spec) {
    spec = readJsonSpec(args.spec);
  } else {
    spec = {
      entityId: args.entity || "sprite_generated",
      prompt: args.prompt || "",
      negativePrompt: args["negative-prompt"] || "",
      width: Number(args.width || 64),
      height: Number(args.height || 64),
      tier: args.tier || null,
      tierProfile: null,
      deathDirection: "south",
      rawSpec: {},
      source: null,
    };
    if (spec.tier) spec.tierProfile = TIER_FRAME_PROFILES[spec.tier] || null;
  }

  ensureRequired(spec);

  const config = resolveConfig();
  ensureApiKey(config);

  const outBaseDir = path.resolve(
    args.outDir || path.join("public", "assets", "sprites", "generated"),
  );
  const phase = args.phase || "all";

  let characterId = args["character-id"] || null;

  // ── Phase A ────────────────────────────────
  if (!characterId && (phase === "all" || phase === "character")) {
    const result = await phaseA(config, spec, outBaseDir);
    characterId = result.characterId;
  }

  // ── Load character_id from sidecar if needed ─
  if (!characterId) {
    const sidecarPath = path.join(outBaseDir, spec.entityId, "character.json");
    if (fs.existsSync(sidecarPath)) {
      characterId = JSON.parse(
        fs.readFileSync(sidecarPath, "utf8"),
      ).characterId;
      console.log(`[pixellab] Loaded characterId from sidecar: ${characterId}`);
    } else {
      throw new Error(
        "--character-id required for phase=animate (or run --phase character first).",
      );
    }
  }

  // ── Phase B ────────────────────────────────
  if (phase === "all" || phase === "animate") {
    const animFilter = args.anim
      ? args.anim.split(",").map((s) => s.trim())
      : null;
    const plan = animFilter
      ? ANIMATION_PLAN.filter((a) => animFilter.includes(a.name))
      : ANIMATION_PLAN;

    if (plan.length === 0) {
      throw new Error(
        `No animations matched filter '${args.anim}'. Available: ${ANIMATION_PLAN.map((a) => a.name).join(", ")}`,
      );
    }

    for (const animEntry of plan) {
      await phaseBAnimation(config, spec, characterId, animEntry, outBaseDir);
    }

    console.log(
      `\n[pixellab] ✓ All animations complete. Character ID: ${characterId}`,
    );
  }
}

main().catch((error) => {
  console.error(`\n[pixellab] ERROR: ${error.message}`);
  if (process.env.DEBUG) console.error(error.stack);
  process.exitCode = 1;
});
