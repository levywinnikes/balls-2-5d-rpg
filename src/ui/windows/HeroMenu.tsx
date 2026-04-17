import React, { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { HeroOverview } from "../components/hero/HeroOverview";
import { HeroStatsTab } from "../components/hero/HeroStatsTab";
import { useRenderCount } from "../../hooks/useTraceUpdates";

export const HeroMenuContent: React.FC = () => {
    const { t } = useLanguage();

    // Track active tab
    const [activeTab, setActiveTab] = useState<"overview" | "stats">("overview");

    // Trace re-renders (Diagnostic)
    useRenderCount("HeroMenuContent");

    return (
        <div className="flex flex-col h-full gap-2 text-[var(--text-primary)] font-rpg">
            
            {/* TABS HEADER */}
            <div className="flex gap-2 border-b border-[var(--border-subtle)] padding-b-1 shrink-0">
                <button 
                    onClick={() => setActiveTab("overview")}
                    className={`px-3 py-1 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === "overview" ? "border-[var(--accent-gold)] text-[var(--accent-gold)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                >
                    {t("overview" as any)}
                </button>
                <button 
                    onClick={() => setActiveTab("stats")}
                    className={`px-3 py-1 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === "stats" ? "border-[var(--accent-gold)] text-[var(--accent-gold)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                >
                    {t("stats" as any)}
                </button>
            </div>

            {/* CONTENT AREA */}
            {activeTab === "overview" && <HeroOverview />}
            {activeTab === "stats" && <HeroStatsTab />}

        </div>
    );
};

