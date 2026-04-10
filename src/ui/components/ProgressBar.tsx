import React from "react";

interface ProgressBarProps {
    value: number;
    max?: number;
    color?: string; // Hex or Tailwind class (if using 'bg-' prefix)
    className?: string;
    height?: string; // Tailwind class like h-2, h-4
    showLabel?: boolean;
    label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
    value, 
    max = 100, 
    color = "#22c55e", 
    className = "", 
    height = "h-2",
    showLabel = false,
    label
}) => {
    const percent = Math.min(100, Math.max(0, (value / max) * 100));
    
    // Determine if color is a hex code or a class
    const isHex = color.startsWith("#") || color.startsWith("rgb");
    const barStyle = isHex ? { backgroundColor: color, width: `${percent}%` } : { width: `${percent}%` };
    const barClass = isHex ? "" : color;

    return (
        <div className={`w-full ${className}`}>
            {(showLabel || label) && (
                <div className="flex justify-between text-[10px] uppercase font-bold text-white/50 mb-1 tracking-wider">
                    <span>{label}</span>
                    <span>{Math.floor(value)} / {max}</span>
                </div>
            )}
            <div className={`w-full ${height} bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-inner`}>
                <div 
                    className={`h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end ${barClass}`}
                    style={barStyle}
                >
                    {/* Glossy effect */}
                    <div className="w-full h-[1px] bg-white/20 absolute top-0" />
                </div>
            </div>
        </div>
    );
};
