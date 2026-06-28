const fs = require("fs");
const path = require("path");
const {
  resolveConfig,
  getCharacter,
  downloadToFile,
} = require("./pixellab-client");

async function main() {
  const config = resolveConfig();
  const char = await getCharacter(config, "97873dc1-0b2b-4d5e-aa76-19c7816a50df");
  const rotationData =
    char.rotation_urls || char.images || char.rotations || {};
  const baseDir = path.join(
    process.cwd(),
    "public",
    "assets",
    "sprites",
    "generated",
    "hair_classic",
    "character_rotations"
  );
  for (const [dir, url] of Object.entries(rotationData)) {
    if (url && url.startsWith("http")) {
      const imgPath = path.join(baseDir, `${dir}.png`);
      await downloadToFile(url, imgPath);
      console.log(`Downloaded ${dir} -> ${imgPath}`);
    }
  }
}
main().catch(console.error);
