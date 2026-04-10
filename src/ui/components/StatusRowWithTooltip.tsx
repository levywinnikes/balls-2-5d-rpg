import React from "react";
import { useUI } from "../../context/UIContext";
import { useLanguage } from "../../context/LanguageContext";

interface StatusRowProps {
    label: string;
    value: React.ReactNode;
    icon?: React.ReactNode;
    color?: string;
    type?: "skill" | "stat" | "resource";
    progress?: number;
    customTooltip?: {
        text: string;
        subtext?: React.ReactNode;
        x?: number;
        y?: number;
    };
}

export const StatusRowWithTooltip = React.memo(({ label, value, icon, color, type, progress, customTooltip }: StatusRowProps) => {
    const { showTooltip, hideTooltip } = useUI();
    const { t } = useLanguage();

    let pct = 0;
    if (progress !== undefined) pct = progress;
    pct = Math.max(0, Math.min(100, pct));
    const hasBar = progress !== undefined;

    return (
        <div 
            className="relative flex flex-col justify-center text-xs mb-1 px-2 py-1 rounded border border-[var(--border-subtle)] bg-black/20 cursor-help transition-all hover:bg-[var(--bg-glass-hover)] hover:border-[var(--border-highlight)] overflow-hidden group"
            style={{ minHeight: "26px" }}
            onMouseEnter={(e) => {
                 if (customTooltip) {
                     showTooltip({ ...customTooltip, x: e.clientX, y: e.clientY });
                 } else if(type === "skill" && progress !== undefined) {
                     const str = t("tooltip_next_level").replace("{value}", Math.floor(pct).toString());
                     showTooltip({ text: label, subtext: str, x: e.clientX, y: e.clientY });
                 } else if (type === "skill") {
                     showTooltip({ text: label, subtext: `Value: ${value}`, x: e.clientX, y: e.clientY });
                 }
            }}
            onMouseLeave={hideTooltip}
        >
            <div className="flex justify-between items-center z-10 relative">
                <div className="flex items-center gap-2 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                    {icon}
                    <span className="font-medium">{label}</span>
                </div>
                <span style={{ color, fontWeight: "bold", textShadow: "0 0 5px rgba(0,0,0,0.5)" }}>{value}</span>
            </div>
            {hasBar && (
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-black/50">
                    <div 
                        className="h-full transition-all duration-500 ease-out shadow-[0_0_5px_currentColor]"
                        style={{ 
                            width: `${pct}%`,
                            backgroundColor: color,
                            color: color // for currentColor shadow
                        }} 
                    />
                </div>
            )}
        </div>
    );
});
