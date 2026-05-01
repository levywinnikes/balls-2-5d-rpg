import React, { useEffect, useState } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { RuneRegistry } from "../../game/magic/RuneRegistry";
import { t_game } from "../../game/i18n/translations";

export const GrimiorioContent: React.FC = () => {
  const [runes, setRunes] = useState<any[]>([]);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [memoryCapacity, setMemoryCapacity] = useState(0);

  useEffect(() => {
    const ps = PlayerState.getInstance();
    const update = () => {
      setRunes([...ps.getEnchantedRunes()]);
      setMemoryUsage(ps.getCurrentMemoryUsage());
      setMemoryCapacity(ps.getMemoryCapacity());
    };

    ps.on("runesUpdated", update);
    ps.on("statsChanged", update);

    const interval = setInterval(update, 1000);
    update();

    return () => {
      ps.off("runesUpdated", update);
      ps.off("statsChanged", update);
      clearInterval(interval);
    };
  }, []);

  const handleCastRune = (runeId: string) => {
    const ps = PlayerState.getInstance();
    // Check if overloaded
    if (memoryUsage > memoryCapacity) {
      ps.emit("message", t_game("msg_rune_memory_overloaded"));
      return;
    }
    // Emit prepareRuneCast to enter targeting mode
    ps.emit("prepareRuneCast", runeId);
  };

  return (
    <div style={{ padding: 16, minWidth: 300 }}>
      {/* Memory Usage Bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, marginBottom: 4, color: "#aaa" }}>
          {t_game("label_memory")}: {memoryUsage}/{memoryCapacity}
        </div>
        <div
          style={{
            width: "100%",
            height: 8,
            background: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${memoryCapacity > 0 ? (memoryUsage / memoryCapacity) * 100 : 0}%`,
              height: "100%",
              background: memoryUsage > memoryCapacity ? "#ff4444" : "#4466ff",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Rune List */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 8,
        }}
      >
        {runes.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              color: "#666",
              fontSize: 12,
            }}
          >
            {t_game("msg_no_runes")}
          </div>
        ) : (
          runes.map((runeEntry) => {
            const runeDef = RuneRegistry.getRune(runeEntry.runeId);
            if (!runeDef) return null;

            const isOverloaded = memoryUsage > memoryCapacity;

            return (
              <button
                key={runeEntry.runeId}
                onClick={() => handleCastRune(runeEntry.runeId)}
                disabled={isOverloaded}
                style={{
                  padding: 12,
                  background: "rgba(26, 26, 26, 0.9)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 6,
                  cursor: isOverloaded ? "not-allowed" : "pointer",
                  color: isOverloaded ? "#666" : "#fff",
                  fontSize: 12,
                  opacity: isOverloaded ? 0.5 : 1,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isOverloaded) {
                    (e.currentTarget as any).style.background =
                      "rgba(68, 102, 255, 0.2)";
                    (e.currentTarget as any).style.borderColor =
                      "rgba(68, 102, 255, 0.5)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as any).style.background =
                    "rgba(26, 26, 26, 0.9)";
                  (e.currentTarget as any).style.borderColor =
                    "rgba(255, 255, 255, 0.1)";
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {runeDef.name}
                </div>
                <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6 }}>
                  {t_game("label_memory")}: {runeDef.memoryCost} x{" "}
                  {runeEntry.count}
                </div>
                <div style={{ fontSize: 10, color: "#ff8844" }}>
                  {runeDef.damage?.element} {runeDef.damage?.baseMin}-
                  {runeDef.damage?.baseMax}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
