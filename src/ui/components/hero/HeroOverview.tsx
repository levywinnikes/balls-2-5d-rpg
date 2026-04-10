import React from "react";
import { useUI } from "../../../context/UIContext";
import { useLanguage } from "../../../context/LanguageContext";
import { EquipmentWidget } from "../../components/EquipmentWidget";
import { HeroInventory } from "./HeroInventory";
import { usePlayerState } from "../../../hooks/usePlayerState";
import { PlayerState } from "../../../game/entities/Player/PlayerState";
import { 
    LevelRow, HealthRow, CapRow, AttackRow, DefenseRow, ArmorRow, SpeedRow 
} from "./HeroStatsRows";
import { 
    StrengthRow, DexterityRow, IntelligenceRow, ReflexRow, HungerRow, WillpowerRow 
} from "./HeroSkillRows";

export const HeroOverview: React.FC = () => {
    const { s } = useUI();
    const { t } = useLanguage();
    const ps = PlayerState.getInstance();

    // Lifting State for Inventory
    const items = usePlayerState("inventoryUpdated", () => ps.getInventoryItems(), []);
    const balance = usePlayerState("balanceChanged", () => ps.getBalance(), 0);

    return (
        <div className="flex-1 overflow-hidden p-1 h-full" style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "8px" }}>
            
            {/* LEFT COLUMN: Attributes & Equipment (Fixed Width) */}
            <div className="flex flex-col gap-2 h-full overflow-y-auto custom-scrollbar bg-[var(--bg-glass)] rounded border border-[var(--border-subtle)] p-2">
                 
                 {/* Paperdoll Top */}
                 <div className="flex flex-col items-center justify-center border-b border-[var(--border-subtle)] pb-2 mb-2">
                        <div className="text-[var(--accent-gold)] font-bold text-center mb-2 text-sm uppercase tracking-wider">{t("equipment")}</div>
                        <EquipmentWidget customSlotSize={s(42)} />
                 </div>

                 {/* Attributes List */}
                 <div className="flex flex-col gap-1">
                    <div className="text-[var(--accent-gold)] font-bold text-center border-b border-[var(--border-subtle)] mb-1 pb-1 text-xs tracking-wider uppercase">{t("attributes")}</div>
                    <LevelRow />
                    <HealthRow />
                    <CapRow />
                    <div className="h-px bg-[var(--border-subtle)] my-1" />
                    <AttackRow />
                    <DefenseRow />
                    <ArmorRow />
                    <SpeedRow />
                 </div>

                 {/* Skills List */}
                 <div className="flex flex-col gap-1 mt-2">
                    <div className="text-[#60a5fa] font-bold text-center border-b border-[var(--border-subtle)] mb-1 pb-1 text-xs tracking-wider uppercase">{t("skills")}</div>
                    <StrengthRow />
                    <DexterityRow />
                    <IntelligenceRow />
                    <ReflexRow />
                 </div>

                 {/* Conditions */}
                 <div className="flex flex-col gap-1 mt-2">
                    <div className="text-[var(--text-primary)] font-bold text-center border-b border-[var(--border-subtle)] mb-1 pb-1 text-xs tracking-wider uppercase">{t("conditions")}</div>
                    <WillpowerRow />
                    <HungerRow />
                 </div>
            </div>

            {/* RIGHT COLUMN: Inventory (Flexible) */}
            <div className="flex flex-col h-full min-h-0 bg-[var(--bg-glass)] border border-[var(--border-subtle)] rounded shadow-sm overflow-hidden">
                <HeroInventory items={items} balance={balance} />
            </div>

        </div> 
    );
};
