const fs = require('fs');
const path = require('path');

const mapJsonPath = path.join(process.cwd(), 'public/maps/debug_sandbox.json');
const mapData = JSON.parse(fs.readFileSync(mapJsonPath, 'utf8'));

const width = mapData.width;
const height = mapData.height;
const tileAtlas = mapData.tileAtlas;

console.log(`Map: debug_sandbox, size: ${width}x${height}`);

// Let's inspect levels around x=10, z=9
const levelsToCheck = Object.keys(mapData.levels);
for (const lvl of levelsToCheck) {
  const binFile = mapData.levels[lvl].binFile;
  const binPath = path.join(process.cwd(), 'public/maps', binFile);
  if (!fs.existsSync(binPath)) {
    console.log(`Level ${lvl}: bin file not found: ${binFile}`);
    continue;
  }
  const binData = fs.readFileSync(binPath);
  
  // The coordinate in 3D: x = 10, z = 9.
  // In the binary/grid system, does z correspond to tileY?
  // Let's check: index = tz * width + tx
  const tx = 10;
  const tz = 9;
  const index = tz * width + tx;
  const atlasIndex = binData[index];
  const symbol = tileAtlas[atlasIndex];
  const def = mapData.tileDefinitions[symbol];
  console.log(`Level ${lvl} at (x=10, z=9): symbol="${symbol}", index=${atlasIndex}, def=`, def);
}
