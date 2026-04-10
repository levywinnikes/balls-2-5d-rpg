
import React, { useEffect, useRef } from "react";
import { useUI } from "../../context/UIContext";

export interface ContextMenuOption {
  label: string;
  action: string;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  options: ContextMenuOption[];
  onSelect: (action: string) => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options, onSelect, onClose }) => {
  const { s } = useUI();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: y,
        left: x,
        backgroundColor: "#2d2d2d",
        border: "1px solid #444",
        borderRadius: "4px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.5)",
        zIndex: 9999,
        minWidth: `${s(120)}px`,
        padding: "4px 0"
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {options.map((opt, idx) => (
        <div
          key={idx}
          onClick={() => {
            if (!opt.disabled) {
              onSelect(opt.action);
              onClose();
            }
          }}
          style={{
            padding: `${s(6)}px ${s(12)}px`,
            fontSize: `${s(12)}px`,
            color: opt.disabled ? "#666" : "#eee",
            cursor: opt.disabled ? "default" : "pointer",
            backgroundColor: "transparent",
            transition: "background 0.1s"
          }}
          className="hover:bg-[#444]"
          onMouseEnter={(e) => {
              if(!opt.disabled) e.currentTarget.style.backgroundColor = "#444";
          }}
          onMouseLeave={(e) => {
              if(!opt.disabled) e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {opt.label}
        </div>
      ))}
    </div>
  );
};
