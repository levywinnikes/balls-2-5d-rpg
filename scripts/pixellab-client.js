const fs = require("fs");
const path = require("path");

const DEFAULT_BASE_URL = "https://api.pixellab.ai";
const DEFAULT_CREATE_PATH = "/v1/generate";
const DEFAULT_STATUS_PATH = "/v1/jobs/{jobId}";
const DEFAULT_POLL_MS = 5000;
const DEFAULT_TIMEOUT_MS = 120000;

const DONE_STATUSES = new Set([
  "completed",
  "complete",
  "done",
  "success",
  "succeeded",
  "finished",
]);

const ERROR_STATUSES = new Set([
  "failed",
  "error",
  "cancelled",
  "canceled",
  "timeout",
]);

function getEnvNumber(name, fallback) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function cleanPath(pathValue, fallback) {
  const value = String(pathValue || fallback || "").trim();
  if (!value) {
    throw new Error("Empty path is not allowed for PixelLab endpoint configuration.");
  }
  return value.startsWith("/") ? value : `/${value}`;
}

function resolveConfig(overrides = {}) {
  return {
    apiKey: overrides.apiKey || process.env.PIXELLAB_API_KEY || "",
    baseUrl: cleanBaseUrl(overrides.baseUrl || process.env.PIXELLAB_BASE_URL || DEFAULT_BASE_URL),
    createPath: cleanPath(overrides.createPath || process.env.PIXELLAB_CREATE_PATH, DEFAULT_CREATE_PATH),
    statusPath: cleanPath(overrides.statusPath || process.env.PIXELLAB_STATUS_PATH, DEFAULT_STATUS_PATH),
    pollMs: overrides.pollMs || getEnvNumber("PIXELLAB_POLL_MS", DEFAULT_POLL_MS),
    timeoutMs: overrides.timeoutMs || getEnvNumber("PIXELLAB_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
  };
}

function buildUrl(baseUrl, routePath, params = {}) {
  let route = routePath;
  Object.keys(params).forEach((k) => {
    route = route.replace(`{${k}}`, encodeURIComponent(String(params[k])));
  });
  return `${baseUrl}${route}`;
}

function readByPath(source, objectPath) {
  const parts = objectPath.split(".");
  let current = source;
  for (const part of parts) {
    if (current == null) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function pickFirstString(source, paths) {
  for (const p of paths) {
    const value = readByPath(source, p);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function pickFirstArray(source, paths) {
  for (const p of paths) {
    const value = readByPath(source, p);
    if (Array.isArray(value) && value.length > 0) {
      return value;
    }
  }
  return [];
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
  } catch (err) {
    json = { raw: text };
  }

  if (!response.ok) {
    const message = pickFirstString(json, ["error", "message", "detail"]) || `HTTP ${response.status}`;
    throw new Error(`PixelLab request failed (${response.status}): ${message}`);
  }

  return json;
}

function extractImageUrl(payload) {
  const directUrl = pickFirstString(payload, [
    "imageUrl",
    "image_url",
    "outputUrl",
    "output.url",
    "result.url",
    "data.url",
    "data.imageUrl",
  ]);
  if (directUrl) {
    return directUrl;
  }

  const arrays = [
    pickFirstArray(payload, ["images", "data.images", "result.images", "outputs", "data.outputs"]),
  ];

  for (const list of arrays) {
    for (const item of list) {
      if (typeof item === "string" && item.trim()) {
        return item.trim();
      }
      if (item && typeof item === "object") {
        const nested = pickFirstString(item, ["url", "imageUrl", "image_url"]);
        if (nested) {
          return nested;
        }
      }
    }
  }

  return "";
}

function extractImageBase64(payload) {
  return pickFirstString(payload, [
    "imageBase64",
    "image_base64",
    "data.imageBase64",
    "data.image_base64",
    "result.imageBase64",
    "result.image_base64",
  ]);
}

function extractJobId(payload) {
  return pickFirstString(payload, ["jobId", "job_id", "id", "data.id", "data.jobId", "result.id"]);
}

function extractStatus(payload) {
  const status = pickFirstString(payload, ["status", "state", "data.status", "result.status"]);
  return status ? status.toLowerCase() : "";
}

function normalizePromptInput(input) {
  const payload = {
    model: input.model,
    prompt: input.prompt,
  };

  if (input.negativePrompt) {
    payload.negative_prompt = input.negativePrompt;
  }
  if (input.width) {
    payload.width = Number(input.width);
  }
  if (input.height) {
    payload.height = Number(input.height);
  }
  if (input.seed != null && input.seed !== "") {
    payload.seed = Number(input.seed);
  }
  if (input.inputImageUrl) {
    payload.input_image_url = input.inputImageUrl;
  }

  return payload;
}

function ensureApiKey(config) {
  if (!config.apiKey) {
    throw new Error("Missing PIXELLAB_API_KEY. Set it as an environment variable before running generation.");
  }
}

async function createJob(config, input) {
  const url = buildUrl(config.baseUrl, config.createPath);
  const payload = normalizePromptInput(input);
  return requestJson({ method: "POST", url, apiKey: config.apiKey, body: payload });
}

async function getJobStatus(config, jobId) {
  const url = buildUrl(config.baseUrl, config.statusPath, { jobId });
  return requestJson({ method: "GET", url, apiKey: config.apiKey });
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveGeneration(config, createResponse) {
  const directImageUrl = extractImageUrl(createResponse);
  const directBase64 = extractImageBase64(createResponse);
  if (directImageUrl || directBase64) {
    return {
      status: "completed",
      imageUrl: directImageUrl,
      imageBase64: directBase64,
      jobId: extractJobId(createResponse),
      raw: createResponse,
    };
  }

  const jobId = extractJobId(createResponse);
  if (!jobId) {
    throw new Error(
      "PixelLab response did not include image URL/base64 or a job id. Set PIXELLAB_CREATE_PATH/PIXELLAB_STATUS_PATH for your account endpoints.",
    );
  }

  const startTime = Date.now();
  while (Date.now() - startTime <= config.timeoutMs) {
    const statusPayload = await getJobStatus(config, jobId);
    const status = extractStatus(statusPayload);
    const imageUrl = extractImageUrl(statusPayload);
    const imageBase64 = extractImageBase64(statusPayload);

    if (imageUrl || imageBase64 || DONE_STATUSES.has(status)) {
      return {
        status: status || "completed",
        imageUrl,
        imageBase64,
        jobId,
        raw: statusPayload,
      };
    }

    if (ERROR_STATUSES.has(status)) {
      const message = pickFirstString(statusPayload, ["error", "message", "detail"]) || "unknown status error";
      throw new Error(`PixelLab job ${jobId} failed: ${message}`);
    }

    await wait(config.pollMs);
  }

  throw new Error(`PixelLab job polling timed out after ${config.timeoutMs}ms.`);
}

async function downloadImageToFile(imageUrl, targetPath) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download generated image: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buffer);
}

function writeBase64ToFile(imageBase64, targetPath) {
  const data = imageBase64.includes(",") ? imageBase64.slice(imageBase64.indexOf(",") + 1) : imageBase64;
  const buffer = Buffer.from(data, "base64");
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buffer);
}

module.exports = {
  resolveConfig,
  ensureApiKey,
  createJob,
  resolveGeneration,
  downloadImageToFile,
  writeBase64ToFile,
};
