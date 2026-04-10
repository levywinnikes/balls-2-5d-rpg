const fs = require('fs');

const WIDTH = 85;
const HEIGHT = 40; 

// Tile Configuration
// We'll use 'flr' (Stone Floor) for the cave to match 'orc' default.
// Wall: 'roc' (Rock)
const WALL = "mnt";
const FLOOR = "dfl";

function generateCave(width, height, wallTile, floorTile, upPos, downPos, enemies) {
    let map = [];
    // Init noise
    for (let y = 0; y < height; y++) {
        let row = [];
        for (let x = 0; x < width; x++) {
            row.push(Math.random() < 0.45 ? wallTile : floorTile);
        }
        map.push(row);
    }
    
    // Smooth
    for (let i = 0; i < 5; i++) {
        let newMap = JSON.parse(JSON.stringify(map));
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let neighbors = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        if (map[y + dy][x + dx] === wallTile) neighbors++;
                    }
                }
                if (neighbors > 4) newMap[y][x] = wallTile;
                else if (neighbors < 4) newMap[y][x] = floorTile;
            }
        }
        map = newMap;
    }

    // Border walls
    for(let y=0; y<height; y++) { map[y][0] = wallTile; map[y][width-1] = wallTile; }
    for(let x=0; x<width; x++) { map[0][x] = wallTile; map[height-1][x] = wallTile; }

    // Ensure path to stairs
    const clearAround = (pos, tile) => {
        if (!pos) return;
        map[pos.y][pos.x] = tile;
        for(let dy=-1; dy<=1; dy++) for(let dx=-1; dx<=1; dx++) {
             let ny = pos.y+dy; let nx = pos.x+dx;
             if(ny>0 && ny<height-1 && nx>0 && nx<width-1) {
                if(map[ny][nx] === wallTile) map[ny][nx] = floorTile;
             }
        }
    };

    if (upPos) clearAround(upPos, "up ");
    if (downPos) clearAround(downPos, "dwn");

    // Add enemies on floor tiles
    if (enemies && enemies.length > 0) {
        for(let y=1; y<height-1; y++) {
            for(let x=1; x<width-1; x++) {
                // Do not spawn on stairs
                if(map[y][x] === "up " || map[y][x] === "dwn") continue;
                
                if(map[y][x] === floorTile && Math.random() < 0.03) { // 3% chance
                    const enemy = enemies[Math.floor(Math.random() * enemies.length)];
                    map[y][x] = enemy;
                }
            }
        }
    }

    return map;
}

// Coordinates
const level0_dwn = { x: 14, y: 6 };
const level_minus1_dwn = { x: 75, y: 30 }; 
const level_minus2_dwn = { x: 10, y: 35 }; 

// Enemies Guide:
// rat: under grs | ror: rat under roc? No.
// bat: under flr? Checking newmap.json... 'bat' under 'flr' (Line 233).
// orc: under flr (Line 198).
// dem: under grs (Line 208).
// We'll use 'orc' and 'bat' freely as they match 'flr'.
// 'rat' matches 'grs', so we use 'rat' only if we accept grass patches or redefine. 
// For now, let's use 'bat' and 'orc' for Level -1/-2.
// Level -3 'dem' is under 'grs'. We'll get grass patches in Hell. Accepted.

const level_minus1 = generateCave(WIDTH, HEIGHT, WALL, FLOOR, level0_dwn, level_minus1_dwn, ["bat", "orc"]); 
const level_minus2 = generateCave(WIDTH, HEIGHT, WALL, FLOOR, level_minus1_dwn, level_minus2_dwn, ["orc", "orc", "bat"]); // More orcs
const level_minus3 = generateCave(WIDTH, HEIGHT, WALL, FLOOR, level_minus2_dwn, null, ["dem"]); 

const output = {
    "-1": { map: level_minus1 },
    "-2": { map: level_minus2 },
    "-3": { map: level_minus3 }
};

fs.writeFileSync('dungeon.json', JSON.stringify(output, null, 2));
