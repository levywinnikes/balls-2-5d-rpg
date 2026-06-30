const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const states = ["idle", "walk", "attack"];
const directions = ["south", "north", "east", "west"];

const frameCounts = {
  idle: 4,
  walk: 4,
  attack: 3
};

function isSkin(r, g, b, a) {
  return a > 100 && r > 200 && g > 150 && b > 150;
}

async function analyzeFrame(state, direction, frameIndex) {
  const imgPath = path.join(
    process.cwd(),
    "public",
    "assets",
    "sprites",
    "generated",
    "hero_base",
    `${state}_${direction}`,
    `frame_${String(frameIndex).padStart(2, "0")}.png`
  );

  if (!fs.existsSync(imgPath)) {
    return null;
  }

  return new Promise((resolve) => {
    fs.createReadStream(imgPath)
      .pipe(new PNG())
      .on("parsed", function () {
        // Find skin pixels and segment them
        const skinPixels = [];
        let minY = 92, maxY = -1, minX = 92, maxX = -1;
        for (let y = 0; y < 92; y++) {
          for (let x = 0; x < 92; x++) {
            const idx = (92 * y + x) << 2;
            if (isSkin(this.data[idx], this.data[idx+1], this.data[idx+2], this.data[idx+3])) {
              skinPixels.push({ x, y });
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
            }
          }
        }

        // We want to find the hands. Typically, the body center is around x=46.
        // Let's divide skin pixels into left-side, right-side, or scan the horizontal extremities at hand height (e.g. Y=48 to Y=65).
        // Let's filter skin pixels to those in Y range [45, 68] to find hands.
        const handRangePixels = skinPixels.filter(p => p.y >= 45 && p.y <= 68);
        if (handRangePixels.length === 0) {
          resolve({ left: null, right: null });
          return;
        }

        // Leftmost and rightmost skin pixels in this height range
        let leftHand = null;
        let rightHand = null;

        // Group by x to find distinct clusters
        // For south/north:
        // Left hand (screen left): min X
        // Right hand (screen right): max X
        let minXHand = 92, maxXHand = -1;
        let leftHandY = 0, rightHandY = 0;

        for (const p of handRangePixels) {
          if (p.x < minXHand) {
            minXHand = p.x;
            leftHandY = p.y;
          }
          if (p.x > maxXHand) {
            maxXHand = p.x;
            rightHandY = p.y;
          }
        }

        resolve({
          left: { x: minXHand, y: leftHandY },
          right: { x: maxXHand, y: rightHandY }
        });
      });
  });
}

async function run() {
  console.log("Analyzing hero base frames to detect hands...");
  for (const state of states) {
    for (const dir of directions) {
      console.log(`\nState: ${state}, Dir: ${dir}`);
      for (let f = 0; f < frameCounts[state]; f++) {
        const result = await analyzeFrame(state, dir, f);
        if (result) {
          console.log(`  Frame ${f}: Screen Left Hand: (${result.left.x}, ${result.left.y}), Screen Right Hand: (${result.right.x}, ${result.right.y})`);
        }
      }
    }
  }
}

run();
