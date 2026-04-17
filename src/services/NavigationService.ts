
/**
 * NAVIGATION SERVICE
 * Managed interface for navigation workers and pathfinding logic.
 * AI GUIDANCE: See /docs/AI_READ_FIRST.md and /docs/SYSTEM_BMS.md
 */
import { PlayerState } from "../game/entities/Player/PlayerState";
import { t_game } from "../game/i18n/translations";

export class NavigationService {
    private static worker: Worker | null = null;
    private static isInitialized = false;
    private static lastDiagnostics: any = null;

    public static init(mapData: any, binaryLevels: Record<string, Uint8Array>) {
        if (this.isInitialized) return;
        
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
                playerState.emit("uiNotification", { type: "warning", message: t_game("msg_destination_unreachable") });
            }
        };

        this.worker.postMessage({ type: "INIT_MAP", data: mapData, binaryLevels });
    }

    public static findPath(startGrid: { x: number, y: number, level: string }, endGrid: { x: number, y: number, level: string }) {
        if (!this.worker || !this.isInitialized) {
            console.warn("[NavigationService] Worker not ready.");
            return;
        }

        this.worker.postMessage({ 
            type: "FIND_PATH", 
            data: { 
                start: { x: startGrid.x, y: startGrid.y, level: startGrid.level },
                end: { x: endGrid.x, y: endGrid.y, level: endGrid.level }
            } 
        });
    }

    public static getDiagnostics() {
        return this.lastDiagnostics;
    }
}
