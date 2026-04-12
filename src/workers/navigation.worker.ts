// Navigation Worker for Multi-Floor Pathfinding
// Uses A* algorithm to connect layered grids via portals (stairs/holes)

export {};

interface NavNode {
    x: number;
    y: number;
    level: number;
    g: number;
    h: number;
    f: number;
    parent: NavNode | null;
}

interface Portal {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    toLevel: number;
}

let mapData: any = null;
let levels: string[] = [];
let portalsByLevel: Record<string, Portal[]> = {};

// Helper to check if a tile is walkable
function isWalkable(x: number, y: number, level: string): boolean {
    if (!mapData) return false;
    const levelData = mapData.levels[level];
    if (!levelData || !levelData.map) return false;

    if (y < 0 || y >= levelData.map.length || x < 0 || x >= levelData.map[0].length) return false;

    const symbol = levelData.map[y][x];
    const tileDef = mapData.tiles[symbol];
    
    // Explicit return to be safe
    if (!tileDef) return false;
    return !tileDef.block;
}

function getHeuristic(x1: number, y1: number, l1: number, x2: number, y2: number, l2: number): number {
    // Manhattan distance with a high penalty for level changes to prefer staying on same level if possible
    return Math.abs(x1 - x2) + Math.abs(y1 - y2) + Math.abs(l1 - l2) * 50;
}

onmessage = function(e: MessageEvent) {
    const { type, data } = e.data;

    if (type === "INIT_MAP") {
        mapData = data;
        levels = Object.keys(mapData.levels).sort((a, b) => parseInt(a) - parseInt(b));
        
        // Pre-index portals for speed
        portalsByLevel = {};
        levels.forEach(lvl => {
            portalsByLevel[lvl] = [];
            const grid = mapData.levels[lvl].map;
            for (let y = 0; y < grid.length; y++) {
                for (let x = 0; x < grid[0].length; x++) {
                    const symbol = grid[y][x];
                    const tileDef = mapData.tiles[symbol];
                    if (tileDef && tileDef.transition) {
                        const currentL = parseInt(lvl);
                        if (tileDef.transition === "down" || tileDef.transition === "dwn" || tileDef.id === "hole") {
                            portalsByLevel[lvl].push({ fromX: x, fromY: y, toX: x, toY: y + 2, toLevel: currentL - 1 });
                        } else if (tileDef.transition === "up") {
                            portalsByLevel[lvl].push({ fromX: x, fromY: y, toX: x, toY: y - 2, toLevel: currentL + 1 });
                        }
                    }
                }
            }
        });
        
        postMessage({ type: "MAP_READY" });
        return;
    }

    if (type === "FIND_PATH") {
        const { start, end } = data;
        console.log("[Pathfinder] Finding path from:", start, "to:", end);
        const startTime = performance.now();
        
        const startNode: NavNode = { 
            x: start.x, y: start.y, level: parseInt(start.level), 
            g: 0, h: getHeuristic(start.x, start.y, parseInt(start.level), end.x, end.y, parseInt(end.level)),
            f: 0, parent: null 
        };
        startNode.f = startNode.g + startNode.h;

        const openList: NavNode[] = [startNode];
        const closedSet = new Set<string>();
        let nodesSearched = 0;

        while (openList.length > 0) {
            // Pick lowest F
            openList.sort((a, b) => a.f - b.f);
            const current = openList.shift()!;
            nodesSearched++;

            // Goal reached?
            if (current.x === end.x && current.y === end.y && current.level === parseInt(end.level)) {
                const path = [];
                let temp: NavNode | null = current;
                while (temp) {
                    path.push({ x: temp.x, y: temp.y, level: temp.level.toString() });
                    temp = temp.parent;
                }
                const endTime = performance.now();
                postMessage({ 
                    type: "PATH_FOUND", 
                    data: { 
                        path: path.reverse(), 
                        diagnostics: { 
                            time: endTime - startTime, 
                            nodes: nodesSearched,
                            length: path.length
                        } 
                    } 
                });
                return;
            }

            const key = `${current.x},${current.y},${current.level}`;
            closedSet.add(key);

            // Neighbors
            const neighbors = [
                { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
                { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
            ];

            for (const n of neighbors) {
                const nx = current.x + n.dx;
                const ny = current.y + n.dy;
                const nLevel = current.level;
                const nKey = `${nx},${ny},${nLevel}`;

                if (closedSet.has(nKey)) continue;
                if (!isWalkable(nx, ny, nLevel.toString())) continue;

                const g = current.g + 1;
                const h = getHeuristic(nx, ny, nLevel, end.x, end.y, parseInt(end.level));
                const f = g + h;

                const existing = openList.find(o => o.x === nx && o.y === ny && o.level === nLevel);
                if (existing) {
                    if (g < existing.g) {
                        existing.g = g;
                        existing.f = f;
                        existing.parent = current;
                    }
                } else {
                    openList.push({ x: nx, y: ny, level: nLevel, g, h, f, parent: current });
                }
            }

            // Portal Neighbors (Stairs)
            const portals = portalsByLevel[current.level.toString()] || [];
            for (const p of portals) {
                if (current.x === p.fromX && current.y === p.fromY) {
                    const nKey = `${p.toX},${p.toY},${p.toLevel}`;
                    if (closedSet.has(nKey)) continue;
                    
                    // Note: We don't check isWalkable on destination because stairs are usually walkable-but-blocked tiles or valid landing spots
                    // But we should check if the level even exists
                    if (!mapData.levels[p.toLevel.toString()]) continue;

                    const g = current.g + 2; // Penalty for using stairs
                    const h = getHeuristic(p.toX, p.toY, p.toLevel, end.x, end.y, parseInt(end.level));
                    const f = g + h;

                    openList.push({ x: p.toX, y: p.toY, level: p.toLevel, g, h, f, parent: current });
                }
            }
            
            // Safety break
            if (nodesSearched > 50000) break;
        }

        postMessage({ type: "PATH_NOT_FOUND" });
    }
};
