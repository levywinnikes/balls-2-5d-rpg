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

const WIDTH = 1024;
const HEIGHT = 1024;

// Adjustment Variables (Zoom Out for 1024x1024)
const SCALE_ELEVATION = 480; 
const SCALE_MOISTURE = 720;
const SCALE_FOREST = 200;

const SYMBOLS = {
    grass: 'grs', path: 'pth', tree: 'tre', rock: 'rok', sand: 'snd', water: 'wat',
    snow: 'snw', floor: 'flr', wall: 'wal', mountain: 'mnt', roof: 'rof',
    stair_up: 'sup', stair_down: 'sdn', hole: 'hol', empty: '...',
    basalt: 'bas', lava: 'lav', cloud: 'cld', pavement: 'pav',
    dungeon_floor: 'dfn', dungeon_wall: 'dwl', mountain_edge: 'mte'
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
console.log("Shaping Organic Continents and Altitudes (1024x1024)...");
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
        e = (e + (1 - dist * 1.3)) / 2; // Slightly more aggressive mask for 512
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

        // 4. Populate Physical Layers (Solid Basalt foundations)
        for (let z = 0; z <= H; z++) {
            let symbol = biome;
            
            // MOUNTAIN BORDER LOGIC: If we are at the top level of a mountain and near grass
            if (z === H && (biome === SYMBOLS.mountain || biome === SYMBOLS.snow)) {
                // We'll refine this in a second pass for accuracy, 
                // but for now, we mark higher elevations as physical tiers.
            }

            // Lower layers MUST be strictly basalt (dark flat rock) for visual solidness
            if (z < H) {
                symbol = SYMBOLS.basalt;
            }
            levels[z.toString()][y][x] = symbol;
        }
    }
}

// --- PHASE 1.02: MOUNTAIN BORDERS ---
console.log("Defining Mountain Borders...");
for (let y = 1; y < HEIGHT - 1; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
        const h = heightMap[y][x];
        if (h >= 2) { // Only for mountains/snow
            const zStr = h.toString();
            const currentTile = levels[zStr][y][x];
            if (currentTile === SYMBOLS.mountain || currentTile === SYMBOLS.snow) {
                // Check neighbors on the same level
                let isEdge = false;
                for (let oy = -1; oy <= 1; oy++) {
                    for (let ox = -1; ox <= 1; ox++) {
                        if (heightMap[y + oy][x + ox] < h) {
                            isEdge = true; break;
                        }
                    }
                    if (isEdge) break;
                }
                if (isEdge) {
                    levels[zStr][y][x] = SYMBOLS.mountain_edge;
                }
            }
        }
    }
}

// --- PHASE 1.05: CLIFF SCAN (2.5D Depth Fix) ---
console.log("Reinforcing South-Facing Cliffs...");
for (let y = 0; y < HEIGHT - 1; y++) {
    for (let x = 0; x < WIDTH; x++) {
        const h = heightMap[y][x];
        const hSouth = heightMap[y+1][x];
        
        // If current tile is higher than the southern neighbor, 
        // intermediate levels at current (x,y) should show DURABLE stone walls
        if (h > hSouth) {
            for (let z = hSouth + 1; z <= h; z++) {
                levels[z.toString()][y][x] = SYMBOLS.dungeon_wall; // Vertical rock face
            }
        }
    }
}

// --- PHASE 1.1: NAVIGABLE RAMPS (Auto-Stairs) ---
console.log("Placing Navigable Ramps...");
for (let y = 1; y < HEIGHT - 1; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
        const h = heightMap[y][x];
        const neighbors = [[1,0], [-1,0], [0,1], [0,-1]];
        for (const [ox, oy] of neighbors) {
            const nh = heightMap[y+oy][x+ox];
            if (nh === h + 1 && Math.random() < 0.12) { 
                levels[h.toString()][y][x] = SYMBOLS.stair_up;
                levels[nh.toString()][y+oy][x+ox] = SYMBOLS.stair_down;
                
                // SAFETY: Clear landing zones (3x3 area)
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const ly = y + oy + dy; const lx = x + ox + dx;
                        if (ly >= 0 && ly < HEIGHT && lx >= 0 && lx < WIDTH) {
                            levels[nh.toString()][ly][lx] = (nh >= 2) ? SYMBOLS.mountain : SYMBOLS.grass;
                            // Ensure the landing tile is EXACTLY grass/pavement to be walkable
                            if (dy === 0 && dx === 0) levels[nh.toString()][ly][lx] = (nh >= 2) ? SYMBOLS.basalt : SYMBOLS.grass;
                        }
                    }
                }
                break; 
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
        if (Math.sqrt((cx-512)**2 + (cy-512)**2) > 460) break; // Use 1024 center
    }
}
createWideRiver(512, 512, 1, 0.5, 500);
createWideRiver(512, 512, -1, 0.8, 500);

// --- PHASE 3: ORGANIC TOWN (Urban Sprawl) ---
console.log("Expanding Organic Urban Sprawl (Thick Brush)...");
const pavementSet = new Set();
let townX = 512, townY = 512; 
let pavementCount = 0;
const TARGET_PAVEMENT = 16000; // Scaled up for 1024 map

for (let attempt = 0; attempt < 15000 && pavementCount < TARGET_PAVEMENT; attempt++) {
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            const py = townY + dy; const px = townX + dx;
            if (py >= 0 && py < HEIGHT && px >= 0 && px < WIDTH && heightMap[py][px] === 0) {
                if (!pavementSet.has(`${px},${py}`)) {
                    // TOWN PRIORITY: Overwrite water/clay with solid pavement
                    levels["0"][py][px] = SYMBOLS.pavement;
                    pavementSet.add(`${px},${py}`);
                    pavementCount++;
                }
            }
        }
    }
    const dir = Math.floor(Math.random() * 4);
    const speed = 2;
    if (dir === 0) townX+=speed; else if (dir === 1) townX-=speed; else if (dir === 2) townY+=speed; else townY-=speed;
    townX = Math.max(300, Math.min(720, townX));
    townY = Math.max(300, Math.min(720, townY));
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
                
                // Set the current floor/wall
                if (wall) levels[z][y][x] = (i === 0 && y === ry+h-1 && x === Math.floor(sx+w/2)) ? SYMBOLS.floor : SYMBOLS.wall;
                else levels[z][y][x] = SYMBOLS.floor;
                
                // ENSURE FOUNDATION: If we are constructing an upper floor, keep the interior solid on lower levels
                for (let fz = 0; fz < i; fz++) {
                    if (levels[fz.toString()][y][x] === SYMBOLS.empty) {
                        levels[fz.toString()][y][x] = SYMBOLS.floor;
                    }
                }

                if (i === floors-1) {
                    const roofZ = (i+1).toString();
                    if (levels[roofZ]) levels[roofZ][y-1][x] = SYMBOLS.roof;
                }
            }
        }
    }
    // ... rest of buildHouse logic for stairs is same ...
    for (let i = 0; i < floors - 1; i++) {
        const shaftX = (i % 2 === 0) ? sx + 2 : sx + 4;
        const stairY_current = sy - i + 2;     
        const stairY_next = sy - (i+1) + 2;    
        ensureSafeTransition((i+1).toString(), shaftX, stairY_next);
        levels[i.toString()][stairY_current][shaftX] = SYMBOLS.stair_up;
        levels[(i+1).toString()][stairY_next][shaftX] = SYMBOLS.stair_down;
    }
}

console.log("Placing Houses on Pavement...");
const houseFootprints = [];
let housesPlaced = 0;
for (let attempt = 0; attempt < 2500 && housesPlaced < 45; attempt++) {
    const w = 7, h = 7;
    const sx = Math.floor(Math.random() * 200) + 156;
    const sy = Math.floor(Math.random() * 200) + 156;
    let onPavement = true;
    for (let py = sy; py < sy + h; py++) {
        for (let px = sx; px < sx + w; px++) {
            if (!pavementSet.has(`${px},${py}`)) { onPavement = false; break; }
        }
    }
    if (!onPavement) continue;
    let overlaps = false;
    for (const f of houseFootprints) {
        if (sx < f.x2 + 2 && sx + w > f.x1 - 2 && sy < f.y2 + 2 && sy + h > f.y1 - 2) {
            overlaps = true; break;
        }
    }
    if (overlaps) continue;
    buildHouse(sx, sy, w, h, Math.random() < 0.4 ? 3 : 2);
    houseFootprints.push({ x1: sx, y1: sy, x2: sx + w, y2: sy + h });
    housesPlaced++;
}

// --- PHASE 1.2: ORGANIC FORESTS (Entity Injection) ---
console.log("Planting Organic Forests (After City)...");
for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
        const h = heightMap[y][x];
        const biome = levels[h.toString()][y][x];
        const isCity = pavementSet.has(`${x},${y}`);
        
        // Exclude city from tree generation!
        if (biome === SYMBOLS.grass && !isCity) {
            const f = (noiseForest(x / SCALE_FOREST, y / SCALE_FOREST) + 1) / 2;
            if (f > 0.62 && Math.random() < 0.34) {
                const scale = 0.85 + Math.random() * 0.5;
                const rotation = -0.15 + Math.random() * 0.3;
                const offX = (Math.random() - 0.5) * 0.8;
                const offY = (Math.random() - 0.5) * 0.8;
                spawnActor(h.toString(), x, y, "tre", { scale, rotation, offX, offY });
            }
        }
    }
}

// --- PHASE 4: ORGANIC CAVES ---
console.log("Digging Organic Caves (Expanded Rooms)...");
function digOrganicCaves(z) {
    const layer = levels[z];
    const density = (z === "-1" || z === "-2") ? 0.44 : 0.40;
    
    // 1. Random seeding
    for (let y = 1; y < HEIGHT-1; y++) {
        for (let x = 1; x < WIDTH-1; x++) {
            layer[y][x] = (Math.random() < density) ? SYMBOLS.dungeon_floor : SYMBOLS.dungeon_wall;
        }
    }

    // 2. Room Carving
    const rooms = (z === "-1" || z === "-2") ? 60 : 100;
    for(let i=0; i<rooms; i++) {
        const rw = Math.floor(Math.random()*8) + 4;
        const rh = Math.floor(Math.random()*8) + 4;
        const rx = Math.floor(Math.random()*(WIDTH-rw-2)) + 1;
        const ry = Math.floor(Math.random()*(HEIGHT-rh-2)) + 1;
        for(let yy=ry; yy<ry+rh; yy++) {
            for(let xx=rx; xx<rx+rw; xx++) {
                layer[yy][xx] = SYMBOLS.dungeon_floor;
            }
        }
    }

    // 3. Cellular Automata
    for (let i = 0; i < 4; i++) {
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
                else {
                    if ((z === "-3" || z === "-4")) {
                        const rand = Math.random();
                        layer[y][x] = rand < 0.05 ? SYMBOLS.lava : (rand < 0.3 ? SYMBOLS.basalt : SYMBOLS.dungeon_floor);
                    } else {
                        layer[y][x] = SYMBOLS.dungeon_floor;
                    }
                }
            }
        }
    }
}
for(let z of ["-1","-2","-3","-4"]) digOrganicCaves(z);

/**
 * Build a structured dungeon entrance (Mini-Temple)
 * Occurs on Z0 and Z1
 */
function buildTempleEntrance(sx, sy) {
    const w = 5, h = 5;
    // Layer Z0: Floor and Stair Down
    for (let y = sy; y < sy + h; y++) {
        for (let x = sx; x < sx + w; x++) {
            const isWall = (x === sx || x === sx + w - 1 || y === sy || y === sy + h - 1);
            const isDoor = (y === sy + h - 1 && x === sx + Math.floor(w/2));
            
            if (isWall && !isDoor) {
                levels["0"][y][x] = SYMBOLS.dungeon_wall;
                levels["1"][y][x] = SYMBOLS.dungeon_wall; // Second layer of walls
            } else {
                levels["0"][y][x] = SYMBOLS.dungeon_floor;
                if (x === sx + 2 && y === sy + 2) {
                    levels["0"][y][x] = SYMBOLS.stair_down;
                    // Connect to -1
                    ensureSafeTransition("-1", x, y);
                    levels["-1"][y][x] = SYMBOLS.stair_up;
                }
            }
        }
    }
    // Layer Z1: Pillars/Empty space except walls
}

console.log("Establishing Reinforced Dungeon Links (Temples)...");
function createCaveLinks() {
    let templesPlaced = 0;
    for (let attempt = 0; attempt < 5000 && templesPlaced < 40; attempt++) {
        const rx = Math.floor(Math.random() * (WIDTH - 10)) + 5;
        const ry = Math.floor(Math.random() * (HEIGHT - 10)) + 5;
        
        let valid = true;
        for(let dy=0; dy<5; dy++) {
            for(let dx=0; dx<5; dx++) {
                if (heightMap[ry+dy][rx+dx] !== 0 || levels["0"][ry+dy][rx+dx] !== SYMBOLS.grass) {
                    valid = false; break;
                }
            }
            if(!valid) break;
        }

        if (valid) {
            buildTempleEntrance(rx, ry);
            templesPlaced++;
        }
    }

    // Still add some random holes in forests
    for (let i = 0; i < 40; i++) { 
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
        for(let attempt=0; attempt<10000 && links<150; attempt++) { // Scaled up links
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
            // CHECK CITY BOUNDS (Dynamic)
            const isCity = pavementSet.has(`${x},${y}`);
            if (z === "0" && isCity) continue; // No rats in the town pavement
            
            const isWalkable = (layer[y][x] === SYMBOLS.grass || layer[y][x] === SYMBOLS.floor || layer[y][x] === SYMBOLS.basalt || layer[y][x] === SYMBOLS.pavement || layer[y][x] === SYMBOLS.dungeon_floor);
            if (isWalkable && Math.random() < density) {
                const s = symbols[Math.floor(Math.random() * symbols.length)];
                spawnActor(z, x, y, s);
            }
        }
    }
}
scatterActors("0", 0.001, ["rak"]); // Lower density for 1024
scatterActors("-1", 0.008, ["skl", "gob", "chs"]);
scatterActors("-2", 0.01, ["skl", "gob", "chs"]);
scatterActors("-3", 0.015, ["orc", "chs"]);
scatterActors("-4", 0.02, ["orc", "dra", "chs"]);

console.log("Preparing Spawn Point...");
spawnActor("0", 512, 512, "ply");
// Safety pavement around spawn
for(let dy=-10; dy<=10; dy++) {
    for(let dx=-10; dx<=10; dx++) {
        const py = 512+dy; const px = 512+dx;
        levels["0"][py][px] = SYMBOLS.pavement;
        pavementSet.add(`${px},${py}`);
    }
}

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
    "bas": { id: "basalt", color: "#404040" }, 
    "dwl": { id: "dungeon-wall", block: true, color: "#1e293b" },
    "mte": { id: "mountain-edge", block: true, color: "#64748b" }
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
    if (z === "0") mapData.levels[z].playerPos = { x: 512*32, y: 512*32 };
}

fs.writeFileSync('public/newmap.json', JSON.stringify(mapData));
console.log("v3.80 CONTINENTAL WORLD GENERATED (1024x1024)!");
