import React, { useEffect, useState } from "react";
import { DialogueManager, DialogueOption } from "../../game/systems/DialogueManager";
// Using a specific style for Dialogue

interface DialogueState {
  npcId: string;
  text: string;
  options: DialogueOption[];
}

export const DialogueWindow: React.FC = () => {
  const [dialogue, setDialogue] = useState<DialogueState | null>(null);

  useEffect(() => {
    const manager = DialogueManager.getInstance();

    const onUpdate = (data: DialogueState) => {
      setDialogue(data);
    };

    const onClose = () => {
      setDialogue(null);
    };

    manager.on("dialogue_update", onUpdate);
    manager.on("dialogue_close", onClose);

    return () => {
      manager.off("dialogue_update", onUpdate);
      manager.off("dialogue_close", onClose);
    };
  }, []);

  if (!dialogue) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "160px", // Above chat/hotbar
        left: "50%",
        transform: "translateX(-50%)",
        width: "600px",
        backgroundColor: "#2b2b2b",
        border: "2px solid #5a5a5a",
        padding: "10px",
        color: "#d4d4d4",
        fontFamily: "monospace",
        boxShadow: "0 0 10px rgba(0,0,0,0.8)",
        zIndex: 100,
      }}
    >
      <div style={{ marginBottom: "10px", fontWeight: "bold", color: "#dacFA1" }}>
        {/* Potentially map NPC ID to Name here or pass name in event */}
        NPC says:
      </div>
      <div style={{ marginBottom: "15px", lineHeight: "1.4" }}>
        {dialogue.text}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {dialogue.options.map((opt, index) => (
          <button
            key={index}
            onClick={() => DialogueManager.getInstance().selectOption(index)}
            style={{
              textAlign: "left",
              backgroundColor: "#3f3f3f",
              border: "1px solid #1a1a1a",
              padding: "5px 10px",
              color: "#a4d4a1",
              cursor: "pointer",
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#4f4f4f")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#3f3f3f")}
          >
            {index + 1}. {opt.text}
          </button>
        ))}
      </div>
    </div>
  );
};
