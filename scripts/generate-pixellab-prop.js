const fs = require("fs");
const path = require("path");
const {
  resolveConfig,
  ensureApiKey,
  waitForJob,
  createImagePixflux,
  animateWithTextV3,
  readPngAsBase64Image,
  writeBase64ToFile,
  downloadToFile,
} = require("./pixellab-client");

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

function readPropSpec(specPath) {
  const absolutePath = path.resolve(specPath);
  const raw = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  const propId = raw.id;
  if (!propId) throw new Error("Spec missing id.");
  if (!raw.production_prompts?.base_description) {
    throw new Error("Spec missing production_prompts.base_description.");
  }
  const animations = Array.isArray(raw.animations) ? raw.animations : [];
  if (animations.length === 0) {
    throw new Error("Spec must define at least one animation.");
  }

  animations.forEach((anim) => {
    const count = Number(anim.frame_count);
    if (!Number.isInteger(count) || count < 4 || count > 16 || count % 2 !== 0) {
      throw new Error(
        `Animation '${anim.name}' frame_count must be an even integer between 4 and 16.`,
      );
    }
    if (!anim.action?.trim()) {
      throw new Error(`Animation '${anim.name}' missing action.`);
    }
  });

  const width = raw.canvas?.width || 32;
  const height = raw.canvas?.height || 32;
  const outDir = path.resolve(
    raw.output?.dir ||
      path.join("public", "assets", "sprites", "generated", propId),
  );
  const direction = raw.pipeline?.direction || "south";

  return {
    absolutePath,
    propId,
    description: raw.production_prompts.base_description.trim(),
    negative: raw.production_prompts.negative_prompt?.trim() || "",
    width,
    height,
    outDir,
    direction,
    animations,
    style: raw.style || {},
    pipeline: raw.pipeline || {},
    raw,
  };
}

function extractImagePayload(jobOrResponse) {
  const last = jobOrResponse?.last_response || jobOrResponse;
  const candidates = [
    last?.image?.base64,
    last?.images?.[0]?.base64,
    last?.images?.[0],
    last?.image,
    jobOrResponse?.image?.base64,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      return { type: "base64", value: candidate };
    }
  }

  const url =
    last?.image?.url ||
    last?.images?.[0]?.url ||
    last?.image_url ||
    jobOrResponse?.image?.url;
  if (url) return { type: "url", value: url };

  return null;
}

function extractFrames(lastResponse) {
  if (!lastResponse) return [];
  const raw =
    lastResponse.images ||
    lastResponse.frames ||
    lastResponse.data ||
    lastResponse.results ||
    [];

  if (!Array.isArray(raw) || raw.length === 0) return [];

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

async function saveImagePayload(payload, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (payload.type === "base64") {
    writeBase64ToFile(payload.value, targetPath);
    return;
  }
  await downloadToFile(payload.value, targetPath);
}

async function saveFrameToPath(frame, filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (frame.type === "url") {
    await downloadToFile(frame.value, filePath);
  } else {
    writeBase64ToFile(frame.value, filePath);
  }
}

function writePropSidecar(spec, outDir) {
  const animations = spec.animations.reduce((acc, anim) => {
    const metaPath = path.join(
      outDir,
      `${anim.name}_${spec.direction}`,
      "meta.json",
    );
    let frameCount = anim.frame_count;
    let frameRate = anim.frame_rate || 6;
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      frameCount = meta.frame_count ?? frameCount;
      frameRate = meta.frame_rate ?? frameRate;
    }
    acc[anim.name] = { frame_count: frameCount, frame_rate: frameRate };
    return acc;
  }, {});

  const sidecar = {
    version: 1,
    id: spec.propId,
    canvas: { width: spec.width, height: spec.height },
    direction: spec.direction,
    animations,
    generated_at: new Date().toISOString(),
    source_spec: path.relative(process.cwd(), spec.absolutePath).replace(/\\/g, "/"),
  };
  fs.writeFileSync(
    path.join(outDir, "prop.json"),
    `${JSON.stringify(sidecar, null, 2)}\n`,
  );
}

async function phaseBase(config, spec) {
  const basePath = path.join(spec.outDir, `base_${spec.direction}.png`);
  if (fs.existsSync(basePath) && process.env.FORCE_REGEN !== "1") {
    console.log(`[prop] ↷ skip existing base → ${basePath}`);
    return basePath;
  }

  console.log("\n[prop] ═══ Phase A — Base image (pixflux) ═══");
  console.log(`[prop]   id          : ${spec.propId}`);
  console.log(`[prop]   size        : ${spec.width}×${spec.height}`);

  const description = spec.negative
    ? `${spec.description} Avoid: ${spec.negative}.`
    : spec.description;

  const result = await createImagePixflux(config, {
    description,
    negative_description: spec.negative || undefined,
    image_size: { width: spec.width, height: spec.height },
    no_background: spec.pipeline.no_background !== false,
    view: spec.style.view || "low top-down",
    outline: spec.style.outline || "single color black outline",
    shading: spec.style.shading || "basic shading",
    detail: spec.style.detail || "medium detail",
  });

  let payload = null;
  if (result.async) {
    const job = await waitForJob(config, result.backgroundJobId, "base image");
    process.stdout.write("\n");
    payload = extractImagePayload(job);
  } else {
    payload = extractImagePayload(result.response);
  }

  if (!payload) {
    throw new Error("No image payload returned for base generation.");
  }

  await saveImagePayload(payload, basePath);
  console.log(`[prop] ✓ base → ${basePath}`);
  return basePath;
}

async function phaseAnimate(config, spec, basePath, animFilter) {
  const firstFrame = readPngAsBase64Image(basePath);
  const targets = animFilter
    ? spec.animations.filter((a) => a.name === animFilter)
    : spec.animations;

  if (animFilter && targets.length === 0) {
    throw new Error(`Unknown animation '${animFilter}' in spec.`);
  }

  for (const anim of targets) {
    const frameDir = path.join(
      spec.outDir,
      `${anim.name}_${spec.direction}`,
    );
    const metaPath = path.join(frameDir, "meta.json");
    if (
      fs.existsSync(metaPath) &&
      process.env.FORCE_REGEN !== "1" &&
      !animFilter
    ) {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      console.log(
        `[prop] ↷ skip existing ${anim.name} (${meta.frame_count} frames)`,
      );
      continue;
    }

    console.log(`\n[prop] ═══ Phase B — Animate '${anim.name}' ═══`);
    console.log(`[prop]   action      : ${anim.action}`);
    console.log(`[prop]   frame_count : ${anim.frame_count}`);

    const { backgroundJobId } = await animateWithTextV3(config, {
      first_frame: firstFrame,
      action: anim.action,
      frame_count: anim.frame_count,
      no_background: spec.pipeline.no_background !== false,
      enhance_prompt: true,
    });

    const job = await waitForJob(
      config,
      backgroundJobId,
      `${anim.name} animation`,
    );
    process.stdout.write("\n");

    const frames = extractFrames(job.last_response);
    if (frames.length === 0) {
      throw new Error(
        `No frames returned for animation '${anim.name}'. Keys: ${Object.keys(job.last_response || {}).join(", ")}`,
      );
    }

    fs.mkdirSync(frameDir, { recursive: true });
    for (let i = 0; i < frames.length; i += 1) {
      const framePath = path.join(
        frameDir,
        `frame_${String(i).padStart(2, "0")}.png`,
      );
      await saveFrameToPath(frames[i], framePath);
    }

    fs.writeFileSync(
      metaPath,
      `${JSON.stringify(
        {
          animation: anim.name,
          direction: spec.direction,
          frame_count: frames.length,
          frame_rate: anim.frame_rate || 6,
          action: anim.action,
        },
        null,
        2,
      )}\n`,
    );

    console.log(
      `[prop] ✓ ${anim.name}: ${frames.length} frames → ${frameDir}`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const specPath =
    args.spec || "docs/sprites/props/oak-tree.spec.json";
  const spec = readPropSpec(specPath);
  const config = resolveConfig();
  ensureApiKey(config);

  const phase = (args.phase || "all").toLowerCase();
  fs.mkdirSync(spec.outDir, { recursive: true });

  console.log(`[prop] spec=${spec.absolutePath}`);
  console.log(`[prop] output=${spec.outDir}`);

  let basePath = path.join(spec.outDir, `base_${spec.direction}.png`);

  if (phase === "all" || phase === "base") {
    basePath = await phaseBase(config, spec);
  } else if (!fs.existsSync(basePath)) {
    throw new Error(`Missing base image at ${basePath}. Run with --phase base first.`);
  }

  if (phase === "all" || phase === "animate") {
    await phaseAnimate(config, spec, basePath, args.anim || null);
  }

  writePropSidecar(spec, spec.outDir);
  console.log(`\n[prop] Done. Sidecar → ${path.join(spec.outDir, "prop.json")}`);
}

main().catch((error) => {
  console.error(`[prop] Fatal: ${error.message}`);
  process.exit(1);
});
