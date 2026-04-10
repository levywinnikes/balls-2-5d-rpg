
import { EventEmitter } from "events";
import { PlayerState } from "../entities/Player/PlayerState";
import { t_game } from "../i18n/translations";
import { DialogueManager } from "./DialogueManager";

// --- Types & Interfaces ---

export type QuestType = "main" | "side" | "daily";

export interface QuestCondition {
    type: "kill" | "collect" | "talk" | "explore" | "level" | "none";
    target?: string; // enemyId, itemId, npcId, zoneId
    count?: number; // How many required
    current?: number; // Runtime progress (not saved in definition)
}

export interface QuestReward {
    type: "xp" | "gold" | "item" | "skill";
    value: string | number; // "sword_01" or 100
}

export interface QuestStage {
    id: number;
    description: string;
    conditions: QuestCondition[];
    rewards?: QuestReward[];
    onStartDialogue?: string; // Optional: Dialogue ID to trigger when this stage starts
    onCompleteDialogue?: string; // Optional: Dialogue ID to trigger when this stage completes
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
    conditionsProgress: number[]; // Array mapping to stage.conditions indices
}

// --- Quest Manager ---

export class QuestManager extends EventEmitter {
    private static instance: QuestManager;
    private questDefinitions: Map<string, QuestDefinition> = new Map();
    
    // Runtime State (Also synced to PlayerState)
    private activeQuests: Map<string, ActiveQuestState> = new Map();
    private completedQuests: Set<string> = new Set();

    private constructor() {
        super();
        this.setupListeners();
    }

    public static getInstance(): QuestManager {
        if (!QuestManager.instance) {
            QuestManager.instance = new QuestManager();
        }
        return QuestManager.instance;
    }

    private setupListeners() {
        const dm = DialogueManager.getInstance();
        dm.on("dialogue_action", (data: { action: string, param: string }) => {
            if (data.action === "start_quest") {
                this.startQuest(data.param);
            }
        });
    }

    /**
     * Loads quest definitions from JSON (Mocked for now)
     */
    public loadQuests(quests: QuestDefinition[]) {
        quests.forEach(q => this.questDefinitions.set(q.id, q));
        console.log(`[QuestManager] Loaded ${this.questDefinitions.size} quests.`);
    }

    public getQuestDefinition(questId: string): QuestDefinition | undefined {
        return this.questDefinitions.get(questId);
    }

    public getAllQuests(): QuestDefinition[] {
        return Array.from(this.questDefinitions.values());
    }

    /**
     * Starts a quest if requirements are met.
     */
    public startQuest(questId: string): boolean {
        if (this.activeQuests.has(questId) || this.completedQuests.has(questId)) {
            return false;
        }

        const def = this.questDefinitions.get(questId);
        if (!def) {
            console.error(`[QuestManager] Quest ${questId} not found.`);
            return false;
        }

        // Check Requirements (e.g. Level)
        const ps = PlayerState.getInstance();
        if (ps.getLevel() < def.minLevel) {
            ps.emit("message", t_game("msg_quest_level_req") + ` ${def.minLevel}`);
            return false;
        }

        // Initialize State
        const newState: ActiveQuestState = {
            questId: questId,
            stageId: 0,
            conditionsProgress: def.stages[0]?.conditions.map(() => 0) || []
        };

        this.activeQuests.set(questId, newState);
        this.emit("questStarted", questId);
        ps.emit("questUpdated"); // Notify UI
        ps.emit("message", `Quest Started: ${def.title}`); // Simple notification
        
        console.log(`[QuestManager] Started quest: ${questId}`);
        return true;
    }

    /**
     * Updates progress for "kill" objectives.
     */
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
                        
                        // Notify progress (optional detailed message)
                        // console.log(`Quest ${questId}: Killed ${enemyId} (${state.conditionsProgress[idx]}/${required})`);
                    }
                }
            });

            if (updated) {
                this.checkStageCompletion(questId, state, stage);
                PlayerState.getInstance().emit("questUpdated");
            }
        });
    }

    /**
     * Checks if the current stage is complete.
     */
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

        // Give Rewards for Stage (if any)
        if (stage.rewards) {
            this.distributeRewards(stage.rewards);
        }

        // Check if there is a next stage
        const nextStage = def.stages.find(s => s.id === stage.id + 1);
        
        if (nextStage) {
            // Advance
            state.stageId = nextStage.id;
            state.conditionsProgress = nextStage.conditions.map(() => 0);
            this.emit("questStageCompleted", { questId, stageId: stage.id });
             PlayerState.getInstance().emit("message", `Quest Objective Complete!`);
             
             // Check for OnCompleteDialogue (Stage transition)
             if (stage.onCompleteDialogue) {
                 // Open dialogue logic placeholder
             }
        } else {
            // Quest Complete
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
        
        // Play sound via AudioManager (dynamic import to avoid circular dep if needed, or import at top)
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

    // --- State Serialization for Save/Load ---

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
