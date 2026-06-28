const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const baseDir = path.join(
  process.cwd(),
  "public",
  "assets",
  "sprites",
  "generated",
  "hair_classic",
  "character_rotations"
);

const directions = ["south", "north", "east", "west"];

function cleanImage(imgPath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(imgPath)
      .pipe(new PNG())
      .on("parsed", function () {
        const width = this.width;
        const height = this.height;

        let keptCount = 0;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (width * y + x) << 2;
            const r = this.data[idx];
            const g = this.data[idx + 1];
            const b = this.data[idx + 2];
            const a = this.data[idx + 3];

            // 1. Keep pixels only in the head/hair area (y < 34)
            // 2. Erase skin colors (face, forehead)
            const isSkin = r > 170 && g > 120 && b > 95;
            const isEye = b > 180 && r < 180;
            const isHair = a >= 50 && y < 34 && !isSkin && !isEye;

            if (isHair) {
              keptCount++;
            } else {
              this.data[idx] = 0;
              this.data[idx + 1] = 0;
              this.data[idx + 2] = 0;
              this.data[idx + 3] = 0;
            }
          }
        }

        this.pack()
          .pipe(fs.createWriteStream(imgPath))
          .on("finish", () => {
            console.log(`Cleaned: ${path.basename(imgPath)} (${keptCount} hair pixels kept)`);
            resolve();
          })
          .on("error", reject);
      })
      .on("error", reject);
  });
}

async function main() {
  console.log("Starting head-area hair cleanup (y < 34 limit)...");
  for (const dir of directions) {
    const file = path.join(baseDir, `${dir}.png`);
    if (fs.existsSync(file)) {
      await cleanImage(file);
    } else {
      console.warn(`File not found: ${file}`);
    }
  }
  console.log("Cleanup complete!");
}

main().catch((err) => {
  console.error("Cleanup script failed:", err);
});
