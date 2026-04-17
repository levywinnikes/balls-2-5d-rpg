#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const defaultTimeoutMs = 180000;
const timeoutMs = Number(process.env.BENCHMARK_TIMEOUT_MS || defaultTimeoutMs);

const buildIndexPath = path.join(rootDir, "build", "index.html");
if (!fs.existsSync(buildIndexPath)) {
  console.error("[benchmark:e2e] build/index.html not found. Run npm run build first.");
  process.exit(2);
}

let electronBinary;
try {
  electronBinary = require("electron");
} catch (error) {
  console.error("[benchmark:e2e] Electron dependency not found.");
  process.exit(2);
}

const reportsDir = path.join(rootDir, "artifacts", "benchmark");
fs.mkdirSync(reportsDir, { recursive: true });

const reportPath = path.join(
  reportsDir,
  `benchmark-report-${Date.now()}.json`,
);

console.log("[benchmark:e2e] Launching Electron benchmark run...");
console.log(`[benchmark:e2e] Report path: ${reportPath}`);

const child = spawn(electronBinary, ["."], {
  cwd: rootDir,
  env: {
    ...process.env,
    BENCHMARK_E2E: "1",
    BENCHMARK_REPORT_PATH: reportPath,
  },
  stdio: "inherit",
});

const timeoutHandle = setTimeout(() => {
  console.error(`[benchmark:e2e] Timeout after ${timeoutMs}ms.`);
  try {
    child.kill("SIGTERM");
  } catch (_e) {}
  process.exit(1);
}, timeoutMs);

child.on("error", (error) => {
  clearTimeout(timeoutHandle);
  console.error(`[benchmark:e2e] Failed to launch Electron: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code) => {
  clearTimeout(timeoutHandle);

  if (!fs.existsSync(reportPath)) {
    console.error("[benchmark:e2e] No report file generated.");
    process.exit(code === 0 ? 1 : code || 1);
    return;
  }

  let report;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  } catch (error) {
    console.error(`[benchmark:e2e] Invalid JSON report: ${error.message}`);
    process.exit(1);
    return;
  }

  const status = report.passed ? "PASS" : "FAIL";
  console.log(`[benchmark:e2e] ${status} ${report.benchmarkName}`);
  console.log(
    `[benchmark:e2e] Total ${(Number(report.totalMs || 0) / 1000).toFixed(2)}s | Steps: ${Array.isArray(report.steps) ? report.steps.length : 0}`,
  );

  const runtimeErrorCount = Array.isArray(report.runtimeErrors)
    ? report.runtimeErrors.length
    : 0;
  console.log(`[benchmark:e2e] Runtime errors captured: ${runtimeErrorCount}`);

  if (Array.isArray(report.steps)) {
    report.steps.forEach((step, index) => {
      const stepStatus = step.ok ? "PASS" : "FAIL";
      const seconds = (Number(step.durationMs || 0) / 1000).toFixed(2);
      const suffix = step.error ? ` (${step.error})` : "";
      console.log(
        `[benchmark:e2e] ${index + 1}. ${stepStatus} ${step.label} - ${seconds}s${suffix}`,
      );
    });
  }

  process.exit(report.passed ? 0 : 1);
});
