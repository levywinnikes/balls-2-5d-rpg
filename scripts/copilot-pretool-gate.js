const fs = require("fs");
const path = require("path");

const WRITE_TOOL_HINTS = [
  "apply_patch",
  "create_file",
  "create_directory",
  "replace_string_in_file",
  "multi_replace_string_in_file",
  "edit_notebook_file",
  "run_in_terminal",
  "execution_subagent",
];

function readStdinSync() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function safeJsonParse(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function detectToolName(payload, rawInput) {
  const candidates = [
    payload?.toolName,
    payload?.tool?.name,
    payload?.request?.toolName,
    payload?.request?.tool?.name,
    payload?.hookSpecificInput?.toolName,
    payload?.hookSpecificInput?.tool?.name,
  ].filter(Boolean);

  if (candidates.length > 0) return String(candidates[0]);

  const payloadText = JSON.stringify(payload || {}).toLowerCase();
  const hit = WRITE_TOOL_HINTS.find((hint) => payloadText.includes(hint));
  if (hit) return hit;

  const rawText = String(rawInput || "").toLowerCase();
  const rawHit = WRITE_TOOL_HINTS.find((hint) => rawText.includes(hint));
  return rawHit || "";
}

function isWriteTool(toolName) {
  const normalized = String(toolName || "").toLowerCase();
  if (!normalized) return false;
  return WRITE_TOOL_HINTS.some((hint) => normalized.includes(hint));
}

function normalizePath(p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .trim();
}

function loadMachineIndex(repoRoot) {
  const indexPath = path.join(
    repoRoot,
    "docs",
    "PROJECT_DOCUMENTATION_INDEX.json",
  );
  if (!fs.existsSync(indexPath)) {
    return {
      ok: false,
      reason: "Machine index not found: docs/PROJECT_DOCUMENTATION_INDEX.json",
    };
  }

  const raw = fs.readFileSync(indexPath, "utf8");
  const parsed = safeJsonParse(raw);
  if (!Array.isArray(parsed.modules) || parsed.modules.length === 0) {
    return { ok: false, reason: "Machine index has no modules." };
  }

  return { ok: true, index: parsed };
}

function unique(arr) {
  return Array.from(new Set(arr));
}

function getRequiredByModules(index, impactedModules) {
  const byId = new Map(index.modules.map((m) => [String(m.id), m]));
  const unknown = [];
  const docs = [];
  const contracts = [];

  impactedModules.forEach((idRaw) => {
    const id = String(idRaw);
    const mod = byId.get(id);
    if (!mod) {
      unknown.push(id);
      return;
    }
    (mod.docsRequired || []).forEach((d) => docs.push(normalizePath(d)));
    (mod.contractsRequired || []).forEach((c) =>
      contracts.push(normalizePath(c)),
    );
  });

  return {
    unknown,
    docsRequired: unique(docs),
    contractsRequired: unique(contracts),
  };
}

function loadChecklist(repoRoot) {
  const checklistPath = path.join(
    repoRoot,
    ".github",
    "agent-runtime",
    "contract-checklist.json",
  );

  if (!fs.existsSync(checklistPath)) {
    return { ok: false, reason: "Checklist file not found." };
  }

  const raw = fs.readFileSync(checklistPath, "utf8");
  const checklist = safeJsonParse(raw);

  const indexStatus = loadMachineIndex(repoRoot);
  if (!indexStatus.ok) {
    return { ok: false, reason: indexStatus.reason };
  }
  const machineIndex = indexStatus.index;

  const missing = [];
  if (!checklist.updatedAt) missing.push("updatedAt");
  if (!checklist.task) missing.push("task");
  if (
    !Array.isArray(checklist.contractsRead) ||
    checklist.contractsRead.length === 0
  ) {
    missing.push("contractsRead");
  }
  if (!checklist.understanding) missing.push("understanding");
  if (!checklist.riskConflict) missing.push("riskConflict");
  if (!checklist.objectiveQuestion) missing.push("objectiveQuestion");
  if (checklist.documentationIndexChecked !== true) {
    missing.push("documentationIndexChecked");
  }
  if (
    !Array.isArray(checklist.impactedModules) ||
    checklist.impactedModules.length === 0
  ) {
    missing.push("impactedModules");
  }
  if (!Array.isArray(checklist.docsRead) || checklist.docsRead.length === 0) {
    missing.push("docsRead");
  }

  const coverage = String(checklist.docsCoverageStatus || "");
  const validCoverage = ["covered", "missing", "divergent"];
  if (!validCoverage.includes(coverage)) {
    missing.push("docsCoverageStatus");
  }

  if (!Array.isArray(checklist.docUpdatesRequired)) {
    missing.push("docUpdatesRequired");
  }

  if (typeof checklist.docUpdatesCompleted !== "boolean") {
    missing.push("docUpdatesCompleted");
  }

  if (checklist.divergenceDetected === true && !checklist.divergenceNotes) {
    missing.push("divergenceNotes");
  }

  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Checklist incomplete: ${missing.join(", ")}`,
    };
  }

  const required = getRequiredByModules(
    machineIndex,
    checklist.impactedModules || [],
  );
  if (required.unknown.length > 0) {
    return {
      ok: false,
      reason: `Unknown impactedModules in checklist: ${required.unknown.join(", ")}`,
    };
  }

  const docsReadSet = new Set((checklist.docsRead || []).map(normalizePath));
  const contractsReadSet = new Set(
    (checklist.contractsRead || []).map(normalizePath),
  );

  const docsMissingForModules = required.docsRequired.filter(
    (d) => !docsReadSet.has(d),
  );
  if (docsMissingForModules.length > 0) {
    return {
      ok: false,
      reason: `docsRead missing required module docs: ${docsMissingForModules.join(", ")}`,
    };
  }

  const contractsMissingForModules = required.contractsRequired.filter(
    (c) => !contractsReadSet.has(c),
  );
  if (contractsMissingForModules.length > 0) {
    return {
      ok: false,
      reason: `contractsRead missing required module contracts: ${contractsMissingForModules.join(", ")}`,
    };
  }

  const updatedAt = new Date(checklist.updatedAt);
  if (Number.isNaN(updatedAt.getTime())) {
    return { ok: false, reason: "updatedAt is not a valid ISO datetime." };
  }

  const ageMs = Date.now() - updatedAt.getTime();
  const maxAgeMs = 12 * 60 * 60 * 1000;
  if (ageMs > maxAgeMs) {
    return {
      ok: false,
      reason:
        "Checklist is stale (>12h). Refresh understanding/risk/question before editing.",
    };
  }

  if (
    (coverage === "missing" || coverage === "divergent") &&
    checklist.docUpdatesCompleted !== true
  ) {
    return {
      ok: false,
      reason:
        "Documentation coverage is missing/divergent. Update docs first and set docUpdatesCompleted=true.",
    };
  }

  return { ok: true };
}

function allowOutput() {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: "Contract checklist validated.",
    },
  };
}

function askOutput(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: reason,
    },
    systemMessage:
      "Before editing or executing implementation commands, update .github/agent-runtime/contract-checklist.json with impactedModules + docsRead/contractsRead matching docs/PROJECT_DOCUMENTATION_INDEX.json; if docs are missing/divergent, document first and set docUpdatesCompleted=true.",
  };
}

async function main() {
  const raw = readStdinSync();
  const payload = safeJsonParse(raw);
  const toolName = detectToolName(payload, raw);

  if (!isWriteTool(toolName)) {
    process.stdout.write(JSON.stringify(allowOutput()));
    return;
  }

  const checklistStatus = loadChecklist(process.cwd());
  if (!checklistStatus.ok) {
    process.stdout.write(JSON.stringify(askOutput(checklistStatus.reason)));
    return;
  }

  process.stdout.write(JSON.stringify(allowOutput()));
}

main().catch((err) => {
  process.stdout.write(
    JSON.stringify(
      askOutput(
        `Pre-tool gate error: ${err && err.message ? err.message : "unknown error"}`,
      ),
    ),
  );
});
