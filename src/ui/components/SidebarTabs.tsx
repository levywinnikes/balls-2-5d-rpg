import React, { useState } from "react";
import { SystemLog } from "./SystemLog";
import { SidebarSkills } from "./SidebarSkills";
import { SidebarSpellbook } from "./SidebarSpellbook";
import { useLanguage } from "../../context/LanguageContext";
import { MessageSquare, Star, BookOpen } from "lucide-react";
import { useUI } from "../../context/UIContext";

export const SidebarTabs: React.FC = () => {
    const [activeTab, setActiveTab] = useState<"log" | "skills" | "spellbook">("log");
    const { t } = useLanguage();
    const { scale } = useUI();

    const TabButton: React.FC<{ 
        id: "log" | "skills" | "spellbook";
        icon: React.ReactNode; 
        label?: string 
    }> = ({ id, icon, label }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center p-1.5 gap-1 transition-colors border-b-2 text-[10px] uppercase font-bold ${
                activeTab === id 
                ? "border-yellow-500 bg-[#222] text-yellow-400" 
                : "border-transparent text-[#666] hover:bg-[#1a1a1a] hover:text-[#aaa]"
            }`}
            title={label}
        >
            {icon}
            {label && <span className="hidden sm:inline">{label}</span>} 
        </button>
    );

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-[#0a0a0a] border border-[#333] rounded">
            {/* Tabs Header */}
            <div className="flex border-b border-[#333]">
                <TabButton id="skills" icon={<Star size={16 * scale} />} />
                <TabButton id="spellbook" icon={<BookOpen size={16 * scale} />} />
                <TabButton id="log" icon={<MessageSquare size={16 * scale} />} />
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 relative">
                {activeTab === "log" && (
                    <div className="absolute inset-0 flex flex-col h-full">
                        <SystemLog /> 
                    </div>
                )}
                 {activeTab === "skills" && (
                    <div className="absolute inset-0">
                        <SidebarSkills />
                    </div>
                )}
                {activeTab === "spellbook" && (
                    <div className="absolute inset-0">
                        <SidebarSpellbook />
                    </div>
                )}
            </div>
        </div>
    );
};
