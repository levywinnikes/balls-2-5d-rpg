import React, { useState, useEffect, useCallback } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { Sword, Scroll, Trash2, Droplets, User, Bot } from "lucide-react";
import { AudioManager } from "../../game/systems/AudioManager";

interface MainMenuUIProps {
  onStart: (data: any) => void;
}

export const MainMenuUI: React.FC<MainMenuUIProps> = ({ onStart }) => {
  const { t, language, setLanguage } = useLanguage();
  const [menu, setMenu] = useState<"main" | "new" | "load">("main");
  const [saves, setSaves] = useState<any[]>([]);
  const [charName, setCharName] = useState("");
  const electronAPI = (window as any).electronAPI;

  // Bridge to Electron API
  const getSaves = useCallback(async () => {
    if (electronAPI?.listSaves) {
      // Native Mode
      const result = await electronAPI.listSaves();
      if (result.success && result.files) {
        // We need to load each file to get metadata (or backend should provide it, but listSaves returns file stats usually)
        // The loop in SaveSystem loads them. Let's do similar or just list names?
        // SaveSystem.listCharacters returns { name, level, timestamp, playTime }
        // We can't use SaveSystem directly easily as it expects Scene.
        // But we can replicate:
        const list: any[] = [];
        for (const f of result.files) {
          const name = f.name.replace(/\.(dat|json)$/, "");
          const loadRes = await electronAPI.loadGame(name);
          if (loadRes.success && loadRes.data) {
            list.push(loadRes.data);
          }
        }
        return list.sort((a, b) => b.timestamp - a.timestamp);
      }
      return [];
    } else {
      // Web Mode (LocalStorage)
      const saves: any[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("tgs_save_")) {
          try {
            const data = JSON.parse(localStorage.getItem(key)!);
            saves.push(data);
          } catch (e) {}
        }
      }
      return saves.sort((a, b) => b.timestamp - a.timestamp);
    }
  }, [electronAPI]);

  useEffect(() => {
    if (menu === "load") {
      getSaves().then(setSaves);
    }
  }, [menu, getSaves]);

  // Procedural Title Music Logic
  useEffect(() => {
    // Ensure PlayerState is clean when entering Main Menu
    // This fixes issues where previous session state (Level 100) might conflict if not fully cleared
    PlayerState.getInstance().reset();

    const audio = AudioManager.getInstance();

    // Start music (will only work after init)
    audio.startTitleMusic();

    return () => {
      audio.stopTitleMusic();
    };
  }, []);

  const handleInteraction = async () => {
    // Initializer Tone.js on any menu interaction
    await AudioManager.getInstance().init();
    // Restart music if it failed before init
    AudioManager.getInstance().startTitleMusic();
  };

  const handleCreate = () => {
    if (!charName.trim()) return;
    // Ensure we start fresh
    PlayerState.getInstance().reset();
    // Just start new game, engine handles save creation on confirm/autosave usually
    onStart({ isNewGame: true, charName });
  };

  const handleDelete = async (name: string) => {
    if (window.confirm(t("menu_delete_confirm").replace("{name}", name))) {
      if (electronAPI?.deleteGame) {
        await electronAPI.deleteGame(name);
        localStorage.removeItem(`tgs_save_${name}`);
      }
      getSaves().then(setSaves);
    }
  };

  const btnStyle =
    "w-64 py-3 bg-[#222] hover:bg-[#333] border-2 border-[#444] rounded-lg text-[#fbbf24] font-bold text-lg flex items-center justify-center gap-3 transition-all transform hover:scale-105 shadow-lg active:scale-95";
  const inputStyle =
    "w-64 p-3 bg-[#111] border-2 border-[#444] rounded text-white text-center focus:border-[#fbbf24] outline-none mb-4";

  return (
    <div
      className="absolute inset-0 z-[100] procedural-bg flex flex-col items-center justify-center font-sans"
      onClick={handleInteraction}
    >
      {/* Procedural Background Orbs */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />

      <div className="relative z-10 flex flex-col items-center animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="flex flex-col items-center gap-6">
            {/* Procedural Logo: A Glowing 3D-like Ball */}
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#fbbf24] to-[#d97706] shadow-[0_0_50px_rgba(251,191,36,0.5)] flex items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-2 rounded-full border border-white/20" />
              <div className="absolute top-4 left-6 w-8 h-4 bg-white/40 blur-md rounded-full rotate-[-45deg]" />
              <Sword
                className="text-black/80 drop-shadow-md group-hover:scale-110 transition-transform"
                size={48}
              />
            </div>

            <h1 className="text-6xl font-black text-[#fbbf24] title-glow uppercase text-center max-w-2xl leading-tight">
              BALLS <span className="text-white">2.5D</span> RPG
            </h1>
          </div>

          <div className="text-lg font-black tracking-[0.3em] text-[#ffaa00] mt-6 bg-white/5 px-8 py-1 rounded-full border border-[#ffaa00]/20 shadow-xl backdrop-blur-xl">
            ALPHA 1
          </div>
        </div>

        {/* --- MAIN MENU --- */}
        {menu === "main" && (
          <div className="flex flex-col gap-4">
            <button onClick={() => setMenu("new")} className={btnStyle}>
              <Sword size={20} /> {t("menu_new_game")}
            </button>
            <button onClick={() => setMenu("load")} className={btnStyle}>
              <Scroll size={20} /> {t("menu_load_game")}
            </button>

            <button
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set("editor", "true");
                window.location.href = url.toString();
              }}
              className={`${btnStyle} border-blue-900 text-blue-400`}
            >
              <Droplets size={20} /> MAP EDITOR
            </button>

            <button
              onClick={() =>
                onStart({
                  isNewGame: true,
                  map: "debug_sandbox",
                  charName: "Debug",
                })
              }
              className={`${btnStyle} border-emerald-800 text-emerald-300`}
            >
              <Bot size={20} /> DEBUG SANDBOX
            </button>

            <button
              onClick={() =>
                onStart({
                  isNewGame: true,
                  map: "city_3d_multi",
                  benchmarkMode: true,
                  benchmarkName: "Smoke Test Benchmark",
                  charName: "Benchmark",
                  spawnInfo: { x: 96, y: 96, level: "0" },
                })
              }
              className={`${btnStyle} border-amber-700 text-amber-300`}
            >
              <Bot size={20} /> BENCHMARK
            </button>

            {/* Language Flag Toggle (Cute) */}
            <div className="flex gap-4 mt-8 justify-center">
              <button
                onClick={() => setLanguage("en")}
                className={`p-2 rounded-full border-2 transition-all ${language === "en" ? "border-[#fbbf24] scale-110 shadow-[0_0_10px_#fbbf24]" : "border-transparent opacity-50 grayscale hover:grayscale-0"}`}
              >
                <span className="text-2xl">🇺🇸</span>
              </button>
              <button
                onClick={() => setLanguage("pt")}
                className={`p-2 rounded-full border-2 transition-all ${language === "pt" ? "border-[#fbbf24] scale-110 shadow-[0_0_10px_#fbbf24]" : "border-transparent opacity-50 grayscale hover:grayscale-0"}`}
              >
                <span className="text-2xl">🇧🇷</span>
              </button>
            </div>
          </div>
        )}

        {/* --- NEW GAME --- */}
        {menu === "new" && (
          <div className="flex flex-col items-center bg-[#1a1a1a] p-8 rounded-xl border border-[#333] shadow-2xl">
            <h2 className="text-2xl text-white mb-6 font-bold">
              {t("menu_create_character")}
            </h2>
            <input
              placeholder={t("menu_enter_name")}
              className={inputStyle}
              value={charName}
              onChange={(e) => setCharName(e.target.value)}
              maxLength={12}
            />
            <button
              onClick={handleCreate}
              className={`${btnStyle} mb-4 bg-[#2a2a2a]`}
            >
              {t("menu_start")}
            </button>
            <button
              onClick={() => setMenu("main")}
              className="text-gray-500 hover:text-white underline text-sm mt-2"
            >
              {t("menu_back")}
            </button>
          </div>
        )}

        {/* --- LOAD GAME --- */}
        {menu === "load" && (
          <div className="flex flex-col items-center w-[90vw] max-w-2xl h-[70vh] bg-[#1a1a1a] p-6 rounded-xl border border-[#333] shadow-2xl relative">
            <h2 className="text-2xl text-white mb-6 font-bold">
              {t("menu_load_game")}
            </h2>

            <div className="w-full flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-2">
              {saves.length === 0 && (
                <div className="text-gray-500 text-center italic mt-10">
                  {t("menu_no_saves")}
                </div>
              )}

              {saves.map((save, i) => (
                <div
                  key={i}
                  className="bg-[#222] p-4 rounded border border-[#333] hover:border-[#555] flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#333] rounded-full flex items-center justify-center text-[#fbbf24]">
                      <User size={24} />
                    </div>
                    <div>
                      <div className="text-[#fbbf24] font-bold text-lg">
                        {save.playerState?.characterName || "Unknown"}{" "}
                        <span className="text-gray-400 text-sm ml-2">
                          (Lvl {save.playerState?.level || 1})
                        </span>
                      </div>
                      <div className="text-gray-500 text-xs">
                        {t("menu_play_time")}:{" "}
                        {Math.floor((save.playerState?.playTime || 0) / 3600)}h{" "}
                        {Math.floor(
                          ((save.playerState?.playTime || 0) % 3600) / 60,
                        )}
                        m • {new Date(save.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onStart(save)}
                      className="px-4 py-2 bg-[#fbbf24] text-black font-bold rounded hover:bg-[#fcd34d] text-sm"
                    >
                      Play
                    </button>
                    <button
                      onClick={() =>
                        handleDelete(save.playerState?.characterName)
                      }
                      className="p-2 text-red-500 hover:bg-red-900/20 rounded transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setMenu("main")}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              ✖ {t("menu_back")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
