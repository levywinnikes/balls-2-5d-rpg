const fs = require('fs');

/**
 * ⚠️ AI MANDATORY INSTRUCTION ⚠️
 * BEFORE modifying this file, you MUST read and adhere to:
 * docs/contracts/GENERATOR_CONTRACT.md
 * ANY deviation from the contract (e.g., incorrect stair pairing,
 * lack of urban safe zones, or missing concrete foundations) is 
 * considered a FAILURE in core logic.
 * --------------------------------------------------
 * 🌎 ADVANCED PROCEDURAL WORLD ENGINE v2.46 - REDENÇÃO
 * --------------------------------------------------
 * [FIXED] Town Foundation: Now uses direct overwrite (105-165) to fix the "watery abyss".
 * [FIXED] Spawn Safety: Guaranteed 10x10 dry plaza at (128, 128).
 * [FIXED] Tile IDs: Synchronized all house IDs with Registry (wal -> house-wall).
 * [FIXED] River Diverge: Town center now overwrites river start points for safety.
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
    hole: 'hol',
    empty: '...',
    basalt: 'bas',
    lava: 'lav',
    cloud: 'cld',
    pavement: 'pav'
};

const ENEMIES = {
    rat: 'rak',
    skeleton: 'skl',
    goblin: 'gob',
    orc: 'orc',
    dragon: 'dra'
};

function createLayer(fill = SYMBOLS.empty) {
    return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(fill));
}

const levels = {
    "3":  createLayer(SYMBOLS.empty),
    "2":  createLayer(SYMBOLS.empty),
    "1":  createLayer(SYMBOLS.empty),
    "0":  createLayer(SYMBOLS.water),
    "-1": createLayer(SYMBOLS.mountain),
    "-2": createLayer(SYMBOLS.mountain),
    "-3": createLayer(SYMBOLS.mountain),
    "-4": createLayer(SYMBOLS.mountain)
};

// --- PHASE 1: BASE TERRAIN ---
console.log("Generating Base Geometry...");
for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
        const dx = x - WIDTH/2;
        const dy = y - HEIGHT/2;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const beachWidth = 8;
        const baseRadius = 110 + Math.sin(x/15)*5 + Math.cos(y/15)*5;

        if (dist < baseRadius) {
            if (y < 65) levels["0"][y][x] = SYMBOLS.snw;
            else if (dist < baseRadius - beachWidth) levels["0"][y][x] = SYMBOLS.grass;
            else levels["0"][y][x] = SYMBOLS.sand;
        }
    }
}

// --- PHASE 2: RIVERS ---
console.log("Simulating Rivers...");
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
createWideRiver(128, 128, 1, 0.5, 120);
createWideRiver(128, 128, -1, 0.8, 120);

// --- PHASE 3: TOWN (THE OVERWRITE FIX) ---
console.log("Establishing Solid Town Foundation...");
for(let y=100; y<175; y++) {
    for(let x=100; x<175; x++) {
        // FORCE CONCRETE: Don't check for grass, just build the island floor
        levels["0"][y][x] = SYMBOLS.pavement;
    }
}

/**
 * Ensures valid landing tiles for Z transitions.
 */
function ensureSafeTransition(fromZ, toZ, x, y, dir) {
    const targetLayer = levels[toZ.toString()];
    if (!targetLayer) return;

    const isArchitectural = (fromZ >= 0 && toZ >= 0);

    if (dir === "down") {
        targetLayer[y][x] = isArchitectural ? SYMBOLS.floor : (toZ === 0 ? SYMBOLS.pavement : SYMBOLS.floor);
        if (y+1 < HEIGHT) {
            targetLayer[y+1][x] = isArchitectural ? SYMBOLS.floor : (toZ === 0 ? SYMBOLS.pavement : SYMBOLS.floor);
        }
    } else {
        targetLayer[y][x] = isArchitectural ? SYMBOLS.floor : (toZ === 0 ? SYMBOLS.pavement : SYMBOLS.floor);
        if (y-1 >= 0) {
            targetLayer[y-1][x] = isArchitectural ? SYMBOLS.floor : (toZ === 0 ? SYMBOLS.pavement : SYMBOLS.floor);
        }
    }
}

function buildHouse(sx, sy, w, h, floors) {
    for (let i = 0; i < floors; i++) {
        const z = i.toString(); const rx = sx; const ry = sy - i;
        for (let y = ry; y < ry + h; y++) {
            for (let x = rx; x < rx + w; x++) {
                const wall = (x === rx || x === rx+w-1 || y === ry || y === ry+h-1);
                if (wall) levels[z][y][x] = (i === 0 && y === ry+h-1 && x === Math.floor(rx+w/2)) ? SYMBOLS.floor : SYMBOLS.wall;
                else levels[z][y][x] = SYMBOLS.floor;

                if (i < floors-1 && x === rx+2 && y === ry+2) {
                    levels[z][y][x] = SYMBOLS.stair_up;
                    ensureSafeTransition(i, i+1, x, y, "up");
                }
                if (i > 0 && x === rx+2 && y === ry+3) {
                    levels[z][y][x] = SYMBOLS.stair_down;
                    ensureSafeTransition(i, i-1, x, y, "down");
                }
                if (i === floors-1) {
                    const roofZ = (i+1).toString();
                    if (levels[roofZ]) levels[roofZ][y-1][x] = SYMBOLS.roof;
                }
            }
        }
    }
}
for(let i=0; i<3; i++) for(let j=0; j<3; j++) buildHouse(115+i*15, 115+j*15, 7, 7, (i+j)%2+1 === 1 ? 2 : 3);

// --- PHASE 4: ORGANIC CAVES ---
console.log("Digging Organic Caves...");
function digOrganicCaves(z) {
    const layer = levels[z];
    for (let y = 1; y < HEIGHT-1; y++) {
        for (let x = 1; x < WIDTH-1; x++) {
            layer[y][x] = (Math.random() < 0.45) ? SYMBOLS.floor : SYMBOLS.mountain;
            if (z === "-4" && layer[y][x] === SYMBOLS.floor) {
                layer[y][x] = (Math.random() < 0.1) ? SYMBOLS.lava : SYMBOLS.basalt;
            }
        }
    }

    for (let i = 0; i < 5; i++) {
        const temp = layer.map(row => [...row]);
        for (let y = 1; y < HEIGHT-1; y++) {
            for (let x = 1; x < WIDTH-1; x++) {
                let wallCount = 0;
                for (let oy = -1; oy <= 1; oy++) {
                    for (let ox = -1; ox <= 1; ox++) {
                        if (temp[y+oy][x+ox] === SYMBOLS.mountain) wallCount++;
                    }
                }
                if (wallCount >= 5) layer[y][x] = SYMBOLS.mountain;
                else {
                    if (z === "-4") {
                         layer[y][x] = (layer[y][x] === SYMBOLS.lava) ? SYMBOLS.lava : SYMBOLS.basalt;
                    } else {
                         layer[y][x] = SYMBOLS.floor;
                    }
                }
            }
        }
    }
}
for(let z of ["-1","-2","-3","-4"]) digOrganicCaves(z);

console.log("Establishing Cave Links...");
function createCaveLinks() {
    for (let y = 30; y < HEIGHT-30; y+= 12) {
        for (let x = 30; x < WIDTH-30; x+= 12) {
            // Only place cave mouths OUTSIDE the town center
            if (x < 100 || x > 175 || y < 100 || y > 175) {
                if (levels["0"][y][x] === SYMBOLS.grass) {
                    let nearMnt = false;
                    for(let oy=-3; oy<=3; oy++) for(let ox=-3; ox<=3; ox++) if(levels["0"][y+oy][x+ox] === SYMBOLS.mountain) nearMnt = true;

                    if (nearMnt && Math.random() < 0.3) {
                        levels["0"][y][x] = SYMBOLS.hole;
                        levels["-1"][y][x] = SYMBOLS.stair_up;
                        ensureSafeTransition(0, -1, x, y, "down");
                        ensureSafeTransition(-1, 0, x, y, "up");
                        levels["0"][y][x-1] = SYMBOLS.rock; levels["0"][y][x+1] = SYMBOLS.rock;
                        levels["0"][y-1][x] = SYMBOLS.rock; levels["0"][y+1][x] = SYMBOLS.rock;
                    }
                }
            }
        }
    }

    const caveLevels = ["-1", "-2", "-3"];
    caveLevels.forEach(z => {
        const nextZ = (parseInt(z) - 1).toString();
        let links = 0;
        for(let attempt=0; attempt<2000 && links<20; attempt++) {
            const rx = Math.floor(Math.random()*(WIDTH-4))+2;
            const ry = Math.floor(Math.random()*(HEIGHT-4))+2;
            if (levels[z][ry][rx] === SYMBOLS.floor && levels[nextZ][ry][rx] !== SYMBOLS.empty) {
                levels[z][ry][rx] = SYMBOLS.stair_down;
                levels[nextZ][ry][rx] = SYMBOLS.stair_up;
                ensureSafeTransition(z, nextZ, rx, ry, "down");
                ensureSafeTransition(nextZ, z, rx, ry, "up");
                links++;
            }
        }
    });
}
createCaveLinks();

// --- PHASE 5: MONSTERS & SPAWN ---
console.log("Scattering Entities & Cleaning Plaza...");
const entities = { 
    "ply": { type: "player", under: "grs" },
    "rak": { type: "enemy", id: "rat", under: "pav" },
    "skl": { type: "enemy", id: "skeleton", under: "flr" },
    "gob": { type: "enemy", id: "goblin", under: "flr" },
    "orc": { type: "enemy", id: "orc", under: "flr" },
    "dra": { type: "enemy", id: "dragon", under: "flr" }
};

function scatterEnemies(z, density, types) {
    const layer = levels[z];
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            const isTarget = (layer[y][x] === SYMBOLS.grass || layer[y][x] === SYMBOLS.floor || layer[y][x] === SYMBOLS.basalt || layer[y][x] === SYMBOLS.pavement);
            if (isTarget) {
                // EXCLUSION RULE: No enemies in Town at Level 0
                if (z === "0" && x >= 100 && x <= 175 && y >= 100 && y <= 175) continue;
                if (Math.random() < density) {
                    const type = types[Math.floor(Math.random() * types.length)];
                    layer[y][x] = type;
                }
            }
        }
    }
}
scatterEnemies("0", 0.003, [ENEMIES.rat]);
scatterEnemies("-1", 0.015, [ENEMIES.skeleton, ENEMIES.goblin]);
scatterEnemies("-4", 0.04, [ENEMIES.orc, ENEMIES.dragon]);

// CLEAN SPAWN PLAZA (128, 128)
for(let dy=-5; dy<=5; dy++) {
    for(let dx=-5; dx<=5; dx++) {
        levels["0"][128+dy][128+dx] = SYMBOLS.pavement;
    }
}
levels["0"][128][128] = 'ply';

// MANDATORY: Ensure 'color' is defined for Minimap/WorldMap support.
const tileDefinitions = {
    "grs": { id: "grass", color: "#4ade80" }, "pth": { id: "grass-path", color: "#4ade80" },
    "tre": { id: "tree", block: true, under: "grs", color: "#166534" },
    "rok": { id: "rock", block: true, under: "grs", color: "#525252" },
    "snd": { id: "sand", color: "#fde047" }, "wat": { id: "water", block: true, color: "#3b82f6" },
    "snw": { id: "snow", color: "#ffffff" }, "flr": { id: "floor", color: "#8b4513" },
    "wal": { id: "house-wall", block: true, color: "#5a3825" }, "rof": { id: "red-roof", color: "#ef4444" },
    "sup": { id: "stair_up", transition: "up", under: "flr", color: "#8b4513" },
    "sdn": { id: "stair_down", transition: "down", under: "flr", color: "#8b4513" },
    "hol": { id: "hole", under: "grs", color: "#171717" },
    "bas": { id: "basalt", color: "#262626" }, "lav": { id: "lava", block: true, color: "#ef4444" },
    "cld": { id: "cloud", color: "#ffffff" }, "mnt": { id: "mountain", block: true, color: "#404040" },
    "pav": { id: "pavement", color: "#808080" }
};

const dirs = ['n','s','e','w','nw','ne','sw','se'];
dirs.forEach(d => {
    tileDefinitions[`grs_wat_${d}`] = { id: `grs_wat_${d}`, block: true };
    tileDefinitions[`grs_snd_${d}`] = { id: `grs_snd_${d}` };
    tileDefinitions[`pth_wat_${d}`] = { id: `pth_wat_${d}`, block: true };
});

const mapData = {
    tileSize: 32, tiles: tileDefinitions, entities,
    levels: {
        "3": { map: levels["3"] }, "2": { map: levels["2"] }, "1": { map: levels["1"] },
        "0": { playerPos: { x: 128*32, y: 128*32 }, map: levels["0"] },
        "-1": { map: levels["-1"] }, "-2": { map: levels["-2"] },
        "-3": { map: levels["-3"] }, "-4": { map: levels["-4"] }
    }
};

fs.writeFileSync('public/newmap.json', JSON.stringify(mapData));
console.log("v2.46 WORLD GENERATED (Solid Foundation, Dry Spawn)!");
