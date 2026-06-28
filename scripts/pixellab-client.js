const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

// Load .env file if it exists
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const parts = trimmed.split("=");
    const key = parts[0].trim();
    const val = parts.slice(1).join("=").trim();
    if (key) {
      process.env[key] = val;
    }
  });
}

// PixelLab API v2 — docs at https://api.pixellab.ai/v2/docs
// Most endpoints are ASYNCHRONOUS: submit job → poll /v2/background-jobs/{id} → retrieve results.
// Consistency strategy: create persistent character (character_id) → animate via same id.
// Auth: Bearer token via Authorization header.

const DEFAULT_BASE_URL = "https://api.pixellab.ai";
const POLL_INTERVAL_MS = 6000;
const POLL_MAX_ATTEMPTS = 200; // 20 min max per job (death v3 can be very slow)
const REQUEST_RETRY_MAX = 5;
const REQUEST_RETRY_BASE_MS = 4000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableRequestError(error) {
  const message = String(error?.message || error);
  return (
    message.includes("fetch failed") ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("ENOTFOUND") ||
    message.includes("(429)") ||
    message.includes("(502)") ||
    message.includes("(503)") ||
    message.includes("(504)")
  );
}

async function withRequestRetries(label, fn) {
  for (let attempt = 1; attempt <= REQUEST_RETRY_MAX; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryableRequestError(error) || attempt === REQUEST_RETRY_MAX) {
        throw error;
      }
      const waitMs = REQUEST_RETRY_BASE_MS * attempt;
      console.warn(
        `[pixellab] ⚠️  ${label} failed (${error.message}); retry ${attempt}/${REQUEST_RETRY_MAX} in ${waitMs / 1000}s…`,
      );
      await sleep(waitMs);
    }
  }
  throw new Error(`${label} exhausted retries`);
}

function cleanBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function resolveConfig(overrides = {}) {
  return {
    apiKey: overrides.apiKey || process.env.PIXELLAB_API_KEY || "",
    baseUrl: cleanBaseUrl(
      overrides.baseUrl || process.env.PIXELLAB_BASE_URL || DEFAULT_BASE_URL,
    ),
  };
}

async function requestJson({ method, url, apiKey, body }) {
  return withRequestRetries(`${method} ${url}`, async () => {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    if (!response.ok) {
      const detail =
        (json && (json.detail || json.message || json.error)) ||
        `HTTP ${response.status}`;
      throw new Error(
        `PixelLab API error (${response.status}): ${JSON.stringify(detail)}`,
      );
    }

    return json;
  });
}

function ensureApiKey(config) {
  if (!config.apiKey) {
    throw new Error(
      "Missing PIXELLAB_API_KEY. Set it as an environment variable before running generation.",
    );
  }
}

// ─────────────────────────────────────────────
// POLLING HELPER
// ─────────────────────────────────────────────

// Polls GET /v2/background-jobs/{jobId} until status is completed or failed.
// Returns the completed job object { status, last_response, ... }.
async function waitForJob(config, jobId, label = "", options = {}) {
  const maxAttempts = options.maxAttempts ?? POLL_MAX_ATTEMPTS;
  const url = `${config.baseUrl}/v2/background-jobs/${jobId}`;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const job = await requestJson({
      method: "GET",
      url,
      apiKey: config.apiKey,
    });
    if (job.status === "completed") {
      return job;
    }
    if (job.status === "failed") {
      throw new Error(
        `Job ${jobId}${label ? ` (${label})` : ""} failed: ${JSON.stringify(job.last_response)}`,
      );
    }
    const elapsed = (attempt * POLL_INTERVAL_MS) / 1000;
    process.stdout.write(
      `\r[pixellab] ⏳ waiting${label ? ` ${label}` : ""} … ${elapsed}s`,
    );
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  process.stdout.write("\n");
  throw new Error(
    `Job ${jobId} timed out after ${(maxAttempts * POLL_INTERVAL_MS) / 1000}s`,
  );
}

// ─────────────────────────────────────────────
// CHARACTER CREATION
// ─────────────────────────────────────────────

// POST /v2/create-character-with-4-directions (async background job)
// Creates a persistent character with 4 directional rotations stored on server.
// Returns { characterId, backgroundJobId }
async function createCharacter(
  config,
  {
    description,
    image_size,
    view = "low top-down",
    outline = "single color black outline",
    shading = "basic shading",
    detail = "medium detail",
    template_id,
    seed,
  },
) {
  const url = `${config.baseUrl}/v2/create-character-with-4-directions`;
  const body = { description, image_size, view, outline, shading, detail };
  if (template_id) {
    body.template_id = template_id;
  }
  if (seed != null) body.seed = Number(seed);

  const response = await requestJson({
    method: "POST",
    url,
    apiKey: config.apiKey,
    body,
  });
  // Response: { background_job_id, character_id, status }
  return {
    characterId: response.character_id,
    backgroundJobId: response.background_job_id,
  };
}

// ─────────────────────────────────────────────
// CHARACTER MANAGEMENT
// ─────────────────────────────────────────────

// GET /v2/characters/{characterId}
// Returns full character details including rotation_urls and animations array.
async function getCharacter(config, characterId) {
  const url = `${config.baseUrl}/v2/characters/${characterId}`;
  return requestJson({ method: "GET", url, apiKey: config.apiKey });
}

// POST /v2/create-character-state (async background job)
// Applies a text edit to an existing character across all stored directions.
// Returns { characterId, backgroundJobId } for the new state character.
async function createCharacterState(
  config,
  {
    character_id,
    edit_description,
    no_background = true,
    use_color_palette_from_reference = true,
    seed,
  },
) {
  const url = `${config.baseUrl}/v2/create-character-state`;
  const body = {
    character_id,
    edit_description,
    no_background,
    use_color_palette_from_reference,
  };
  if (seed != null) body.seed = Number(seed);

  const response = await requestJson({
    method: "POST",
    url,
    apiKey: config.apiKey,
    body,
  });
  return {
    characterId: response.character_id,
    backgroundJobId: response.background_job_id,
  };
}

// ─────────────────────────────────────────────
// ANIMATION
// ─────────────────────────────────────────────

// POST /v2/animate-character (async background job, one job per direction)
// template mode: uses stored skeleton — 1 gen/direction, maximum consistency
// v3 mode: free text action — 4-16 frames, directions independent
// Returns { backgroundJobIds: string[], directions: string[] }
async function animateCharacter(
  config,
  {
    character_id,
    template_animation_id, // use for template mode
    action_description, // use for v3/pro mode
    mode, // "template" | "v3" | "pro" — auto-detected if omitted
    directions, // array of directions, e.g. ["south","north","east","west"]
    frame_count, // v3 only, 4-16
    seed,
  },
) {
  const url = `${config.baseUrl}/v2/animate-character`;
  const body = { character_id };
  if (template_animation_id) body.template_animation_id = template_animation_id;
  if (action_description) body.action_description = action_description;
  if (mode) body.mode = mode;
  if (directions && directions.length > 0) body.directions = directions;
  if (frame_count != null) body.frame_count = Number(frame_count);
  if (seed != null) body.seed = Number(seed);

  const response = await requestJson({
    method: "POST",
    url,
    apiKey: config.apiKey,
    body,
  });
  // Response: { background_job_ids: string[], directions: string[], status }
  return {
    backgroundJobIds: response.background_job_ids,
    directions: response.directions,
  };
}

// ─────────────────────────────────────────────
// ACCOUNT
// ─────────────────────────────────────────────

// GET /v2/balance
async function getBalance(config) {
  const url = `${config.baseUrl}/v2/balance`;
  const response = await requestJson({
    method: "GET",
    url,
    apiKey: config.apiKey,
  });
  // Response: { credits: { usd }, subscription: { generations, total } }
  return {
    usd: response.credits ? response.credits.usd : response.usd || 0,
    subscription: response.subscription || null,
  };
}

// POST /v2/animate-with-text-v3 (async background job)
// Animates a single reference image from a text action (4-16 even frames).
async function animateWithTextV3(
  config,
  {
    first_frame,
    last_frame,
    action,
    frame_count = 8,
    no_background = true,
    enhance_prompt = false,
    seed,
  },
) {
  const url = `${config.baseUrl}/v2/animate-with-text-v3`;
  const body = {
    first_frame,
    action,
    frame_count: Number(frame_count),
    no_background,
    enhance_prompt,
  };
  if (last_frame) body.last_frame = last_frame;
  if (seed != null) body.seed = Number(seed);

  const response = await requestJson({
    method: "POST",
    url,
    apiKey: config.apiKey,
    body,
  });

  return {
    backgroundJobId: response.background_job_id,
    enhancedPrompt: response.enhanced_prompt || null,
  };
}

function readPngAsBase64Image(filePath) {
  const buffer = fs.readFileSync(filePath);
  return {
    type: "base64",
    base64: buffer.toString("base64"),
    format: "png",
  };
}

// POST /v2/create-image-pixflux
// Generates a single pixel art image (sync or async depending on API response).
async function createImagePixflux(
  config,
  {
    description,
    image_size,
    no_background = true,
    negative_description,
    view = "low top-down",
    outline = "single color black outline",
    shading = "basic shading",
    detail = "medium detail",
    seed,
  },
) {
  const url = `${config.baseUrl}/v2/create-image-pixflux`;
  const body = {
    description,
    image_size,
    no_background,
    view,
    outline,
    shading,
    detail,
  };
  if (negative_description) body.negative_description = negative_description;
  if (seed != null) body.seed = Number(seed);

  const response = await requestJson({
    method: "POST",
    url,
    apiKey: config.apiKey,
    body,
  });

  if (response.background_job_id) {
    return {
      backgroundJobId: response.background_job_id,
      async: true,
    };
  }

  return {
    async: false,
    response,
  };
}

// ─────────────────────────────────────────────
// FILE HELPERS
// ─────────────────────────────────────────────

// Download a public CDN URL to a local file
async function downloadToFile(url, targetPath) {
  await withRequestRetries(`download ${url}`, async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, buffer);
  });
}

// Save base64 data URI to file (for backwards compat with any v1 uses)
function writeBase64ToFile(base64DataUri, targetPath) {
  const data = base64DataUri.includes(",")
    ? base64DataUri.slice(base64DataUri.indexOf(",") + 1)
    : base64DataUri;
  const buffer = Buffer.from(data, "base64");
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  // Detect raw RGBA buffer (PixelLab v2 returns raw RGBA for animation frames, not PNG).
  // A valid PNG starts with 0x89 0x50 ('P') 0x4E ('N') 0x47 ('G').
  const isPng =
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;

  if (!isPng) {
    // Assume square RGBA: side = sqrt(byteLength / 4)
    const pixels = buffer.length / 4;
    const side = Math.round(Math.sqrt(pixels));
    if (side * side * 4 === buffer.length) {
      const png = new PNG({ width: side, height: side });
      buffer.copy(png.data, 0, 0, buffer.length);
      const pngBuffer = PNG.sync.write(png);
      fs.writeFileSync(targetPath, pngBuffer);
      return;
    }
    // Non-square: try to detect width from known API sizes (fallback: write raw)
    console.warn(
      `[pixellab] ⚠️  writeBase64ToFile: buffer is not PNG and not square RGBA (${buffer.length} bytes). Writing raw.`,
    );
  }

  fs.writeFileSync(targetPath, buffer);
}

module.exports = {
  resolveConfig,
  ensureApiKey,
  waitForJob,
  createCharacter,
  createCharacterState,
  createImagePixflux,
  animateWithTextV3,
  readPngAsBase64Image,
  getCharacter,
  animateCharacter,
  getBalance,
  downloadToFile,
  writeBase64ToFile,
};
