
import React, { useState } from "react";
import { useUI } from "../context/UIContext";
import { SidebarMinimap } from "./components/SidebarMinimap";
import { 
  User, 
  BookOpen, 
  Settings, 
  Menu,
  Zap,
  Box
} from "lucide-react";
import { SkillProgressHUD } from "./components/SkillProgressHUD";
import { StatusWidget } from "./components/StatusWidget";
import { PlayerState } from "../game/entities/Player/PlayerState";

// --- Subcomponent: Minimap Container (Top Right) ---
const MinimapWidget: React.FC = () => {
    return (
        <div className="w-48 h-48 rounded-2xl border-4 border-gray-800 bg-black overflow-hidden shadow-2xl relative group pointer-events-auto">
             <div className="absolute inset-0 opacity-80 transition-opacity group-hover:opacity-100">
                <SidebarMinimap />
             </div>
             {/* Glossy overlay */}
             <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 pointer-events-none" />
        </div>
    );
};


// --- Subcomponent: Action Toolbar (Bottom Center) ---
const ActionToolbar: React.FC = () => {
    const { toggleWindow, windows } = useUI();
    const [hovered, setHovered] = useState<string | null>(null);
    const [perspectiveMode, setPerspectiveMode] = useState<"2D" | "3D">(PlayerState.getInstance().getPerspectiveMode());

    const tools = [
        { id: "heroMenu", icon: User, label: "Hero Menu" },
        { id: "grimorio", icon: BookOpen, label: "Grimório" },
        { id: "settings", icon: Settings, label: "Settings" },
        { id: "cheats", icon: Zap, label: "Cheats" },
    ];

    const handleTogglePerspective = () => {
        const newMode = PlayerState.getInstance().togglePerspectiveMode();
        setPerspectiveMode(newMode);
    };

    return (
        <div className="flex gap-4 p-3 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl transition-all duration-300 pointer-events-auto mb-2">
            {tools.map((t) => {
                const Icon = t.icon;
                const isActive = windows[t.id as keyof typeof windows];
                
                return (
                    <button
                        key={t.id}
                        onClick={() => toggleWindow(t.id as any)} // Cast safely
                        onMouseEnter={() => setHovered(t.id)}
                        onMouseLeave={() => setHovered(null)}
                        className={`
                            relative group p-2 rounded-xl transition-all duration-200 ease-out
                            ${isActive ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50" : "text-gray-400 hover:text-white hover:bg-white/10"}
                            hover:scale-110 active:scale-95
                        `}
                    >
                        <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                        
                        {/* Tooltip */}
                        {hovered === t.id && (
                             <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black text-white text-xs px-2 py-1 rounded border border-gray-700 shadow-lg animate-in fade-in slide-in-from-bottom-2">
                                {t.label}
                             </div>
                        )}
                    </button>
                );
            })}

             {/* Perspective Toggle Button */}
             <div className="w-px bg-white/10 mx-1" />
             <button 
                onClick={handleTogglePerspective}
                onMouseEnter={() => setHovered("perspective")}
                onMouseLeave={() => setHovered(null)}
                className={`
                    relative p-2 rounded-xl transition-all duration-200 ease-out
                    ${perspectiveMode === "2D" ? "text-cyan-400 bg-cyan-500/10" : "text-gray-400 hover:text-white hover:bg-white/10"}
                    hover:scale-110 active:scale-95
                `}
                title="Toggle 2.5D / 2D"
            >
                 <Box size={24} strokeWidth={perspectiveMode === "2D" ? 2.5 : 2} />
                 {hovered === "perspective" && (
                      <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black text-white text-xs px-2 py-1 rounded border border-gray-700 shadow-lg animate-in fade-in slide-in-from-bottom-2">
                         {perspectiveMode === "3D" ? "View: 2.5D (Perspective)" : "View: 2D (Flat)"}
                      </div>
                 )}
             </button>

             {/* System Menu Button */}
             <div className="w-px bg-white/10 mx-1" />
             <button 
                onClick={() => toggleWindow("systemMenu")}
                className="text-gray-500 hover:text-gray-300 p-2 hover:bg-white/5 rounded-xl transition-colors"
                title="System Menu"
            >
                 <Menu size={20} />
             </button>
        </div>
    );
};


export const HUD: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-[40]">
        
        {/* TOP ROW */}
        <div className="flex justify-between items-start">
            <div />
            <div className="flex items-start gap-4">
                <SkillProgressHUD />
                <MinimapWidget />
            </div>
        </div>

        {/* BOTTOM ROW */}
        <div className="flex justify-center items-end pb-4">
             <ActionToolbar />
        </div>
        
        {/* Status Widget (Absolute Positioned by itself) */}
        <StatusWidget />

    </div>
  );
};
