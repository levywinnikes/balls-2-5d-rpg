import Phaser from "phaser";
import { PlayerState } from "./Player/PlayerState";
import { DialogueManager } from "../systems/DialogueManager";
import { t_game } from "../i18n/translations";

export interface NPCData {
    id: string;
    name: string;
    x: number;
    y: number;
    sprite: string;
    interactionRadius?: number;
    scale?: number;
}

export class NPC extends Phaser.Physics.Arcade.Sprite {
    public id: string;
    public npcName: string;
    public interactionRadius: number;
    private nameText: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, data: NPCData) {
        super(scene, data.x, data.y, data.sprite);
        
        this.id = data.id;
        this.npcName = data.name;
        this.interactionRadius = data.interactionRadius || 64;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setImmovable(true);
        this.setBodySize(32, 32); 
        this.setCollideWorldBounds(true);

        // Name Tag
        this.nameText = scene.add.text(data.x, data.y - 40, this.npcName, {
            fontSize: "12px",
            color: "#00ff00", // Green for Friendly
            stroke: "#000000",
            strokeThickness: 2,
            fontFamily: "monospace"
        }).setOrigin(0.5);

        // Interaction Zone (Clickable)
        this.setInteractive({ cursor: "pointer" });
        this.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
             this.handleInteract();
        });

        // Optional: Circle for debug radius
        // const graphics = scene.add.graphics();
        // graphics.lineStyle(2, 0x00ff00, 0.5);
        // graphics.strokeCircle(this.x, this.y, this.interactionRadius);
    }

    private handleInteract() {
        const player = (this.scene as any).player; 
        if (!player) return;

        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (dist <= this.interactionRadius) {
            console.log(`[NPC] Interacting with ${this.npcName} (${this.id})`);
            
            // Trigger Dialogue
            DialogueManager.getInstance().startDialogue(this.id);
            
            // Emit global event for UI to pick up (optional, keep for other systems)
            PlayerState.getInstance().emit("npcInteraction", {
                npcId: this.id,
                npcName: this.npcName
            });
        } else {
            console.log("[NPC] Too far to interact.");
             if((this.scene as any).showFloatingText) {
                 (this.scene as any).showFloatingText(this.x, this.y - 60, t_game("msg_too_far"), 0xff0000);
             }
        }
    }

    public update() {
       // Optional: Face player?
    }

    public destroy(fromScene?: boolean) {
        this.nameText.destroy();
        super.destroy(fromScene);
    }
}
