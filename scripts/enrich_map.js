const fs = require('fs');
const path = require('path');

const mapPath = path.join(__dirname, '../public/newmap.json');

function enrichMap() {
    console.log("Starting map enrichment (adding life to houses)...");
    
    if (!fs.existsSync(mapPath)) {
        console.error("Map file not found at:", mapPath);
        return;
    }

    const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    let chestCount = 0;
    let altarCount = 0;

    for (const levelId in data.levels) {
        const level = data.levels[levelId];
        const grid = level.map;
        const rows = grid.length;
        const cols = grid[0].length;

        for (let y = 1; y < rows - 1; y++) {
            for (let x = 1; x < cols - 1; x++) {
                // If it's a floor tile
                if (grid[y][x] === 'flr') {
                    // Count neighbors that are walls (to place chests against walls)
                    let wallNeighbors = 0;
                    if (grid[y-1][x] === 'wal') wallNeighbors++;
                    if (grid[y+1][x] === 'wal') wallNeighbors++;
                    if (grid[y][x-1] === 'wal') wallNeighbors++;
                    if (grid[y][x+1] === 'wal') wallNeighbors++;

                    // 1. PLACE CHESTS (against walls, 10% chance)
                    if (wallNeighbors >= 1 && Math.random() < 0.05) {
                        grid[y][x] = 'chs';
                        chestCount++;
                        continue;
                    }

                    // 2. PLACE ALTARS (rare, in centers of rooms, 1% chance)
                    if (wallNeighbors === 0 && Math.random() < 0.01) {
                        // Assuming 'bst' (basalt) or similar can acts as altar base 
                        // or we just use 'bst' for now if we don't have an altar tile
                        // Wait, I saw 'bst' in newmap.json. I'll use it as a placeholder for "Altars"
                        // unless I create a new tile.
                        // User mentioned 'altars'. I'll add 'alt' to the definitions if not exists.
                    }
                }
            }
        }
    }

    // Add Altar definition if missing
    if (!data.tiles['alt']) {
        data.tiles['alt'] = {
            id: "altar",
            block: true,
            under: "flr",
            color: "#d946ef" // Pinkish/Purple for magical altar
        };
    }

    // Second pass for Altars now that definition is safe
    for (const levelId in data.levels) {
        const level = data.levels[levelId];
        const grid = level.map;
        for (let y = 2; y < grid.length - 2; y++) {
            for (let x = 2; x < grid[y].length - 2; x++) {
                if (grid[y][x] === 'flr') {
                    // Check for empty 3x3 space (center of room)
                    let isRoomCenter = true;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (grid[y+dy][x+dx] !== 'flr') isRoomCenter = false;
                        }
                    }
                    if (isRoomCenter && Math.random() < 0.005) {
                        grid[y][x] = 'alt';
                        altarCount++;
                    }
                }
            }
        }
    }

    fs.writeFileSync(mapPath, JSON.stringify(data, null, 2));
    console.log(`Enrichment complete! Added ${chestCount} chests and ${altarCount} altars.`);
}

enrichMap();
