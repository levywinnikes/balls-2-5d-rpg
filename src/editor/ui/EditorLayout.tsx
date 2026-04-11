import React, { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { Save, Play, Layers, Grid, Trash2, Brush } from "lucide-react";
import { EditorScene } from "../scenes/EditorScene";
import { TileRegistry } from "../../game/graphics/tiles/TileRegistry";
import { useUI } from "../../context/UIContext";

const TILE_SIZE = 32;

export const EditorLayout: React.FC = () => {
    const gameRef = useRef<Phaser.Game | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { scale, s } = useUI();
    
    const [currentLayer, setCurrentLayer] = useState(0);
    const [selectedTool, setSelectedTool] = useState<"brush" | "eraser">("brush");
    const [selectedTile, setSelectedTile] = useState<string>("grass"); // Default Dirt
    
    // Save Feedback
    const [saveStatus, setSaveStatus] = useState("");

    useEffect(() => {
        if (!containerRef.current) return;

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            backgroundColor: "#1a1a1a",
            parent: "editor-container",
            pixelArt: true,
            scene: [EditorScene], // We will use a dedicated Scene
            physics: { default: "arcade", arcade: { debug: false } },
            scale: {
                 mode: Phaser.Scale.RESIZE,
                 autoCenter: Phaser.Scale.NO_CENTER
            }
        };

        if (!gameRef.current) {
            gameRef.current = new Phaser.Game(config);
            (window as any).editorGame = gameRef.current;
        }
        
        // Pass React State to Scene via Registry or Events?
        // Or Scene reads from a singleton/context?
        // Simplest: Scene emits events, React handles UI. React calls Scene methods.
        
        return () => {
            gameRef.current?.destroy(true);
            gameRef.current = null;
        };
    }, []);
    
    // Sync React State to Phaser Scene
    useEffect(() => {
        const scene = gameRef.current?.scene.getScene("EditorScene") as any;
        if(scene && scene.setEditorState) {
            scene.setEditorState({
                layer: currentLayer,
                tool: selectedTool,
                tile: selectedTile
            });
        }
    }, [currentLayer, selectedTool, selectedTile]);

    const handleSave = async () => {
        setSaveStatus("Saving...");
        const scene = gameRef.current?.scene.getScene("EditorScene") as any;
        if(!scene) return;
        
        try {
            const mapData = scene.getMapData();
            const res = await fetch('http://localhost:3001/save-map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mapData)
            });
            const json = await res.json();
            if(json.success) {
                setSaveStatus("Saved!");
                setTimeout(() => setSaveStatus(""), 2000);
            } else {
                setSaveStatus("Error: " + json.error);
            }
        } catch (err) {
            setSaveStatus("Network Error (Is server running?)");
        }
    };
    
    // Quick Test (Reloads page without editor flag? Or switch Scene?)
    // For now simple alert
    const handleTest = () => {
        // ideally remove ?editor=true and reload
        const url = new URL(window.location.href);
        url.searchParams.delete("editor");
        window.location.href = url.toString();
    };

    return (
        <div style={{ display: "flex", width: "100vw", height: "100vh", backgroundColor: "#111", color: "#ddd", fontSize: "12px" }}>
            {/* TOOLBAR (Left) */}
            <div style={{ width: "60px", borderRight: "1px solid #333", display: "flex", flexDirection: "column", alignItems: "center", padding: "10px", gap: "10px", background: "#222" }}>
                <div title="Brush" onClick={() => setSelectedTool("brush")} style={{ padding: "8px", borderRadius: "4px", background: selectedTool === "brush" ? "#444" : "transparent", cursor: "pointer" }}>
                    <Brush size={20} />
                </div>
                <div title="Eraser" onClick={() => setSelectedTool("eraser")} style={{ padding: "8px", borderRadius: "4px", background: selectedTool === "eraser" ? "#444" : "transparent", cursor: "pointer" }}>
                    <Trash2 size={20} />
                </div>
                <div style={{ height: "1px", width: "100%", background: "#444", margin: "5px 0" }} />
                <div title="Save Map" onClick={handleSave} style={{ padding: "8px", borderRadius: "4px", cursor: "pointer", color: "#4ade80" }}>
                    <Save size={20} />
                </div>
                <div title="Test Game" onClick={handleTest} style={{ padding: "8px", borderRadius: "4px", cursor: "pointer", color: "#fbbf24" }}>
                    <Play size={20} />
                </div>
            </div>
            
            {/* MAIN VIEWPORT */}
            <div style={{ flex: 1, position: "relative" }}>
                 <div ref={containerRef} id="editor-container" style={{ width: "100%", height: "100%" }} />
                 {saveStatus && (
                     <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.8)", padding: "5px 10px", borderRadius: "4px", border: "1px solid #4ade80", color: "#4ade80" }}>
                         {saveStatus}
                     </div>
                 )}
            </div>
            
            {/* RIGHT SIDEBAR (Properties) */}
            <div style={{ width: "250px", borderLeft: "1px solid #333", background: "#1a1a1a", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "10px", borderBottom: "1px solid #333", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Layers size={14} /> Layer Control
                </div>
                <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "5px" }}>
                     {[0, 1, 2].map(l => (
                         <div 
                            key={l} 
                            onClick={() => setCurrentLayer(l)}
                            style={{ 
                                padding: "8px", 
                                background: currentLayer === l ? "#3b82f6" : "#222", 
                                cursor: "pointer", 
                                borderRadius: "4px",
                                display: "flex", 
                                justifyContent: "space-between"
                            }}
                         >
                             <span>Z-Level {l}</span>
                             {currentLayer === l && <span style={{fontSize:"10px"}}>ACTIVE</span>}
                         </div>
                     ))}
                </div>
                
                <div style={{ padding: "10px", borderBottom: "1px solid #333", borderTop: "1px solid #333", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Grid size={14} /> Tiles
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "10px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px", alignContent: "start" }}>
                     {TileRegistry.getRegisteredTiles().map(item => (
                         <div 
                            key={item.id}
                            onClick={() => setSelectedTile(item.id)}
                            style={{
                                aspectRatio: "1/1",
                                background: "#333",
                                border: selectedTile === item.id ? "2px solid #3b82f6" : "1px solid #444",
                                cursor: "pointer",
                                position: "relative",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                            }}
                            title={`Tile ${item.id}`}
                         >
                              <span style={{fontSize:"8px", color:"#fff", padding:"2px", textAlign: "center"}}>{item.id}</span>
                         </div>
                     ))}
                </div>
            </div>
        </div>
    );
};
