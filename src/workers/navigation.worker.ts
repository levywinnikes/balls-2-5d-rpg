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
let binaryLevels: Record<string, Uint8Array> = {};
let levels: string[] = [];
let portalsByLevel: Record<string, Portal[]> = {};
let mapWidth = 0;
let mapHeight = 0;

// Helper to check if a tile is walkable
function isWalkable(x: number, y: number, level: string | number): boolean {
    if (!mapData || !binaryLevels) return false;
    const levelStr = level.toString();
    const buffer = binaryLevels[levelStr];
    if (!buffer) return false;

    if (y < 0 || y >= mapHeight || x < 0 || x >= mapWidth) return false;

    const tileIdx = buffer[y * mapWidth + x];
    const symbol = mapData.tileAtlas[tileIdx];
    if (!symbol) return false;

    const tileDef = mapData.tileDefinitions[symbol] || (mapData.entityTemplates ? mapData.entityTemplates[symbol] : null);
    
    if (!tileDef) return false;
    return !tileDef.block;
}

// Find the closest walkable point around a coordinate if it is blocked
function findNearestWalkable(targetX: number, targetY: number, level: string | number): { x: number, y: number } {
    if (isWalkable(targetX, targetY, level)) return { x: targetX, y: targetY };
    
    // Check spiraling out (simple 5x5 check)
    for (let radius = 1; radius <= 3; radius++) {
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue; // Only check the perimeter
                const nx = targetX + dx;
                const ny = targetY + dy;
                if (isWalkable(nx, ny, level)) {
                    return { x: nx, y: ny };
                }
            }
        }
    }
    return { x: targetX, y: targetY }; // Fallback to original if no walkable nearby
}

function getHeuristic(x1: number, y1: number, l1: number, x2: number, y2: number, l2: number): number {
    // Manhattan distance with a high penalty for level changes to prefer staying on same level if possible
    return Math.abs(x1 - x2) + Math.abs(y1 - y2) + Math.abs(l1 - l2) * 50;
}

onmessage = function(e: MessageEvent) {
    const { type, data } = e.data;
    if (type === "FIND_PATH") console.log(`[NavWorker] FIND_PATH received for L${data.start.level}`);

    if (type === "INIT_MAP") {
        mapData = data.data;
        binaryLevels = data.binaryLevels;
        mapWidth = mapData.width;
        mapHeight = mapData.height;
        levels = Object.keys(mapData.levels).sort((a, b) => parseInt(a) - parseInt(b));
        
        // Pre-index portals for speed using binary data
        portalsByLevel = {};
        levels.forEach(lvl => {
            portalsByLevel[lvl] = [];
            const buffer = binaryLevels[lvl];
            if (!buffer) return;

            for (let y = 0; y < mapHeight; y++) {
                for (let x = 0; x < mapWidth; x++) {
                    const tileIdx = buffer[y * mapWidth + x];
                    const symbol = mapData.tileAtlas[tileIdx];
                    const tileDef = mapData.tileDefinitions[symbol];
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
        const { start: rawStart, end: rawEnd } = data;
        const start = findNearestWalkable(rawStart.x, rawStart.y, rawStart.level);
        const end = findNearestWalkable(rawEnd.x, rawEnd.y, rawEnd.level);
        const startLevel = rawStart.level.toString();
        const endLevel = rawEnd.level.toString();

        console.log(`[Pathfinder] Normalized: (${start.x},${start.y},L${startLevel}) -> (${end.x},${end.y},L${endLevel})`);
        const startTime = performance.now();
        
        const startNode: NavNode = { 
            x: start.x, y: start.y, level: parseInt(startLevel), 
            g: 0, h: getHeuristic(start.x, start.y, parseInt(startLevel), end.x, end.y, parseInt(endLevel)),
            f: 0, parent: null 
        };
        startNode.f = startNode.g + startNode.h;

        const openList: NavNode[] = [startNode];
        const openSet = new Map<string, NavNode>();
        openSet.set(`${start.x},${start.y},${startLevel}`, startNode);

        const closedSet = new Set<string>();
        let nodesSearched = 0;

        while (openList.length > 0) {
            // Pick lowest F (O(N) instead of O(N log N) sort)
            let bestIdx = 0;
            for (let i = 1; i < openList.length; i++) {
                if (openList[i].f < openList[bestIdx].f) bestIdx = i;
            }
            
            const current = openList.splice(bestIdx, 1)[0];
            const currentKey = `${current.x},${current.y},${current.level}`;
            openSet.delete(currentKey);
            closedSet.add(currentKey);
            nodesSearched++;

            // Goal reached?
            if (current.x === end.x && current.y === end.y && current.level.toString() === endLevel) {
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
                if (!isWalkable(nx, ny, nLevel)) continue;

                const g = current.g + 1;
                const h = getHeuristic(nx, ny, nLevel, end.x, end.y, parseInt(endLevel));
                const f = g + h;

                const existing = openSet.get(nKey);
                if (existing) {
                    if (g < existing.g) {
                        existing.g = g;
                        existing.f = f;
                        existing.parent = current;
                    }
                } else {
                    const newNode = { x: nx, y: ny, level: nLevel, g, h, f, parent: current };
                    openList.push(newNode);
                    openSet.set(nKey, newNode);
                }
            }

            // Portal Neighbors (Stairs)
            const portals = portalsByLevel[current.level.toString()] || [];
            for (const p of portals) {
                if (current.x === p.fromX && current.y === p.fromY) {
                    const nKey = `${p.toX},${p.toY},${p.toLevel}`;
                    if (closedSet.has(nKey)) continue;
                    if (!mapData.levels[p.toLevel.toString()]) continue;

                    const g = current.g + 2; // Penalty for using stairs
                    const h = getHeuristic(p.toX, p.toY, p.toLevel, end.x, end.y, parseInt(endLevel));
                    const f = g + h;

                    const existing = openSet.get(nKey);
                    if (existing) {
                        if (g < existing.g) {
                            existing.g = g;
                            existing.f = f;
                            existing.parent = current;
                        }
                    } else {
                        const newNode = { x: p.toX, y: p.toY, level: p.toLevel, g, h, f, parent: current };
                        openList.push(newNode);
                        openSet.set(nKey, newNode);
                    }
                }
            }
            
            if (nodesSearched > 50000) break;
        }

        postMessage({ type: "PATH_NOT_FOUND" });
    }
};
