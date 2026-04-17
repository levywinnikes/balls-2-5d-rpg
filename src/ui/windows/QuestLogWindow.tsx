import React, { useEffect, useState, useCallback } from "react";
import { useLanguage } from "../../context/LanguageContext";
import {
  QuestManager,
  QuestDefinition,
  ActiveQuestState,
} from "../../game/systems/QuestManager";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { CheckCircle, Circle, Gift } from "lucide-react";

export const QuestLogContent: React.FC = () => {
  const { t } = useLanguage();

  // State
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);

  const [activeQuests, setActiveQuests] = useState<ActiveQuestState[]>([]);
  const [completedQuests, setCompletedQuests] = useState<string[]>([]);
  const [questDefs, setQuestDefs] = useState<Map<string, QuestDefinition>>(
    new Map(),
  );

  const updateData = useCallback(() => {
    const qm = QuestManager.getInstance();
    const save = qm.getSaveData();

    const active: ActiveQuestState[] = [];
    save.active.forEach(([k, v]: [string, ActiveQuestState]) => active.push(v));

    setActiveQuests(active);
    setCompletedQuests(save.completed);

    // Load definitions if missing
    const defs = new Map<string, QuestDefinition>();
    qm.getAllQuests().forEach((q) => defs.set(q.id, q));
    setQuestDefs(defs);

    // Select first if none selected
    if (!selectedQuestId && active.length > 0) {
      setSelectedQuestId(active[0].questId);
    }
  }, [selectedQuestId]);

  // Data Fetching
  useEffect(() => {
    updateData();

    // Listen for updates
    const ps = PlayerState.getInstance();
    ps.on("questUpdated", updateData);
    return () => {
      ps.off("questUpdated", updateData);
    };
  }, [updateData]); // Removed dependence on windows.questLog, component mounts when window opens

  const getCurrentList = () => {
    if (activeTab === "active") return activeQuests;
    // For completed, we just have IDs, map to dummy state
    return completedQuests.map((id) => ({
      questId: id,
      stageId: 999,
      conditionsProgress: [],
    }));
  };

  const selectedQuestDef = selectedQuestId
    ? questDefs.get(selectedQuestId)
    : null;
  const selectedQuestState = activeQuests.find(
    (q) => q.questId === selectedQuestId,
  );

  return (
    <div className="flex h-full gap-4 text-sm p-4">
      {/* Left Sidebar: Quest List */}
      <div className="w-1/3 flex flex-col gap-2 border-r border-[#ffffff1a] pr-2">
        {/* Tabs */}
        <div className="flex gap-1 mb-2">
          <button
            className={`flex-1 py-1 text-center rounded ${activeTab === "active" ? "bg-amber-600/50 text-white" : "bg-black/30 text-gray-400 hover:bg-white/10"}`}
            onClick={() => setActiveTab("active")}
          >
            {t("active")}
          </button>
          <button
            className={`flex-1 py-1 text-center rounded ${activeTab === "completed" ? "bg-green-700/50 text-white" : "bg-black/30 text-gray-400 hover:bg-white/10"}`}
            onClick={() => setActiveTab("completed")}
          >
            {t("completed")}
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {getCurrentList().map((qState) => {
            const def = questDefs.get(qState.questId);
            if (!def) return null;
            const isSelected = selectedQuestId === qState.questId;

            return (
              <div
                key={qState.questId}
                onClick={() => setSelectedQuestId(qState.questId)}
                className={`
                                p-2 rounded cursor-pointer transition-colors border
                                ${
                                  isSelected
                                    ? "bg-white/10 border-amber-500/50 text-amber-100"
                                    : "bg-black/20 border-transparent hover:bg-white/5 text-gray-300"
                                }
                            `}
              >
                <div className="font-bold">{def.title}</div>
                {activeTab === "active" && (
                  <div className="text-xs text-gray-500 truncate">
                    {def.type.toUpperCase()}
                  </div>
                )}
              </div>
            );
          })}
          {getCurrentList().length === 0 && (
            <div className="text-center text-gray-500 italic mt-4">
              {t("no_quests")}
            </div>
          )}
        </div>
      </div>

      {/* Right Content: Details */}
      <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar pl-2">
        {selectedQuestDef ? (
          <div className="space-y-4">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-bold text-amber-400 border-b border-white/10 pb-2 mb-2">
                {selectedQuestDef.title}
              </h2>
              <p className="text-gray-300 italic">
                {selectedQuestDef.description}
              </p>
            </div>

            {/* Objectives (Only for Active) */}
            {activeTab === "active" && selectedQuestState && (
              <div className="space-y-3">
                <h3 className="text-amber-200 font-semibold uppercase text-xs tracking-wider">
                  {t("objectives")}
                </h3>

                <div className="bg-black/30 p-3 rounded border border-white/5 space-y-2">
                  {(() => {
                    const stage = selectedQuestDef.stages.find(
                      (s) => s.id === selectedQuestState.stageId,
                    );
                    if (!stage) return <div>{t("quest_stage_error")}</div>;

                    return (
                      <>
                        <p className="text-white mb-2">{stage.description}</p>
                        <div className="space-y-2">
                          {stage.conditions.map((cond, idx) => {
                            const current =
                              selectedQuestState.conditionsProgress[idx] || 0;
                            const target = cond.count || 1;
                            const isDone = current >= target;

                            return (
                              <div
                                key={idx}
                                className="flex items-center gap-2 text-sm"
                              >
                                {isDone ? (
                                  <CheckCircle
                                    size={16}
                                    className="text-green-500"
                                  />
                                ) : (
                                  <Circle size={16} className="text-gray-500" />
                                )}
                                <span
                                  className={
                                    isDone
                                      ? "text-gray-500 line-through"
                                      : "text-gray-300"
                                  }
                                >
                                  {cond.type === "kill" &&
                                    t("quest_condition_kill", {
                                      target: cond.target || "",
                                      current: String(current),
                                      targetCount: String(target),
                                    })}
                                  {cond.type === "collect" &&
                                    t("quest_condition_collect", {
                                      target: cond.target || "",
                                      current: String(current),
                                      targetCount: String(target),
                                    })}
                                  {cond.type === "talk" &&
                                    t("quest_condition_talk", {
                                      target: cond.target || "",
                                    })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Completed State */}
            {activeTab === "completed" && (
              <div className="bg-green-900/20 border border-green-500/30 p-4 rounded text-center">
                <CheckCircle
                  size={32}
                  className="mx-auto text-green-500 mb-2"
                />
                <h3 className="text-green-400 font-bold">
                  {t("quest_completed")}
                </h3>
              </div>
            )}

            {/* Rewards Preview (Static for now or pulled from def) */}
            <div className="pt-4 border-t border-white/10">
              <h3 className="flex items-center gap-2 text-amber-200 font-semibold uppercase text-xs tracking-wider mb-2">
                <Gift size={14} /> {t("rewards")}
              </h3>
              <div className="text-gray-400 text-sm">
                {t("quest_rewards_hint")}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            {t("select_quest")}
          </div>
        )}
      </div>
    </div>
  );
};
