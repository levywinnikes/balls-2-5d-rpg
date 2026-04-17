/*
 * I18N UI Guard
 * Blocks new hardcoded player-facing UI text introduced in changed lines.
 * Scope is diff-based to avoid failing on legacy code that predates the rule.
 */

const { execSync } = require("child_process");
const path = require("path");

const ROOT_DIR = process.cwd();
const EXCLUDED_FILES = new Set(["src/game/i18n/translations.ts"]);
const VALID_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

const RULES = [
  {
    id: "I18N001",
    description: "Hardcoded uiNotification message",
    regex: /\bmessage\s*:\s*["'`][^"'`{][^"'`]*["'`]/,
  },
  {
    id: "I18N002",
    description: "Hardcoded PlayerState message event",
    regex: /\bemit\(\s*["']message["']\s*,\s*["'`][^"'`{][^"'`]*["'`]/,
  },
  {
    id: "I18N003",
    description: "Hardcoded accessibility/UI attribute",
    regex:
      /\b(title|placeholder|aria-label|label|alt)\s*=\s*["'][^"'{][^"']*["']/,
  },
];

function run(cmd) {
  return execSync(cmd, { cwd: ROOT_DIR, stdio: ["ignore", "pipe", "pipe"] })
    .toString("utf8")
    .trim();
}

function tryRun(cmd) {
  try {
    return run(cmd);
  } catch {
    return "";
  }
}

function getMergeBase() {
  const base = tryRun("git merge-base HEAD origin/main");
  if (base) return base;

  const prev = tryRun("git rev-parse HEAD~1");
  if (prev) return prev;

  return "";
}

function getDiffText() {
  const base = getMergeBase();
  let committed = "";

  if (base) {
    committed = tryRun(`git diff --unified=0 ${base}...HEAD`);
  }

  const staged = tryRun("git diff --unified=0 --cached");
  const unstaged = tryRun("git diff --unified=0");

  return [committed, staged, unstaged].filter(Boolean).join("\n");
}

function normalizePath(p) {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function parseAddedLines(diffText) {
  const lines = diffText.split(/\r?\n/);
  const added = [];

  let currentFile = "";
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith("+++ b/")) {
      currentFile = normalizePath(line.slice(6));
      const ext = path.extname(currentFile).toLowerCase();
      if (!VALID_EXTENSIONS.has(ext)) {
        currentFile = "";
      }
      continue;
    }

    if (line.startsWith("@@")) {
      const match = line.match(/\+(\d+)(?:,(\d+))?/);
      if (match) {
        newLine = Number(match[1]);
      }
      continue;
    }

    if (!currentFile || EXCLUDED_FILES.has(currentFile)) {
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      added.push({
        filePath: currentFile,
        line: newLine,
        content: line.slice(1),
      });
      newLine += 1;
      continue;
    }

    if (!line.startsWith("-")) {
      newLine += 1;
    }
  }

  return added;
}

function isAllowedLine(content) {
  const trimmed = content.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("//")) return true;
  if (trimmed.includes("t_game(")) return true;
  if (trimmed.includes("t_ui(")) return true;
  if (trimmed.includes("translations.")) return true;
  return false;
}

function findViolations(addedLines) {
  const violations = [];

  for (const entry of addedLines) {
    if (isAllowedLine(entry.content)) continue;

    for (const rule of RULES) {
      if (rule.regex.test(entry.content)) {
        violations.push({
          filePath: entry.filePath,
          line: entry.line,
          rule: rule.id,
          description: rule.description,
          snippet: entry.content.trim(),
        });
      }
      rule.regex.lastIndex = 0;
    }
  }

  return violations;
}

function main() {
  const diffText = getDiffText();
  if (!diffText) {
    console.log("[I18N Guard] OK - no changed source lines to validate.");
    process.exit(0);
  }

  const addedLines = parseAddedLines(diffText);
  const violations = findViolations(addedLines);

  if (violations.length === 0) {
    console.log(
      "[I18N Guard] OK - no new hardcoded UI text found in changed lines.",
    );
    process.exit(0);
  }

  console.error("[I18N Guard] New hardcoded player-facing UI text detected:");
  for (const v of violations) {
    console.error(`- ${v.rule} ${v.filePath}:${v.line} :: ${v.description}`);
    console.error(`  ${v.snippet}`);
  }

  console.error(`\n[I18N Guard] Total violations: ${violations.length}`);
  process.exit(1);
}

main();
