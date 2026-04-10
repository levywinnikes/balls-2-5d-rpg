import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { WindowRegistry } from "./WindowRegistry";

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
                    minimized: false,
                    pinned: false,
                    position: initialPos
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
            // Open logic duplicate but simpler for toggle
             const entry = WindowRegistry.get(id);
             if(!entry) return prev;

             return {
                ...prev,
                [id]: {
                    id,
                    zIndex: getNextZ(),
                    minimized: false,
                    pinned: false
                }
             };
        });
    }, []);

    const updateWindow = useCallback((id: string, updates: Partial<WindowInstance>) => {
        setOpenWindows(prev => {
            if (!prev[id]) return prev;
            return { ...prev, [id]: { ...prev[id], ...updates } };
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
