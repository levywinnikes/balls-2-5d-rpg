const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const imgPath = path.join(
  process.cwd(),
  "public",
  "assets",
  "sprites",
  "generated",
  "hero_base",
  "idle_south",
  "frame_00.png"
);

if (!fs.existsSync(imgPath)) {
  console.error("File does not exist:", imgPath);
  process.exit(1);
}

fs.createReadStream(imgPath)
  .pipe(new PNG())
  .on("parsed", function () {
    console.log(`Dimensions: ${this.width}x${this.height}`);
    const colorCounts = {};
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = (this.width * y + x) << 2;
        const r = this.data[idx];
        const g = this.data[idx + 1];
        const b = this.data[idx + 2];
        const a = this.data[idx + 3];
        if (a > 50) {
          const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
          colorCounts[hex] = (colorCounts[hex] || 0) + 1;
        }
      }
    }
    console.log("Color distribution (hex: count):");
    const sortedColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
    for (const [hex, count] of sortedColors.slice(0, 15)) {
      console.log(`${hex}: ${count}`);
    }
  });
