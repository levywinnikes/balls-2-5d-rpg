import fs from 'fs';
import path from 'path';

const mapPath = path.join(process.cwd(), 'public', 'newmap.json');
const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));

// 1. Add new tile definitions to "tiles" section
const newTiles = {
    "bwl": { id: "brick-wall-corner-left", block: true, color: "#8B4513" },
    "bwr": { id: "brick-wall-corner-right", block: true, color: "#8B4513" },
    "bwd": { id: "brick-wall-corner-detail", block: true, color: "#8B4513" },
    "bws": { id: "brick-wall-texture-side", block: true, color: "#8B4513" },
    "bwf": { id: "brick-wall-texture-front", block: true, color: "#8B4513" },
    "bwW": { id: "brick-wall-window-front", block: true, color: "#8B4513" },
    "bww": { id: "brick-wall-window-side", block: true, color: "#8B4513" },
};

Object.assign(mapData.tiles, newTiles);

// 2. Autotile Floor -1
const floorMinus1 = mapData.levels["-1"].map;
const height = floorMinus1.length;
const width = floorMinus1[0].length;

function isWall(tile) {
    // Treat existing rocks 'rcd' and new walls as walls for adjacency
    return tile === 'rcd' || Object.keys(newTiles).includes(tile);
}

const newMap = floorMinus1.map((row, y) => {
    return row.map((tile, x) => {
        if (tile !== 'rcd') return tile;

        // Neighbor check
        // We aren't checking bounds safely because map has padding "..." usually, but let's be safe-ish
        const n = y > 0 ? floorMinus1[y - 1][x] : null;
        const s = y < height - 1 ? floorMinus1[y + 1][x] : null;
        const w = x > 0 ? floorMinus1[y][x - 1] : null;
        const e = x < width - 1 ? floorMinus1[y][x + 1] : null;

        const wallN = isWall(n);
        const wallS = isWall(s);
        const wallW = isWall(w);
        const wallE = isWall(e);

        // Logic based on adjacency (Simple heuristic matching wood-house style)
        
        // vertical column -> Side Wall
        if (wallN && wallS && !wallW && !wallE) return 'bws';

        // Horizontal row -> Front Wall
        if (!wallN && !wallS && wallW && wallE) return 'bwf';
        
        // Corners / Ends
        // Top-Left corner (South + East) -> Corner Left? 
        if (!wallN && wallS && !wallW && wallE) return 'bwl'; // Corner Left
        
        // Top-Right corner (South + West) -> Corner Right?
        if (!wallN && wallS && wallW && !wallE) return 'bwr'; // Corner Right // actually wait, let's check wood-house logic
        
        // If it's a "bottom" of a wall (North is wall, everything else mostly open)
        if (wallN && !wallS) return 'bwd'; // Corner detail / bottom of pillar

        // Default to front wall if unsure
        return 'bwf';
    });
});

mapData.levels["-1"].map = newMap;

fs.writeFileSync(mapPath, JSON.stringify(mapData, null, 2));
console.log("Updated newmap.json with brick walls!");
