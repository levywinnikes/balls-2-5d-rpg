const fs = require('fs');
const path = require('path');

const mapPath = path.join(process.cwd(), 'public', 'newmap.json');
const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));

// 1. Ensure tile definitions are correct (Idempotent)
const newTiles = {
    // bwr: Corner Right (General Corner) - Blocking
    "bwr": { id: "brick-wall-corner-right", block: true, color: "#8B4513", under: "dirty_floor" },
    // bwd: Corner Detail (Pillar/Column Top) - Blocking
    "bwd": { id: "brick-wall-corner-detail", block: true, color: "#8B4513", under: "dirty_floor" },
    // bws: Side Wall - Blocking
    "bws": { id: "brick-wall-texture-side", block: true, color: "#8B4513", under: "dirty_floor" },
    // bwf: Front Wall - Blocking
    "bwf": { id: "brick-wall-texture-front", block: true, color: "#8B4513", under: "dirty_floor" },
};

// Cleanup old bwl if present
if (mapData.tiles["bwl"]) delete mapData.tiles["bwl"];

Object.assign(mapData.tiles, newTiles);

// 2. Autotile Floor -1
const floorMinus1 = mapData.levels["-1"].map;
const height = floorMinus1.length;
const width = floorMinus1[0].length;

function isPath(tile) {
    if (!tile) return false; // Boundary check
    return tile === 'dfl' || tile === 'floor' || tile === 'flr' || tile === 'dirty_floor';
}

function isVoid(tile) {
    return tile === 'rcd' || (typeof tile === 'string' && tile.startsWith('bw')); 
}

// First pass: Identify Wall vs Floor (border logic)
// We need to know where walls are to apply complex neighbor logic.
// The current map might already have bw* tiles.
// We'll calculate the "Target Type" for each cell.

const newMap = floorMinus1.map((row, y) => {
    return row.map((tile, x) => {
        // If it's a path/floor, keep it.
        if (isPath(tile)) return tile;
        // If it's void (rcd) or existing wall, we verify if it SHOULD be a wall.
        
        // Check 8 neighbors
        const n  = y > 0 ? floorMinus1[y - 1][x] : null;
        const s  = y < height - 1 ? floorMinus1[y + 1][x] : null;
        const w  = x > 0 ? floorMinus1[y][x - 1] : null;
        const e  = x < width - 1 ? floorMinus1[y][x + 1] : null;

        const nw = y > 0 && x > 0 ? floorMinus1[y - 1][x - 1] : null;
        const ne = y > 0 && x < width - 1 ? floorMinus1[y - 1][x + 1] : null;
        const sw = y < height - 1 && x > 0 ? floorMinus1[y + 1][x - 1] : null;
        const se = y < height - 1 && x < width - 1 ? floorMinus1[y + 1][x + 1] : null;

        const pN = isPath(n);
        const pS = isPath(s);
        const pW = isPath(w);
        const pE = isPath(e);

        // If no adjacent path, it's deep rock -> floor (as per original logic "deep rocks become floor/dirty_floor")
        // Wait, original logic: "rcd" ... "not adjacent to paths (deep rock) are converted to floor tiles".
        // Let's stick to that.
        if (!pN && !pS && !pW && !pE) {
             return 'dfl'; 
        }

        // It is a wall border. Determine type.

        // CORNER LOGIC (Outer Bottom Corners)
        if (pS && pE) return 'bwr';
        if (pS && pW) return 'bwr';

        // FRONT WALL LOGIC (South exposed)
        if (pS) return 'bwf';

        // SIDE WALL LOGIC (West or East exposed)
        if (pW || pE) {
            // DETIAL LOGIC (Top of specific vertical segments / "Kapitel")
            // If I am exposed to West, AND my North neighbor is NOT exposed to West (wall to his left),
            // OR I am exposed to East, AND my North neighbor is NOT exposed to East (wall to his right).
            // AND I am not a standard "Top Corner" (which we might handle differently, but here just bwd).
            
            const pNW = isPath(nw); // Is North-West a path?
            const pNE = isPath(ne); // Is North-East a path?
            
            // Note: If pN is True, then I am a Top End of a wall. That usually also gets bwd or bwr.
            
            if (pW) {
                // I am West-facing.
                // Check North.
                if (pN) return 'bwd'; // Top of wall ending in floor.
                if (!pNW) return 'bwd'; // "Step Out": Wall above me is blocked on West.
            }

            if (pE) {
                // I am East-facing.
                if (pN) return 'bwd';
                if (!pNE) return 'bwd'; // "Step Out": Wall above me is blocked on East.
            }

            return 'bws';
        }

        // If only North is path? (Back wall)
        if (pN) return 'bwd';

        // Default fallback
        return 'bwf';
    });
});

mapData.levels["-1"].map = newMap;

// 3. Custom Stringify
let jsonString = JSON.stringify(mapData, null, 2);
jsonString = jsonString.replace(
  /\[\s+((?:"[^"]+"\s*,\s*)+"[^"]+")\s+\]/g,
  (match, content) => {
    return `[${content.replace(/\s+/g, ' ')}]`.replace(/, "/g, ', "'); 
  }
);

fs.writeFileSync(mapPath, jsonString);
console.log("Updated newmap.json with refined Tibia-style wall placement (bwd at steps).");
