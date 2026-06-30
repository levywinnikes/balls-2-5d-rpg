const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const base = path.join(process.cwd(), "public", "assets", "sprites", "generated", "hero_base");

function bbox(png) {
  let minX = Infinity,
    maxX = -1,
    minY = Infinity,
    maxY = -1,
    opaque = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (png.width * y + x) * 4;
      if (png.data[i + 3] > 20) {
        opaque++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return { minX, maxX, minY, maxY, opaque, w: png.width, h: png.height };
}

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function headBand(png, bb) {
  const cx = Math.round((bb.minX + bb.maxX) / 2);
  const headMaxY = bb.minY + Math.round((bb.maxY - bb.minY) * 0.28);
  let count = 0;
  for (let y = bb.minY; y <= headMaxY; y++) {
    for (let x = cx - 10; x <= cx + 10; x++) {
      if (x < 0 || x >= png.width) continue;
      const i = (png.width * y + x) * 4;
      if (png.data[i + 3] > 20) count++;
    }
  }
  return { headMaxY, headPixels: count };
}

console.log("=== HERO_BASE AUDIT ===\n");

// Rotations alignment
const rotFootY = {};
const rotHead = {};
for (const dir of ["south", "north", "east", "west"]) {
  const p = path.join(base, "character_rotations", `${dir}.png`);
  const png = readPng(p);
  const bb = bbox(png);
  const head = headBand(png, bb);
  rotFootY[dir] = bb.maxY;
  rotHead[dir] = head;
  console.log(
    `rotation ${dir}: ${bb.w}x${bb.h} bbox y=${bb.minY}-${bb.maxY} footY=${bb.maxY} headTop=${bb.minY} headBandPixels=${head.headPixels}`,
  );
}
const footSpread = Math.max(...Object.values(rotFootY)) - Math.min(...Object.values(rotFootY));
console.log(`\nRotation footY spread: ${footSpread}px (ideal: 0-2)`);

// Animations
const anims = ["idle", "walk", "attack", "death"];
const dirs = ["south", "north", "east", "west"];
const issues = [];

for (const anim of anims) {
  for (const dir of dirs) {
    const dirPath = path.join(base, `${anim}_${dir}`);
    if (!fs.existsSync(dirPath)) {
      if (anim !== "death" || dir !== "south") {
        if (anim === "death" && dir !== "south") continue;
        issues.push(`MISSING folder: ${anim}_${dir}`);
      }
      continue;
    }
    const frames = fs
      .readdirSync(dirPath)
      .filter((f) => f.startsWith("frame_") && f.endsWith(".png"))
      .sort();
    const footYs = [];
    const sizes = new Set();
    let prevFoot = null;
    for (const fr of frames) {
      const png = readPng(path.join(dirPath, fr));
      const bb = bbox(png);
      sizes.add(`${bb.w}x${bb.h}`);
      footYs.push(bb.maxY);
      if (prevFoot != null && Math.abs(bb.maxY - prevFoot) > 3) {
        // track large jumps
      }
      prevFoot = bb.maxY;
    }
    const drift = Math.max(...footYs) - Math.min(...footYs);
    const meta = fs.existsSync(path.join(dirPath, "meta.json"))
      ? JSON.parse(fs.readFileSync(path.join(dirPath, "meta.json"), "utf8"))
      : {};
    console.log(
      `${anim}_${dir}: ${frames.length} frames, sizes=${[...sizes].join("|")}, footDrift=${drift}px, template=${meta.templateId || meta.mode || "?"}`,
    );
    if (drift > 4) issues.push(`${anim}_${dir} foot drift ${drift}px (>4)`);
    if (sizes.size > 1) issues.push(`${anim}_${dir} inconsistent canvas sizes`);
    if (anim === "walk" && frames.length !== 4 && frames.length !== 6)
      issues.push(`${anim}_${dir} frame count ${frames.length} (spec target 6, template 4)`);
    if (anim === "idle" && frames.length !== 4)
      issues.push(`${anim}_${dir} idle frames ${frames.length} (expected 4)`);
    if (anim === "attack" && frames.length !== 3 && frames.length !== 6)
      issues.push(`${anim}_${dir} attack frames ${frames.length}`);
    if (anim === "death" && dir === "south" && (frames.length < 4 || frames.length > 8))
      issues.push(`death_south frames ${frames.length} (spec 4-8, target 6)`);
  }
}

// Spec vs reality
const spec = JSON.parse(
  fs.readFileSync("docs/sprites/hero/hero-base.spec.json", "utf8"),
);
const charMeta = JSON.parse(fs.readFileSync(path.join(base, "character.json"), "utf8"));
const sample = readPng(path.join(base, "character_rotations", "south.png"));
console.log(`\nSpec canvas: ${spec.sprite_sheet.source_canvas.width}x${spec.sprite_sheet.source_canvas.height}`);
console.log(`Actual canvas: ${sample.width}x${sample.height}`);
if (sample.width !== spec.sprite_sheet.source_canvas.width) {
  issues.push(`Canvas mismatch: spec ${spec.sprite_sheet.source_canvas.width} actual ${sample.width}`);
}

console.log("\n=== ISSUES ===");
if (issues.length === 0) console.log("None detected automatically");
else issues.forEach((i) => console.log("- " + i));
