const fs = require('fs');
const { createNoise2D } = require('simplex-noise');

/**
 * ==========================================
 * 📜 WORLD GENERATOR CONTRACT (v5.0)
 * ==========================================
 * This contract defines the absolute rules for the Procedural World Engine. 
 * AI agents MUST follow these standards to ensure consistency.
 * 
 * 1. Engine Standards: 32px Grid. Infinite Depth (Z:+3 to Z:-4).
 * 2. Perspective (2.5D): Vertical shift by (X, Y - Z). Roofs at Z_max+1 shifted Y-1.
 * 3. Stair Pairing (CRITICAL):
 *    - Global Sync: 'sup' at Z and 'sdn' at Z+1 MUST share exact (X, Y).
 *    - Alternating Shaft: Even Floors (X+2), Odd Floors (X+4) to prevent loops.
 *    - Safe Landing: 2-tile offset (Up: Y-2, Down: Y+2).
 * 4. Vertical Integrity (v5.0): 
 *    - Foundation Rule: Habitable tile at (X, Y, Z) must have foundation at (X, Y+1, Z-1).
 *    - Platform Rule: Suspended Cities (Z:1) require boundary walls at Z:0.
 * 5. Underworld Theming: Z-1 (Ruins), Z-2 (Crystal), Z-3 (Frozen), Z-4 (Volcanic).
 * ==========================================
 * ==========================================
 */

const noiseElevation = createNoise2D();
const noiseMoisture = createNoise2D();
const noiseForest = createNoise2D();
const noiseTemperature = createNoise2D();
const noiseCorruption = createNoise2D();

const WIDTH = 1024;
const HEIGHT = 1024;

// Adjustment Variables (Zoom Out for 1024x1024)
const SCALE_ELEVATION = 480; 
const SCALE_MOISTURE = 720;
const SCALE_FOREST = 200;
const SCALE_WEATHER = 600; 

const SYMBOLS = {
    grass: 'grs', path: 'pth', tree: 'tre', rock: 'rok', sand: 'snd', water: 'wat',
    snow: 'snw', floor: 'flr', wall: 'wal', mountain: 'mnt', roof: 'rof',
    stair_up: 'sup', stair_down: 'sdn', hole: 'hol', empty: '...',
    basalt: 'bas', lava: 'lav', cloud: 'cld', pavement: 'pav',
    dungeon_floor: 'dfn', dungeon_wall: 'dwl', mountain_edge: 'mte',
    cracked_earth: 'cre', mud: 'mud', corrupted_grass: 'cgr', toxic_water: 'twat',
    ice_cave_floor: 'icf', crystal_spike: 'csp', obsidian_floor: 'obs',
    cobblestone: 'cob', ruined_path: 'rpa', foundation_brick: 'fdb', gothic_wall: 'gtw'
};

function createLayer(fill = SYMBOLS.empty) {
    return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(fill));
}

const levels = {
    "7":  createLayer(SYMBOLS.empty),
    "6":  createLayer(SYMBOLS.empty),
    "5":  createLayer(SYMBOLS.empty),
    "4":  createLayer(SYMBOLS.empty),
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
    "7": [], "6": [], "5": [], "4": [], "3": [], "2": [], "1": [], "0": [], "-1": [], "-2": [], "-3": [], "-4": []
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
        let t = (noiseTemperature(x / SCALE_WEATHER, y / SCALE_WEATHER) + 1) / 2;
        let c = (noiseCorruption(x / SCALE_WEATHER, y / SCALE_WEATHER) + 1) / 2;

        // 2. Radial Mask (Island preservation)
        const dx = (x - WIDTH/2) / (WIDTH/2);
        const dy = (y - HEIGHT/2) / (HEIGHT/2);
        const dist = Math.sqrt(dx*dx + dy*dy);
        e = (e + (1 - dist * 1.3)) / 2; 
        e = Math.max(0, Math.min(1, e));

        // 3. Altitude Tiering (Z 0 to 3)
        let H = 0;
        let biome = SYMBOLS.water;

        if (e < 0.42) {
            biome = SYMBOLS.water; H = 0;
        } else if (e < 0.48) {
            biome = SYMBOLS.sand; H = 0;
        } else if (e < 0.70) {
            // Surface Biomes
            if (t > 0.7 && m < 0.35) biome = SYMBOLS.cracked_earth; // Badlands
            else if (m > 0.75 && e < 0.55) biome = SYMBOLS.mud; // Swamp
            else biome = SYMBOLS.grass;
            H = 0;
        } else if (e < 0.82) {
            biome = SYMBOLS.grass; H = 1; // Highlands
        } else if (e < 0.92) {
            biome = (m > 0.6) ? SYMBOLS.snow : SYMBOLS.mountain; 
            H = 2; // Mid Mountains
        } else {
            biome = SYMBOLS.snow; H = 3; // High Peaks
        }

        // 3.5 Corruption (The Blight) Overwrite
        if (c > 0.82 && e > 0.42) {
            biome = (biome === SYMBOLS.water) ? SYMBOLS.toxic_water : SYMBOLS.corrupted_grass;
        }

        heightMap[y][x] = H;

        // 4. Populate Physical Layers
        for (let z = 0; z <= H; z++) {
            let symbol = biome;
            if (z < H) symbol = SYMBOLS.basalt;
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

// --- PHASE 3: PLANNED URBAN ARCHITECTURE (v5.4) ---
console.log("Constructing Planned Urban Axis (Z:1)...");
const pavementSet = new Set();
const cobblestoneSet = new Set();
const CITY_CENTER_X = 512;
const CITY_CENTER_Y = 512;
const CITY_RADIUS = 50;

// 1. MAIN AXIS BOULEVARDS (Cobblestone)
function drawStreet(sx, sy, ex, ey, width) {
    for (let y = Math.min(sy, ey); y <= Math.max(sy, ey); y++) {
        for (let x = Math.min(sx, ex); x <= Math.max(sx, ex); x++) {
            for (let dy = -Math.floor(width/2); dy <= Math.floor(width/2); dy++) {
                for (let dx = -Math.floor(width/2); dx <= Math.floor(width/2); dx++) {
                    const py = y + (sx === ex ? 0 : dy);
                    const px = x + (sy === ey ? 0 : dx);
                    if (px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT) {
                        levels["1"][py][px] = SYMBOLS.cobblestone;
                        cobblestoneSet.add(`${px},${py}`);
                        pavementSet.add(`${px},${py}`);
                    }
                }
            }
        }
    }
}

// Draw Primary Axis (The Cross)
drawStreet(CITY_CENTER_X - CITY_RADIUS, CITY_CENTER_Y, CITY_CENTER_X + CITY_RADIUS, CITY_CENTER_Y, 7); // E-W
drawStreet(CITY_CENTER_X, CITY_CENTER_Y - CITY_RADIUS, CITY_CENTER_X, CITY_CENTER_Y + CITY_RADIUS, 7); // N-S

// 2. URBAN DISTRICT FILL (Pavement)
console.log("Laying Urban District Pavement...");
for (let y = CITY_CENTER_Y - CITY_RADIUS; y <= CITY_CENTER_Y + CITY_RADIUS; y++) {
    for (let x = CITY_CENTER_X - CITY_RADIUS; x <= CITY_CENTER_X + CITY_RADIUS; x++) {
        const dist = Math.sqrt((x - CITY_CENTER_X)**2 + (y - CITY_CENTER_Y)**2);
        if (dist < CITY_RADIUS) {
            if (!pavementSet.has(`${x},${y}`)) {
                levels["1"][y][x] = SYMBOLS.pavement;
                pavementSet.add(`${x},${y}`);
            }
        }
    }
}

// 3. URBAN SANITIZATION (Directly Clean Z:0)
console.log("Sanitizing Level 0 Foundation Slab...");
pavementSet.forEach(pos => {
    const [x, y] = pos.split(',').map(Number);
    // Clear all biome noise (trees, grass, snow) and replace with solid basalt foundation
    levels["0"][y][x] = SYMBOLS.basalt;
});

// --- PHASE 3.1: PLATFORM MASONRY FOUNDATIONS (Z:0) ---
console.log("Reinforcing Platform Ledges with Masonry...");
pavementSet.forEach(pos => {
    const [x, y] = pos.split(',').map(Number);
    const neighbors = [[1,0], [-1,0], [0,1], [0,-1]];
    let isEdge = false;
    for (const [ox, oy] of neighbors) {
        if (!pavementSet.has(`${x+ox},${y+oy}`)) { isEdge = true; break; }
    }
    if (isEdge) {
        // Any City edge at (X, Y, 1) gets a foundation masonry at (X, Y+1, 0)
        if (y + 1 < HEIGHT) {
            levels["0"][y + 1][x] = SYMBOLS.foundation_brick; 
        }
    }
});

// --- PHASE 3.2: MULTI-TIER SEWER SYSTEM (Z:0) ---
console.log("Constructing Sewer Mains under Boulevards...");
const sewerSet = new Set();
cobblestoneSet.forEach(pos => {
    const [x, y] = pos.split(',').map(Number);
    // Sewers exactly under the cobblestone roads
    sewerSet.add(`${x},${y}`);
    levels["0"][y][x] = SYMBOLS.dungeon_floor; // Map to sewer-brick
    
    // Low-flow toxic water in the center of main roads
    if (Math.random() < 0.1) {
        levels["0"][y][x] = SYMBOLS.toxic_water;
    }
});

// Manholes (Z:1 -> Z:0)
console.log("Placing Manholes and Sewer Access...");
let manholesAdded = 0;
pavementSet.forEach(pos => {
    if (manholesAdded > 60) return;
    const [x, y] = pos.split(',').map(Number);
    if (Math.random() < 0.005 && sewerSet.has(`${x},${y}`)) {
        levels["1"][y][x] = SYMBOLS.hole;
        levels["0"][y][x] = SYMBOLS.stair_up; // Return point
        manholesAdded++;
    }
});

function buildFoundation(x, y, z) {
    if (z <= 0) return;
    const foundationZ = (z - 1).toString();
    const targetY = y + 1; // 2.5D visual projection
    if (targetY < HEIGHT && levels[foundationZ]) {
        // Only fill if empty to avoid overwriting sewers or other logic
        if (levels[foundationZ][targetY][x] === SYMBOLS.empty || levels[foundationZ][targetY][x] === SYMBOLS.water) {
            levels[foundationZ][targetY][x] = SYMBOLS.basalt;
        }
    }
}

/**
 * BLUEPRINT ENGINE (v5.0)
 * Allows building complex structures from composite parts.
 */
function buildStructure(sx, sy, blueprint) {
    blueprint.parts.forEach(part => {
        const floorCount = part.floors || 1;
        const baseZ = part.z || 0;
        
        for (let f = 0; f < floorCount; f++) {
            const z = (baseZ + f).toString();
            if (!levels[z]) continue;
            
            const ry = sy + part.y - (baseZ + f); // Cumulative 2.5D shift
            const rx = sx + part.x;
            
            for (let y = ry; y < ry + part.h; y++) {
                if (y < 0 || y >= HEIGHT) continue;
                for (let x = rx; x < rx + part.w; x++) {
                    if (x < 0 || x >= WIDTH) continue;
                    
                    const isWall = (x === rx || x === rx + part.w - 1 || y === ry || y === ry + part.h - 1);
                    
                    if (isWall) {
                        levels[z][y][x] = part.type ? SYMBOLS.gothic_wall : SYMBOLS.wall;
                        // For doors (only on ground level Z:1 for city houses)
                        if (baseZ + f === 1 && y === ry + part.h - 1 && x === Math.floor(rx + part.w/2)) {
                            levels[z][y][x] = SYMBOLS.floor;
                        }
                    } else {
                        levels[z][y][x] = SYMBOLS.floor;
                    }
                    buildFoundation(x, y, baseZ + f);
                }
            }
            // ROOF for this part
            const roofZ = (baseZ + floorCount).toString();
            if (levels[roofZ]) {
                const roofY = sy + part.y - (baseZ + floorCount);
                for (let x = rx; x < rx + part.w; x++) {
                    for (let y = roofY; y < roofY + part.h; y++) {
                        if (y >= 0 && y < HEIGHT && x >= 0 && x < WIDTH) {
                            levels[roofZ][y][x] = SYMBOLS.roof;
                        }
                    }
                }
            }
        }
    });

    // --- COHERENCE RULE: SERVICE PIPES (Z:0) ---
    // Connect building center to the nearest Sewer Main
    const centerX = sx + 3;
    const centerY = sy + 3;
    let closestMainX = CITY_CENTER_X;
    let closestMainY = CITY_CENTER_Y;
    let minDist = 9999;
    
    // Find nearest main sewer (X or Y axis)
    if (Math.abs(centerX - CITY_CENTER_X) < Math.abs(centerY - CITY_CENTER_Y)) {
        closestMainX = CITY_CENTER_X; closestMainY = centerY;
    } else {
        closestMainX = centerX; closestMainY = CITY_CENTER_Y;
    }

    // Carve narrow service pipe
    for (let x = Math.min(centerX, closestMainX); x <= Math.max(centerX, closestMainX); x++) {
        levels["0"][centerY][x] = SYMBOLS.dungeon_floor;
        sewerSet.add(`${x},${centerY}`);
    }
    for (let y = Math.min(centerY, closestMainY); y <= Math.max(centerY, closestMainY); y++) {
        levels["0"][y][closestMainX] = SYMBOLS.dungeon_floor;
        sewerSet.add(`${closestMainX},${y}`);
    }

    // --- STAIRS logic remains... ---

    // STAIRS for the whole blueprint (Main Shaft)
    // Simplified: Find a central part and place a shaft
    const mainPart = blueprint.parts[0];
    const shaftX = sx + mainPart.x + 2;
    const shaftY = sy + mainPart.y + 2;
    const maxFloors = Math.max(...blueprint.parts.map(p => (p.z || 0) + (p.floors || 1)));
    const minZ = Math.min(...blueprint.parts.map(p => p.z || 0));

    for (let currentZ = minZ; currentZ < maxFloors - 1; currentZ++) {
        const stairY = shaftY - currentZ;
        const currentShaftX = (currentZ % 2 === 0) ? shaftX : shaftX + 2;
        
        if (!levels[currentZ.toString()] || !levels[(currentZ + 1).toString()]) continue;
        if (stairY < 0 || stairY >= HEIGHT || currentShaftX < 0 || currentShaftX >= WIDTH) continue;

        ensureSafeTransition((currentZ + 1).toString(), currentShaftX, stairY);
        levels[currentZ.toString()][stairY][currentShaftX] = SYMBOLS.stair_up;
        levels[(currentZ + 1).toString()][stairY][currentShaftX] = SYMBOLS.stair_down;
        
        // Safe Landing (v5.0 Contract)
        if (stairY - 2 >= 0 && levels[(currentZ + 1).toString()][stairY - 2]) {
            levels[(currentZ + 1).toString()][stairY - 2][currentShaftX] = SYMBOLS.floor;
        }
        if (stairY + 2 < HEIGHT && levels[currentZ.toString()][stairY + 2]) {
            levels[currentZ.toString()][stairY + 2][currentShaftX] = SYMBOLS.floor;
        }
    }
}

// BLUEPRINT DATA
const BLUEPRINTS = {
    church: {
        parts: [
            { x: 0, y: 0, w: 7, h: 12, floors: 3, z: 1, type: 'gtw' }, // Nave
            { x: 2, y: -4, w: 3, h: 4, floors: 6, z: 1, type: 'gtw' }, // Spire/Tower
            { x: -3, y: 6, w: 13, h: 3, floors: 2, z: 1, type: 'gtw' } // Alas
        ]
    },
    mansion: {
        parts: [
            { x: 0, y: 0, w: 10, h: 8, floors: 3, z: 1 }, // Main Hall
            { x: -4, y: 2, w: 4, h: 4, floors: 2, z: 1 }, // West Wing
            { x: 10, y: 2, w: 4, h: 4, floors: 2, z: 1 }  // East Wing
        ]
    },
    house: {
        parts: [{ x: 0, y: 0, w: 6, h: 6, floors: 2, z: 1 }]
    }
};
function ensureSafeTransition(toZ, x, y) {
    const targetLayer = levels[toZ.toString()];
    if (!targetLayer) return;
    const isSub = (parseInt(toZ) < 0);
    const safeTile = isSub ? SYMBOLS.dungeon_floor : SYMBOLS.floor;
    for (let dy = -1; dy <= 1; dy++) {
        if (y + dy >= 0 && y + dy < HEIGHT) targetLayer[y + dy][x] = safeTile;
    }
}

// --- PHASE 3.3: PLANNED BUILDING PLACEMENT (Z:1) ---
console.log("Allocating Parcels and Houses...");
let housesPlaced = 0;
let houseFootprints = [];
let firstHouseCoords = null;

// 1. PLACE SPECIALS (The Plaza center)
buildStructure(CITY_CENTER_X - 15, CITY_CENTER_Y - 15, BLUEPRINTS.church);
houseFootprints.push({x1: 490, y1: 490, x2: 530, y2: 530});
buildStructure(CITY_CENTER_X + 10, CITY_CENTER_Y + 5, BLUEPRINTS.mansion);

// 2. GRID PARCEL PLACEMENT (Coherent Rows)
const BLOCK_SIZE = 12;
for (let by = CITY_CENTER_Y - CITY_RADIUS + 5; by < CITY_CENTER_Y + CITY_RADIUS - 5; by += BLOCK_SIZE) {
    for (let bx = CITY_CENTER_X - CITY_RADIUS + 5; bx < CITY_CENTER_X + CITY_RADIUS - 5; bx += BLOCK_SIZE) {
        // Skip central plaza
        if (Math.abs(bx - CITY_CENTER_X) < 15 && Math.abs(by - CITY_CENTER_Y) < 15) continue;

        // Is this on pavement?
        if (!pavementSet.has(`${bx},${by}`)) continue;

        let overlaps = false;
        for (const f of houseFootprints) {
            if (bx < f.x2 && bx + 6 > f.x1 && by < f.y2 && by + 6 > f.y1) {
                overlaps = true; break;
            }
        }
        if (overlaps) continue;

        // Place House
        buildStructure(bx, by, BLUEPRINTS.house);
        houseFootprints.push({ x1: bx, y1: by, x2: bx + 6, y2: by + 6 });
        
        // --- COHERENCE RULE: SPAWN POINT ---
        // Record first house for player spawn
        if (!firstHouseCoords) {
            firstHouseCoords = { x: bx + 3, y: by + 3 };
        }

        // --- COHERENCE RULE: CONNECTION PATHS ---
        // Connect house to nearest boulevard
        const streetX = (Math.abs(bx - CITY_CENTER_X) < Math.abs(by - CITY_CENTER_Y)) ? CITY_CENTER_X : bx;
        const streetY = (Math.abs(bx - CITY_CENTER_X) < Math.abs(by - CITY_CENTER_Y)) ? by : CITY_CENTER_Y;
        
        for (let px = Math.min(bx, streetX); px <= Math.max(bx, streetX); px++) {
            levels["1"][by + 6][px] = SYMBOLS.cobblestone;
        }
        for (let py = Math.min(by, streetY); py <= Math.max(by, streetY); py++) {
            levels["1"][py][streetX] = SYMBOLS.cobblestone;
        }

        housesPlaced++;
    }
}

function buildDungeonShaft(sx, sy, startZ, depth) {
    for (let i = 0; i < depth; i++) {
        const z = startZ - i;
        const nextZ = z - 1;
        if (!levels[z] || !levels[nextZ]) break;

        // 1. Carve 5x5 Safe Room
        for (let y = sy - 2; y <= sy + 2; y++) {
            for (let x = sx - 2; x <= sx + 2; x++) {
                levels[z.toString()][y][x] = getThemedFloor(z.toString());
                levels[nextZ.toString()][y][x] = getThemedFloor(nextZ.toString());
            }
        }

        // 2. Place Stairs (Alternating Shaft)
        const shaftX = (Math.abs(z) % 2 === 0) ? sx - 1 : sx + 1;
        levels[z.toString()][sy][shaftX] = SYMBOLS.stair_down;
        levels[nextZ.toString()][sy][shaftX] = SYMBOLS.stair_up;

        // 3. Safe Landing (Offset)
        const landingUpY = sy - 2;
        const landingDnY = sy + 2;
        levels[nextZ.toString()][landingUpY][shaftX] = getThemedFloor(nextZ.toString());
        levels[z.toString()][landingDnY][shaftX] = getThemedFloor(z.toString());
    }
}

function getThemedFloor(z) {
    if (z === "0") return SYMBOLS.grass;
    if (z === "-1") return SYMBOLS.cobblestone; // Forgotten Ruins
    if (z === "-2") return SYMBOLS.dungeon_floor; // Crystal (Default dfn)
    if (z === "-3") return SYMBOLS.ice_cave_floor;
    if (z === "-4") return SYMBOLS.obsidian_floor;
    return SYMBOLS.dungeon_floor;
}

// --- PHASE 4: ORGANIC CAVES ---
console.log("Digging Organic Caves (Expanded Rooms)...");
function digOrganicCaves(z) {
    const layer = levels[z];
    const density = (z === "-1" || z === "-2") ? 0.44 : 0.40;
    const floorTile = getThemedFloor(z);
    
    // 1. Random seeding
    for (let y = 1; y < HEIGHT-1; y++) {
        for (let x = 1; x < WIDTH-1; x++) {
            layer[y][x] = (Math.random() < density) ? floorTile : SYMBOLS.dungeon_wall;
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
                layer[yy][xx] = floorTile;
                // VEIOS DE CRISTAL no Z-2
                if (z === "-2" && Math.random() < 0.1) layer[yy][xx] = SYMBOLS.crystal_spike;
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
                    if (z === "-4") {
                        const rand = Math.random();
                        layer[y][x] = rand < 0.08 ? SYMBOLS.lava : SYMBOLS.obsidian_floor;
                    } else {
                        if (layer[y][x] !== SYMBOLS.crystal_spike) layer[y][x] = floorTile;
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
                if (heightMap[ry+dy][rx+dx] !== 0 || (levels["0"][ry+dy][rx+dx] !== SYMBOLS.grass && levels["0"][ry+dy][rx+dx] !== SYMBOLS.pavement)) {
                    valid = false; break;
                }
            }
            if(!valid) break;
        }

        if (valid) {
            // New entrance uses buildDungeonShaft correctly
            buildDungeonShaft(rx+2, ry+2, 0, 4); // Deep shaft into the earth
            templesPlaced++;
        }
    }
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
if (firstHouseCoords) {
    // Place player inside the first house on Level 1
    const sy = firstHouseCoords.y - 1; // 2.5D visual adjustment for interior
    levels["1"][sy][firstHouseCoords.x] = SYMBOLS.player;
} else {
    // Fallback to plaza center
    levels["1"][CITY_CENTER_Y][CITY_CENTER_X] = SYMBOLS.player;
}

// Safety pavement around plaza on Z:0 (Avoid sea spawn fallback)
for(let dy=-10; dy<=10; dy++) {
    for(let dx=-10; dx<=10; dx++) {
        if (levels["0"][CITY_CENTER_Y+dy]) {
            levels["0"][CITY_CENTER_Y+dy][CITY_CENTER_X+dx] = SYMBOLS.basalt;
        }
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
    "pav": { id: "pavement", color: "#808080" }, "dfn": { id: "sewer-brick", color: "#1e293b" }, 
    "bas": { id: "basalt", color: "#404040" }, 
    "dwl": { id: "dungeon-wall", block: true, color: "#1e293b" },
    "mte": { id: "mountain-edge", block: true, color: "#64748b" },
    "cre": { id: "cracked-earth", color: "#d2b48c" },
    "mud": { id: "mud", color: "#451a03" },
    "cgr": { id: "corrupted-grass", color: "#312e81" },
    "twat": { id: "toxic-water", block: true, color: "#064e3b" },
    "icf": { id: "ice-cave-floor", color: "#0c4a6e" },
    "csp": { id: "crystal-spike", block: true, color: "#38bdf8" },
    "obs": { id: "obsidian-floor", color: "#0a0a0a" },
    "cob": { id: "cobblestone", color: "#64748b" },
    "rpa": { id: "ruined-path", color: "#78350f" },
    "fdb": { id: "foundation-brick", block: true, color: "#262626" },
    "gtw": { id: "gothic-wall", block: true, color: "#78716c" }
};

const finalEntitiesTemplates = { 
    "ply": { type: "player" }, "rak": { type: "enemy", id: "rat" },
    "skl": { type: "enemy", id: "skeleton" }, "gob": { type: "enemy", id: "goblin" },
    "orc": { type: "enemy", id: "orc" }, "dra": { type: "enemy", id: "dragon" },
    "chs": { type: "item", id: "chest" },
    "tre": { type: "decoration", id: "tree" }
};

// --- PHASE 6: BINARY EXPORT (BMS v1.0) ---
console.log("Exporting to Binary Map System (BMS)...");

// 1. Create Tile Atlas (Map symbol to byte index)
const symbolToIndex = {};
const indexToSymbol = [];

// 'empty' ALWAYS index 0
symbolToIndex[SYMBOLS.empty] = 0;
indexToSymbol[0] = SYMBOLS.empty;

Object.values(SYMBOLS).forEach(sym => {
    if (sym === SYMBOLS.empty) return;
    const idx = indexToSymbol.length;
    symbolToIndex[sym] = idx;
    indexToSymbol.push(sym);
});

if (!fs.existsSync('public/maps')) {
    fs.mkdirSync('public/maps', { recursive: true });
}

const mapMetadata = {
    tileSize: 32,
    width: WIDTH,
    height: HEIGHT,
    config: {
        startLevel: "1",
        mapName: "Continental Metropolis"
    },
    tileAtlas: indexToSymbol,
    tileDefinitions: tileDefinitions,
    entityTemplates: finalEntitiesTemplates,
    levels: {}
};

for (const z in levels) {
    console.log(`  Writing Level ${z}...`);
    const levelArray = levels[z];
    const buffer = Buffer.alloc(WIDTH * HEIGHT);
    
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            const sym = levelArray[y][x];
            const idx = symbolToIndex[sym] ?? 0;
            buffer[y * WIDTH + x] = idx;
        }
    }
    
    const binFilename = `newmap_${z}.bin`;
    fs.writeFileSync(`public/maps/${binFilename}`, buffer);
    
    mapMetadata.levels[z] = {
        binFile: binFilename,
        entities: levelEntities[z]
    };
}

// 2. Write Metadata
fs.writeFileSync('public/maps/newmap.json', JSON.stringify(mapMetadata, null, 2));
console.log(`v3.85 BMS CONTINENTAL WORLD GENERATED!`);
console.log(`- Metadata: public/maps/newmap.json`);
console.log(`- Binary levels: public/maps/*.bin`);
