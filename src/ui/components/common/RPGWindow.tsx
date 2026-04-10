import React from "react";
import { X } from "lucide-react";

interface RPGWindowProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string | number;
  height?: string | number;
  className?: string; // Additional classes
  
  // Drag Props (Passed from parent using React-Rnd or similar usually, 
  // but if this component wraps content inside GameWindow, it mainly handles styling inner content).
  // Wait, GameWindow usually handles the RND part. 
  // If we refuse to replace GameWindow completely, we can use this as a wrapper for the "Content" of a window.
  // OR this replaces the "Look" of GameWindow.
}

/**
 * A stylized container for window content.
 * Intended to be used INSIDE the draggable <GameWindow> or as a replacement for its inner styling.
 */
export const RPGWindow: React.FC<RPGWindowProps> = ({ 
    title, 
    children, 
    onClose, 
    className = "" 
}) => {
  return (
    <div className={`flex flex-col h-full w-full overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-glass)] shadow-[var(--shadow-depth)] backdrop-blur-md ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] bg-black/20 handle cursor-grab active:cursor-grabbing">
            <span className="font-bold text-[var(--text-primary)] text-sm tracking-wide uppercase flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-gold)] shadow-[var(--accent-glow)]"></span>
                {title}
            </span>
            <button 
                onClick={onClose}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 rounded hover:bg-white/5"
            >
                <X size={14} />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative p-1">
            {children}
        </div>
    </div>
  );
};
