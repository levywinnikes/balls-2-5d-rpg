import React, { useEffect, useState } from "react";
import { TileRegistry } from "../../game/graphics/tiles/TileRegistry";
import { MapEditorScene } from "../../game/scenes/MapEditorScene";

// Temporary mock type if TileDefinition is not exported
interface TileDef {
  id: string;
  texturePath?: string;
}

export const MapEditorUI: React.FC = () => {
  const [tiles, setTiles] = useState<TileDef[]>([]);
  const [selectedTile, setSelectedTile] = useState<string>("grs"); // Grass default
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [activeTool, setActiveTool] = useState<"brush" | "eraser">("brush");
  const entities = [
    "rat",
    "spider",
    "skeleton",
    "goblin",
    "orc",
    "rotworm",
    "giant_spider",
    "demon",
    "dragon",
    "chest",
  ]; // Basic list for now

  useEffect(() => {
    // Load tiles from registry
    // The registry needs to be initialized. It might be already if game loaded.
    const allTiles = TileRegistry.getRegisteredTiles();
    setTiles(allTiles);
  }, []);

  const getScene = (): MapEditorScene | null => {
    const game = (window as any).game as Phaser.Game;
    if (!game) return null;
    return game.scene.getScene("MapEditorScene") as MapEditorScene;
  };

  const handleLevelChange = (delta: number) => {
    const newLevel = currentLevel + delta;
    setCurrentLevel(newLevel);

    const scene = getScene();
    if (scene) {
      scene.setLevel(newLevel.toString());
    }
  };

  const handleToolChange = (tool: "brush" | "eraser") => {
    setActiveTool(tool);
    const scene = getScene();
    if (scene) {
      scene.setTool(tool);
    }
  };

  const handleTileSelect = (tileId: string) => {
    setSelectedTile(tileId);
    setActiveTool("brush");
    const scene = getScene();
    if (scene) {
      scene.setSelectedTile(tileId);
    }
  };

  const handleSave = () => {
    const scene = getScene();
    if (scene) {
      scene.saveMap();
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex">
      {/* Sidebar - Palette */}
      <div className="w-64 bg-stone-900 border-r-2 border-stone-600 flex flex-col pointer-events-auto h-full overflow-hidden">
        <div className="p-2 bg-stone-800 border-b border-stone-700 text-amber-100 font-bold text-center">
          TIBIA MAP EDITOR
        </div>

        {/* Controls */}
        <div className="p-2 grid grid-cols-2 gap-2 bg-stone-800 border-b border-stone-700">
          <button
            onClick={() => handleSave()}
            className="col-span-2 bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold"
          >
            SAVE JSON
          </button>

          <button
            onClick={() => {
              const scene = getScene();
              if (scene) {
                scene.scene.start("TitleScene");
                // Force reload/reset might be safer to clear state, but TitleScene is ok.
                // Also update UI Context
                // We can't access toggleEditorMode here easily without context?
                // MainMenuUI handles "onStart" but here we are standalone.
                // Use window.location.reload() as a nuclear option or just change scene.
                window.location.reload();
              }
            }}
            className="col-span-2 bg-red-900 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-bold mt-1"
          >
            EXIT EDITOR
          </button>

          <div className="col-span-2 flex items-center justify-between bg-stone-900 p-1 rounded">
            <button
              onClick={() => handleLevelChange(-1)}
              className="px-2 bg-stone-700 text-white rounded"
            >
              -
            </button>
            <span className="text-white text-xs">Level: {currentLevel}</span>
            <button
              onClick={() => handleLevelChange(1)}
              className="px-2 bg-stone-700 text-white rounded"
            >
              +
            </button>
          </div>

          <button
            onClick={() => handleToolChange("brush")}
            className={`bg-stone-700 px-2 py-1 rounded text-xs ${activeTool === "brush" ? "border-2 border-yellow-400" : ""}`}
          >
            Brush
          </button>
          <button
            onClick={() => handleToolChange("eraser")}
            className={`bg-stone-700 px-2 py-1 rounded text-xs ${activeTool === "eraser" ? "border-2 border-yellow-400" : ""}`}
          >
            Eraser
          </button>
        </div>

        {/* Tab / Sections */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-stone-600">
          {/* TILES */}
          <div className="mb-4">
            <h3 className="text-stone-400 text-xs font-bold mb-2 uppercase border-b border-stone-700 pb-1">
              Tiles
            </h3>
            <div className="grid grid-cols-4 gap-1">
              {tiles.map((tile) => (
                <div
                  key={tile.id}
                  onClick={() => handleTileSelect(tile.id)}
                  className={`aspect-square bg-stone-900 border cursor-pointer hover:border-yellow-200 relative group flex items-center justify-center overflow-hidden
                                ${selectedTile === tile.id ? "border-yellow-400" : "border-stone-700"}
                            `}
                  title={tile.id}
                >
                  {tile.texturePath ? (
                    <img
                      src={tile.texturePath}
                      className="w-full h-full object-cover pixelated"
                      alt={tile.id}
                      style={{ imageRendering: "pixelated" }}
                    />
                  ) : (
                    <span className="text-[8px] text-stone-500 w-full text-center break-words px-0.5">
                      {tile.id.substring(0, 6)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ENTITIES / SPECIAL */}
          <div className="mb-4">
            <h3 className="text-stone-400 text-xs font-bold mb-2 uppercase border-b border-stone-700 pb-1">
              Enemies/Items
            </h3>
            <div className="flex flex-col gap-1">
              {entities.map((ent) => (
                <button
                  key={ent}
                  onClick={() => handleTileSelect(ent)} // For now, assume map loader handles known entity keys or we need a way to add them
                  className={`text-left px-2 py-1 bg-stone-800 text-xs text-stone-300 hover:bg-stone-700 border
                                ${selectedTile === ent ? "border-yellow-400" : "border-stone-800"}
                            `}
                >
                  {ent}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-gray-500 mt-2 italic">
              Note: To verify Entities, the map loader must recognize their IDs.
              For newMap.json, entities are mapped by short-codes. The current
              editor implementation simplifies painting by putting the full ID
              in the map for now. The MapLoader needs to be robust enough to
              handle full IDs or we need a mapping step.
            </div>
          </div>
        </div>
      </div>

      {/* Main View Area (Empty, lets events pass through to canvas) */}
      <div className="flex-1">
        {/* Maybe Top Status Bar? */}
        <div className="bg-black/50 text-white text-xs p-1 pointer-events-auto inline-block m-2 rounded backdrop-blur">
          Click to Paint. Use Arrow Keys to Pan. Q/E to Zoom.
        </div>
      </div>
    </div>
  );
};
