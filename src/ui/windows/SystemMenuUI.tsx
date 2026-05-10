import React, { useEffect } from "react";
import { useUI } from "../../context/UIContext";
import { useLanguage } from "../../context/LanguageContext";
import { Save, LogOut, Play, Book } from "lucide-react";
import { PlayerState } from "../../game/entities/Player/PlayerState";

// Robust helper to access game instance and systems
const getGameSystems = (): { saveSystem?: any; scene?: any } => {
  const game = (window as any).game;
  if (!game) {
    console.error("SystemMenu: window.game not found");
    return {};
  }

  // Try finding the scene by key
  let scene = game.scene.getScene("GameScene");

  // If not found or not active, try to find any active scene that has a saveSystem
  if (!scene || !scene.sys || !scene.sys.settings.active) {
    const scenes = game.scene.scenes;
    scene = scenes.find((s: any) => s.saveSystem && s.sys.settings.active);
  }

  if (scene) {
    const saveSystem = (scene as any).saveSystem;
    return { saveSystem, scene };
  }

  return {};
};

export const SystemMenuUI: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => Promise<boolean>;
  onSaveAndExit?: () => Promise<boolean>;
  useScenePause?: boolean;
}> = ({ isOpen, onClose, onSave, onSaveAndExit, useScenePause = true }) => {
  const { s, windows, windowPositions, toggleWindow } = useUI();
  const { t } = useLanguage();
  const sceneRef = React.useRef<any>(null);

  // Handle Pause/Resume (2D runtime)
  useEffect(() => {
    if (!useScenePause) {
      return;
    }

    // Find and store scene reference ONCE when opening
    if (isOpen) {
      const { scene } = getGameSystems();
      if (scene) {
        sceneRef.current = scene;
        if (scene.scene && typeof scene.scene.pause === "function") {
          console.log("SystemMenu: Pausing Game");
          scene.scene.pause();
        }
      }
    } else {
      // If isOpen is false, try to resume if we have a ref
      if (sceneRef.current && sceneRef.current.scene) {
        console.log("SystemMenu: Resuming Game (Effect)");
        sceneRef.current.scene.resume();
      }
    }

    return () => {
      // Safety resume on unmount using the REF (most reliable)
      if (sceneRef.current && sceneRef.current.scene) {
        console.log("SystemMenu: Resuming Game (Cleanup)");
        sceneRef.current.scene.resume();
      }
    };
  }, [isOpen, useScenePause]);

  const handleSaveToFile = async () => {
    console.log("SystemMenu: Save clicked");

    if (onSave) {
      try {
        const success = await onSave();
        if (success) {
          onClose();
        } else {
          alert(t("msg_save_failed"));
        }
      } catch (e) {
        console.error(e);
        alert(t("msg_save_exception", { error: String(e) }));
      }
      return;
    }

    // Use the ref if available, or fetch fresh
    const scene = sceneRef.current || getGameSystems().scene;
    const saveSystem = scene?.saveSystem;

    if (!saveSystem) {
      alert(t("msg_save_system_missing"));
      return;
    }

    if (saveSystem && scene) {
      const charName = PlayerState.getInstance().getName() || "NewCharacter";

      const uiData = {
        windows: windows,
        positions: windowPositions,
      };

      try {
        const success = await saveSystem.saveGame(charName, uiData);

        if (success) {
          saveSystem.exportSave(charName);
          if (scene.showFloatingText && scene.player?.sprite) {
            scene.showFloatingText(
              scene.player.sprite.x,
              scene.player.sprite.y - 50,
              t("msg_game_saved"),
              0x00ff00,
            );
          }
          console.log("SystemMenu: Save Success");

          // Explicitly resume before closing to be doubly sure
          if (scene.scene) scene.scene.resume();

          onClose();
        } else {
          alert(t("msg_save_failed"));
        }
      } catch (e) {
        console.error(e);
        alert(t("msg_save_exception", { error: String(e) }));
      }
    }
  };

  const handleExitToTitle = async () => {
    console.log("SystemMenu: Exit clicked");

    if (onSaveAndExit) {
      try {
        const ok = await onSaveAndExit();
        if (!ok) {
          alert(t("msg_save_failed"));
        }
      } catch (e) {
        alert(t("msg_save_exit_exception", { error: String(e) }));
      }
      return;
    }

    const scene = sceneRef.current || getGameSystems().scene;
    const saveSystem = scene?.saveSystem;

    if (!saveSystem) {
      alert(t("msg_save_exit_missing"));
      return;
    }

    if (scene && saveSystem) {
      const charName = PlayerState.getInstance().getName() || "AutoSaveAndExit";
      const uiData = {
        windows: windows,
        positions: windowPositions,
      };

      try {
        await saveSystem.saveGame(charName, uiData);
        // FULL RESET: Reload the page to ensure clean state
        // This prevents singleton pollution and memory leaks
        window.location.reload();
      } catch (e) {
        alert(t("msg_save_exit_exception", { error: String(e) }));
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.7)", // Dark semi-transparent
        zIndex: 9999, // On top of everything
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(2px)",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: `${s(20)}px`,
          width: "300px",
          padding: "20px",
          background: "var(--bg-glass)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "8px",
          boxShadow: "var(--shadow-window)",
          backdropFilter: "blur(12px)",
        }}
      >
        <h2
          style={{
            color: "#fbbf24",
            textAlign: "center",
            margin: 0,
            fontSize: "1.5em",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          {t("hud_system")}
        </h2>
        <div
          style={{ height: "1px", background: "#444", marginBottom: "10px" }}
        />

        <button
          className="system-btn-large"
          onClick={handleSaveToFile}
          style={btnStyle(s)}
        >
          <Save size={24} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <span style={{ fontSize: "1.1em" }}>{t("save_game")}</span>
            <span style={{ fontSize: "0.7em", color: "#aaa" }}>
              {t("sys_save_desc")}
            </span>
          </div>
        </button>

        <button
          className="system-btn-large"
          onClick={() => {
            onClose();
            toggleWindow("questLog");
          }}
          style={btnStyle(s)}
        >
          <Book size={24} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <span style={{ fontSize: "1.1em" }}>{t("hud_quest_log")}</span>
            <span style={{ fontSize: "0.7em", color: "#aaa" }}>
              {t("active") + " / " + t("completed")}
            </span>
          </div>
        </button>

        <button
          className="system-btn-large"
          onClick={handleExitToTitle}
          style={{ ...btnStyle(s), background: "#622", borderColor: "#844" }}
        >
          <LogOut size={24} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <span style={{ fontSize: "1.1em" }}>{t("menu_save_and_exit")}</span>
            <span style={{ fontSize: "0.7em", color: "#faa" }}>
              {t("sys_exit_desc")}
            </span>
          </div>
        </button>

        <button
          className="system-btn-large"
          onClick={onClose}
          data-benchmark-id="system-menu-resume"
          style={{ ...btnStyle(s), background: "#333", marginTop: "10px" }}
        >
          <Play size={24} />
          <span>{t("sys_resume")}</span>
        </button>
      </div>
    </div>
  );
};

const btnStyle = (s: (n: number) => number) => ({
  display: "flex",
  alignItems: "center",
  gap: 20,
  background: "var(--bg-glass-light)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
  padding: s(15),
  borderRadius: 8,
  cursor: "pointer",
  fontSize: s(16),
  justifyContent: "flex-start",
  transition: "all 0.2s",
  width: "100%",
  textAlign: "left" as const,
});
