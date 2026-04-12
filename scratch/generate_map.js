const fs = require('fs');
const { createNoise2D } = require('simplex-noise');

/**
 * 🌎 ADVANCED PROCEDURAL WORLD ENGINE v3.5 - ORGANIC MASSIVE WORLD
 * --------------------------------------------------
 * [NEW] Tri-Noise System: Elevation, Moisture, and Forest maps.
 * [NEW] Physical Z-Axis Altitude: Real mountains on levels 1, 2, and 3.
 * [NEW] Organic Forests: Trees as entities with random scale/rotation.
 * [NEW] Auto-Ramp Stairs: Navigable elevation transitions.
 */

const noiseElevation = createNoise2D();
const noiseMoisture = createNoise2D();
const noiseForest = createNoise2D();

const WIDTH = 256;
const HEIGHT = 256;

// Adjustment Variables (Zoom)
const SCALE_ELEVATION = 120;
const SCALE_MOISTURE = 180;
const SCALE_FOREST = 50;

const SYMBOLS = {
    grass: 'grs', path: 'pth', tree: 'tre', rock: 'rok', sand: 'snd', water: 'wat',
    snow: 'snw', floor: 'flr', wall: 'wal', mountain: 'mnt', roof: 'rof',
    stair_up: 'sup', stair_down: 'sdn', hole: 'hol', empty: '...',
    basalt: 'bas', lava: 'lav', cloud: 'cld', pavement: 'pav',
    dungeon_floor: 'dfn', dungeon_wall: 'dwl'
};

function createLayer(fill = SYMBOLS.empty) {
    return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(fill));
}

const levels = {
    "3":  createLayer(SYMBOLS.empty),
    "2":  createLayer(SYMBOLS.empty),
    "1":  createLayer(SYMBOLS.empty),
    "0":  createLayer(SYMBOLS.water),
    "-1": createLayer(SYMBOLS.dungeon_wall),
    "-2": createLayer(SYMBOLS.dungeon_wall),
    "-3": createLayer(SYMBOLS.dungeon_wall),
    "-4": createLayer(SYMBOLS.dungeon_wall)
};

const levelEntities = {
    "3": [], "2": [], "1": [], "0": [], "-1": [], "-2": [], "-3": [], "-4": []
};

function spawnActor(z, x, y, symbol, extra = {}) {
    if (!levelEntities[z]) levelEntities[z] = [];
    levelEntities[z].push({ x, y, symbol, ...extra });
}

// --- PHASE 1: ORGANIC TERRAIN SHAPING ---
console.log("Shaping Organic Continents and Altitudes...");
const heightMap = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(0));

for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
        // 1. Noise Sampling
        let e = (noiseElevation(x / SCALE_ELEVATION, y / SCALE_ELEVATION) + 1) / 2;
        let m = (noiseMoisture(x / SCALE_MOISTURE, y / SCALE_MOISTURE) + 1) / 2;

        // 2. Radial Mask (Island preservation)
        const dx = (x - WIDTH/2) / (WIDTH/2);
        const dy = (y - HEIGHT/2) / (HEIGHT/2);
        const dist = Math.sqrt(dx*dx + dy*dy);
        e = (e + (1 - dist * 1.2)) / 2;
        e = Math.max(0, Math.min(1, e));

        // 3. Altitude Tiering (Z 0 to 3)
        let H = 0;
        let biome = SYMBOLS.water;

        if (e < 0.42) {
            biome = SYMBOLS.water; H = 0;
        } else if (e < 0.48) {
            biome = SYMBOLS.sand; H = 0;
        } else if (e < 0.70) {
            biome = SYMBOLS.grass; H = 0;
        } else if (e < 0.82) {
            biome = SYMBOLS.grass; H = 1; // Highlands
        } else if (e < 0.92) {
            biome = (m > 0.6) ? SYMBOLS.snow : SYMBOLS.mountain; 
            H = 2; // Mid Mountains
        } else {
            biome = SYMBOLS.snow; H = 3; // High Peaks
        }

        heightMap[y][x] = H;

        // 4. Populate Physical Layers (Solid Stack)
        for (let z = 0; z <= H; z++) {
            let symbol = biome;
            // Lower layers of mountains should be mountain tiles or grass
            if (z < H) {
                symbol = (biome === SYMBOLS.snow || biome === SYMBOLS.mountain) ? SYMBOLS.mountain : SYMBOLS.grass;
            }
            levels[z.toString()][y][x] = symbol;
        }
    }
}

// --- PHASE 1.1: NAVIGABLE RAMPS (Auto-Stairs) ---
console.log("Placing Navigable Ramps...");
for (let y = 1; y < HEIGHT - 1; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
        const h = heightMap[y][x];
        // Check neighbors for height changes
        const neighbors = [[1,0], [-1,0], [0,1], [0,-1]];
        for (const [ox, oy] of neighbors) {
            const nh = heightMap[y+oy][x+ox];
            if (nh === h + 1 && Math.random() < 0.15) { // 15% chance at borders to avoid stair spam
                levels[h.toString()][y][x] = SYMBOLS.stair_up;
                levels[nh.toString()][y+oy][x+ox] = SYMBOLS.stair_down;
                // Ensure safe landings
                levels[h.toString()][y+oy][x+ox] = SYMBOLS.grass;
                levels[nh.toString()][y][x] = (nh >= 2) ? SYMBOLS.mountain : SYMBOLS.grass;
                break; 
            }
        }
    }
}

// --- PHASE 1.2: ORGANIC FORESTS (Entity Injection) ---
console.log("Planting Organic Forests...");
for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
        const h = heightMap[y][x];
        const biome = levels[h.toString()][y][x];
        
        if (biome === SYMBOLS.grass && (x < 100 || x > 175 || y < 100 || y > 175)) {
            const f = (noiseForest(x / SCALE_FOREST, y / SCALE_FOREST) + 1) / 2;
            
            // NEW: Sub-sampling (34% chance) inside the noise-defined forest zones
            // Plus random jitter (offX/offY) to escape the grid
            if (f > 0.62 && Math.random() < 0.34) {
                const scale = 0.85 + Math.random() * 0.5;
                const rotation = -0.15 + Math.random() * 0.3;
                const offX = (Math.random() - 0.5) * 0.8; // Up to 80% tile width offset
                const offY = (Math.random() - 0.5) * 0.8;
                spawnActor(h.toString(), x, y, "tre", { scale, rotation, offX, offY });
            }
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
console.log("Establishing Town Foundation...");
for(let y=100; y<175; y++) {
    for(let x=100; x<175; x++) {
        levels["0"][y][x] = SYMBOLS.pavement;
    }
}

function ensureSafeTransition(toZ, x, y) {
    const targetLayer = levels[toZ.toString()];
    if (!targetLayer) return;
    const isSub = (parseInt(toZ) < 0);
    const safeTile = isSub ? SYMBOLS.dungeon_floor : SYMBOLS.floor;
    for (let dy = -1; dy <= 1; dy++) {
        if (y + dy >= 0 && y + dy < HEIGHT) targetLayer[y + dy][x] = safeTile;
    }
}

function buildHouse(sx, sy, w, h, floors) {
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
    for (let i = 0; i < floors - 1; i++) {
        const shaftX = (i % 2 === 0) ? sx + 2 : sx + 4;
        const stairY_current = sy - i + 2;     
        const stairY_next = sy - (i+1) + 2;    
        ensureSafeTransition((i+1).toString(), shaftX, stairY_next);
        levels[i.toString()][stairY_current][shaftX] = SYMBOLS.stair_up;
        levels[(i+1).toString()][stairY_next][shaftX] = SYMBOLS.stair_down;
    }
}
for(let i=0; i<3; i++) for(let j=0; j<3; j++) buildHouse(110+i*22, 110+j*22, 7, 7, (i+j)%2+1 === 1 ? 2 : 3);

// --- PHASE 4: ORGANIC CAVES ---
console.log("Digging Organic Caves...");
function digOrganicCaves(z) {
    const layer = levels[z];
    const density = (z === "-1" || z === "-2") ? 0.48 : 0.42;
    for (let y = 1; y < HEIGHT-1; y++) {
        for (let x = 1; x < WIDTH-1; x++) {
            layer[y][x] = (Math.random() < density) ? SYMBOLS.dungeon_floor : SYMBOLS.dungeon_wall;
            if ((z === "-3" || z === "-4") && layer[y][x] === SYMBOLS.dungeon_floor) {
                const rand = Math.random();
                layer[y][x] = rand < 0.08 ? SYMBOLS.lava : (rand < 0.6 ? SYMBOLS.basalt : SYMBOLS.dungeon_floor);
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
                        if (temp[y+oy][x+ox] === SYMBOLS.dungeon_wall) wallCount++;
                    }
                }
                if (wallCount >= 5) layer[y][x] = SYMBOLS.dungeon_wall;
                else layer[y][x] = (z === "-3" || z === "-4") ? SYMBOLS.basalt : SYMBOLS.dungeon_floor;
            }
        }
    }
}
for(let z of ["-1","-2","-3","-4"]) digOrganicCaves(z);

console.log("Establishing Reinforced Dungeon Links...");
function createCaveLinks() {
    for (let i = 0; i < 60; i++) {
        const rx = Math.floor(Math.random() * (WIDTH-20)) + 10;
        const ry = Math.floor(Math.random() * (HEIGHT-20)) + 10;
        if (levels["0"][ry][rx] === SYMBOLS.grass) {
            ensureSafeTransition("0", rx, ry);
            ensureSafeTransition("-1", rx, ry);
            levels["0"][ry][rx] = SYMBOLS.hole;
            levels["-1"][ry][rx] = SYMBOLS.stair_up;
        }
    }
    ["-1", "-2", "-3"].forEach(z => {
        const nextZ = (parseInt(z) - 1).toString();
        let links = 0;
        for(let attempt=0; attempt<3000 && links<45; attempt++) {
            const rx = Math.floor(Math.random()*(WIDTH-4))+2;
            const ry = Math.floor(Math.random()*(HEIGHT-4))+2;
            if (levels[z][ry][rx] !== SYMBOLS.empty && levels[nextZ][ry][rx] !== SYMBOLS.empty) {
                ensureSafeTransition(z, rx, ry);
                ensureSafeTransition(nextZ, rx, ry);
                levels[z][ry][rx] = SYMBOLS.stair_down;
                levels[nextZ][ry][rx] = SYMBOLS.stair_up;
                links++;
            }
        }
    });
}
createCaveLinks();

// --- PHASE 5: ENTITIES ---
console.log("Scattering Actors and Rewards...");
function scatterActors(z, density, symbols) {
    const layer = levels[z];
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            if (z === "0" && x >= 100 && x <= 175 && y >= 100 && y <= 175) continue;
            const isWalkable = (layer[y][x] === SYMBOLS.grass || layer[y][x] === SYMBOLS.floor || layer[y][x] === SYMBOLS.basalt || layer[y][x] === SYMBOLS.pavement || layer[y][x] === SYMBOLS.dungeon_floor);
            if (isWalkable && Math.random() < density) {
                const s = symbols[Math.floor(Math.random() * symbols.length)];
                spawnActor(z, x, y, s);
            }
        }
    }
}
scatterActors("0", 0.003, ["rak"]);
scatterActors("-1", 0.012, ["skl", "gob", "chs"]);
scatterActors("-2", 0.015, ["skl", "gob", "chs"]);
scatterActors("-3", 0.02, ["orc", "chs"]);
scatterActors("-4", 0.035, ["orc", "dra", "chs"]);

spawnActor("0", 128, 128, "ply");
for(let dy=-5; dy<=5; dy++) for(let dx=-5; dx<=5; dx++) levels["0"][128+dy][128+dx] = SYMBOLS.pavement;

const tileDefinitions = {
    "grs": { id: "grass", color: "#4ade80" }, "pth": { id: "grass-path", color: "#458B00" },
    "tre": { id: "tree", block: true, color: "#166534" }, "rok": { id: "rock", block: true, color: "#525252" },
    "snd": { id: "sand", color: "#fde047" }, "wat": { id: "water", block: true, color: "#3b82f6" },
    "snw": { id: "snow", color: "#ffffff" }, "flr": { id: "floor", color: "#8b4513" },
    "wal": { id: "house-wall", block: true, color: "#5a3825" }, "rof": { id: "red-roof", color: "#ef4444" },
    "sup": { id: "stair_up", color: "#daa520", transition: "up" }, "sdn": { id: "stair_down", color: "#daa520", transition: "down" },
    "hol": { id: "hole", color: "#262626", transition: "down" }, "lav": { id: "lava", block: true, color: "#ff4500" }, 
    "cld": { id: "cloud", color: "#ffffff" }, "mnt": { id: "mountain", block: true, color: "#404040" }, 
    "pav": { id: "pavement", color: "#808080" }, "dfn": { id: "dungeon-floor", color: "#334155" }, 
    "dwl": { id: "dungeon-wall", block: true, color: "#1e293b" }
};

const finalEntitiesTemplates = { 
    "ply": { type: "player" }, "rak": { type: "enemy", id: "rat" },
    "skl": { type: "enemy", id: "skeleton" }, "gob": { type: "enemy", id: "goblin" },
    "orc": { type: "enemy", id: "orc" }, "dra": { type: "enemy", id: "dragon" },
    "chs": { type: "item", id: "chest" },
    "tre": { type: "decoration", id: "tree" }
};

const mapData = { tileSize: 32, tiles: tileDefinitions, entities: finalEntitiesTemplates, levels: {} };
for (const z in levels) {
    mapData.levels[z] = { map: levels[z], entities: levelEntities[z] };
    if (z === "0") mapData.levels[z].playerPos = { x: 128*32, y: 128*32 };
}

fs.writeFileSync('public/newmap.json', JSON.stringify(mapData));
console.log("v3.50 WORLD GENERATED (Organic Continents & Z-Axis Peaks)!");
