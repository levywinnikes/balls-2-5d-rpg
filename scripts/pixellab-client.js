const fs = require("fs");
const path = require("path");

// PixelLab API — docs at https://api.pixellab.ai/v1/docs
// All generation endpoints are SYNCHRONOUS (no polling needed).
// Auth: Bearer token via Authorization header.

const DEFAULT_BASE_URL = "https://api.pixellab.ai";

function cleanBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function resolveConfig(overrides = {}) {
  return {
    apiKey: overrides.apiKey || process.env.PIXELLAB_API_KEY || "",
    baseUrl: cleanBaseUrl(overrides.baseUrl || process.env.PIXELLAB_BASE_URL || DEFAULT_BASE_URL),
  };
}

async function requestJson({ method, url, apiKey, body }) {
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
      (json && (json.detail || json.message || json.error)) || `HTTP ${response.status}`;
    throw new Error(`PixelLab API error (${response.status}): ${JSON.stringify(detail)}`);
  }

  return json;
}

function ensureApiKey(config) {
  if (!config.apiKey) {
    throw new Error(
      "Missing PIXELLAB_API_KEY. Set it as an environment variable before running generation.",
    );
  }
}

// Returns { base64: "data:image/png;base64,...", usdCost: number }
// Endpoint: POST /v1/generate-image-pixflux
// Required: description (string), image_size { width, height }
// Optional: no_background (bool), negative_description (string), view, direction, seed
async function generateImage(config, { description, image_size, no_background, negative_description, view, direction, seed }) {
  const url = `${config.baseUrl}/v1/generate-image-pixflux`;
  const body = {
    description,
    image_size,
  };
  if (no_background != null) body.no_background = no_background;
  if (negative_description) body.negative_description = negative_description;
  if (view) body.view = view;
  if (direction) body.direction = direction;
  if (seed != null) body.seed = Number(seed);

  const response = await requestJson({ method: "POST", url, apiKey: config.apiKey, body });
  // Response: { image: { type: "base64", base64: "data:image/png;base64,..." }, usage: { usd: N } }
  return {
    base64: response.image.base64,
    usdCost: response.usage ? response.usage.usd : null,
  };
}

// Returns { frames: string[], usdCost: number }  (frames are base64 data URIs)
// Endpoint: POST /v1/animate-with-text
// Constraint: image_size MUST be 64x64
// Required: image_size, description, action, reference_image { type:"base64", base64: "..." }
// Optional: view, direction, n_frames (2-20, default 4), seed
// NOTE: reference_image.base64 must be raw base64 (no "data:image/..." prefix)
async function animateWithText(config, { description, action, reference_image, view, direction, n_frames, seed }) {
  const url = `${config.baseUrl}/v1/animate-with-text`;

  // Strip data URI prefix if present — API expects raw base64
  let rawBase64 = reference_image.base64 || "";
  if (rawBase64.includes(",")) {
    rawBase64 = rawBase64.slice(rawBase64.indexOf(",") + 1);
  }

  const body = {
    image_size: { width: 64, height: 64 },
    description,
    action,
    reference_image: { type: "base64", base64: rawBase64 },
  };
  if (view) body.view = view;
  if (direction) body.direction = direction;
  if (n_frames != null) body.n_frames = Number(n_frames);
  if (seed != null) body.seed = Number(seed);

  const response = await requestJson({ method: "POST", url, apiKey: config.apiKey, body });
  // Response: { images: [{ type:"base64", base64:"..." }, ...], usage: { usd: N } }
  return {
    frames: response.images.map((img) => img.base64),
    usdCost: response.usage ? response.usage.usd : null,
  };
}

// Returns { usd: number }
// Endpoint: GET /v1/balance
async function getBalance(config) {
  const url = `${config.baseUrl}/v1/balance`;
  const response = await requestJson({ method: "GET", url, apiKey: config.apiKey });
  return { usd: response.usd };
}

function writeBase64ToFile(base64DataUri, targetPath) {
  const data = base64DataUri.includes(",")
    ? base64DataUri.slice(base64DataUri.indexOf(",") + 1)
    : base64DataUri;
  const buffer = Buffer.from(data, "base64");
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buffer);
}

module.exports = {
  resolveConfig,
  ensureApiKey,
  generateImage,
  animateWithText,
  getBalance,
  writeBase64ToFile,
};
