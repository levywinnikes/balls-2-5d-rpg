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

async function drawGridOnFrame(state, dir, frame) {
  const bodyPath = path.join(process.cwd(), "public/assets/sprites/generated/hero_base", `${state}_${dir}`, `frame_${String(frame).padStart(2, "0")}.png`);
  if (!fs.existsSync(bodyPath)) return;
  const body = await loadPNG(bodyPath);

  const canvas = new PNG({ width: HERO_SOURCE_SIZE, height: HERO_SOURCE_SIZE });
  for (let i = 0; i < body.data.length; i++) {
    canvas.data[i] = body.data[i];
  }

  // Draw grid lines and dots
  for (let y = 0; y < HERO_SOURCE_SIZE; y++) {
    for (let x = 0; x < HERO_SOURCE_SIZE; x++) {
      const idx = (HERO_SOURCE_SIZE * y + x) << 2;
      if (x % 5 === 0 || y % 5 === 0) {
        const alpha = 0.2;
        canvas.data[idx] = Math.round(0 * alpha + canvas.data[idx] * (1 - alpha));
        canvas.data[idx+1] = Math.round(0 * alpha + canvas.data[idx+1] * (1 - alpha));
        canvas.data[idx+2] = Math.round(255 * alpha + canvas.data[idx+2] * (1 - alpha));
        canvas.data[idx+3] = 255;
      }
      if (x % 10 === 0 && y % 10 === 0) {
        canvas.data[idx] = 255;
        canvas.data[idx+1] = 0;
        canvas.data[idx+2] = 0;
        canvas.data[idx+3] = 255;
      }
    }
  }

  const outPath = path.join(process.cwd(), `scratch/grid_${state}_${dir}_${frame}.png`);
  return new Promise((resolve) => {
    canvas.pack().pipe(fs.createWriteStream(outPath)).on("finish", () => {
      resolve(outPath);
    });
  });
}

async function main() {
  const tasks = [];
  const directions = ["south", "north", "east", "west"];
  
  for (const dir of directions) {
    // idle
    for (let i = 0; i < 4; i++) tasks.push(drawGridOnFrame("idle", dir, i));
    // walk
    for (let i = 0; i < 4; i++) tasks.push(drawGridOnFrame("walk", dir, i));
    // attack
    for (let i = 0; i < 3; i++) tasks.push(drawGridOnFrame("attack", dir, i));
  }

  const results = await Promise.all(tasks);
  console.log(`Generated ${results.length} grid images.`);
}

main().catch(console.error);
