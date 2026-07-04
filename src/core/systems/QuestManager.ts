import { EventEmitter } from "events";
import { PlayerState } from "../../game/entities/Player/PlayerState";

export type QuestType = "main" | "side" | "daily";

export interface QuestCondition {
    type: "kill" | "collect" | "talk" | "explore" | "level" | "none";
    target?: string;
    count?: number;
    current?: number;
}

export interface QuestReward {
    type: "xp" | "gold" | "item" | "skill";
    value: string | number;
}

export interface QuestStage {
    id: number;
    description: string;
    conditions: QuestCondition[];
    rewards?: QuestReward[];
    onStartDialogue?: string;
    onCompleteDialogue?: string;
}

export interface QuestDefinition {
    id: string;
    title: string;
    type: QuestType;
    minLevel: number;
    description: string;
    stages: QuestStage[];
}

export interface ActiveQuestState {
    questId: string;
    stageId: number;
    conditionsProgress: number[];
}

export class QuestManager extends EventEmitter {
    private static instance: QuestManager;
    private questDefinitions: Map<string, QuestDefinition> = new Map();

    private activeQuests: Map<string, ActiveQuestState> = new Map();
    private completedQuests: Set<string> = new Set();

    private onDialogueAction?: (data: { action: string; param: string }) => void;

    private constructor() {
        super();
    }

    public static getInstance(): QuestManager {
        if (!QuestManager.instance) {
            QuestManager.instance = new QuestManager();
        }
        return QuestManager.instance;
    }

    public setDialogueActionHandler(handler: (data: { action: string; param: string }) => void): void {
        this.onDialogueAction = handler;
    }

    public handleDialogueAction(data: { action: string; param: string }): void {
        if (data.action === "start_quest") {
            this.startQuest(data.param);
        }
    }

    public loadQuests(quests: QuestDefinition[]) {
        quests.forEach(q => this.questDefinitions.set(q.id, q));
    }

    public getQuestDefinition(questId: string): QuestDefinition | undefined {
        return this.questDefinitions.get(questId);
    }

    public getAllQuests(): QuestDefinition[] {
        return Array.from(this.questDefinitions.values());
    }

    public startQuest(questId: string): boolean {
        if (this.activeQuests.has(questId) || this.completedQuests.has(questId)) {
            return false;
        }

        const def = this.questDefinitions.get(questId);
        if (!def) {
            return false;
        }

        const ps = PlayerState.getInstance();
        if (ps.getLevel() < def.minLevel) {
            ps.emit("message", `Level ${def.minLevel} required to start this quest.`);
            return false;
        }

        const newState: ActiveQuestState = {
            questId: questId,
            stageId: 0,
            conditionsProgress: def.stages[0]?.conditions.map(() => 0) || []
        };

        this.activeQuests.set(questId, newState);
        this.emit("questStarted", questId);
        ps.emit("questUpdated");
        ps.emit("message", `Quest Started: ${def.title}`);

        return true;
    }

    public onEnemyKilled(enemyId: string) {
        this.activeQuests.forEach((state, questId) => {
            const def = this.questDefinitions.get(questId);
            if (!def) return;

            const stage = def.stages.find(s => s.id === state.stageId);
            if (!stage) return;

            let updated = false;

            stage.conditions.forEach((cond, idx) => {
                if (cond.type === "kill" && cond.target === enemyId) {
                    const required = cond.count || 1;
                    const current = state.conditionsProgress[idx] || 0;

                    if (current < required) {
                        state.conditionsProgress[idx] = current + 1;
                        updated = true;
                    }
                }
            });

            if (updated) {
                this.checkStageCompletion(questId, state, stage);
                PlayerState.getInstance().emit("questUpdated");
            }
        });
    }

    private checkStageCompletion(questId: string, state: ActiveQuestState, stage: QuestStage) {
        const isComplete = stage.conditions.every((cond, idx) => {
            const required = cond.count || 1;
            const current = state.conditionsProgress[idx] || 0;
            return current >= required;
        });

        if (isComplete) {
            this.completeStage(questId, state, stage);
        }
    }

    private completeStage(questId: string, state: ActiveQuestState, stage: QuestStage) {
        const def = this.questDefinitions.get(questId);
        if(!def) return;

        if (stage.rewards) {
            this.distributeRewards(stage.rewards);
        }

        const nextStage = def.stages.find(s => s.id === stage.id + 1);

        if (nextStage) {
            state.stageId = nextStage.id;
            state.conditionsProgress = nextStage.conditions.map(() => 0);
            this.emit("questStageCompleted", { questId, stageId: stage.id });
            PlayerState.getInstance().emit("message", `Quest Objective Complete!`);

            if (stage.onCompleteDialogue) {
                // Dialogue placeholder
            }
        } else {
            this.completeQuest(questId);
        }
    }

    private completeQuest(questId: string) {
        this.activeQuests.delete(questId);
        this.completedQuests.add(questId);

        const def = this.questDefinitions.get(questId);

        this.emit("questCompleted", questId);
        PlayerState.getInstance().emit("questUpdated");
        PlayerState.getInstance().emit("message", `Quest Completed: ${def?.title || questId}!`);
    }

    private distributeRewards(rewards: QuestReward[]) {
        const ps = PlayerState.getInstance();
        rewards.forEach(r => {
            if (r.type === "xp") {
                ps.gainExperience(Number(r.value));
            } else if (r.type === "item") {
                ps.addItem(r.value as string, 1);
            } else if (r.type === "gold") {
                ps.addBalance(Number(r.value));
            }
        });
    }

    public getSaveData() {
        return {
            active: Array.from(this.activeQuests.entries()),
            completed: Array.from(this.completedQuests)
        };
    }

    public loadSaveData(data: any) {
        if (!data) return;

        if (data.active) {
            this.activeQuests = new Map(data.active);
        }
        if (data.completed) {
            this.completedQuests = new Set(data.completed);
        }
    }
}
