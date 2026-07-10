const fs = require('fs');
const path = require('path');

const mapJsonPath = path.join(process.cwd(), 'public/maps/debug_sandbox.json');
const mapData = JSON.parse(fs.readFileSync(mapJsonPath, 'utf8'));

const width = mapData.width;
const height = mapData.height;
const tileAtlas = mapData.tileAtlas;

const printGrid = (lvl) => {
  const binFile = mapData.levels[lvl].binFile;
  const binPath = path.join(process.cwd(), 'public/maps', binFile);
  const binData = fs.readFileSync(binPath);
  console.log(`\n--- LEVEL ${lvl} ---`);
  
  // print from x=23..29, z=3..10
  for (let tz = 3; tz <= 10; tz++) {
    let row = `z=${String(tz).padStart(2, ' ')}: `;
    for (let tx = 23; tx <= 29; tx++) {
      const idx = tz * width + tx;
      const atlasIndex = binData[idx];
      const symbol = tileAtlas[atlasIndex];
      row += symbol.padEnd(5, ' ');
    }
    console.log(row);
  }
};

printGrid("0");
printGrid("1");
