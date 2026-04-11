const fs = require('fs');
const path = require('path');

const mapPath = path.join(__dirname, '../public/newmap.json');

function cleanPuddles() {
    console.log("Cleaning water puddles (removing isolated water tiles)...");
    
    if (!fs.existsSync(mapPath)) {
        console.error("Map file not found.");
        return;
    }

    const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    let replacedCount = 0;

    for (const levelId in data.levels) {
        const level = data.levels[levelId];
        const grid = level.map;
        const rows = grid.length;
        const cols = grid[0].length;
        
        // Use a copy to avoid checking modified tiles in the same pass
        const newGrid = JSON.parse(JSON.stringify(grid));

        for (let y = 1; y < rows - 1; y++) {
            for (let x = 1; x < cols - 1; x++) {
                if (grid[y][x] === 'wat') {
                    // Count water neighbors
                    let waterNeighbors = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dy === 0 && dx === 0) continue;
                            if (grid[y+dy][x+dx] === 'wat') waterNeighbors++;
                        }
                    }

                    // If it has fewer than 2 water neighbors, it's a puddle
                    if (waterNeighbors < 2) {
                        newGrid[y][x] = 'grs'; // Replace with grass
                        replacedCount++;
                    }
                }
            }
        }
        level.map = newGrid;
    }

    fs.writeFileSync(mapPath, JSON.stringify(data, null, 2));
    console.log(`Puddle cleaning complete! Replaced ${replacedCount} isolated water tiles with grass.`);
}

cleanPuddles();
