const fs = require('fs');

/**
 * 🌎 ADVANCED PROCEDURAL WORLD ENGINE v2.11
 * ----------------------------------------
 * [FIXED] Town Drainage: Town area now overwrites water to ensure dry streets.
 * [FIXED] Safe Spawn: Player always spawns on a path, not in the river.
 * [FIXED] House Integrity: Rivers can no longer pass through buildings.
 */

const WIDTH = 256;
const HEIGHT = 256;

const SYMBOLS = {
    grass: 'grs',
    path: 'pth',
    tree: 'tre',
    rock: 'rok',
    sand: 'snd',
    water: 'wat',
    snow: 'snw',
    floor: 'flr',
    wall: 'wal',
    mountain: 'mnt',
    roof: 'rof',
    stair_up: 'sup',
    stair_down: 'sdn',
    empty: '...'
};

function createLayer(fill = SYMBOLS.empty) {
    return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(fill));
}

const levels = {
    "2":  createLayer(SYMBOLS.empty),
    "1":  createLayer(SYMBOLS.empty),
    "0":  createLayer(SYMBOLS.water),
    "-1": createLayer(SYMBOLS.mountain),
    "-2": createLayer(SYMBOLS.mountain)
};

// --- PHASE 1: BASE TERRAIN ---
console.log("Generating Base...");
for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
        const dx = x - WIDTH/2;
        const dy = y - HEIGHT/2;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const beachWidth = 8;
        const baseRadius = 105 + Math.sin(x/15)*5 + Math.cos(y/15)*5;

        if (dist < baseRadius) {
            if (y < 65) levels["0"][y][x] = SYMBOLS.snw;
            else if (dist < baseRadius - beachWidth) levels["0"][y][x] = SYMBOLS.grass;
            else levels["0"][y][x] = SYMBOLS.sand;
        }
    }
}

// --- PHASE 2: WIDE RIVERS (Generated BEFORE Town) ---
console.log("Simulating Wide Rivers...");
function createWideRiver(startX, startY, tx, ty, len) {
    let cx = startX; let cy = startY;
    for (let i = 0; i < len; i++) {
        for(let ox=-1; ox<=2; ox++) {
            for(let oy=-1; oy<=1; oy++) {
                const ix = Math.floor(cx+ox); const iy = Math.floor(cy+oy);
                if (ix >= 0 && ix < WIDTH && iy >= 0 && iy < HEIGHT) {
                    levels["0"][iy][ix] = SYMBOLS.water;
                }
            }
        }
        cx += tx + (Math.random()-0.5)*0.8; cy += ty + (Math.random()-0.5)*0.8;
        if (Math.sqrt((cx-128)**2 + (cy-128)**2) > 118) break;
    }
}
createWideRiver(128, 128, 1, 0.5, 100);
createWideRiver(128, 128, -1, 0.8, 100);
createWideRiver(128, 128, 0, -1, 80);

// --- PHASE 3: TOWN & DRAINAGE (Overwrites River in Center) ---
console.log("Building Town & Draining Center...");
// 1. Drain the center (110-160) to ensure a dry foundation
for(let y=105; y<165; y++) {
    for(let x=105; x<165; x++) {
        levels["0"][y][x] = SYMBOLS.grass;
    }
}

function buildHouse(sx, sy, w, h, f) {
    for (let i = 0; i < f; i++) {
        const z = i.toString(); const rx = sx; const ry = sy - i;
        for (let y = ry; y < ry + h; y++) {
            for (let x = rx; x < rx + w; x++) {
                const wall = (x === rx || x === rx+w-1 || y === ry || y === ry+h-1);
                if (wall) levels[z][y][x] = (i === 0 && y === ry+h-1 && x === Math.floor(rx+w/2)) ? SYMBOLS.floor : SYMBOLS.wall;
                else levels[z][y][x] = SYMBOLS.floor;
                if (i < f-1 && x === rx+2 && y === ry+2) levels[z][y][x] = SYMBOLS.stair_up;
                if (i > 0 && x === rx+2 && y === ry+3) levels[z][y][x] = SYMBOLS.stair_down;
                if (i === f-1 && levels[(i+1).toString()]) levels[(i+1).toString()][y-1][x] = SYMBOLS.roof;
            }
        }
    }
}
for(let i=0; i<3; i++) for(let j=0; j<3; j++) buildHouse(115+i*15, 115+j*15, 7, 7, (i+j)%2+1);

// Town Pathways (Clear dry path)
for(let y=110; y<160; y++) {
    for(let x=110; x<160; x++) {
        const isHouse = (levels["0"][y][x] === SYMBOLS.wall || levels["0"][y][x] === SYMBOLS.floor);
        if(!isHouse) levels["0"][y][x] = SYMBOLS.path;
    }
}

// --- PHASE 4: FINAL SMOOTHING ---
console.log("Applying Final Smoothing Pass...");
function applySmoothing() {
    const grid = levels["0"];
    const backup = grid.map(row => [...row]);
    const hierarchy = { 'snw': 10, 'grs': 5, 'pth': 4, 'snd': 3, 'wat': 1 };
    for (let y = 1; y < HEIGHT - 1; y++) {
        for (let x = 1; x < WIDTH - 1; x++) {
            const center = backup[y][x];
            if (center !== SYMBOLS.water && center !== SYMBOLS.sand) continue;
            
            const n = backup[y-1][x]; const s = backup[y+1][x]; const e = backup[y][x+1]; const w = backup[y][x-1];
            const nw = backup[y-1][x-1]; const ne = backup[y-1][x+1]; const sw = backup[y+1][x-1]; const se = backup[y+1][x+1];
            
            let bestNeighbor = null;
            
            // PRIORITY 1: CORNERS (To prevent sawtooth)
            if (hierarchy[n] > hierarchy[center] && hierarchy[w] > hierarchy[center]) bestNeighbor = { s: n, d: 'nw' };
            else if (hierarchy[n] > hierarchy[center] && hierarchy[e] > hierarchy[center]) bestNeighbor = { s: n, d: 'ne' };
            else if (hierarchy[s] > hierarchy[center] && hierarchy[w] > hierarchy[center]) bestNeighbor = { s: s, d: 'sw' };
            else if (hierarchy[s] > hierarchy[center] && hierarchy[e] > hierarchy[center]) bestNeighbor = { s: s, d: 'se' };
            // PRIORITY 2: CARDINALS
            else if (hierarchy[n] > hierarchy[center]) bestNeighbor = { s: n, d: 'n' };
            else if (hierarchy[s] > hierarchy[center]) bestNeighbor = { s: s, d: 's' };
            else if (hierarchy[e] > hierarchy[center]) bestNeighbor = { s: e, d: 'e' };
            else if (hierarchy[w] > hierarchy[center]) bestNeighbor = { s: w, d: 'w' };

            if (bestNeighbor) {
                grid[y][x] = `${bestNeighbor.s}_${center === SYMBOLS.water ? 'wat' : 'snd'}_${bestNeighbor.d}`;
            }
        }
    }
}
applySmoothing();

// Force player onto path
levels["0"][128][128] = 'ply';

// --- DATA ASSEMBLY ---
const tileDefinitions = {
    "grs": { id: "grass" }, "pth": { id: "grass-path" },
    "tre": { id: "tree", block: true, under: "grs" },
    "rok": { id: "rock", block: true, under: "grs" },
    "snd": { id: "sand" }, "wat": { id: "water", block: true },
    "snw": { id: "snow" }, "flr": { id: "floor" },
    "wal": { id: "house-wall", block: true }, "rof": { id: "red-roof" },
    "sup": { id: "stair_up", transition: "up", under: "flr" },
    "sdn": { id: "stair_down", transition: "down", under: "flr" }
};
const dirs = ['n','s','e','w','nw','ne','sw','se'];
dirs.forEach(d => {
    tileDefinitions[`grs_wat_${d}`] = { id: `grs_wat_${d}`, block: true };
    tileDefinitions[`grs_snd_${d}`] = { id: `grs_snd_${d}` };
    tileDefinitions[`pth_wat_${d}`] = { id: `pth_wat_${d}`, block: true };
});

const mapData = {
    tileSize: 32, tiles: tileDefinitions,
    entities: { "ply": { type: "player", under: "grs" } },
    levels: {
        "2": { map: levels["2"] }, "1": { map: levels["1"] },
        "0": { playerPos: { x: 128*32, y: 128*32 }, map: levels["0"] },
        "-1": { map: levels["-1"] }, "-2": { map: levels["-2"] }
    }
};

fs.writeFileSync('public/newmap.json', JSON.stringify(mapData));
console.log("v2.11 DRY CITY WORLD GENERATED!");
