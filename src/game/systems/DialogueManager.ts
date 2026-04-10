import Phaser from "phaser";

export interface DialogueOption {
  text: string;
  next: string;
  action?: string; // e.g., "start_quest:id", "give_item:id"
}

export interface DialogueNode {
  text: string;
  options: DialogueOption[];
}

export interface DialogueData {
  [npcId: string]: {
    [nodeId: string]: DialogueNode;
  };
}

export class DialogueManager extends Phaser.Events.EventEmitter {
  private static instance: DialogueManager;
  private dialogues: DialogueData = {};
  private currentNpcId: string | null = null;
  private currentNodeId: string | null = null;

  private constructor() {
    super();
  }

  public static getInstance(): DialogueManager {
    if (!DialogueManager.instance) {
      DialogueManager.instance = new DialogueManager();
    }
    return DialogueManager.instance;
  }

  public loadDialogues(data: any) {
    this.dialogues = data.dialogues;
  }

  public startDialogue(npcId: string, startNode: string = "start") {
    if (!this.dialogues[npcId]) {
      console.warn(`No dialogue found for NPC: ${npcId}`);
      return;
    }
    this.currentNpcId = npcId;
    this.currentNodeId = startNode;
    this.emitDialogueUpdate();
  }

  public selectOption(index: number) {
    if (!this.currentNpcId || !this.currentNodeId) return;

    const node = this.dialogues[this.currentNpcId][this.currentNodeId];
    if (!node || !node.options[index]) return;

    const option = node.options[index];

    // Handle Actions
    if (option.action) {
      this.handleAction(option.action);
    }

    if (option.next === "close") {
      this.closeDialogue();
    } else {
      this.currentNodeId = option.next;
      this.emitDialogueUpdate();
    }
  }

  private emitDialogueUpdate() {
    if (!this.currentNpcId || !this.currentNodeId) return;
    const node = this.dialogues[this.currentNpcId][this.currentNodeId];
    
    this.emit("dialogue_update", {
      npcId: this.currentNpcId,
      text: node.text,
      options: node.options
    });
  }

  private closeDialogue() {
    this.currentNpcId = null;
    this.currentNodeId = null;
    this.emit("dialogue_close");
  }

  private handleAction(actionString: string) {
    const [action, param] = actionString.split(":");
    console.log(`Executing Action: ${action} with param ${param}`);
    // Emit event for GameScene or QuestManager to pick up
    // global events or separate manager?
    // usually GameScene listens to DialogueManager
    this.emit("dialogue_action", { action, param });
  }
}
