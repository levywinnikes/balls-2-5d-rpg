import React, { useEffect, useState } from "react";
import { useUI } from "../../context/UIContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  Monitor,
  Volume2,
  Music,
  Headphones,
  Gauge,
  Gamepad2,
  Flag,
  Wrench,
  Eye,
  EyeOff,
  Activity,
  Sparkles,
  Droplets,
} from "lucide-react";
import { AudioManager } from "../../game/systems/AudioManager";
import { PlayerState } from "../../game/entities/Player/PlayerState";

// ──────────────────────────────────────────────────────────────────────────────
// Reusable presentational primitives
// ──────────────────────────────────────────────────────────────────────────────

const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <div style={{ width: "100%", marginBottom: 14 }}>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: "#fbbf24",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        marginBottom: 8,
      }}
    >
      {icon}
      <span>{title}</span>
    </div>
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        background: "rgba(0,0,0,0.30)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
        padding: 10,
        backdropFilter: "blur(6px)",
      }}
    >
      {children}
    </div>
  </div>
);

const Row: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 4,
      padding: "6px 4px",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <span style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 500 }}>
        {label}
      </span>
      <div>{children}</div>
    </div>
    {hint && (
      <span style={{ color: "#9ca3af", fontSize: 10, lineHeight: 1.3 }}>
        {hint}
      </span>
    )}
  </div>
);

const Toggle: React.FC<{
  on: boolean;
  onText: string;
  offText: string;
  onClick: () => void;
}> = ({ on, onText, offText, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: "5px 12px",
      borderRadius: 6,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 0.4,
      border: "1px solid",
      cursor: "pointer",
      transition: "all 0.18s",
      background: on ? "rgba(34,197,94,0.22)" : "rgba(80,80,80,0.30)",
      borderColor: on ? "#22c55e" : "#525252",
      color: on ? "#86efac" : "#a3a3a3",
      minWidth: 88,
    }}
  >
    {on ? onText : offText}
  </button>
);

const SegmentedControl: <T extends string | number>(props: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) => React.ReactElement = ({ options, value, onChange }) => (
  <div
    style={{
      display: "flex",
      gap: 2,
      background: "rgba(0,0,0,0.4)",
      borderRadius: 6,
      padding: 2,
      border: "1px solid rgba(255,255,255,0.08)",
    }}
  >
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          style={{
            padding: "5px 10px",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            background: active ? "#fbbf24" : "transparent",
            color: active ? "#111" : "#9ca3af",
            transition: "all 0.18s",
            minWidth: 42,
          }}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

const Slider: React.FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
  disabled?: boolean;
}> = ({ value, min, max, step, onChange, display, disabled }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <span
        style={{
          color: disabled ? "#6b7280" : "#fbbf24",
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "monospace",
        }}
      >
        {display}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      disabled={disabled}
      style={{
        width: "100%",
        accentColor: "#fbbf24",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    />
  </div>
);

// ──────────────────────────────────────────────────────────────────────────────
// SettingsContent — main window
// ──────────────────────────────────────────────────────────────────────────────

export const SettingsContent: React.FC = () => {
  const {
    debugCollision,
    toggleDebugCollision,
    bloodEnabled,
    toggleBlood,
    showFPS,
    toggleFPS,
  } = useUI();
  const { language, setLanguage, t } = useLanguage();

  const am = AudioManager.getInstance();
  const ps = PlayerState.getInstance();

  // Audio state mirrors AudioManager + localStorage
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

  // Display state mirrors PlayerState
  const [display, setDisplay] = useState(ps.getDisplaySettings());
  useEffect(() => {
    const handler = (next: ReturnType<typeof ps.getDisplaySettings>) =>
      setDisplay(next);
    ps.on("displaySettingsChanged", handler);
    return () => {
      ps.off("displaySettingsChanged", handler);
    };
  }, [ps]);

  // ── Audio handlers ────────────────────────────────────────────────────────
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

  // ── Display handlers ──────────────────────────────────────────────────────
  const handleRenderScale = (v: number) => ps.setRenderScale(v);
  const handleQualityPreset = (q: "low" | "mid" | "high") =>
    ps.setQualityPreset(q);
  const handleFpsTarget = (n: 0 | 30 | 60 | 120) => ps.setFpsTarget(n);
  const handleAntialias = () => ps.setAntialiasEnabled(!display.antialias);

  const handleOpenPerspectiveDebugMap = () => {
    ps.requestPerspectiveDebugMap("perspective_debug");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "8px 14px 14px 14px",
        maxHeight: "100%",
        overflowY: "auto",
        color: "#e5e7eb",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* ── DISPLAY ── */}
      <Section title={t("display_settings" as any)} icon={<Monitor size={14} />}>
        <Row
          label={t("render_scale" as any)}
          hint={t("render_scale_desc" as any)}
        >
          <span />
        </Row>
        <Slider
          value={display.renderScale}
          min={0.5}
          max={1.0}
          step={0.05}
          onChange={handleRenderScale}
          display={`${Math.round(display.renderScale * 100)}%`}
        />

        <Row label={t("quality_preset" as any)}>
          <SegmentedControl<"low" | "mid" | "high">
            options={[
              { value: "low", label: t("quality_low") },
              { value: "mid", label: t("quality_mid") },
              { value: "high", label: t("quality_high") },
            ]}
            value={display.qualityPreset}
            onChange={handleQualityPreset}
          />
        </Row>

        <Row label={t("fps_target" as any)}>
          <SegmentedControl<0 | 30 | 60 | 120>
            options={[
              { value: 30, label: "30" },
              { value: 60, label: "60" },
              { value: 120, label: "120" },
              { value: 0, label: t("fps_unlimited" as any) },
            ]}
            value={display.fpsTarget}
            onChange={handleFpsTarget}
          />
        </Row>

        <Row
          label={t("antialiasing" as any)}
          hint={t("aa_restart_hint" as any)}
        >
          <Toggle
            on={display.antialias}
            onText={t("on")}
            offText={t("off")}
            onClick={handleAntialias}
          />
        </Row>

        <Row label={t("show_fps")}>
          <Toggle
            on={showFPS}
            onText={t("on")}
            offText={t("off")}
            onClick={toggleFPS}
          />
        </Row>
      </Section>

      {/* ── AUDIO ── */}
      <Section title={t("audio_settings" as any)} icon={<Volume2 size={14} />}>
        <Row
          label={t("music_playlist" as any)}
        >
          <Toggle
            on={!musicOff}
            onText={t("activated" as any)}
            offText={t("deactivated" as any)}
            onClick={handleMusicToggle}
          />
        </Row>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Music size={12} color="#9ca3af" />
          <div style={{ flex: 1 }}>
            <Slider
              value={musicVol}
              min={0}
              max={1}
              step={0.05}
              onChange={handleMusicVol}
              display={`${Math.round(musicVol * 100)}%`}
              disabled={musicOff}
            />
          </div>
        </div>

        <Row label={t("sfx_effects" as any)}>
          <Toggle
            on={!sfxOff}
            onText={t("activated" as any)}
            offText={t("deactivated" as any)}
            onClick={handleSfxToggle}
          />
        </Row>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Headphones size={12} color="#9ca3af" />
          <div style={{ flex: 1 }}>
            <Slider
              value={sfxVol}
              min={0}
              max={1}
              step={0.05}
              onChange={handleSfxVol}
              display={`${Math.round(sfxVol * 100)}%`}
              disabled={sfxOff}
            />
          </div>
        </div>
      </Section>

      {/* ── GAMEPLAY ── */}
      <Section
        title={t("gameplay_settings" as any)}
        icon={<Gamepad2 size={14} />}
      >
        <Row label={t("blood_particles")}>
          <Toggle
            on={bloodEnabled}
            onText={t("enabled")}
            offText={t("disabled")}
            onClick={toggleBlood}
          />
        </Row>
      </Section>

      {/* ── LANGUAGE ── */}
      <Section title={t("language")} icon={<Flag size={14} />}>
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            padding: "4px 0",
          }}
        >
          <button
            onClick={() => setLanguage("en")}
            style={{
              padding: 4,
              background:
                language === "en" ? "rgba(251,191,36,0.18)" : "transparent",
              border:
                language === "en"
                  ? "2px solid #fbbf24"
                  : "2px solid transparent",
              borderRadius: 8,
              cursor: "pointer",
              transition: "all 0.18s",
            }}
            title={t("language_english")}
          >
            <img
              src="https://flagcdn.com/w80/us.png"
              alt={t("language_english")}
              style={{
                width: 36,
                height: 26,
                borderRadius: 3,
                filter:
                  language === "en" ? "none" : "grayscale(100%) opacity(0.5)",
              }}
            />
          </button>
          <button
            onClick={() => setLanguage("pt")}
            style={{
              padding: 4,
              background:
                language === "pt" ? "rgba(251,191,36,0.18)" : "transparent",
              border:
                language === "pt"
                  ? "2px solid #fbbf24"
                  : "2px solid transparent",
              borderRadius: 8,
              cursor: "pointer",
              transition: "all 0.18s",
            }}
            title={t("language_portuguese")}
          >
            <img
              src="https://flagcdn.com/w80/br.png"
              alt={t("language_portuguese")}
              style={{
                width: 36,
                height: 26,
                borderRadius: 3,
                filter:
                  language === "pt" ? "none" : "grayscale(100%) opacity(0.5)",
              }}
            />
          </button>
        </div>
      </Section>

      {/* ── DEBUG / DEVELOPER ── */}
      <Section title={t("debug_section" as any)} icon={<Wrench size={14} />}>
        <Row label={t("visualize_collisions" as any)}>
          <Toggle
            on={debugCollision}
            onText={t("on")}
            offText={t("off")}
            onClick={toggleDebugCollision}
          />
        </Row>
        <button
          onClick={handleOpenPerspectiveDebugMap}
          style={{
            padding: 9,
            width: "100%",
            background: "linear-gradient(180deg, #3b2f14 0%, #2a210d 100%)",
            border: "1px solid #c8a24a",
            color: "#f6d77b",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: 0.3,
            marginTop: 6,
            transition: "all 0.18s",
          }}
        >
          {t("open_perspective_debug_map" as any)}
        </button>
      </Section>

      {/* ── Hidden / unused icon imports referenced via lucide tree-shaking ── */}
      <span
        style={{ display: "none" }}
        aria-hidden
      >
        <Gauge size={1} />
        <Eye size={1} />
        <EyeOff size={1} />
        <Activity size={1} />
        <Sparkles size={1} />
        <Droplets size={1} />
      </span>
    </div>
  );
};
