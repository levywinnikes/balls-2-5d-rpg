/*
 * BMS Contract Guard
 * Fails the process when forbidden legacy map access patterns are found.
 */

const fs = require("fs");
const path = require("path");

const ROOT_DIR = process.cwd();
const TARGET_DIRS = ["src"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

const FORBIDDEN_PATTERNS = [
  {
    id: "BMS001",
    description: "Legacy direct map access is forbidden",
    regex: /\blevelData\.map\b/g,
  },
  {
    id: "BMS002",
    description: "Legacy tile array access is forbidden",
    regex: /\blevelData\.tiles\b/g,
  },
  {
    id: "BMS003",
    description: "Legacy mapData.tiles access is forbidden",
    regex: /\bmapData\.tiles\b/g,
  },
];

function walkDir(dirPath, out) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "build" || entry.name === "dist") {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      walkDir(fullPath, out);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (EXTENSIONS.has(ext)) {
      out.push(fullPath);
    }
  }
}

function findViolations(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split(/\r?\n/);
  const violations = [];

  lines.forEach((line, idx) => {
    FORBIDDEN_PATTERNS.forEach((pattern) => {
      if (pattern.regex.test(line)) {
        violations.push({
          filePath,
          line: idx + 1,
          rule: pattern.id,
          description: pattern.description,
          snippet: line.trim(),
        });
      }
      pattern.regex.lastIndex = 0;
    });
  });

  return violations;
}

function main() {
  const files = [];

  for (const dir of TARGET_DIRS) {
    const absDir = path.join(ROOT_DIR, dir);
    if (fs.existsSync(absDir)) {
      walkDir(absDir, files);
    }
  }

  const violations = files.flatMap(findViolations);

  if (violations.length === 0) {
    console.log("[BMS Guard] OK - no forbidden legacy map access patterns found.");
    process.exit(0);
  }

  console.error("[BMS Guard] Found forbidden legacy map access patterns:");
  for (const v of violations) {
    const relPath = path.relative(ROOT_DIR, v.filePath).replace(/\\/g, "/");
    console.error(`- ${v.rule} ${relPath}:${v.line} :: ${v.description}`);
    console.error(`  ${v.snippet}`);
  }

  console.error(`\n[BMS Guard] Total violations: ${violations.length}`);
  process.exit(1);
}

main();
