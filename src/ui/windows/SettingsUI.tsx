import React, { useState } from "react";
import { useUI } from "../../context/UIContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  Monitor,
  Plus,
  Minus,
  Settings as SettingsIcon,
  Flag,
  Droplets,
  Volume2,
  Music,
  Headphones,
} from "lucide-react";
import { AudioManager } from "../../game/systems/AudioManager";

export const SettingsContent: React.FC = () => {
  const {
    scale,
    setScale,
    s,
    debugCollision,
    toggleDebugCollision,
    bloodEnabled,
    toggleBlood,
    cloudShadowsEnabled,
    toggleCloudShadows,
    graphicsQuality,
    setGraphicsQuality,
    showFPS,
    toggleFPS,
  } = useUI();
  const { language, setLanguage, t } = useLanguage();

  // Audio specific states synchronized with AudioManager
  const am = AudioManager.getInstance();
  const [musicVol, setMusicVol] = useState(
    parseFloat(localStorage.getItem("tgs_audio_music_vol") || "1"),
  );
  const [sfxVol, setSfxVol] = useState(
    parseFloat(localStorage.getItem("tgs_audio_sfx_vol") || "1"),
  );
  const [musicOff, setMusicOff] = useState(
    localStorage.getItem("tgs_audio_music_off") === "true",
  );
  const [sfxOff, setSfxOff] = useState(
    localStorage.getItem("tgs_audio_sfx_off") === "true",
  );

  const handleMusicVol = (v: number) => {
    setMusicVol(v);
    am.setMusicVolume(v);
  };

  const handleSfxVol = (v: number) => {
    setSfxVol(v);
    am.setSfxVolume(v);
  };
  const handleMusicToggle = () => {
    const next = !musicOff;
    setMusicOff(next);
    am.setMusicEnabled(!next);
  };
  const handleSfxToggle = () => {
    const next = !sfxOff;
    setSfxOff(next);
    am.setSfxEnabled(!next);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: `${s(12)}px`,
        alignItems: "center",
        paddingTop: `${s(10)}px`,
        maxHeight: "100%",
        overflowY: "auto",
        paddingBottom: `${s(10)}px`,
      }}
    >
      {/* LANGUAGE SELECTION */}
      <div style={{ width: "90%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#ddd",
            fontWeight: "bold",
            fontSize: `${s(14)}px`,
            marginBottom: "8px",
          }}
        >
          <Flag size={14 * scale} /> {t("language")}
        </div>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button
            onClick={() => setLanguage("en")}
            style={{
              padding: `${s(4)}px`,
              background:
                language === "en" ? "rgba(251,191,36,0.2)" : "rgba(0,0,0,0.3)",
              border:
                language === "en" ? "2px solid #fbbf24" : "1px solid #444",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
            title={t("language_english")}
          >
            <img
              src="https://flagcdn.com/w80/us.png"
              alt={t("language_english")}
              style={{
                width: s(40),
                height: s(28),
                borderRadius: "4px",
                filter:
                  language === "en" ? "none" : "grayscale(100%) opacity(0.5)",
              }}
            />
          </button>
          <button
            onClick={() => setLanguage("pt")}
            style={{
              padding: `${s(4)}px`,
              background:
                language === "pt" ? "rgba(251,191,36,0.2)" : "rgba(0,0,0,0.3)",
              border:
                language === "pt" ? "2px solid #fbbf24" : "1px solid #444",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
            title={t("language_portuguese")}
          >
            <img
              src="https://flagcdn.com/w80/br.png"
              alt={t("language_portuguese")}
              style={{
                width: s(40),
                height: s(28),
                borderRadius: "4px",
                filter:
                  language === "pt" ? "none" : "grayscale(100%) opacity(0.5)",
              }}
            />
          </button>
        </div>
      </div>

      {/* --- AUDIO SETTINGS --- */}
      <div style={{ width: "90%", marginTop: `${s(4)}px` }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "8px",
            color: "#fbbf24",
            fontWeight: "bold",
            fontSize: `${s(14)}px`,
          }}
        >
          <Volume2 size={14 * scale} />
          <span>{t("audio_settings" as any)}</span>
        </div>

        {/* Music Group */}
        <div
          style={{
            background: "var(--bg-glass-heavy)",
            padding: `${s(8)}px`,
            borderRadius: "4px",
            border: "1px solid var(--border-subtle)",
            marginBottom: "4px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "6px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                color: "#ccc",
                fontSize: `${s(12)}px`,
              }}
            >
              <Music size={12 * scale} /> {t("music_playlist" as any)}
            </div>
            <button
              onClick={handleMusicToggle}
              style={{
                padding: `${s(4)}px ${s(8)}px`,
                borderRadius: "4px",
                fontSize: `${s(10)}px`,
                fontWeight: "bold",
                border: "1px solid",
                cursor: "pointer",
                background: !musicOff
                  ? "rgba(34,197,94,0.3)"
                  : "rgba(100,100,100,0.3)",
                borderColor: !musicOff ? "#22c55e" : "#666",
                color: !musicOff ? "#4ade80" : "#999",
              }}
            >
              {!musicOff ? t("activated" as any) : t("deactivated" as any)}
            </button>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={musicVol}
            onChange={(e) => handleMusicVol(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#fbbf24", cursor: "pointer" }}
            disabled={musicOff}
          />
        </div>

        {/* SFX Group */}
        <div
          style={{
            background: "var(--bg-glass-heavy)",
            padding: `${s(8)}px`,
            borderRadius: "4px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "6px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                color: "#ccc",
                fontSize: `${s(12)}px`,
              }}
            >
              <Headphones size={12 * scale} /> {t("sfx_effects" as any)}
            </div>
            <button
              onClick={handleSfxToggle}
              style={{
                padding: `${s(4)}px ${s(8)}px`,
                borderRadius: "4px",
                fontSize: `${s(10)}px`,
                fontWeight: "bold",
                border: "1px solid",
                cursor: "pointer",
                background: !sfxOff
                  ? "rgba(34,197,94,0.3)"
                  : "rgba(100,100,100,0.3)",
                borderColor: !sfxOff ? "#22c55e" : "#666",
                color: !sfxOff ? "#4ade80" : "#999",
              }}
            >
              {!sfxOff ? t("activated" as any) : t("deactivated" as any)}
            </button>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={sfxVol}
            onChange={(e) => handleSfxVol(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#fbbf24", cursor: "pointer" }}
            disabled={sfxOff}
          />
        </div>
      </div>

      {/* --- VISUAL EFFECTS --- */}
      <div style={{ width: "90%", marginTop: `${s(4)}px` }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "8px",
            color: "#fbbf24",
            fontWeight: "bold",
            fontSize: `${s(14)}px`,
          }}
        >
          <Droplets size={14 * scale} />
          <span>{t("visual_effects")}</span>
        </div>

        <div
          style={{
            background: "var(--bg-glass-heavy)",
            padding: `${s(8)}px`,
            borderRadius: "4px",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: "#ccc", fontSize: `${s(12)}px` }}>
            {t("blood_particles")}
          </span>
          <button
            onClick={toggleBlood}
            style={{
              padding: `${s(6)}px ${s(10)}px`,
              borderRadius: "4px",
              fontSize: `${s(10)}px`,
              fontWeight: "bold",
              border: "1px solid",
              transition: "all 0.2s",
              cursor: "pointer",
              background: bloodEnabled
                ? "rgba(153,27,27,0.5)"
                : "rgba(68,68,68,0.5)",
              borderColor: bloodEnabled ? "#dc2626" : "#6b7280",
              color: bloodEnabled ? "#fecaca" : "#9ca3af",
              boxShadow: bloodEnabled ? "0 0 10px rgba(220,38,38,0.5)" : "none",
            }}
          >
            {bloodEnabled ? t("enabled") : t("disabled")}
          </button>
        </div>

        <div
          style={{
            background: "rgba(0,0,0,0.4)",
            padding: `${s(8)}px`,
            borderRadius: "4px",
            border: "1px solid #333",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "4px",
          }}
        >
          <span style={{ color: "#ccc", fontSize: `${s(12)}px` }}>
            {t("quality")}
          </span>
          <div style={{ display: "flex", gap: "2px" }}>
            {(["low", "mid", "high"] as const).map((q) => (
              <button
                key={q}
                onClick={() => setGraphicsQuality(q)}
                style={{
                  padding: `${s(4)}px ${s(8)}px`,
                  borderRadius: "2px",
                  fontSize: `${s(10)}px`,
                  fontWeight: "bold",
                  border: "1px solid",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: graphicsQuality === q ? "#fbbf24" : "#222",
                  borderColor: graphicsQuality === q ? "#fbbf24" : "#444",
                  color: graphicsQuality === q ? "#000" : "#888",
                  textTransform: "uppercase",
                }}
              >
                {t(`quality_${q}` as any)}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            background: "rgba(0,0,0,0.4)",
            padding: `${s(8)}px`,
            borderRadius: "4px",
            border: "1px solid #333",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "4px",
          }}
        >
          <span style={{ color: "#ccc", fontSize: `${s(12)}px` }}>
            {t("show_fps")}
          </span>
          <button
            onClick={toggleFPS}
            style={{
              padding: `${s(6)}px ${s(10)}px`,
              borderRadius: "4px",
              fontSize: `${s(10)}px`,
              fontWeight: "bold",
              border: "1px solid",
              transition: "all 0.2s",
              cursor: "pointer",
              background: showFPS ? "rgba(0,255,0,0.2)" : "rgba(68,68,68,0.5)",
              borderColor: showFPS ? "#00ff00" : "#6b7280",
              color: showFPS ? "#4ade80" : "#9ca3af",
            }}
          >
            {showFPS ? t("on") : t("off")}
          </button>
        </div>

        <div
          style={{
            background: "var(--bg-glass-heavy)",
            padding: `${s(8)}px`,
            borderRadius: "4px",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "4px",
          }}
        >
          <span style={{ color: "#ccc", fontSize: `${s(12)}px` }}>
            {t("cloud_shadows")}
          </span>
          <button
            onClick={toggleCloudShadows}
            style={{
              padding: `${s(6)}px ${s(10)}px`,
              borderRadius: "4px",
              fontSize: `${s(10)}px`,
              fontWeight: "bold",
              border: "1px solid",
              transition: "all 0.2s",
              cursor: "pointer",
              background: cloudShadowsEnabled
                ? "rgba(251,191,36,0.3)"
                : "rgba(68,68,68,0.5)",
              borderColor: cloudShadowsEnabled ? "#fbbf24" : "#6b7280",
              color: cloudShadowsEnabled ? "#fbbf24" : "#9ca3af",
              boxShadow: cloudShadowsEnabled
                ? "0 0 10px rgba(251,191,36,0.3)"
                : "none",
            }}
          >
            {cloudShadowsEnabled ? t("enabled") : t("disabled")}
          </button>
        </div>
      </div>

      <hr style={{ width: "90%", borderColor: "#333" }} />

      {/* INTERFACE SCALE */}
      <div style={{ width: "90%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#ddd",
            fontWeight: "bold",
            fontSize: `${s(14)}px`,
            marginBottom: "8px",
          }}
        >
          <Monitor size={14 * scale} /> {t("interface_scale")}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#111",
            padding: `${s(4)}px`,
            borderRadius: "4px",
            border: "1px solid #333",
          }}
        >
          <button
            onClick={() => setScale(Math.max(0.5, scale - 0.1))} // Prevent too small
            style={{
              padding: `${s(4)}px ${s(8)}px`,
              background: "#333",
              border: "none",
              color: "white",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            <Minus size={14 * scale} />
          </button>

          <span
            style={{
              textAlign: "center",
              color: "#fbbf24",
              fontWeight: "bold",
              fontSize: `${s(14)}px`,
            }}
          >
            {(scale * 100).toFixed(0)}%
          </span>

          <button
            onClick={() => setScale(Math.min(2.0, scale + 0.1))} // Prevent too big
            style={{
              padding: `${s(4)}px ${s(8)}px`,
              background: "#333",
              border: "none",
              color: "white",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            <Plus size={14 * scale} />
          </button>
        </div>
        <p
          style={{
            fontSize: `${s(10)}px`,
            color: "#666",
            textAlign: "center",
            marginTop: "4px",
          }}
        >
          {t("adjust_ui")}
        </p>
      </div>

      <hr style={{ width: "100%", borderColor: "#333", margin: "5px 0" }} />

      {/* DEBUG TOOLS */}
      <div style={{ width: "90%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#fbbf24",
            fontWeight: "bold",
            fontSize: `${s(14)}px`,
            marginBottom: "8px",
          }}
        >
          <SettingsIcon size={14 * scale} /> {t("debug_tools" as any)}
        </div>

        <button
          onClick={toggleDebugCollision}
          style={{
            padding: `${s(10)}px`,
            width: "100%",
            background: debugCollision ? "#264" : "#444",
            border: debugCollision ? "1px solid #4a6" : "1px solid #666",
            color: "white",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: `${s(12)}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.2s",
          }}
        >
          <div
            style={{
              width: s(12),
              height: s(12),
              background: debugCollision ? "#0f0" : "#666",
              borderRadius: "50%",
              boxShadow: debugCollision ? "0 0 8px #0f0" : "none",
            }}
          />
          {t("visualize_collisions" as any)}:{" "}
          {debugCollision ? t("on") : t("off")}
        </button>
      </div>
    </div>
  );
};
