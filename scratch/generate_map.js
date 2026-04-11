const fs = require('fs');

/**
 * ⚠️ AI MANDATORY INSTRUCTION ⚠️
 * BEFORE modifying this file, you MUST read and adhere to:
 * docs/contracts/GENERATOR_CONTRACT.md
 * --------------------------------------------------
 * 🌎 ADVANCED PROCEDURAL WORLD ENGINE v2.50 - ASCENSÃO
 * --------------------------------------------------
 * [FIXED] House Stairs: Coordinates are now GLOBAL (rx+2, sy+2) to ensure perfect pairing.
 * [FIXED] Cave Entrances: Increased density and guaranteed links from surface to abyss.
 * [ARCH] Entity Separation: Actors are now moved to a dedicated 'entities' array per level.
 * [FIXED] Biome Respect: Ground is no longer overwritten by entity symbols!
 */

const WIDTH = 256;
const HEIGHT = 256;

const SYMBOLS = {
    grass: 'grs', path: 'pth', tree: 'tre', rock: 'rok', sand: 'snd', water: 'wat',
    snow: 'snw', floor: 'flr', wall: 'wal', mountain: 'mnt', roof: 'rof',
    stair_up: 'sup', stair_down: 'sdn', hole: 'hol', empty: '...',
    basalt: 'bas', lava: 'lav', cloud: 'cld', pavement: 'pav'
};

const ENEMIES = {
    rat: 'rak', skeleton: 'skl', goblin: 'gob', orc: 'orc', dragon: 'dra'
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

// NEW: Entity management per level
const levelEntities = {
    "3": [], "2": [], "1": [], "0": [], "-1": [], "-2": [], "-3": [], "-4": []
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

// --- PHASE 3: TOWN ---
console.log("Establishing Solid Town Foundation...");
for(let y=100; y<175; y++) {
    for(let x=100; x<175; x++) {
        levels["0"][y][x] = SYMBOLS.pavement;
    }
}

function ensureSafeTransition(toZ, x, y) {
    const targetLayer = levels[toZ.toString()];
    if (!targetLayer) return;
    // Clear a 3-tile vertical strip to ensure safe landing North or South
    for (let dy = -1; dy <= 1; dy++) {
        if (y + dy >= 0 && y + dy < HEIGHT) {
            targetLayer[y + dy][x] = SYMBOLS.floor;
        }
    }
}

function buildHouse(sx, sy, w, h, floors) {
    // 1. First, build all floors and walls
    for (let i = 0; i < floors; i++) {
        const z = i.toString(); 
        const ry = sy - i;
        for (let y = ry; y < ry + h; y++) {
            for (let x = sx; x < sx + w; x++) {
                const wall = (x === sx || x === sx+w-1 || y === ry || y === ry+h-1);
                if (wall) levels[z][y][x] = (i === 0 && y === ry+h-1 && x === Math.floor(sx+w/2)) ? SYMBOLS.floor : SYMBOLS.wall;
                else levels[z][y][x] = SYMBOLS.floor;

                if (i === floors-1) {
                    const roofZ = (i+1).toString();
                    if (levels[roofZ]) levels[roofZ][y-1][x] = SYMBOLS.roof;
                }
            }
        }
    }

    // 2. Then, place all stairs (prevents overwriting and SOFTLOCKS)
    // MANDATORY Standard: Alternate stair shafts per level (X+2 and X+4)
    // to prevent overlap in buildings with 3+ floors.
    for (let i = 0; i < floors - 1; i++) {
        // Alternate shaft based on floor parity
        const shaftX = (i % 2 === 0) ? sx + 2 : sx + 4;
        
        const stairY_current = sy - i + 2;     
        const stairY_next = sy - (i+1) + 2;    

        // 1. CLEAR LANDING ZONES FIRST (Prevention Pass)
        ensureSafeTransition((i+1).toString(), shaftX, stairY_next);

        // 2. PLACE STAIRS SECOND (Final Pass)
        // Level i: Stair UP (leads to level i+1)
        levels[i.toString()][stairY_current][shaftX] = SYMBOLS.stair_up;

        // Level i+1: Stair DOWN (leads back to level i)
        levels[(i+1).toString()][stairY_next][shaftX] = SYMBOLS.stair_down;
    }
}
console.log("Building Houses with Aligned Stairs...");
for(let i=0; i<3; i++) for(let j=0; j<3; j++) buildHouse(110+i*22, 110+j*22, 7, 7, (i+j)%2+1 === 1 ? 2 : 3);

// --- PHASE 4: ORGANIC CAVES ---
console.log("Digging Organic Caves...");
function digOrganicCaves(z) {
    const layer = levels[z];
    for (let y = 1; y < HEIGHT-1; y++) {
        for (let x = 1; x < WIDTH-1; x++) {
            layer[y][x] = (Math.random() < 0.45) ? SYMBOLS.floor : SYMBOLS.mountain;
            if (z === "-4" && layer[y][x] === SYMBOLS.floor) layer[y][x] = (Math.random() < 0.1) ? SYMBOLS.lava : SYMBOLS.basalt;
        }
    }
    for (let i = 0; i < 5; i++) {
        const temp = layer.map(row => [...row]);
        for (let y = 1; y < HEIGHT-1; y++) {
            for (let x = 1; x < WIDTH-1; x++) {
                let wallCount = 0;
                for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (temp[y+oy][x+ox] === SYMBOLS.mountain) wallCount++;
                if (wallCount >= 5) layer[y][x] = SYMBOLS.mountain;
                else layer[y][x] = (z === "-4") ? (layer[y][x] === SYMBOLS.lava ? SYMBOLS.lava : SYMBOLS.basalt) : SYMBOLS.floor;
            }
        }
    }
}
for(let z of ["-1","-2","-3","-4"]) digOrganicCaves(z);

console.log("Establishing Cave Links...");
function createCaveLinks() {
    // 1. Surface -> -1 (Holes)
    for (let i = 0; i < 60; i++) {
        const rx = Math.floor(Math.random() * (WIDTH-20)) + 10;
        const ry = Math.floor(Math.random() * (HEIGHT-20)) + 10;
        if (levels["0"][ry][rx] === SYMBOLS.grass) {
            levels["0"][ry][rx] = SYMBOLS.hole;
            levels["-1"][ry][rx] = SYMBOLS.stair_up;
            ensureSafeTransition("-1", rx, ry);
        }
    }

    // 2. Subterranean Continuity (-1 to -4)
    ["-1", "-2", "-3"].forEach(z => {
        const nextZ = (parseInt(z) - 1).toString();
        let links = 0;
        for(let attempt=0; attempt<3000 && links<40; attempt++) {
            const rx = Math.floor(Math.random()*(WIDTH-4))+2;
            const ry = Math.floor(Math.random()*(HEIGHT-4))+2;
            if (levels[z][ry][rx] === SYMBOLS.floor && levels[nextZ][ry][rx] !== SYMBOLS.empty) {
                levels[z][ry][rx] = SYMBOLS.stair_down;
                levels[nextZ][ry][rx] = SYMBOLS.stair_up;
                ensureSafeTransition(nextZ, rx, ry);
                links++;
            }
        }
    });
}
createCaveLinks();

// --- PHASE 5: ENTITIES (NOW DECOUPLED) ---
console.log("Scattering Actors (Decoupled Layer)...");

// Registry for item and actor templates
const ENTITY_TEMPLATES = { 
    "ply": { type: "player" }, 
    "rak": { type: "enemy", id: "rat" },
    "skl": { type: "enemy", id: "skeleton" }, 
    "gob": { type: "enemy", id: "goblin" },
    "orc": { type: "enemy", id: "orc" }, 
    "dra": { type: "enemy", id: "dragon" },
    "chs": { type: "item", id: "chest" }
};

function spawnActor(z, x, y, symbol) {
    if (!levelEntities[z]) levelEntities[z] = [];
    levelEntities[z].push({ x, y, symbol });
}

function scatterActors(z, density, symbols) {
    const layer = levels[z];
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            // No monsters in town at Level 0
            if (z === "0" && x >= 100 && x <= 175 && y >= 100 && y <= 175) continue;
            
            const isWalkable = (layer[y][x] === SYMBOLS.grass || layer[y][x] === SYMBOLS.floor || layer[y][x] === SYMBOLS.basalt || layer[y][x] === SYMBOLS.pavement);
            if (isWalkable && Math.random() < density) {
                const s = symbols[Math.floor(Math.random() * symbols.length)];
                spawnActor(z, x, y, s);
            }
        }
    }
}

// Global Spawning
scatterActors("0", 0.003, ["rak"]);
scatterActors("-1", 0.015, ["skl", "gob"]);
scatterActors("-4", 0.04, ["orc", "dra"]);

// Player Initial Position (Level 0, decoupled)
spawnActor("0", 128, 128, "ply");

// CLEAN SPAWN PLAZA (Terrain Only - No logic overlap with player entity)
for(let dy=-5; dy<=5; dy++) for(let dx=-5; dx<=5; dx++) levels["0"][128+dy][128+dx] = SYMBOLS.pavement;

const tileDefinitions = {
    "grs": { id: "grass", color: "#4ade80" }, "pth": { id: "grass-path", color: "#458B00" },
    "tre": { id: "tree", block: true, color: "#166534" }, "rok": { id: "rock", block: true, color: "#525252" },
    "snd": { id: "sand", color: "#fde047" }, "wat": { id: "water", block: true, color: "#3b82f6" },
    "snw": { id: "snow", color: "#ffffff" }, "flr": { id: "floor", color: "#8b4513" },
    "wal": { id: "house-wall", block: true, color: "#5a3825" }, "rof": { id: "red-roof", color: "#ef4444" },
    "sup": { id: "stair_up", color: "#daa520", transition: "up" }, 
    "sdn": { id: "stair_down", color: "#daa520", transition: "down" },
    "hol": { id: "hole", color: "#171717", transition: "down" }, 
    "lav": { id: "lava", block: true, color: "#ff4500" }, "cld": { id: "cloud", color: "#ffffff" },
    "mnt": { id: "mountain", block: true, color: "#404040" }, "pav": { id: "pavement", color: "#808080" }
};

const finalEntitiesTemplates = { 
    "ply": { type: "player" }, "rak": { type: "enemy", id: "rat" },
    "skl": { type: "enemy", id: "skeleton" }, "gob": { type: "enemy", id: "goblin" },
    "orc": { type: "enemy", id: "orc" }, "dra": { type: "enemy", id: "dragon" }
};

const mapData = {
    tileSize: 32, tiles: tileDefinitions, entities: finalEntitiesTemplates,
    levels: {}
};

for (const z in levels) {
    mapData.levels[z] = {
        map: levels[z],
        entities: levelEntities[z]
    };
    if (z === "0") mapData.levels[z].playerPos = { x: 128*32, y: 128*32 };
}

fs.writeFileSync('public/newmap.json', JSON.stringify(mapData));
console.log("v2.50 WORLD GENERATED (Aligned Stairs & Independent Actors)!");
