import React, { useState, useEffect, useCallback } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { XPTable } from "../../game/data/XPTable";
import { Coins, TrendingUp, Swords, Sparkles } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────
const CheatButton: React.FC<{
  label: string;
  onClick: () => void;
  color?: string;
  glow?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}> = ({ label, onClick, color = "#fbbf24", glow, disabled, icon }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: "6px 14px",
      background: disabled
        ? "#333"
        : `linear-gradient(135deg, ${color}33, ${color}11)`,
      border: `1px solid ${disabled ? "#555" : color}`,
      color: disabled ? "#666" : color,
      borderRadius: "6px",
      cursor: disabled ? "default" : "pointer",
      fontWeight: "bold",
      fontSize: "12px",
      transition: "all 0.2s",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      boxShadow: !disabled && glow ? `0 0 12px ${glow}` : "none",
    }}
  >
    {icon}
    {label}
  </button>
);

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  color: string;
}> = ({ icon, title, color }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      color,
      fontWeight: "bold",
      fontSize: "13px",
      marginBottom: "8px",
      paddingBottom: "4px",
      borderBottom: `1px solid ${color}33`,
    }}
  >
    {icon}
    {title}
  </div>
);

const StatCheatRow: React.FC<{
  label: string;
  value: number;
  onAdd: (amount: number) => void;
  color: string;
}> = ({ label, value, onAdd, color }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "6px 8px",
      background: "rgba(0,0,0,0.3)",
      borderRadius: "4px",
      borderLeft: `3px solid ${color}`,
    }}
  >
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ color: "#ccc", fontSize: "11px", fontWeight: "bold" }}>
        {label}
      </span>
      <span style={{ color, fontSize: "14px", fontWeight: "bold" }}>
        {value}
      </span>
    </div>
    <div style={{ display: "flex", gap: "4px" }}>
      {[1, 5, 10, 100].map((amt) => (
        <button
          key={amt}
          onClick={() => onAdd(amt)}
          style={{
            padding: "2px 6px",
            minWidth: "32px",
            background: "#222",
            border: `1px solid ${color}44`,
            color: color,
            borderRadius: "3px",
            cursor: "pointer",
            fontSize: "10px",
            fontWeight: "bold",
            transition: "all 0.1s",
          }}
          title={`+${amt} ${label}`}
        >
          +{amt}
        </button>
      ))}
    </div>
  </div>
);

// ─── Main Component ──────────────────────────────────────
export const CheatsContent: React.FC = () => {
  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate((n) => n + 1), []);

  useEffect(() => {
    const ps = PlayerState.getInstance();
    const events = [
      "balanceChanged",
      "levelUp",
      "experienceChanged",
      "inventoryUpdated",
      "equipmentChanged",
    ];
    events.forEach((e) => ps.on(e, refresh));
    return () => {
      events.forEach((e) => ps.off(e, refresh));
    };
  }, [refresh]);

  const ps = PlayerState.getInstance();

  // ─── Money ───
  const handleAddMoney = () => {
    ps.addBalance(10000);
    refresh();
  };

  // ─── Level ───
  const handleLevelUp = (levels: number) => {
    const currentLevel = ps.getLevel();
    const targetLevel = Math.min(currentLevel + levels, 1000); // Increased cap for fun
    const targetXP = XPTable.getXPRequiredForLevel(targetLevel);
    const currentXP = ps.getExperience();
    if (targetXP > currentXP) {
      ps.gainExperience(targetXP - currentXP);
    }
    refresh();
  };

  // ─── Attributes ───
  const str = ps.getBaseStrengthLevel();
  const dex = ps.getBaseDexterityLevel();
  const ref = ps.getBaseReflexLevel();
  const int = ps.getBaseIntelligenceLevel();

  const handleAddAttr = (
    attr: "str" | "dex" | "ref" | "int",
    amount: number,
  ) => {
    switch (attr) {
      case "str":
        ps.setStrengthLevel(str + amount);
        break;
      case "dex":
        ps.setDexterityLevel(dex + amount);
        break;
      case "ref":
        ps.setReflexLevel(ref + amount);
        break;
      case "int":
        ps.setIntelligenceLevel(int + amount);
        break;
    }
    ps.recalculateMaxHealth();
    ps.emit("equipmentChanged");
    ps.emit("inventoryUpdated");
    refresh();
  };

  // ─── Rune ───
  const handleAddRune = (amount: number) => {
    ps.addItem("magic_rune", amount);
    refresh();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "10px",
        maxHeight: "100%",
        overflowY: "auto",
      }}
    >
      {/* ─── DANGER BANNER ─── */}
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))",
          border: "1px solid rgba(239,68,68,0.4)",
          borderRadius: "6px",
          padding: "6px 10px",
          textAlign: "center",
          fontSize: "10px",
          color: "#fca5a5",
          fontWeight: "bold",
          letterSpacing: "0.5px",
          textTransform: "uppercase",
        }}
      >
        ⚠ MODO CHEATS ATIVO ⚠
      </div>

      {/* ─── MONEY ─── */}
      <div
        style={{
          background: "rgba(0,0,0,0.3)",
          padding: "10px",
          borderRadius: "6px",
          border: "1px solid #333",
        }}
      >
        <SectionHeader
          icon={<Coins size={14} />}
          title="Dinheiro"
          color="#fbbf24"
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{ color: "#fbbf24", fontSize: "16px", fontWeight: "bold" }}
          >
            {ps.getBalance().toLocaleString()} GC
          </span>
          <CheatButton
            label="+10.000 GC"
            onClick={handleAddMoney}
            color="#fbbf24"
            glow="rgba(251,191,36,0.3)"
            icon={<Coins size={14} />}
          />
        </div>
      </div>

      {/* ─── LEVEL ─── */}
      <div
        style={{
          background: "rgba(0,0,0,0.3)",
          padding: "10px",
          borderRadius: "6px",
          border: "1px solid #333",
        }}
      >
        <SectionHeader
          icon={<TrendingUp size={14} />}
          title={`Level — Atual: ${ps.getLevel()}`}
          color="#60a5fa"
        />
        <div
          style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <CheatButton
            label="+1"
            onClick={() => handleLevelUp(1)}
            color="#60a5fa"
            glow="rgba(96,165,250,0.2)"
          />
          <CheatButton
            label="+10"
            onClick={() => handleLevelUp(10)}
            color="#818cf8"
            glow="rgba(129,140,248,0.2)"
          />
          <CheatButton
            label="+100"
            onClick={() => handleLevelUp(100)}
            color="#c084fc"
            glow="rgba(192,132,252,0.2)"
          />
        </div>
      </div>

      {/* ─── ATTRIBUTES ─── */}
      <div
        style={{
          background: "rgba(0,0,0,0.3)",
          padding: "10px",
          borderRadius: "6px",
          border: "1px solid #333",
        }}
      >
        <SectionHeader
          icon={<Swords size={14} />}
          title="Atributos (Sem Limites)"
          color="#f97316"
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <StatCheatRow
            label="Força"
            value={str}
            onAdd={(amt) => handleAddAttr("str", amt)}
            color="#ef4444"
          />
          <StatCheatRow
            label="Destreza"
            value={dex}
            onAdd={(amt) => handleAddAttr("dex", amt)}
            color="#22c55e"
          />
          <StatCheatRow
            label="Reflexo"
            value={ref}
            onAdd={(amt) => handleAddAttr("ref", amt)}
            color="#3b82f6"
          />
          <StatCheatRow
            label="Inteligência"
            value={int}
            onAdd={(amt) => handleAddAttr("int", amt)}
            color="#a855f7"
          />
        </div>
      </div>

      {/* ─── MAGIC RUNE ─── */}
      <div
        style={{
          background: "rgba(0,0,0,0.3)",
          padding: "10px",
          borderRadius: "6px",
          border: "1px solid #333",
        }}
      >
        <SectionHeader
          icon={<Sparkles size={14} />}
          title="Runa Mágica"
          color="#d8b4fe"
        />
        <div
          style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <CheatButton
            label="+1"
            onClick={() => handleAddRune(1)}
            color="#d8b4fe"
            glow="rgba(216,180,254,0.3)"
            icon={<Sparkles size={14} />}
          />
          <CheatButton
            label="+10"
            onClick={() => handleAddRune(10)}
            color="#c084fc"
            glow="rgba(192,132,252,0.3)"
            icon={<Sparkles size={14} />}
          />
          <CheatButton
            label="+100"
            onClick={() => handleAddRune(100)}
            color="#a855f7"
            glow="rgba(168,85,247,0.3)"
            icon={<Sparkles size={14} />}
          />
        </div>
      </div>
    </div>
  );
};
