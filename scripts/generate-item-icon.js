const fs = require("fs");
const path = require("path");
const {
  resolveConfig,
  ensureApiKey,
  waitForJob,
  createImagePixflux,
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

function readItemIconSpec(specPath) {
  const absolutePath = path.resolve(specPath);
  const raw = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  const registryId = raw.registry_id || raw.id;
  const description = raw?.production_prompts?.description?.trim();
  const negative = raw?.production_prompts?.negative_prompt?.trim();
  const width = raw?.canvas?.width || 32;
  const height = raw?.canvas?.height || 32;
  const outputPath =
    raw?.output?.path ||
    path.join("public", "assets", "items", `${registryId}.png`);

  if (!registryId) throw new Error("Spec missing registry_id or id.");
  if (!description) {
    throw new Error("Spec missing production_prompts.description.");
  }

  return {
    absolutePath,
    registryId,
    description,
    negative,
    width,
    height,
    outputPath: path.resolve(outputPath),
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
  if (url) {
    return { type: "url", value: url };
  }

  return null;
}

async function saveImagePayload(payload, targetPath) {
  if (payload.type === "base64") {
    writeBase64ToFile(payload.value, targetPath);
    return;
  }
  await downloadToFile(payload.value, targetPath);
}

async function main() {
  const args = parseArgs(process.argv);
  const specPath =
    args.spec || "docs/sprites/items/leather-helmet.spec.json";
  const spec = readItemIconSpec(specPath);
  const config = resolveConfig();
  ensureApiKey(config);

  console.log(`[item-icon] registry_id=${spec.registryId}`);
  console.log(`[item-icon] output=${spec.outputPath}`);

  const result = await createImagePixflux(config, {
    description: spec.description,
    negative_description: spec.negative,
    image_size: { width: spec.width, height: spec.height },
    no_background: spec.pipeline.no_background !== false,
    view: spec.style.view || "low top-down",
    outline: spec.style.outline || "single color black outline",
    shading: spec.style.shading || "basic shading",
    detail: spec.style.detail || "medium detail",
    seed: args.seed ? Number(args.seed) : undefined,
  });

  let payload = null;
  if (result.async) {
    const job = await waitForJob(
      config,
      result.backgroundJobId,
      spec.registryId,
    );
    process.stdout.write("\n");
    payload = extractImagePayload(job);
  } else {
    payload = extractImagePayload(result.response);
  }

  if (!payload) {
    throw new Error(
      "Could not extract image from PixelLab response. Check API payload shape.",
    );
  }

  await saveImagePayload(payload, spec.outputPath);

  const sidecarPath = path.join(
    path.dirname(spec.outputPath),
    `${spec.registryId}.meta.json`,
  );
  fs.mkdirSync(path.dirname(sidecarPath), { recursive: true });
  fs.writeFileSync(
    sidecarPath,
    JSON.stringify(
      {
        registryId: spec.registryId,
        spec: path.relative(process.cwd(), spec.absolutePath),
        generatedAt: new Date().toISOString(),
        canvas: { width: spec.width, height: spec.height },
        publicUrl: spec.raw?.output?.public_url || `assets/items/${spec.registryId}.png`,
      },
      null,
      2,
    ),
  );

  console.log(`[item-icon] ✅ wrote ${spec.outputPath}`);
  console.log(`[item-icon] UI/chão/containers: assets/items/${spec.registryId}.png`);
}

main().catch((err) => {
  console.error("[item-icon] ❌", err.message || err);
  process.exit(1);
});
