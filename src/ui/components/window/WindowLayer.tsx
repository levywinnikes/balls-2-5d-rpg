import React from "react";
import { useWindowSystem } from "./WindowContext";
import { WindowContainer } from "./WindowContainer";

export const WindowLayer: React.FC = () => {
    const { openWindows } = useWindowSystem();

    return (
        <div 
            id="window-layer" 
            style={{ 
                position: "absolute", 
                top: 0, left: 0, 
                width: "100%", height: "100%", 
                pointerEvents: "none", // Let clicks pass through to game world if not hitting a window
                zIndex: 100 // Base Z-Index for UI Layer
            }}
        >
            {Object.values(openWindows).map(instance => {
                // Intercept 'hero_menu' to prevent standard window rendering
                if (instance.id === "hero_menu") return null;
                
                return <WindowContainer key={instance.id} instance={instance} />;
            })}
        </div>
    );
};
