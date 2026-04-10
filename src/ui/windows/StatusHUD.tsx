import React from "react";
import { GameWindow } from "../components/GameWindow";
import { usePlayerState } from "../../hooks/usePlayerState";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { useUI } from "../../context/UIContext";
import { XPTable } from "../../game/data/XPTable";

// Componente de Barra Simples
const SimpleBar: React.FC<{
  current: number;
  max: number;
  color: string;
  label?: string;
  percent?: number;
}> = ({ current, max, color, label, percent }) => {
  const { s } = useUI();
  // Se "percent" for fornecido, usa ele. Se não, calcula baseado em current/max.
  const finalPercent =
    percent !== undefined
      ? percent
      : Math.min(100, Math.max(0, (current / max) * 100));

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: `${s(14)}px`,
        backgroundColor: "#111",
        border: "1px solid #333",
        borderRadius: "2px",
        marginBottom: "2px",
      }}
    >
      <div
        style={{
          width: `${finalPercent}%`,
          height: "100%",
          backgroundColor: color,
          transition: "width 0.2s",
        }}
      />
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: `${s(9)}px`,
          fontWeight: "bold",
          textShadow: "1px 1px 0 #000",
          color: "#fff",
        }}
      >
        {label ? `${label} ` : ""}
        {Math.floor(current)}
        {max > 100 ? ` / ${max}` : ""}
      </span>
    </div>
  );
};

export const StatusHUD: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const playerState = PlayerState.getInstance();

  // Hooks de dados
  const hp = usePlayerState(
    "healthChanged",
    () => playerState.getHealth(),
    100
  );
  const maxHp = usePlayerState(
    "maxHealthChanged",
    () => playerState.getMaxHealth(),
    100
  );
  const exp = usePlayerState(
    "experienceChanged",
    () => playerState.getExperience(),
    0
  );
  const level = usePlayerState("levelUp", () => playerState.getLevel(), 1);
  const balance = usePlayerState("balanceChanged", () => playerState.getBalance(), 0);

  // Mana Mockada (enquanto não tem no backend)
  const mana = 50;
  const maxMana = 100;

  // --- CORREÇÃO AQUI ---
  // Em vez de calcular na mão, usamos o .progress que vem da tabela
  // getLevelInfo retorna { level: number, progress: number (0 a 1) }
  const xpInfo = XPTable.getLevelInfo(exp);
  const xpPercent = xpInfo.progress * 100;
  
  const { windowPositions, updateWindowPosition, s } = useUI();

  return (
    <GameWindow
      title={`Level ${level}`}
      isOpen={isOpen}
      onClose={onClose}
      defaultSize={{ width: 180, height: 110 }} // Bem compacto
      defaultPosition={{ x: 20, y: 20 }}
      position={windowPositions.statusHud}
      onMove={(x, y) => updateWindowPosition("statusHud", x, y)}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          paddingTop: "4px",
        }}
      >
        <SimpleBar current={hp} max={maxHp} color="#d32f2f" label="HP" />
        <SimpleBar current={mana} max={maxMana} color="#1976d2" label="MP" />
        {/* Passamos o percentual calculado direto da tabela */}
        <SimpleBar
          current={exp}
          max={0}
          percent={xpPercent}
          color="#fbc02d"
          label="XP"
        />
        
        {/* GC Display */}
        <div style={{
            display: "flex", 
            alignItems: "center", 
            justifyContent: "flex-end",
            marginTop: "2px",
            color: "#ffd700",
            fontSize: `${s(10)}px`,
            fontWeight: "bold",
            textShadow: "1px 1px 0 #000"
        }}>
            <span>💰 {balance} GC</span>
        </div>
      </div>
    </GameWindow>
  );
};
