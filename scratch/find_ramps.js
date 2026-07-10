const fs = require('fs');
const path = require('path');

const mapJsonPath = path.join(process.cwd(), 'public/maps/debug_sandbox.json');
const mapData = JSON.parse(fs.readFileSync(mapJsonPath, 'utf8'));

const width = mapData.width;
const height = mapData.height;
const tileAtlas = mapData.tileAtlas;

const levelsToCheck = Object.keys(mapData.levels);
for (const lvl of levelsToCheck) {
  const binFile = mapData.levels[lvl].binFile;
  const binPath = path.join(process.cwd(), 'public/maps', binFile);
  if (!fs.existsSync(binPath)) continue;
  const binData = fs.readFileSync(binPath);
  
  for (let tz = 0; tz < height; tz++) {
    for (let tx = 0; tx < width; tx++) {
      const idx = tz * width + tx;
      const atlasIndex = binData[idx];
      const symbol = tileAtlas[atlasIndex];
      if (symbol && symbol !== '...' && symbol !== 'wal' && symbol !== 'flr') {
        const def = mapData.tileDefinitions[symbol];
        if (def && (def.geometryProfile || def.stairDir || def.id === 'hole' || def.id === 'ramp')) {
          console.log(`Level ${lvl} at (x=${tx}, z=${tz}): symbol="${symbol}", id="${def.id}", profile="${def.geometryProfile}", transition="${def.transition}"`);
        }
      }
    }
  }
}
