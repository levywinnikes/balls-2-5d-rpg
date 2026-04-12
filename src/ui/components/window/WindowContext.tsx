import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { WindowRegistry } from "./WindowRegistry";
import { PlayerState } from "../../../game/entities/Player/PlayerState";

export interface WindowInstance {
    id: string; // Unique ID (e.g. "inventory", "hero_menu")
    zIndex: number;
    position?: { x: number, y: number };
    size?: { width: number, height: number };
    minimized: boolean;
    pinned: boolean; // If pinned, disable drag
}

interface WindowContextType {
    openWindows: Record<string, WindowInstance>;
    openWindow: (id: string, initialPos?: {x:number, y:number}) => void;
    closeWindow: (id: string) => void;
    toggleWindow: (id: string) => void;
    focusWindow: (id: string) => void;
    updateWindow: (id: string, updates: Partial<WindowInstance>) => void;
    isWindowOpen: (id: string) => boolean;
}

const WindowContext = createContext<WindowContextType | undefined>(undefined);

export const WindowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [openWindows, setOpenWindows] = useState<Record<string, WindowInstance>>({});
    const nextZIndex = useRef(100);

    const getNextZ = () => {
        nextZIndex.current += 1;
        return nextZIndex.current;
    };

    const focusWindow = useCallback((id: string) => {
        setOpenWindows(prev => {
            if (!prev[id]) return prev;
            return {
                ...prev,
                [id]: { ...prev[id], zIndex: getNextZ() }
            };
        });
    }, []);

    const openWindow = useCallback((id: string, initialPos?: {x:number, y:number}) => {
        const entry = WindowRegistry.get(id);
        if (!entry) {
            console.warn(`[WindowSystem] Unknown Window ID: ${id}`);
            return;
        }

        // PERSISTENCE LOAD
        const savedConfig = PlayerState.getInstance().getWindowConfig(id);
        const pos = initialPos || (savedConfig ? { x: savedConfig.x, y: savedConfig.y } : undefined);
        const size = savedConfig ? { width: savedConfig.width, height: savedConfig.height } : undefined;

        setOpenWindows(prev => {
            if (prev[id]) {
                // Already open, just focus
                return { ...prev, [id]: { ...prev[id], zIndex: getNextZ() } };
            }
            
            // New Instance
            return {
                ...prev,
                [id]: {
                    id,
                    zIndex: getNextZ(),
                    minimized: savedConfig?.minimized || false,
                    pinned: false,
                    position: pos,
                    size: size
                }
            };
        });
    }, []);

    const closeWindow = useCallback((id: string) => {
        setOpenWindows(prev => {
            const copy = { ...prev };
            delete copy[id];
            return copy;
        });
    }, []);

    const toggleWindow = useCallback((id: string) => {
        setOpenWindows(prev => {
            if (prev[id]) {
                const copy = { ...prev };
                delete copy[id];
                return copy;
            }
            
             const entry = WindowRegistry.get(id);
             if(!entry) return prev;

             // PERSISTENCE LOAD
             const savedConfig = PlayerState.getInstance().getWindowConfig(id);

             return {
                ...prev,
                [id]: {
                    id,
                    zIndex: getNextZ(),
                    minimized: savedConfig?.minimized || false,
                    pinned: false,
                    position: savedConfig ? { x: savedConfig.x, y: savedConfig.y } : undefined,
                    size: savedConfig ? { width: savedConfig.width, height: savedConfig.height } : undefined
                }
             };
        });
    }, []);

    const updateWindow = useCallback((id: string, updates: Partial<WindowInstance>) => {
        setOpenWindows(prev => {
            if (!prev[id]) return prev;
            const updated = { ...prev[id], ...updates };

            // PERSISTENCE SAVE
            if (updates.position || updates.size || updates.minimized !== undefined) {
                PlayerState.getInstance().setWindowConfig(id, {
                    x: updated.position?.x ?? 0,
                    y: updated.position?.y ?? 0,
                    width: updated.size?.width ?? 0,
                    height: updated.size?.height ?? 0,
                    minimized: updated.minimized
                });
            }

            return { ...prev, [id]: updated };
        });
    }, []);

    const isWindowOpen = useCallback((id: string) => !!openWindows[id], [openWindows]);

    return (
        <WindowContext.Provider value={{
            openWindows,
            openWindow,
            closeWindow,
            toggleWindow,
            focusWindow,
            updateWindow,
            isWindowOpen
        }}>
            {children}
        </WindowContext.Provider>
    );
};

export const useWindowSystem = () => {
    const context = useContext(WindowContext);
    if (!context) throw new Error("useWindowSystem must be used within WindowProvider");
    return context;
};
