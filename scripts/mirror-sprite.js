const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

// Helper to mirror a single PNG file horizontally
function mirrorFile(srcPath, dstPath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(srcPath)
      .pipe(new PNG())
      .on("parsed", function () {
        const mirrored = new PNG({ width: this.width, height: this.height });
        for (let y = 0; y < this.height; y++) {
          for (let x = 0; x < this.width; x++) {
            const srcIdx = (this.width * y + x) << 2;
            const dstIdx = (this.width * y + (this.width - 1 - x)) << 2;
            mirrored.data[dstIdx] = this.data[srcIdx];
            mirrored.data[dstIdx + 1] = this.data[srcIdx + 1];
            mirrored.data[dstIdx + 2] = this.data[srcIdx + 2];
            mirrored.data[dstIdx + 3] = this.data[srcIdx + 3];
          }
        }
        mirrored
          .pack()
          .pipe(fs.createWriteStream(dstPath))
          .on("finish", resolve)
          .on("error", reject);
      })
      .on("error", reject);
  });
}

// Mirror all PNG files in a source directory to a destination directory
async function mirrorDirectory(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) {
    console.warn(`Source directory does not exist: ${srcDir}`);
    return;
  }
  fs.mkdirSync(dstDir, { recursive: true });

  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    if (path.extname(file).toLowerCase() === ".png") {
      const srcFile = path.join(srcDir, file);
      const dstFile = path.join(dstDir, file);
      await mirrorFile(srcFile, dstFile);
      console.log(`[mirror] Mirrored: ${file}`);
    }
  }

  // Copy meta.json if it exists
  const metaSrc = path.join(srcDir, "meta.json");
  const metaDst = path.join(dstDir, "meta.json");
  if (fs.existsSync(metaSrc)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaSrc, "utf8"));
      meta.direction = "west"; // Update direction in metadata
      fs.writeFileSync(metaDst, JSON.stringify(meta, null, 2));
      console.log(`[mirror] Updated metadata in ${metaDst}`);
    } catch (err) {
      console.error(`Failed to copy metadata: ${err.message}`);
    }
  }
}

async function main() {
  const baseDir = path.join(
    process.cwd(),
    "public",
    "assets",
    "sprites",
    "generated",
    "hero_base"
  );

  // We mirror:
  // 1. character_rotations/east.png -> character_rotations/west.png
  console.log("Mirroring rotations...");
  const rotEast = path.join(baseDir, "character_rotations", "east.png");
  const rotWest = path.join(baseDir, "character_rotations", "west.png");
  if (fs.existsSync(rotEast)) {
    await mirrorFile(rotEast, rotWest);
    console.log("[mirror] Rotations mirrored successfully!");
  }

  // 2. walk_east -> walk_west
  console.log("\nMirroring walk animation...");
  await mirrorDirectory(
    path.join(baseDir, "walk_east"),
    path.join(baseDir, "walk_west")
  );

  // 3. idle_east -> idle_west
  console.log("\nMirroring idle animation...");
  await mirrorDirectory(
    path.join(baseDir, "idle_east"),
    path.join(baseDir, "idle_west")
  );

  // 4. attack_east -> attack_west
  console.log("\nMirroring attack animation...");
  await mirrorDirectory(
    path.join(baseDir, "attack_east"),
    path.join(baseDir, "attack_west")
  );

  console.log("\n[mirror] All mirrors generated successfully!");
}

main().catch((err) => {
  console.error("Mirror script failed:", err);
});
