
import { PlayerState } from "../game/entities/Player/PlayerState";

export class NavigationService {
    private static worker: Worker | null = null;
    private static isInitialized = false;
    private static lastDiagnostics: any = null;

    public static init(mapData: any) {
        if (this.isInitialized) return;
        
        // We use the worker as a standard worker. 
        // In Vite/CRA, we might need new URL(...)
        this.worker = new Worker(new URL('../workers/navigation.worker.ts', import.meta.url));
        
        this.worker.onmessage = (e) => {
            const { type, data } = e.data;
            if (type === "MAP_READY") {
                this.isInitialized = true;
                console.log("[NavigationService] Worker is ready.");
            } else if (type === "PATH_FOUND") {
                const playerState = PlayerState.getInstance();
                console.log("[NavigationService] Path found with", data.path.length, "points.");
                playerState.setActiveRoute(data.path);
                this.lastDiagnostics = data.diagnostics;
                playerState.emit("navigationDiagnostics", data.diagnostics);
            } else if (type === "PATH_NOT_FOUND") {
                console.warn("[NavigationService] Path calculation failed: location unreachable.");
                const playerState = PlayerState.getInstance();
                playerState.setActiveRoute(null);
                playerState.emit("uiNotification", { type: "warning", message: "Destination unreachable!" });
            }
        };

        this.worker.postMessage({ type: "INIT_MAP", data: mapData });
    }

    public static findPath(start: { x: number, y: number, level: string }, end: { x: number, y: number, level: string }) {
        if (!this.worker || !this.isInitialized) {
            console.warn("[NavigationService] Worker not ready.");
            return;
        }

        // Convert world coords to grid coords for the worker
        // tileSize is 32 in this game
        const tileSize = 32;
        this.worker.postMessage({ 
            type: "FIND_PATH", 
            data: { 
                start: { x: Math.floor(start.x / tileSize), y: Math.floor(start.y / tileSize), level: start.level },
                end: { x: Math.floor(end.x / tileSize), y: Math.floor(end.y / tileSize), level: end.level }
            } 
        });
    }

    public static getDiagnostics() {
        return this.lastDiagnostics;
    }
}
