const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const imgPath = path.join(
  process.cwd(),
  "public",
  "assets",
  "sprites",
  "generated",
  "hair_classic",
  "character_rotations",
  "south.png"
);

fs.createReadStream(imgPath)
  .pipe(new PNG())
  .on("parsed", function () {
    console.log(`Dimensions: ${this.width}x${this.height}`);
    
    // Print a text representation of the top half where brown pixels are found
    for (let y = 0; y < 45; y++) {
      let line = "";
      for (let x = 0; x < this.width; x++) {
        const idx = (this.width * y + x) << 2;
        const r = this.data[idx];
        const g = this.data[idx + 1];
        const b = this.data[idx + 2];
        const a = this.data[idx + 3];

        if (a >= 50) {
          const isBrown = r > 25 && r < 140 && g > 15 && g < 95 && b > 10 && b < 75;
          const isSkin = r > 180 && g > 130 && b > 100;
          const isEye = b > 180 && r < 180;
          
          if (isBrown && !isSkin && !isEye) {
            line += "H"; // Hair
          } else {
            line += "."; // Other
          }
        } else {
          line += " "; // Transparent
        }
      }
      // Print only lines that contain at least one "H"
      if (line.includes("H")) {
        console.log(`Y=${String(y).padStart(2, "0")}: ${line}`);
      }
    }
  });
