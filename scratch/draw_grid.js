const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const HERO_SOURCE_SIZE = 92;

async function loadPNG(filePath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(new PNG())
      .on("parsed", function () {
        resolve(this);
      })
      .on("error", reject);
  });
}

async function main() {
  const state = "attack";
  const dir = "north";
  const frame = 2;

  const bodyPath = path.join(process.cwd(), "public/assets/sprites/generated/hero_base", `${state}_${dir}`, `frame_${String(frame).padStart(2, "0")}.png`);
  const body = await loadPNG(bodyPath);

  const canvas = new PNG({ width: HERO_SOURCE_SIZE, height: HERO_SOURCE_SIZE });
  
  // Copy body to canvas
  for (let i = 0; i < body.data.length; i++) {
    canvas.data[i] = body.data[i];
  }

  // Draw grid lines and dots
  for (let y = 0; y < HERO_SOURCE_SIZE; y++) {
    for (let x = 0; x < HERO_SOURCE_SIZE; x++) {
      const idx = (HERO_SOURCE_SIZE * y + x) << 2;
      
      // Draw grid lines every 10 pixels
      if (x % 10 === 0 || y % 10 === 0) {
        // Overlay a semi-transparent grid color (blue)
        const alpha = 0.3;
        canvas.data[idx] = Math.round(0 * alpha + canvas.data[idx] * (1 - alpha));
        canvas.data[idx+1] = Math.round(0 * alpha + canvas.data[idx+1] * (1 - alpha));
        canvas.data[idx+2] = Math.round(255 * alpha + canvas.data[idx+2] * (1 - alpha));
        canvas.data[idx+3] = 255;
      }

      // Draw crosshairs at every 10,10 intersection
      if (x % 10 === 0 && y % 10 === 0) {
        // Red dot
        canvas.data[idx] = 255;
        canvas.data[idx+1] = 0;
        canvas.data[idx+2] = 0;
        canvas.data[idx+3] = 255;
      }
    }
  }

  const outPath = path.join(process.cwd(), "scratch/composite_grid_out.png");
  canvas.pack().pipe(fs.createWriteStream(outPath)).on("finish", () => {
    console.log("Saved grid image to:", outPath);
  });
}

main().catch(console.error);
