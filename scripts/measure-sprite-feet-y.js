const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

function analyze(filePath) {
  const png = PNG.sync.read(fs.readFileSync(filePath));
  let maxY = -1;
  let maxYCenter = -1;
  const cx0 = Math.floor(png.width * 0.2);
  const cx1 = Math.ceil(png.width * 0.8);
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const a = png.data[(png.width * y + x) * 4 + 3];
      if (a <= 20) continue;
      maxY = Math.max(maxY, y);
      if (x >= cx0 && x <= cx1) {
        maxYCenter = Math.max(maxYCenter, y);
      }
    }
  }
  return { maxY, maxYCenter, height: png.height };
}

const entity = process.argv[2] || "dragon";
const base = path.join(
  process.cwd(),
  "public/assets/sprites/generated",
  entity,
);

function report(rel) {
  const p = path.join(base, rel);
  if (!fs.existsSync(p)) return;
  const { maxY, maxYCenter, height } = analyze(p);
  console.log(`${entity} ${rel}: ${height}px maxY=${maxY} centerFeetY=${maxYCenter}`);
}

["character_rotations/south.png", "walk_south/frame_00.png", "idle_south/frame_00.png"].forEach(report);

const walkDir = path.join(base, "walk_south");
if (fs.existsSync(walkDir)) {
  fs.readdirSync(walkDir)
    .filter((f) => f.endsWith(".png"))
    .forEach((f) => report(`walk_south/${f}`));
}
