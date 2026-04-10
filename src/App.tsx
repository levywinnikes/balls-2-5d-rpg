import React, { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import BootScene from "./game/scenes/BootScene";
import TitleScene from "./game/scenes/TitleScene";
import LoadingScene from "./game/scenes/LoadingScene";
import GameScene from "./game/scenes/GameScene";
import { MapEditorScene } from "./game/scenes/MapEditorScene";
import { EditorLayout } from "./editor/ui/EditorLayout";

import { GameOverlay } from "./ui/GameOverlay";
import { UIProvider, useUI } from "./context/UIContext";
import { WindowProvider } from "./ui/components/window/WindowContext";
import { LanguageProvider } from "./context/LanguageContext";
import { MainMenuUI } from "./ui/screens/MainMenuUI";
import { PlayerState } from "./game/entities/Player/PlayerState";

const GameLayout: React.FC = () => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { 
    draggedItem, 
    setDraggedItem, 
    openSplitStack, 
    graphicsQuality,
    toggleEditorMode // ADDED
  } = useUI();
  
  // Use a ref to access latest quality inside the ResizeObserver loop
  const qualityRef = useRef(graphicsQuality);
  useEffect(() => {
      qualityRef.current = graphicsQuality;
      
      // Force trigger resize when quality changes
      if(gameRef.current && containerRef.current) {
         const { width, height } = containerRef.current.getBoundingClientRect();
         // Manually trigger the resize logic
         const multiplier = graphicsQuality === "low" ? 0.5 : (graphicsQuality === "mid" ? 0.75 : 1.0);
         const newWidth = Math.ceil(width * multiplier);
         const newHeight = Math.ceil(height * multiplier);
         
         console.log(`[App] Quality Changed: ${graphicsQuality} -> Resizing to ${newWidth}x${newHeight} (Screen: ${width}x${height})`);
         
         gameRef.current.scale.resize(newWidth, newHeight);
         if(gameRef.current.canvas) {
             gameRef.current.canvas.style.width = "100%";
             gameRef.current.canvas.style.height = "100%";
             // Force pixelated rendering so low res looks retro, not blurry
             gameRef.current.canvas.style.imageRendering = "pixelated"; 
         }
      }
  }, [graphicsQuality]);

  // Controls if we are in menu or game
  const [isInGame, setIsInGame] = useState(false);

  const handleStartGame = (data: any) => {
      setIsInGame(true);
      if (gameRef.current) {
          // Check if Editor or Game
          if (data === "editor") {
             toggleEditorMode(true);
             gameRef.current.scene.start("MapEditorScene");
             gameRef.current.scene.stop("TitleScene");
          } else {
             // Normal Game
             toggleEditorMode(false);
             // Start Loading which starts GameScene
             gameRef.current.scene.start("LoadingScene", data); // Pass data!
             gameRef.current.scene.stop("TitleScene"); // Stop title if running
          }
      }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const initialMultiplier = qualityRef.current === "low" ? 0.5 : (qualityRef.current === "mid" ? 0.75 : 1.0);

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: Math.ceil(containerRef.current.clientWidth * initialMultiplier),
      height: Math.ceil(containerRef.current.clientHeight * initialMultiplier),
      backgroundColor: "#000000",
      parent: "game-container",
      pixelArt: true,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.NO_CENTER,
      },
      physics: {
        default: "arcade",
        arcade: { gravity: { x: 0, y: 0 }, debug: false },
      },
      scene: [BootScene, TitleScene, LoadingScene, GameScene, MapEditorScene],
      dom: { createContainer: true },
    };

    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(config);
      (window as any).game = gameRef.current;
      (window as any).phaserGame = gameRef.current;
      
      // Force style immediately
      if(gameRef.current.canvas) {
         gameRef.current.canvas.style.width = "100%";
         gameRef.current.canvas.style.height = "100%";
      }
    }

    const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
             if (gameRef.current) {
                 const { width, height } = entry.contentRect;
                 if(width > 0 && height > 0) {
                    const q = qualityRef.current;
                    const multiplier = q === "low" ? 0.5 : (q === "mid" ? 0.75 : 1.0);
                    
                    const newWidth = Math.ceil(width * multiplier);
                    const newHeight = Math.ceil(height * multiplier);

                    // console.log(`[App] ResizeObserver: ${newWidth}x${newHeight}`);
                    
                    gameRef.current.scale.resize(newWidth, newHeight);
                    
                    if(gameRef.current.canvas) {
                        gameRef.current.canvas.style.width = "100%";
                        gameRef.current.canvas.style.height = "100%";
                        gameRef.current.canvas.style.imageRendering = "pixelated"; 
                    }
                 }
             }
        }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      gameRef.current?.destroy(true);
      gameRef.current = null;
      (window as any).phaserGame = null;
    };
  }, []); // Run once




  
  // Listen for "Return to Title" event from SystemMenu
  useEffect(() => {
      const handleReturnEvent = () => {
          handleReturnToMenu();
      };
      window.addEventListener("returnToTitle", handleReturnEvent);
      return () => window.removeEventListener("returnToTitle", handleReturnEvent);
  }, []);

  const handleReturnToMenu = () => {
      if(!gameRef.current) return;
      gameRef.current.scene.stop("GameScene");
      gameRef.current.scene.start("TitleScene");
      setIsInGame(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || !gameRef.current) return;
    const scene = gameRef.current.scene.getScene("GameScene") as GameScene;
    if (scene && scene.player && draggedItem.uid) {
      const worldPoint = scene.cameras.main.getWorldPoint(e.clientX, e.clientY);
      
      if (draggedItem.source === "container" && draggedItem.containerId) {
           scene.dropItemFromContainer(
             draggedItem.containerId,
             draggedItem.uid,
             draggedItem.itemId,
             draggedItem.count,
             worldPoint.x,
             worldPoint.y
           );
      } else {
       if (draggedItem.count > 1) {
             openSplitStack(draggedItem, draggedItem.count, (count) => {
                 scene.dropItemFromInventory(
                     draggedItem.uid,
                     worldPoint.x,
                     worldPoint.y,
                     count
                 );
             });
       } else {
             scene.dropItemFromInventory(
                 draggedItem.uid,
                 worldPoint.x,
                 worldPoint.y,
                 1
             );
       }
     }
  }
  setDraggedItem(null);
};



  return (
    <div className="relative w-screen h-screen bg-[#050505] overflow-hidden font-sans text-white">
      {/* MENU OVERLAY */}
      {!isInGame && (
          <MainMenuUI onStart={handleStartGame} />
      )}

      <div className="flex w-full h-full z-0">
        {/* GAME VIEWPORT */}
        <div
          className="flex-1 relative overflow-hidden bg-black"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div
            ref={containerRef}
            id="game-container"
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>

      <div className="absolute inset-0 z-50 pointer-events-none">
        <GameOverlay />
      </div>
    </div>
  );
};



function App() {
  // Check for Editor Mode (Env Var or URL Param)
  const isEditor = process.env.REACT_APP_EDITOR === "true" || new URLSearchParams(window.location.search).get("editor") === "true";

  return (
    <LanguageProvider>
      <UIProvider>
        {/* Dynamic Styles injected at runtime to avoid Webpack strict resolution of assets */}
        <style>{`
          @keyframes play-torch-files {
              0%, 24.9% { background-image: url('assets/items/light_torch/1.png'); }
              25%, 49.9% { background-image: url('assets/items/light_torch/2.png'); }
              50%, 74.9% { background-image: url('assets/items/light_torch/3.png'); }
              75%, 100% { background-image: url('assets/items/light_torch/4.png'); }
          }
        `}</style>
        <WindowProvider>
          {isEditor ? <EditorLayout /> : <GameLayout />}
        </WindowProvider>
      </UIProvider>
    </LanguageProvider>
  );
}

export default App;
