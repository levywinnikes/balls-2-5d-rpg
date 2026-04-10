// systems/AutoSaveSystem.ts - Memory Only / Disabled Persistence
import { PlayerState } from "../entities/Player/PlayerState";

export class AutoSaveSystem {
  private scene: Phaser.Scene;
  private playerState: PlayerState;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.playerState = PlayerState.getInstance();
    // Listeners are kept for potential future memory-only features or debug
    // this.setupEventListeners(); 
  }

  // Auto-save disabled as per user request for manual file-only saves.
  // We keep the class structure to avoid breaking imports but strip logic.

  public destroy(): void {
    // No-op: Do NOT remove all listeners from Singleton PlayerState!
  }
}
